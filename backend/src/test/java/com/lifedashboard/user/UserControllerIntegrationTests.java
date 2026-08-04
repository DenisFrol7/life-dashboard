package com.lifedashboard.user;

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
class UserControllerIntegrationTests {

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private UserRepository userRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
    }

    @Test
    void supportsFullCrudFlow() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String username = "user-" + suffix;
        String email = suffix + "@example.com";

        String location = mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson(username, email)))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.username").value(username))
                .andExpect(jsonPath("$.timezone").value("Europe/Moscow"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.updatedAt").isNotEmpty())
                .andReturn()
                .getResponse()
                .getHeader("Location");

        try {
            mockMvc.perform(get(location))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.email").value(email));

            String updatedUsername = username + "-updated";
            mockMvc.perform(put(location)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(updateJson(updatedUsername, email)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.username").value(updatedUsername))
                    .andExpect(jsonPath("$.displayName").value("Updated user"))
                    .andExpect(jsonPath("$.updatedAt").isNotEmpty());

            mockMvc.perform(get("/api/users"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].username", hasItem(updatedUsername)));

            mockMvc.perform(delete(location))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get(location))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404));
        } finally {
            deleteByLocationIfPresent(location);
        }
    }

    @Test
    void returnsValidationAndConflictErrors() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String username = "duplicate-" + suffix;
        String email = suffix + "@example.com";

        String location = mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createJson(username, email)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getHeader("Location");

        try {
            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(createJson(username, "other-" + email)))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.status").value(409));

            mockMvc.perform(post("/api/users")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"username\":\"\",\"email\":\"invalid\",\"timezone\":\"\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors.username").exists())
                    .andExpect(jsonPath("$.fieldErrors.email").exists())
                    .andExpect(jsonPath("$.fieldErrors.timezone").exists());
        } finally {
            deleteByLocationIfPresent(location);
        }
    }

    private String createJson(String username, String email) {
        return """
                {
                  "username": "%s",
                  "displayName": "Test user",
                  "email": "%s",
                  "timezone": "Europe/Moscow"
                }
                """.formatted(username, email);
    }

    private String updateJson(String username, String email) {
        return """
                {
                  "username": "%s",
                  "displayName": "Updated user",
                  "email": "%s",
                  "timezone": "Europe/Moscow"
                }
                """.formatted(username, email);
    }

    private void deleteByLocationIfPresent(String location) {
        if (location == null) {
            return;
        }
        Long id = Long.valueOf(location.substring(location.lastIndexOf('/') + 1));
        userRepository.deleteById(id);
    }
}
