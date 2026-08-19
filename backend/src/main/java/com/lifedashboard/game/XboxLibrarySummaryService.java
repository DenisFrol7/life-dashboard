package com.lifedashboard.game;

import com.lifedashboard.game.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class XboxLibrarySummaryService {
    private final XboxGameProgressRepository progressRepository;
    private final XboxAchievementGroupRepository groupRepository;
    private final long userId;

    public XboxLibrarySummaryService(XboxGameProgressRepository progressRepository,
            XboxAchievementGroupRepository groupRepository, @Value("${app.default-user-id}") long userId) {
        this.progressRepository = progressRepository;
        this.groupRepository = groupRepository;
        this.userId = userId;
    }

    public List<XboxLibrarySummaryResponse> getAll() {
        Map<Long, XboxAchievementGroup> baseGames = groupRepository
                .findAllByUserIdAndGroupType(userId, XboxAchievementGroupType.BASE_GAME).stream()
                .collect(Collectors.toMap(group -> group.getLibraryEntry().getId(), Function.identity()));
        return progressRepository.findAllByUserId(userId).stream()
                .map(progress -> {
                    Long libraryEntryId = progress.getLibraryEntry().getId();
                    XboxAchievementGroup baseGame = baseGames.get(libraryEntryId);
                    return new XboxLibrarySummaryResponse(libraryEntryId, response(progress),
                            baseGame == null ? null : response(baseGame));
                }).toList();
    }

    private double percent(int value, int total) {
        return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0;
    }

    private XboxProgressResponse response(XboxGameProgress progress) {
        return new XboxProgressResponse(progress.getId(), progress.getLibraryEntry().getId(),
                progress.getTotalAchievements(), progress.getUnlockedAchievements(),
                percent(progress.getUnlockedAchievements(), progress.getTotalAchievements()),
                progress.getTotalGamerscore(), progress.getEarnedGamerscore(),
                percent(progress.getEarnedGamerscore(), progress.getTotalGamerscore()),
                progress.getLastUpdatedAt());
    }

    private XboxAchievementGroupResponse response(XboxAchievementGroup group) {
        return new XboxAchievementGroupResponse(group.getId(), group.getLibraryEntry().getId(), group.getName(),
                group.getGroupType(), group.getTotalAchievements(), group.getUnlockedAchievements(),
                percent(group.getUnlockedAchievements(), group.getTotalAchievements()), group.getTotalGamerscore(),
                group.getEarnedGamerscore(), percent(group.getEarnedGamerscore(), group.getTotalGamerscore()),
                group.getCompletedAt());
    }
}
