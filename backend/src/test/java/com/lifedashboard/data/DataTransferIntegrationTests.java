package com.lifedashboard.data;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@Transactional
class DataTransferIntegrationTests {

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private JdbcTemplate jdbc;

    @TempDir
    Path backupDirectory;

    @Test
    void exportsDownloadAndRejectsInvalidArchive() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();

        mockMvc.perform(get("/api/data/export"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", MediaType.APPLICATION_JSON_VALUE))
                .andExpect(header().exists("Content-Disposition"))
                .andExpect(jsonPath("$.formatVersion").value(1))
                .andExpect(jsonPath("$.schemaVersion").isString())
                .andExpect(jsonPath("$.tables.users").isArray());

        MockMultipartFile invalid = new MockMultipartFile(
                "file", "invalid.json", MediaType.APPLICATION_JSON_VALUE,
                "not-json".getBytes(StandardCharsets.UTF_8));
        mockMvc.perform(multipart("/api/data/import").file(invalid))
                .andExpect(status().isBadRequest());
    }

    @Test
    void roundTripsAllApplicationTablesAndCreatesBackup() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-08-20T10:15:30Z"), ZoneOffset.UTC);
        DataTransferService service = new DataTransferService(jdbc, backupDirectory, clock);
        byte[] archive = service.exportData();
        Map<String, Long> rowsBefore = applicationTableRows();

        DataTransferResponse firstImport = service.importData(archive);
        Map<String, Long> rowsAfterFirstImport = applicationTableRows();
        DataTransferResponse secondImport = service.importData(archive);
        Map<String, Long> rowsAfterSecondImport = applicationTableRows();

        assertThat(rowsAfterFirstImport).isEqualTo(rowsBefore);
        assertThat(rowsAfterSecondImport).isEqualTo(rowsBefore);
        assertThat(firstImport.tableCount()).isEqualTo(rowsBefore.size());
        assertThat(secondImport.tableCount()).isEqualTo(rowsBefore.size());
        assertThat(firstImport.rowCount()).isEqualTo(rowsBefore.values().stream().mapToLong(Long::longValue).sum());
        assertThat(secondImport.rowCount()).isEqualTo(firstImport.rowCount());
        assertThat(Files.exists(Path.of(secondImport.backupFile()))).isTrue();
        assertThat(Files.readString(Path.of(secondImport.backupFile()))).contains("\"formatVersion\":1");
    }

    @Test
    void rejectsIncompatibleArchiveBeforeCreatingBackup() throws Exception {
        Clock clock = Clock.fixed(Instant.parse("2026-08-20T10:15:30Z"), ZoneOffset.UTC);
        DataTransferService service = new DataTransferService(jdbc, backupDirectory, clock);
        String archive = new String(service.exportData(), StandardCharsets.UTF_8);
        byte[] incompatible = archive.replace("\"formatVersion\":1", "\"formatVersion\":999")
                .getBytes(StandardCharsets.UTF_8);
        Map<String, Long> rowsBefore = applicationTableRows();

        assertThatThrownBy(() -> service.importData(incompatible))
                .hasMessage("Unsupported import format version");

        assertThat(applicationTableRows()).isEqualTo(rowsBefore);
        try (var files = Files.list(backupDirectory)) {
            assertThat(files).isEmpty();
        }
    }

    private Map<String, Long> applicationTableRows() {
        List<String> tables = jdbc.queryForList("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_type = 'BASE TABLE'
                  AND table_name <> 'flyway_schema_history'
                ORDER BY table_name
                """, String.class);
        Map<String, Long> result = new LinkedHashMap<>();
        for (String table : tables) {
            assertThat(table).matches("[a-z][a-z0-9_]*");
            result.put(table, jdbc.queryForObject("SELECT COUNT(*) FROM \"" + table + "\"", Long.class));
        }
        return result;
    }
}
