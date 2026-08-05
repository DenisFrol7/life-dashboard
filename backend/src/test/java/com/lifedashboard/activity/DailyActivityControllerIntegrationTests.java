package com.lifedashboard.activity;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class DailyActivityControllerIntegrationTests {

    private static final LocalDate FIRST_DATE = LocalDate.of(2099, 1, 10);
    private static final LocalDate SECOND_DATE = LocalDate.of(2099, 1, 11);

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private DailyActivityRepository activityRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
        deleteIfPresent(FIRST_DATE);
        deleteIfPresent(SECOND_DATE);
    }

    @Test
    void supportsUpsertRangeAndDeleteFlow() throws Exception {
        try {
            mockMvc.perform(put("/api/daily-activity/{date}", FIRST_DATE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"steps\":8000,\"distanceMeters\":6200,\"note\":\"Morning walk\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.activityDate").value(FIRST_DATE.toString()))
                    .andExpect(jsonPath("$.steps").value(8000));

            mockMvc.perform(put("/api/daily-activity/{date}", FIRST_DATE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"steps\":10000,\"distanceMeters\":7500}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.steps").value(10000));

            mockMvc.perform(put("/api/daily-activity/{date}", SECOND_DATE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"steps\":5000}"))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/daily-activity")
                            .param("from", FIRST_DATE.toString())
                            .param("to", SECOND_DATE.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].activityDate", hasItem(FIRST_DATE.toString())))
                    .andExpect(jsonPath("$[*].activityDate", hasItem(SECOND_DATE.toString())));

            mockMvc.perform(delete("/api/daily-activity/{date}", FIRST_DATE))
                    .andExpect(status().isNoContent());
            mockMvc.perform(get("/api/daily-activity/{date}", FIRST_DATE))
                    .andExpect(status().isNotFound());
        } finally {
            deleteIfPresent(FIRST_DATE);
            deleteIfPresent(SECOND_DATE);
        }
    }

    @Test
    void validatesValuesAndDateRange() throws Exception {
        mockMvc.perform(put("/api/daily-activity/{date}", FIRST_DATE)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"steps\":-1,\"distanceMeters\":-10}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.steps").exists())
                .andExpect(jsonPath("$.fieldErrors.distanceMeters").exists());

        mockMvc.perform(get("/api/daily-activity")
                        .param("from", SECOND_DATE.toString())
                        .param("to", FIRST_DATE.toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("to must not be before from"));
    }

    private void deleteIfPresent(LocalDate date) {
        activityRepository.findByUserIdAndActivityDate(1L, date).ifPresent(activityRepository::delete);
    }
}
