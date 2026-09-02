package com.lifedashboard.game;

import com.lifedashboard.common.error.*;
import com.lifedashboard.game.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class XboxProgressService {
    private final XboxGameProgressRepository progressRepository;
    private final UserGameRepository gameRepository;
    private final XboxAchievementGroupService achievementGroups;
    private final long userId;

    public XboxProgressService(XboxGameProgressRepository progressRepository,
            UserGameRepository gameRepository, XboxAchievementGroupService achievementGroups,
            @Value("${app.default-user-id}") long userId) {
        this.progressRepository = progressRepository; this.gameRepository = gameRepository;
        this.achievementGroups = achievementGroups; this.userId = userId;
    }

    @Transactional
    public XboxProgressResponse put(Long libraryEntryId, XboxProgressRequest request) {
        validate(request);
        UserGame game = findXboxGame(libraryEntryId);
        achievementGroups.putBase(game, request);
        return response(progressRepository.findByLibraryEntryId(libraryEntryId).orElseThrow());
    }
    public XboxProgressResponse get(Long libraryEntryId) {
        findXboxGame(libraryEntryId);
        return response(progressRepository.findByLibraryEntryId(libraryEntryId)
                .orElseThrow(() -> new ResourceNotFoundException("Прогресс Xbox не найден")));
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
        String code = game.getPlatform().getCode();
        if (!code.startsWith("XBOX_") && !code.equals("ORIGINAL_XBOX"))
            throw new InvalidRequestException("Прогресс Xbox доступен только для платформ Xbox");
        return game;
    }
    private void validate(XboxProgressRequest r) {
        if (r.unlockedAchievements() > r.totalAchievements())
            throw new InvalidRequestException("Количество полученных достижений не может превышать их общее количество");
        if (r.earnedGamerscore() > r.totalGamerscore())
            throw new InvalidRequestException("Полученный Gamerscore не может превышать общий Gamerscore");
    }
    private double percent(int value, int total) {
        return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0;
    }
    private XboxProgressResponse response(XboxGameProgress p) {
        return new XboxProgressResponse(p.getId(), p.getLibraryEntry().getId(), p.getTotalAchievements(),
                p.getUnlockedAchievements(), percent(p.getUnlockedAchievements(), p.getTotalAchievements()),
                p.getTotalGamerscore(), p.getEarnedGamerscore(),
                percent(p.getEarnedGamerscore(), p.getTotalGamerscore()), p.getLastUpdatedAt());
    }
}
