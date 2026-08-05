package com.lifedashboard.habit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class HabitControllerIntegrationTests {

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private HabitRepository habitRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
    }

    @Test
    void supportsHabitCrudAndEntryFlow() throws Exception {
        String name = "Exercise " + UUID.randomUUID();
        String location = mockMvc.perform(post("/api/habits")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(habitJson(name, "ACTIVE")))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.trackingType").value("DURATION"))
                .andExpect(jsonPath("$.scheduleDays", hasItem(1)))
                .andReturn().getResponse().getHeader("Location");

        Long id = idFrom(location);
        try {
            mockMvc.perform(get("/api/habits").param("status", "ACTIVE"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].name", hasItem(name)));

            mockMvc.perform(put(location)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(habitJson(name + " updated", "PAUSED")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value(name + " updated"))
                    .andExpect(jsonPath("$.status").value("PAUSED"));

            mockMvc.perform(put(location + "/entries/2026-08-05")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"value\":45,\"skipped\":false,\"note\":\"Completed\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.value").value(45))
                    .andExpect(jsonPath("$.targetValueSnapshot").value(30))
                    .andExpect(jsonPath("$.recordedAt").isNotEmpty());

            mockMvc.perform(get(location + "/entries"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].entryDate").value("2026-08-05"));

            mockMvc.perform(delete(location)).andExpect(status().isNoContent());
            mockMvc.perform(get(location)).andExpect(status().isNotFound());
        } finally {
            habitRepository.findById(id).ifPresent(habitRepository::delete);
        }
    }

    @Test
    void validatesScheduleAndEntryRules() throws Exception {
        mockMvc.perform(post("/api/habits")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Invalid schedule",
                                  "trackingType": "BOOLEAN",
                                  "dataSource": "MANUAL",
                                  "scheduleType": "SELECTED_DAYS",
                                  "startDate": "2026-08-05",
                                  "status": "ACTIVE"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("scheduleDays are required for SELECTED_DAYS"));

        String location = mockMvc.perform(post("/api/habits")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(habitJson("Validation " + UUID.randomUUID(), "ACTIVE")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        Long id = idFrom(location);
        try {
            mockMvc.perform(put(location + "/entries/2026-08-05")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"value\":10,\"skipped\":true}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Skipped entries must not contain a value"));
        } finally {
            habitRepository.findById(id).ifPresent(habitRepository::delete);
        }
    }

    private String habitJson(String name, String status) {
        return """
                {
                  "name": "%s",
                  "description": "Integration test habit",
                  "trackingType": "DURATION",
                  "dataSource": "MANUAL",
                  "targetValue": 30,
                  "unit": "minutes",
                  "scheduleType": "SELECTED_DAYS",
                  "startDate": "2026-08-01",
                  "endDate": "2026-12-31",
                  "status": "%s",
                  "scheduleDays": [1, 3, 5]
                }
                """.formatted(name, status);
    }

    private Long idFrom(String location) {
        return Long.valueOf(location.substring(location.lastIndexOf('/') + 1));
    }
}
