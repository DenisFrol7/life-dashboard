package com.lifedashboard.game;

import com.lifedashboard.common.error.*;
import com.lifedashboard.game.dto.*;
import com.lifedashboard.game.openxbl.OpenXblClient;
import com.lifedashboard.game.openxbl.OpenXblTitle;
import com.lifedashboard.game.openxbl.OpenXblTitleHistory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class XboxProgressService {
    private final XboxGameProgressRepository progressRepository;
    private final XboxAchievementRepository achievementRepository;
    private final UserGameRepository gameRepository;
    private final XboxAchievementGroupService achievementGroups;
    private final OpenXblClient openXbl;
    private final long userId;

    public XboxProgressService(XboxGameProgressRepository progressRepository,
            XboxAchievementRepository achievementRepository, UserGameRepository gameRepository,
            XboxAchievementGroupService achievementGroups, OpenXblClient openXbl,
            @Value("${app.default-user-id}") long userId) {
        this.progressRepository = progressRepository; this.achievementRepository = achievementRepository;
        this.gameRepository = gameRepository;
        this.achievementGroups = achievementGroups; this.openXbl = openXbl; this.userId = userId;
    }

    @Transactional
    public XboxProgressResponse put(Long libraryEntryId, XboxProgressRequest request) {
        validate(request);
        UserGame game = findXboxGame(libraryEntryId);
        achievementGroups.putBase(game, request);
        return response(progressRepository.findByLibraryEntryId(libraryEntryId).orElseThrow());
    }
    @Transactional
    public void initializeFromTitleHistory(Long libraryEntryId) {
        UserGame game = findXboxGame(libraryEntryId);
        if (progressRepository.findByLibraryEntryId(libraryEntryId).isPresent()) return;
        if (game.getXboxTitleId() == null) {
            throw new InvalidRequestException(
                    "Сначала свяжите копию игры с Xbox Title ID");
        }
        OpenXblTitle title = findTitle(openXbl.titleHistory(), game.getXboxTitleId());
        if (title == null) title = findTitle(openXbl.titleHistory(), game.getXboxTitleId());
        if (title == null) {
            throw new InvalidRequestException(
                    "Связанная игра не найдена в истории Xbox-профиля");
        }
        achievementGroups.putBase(game, new XboxProgressRequest(
                Math.max(title.totalAchievements(), title.currentAchievements()), 0,
                Math.max(title.totalGamerscore(), title.currentGamerscore()), 0));
    }
    public XboxProgressResponse get(Long libraryEntryId) {
        findXboxGame(libraryEntryId);
        return response(progressRepository.findByLibraryEntryId(libraryEntryId)
                .orElseThrow(() -> new ResourceNotFoundException("Прогресс Xbox не найден")));
    }
    public List<XboxAchievementResponse> getAchievements(Long libraryEntryId) {
        findXboxGame(libraryEntryId);
        XboxGameProgress progress = progressRepository.findByLibraryEntryId(libraryEntryId)
                .orElseThrow(() -> new ResourceNotFoundException("Прогресс Xbox не найден"));
        return achievementRepository.findAllByProgressId(progress.getId()).stream()
                .sorted(Comparator.comparing(XboxAchievement::isUnlocked).reversed()
                        .thenComparing(XboxAchievement::getUnlockedAt,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(XboxAchievement::getDisplayName,
                                String.CASE_INSENSITIVE_ORDER))
                .map(item -> new XboxAchievementResponse(item.getAchievementId(),
                        item.getDisplayName(), item.getDescription(), item.getLockedDescription(),
                        item.getIconUrl(), item.getGamerscore(), item.isHidden(),
                        item.isUnlocked(), item.getUnlockedAt()))
                .toList();
    }
    @Transactional
    public void delete(Long libraryEntryId) {
        findXboxGame(libraryEntryId);
        XboxGameProgress progress = progressRepository.findByLibraryEntryId(libraryEntryId)
                .orElseThrow(() -> new ResourceNotFoundException("Прогресс Xbox не найден"));
        progressRepository.delete(progress);
    }
    private UserGame findXboxGame(Long id) {
        UserGame game = gameRepository.findByIdAndUserContentUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Копия игры с идентификатором " + id + " не найдена"));
        if (!XboxIntegration.supportsProgress(game))
            throw new InvalidRequestException(
                    "Прогресс Xbox доступен для платформ Xbox и PC-копий из Microsoft Store или Game Pass");
        return game;
    }
    private void validate(XboxProgressRequest r) {
        if (r.unlockedAchievements() > r.totalAchievements())
            throw new InvalidRequestException("Количество полученных достижений не может превышать их общее количество");
        if (r.earnedGamerscore() > r.totalGamerscore())
            throw new InvalidRequestException("Полученный Gamerscore не может превышать общий Gamerscore");
    }
    private OpenXblTitle findTitle(OpenXblTitleHistory history, long titleId) {
        return history.titles().stream()
                .filter(title -> title.titleId() == titleId)
                .findFirst().orElse(null);
    }
    private double percent(int value, int total) {
        return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0;
    }
    private XboxProgressResponse response(XboxGameProgress p) {
        return new XboxProgressResponse(p.getId(), p.getLibraryEntry().getId(), p.getTotalAchievements(),
                p.getUnlockedAchievements(), percent(p.getUnlockedAchievements(), p.getTotalAchievements()),
                p.getTotalGamerscore(), p.getEarnedGamerscore(),
                percent(p.getEarnedGamerscore(), p.getTotalGamerscore()),
                p.getLastUnlockedAt(), p.getLastUpdatedAt(),
                p.getAchievementDetailsStatus());
    }
}
