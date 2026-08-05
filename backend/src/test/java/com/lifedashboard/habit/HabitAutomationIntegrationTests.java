package com.lifedashboard.habit;

import com.lifedashboard.activity.DailyActivityRepository;
import com.lifedashboard.sleep.SleepSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
class HabitAutomationIntegrationTests {

    private static final LocalDate ACTIVITY_DATE = LocalDate.of(2099, 3, 2);

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private HabitRepository habitRepository;

    @Autowired
    private DailyActivityRepository activityRepository;

    @Autowired
    private SleepSessionRepository sleepSessionRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
        activityRepository.findByUserIdAndActivityDate(1L, ACTIVITY_DATE).ifPresent(activityRepository::delete);
    }

    @Test
    void synchronizesActivityAndSleepWithAutomaticHabits() throws Exception {
        List<Long> habitIds = new ArrayList<>();
        Long sleepSessionId = null;
        try {
            Long stepsHabitId = createHabit("Auto steps", "NUMBER", "DAILY_ACTIVITY_STEPS", 10000, "steps");
            Long distanceHabitId = createHabit("Auto distance", "NUMBER", "DAILY_ACTIVITY_DISTANCE", 7000, "meters");
            Long sleepHabitId = createHabit("Auto sleep", "DURATION", "SLEEP_DURATION", 480, "minutes");
            habitIds.add(stepsHabitId);
            habitIds.add(distanceHabitId);
            habitIds.add(sleepHabitId);

            mockMvc.perform(put("/api/daily-activity/{date}", ACTIVITY_DATE)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"steps\":8500,\"distanceMeters\":6300}"))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/habits/{id}/entries", stepsHabitId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].entryDate").value(ACTIVITY_DATE.toString()))
                    .andExpect(jsonPath("$[0].value").value(8500))
                    .andExpect(jsonPath("$[0].targetValueSnapshot").value(10000));

            mockMvc.perform(get("/api/habits/{id}/entries", distanceHabitId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].value").value(6300));

            String sleepLocation = mockMvc.perform(post("/api/sleep-sessions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "startedAt": "2099-03-03T20:00:00Z",
                                      "endedAt": "2099-03-04T04:00:00Z",
                                      "awakeMinutes": 30,
                                      "qualityRating": 4
                                    }
                                    """))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getHeader("Location");
            sleepSessionId = idFrom(sleepLocation);

            mockMvc.perform(get("/api/habits/{id}/entries", sleepHabitId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].entryDate").value("2099-03-04"))
                    .andExpect(jsonPath("$[0].value").value(450));

            mockMvc.perform(delete("/api/daily-activity/{date}", ACTIVITY_DATE))
                    .andExpect(status().isNoContent());
            mockMvc.perform(get("/api/habits/{id}/entries", stepsHabitId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isEmpty());

            mockMvc.perform(delete("/api/sleep-sessions/{id}", sleepSessionId))
                    .andExpect(status().isNoContent());
            sleepSessionId = null;
            mockMvc.perform(get("/api/habits/{id}/entries", sleepHabitId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isEmpty());
        } finally {
            activityRepository.findByUserIdAndActivityDate(1L, ACTIVITY_DATE).ifPresent(activityRepository::delete);
            if (sleepSessionId != null) {
                Long remainingSleepSessionId = sleepSessionId;
                sleepSessionRepository.findById(remainingSleepSessionId).ifPresent(sleepSessionRepository::delete);
            }
            habitIds.forEach(id -> habitRepository.findById(id).ifPresent(habitRepository::delete));
        }
    }

    private Long createHabit(String name, String trackingType, String dataSource, int targetValue, String unit)
            throws Exception {
        String location = mockMvc.perform(post("/api/habits")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "%s",
                                  "trackingType": "%s",
                                  "dataSource": "%s",
                                  "targetValue": %d,
                                  "unit": "%s",
                                  "scheduleType": "DAILY",
                                  "startDate": "2099-01-01",
                                  "endDate": "2099-12-31",
                                  "status": "ACTIVE"
                                }
                                """.formatted(name, trackingType, dataSource, targetValue, unit)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        return idFrom(location);
    }

    private Long idFrom(String location) {
        return Long.valueOf(location.substring(location.lastIndexOf('/') + 1));
    }
}
