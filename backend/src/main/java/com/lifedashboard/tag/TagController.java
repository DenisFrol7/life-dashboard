package com.lifedashboard.tag;

import com.lifedashboard.tag.dto.TagRequest;
import com.lifedashboard.tag.dto.TagResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Tags")
@RequestMapping("/api/tags")
public class TagController {

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    @PostMapping
    public ResponseEntity<TagResponse> create(@Valid @RequestBody TagRequest request) {
        TagResponse response = tagService.create(request);
        return ResponseEntity.created(URI.create("/api/tags/" + response.id())).body(response);
    }

    @GetMapping
    public List<TagResponse> getAll() {
        return tagService.getAll();
    }

    @GetMapping("/{id}")
    public TagResponse getById(@PathVariable Long id) {
        return tagService.getById(id);
    }

    @PutMapping("/{id}")
    public TagResponse update(@PathVariable Long id, @Valid @RequestBody TagRequest request) {
        return tagService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        tagService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
