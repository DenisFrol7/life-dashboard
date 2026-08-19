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

import static org.assertj.core.api.Assertions.assertThat;
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
        Integer usersBefore = jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class);
        Integer contentBefore = jdbc.queryForObject("SELECT COUNT(*) FROM content_items", Integer.class);

        DataTransferResponse response = service.importData(archive);

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users", Integer.class)).isEqualTo(usersBefore);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM content_items", Integer.class)).isEqualTo(contentBefore);
        assertThat(response.tableCount()).isGreaterThan(20);
        assertThat(response.rowCount()).isPositive();
        assertThat(Files.exists(Path.of(response.backupFile()))).isTrue();
        assertThat(Files.readString(Path.of(response.backupFile()))).contains("\"formatVersion\":1");
    }
}
