package com.lifedashboard.blog;

import com.lifedashboard.blog.dto.BlogPostFromJournalRequest;
import com.lifedashboard.blog.dto.BlogPostRequest;
import com.lifedashboard.blog.dto.BlogPostResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/blog/posts")
public class BlogPostController {

    private final BlogPostService postService;

    public BlogPostController(BlogPostService postService) {
        this.postService = postService;
    }

    @PostMapping
    public ResponseEntity<BlogPostResponse> create(@Valid @RequestBody BlogPostRequest request) {
        BlogPostResponse response = postService.create(request);
        return ResponseEntity.created(URI.create("/api/blog/posts/" + response.id())).body(response);
    }

    @PostMapping("/from-journal/{journalEntryId}")
    public ResponseEntity<BlogPostResponse> createFromJournal(
            @PathVariable Long journalEntryId,
            @Valid @RequestBody BlogPostFromJournalRequest request
    ) {
        BlogPostResponse response = postService.createFromJournal(journalEntryId, request);
        return ResponseEntity.created(URI.create("/api/blog/posts/" + response.id())).body(response);
    }

    @GetMapping
    public List<BlogPostResponse> getAll(
            @RequestParam(required = false) BlogPostStatus status,
            @RequestParam(required = false, name = "tag") String tagSlug,
            @RequestParam(required = false) Instant publishedFrom,
            @RequestParam(required = false) Instant publishedTo
    ) {
        return postService.getAll(status, tagSlug, publishedFrom, publishedTo);
    }

    @GetMapping("/{id}")
    public BlogPostResponse getById(@PathVariable Long id) {
        return postService.getById(id);
    }

    @PutMapping("/{id}")
    public BlogPostResponse update(@PathVariable Long id, @Valid @RequestBody BlogPostRequest request) {
        return postService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        postService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{postId}/tags/{tagId}")
    public BlogPostResponse addTag(@PathVariable Long postId, @PathVariable Long tagId) {
        return postService.addTag(postId, tagId);
    }

    @DeleteMapping("/{postId}/tags/{tagId}")
    public ResponseEntity<Void> removeTag(@PathVariable Long postId, @PathVariable Long tagId) {
        postService.removeTag(postId, tagId);
        return ResponseEntity.noContent().build();
    }
}
