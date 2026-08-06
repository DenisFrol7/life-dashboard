package com.lifedashboard.game;

import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.game.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class GameSessionService {
    private final GameSessionRepository sessions;
    private final UserGameRepository games;
    private final XboxGameProgressRepository xboxProgress;
    private final long userId;
    public GameSessionService(GameSessionRepository sessions, UserGameRepository games,
            XboxGameProgressRepository xboxProgress,
            @Value("${app.default-user-id}") long userId) {
        this.sessions = sessions; this.games = games; this.xboxProgress = xboxProgress; this.userId = userId;
    }
    public List<GameSessionResponse> getAll(Instant from, Instant to) {
        List<GameSession> result;
        if (from != null && to != null) result = sessions.findAllByLibraryEntryUserContentUserIdAndStartedAtGreaterThanEqualAndStartedAtLessThanOrderByStartedAtDesc(userId, from, to);
        else if (from != null) result = sessions.findAllByLibraryEntryUserContentUserIdAndStartedAtGreaterThanEqualOrderByStartedAtDesc(userId, from);
        else if (to != null) result = sessions.findAllByLibraryEntryUserContentUserIdAndStartedAtLessThanOrderByStartedAtDesc(userId, to);
        else result = sessions.findAllByLibraryEntryUserContentUserIdOrderByStartedAtDesc(userId);
        return result.stream().map(this::response).toList();
    }
    @Transactional
    public GameSessionResponse create(Long libraryId, GameSessionRequest request) {
        UserGame game = games.findByIdAndUserContentUserId(libraryId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Game library entry with id " + libraryId + " was not found"));
        GameSession session = new GameSession(game);
        apply(session, request);
        adjustXboxProgress(game, request.unlockedAchievements(), request.earnedGamerscore());
        return response(sessions.save(session));
    }
    @Transactional
    public GameSessionResponse update(Long id, GameSessionRequest request) {
        GameSession session = find(id);
        int achievementDelta = request.unlockedAchievements() - session.getUnlockedAchievements();
        int gamerscoreDelta = request.earnedGamerscore() - session.getEarnedGamerscore();
        adjustXboxProgress(session.getLibraryEntry(), achievementDelta, gamerscoreDelta);
        apply(session, request); return response(session);
    }
    @Transactional public void delete(Long id) {
        GameSession session = find(id);
        adjustXboxProgress(session.getLibraryEntry(), -session.getUnlockedAchievements(), -session.getEarnedGamerscore());
        sessions.delete(session);
    }
    private GameSession find(Long id) { return sessions.findByIdAndLibraryEntryUserContentUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Game session with id " + id + " was not found")); }
    private void apply(GameSession session, GameSessionRequest request) {
        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        validateXboxFields(session.getLibraryEntry(), request.unlockedAchievements(), request.earnedGamerscore());
        session.update(request.startedAt(), request.durationMinutes(), note,
                request.unlockedAchievements(), request.earnedGamerscore());
    }
    private void validateXboxFields(UserGame game, int achievements, int gamerscore) {
        if ((achievements > 0 || gamerscore > 0) && !isXbox(game))
            throw new InvalidRequestException("Achievements can only be added to Xbox game sessions");
    }
    private void adjustXboxProgress(UserGame game, int achievementDelta, int gamerscoreDelta) {
        if (achievementDelta == 0 && gamerscoreDelta == 0) return;
        if (!isXbox(game)) throw new InvalidRequestException("Achievements can only be added to Xbox game sessions");
        XboxGameProgress progress = xboxProgress.findByLibraryEntryId(game.getId())
                .orElseThrow(() -> new InvalidRequestException("Set the initial Xbox progress before adding achievements"));
        int achievements = progress.getUnlockedAchievements() + achievementDelta;
        int gamerscore = progress.getEarnedGamerscore() + gamerscoreDelta;
        if (achievements < 0 || achievements > progress.getTotalAchievements())
            throw new InvalidRequestException("Session achievements exceed the Xbox progress limits");
        if (gamerscore < 0 || gamerscore > progress.getTotalGamerscore())
            throw new InvalidRequestException("Session gamerscore exceeds the Xbox progress limits");
        progress.update(progress.getTotalAchievements(), achievements, progress.getTotalGamerscore(),
                gamerscore, Instant.now());
    }
    private boolean isXbox(UserGame game) {
        String code = game.getPlatform().getCode();
        return code.startsWith("XBOX_") || code.equals("ORIGINAL_XBOX");
    }
    private GameSessionResponse response(GameSession session) {
        UserGame game = session.getLibraryEntry();
        return new GameSessionResponse(session.getId(), game.getId(), game.getUserContent().getContent().getId(),
                game.getUserContent().getContent().getTitle(), session.getStartedAt(),
                session.getDurationMinutes(), session.getNote(), session.getUnlockedAchievements(),
                session.getEarnedGamerscore());
    }
}
