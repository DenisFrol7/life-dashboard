package com.lifedashboard.common.health;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class HealthControllerTests {
    @Test
    void reportsAvailabilityWithoutDatabaseAndDisablesCaching() throws Exception {
        MockMvcBuilders.standaloneSetup(new HealthController()).build()
                .perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"status\":\"UP\"}"))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
