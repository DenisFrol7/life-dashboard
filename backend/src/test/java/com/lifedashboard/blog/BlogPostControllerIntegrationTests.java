package com.lifedashboard.blog;

import com.lifedashboard.journal.JournalEntryRepository;
import com.lifedashboard.journal.TagRepository;
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
class BlogPostControllerIntegrationTests {

    @Autowired
    private WebApplicationContext applicationContext;

    @Autowired
    private BlogPostRepository postRepository;

    @Autowired
    private JournalEntryRepository journalEntryRepository;

    @Autowired
    private TagRepository tagRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(applicationContext).build();
    }

    @Test
    void createsDraftFromJournalPublishesAndKeepsPostAfterJournalDeletion() throws Exception {
        List<Long> postIds = new ArrayList<>();
        List<Long> journalIds = new ArrayList<>();
        List<Long> tagIds = new ArrayList<>();
        String suffix = UUID.randomUUID().toString();
        String tagSlug = "stories-" + suffix;
        String postSlug = "first-post-" + suffix;
        try {
            Long tagId = createTag("Stories", tagSlug);
            tagIds.add(tagId);
            Long journalId = createJournalEntry();
            journalIds.add(journalId);
            mockMvc.perform(put("/api/journal/{entryId}/tags/{tagId}", journalId, tagId))
                    .andExpect(status().isOk());

            String location = mockMvc.perform(post("/api/blog/posts/from-journal/{id}", journalId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"slug\":\"%s\",\"excerpt\":\"Short story\"}".formatted(postSlug)))
                    .andExpect(status().isCreated())
                    .andExpect(header().exists("Location"))
                    .andExpect(jsonPath("$.sourceJournalEntryId").value(journalId))
                    .andExpect(jsonPath("$.status").value("DRAFT"))
                    .andExpect(jsonPath("$.content").value("Journal source content"))
                    .andExpect(jsonPath("$.tags[*].slug", hasItem(tagSlug)))
                    .andReturn().getResponse().getHeader("Location");
            Long postId = idFrom(location);
            postIds.add(postId);

            mockMvc.perform(put(location)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(postJson("Published story", postSlug.toUpperCase(), "Published content", "PUBLISHED")))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.slug").value(postSlug))
                    .andExpect(jsonPath("$.publishedAt").isNotEmpty());

            mockMvc.perform(get("/api/blog/posts")
                            .param("status", "PUBLISHED")
                            .param("tag", tagSlug.toUpperCase())
                            .param("publishedFrom", "2000-01-01T00:00:00Z")
                            .param("publishedTo", "2100-01-01T00:00:00Z"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].id", hasItem(postId.intValue())));

            mockMvc.perform(delete("/api/journal/{id}", journalId)).andExpect(status().isNoContent());
            journalIds.remove(journalId);
            mockMvc.perform(get(location))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sourceJournalEntryId").doesNotExist())
                    .andExpect(jsonPath("$.content").value("Published content"));

            mockMvc.perform(delete(location)).andExpect(status().isNoContent());
            postIds.remove(postId);
            mockMvc.perform(get("/api/tags/{id}", tagId)).andExpect(status().isOk());
        } finally {
            postIds.forEach(id -> postRepository.findById(id).ifPresent(postRepository::delete));
            journalIds.forEach(id -> journalEntryRepository.findById(id).ifPresent(journalEntryRepository::delete));
            tagIds.forEach(id -> tagRepository.findById(id).ifPresent(tagRepository::delete));
        }
    }

    @Test
    void validatesPostAndRejectsDuplicateSlug() throws Exception {
        Long postId = null;
        String slug = "duplicate-post-" + UUID.randomUUID();
        try {
            String location = mockMvc.perform(post("/api/blog/posts")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(postJson("First", slug, "Content", "DRAFT")))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getHeader("Location");
            postId = idFrom(location);

            mockMvc.perform(post("/api/blog/posts")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(postJson("Second", slug.toUpperCase(), "Content", "DRAFT")))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.message").value("Blog post slug is already in use"));

            mockMvc.perform(post("/api/blog/posts")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"title\":\"\",\"slug\":\"\",\"content\":\"\",\"status\":\"DRAFT\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.fieldErrors.title").exists())
                    .andExpect(jsonPath("$.fieldErrors.slug").exists())
                    .andExpect(jsonPath("$.fieldErrors.content").exists());

            mockMvc.perform(get("/api/blog/posts")
                            .param("publishedFrom", "2100-01-01T00:00:00Z")
                            .param("publishedTo", "2000-01-01T00:00:00Z"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("publishedTo must not be before publishedFrom"));
        } finally {
            if (postId != null) {
                Long remainingPostId = postId;
                postRepository.findById(remainingPostId).ifPresent(postRepository::delete);
            }
        }
    }

    private Long createTag(String name, String slug) throws Exception {
        String location = mockMvc.perform(post("/api/tags")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"%s\",\"slug\":\"%s\"}".formatted(name, slug)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        return idFrom(location);
    }

    private Long createJournalEntry() throws Exception {
        String location = mockMvc.perform(post("/api/journal")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "entryDate": "2099-05-10",
                                  "title": "Journal story",
                                  "content": "Journal source content",
                                  "pinned": false
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getHeader("Location");
        return idFrom(location);
    }

    private String postJson(String title, String slug, String content, String status) {
        return """
                {
                  "title": "%s",
                  "slug": "%s",
                  "excerpt": "Excerpt",
                  "content": "%s",
                  "coverImageUrl": "https://example.com/cover.jpg",
                  "status": "%s"
                }
                """.formatted(title, slug, content, status);
    }

    private Long idFrom(String location) {
        return Long.valueOf(location.substring(location.lastIndexOf('/') + 1));
    }
}
