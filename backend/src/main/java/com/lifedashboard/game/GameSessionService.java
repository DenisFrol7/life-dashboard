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
    private final XboxAchievementGroupRepository achievementGroups;
    private final XboxAchievementGroupService achievementGroupService;
    private final long userId;
    public GameSessionService(GameSessionRepository sessions, UserGameRepository games,
            XboxAchievementGroupRepository achievementGroups, XboxAchievementGroupService achievementGroupService,
            @Value("${app.default-user-id}") long userId) {
        this.sessions = sessions; this.games = games; this.achievementGroups = achievementGroups;
        this.achievementGroupService = achievementGroupService; this.userId = userId;
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
        XboxAchievementGroup group = resolveGroup(game, request);
        apply(session, request, group);
        adjustGroup(game, group, request.unlockedAchievements(), request.earnedGamerscore());
        return response(sessions.save(session));
    }
    @Transactional
    public GameSessionResponse update(Long id, GameSessionRequest request) {
        GameSession session = find(id);
        UserGame game = session.getLibraryEntry(); XboxAchievementGroup oldGroup = session.getAchievementGroup();
        XboxAchievementGroup newGroup = resolveGroup(game, request);
        if (oldGroup != null && newGroup != null && oldGroup.getId().equals(newGroup.getId())) {
            adjustGroup(game, newGroup, request.unlockedAchievements() - session.getUnlockedAchievements(),
                    request.earnedGamerscore() - session.getEarnedGamerscore());
        } else {
            adjustGroup(game, oldGroup, -session.getUnlockedAchievements(), -session.getEarnedGamerscore());
            adjustGroup(game, newGroup, request.unlockedAchievements(), request.earnedGamerscore());
        }
        apply(session, request, newGroup); return response(session);
    }
    @Transactional public void delete(Long id) {
        GameSession session = find(id);
        adjustGroup(session.getLibraryEntry(), session.getAchievementGroup(),
                -session.getUnlockedAchievements(), -session.getEarnedGamerscore());
        sessions.delete(session);
    }
    private GameSession find(Long id) { return sessions.findByIdAndLibraryEntryUserContentUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Game session with id " + id + " was not found")); }
    private void apply(GameSession session, GameSessionRequest request, XboxAchievementGroup group) {
        String note = request.note() == null || request.note().isBlank() ? null : request.note().trim();
        validateXboxFields(session.getLibraryEntry(), request.unlockedAchievements(), request.earnedGamerscore());
        session.update(request.startedAt(), request.durationMinutes(), note,
                request.unlockedAchievements(), request.earnedGamerscore(), group);
    }
    private void validateXboxFields(UserGame game, int achievements, int gamerscore) {
        if ((achievements > 0 || gamerscore > 0) && !isXbox(game))
            throw new InvalidRequestException("Achievements can only be added to Xbox game sessions");
    }
    private XboxAchievementGroup resolveGroup(UserGame game, GameSessionRequest request) {
        if (request.achievementGroupId() != null) {
            XboxAchievementGroup group = achievementGroups.findById(request.achievementGroupId())
                    .filter(value -> value.getLibraryEntry().getId().equals(game.getId()))
                    .orElseThrow(() -> new InvalidRequestException("Achievement group does not belong to the selected game"));
            return group;
        }
        if (request.unlockedAchievements() == 0 && request.earnedGamerscore() == 0) return null;
        return achievementGroups.findByLibraryEntryIdAndGroupType(game.getId(), XboxAchievementGroupType.BASE_GAME)
                .orElseThrow(() -> new InvalidRequestException("Set the initial Xbox progress before adding achievements"));
    }
    private void adjustGroup(UserGame game, XboxAchievementGroup group, int achievementDelta, int gamerscoreDelta) {
        if (achievementDelta == 0 && gamerscoreDelta == 0) return;
        if (!isXbox(game) || group == null) throw new InvalidRequestException("Select an Xbox achievement group");
        int achievements = group.getUnlockedAchievements() + achievementDelta;
        int gamerscore = group.getEarnedGamerscore() + gamerscoreDelta;
        if (achievements < 0 || achievements > group.getTotalAchievements())
            throw new InvalidRequestException("Session achievements exceed the Xbox progress limits");
        if (gamerscore < 0 || gamerscore > group.getTotalGamerscore())
            throw new InvalidRequestException("Session gamerscore exceeds the Xbox progress limits");
        group.update(group.getName(), group.getTotalAchievements(), achievements,
                group.getTotalGamerscore(), gamerscore, group.getCompletedAt());
        achievementGroupService.recalculate(game);
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
                session.getEarnedGamerscore(), session.getAchievementGroup() == null ? null : session.getAchievementGroup().getId(),
                session.getAchievementGroup() == null ? null : session.getAchievementGroup().getName());
    }
}
