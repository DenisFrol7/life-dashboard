package com.lifedashboard.game;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.game.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class GamePlaythroughService {
    private final GamePlaythroughRepository playthroughs;
    private final GameSessionRepository sessions;
    private final UserGameRepository games;
    private final long userId;
    public GamePlaythroughService(GamePlaythroughRepository playthroughs, GameSessionRepository sessions,
            UserGameRepository games, @Value("${app.default-user-id}") long userId) {
        this.playthroughs = playthroughs; this.sessions = sessions; this.games = games; this.userId = userId;
    }
    public List<GamePlaythroughResponse> getAll(Long libraryId) {
        findGame(libraryId);
        return playthroughs.findAllByLibraryEntryIdAndLibraryEntryUserContentUserIdOrderByPlaythroughNumberDesc(
                libraryId, userId).stream()
                .map((@NonNull GamePlaythrough playthrough) -> response(playthrough)).toList();
    }
    @Transactional
    public GamePlaythroughResponse create(Long libraryId, GamePlaythroughRequest request) {
        UserGame game = findGame(libraryId);
        Instant completedAt = request.completedAt() == null ? Instant.now() : request.completedAt();
        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        GamePlaythrough result = new GamePlaythrough(game, playthroughs.maxNumber(libraryId) + 1,
                completedAt, game.getLegacyPlaytimeMinutes() + sessions.totalMinutes(libraryId, userId), note);
        return response(playthroughs.save(result));
    }
    @Transactional
    public GamePlaythroughResponse update(Long id, GamePlaythroughRequest request) {
        GamePlaythrough item = findPlaythrough(id);
        Instant completedAt = request.completedAt() == null ? item.getCompletedAt() : request.completedAt();
        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        item.update(completedAt, note);
        return response(item);
    }
    @Transactional public void delete(Long id) {
        playthroughs.delete(findPlaythrough(id));
    }
    private UserGame findGame(Long id) { return games.findByIdAndUserContentUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Game library entry with id " + id + " was not found")); }
    private GamePlaythrough findPlaythrough(Long id) {
        return playthroughs.findByIdAndLibraryEntryUserContentUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Game playthrough with id " + id + " was not found"));
    }
    private GamePlaythroughResponse response(GamePlaythrough item) {
        return new GamePlaythroughResponse(item.getId(), item.getLibraryEntry().getId(),
                item.getPlaythroughNumber(), item.getCompletedAt(), item.getPlaytimeMinutes(), item.getNote());
    }
}
