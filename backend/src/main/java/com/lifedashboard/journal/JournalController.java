package com.lifedashboard.journal;

import com.lifedashboard.journal.dto.JournalEntryRequest;
import com.lifedashboard.journal.dto.JournalEntryResponse;
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
import java.time.LocalDate;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Journal")
@RequestMapping("/api/journal")
public class JournalController {

    private final JournalService journalService;

    public JournalController(JournalService journalService) {
        this.journalService = journalService;
    }

    @PostMapping
    public ResponseEntity<JournalEntryResponse> create(@Valid @RequestBody JournalEntryRequest request) {
        JournalEntryResponse response = journalService.create(request);
        return ResponseEntity.created(URI.create("/api/journal/" + response.id())).body(response);
    }

    @GetMapping
    public List<JournalEntryResponse> getAll(
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @RequestParam(required = false) Boolean pinned,
            @RequestParam(required = false, name = "tag") String tagSlug
    ) {
        return journalService.getAll(from, to, pinned, tagSlug);
    }

    @GetMapping("/{id}")
    public JournalEntryResponse getById(@PathVariable Long id) {
        return journalService.getById(id);
    }

    @PutMapping("/{id}")
    public JournalEntryResponse update(@PathVariable Long id, @Valid @RequestBody JournalEntryRequest request) {
        return journalService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        journalService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{entryId}/tags/{tagId}")
    public JournalEntryResponse addTag(@PathVariable Long entryId, @PathVariable Long tagId) {
        return journalService.addTag(entryId, tagId);
    }

    @DeleteMapping("/{entryId}/tags/{tagId}")
    public ResponseEntity<Void> removeTag(@PathVariable Long entryId, @PathVariable Long tagId) {
        journalService.removeTag(entryId, tagId);
        return ResponseEntity.noContent().build();
    }
}
