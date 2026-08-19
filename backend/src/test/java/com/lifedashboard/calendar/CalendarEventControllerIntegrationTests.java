package com.lifedashboard.calendar;

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
class CalendarEventControllerIntegrationTests {

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private CalendarEventRepository eventRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
    }

    @Test
    void supportsTaskCrudAndOccurrenceFlow() throws Exception {
        String title = "Task " + UUID.randomUUID();
        String location = mockMvc.perform(post("/api/calendar/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(taskJson(title, "ACTIVE")))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.eventType").value("TASK"))
                .andExpect(jsonPath("$.scheduleType").value("SELECTED_DAYS"))
                .andExpect(jsonPath("$.scheduleDays", hasItem(1)))
                .andReturn().getResponse().getHeader("Location");

        Long id = idFrom(location);
        try {
            mockMvc.perform(get("/api/calendar/events").param("eventType", "TASK"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].title", hasItem(title)));

            mockMvc.perform(put(location)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(taskJson(title + " updated", "PAUSED")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.title").value(title + " updated"))
                    .andExpect(jsonPath("$.status").value("PAUSED"));

            mockMvc.perform(put(location + "/occurrences/2026-08-05")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"COMPLETED\",\"note\":\"Done\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("COMPLETED"))
                    .andExpect(jsonPath("$.completedAt").isNotEmpty());

            mockMvc.perform(get(location + "/occurrences"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].occurrenceDate").value("2026-08-05"));

            mockMvc.perform(get("/api/calendar/occurrences")
                            .param("from", "2026-08-05")
                            .param("to", "2026-08-05"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].eventId").value(id))
                    .andExpect(jsonPath("$[0].occurrence.occurrenceDate").value("2026-08-05"));

            mockMvc.perform(delete(location)).andExpect(status().isNoContent());
            mockMvc.perform(get(location)).andExpect(status().isNotFound());
        } finally {
            eventRepository.findById(id).ifPresent(eventRepository::delete);
        }
    }

    @Test
    void validatesCalendarRules() throws Exception {
        mockMvc.perform(post("/api/calendar/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "Invalid all-day event",
                                  "eventType": "EVENT",
                                  "scheduleType": "ONCE",
                                  "startDate": "2026-08-05",
                                  "startTime": "10:00:00",
                                  "allDay": true,
                                  "status": "ACTIVE"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("All-day events must not contain startTime or endTime"));

        mockMvc.perform(post("/api/calendar/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "title": "No selected days",
                                  "eventType": "TASK",
                                  "scheduleType": "SELECTED_DAYS",
                                  "startDate": "2026-08-05",
                                  "allDay": true,
                                  "status": "ACTIVE"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    private String taskJson(String title, String status) {
        return """
                {
                  "title": "%s",
                  "description": "Calendar integration test",
                  "eventType": "TASK",
                  "scheduleType": "SELECTED_DAYS",
                  "startDate": "2026-08-04",
                  "repeatUntil": "2026-08-31",
                  "startTime": "09:00:00",
                  "endTime": "10:00:00",
                  "allDay": false,
                  "location": "Home",
                  "status": "%s",
                  "scheduleDays": [1, 3, 5]
                }
                """.formatted(title, status);
    }

    private Long idFrom(String location) {
        return Long.valueOf(location.substring(location.lastIndexOf('/') + 1));
    }
}
