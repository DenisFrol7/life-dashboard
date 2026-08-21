package com.lifedashboard.data;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.common.error.InvalidRequestException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class DataTransferService {

    private static final int FORMAT_VERSION = 1;
    private static final int MAX_IMPORT_BYTES = 50 * 1024 * 1024;
    private static final DateTimeFormatter BACKUP_TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss-SSS").withZone(ZoneId.systemDefault());

    private final JdbcTemplate jdbc;
    private final Path backupDirectory;
    private final Clock clock;

    @Autowired
    public DataTransferService(JdbcTemplate jdbc,
                               @Value("${app.backup-directory:../backups}") String backupDirectory) {
        this(jdbc, Path.of(backupDirectory), Clock.systemDefaultZone());
    }

    DataTransferService(JdbcTemplate jdbc, Path backupDirectory, Clock clock) {
        this.jdbc = jdbc;
        this.backupDirectory = backupDirectory.toAbsolutePath().normalize();
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public byte[] exportData() {
        return createExport().getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public DataTransferResponse importData(byte[] content) {
        if (content == null || content.length == 0) {
            throw new InvalidRequestException("Import file is empty");
        }
        if (content.length > MAX_IMPORT_BYTES) {
            throw new InvalidRequestException("Import file is larger than 50 MB");
        }

        String json = new String(content, StandardCharsets.UTF_8);
        List<String> tables = applicationTables();
        validateArchive(json, tables);
        Path backup = writeAutomaticBackup(createExport());

        List<String> insertionOrder = insertionOrder(tables);
        for (int index = insertionOrder.size() - 1; index >= 0; index--) {
            jdbc.update("DELETE FROM " + quote(insertionOrder.get(index)));
        }

        long rows = 0;
        for (String table : insertionOrder) {
            String tableName = quote(table);
            rows += jdbc.queryForObject(
                    "SELECT jsonb_array_length((CAST(? AS jsonb) -> 'tables' -> ?))",
                    Integer.class, json, table);
            jdbc.update("INSERT INTO " + tableName
                    + " SELECT * FROM jsonb_populate_recordset(NULL::" + tableName
                    + ", (CAST(? AS jsonb) -> 'tables' -> ?))", json, table);
        }
        resetSequences();
        return new DataTransferResponse(backup.toString(), tables.size(), rows);
    }

    private String createExport() {
        List<String> tables = applicationTables();
        StringBuilder result = new StringBuilder(1024);
        result.append("{\"formatVersion\":").append(FORMAT_VERSION)
                .append(",\"schemaVersion\":\"").append(schemaVersion())
                .append("\",\"exportedAt\":\"").append(Instant.now(clock))
                .append("\",\"tables\":{");
        for (int index = 0; index < tables.size(); index++) {
            String table = tables.get(index);
            if (index > 0) result.append(',');
            String rows = jdbc.queryForObject(
                    "SELECT COALESCE(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb)::text FROM "
                            + quote(table) + " row_data", String.class);
            result.append('"').append(table).append("\":").append(rows);
        }
        return result.append("}}").toString();
    }

    private void validateArchive(String json, List<String> currentTables) {
        try {
            Integer formatVersion = jdbc.queryForObject(
                    "SELECT (CAST(? AS jsonb) ->> 'formatVersion')::integer", Integer.class, json);
            String archiveSchema = jdbc.queryForObject(
                    "SELECT CAST(? AS jsonb) ->> 'schemaVersion'", String.class, json);
            List<String> archiveTables = jdbc.queryForList(
                    "SELECT jsonb_object_keys(CAST(? AS jsonb) -> 'tables')", String.class, json);
            if (formatVersion == null || formatVersion != FORMAT_VERSION) {
                throw new InvalidRequestException("Unsupported import format version");
            }
            if (!schemaVersion().equals(archiveSchema)) {
                throw new InvalidRequestException("Import file was created for a different database schema");
            }
            if (!new HashSet<>(currentTables).equals(new HashSet<>(archiveTables))
                    || currentTables.size() != archiveTables.size()) {
                throw new InvalidRequestException("Import file contains an incompatible table set");
            }
            for (String table : currentTables) {
                Boolean array = jdbc.queryForObject(
                        "SELECT jsonb_typeof(CAST(? AS jsonb) -> 'tables' -> ?) = 'array'",
                        Boolean.class, json, table);
                if (!Boolean.TRUE.equals(array)) {
                    throw new InvalidRequestException("Invalid data for table " + table);
                }
            }
        } catch (InvalidRequestException exception) {
            throw exception;
        } catch (DataAccessException exception) {
            throw new InvalidRequestException("Import file is not a valid Life Dashboard archive");
        }
    }

    private Path writeAutomaticBackup(String content) {
        try {
            Files.createDirectories(backupDirectory);
            Path file = backupDirectory.resolve("life-dashboard_before-import_"
                    + BACKUP_TIMESTAMP.format(Instant.now(clock)) + ".json");
            return Files.writeString(file, content, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not create the automatic backup before import", exception);
        }
    }

    private List<String> applicationTables() {
        return jdbc.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                  AND table_name <> 'flyway_schema_history'
                ORDER BY table_name
                """, String.class);
    }

    private String schemaVersion() {
        return jdbc.queryForObject("""
                SELECT version
                FROM flyway_schema_history
                WHERE success
                ORDER BY installed_rank DESC
                LIMIT 1
                """, String.class);
    }

    private List<String> insertionOrder(List<String> tables) {
        Set<String> known = new LinkedHashSet<>(tables);
        Map<String, Set<String>> children = new HashMap<>();
        Map<String, Integer> dependencies = new HashMap<>();
        tables.forEach(table -> {
            children.put(table, new LinkedHashSet<>());
            dependencies.put(table, 0);
        });

        jdbc.query("""
                SELECT child.relname AS child_table, parent.relname AS parent_table
                FROM pg_constraint constraint_data
                JOIN pg_class child ON child.oid = constraint_data.conrelid
                JOIN pg_namespace child_schema ON child_schema.oid = child.relnamespace
                JOIN pg_class parent ON parent.oid = constraint_data.confrelid
                JOIN pg_namespace parent_schema ON parent_schema.oid = parent.relnamespace
                WHERE constraint_data.contype = 'f'
                  AND child_schema.nspname = 'public'
                  AND parent_schema.nspname = 'public'
                """, row -> {
            String child = row.getString("child_table");
            String parent = row.getString("parent_table");
            if (known.contains(child) && known.contains(parent) && !child.equals(parent)
                    && children.get(parent).add(child)) {
                dependencies.compute(child, (key, value) -> value + 1);
            }
        });

        ArrayDeque<String> ready = new ArrayDeque<>();
        tables.stream().filter(table -> dependencies.get(table) == 0)
                .forEach((@NonNull String table) -> ready.add(table));
        List<String> result = new ArrayList<>(tables.size());
        while (!ready.isEmpty()) {
            String parent = ready.removeFirst();
            result.add(parent);
            children.get(parent).stream().sorted().forEach(child -> {
                int remaining = dependencies.compute(child, (key, value) -> value - 1);
                if (remaining == 0) ready.addLast(child);
            });
        }
        if (result.size() != tables.size()) {
            throw new IllegalStateException("Database table dependencies contain a cycle");
        }
        return result;
    }

    private void resetSequences() {
        List<Map<String, Object>> sequences = jdbc.queryForList("""
                SELECT table_name, column_name,
                       pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND column_default LIKE 'nextval(%'
                """);
        for (Map<String, Object> sequence : sequences) {
            String table = sequence.get("table_name").toString();
            String column = sequence.get("column_name").toString();
            String sequenceName = sequence.get("sequence_name").toString();
            Long maximum = jdbc.queryForObject(
                    "SELECT MAX(" + quote(column) + ") FROM " + quote(table), Long.class);
            boolean hasRows = maximum != null;
            long sequenceValue = maximum == null ? 1L : maximum.longValue();
            jdbc.queryForObject("SELECT setval(CAST(? AS regclass), ?, ?)", Long.class,
                    sequenceName, sequenceValue, hasRows);
        }
    }

    private String quote(String identifier) {
        if (!identifier.matches("[a-z][a-z0-9_]*")) {
            throw new IllegalArgumentException("Unsafe database identifier");
        }
        return '"' + identifier + '"';
    }
}
