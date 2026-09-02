package com.lifedashboard.game;

import com.lifedashboard.common.error.*;
import com.lifedashboard.game.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.jspecify.annotations.NonNull;
import java.time.Instant;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class XboxAchievementGroupService {
    private final XboxAchievementGroupRepository groups;
    private final XboxGameProgressRepository progress;
    private final UserGameRepository games;
    private final long userId;
    public XboxAchievementGroupService(XboxAchievementGroupRepository groups,
            XboxGameProgressRepository progress, UserGameRepository games,
            @Value("${app.default-user-id}") long userId) {
        this.groups = groups; this.progress = progress; this.games = games; this.userId = userId;
    }
    public List<XboxAchievementGroupResponse> getAll(Long libraryId) {
        findXboxGame(libraryId);
        return groups.findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(libraryId).stream()
                .map((@NonNull XboxAchievementGroup group) -> response(group)).toList();
    }
    @Transactional
    public XboxAchievementGroupResponse createDlc(Long libraryId, XboxAchievementGroupRequest request) {
        UserGame game = findXboxGame(libraryId); validate(request); validateName(libraryId, request.name(), -1L);
        XboxAchievementGroup group = new XboxAchievementGroup(game, request.name().trim(), XboxAchievementGroupType.DLC);
        apply(group, request); XboxAchievementGroup saved = groups.save(group); recalculate(game); return response(saved);
    }
    @Transactional
    public XboxAchievementGroupResponse update(Long id, XboxAchievementGroupRequest request) {
        validate(request); XboxAchievementGroup group = find(id);
        String name = group.getGroupType() == XboxAchievementGroupType.BASE_GAME ? "Основная игра" : request.name().trim();
        validateName(group.getLibraryEntry().getId(), name, group.getId());
        group.update(name, request.totalAchievements(), request.unlockedAchievements(),
                request.totalGamerscore(), request.earnedGamerscore(),
                group.getGroupType() == XboxAchievementGroupType.DLC ? request.completedAt() : null);
        recalculate(group.getLibraryEntry()); return response(group);
    }
    @Transactional
    public void delete(Long id) {
        XboxAchievementGroup group = find(id);
        if (group.getGroupType() == XboxAchievementGroupType.BASE_GAME)
            throw new InvalidRequestException("Группу достижений основной игры нельзя удалить");
        UserGame game = group.getLibraryEntry(); groups.delete(group); groups.flush(); recalculate(game);
    }
    @Transactional
    public void putBase(UserGame game, XboxProgressRequest request) {
        XboxAchievementGroup base = groups.findByLibraryEntryIdAndGroupType(game.getId(), XboxAchievementGroupType.BASE_GAME)
                .orElseGet(() -> new XboxAchievementGroup(game, "Основная игра", XboxAchievementGroupType.BASE_GAME));
        base.update("Основная игра", request.totalAchievements(), request.unlockedAchievements(),
                request.totalGamerscore(), request.earnedGamerscore(), null);
        groups.save(base); recalculate(game);
    }
    @Transactional
    public void recalculate(UserGame game) {
        List<XboxAchievementGroup> values = groups.findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(game.getId());
        int totalAchievements = values.stream()
                .mapToInt((@NonNull XboxAchievementGroup group) -> group.getTotalAchievements()).sum();
        int unlockedAchievements = values.stream()
                .mapToInt((@NonNull XboxAchievementGroup group) -> group.getUnlockedAchievements()).sum();
        int totalGamerscore = values.stream()
                .mapToInt((@NonNull XboxAchievementGroup group) -> group.getTotalGamerscore()).sum();
        int earnedGamerscore = values.stream()
                .mapToInt((@NonNull XboxAchievementGroup group) -> group.getEarnedGamerscore()).sum();
        XboxGameProgress aggregate = progress.findByLibraryEntryId(game.getId()).orElseGet(() -> new XboxGameProgress(game));
        aggregate.update(totalAchievements, unlockedAchievements, totalGamerscore, earnedGamerscore, Instant.now());
        progress.save(aggregate);
    }
    private void apply(XboxAchievementGroup group, XboxAchievementGroupRequest request) {
        group.update(request.name().trim(), request.totalAchievements(), request.unlockedAchievements(),
                request.totalGamerscore(), request.earnedGamerscore(), request.completedAt());
    }
    private void validate(XboxAchievementGroupRequest request) {
        if (request.unlockedAchievements() > request.totalAchievements())
            throw new InvalidRequestException("Количество полученных достижений не может превышать их общее количество");
        if (request.earnedGamerscore() > request.totalGamerscore())
            throw new InvalidRequestException("Полученный Gamerscore не может превышать общий Gamerscore");
    }
    private void validateName(Long libraryId, String name, Long id) {
        if (groups.existsByLibraryEntryIdAndNameIgnoreCaseAndIdNot(libraryId, name.trim(), id))
            throw new DuplicateResourceException("Группа достижений с таким названием уже существует");
    }
    private XboxAchievementGroup find(Long id) { return groups.findByIdAndLibraryEntryUserContentUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Группа достижений Xbox с идентификатором " + id + " не найдена")); }
    private UserGame findXboxGame(Long id) {
        UserGame game = games.findByIdAndUserContentUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Копия игры с идентификатором " + id + " не найдена"));
        String code = game.getPlatform().getCode();
        if (!code.startsWith("XBOX_") && !code.equals("ORIGINAL_XBOX"))
            throw new InvalidRequestException("Группы достижений доступны только для платформ Xbox");
        return game;
    }
    private double percent(int value, int total) { return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0; }
    private XboxAchievementGroupResponse response(XboxAchievementGroup group) {
        return new XboxAchievementGroupResponse(group.getId(), group.getLibraryEntry().getId(), group.getName(),
                group.getGroupType(), group.getTotalAchievements(), group.getUnlockedAchievements(),
                percent(group.getUnlockedAchievements(), group.getTotalAchievements()), group.getTotalGamerscore(),
                group.getEarnedGamerscore(), percent(group.getEarnedGamerscore(), group.getTotalGamerscore()),
                group.getCompletedAt());
    }
}
