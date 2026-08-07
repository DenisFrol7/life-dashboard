package com.lifedashboard.game;

import com.lifedashboard.game.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.net.URI;
import java.util.List;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "Xbox achievement groups")
@RequestMapping("/api/games")
public class XboxAchievementGroupController {
    private final XboxAchievementGroupService service;
    public XboxAchievementGroupController(XboxAchievementGroupService service) { this.service = service; }
    @GetMapping("/library/{libraryId}/achievement-groups")
    public List<XboxAchievementGroupResponse> getAll(@PathVariable Long libraryId) { return service.getAll(libraryId); }
    @PostMapping("/library/{libraryId}/achievement-groups")
    public ResponseEntity<XboxAchievementGroupResponse> create(@PathVariable Long libraryId,
            @Valid @RequestBody XboxAchievementGroupRequest request) {
        XboxAchievementGroupResponse result = service.createDlc(libraryId, request);
        return ResponseEntity.created(URI.create("/api/games/achievement-groups/" + result.id())).body(result);
    }
    @PutMapping("/achievement-groups/{id}")
    public XboxAchievementGroupResponse update(@PathVariable Long id,
            @Valid @RequestBody XboxAchievementGroupRequest request) { return service.update(id, request); }
    @DeleteMapping("/achievement-groups/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) { service.delete(id); return ResponseEntity.noContent().build(); }
}
