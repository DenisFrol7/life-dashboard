package com.lifedashboard.journal;

import com.lifedashboard.tag.TagRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.ArrayList;
import java.util.List;
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
class JournalControllerIntegrationTests {

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private JournalEntryRepository entryRepository;

    @Autowired
    private TagRepository tagRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
    }

    @Test
    void supportsJournalCrudTagsAndFilters() throws Exception {
        List<Long> entryIds = new ArrayList<>();
        List<Long> tagIds = new ArrayList<>();
        String suffix = UUID.randomUUID().toString();
        String workSlug = "work-" + suffix;
        try {
            Long workTagId = createTag("Work", workSlug);
            Long personalTagId = createTag("Personal", "personal-" + suffix);
            tagIds.add(workTagId);
            tagIds.add(personalTagId);

            String location = mockMvc.perform(post("/api/journal")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(entryJson("2099-04-10", "First entry", "Initial content", true)))
                    .andExpect(status().isCreated())
                    .andExpect(header().exists("Location"))
                    .andExpect(jsonPath("$.pinned").value(true))
                    .andReturn().getResponse().getHeader("Location");
            Long entryId = idFrom(location);
            entryIds.add(entryId);

            mockMvc.perform(put("/api/journal/{entryId}/tags/{tagId}", entryId, workTagId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.tags[*].slug", hasItem(workSlug)));
            mockMvc.perform(put("/api/journal/{entryId}/tags/{tagId}", entryId, personalTagId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.tags.length()").value(2));

            mockMvc.perform(get("/api/journal")
                            .param("from", "2099-04-01")
                            .param("to", "2099-04-30")
                            .param("pinned", "true")
                            .param("tag", workSlug.toUpperCase()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].id", hasItem(entryId.intValue())));

            mockMvc.perform(put(location)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(entryJson("2099-04-11", "Updated entry", "Updated content", false)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.entryDate").value("2099-04-11"))
                    .andExpect(jsonPath("$.title").value("Updated entry"))
                    .andExpect(jsonPath("$.tags.length()").value(2));

            mockMvc.perform(delete("/api/journal/{entryId}/tags/{tagId}", entryId, personalTagId))
                    .andExpect(status().isNoContent());
            mockMvc.perform(get(location))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.tags.length()").value(1));

            mockMvc.perform(delete(location)).andExpect(status().isNoContent());
            entryIds.remove(entryId);
            mockMvc.perform(get("/api/tags/{id}", workTagId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.slug").value(workSlug));
        } finally {
            entryIds.forEach(id -> entryRepository.findById(id).ifPresent(entryRepository::delete));
            tagIds.forEach(id -> tagRepository.findById(id).ifPresent(tagRepository::delete));
        }
    }

    @Test
    void validatesRequestsAndRejectsDuplicateSlug() throws Exception {
        Long tagId = null;
        String slug = "duplicate-" + UUID.randomUUID();
        try {
            tagId = createTag("First", slug);
            mockMvc.perform(post("/api/tags")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(tagJson("Second", slug.toUpperCase())))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Tag slug is already in use"));

            mockMvc.perform(post("/api/journal")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"entryDate\":\"2099-04-10\",\"content\":\"\",\"pinned\":false}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors.content").exists());

            mockMvc.perform(get("/api/journal")
                            .param("from", "2099-04-30")
                            .param("to", "2099-04-01"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("to must not be before from"));
        } finally {
            if (tagId != null) {
                Long remainingTagId = tagId;
                tagRepository.findById(remainingTagId).ifPresent(tagRepository::delete);
            }
        }
    }

    private Long createTag(String name, String slug) throws Exception {
        String location = mockMvc.perform(post("/api/tags")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tagJson(name, slug)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        return idFrom(location);
    }

    private String tagJson(String name, String slug) {
        return "{\"name\":\"%s\",\"slug\":\"%s\"}".formatted(name, slug);
    }

    private String entryJson(String date, String title, String content, boolean pinned) {
        return """
                {
                  "entryDate": "%s",
                  "title": "%s",
                  "content": "%s",
                  "pinned": %s
                }
                """.formatted(date, title, content, pinned);
    }

    private Long idFrom(String location) {
        return Long.valueOf(location.substring(location.lastIndexOf('/') + 1));
    }
}
