package com.lifedashboard.sleep;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class SleepSessionControllerIntegrationTests {

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private SleepSessionRepository sessionRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
    }

    @Test
    void supportsCrudAndOverlappingRangeFlow() throws Exception {
        String location = mockMvc.perform(post("/api/sleep-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sessionJson("2099-02-01T21:00:00Z", "2099-02-02T05:00:00Z", 4, "Good sleep")))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.qualityRating").value(4))
                .andReturn().getResponse().getHeader("Location");

        Long id = idFrom(location);
        try {
            mockMvc.perform(get(location))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.deepSleepMinutes").value(90));

            mockMvc.perform(get("/api/sleep-sessions")
                            .param("from", "2099-02-02T00:00:00Z")
                            .param("to", "2099-02-02T23:59:59Z"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].id", hasItem(id.intValue())));

            mockMvc.perform(put(location)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(sessionJson("2099-02-01T21:30:00Z", "2099-02-02T05:30:00Z", 5, "Excellent")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.startedAt").value("2099-02-01T21:30:00Z"))
                    .andExpect(jsonPath("$.qualityRating").value(5));

            mockMvc.perform(delete(location)).andExpect(status().isNoContent());
            mockMvc.perform(get(location)).andExpect(status().isNotFound());
        } finally {
            sessionRepository.findById(id).ifPresent(sessionRepository::delete);
        }
    }

    @Test
    void validatesTimesDurationsAndRating() throws Exception {
        mockMvc.perform(post("/api/sleep-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(sessionJson("2099-02-02T05:00:00Z", "2099-02-01T21:00:00Z", 4, "Invalid")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("endedAt must be after startedAt"));

        mockMvc.perform(post("/api/sleep-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "startedAt": "2099-02-01T21:00:00Z",
                                  "endedAt": "2099-02-02T05:00:00Z",
                                  "deepSleepMinutes": -1,
                                  "qualityRating": 6
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.deepSleepMinutes").exists())
                .andExpect(jsonPath("$.fieldErrors.qualityRating").exists());

        mockMvc.perform(post("/api/sleep-sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "startedAt": "2099-02-01T21:00:00Z",
                                  "endedAt": "2099-02-02T05:00:00Z",
                                  "deepSleepMinutes": 120,
                                  "lightSleepMinutes": 300,
                                  "remSleepMinutes": 100,
                                  "awakeMinutes": 60,
                                  "qualityRating": 4
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Sleep stages must not exceed the session duration"));

        mockMvc.perform(get("/api/sleep-sessions")
                        .param("from", "2099-02-02T05:00:00Z")
                        .param("to", "2099-02-02T05:00:00Z"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("to must be after from"));
    }

    private String sessionJson(String startedAt, String endedAt, int qualityRating, String note) {
        return """
                {
                  "startedAt": "%s",
                  "endedAt": "%s",
                  "deepSleepMinutes": 90,
                  "lightSleepMinutes": 240,
                  "remSleepMinutes": 100,
                  "awakeMinutes": 50,
                  "qualityRating": %d,
                  "note": "%s"
                }
                """.formatted(startedAt, endedAt, qualityRating, note);
    }

    private Long idFrom(String location) {
        return Long.valueOf(location.substring(location.lastIndexOf('/') + 1));
    }
}
