package com.lifedashboard.content;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
class ContentControllerIntegrationTests {
    private static final String TITLE = "Fallout integration test";
    @Autowired WebApplicationContext context;
    @Autowired ContentItemRepository contentRepository;
    @Autowired UserContentRepository libraryRepository;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build();
        cleanup();
    }

    @Test
    void storesOngoingSeriesAsPausedInLibrary() throws Exception {
        try {
            mockMvc.perform(post("/api/content")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"title":"Fallout integration test","itemType":"SERIES",
                                     "format":"LIVE_ACTION","releaseYear":2024,"releaseStatus":"ONGOING"}
                                    """))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.releaseStatus").value("ONGOING"));
            long contentId = contentRepository.findByTitle(TITLE).orElseThrow().getId();

            mockMvc.perform(put("/api/library/{contentId}", contentId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"status\":\"PAUSED\",\"favorite\":true}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("PAUSED"))
                    .andExpect(jsonPath("$.content.releaseStatus").value("ONGOING"));

            mockMvc.perform(get("/api/library").param("status", "PAUSED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].content.title").value(TITLE));
        } finally { cleanup(); }
    }

    @Test
    void rejectsFormatThatDoesNotMatchContentType() throws Exception {
        mockMvc.perform(post("/api/content")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Invalid game","itemType":"GAME","format":"LIVE_ACTION",
                                 "releaseStatus":"RELEASED"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Выбранный формат не подходит для типа материала GAME"));
    }

    private void cleanup() {
        contentRepository.findByTitle(TITLE).ifPresent(item -> {
            libraryRepository.findByUserIdAndContentId(1L, item.getId()).ifPresent(libraryRepository::delete);
            contentRepository.delete(item);
        });
    }
}
