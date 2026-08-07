package com.lifedashboard.game;

import com.lifedashboard.common.error.*;
import com.lifedashboard.game.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
        return groups.findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(libraryId).stream().map(this::response).toList();
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
                request.totalGamerscore(), request.earnedGamerscore());
        recalculate(group.getLibraryEntry()); return response(group);
    }
    @Transactional
    public void delete(Long id) {
        XboxAchievementGroup group = find(id);
        if (group.getGroupType() == XboxAchievementGroupType.BASE_GAME)
            throw new InvalidRequestException("The base game achievement group cannot be deleted");
        UserGame game = group.getLibraryEntry(); groups.delete(group); groups.flush(); recalculate(game);
    }
    @Transactional
    public void putBase(UserGame game, XboxProgressRequest request) {
        XboxAchievementGroup base = groups.findByLibraryEntryIdAndGroupType(game.getId(), XboxAchievementGroupType.BASE_GAME)
                .orElseGet(() -> new XboxAchievementGroup(game, "Основная игра", XboxAchievementGroupType.BASE_GAME));
        base.update("Основная игра", request.totalAchievements(), request.unlockedAchievements(),
                request.totalGamerscore(), request.earnedGamerscore());
        groups.save(base); recalculate(game);
    }
    @Transactional
    public void recalculate(UserGame game) {
        List<XboxAchievementGroup> values = groups.findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(game.getId());
        int totalAchievements = values.stream().mapToInt(XboxAchievementGroup::getTotalAchievements).sum();
        int unlockedAchievements = values.stream().mapToInt(XboxAchievementGroup::getUnlockedAchievements).sum();
        int totalGamerscore = values.stream().mapToInt(XboxAchievementGroup::getTotalGamerscore).sum();
        int earnedGamerscore = values.stream().mapToInt(XboxAchievementGroup::getEarnedGamerscore).sum();
        XboxGameProgress aggregate = progress.findByLibraryEntryId(game.getId()).orElseGet(() -> new XboxGameProgress(game));
        aggregate.update(totalAchievements, unlockedAchievements, totalGamerscore, earnedGamerscore, Instant.now());
        progress.save(aggregate);
    }
    private void apply(XboxAchievementGroup group, XboxAchievementGroupRequest request) {
        group.update(request.name().trim(), request.totalAchievements(), request.unlockedAchievements(),
                request.totalGamerscore(), request.earnedGamerscore());
    }
    private void validate(XboxAchievementGroupRequest request) {
        if (request.unlockedAchievements() > request.totalAchievements())
            throw new InvalidRequestException("unlockedAchievements must not exceed totalAchievements");
        if (request.earnedGamerscore() > request.totalGamerscore())
            throw new InvalidRequestException("earnedGamerscore must not exceed totalGamerscore");
    }
    private void validateName(Long libraryId, String name, Long id) {
        if (groups.existsByLibraryEntryIdAndNameIgnoreCaseAndIdNot(libraryId, name.trim(), id))
            throw new DuplicateResourceException("Achievement group name is already in use");
    }
    private XboxAchievementGroup find(Long id) { return groups.findByIdAndLibraryEntryUserContentUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Xbox achievement group with id " + id + " was not found")); }
    private UserGame findXboxGame(Long id) {
        UserGame game = games.findByIdAndUserContentUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Game library entry with id " + id + " was not found"));
        String code = game.getPlatform().getCode();
        if (!code.startsWith("XBOX_") && !code.equals("ORIGINAL_XBOX"))
            throw new InvalidRequestException("Achievement groups are only available for Xbox platforms");
        return game;
    }
    private double percent(int value, int total) { return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0; }
    private XboxAchievementGroupResponse response(XboxAchievementGroup group) {
        return new XboxAchievementGroupResponse(group.getId(), group.getLibraryEntry().getId(), group.getName(),
                group.getGroupType(), group.getTotalAchievements(), group.getUnlockedAchievements(),
                percent(group.getUnlockedAchievements(), group.getTotalAchievements()), group.getTotalGamerscore(),
                group.getEarnedGamerscore(), percent(group.getEarnedGamerscore(), group.getTotalGamerscore()));
    }
}
