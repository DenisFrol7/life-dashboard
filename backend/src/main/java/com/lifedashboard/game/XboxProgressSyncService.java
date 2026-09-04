package com.lifedashboard.game;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.content.ContentItem;
import com.lifedashboard.game.dto.XboxProgressRequest;
import com.lifedashboard.game.dto.XboxProgressResponse;
import com.lifedashboard.game.dto.XboxProgressSyncResponse;
import com.lifedashboard.game.openxbl.OpenXblClient;
import com.lifedashboard.game.openxbl.OpenXblProgress;
import com.lifedashboard.game.openxbl.OpenXblTitle;
import com.lifedashboard.game.openxbl.OpenXblTitleHistory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
@Transactional(readOnly = true)
public class XboxProgressSyncService {
    private final UserGameRepository games;
    private final XboxGameProgressRepository progress;
    private final XboxAchievementGroupRepository groups;
    private final XboxAchievementGroupService achievementGroups;
    private final GamePlaythroughService playthroughs;
    private final OpenXblClient openXbl;
    private final long userId;

    public XboxProgressSyncService(UserGameRepository games,
            XboxGameProgressRepository progress, XboxAchievementGroupRepository groups,
            XboxAchievementGroupService achievementGroups, GamePlaythroughService playthroughs,
            OpenXblClient openXbl, @Value("${app.default-user-id}") long userId) {
        this.games = games;
        this.progress = progress;
        this.groups = groups;
        this.achievementGroups = achievementGroups;
        this.playthroughs = playthroughs;
        this.openXbl = openXbl;
        this.userId = userId;
    }

    @Transactional
    public XboxProgressSyncResponse sync(Long libraryEntryId) {
        UserGame game = findXboxGame(libraryEntryId);
        OpenXblTitleHistory history = openXbl.titleHistory();
        OpenXblTitle title = findTitle(game, history.titles());
        if (game.getXboxTitleId() == null) game.linkXboxTitle(title.titleId());

        OpenXblProgress remote = normalize(openXbl.progress(history.xuid(), title));
        Optional<XboxGameProgress> existing = progress.findByLibraryEntryId(game.getId());
        OpenXblProgress snapshot = merge(remote, existing.orElse(null));
        XboxProgressRequest request = new XboxProgressRequest(snapshot.totalAchievements(),
                snapshot.unlockedAchievements(), snapshot.totalGamerscore(), snapshot.earnedGamerscore());
        boolean hasManualDlcGroups = groups.findAllByLibraryEntryIdOrderByGroupTypeAscIdAsc(game.getId())
                .stream().anyMatch(group -> group.getGroupType() == XboxAchievementGroupType.DLC);

        XboxGameProgress saved;
        if (hasManualDlcGroups) {
            achievementGroups.recalculate(game);
            saved = progress.findByLibraryEntryId(game.getId()).orElseThrow();
            saved.update(saved.getTotalAchievements(), saved.getUnlockedAchievements(),
                    saved.getTotalGamerscore(), saved.getEarnedGamerscore(),
                    latest(saved.getLastUnlockedAt(), remote.lastUnlockedAt()), Instant.now());
        } else {
            achievementGroups.putBase(game, request);
            saved = progress.findByLibraryEntryId(game.getId()).orElseThrow();
            saved.update(request.totalAchievements(), request.unlockedAchievements(),
                    request.totalGamerscore(), request.earnedGamerscore(),
                    latest(saved.getLastUnlockedAt(), remote.lastUnlockedAt()), Instant.now());
        }
        saved = progress.save(saved);

        boolean completionRecorded = remote.exactAchievementDetails()
                && remote.totalAchievements() > 0
                && remote.unlockedAchievements() == remote.totalAchievements()
                && remote.lastUnlockedAt() != null
                && playthroughs.recordXboxAchievementCompletion(game, remote.lastUnlockedAt());
        return new XboxProgressSyncResponse(title.titleId(), title.name(),
                snapshot.exactAchievementDetails(), hasManualDlcGroups,
                saved.getLastUnlockedAt(), completionRecorded, response(saved));
    }

    private UserGame findXboxGame(Long id) {
        UserGame game = games.findByIdAndUserContentUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Копия игры с идентификатором " + id + " не найдена"));
        String code = game.getPlatform().getCode();
        if (!code.startsWith("XBOX_") && !code.equals("ORIGINAL_XBOX")) {
            throw new InvalidRequestException(
                    "Синхронизация Xbox доступна только для платформ Xbox");
        }
        return game;
    }

    private OpenXblTitle findTitle(UserGame game, List<OpenXblTitle> titles) {
        if (game.getXboxTitleId() != null) {
            return titles.stream().filter(title -> title.titleId() == game.getXboxTitleId())
                    .findFirst().orElseThrow(() -> new InvalidRequestException(
                            "Связанная Xbox-игра не найдена в истории профиля"));
        }
        ContentItem content = game.getUserContent().getContent();
        Set<String> expectedNames = new HashSet<>();
        if (content.getTitle() != null) expectedNames.add(normalizeTitle(content.getTitle()));
        if (content.getOriginalTitle() != null) expectedNames.add(normalizeTitle(content.getOriginalTitle()));
        String requiredDevice = deviceFor(game.getPlatform().getCode());
        return titles.stream()
                .filter(title -> expectedNames.contains(normalizeTitle(title.name())))
                .filter(title -> requiredDevice == null || title.devices().stream()
                        .anyMatch(device -> device.equalsIgnoreCase(requiredDevice)))
                .sorted(Comparator.comparingInt(OpenXblTitle::currentAchievements).reversed()
                        .thenComparing(OpenXblTitle::lastPlayedAt,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .findFirst()
                .orElseThrow(() -> new InvalidRequestException(
                        "Не удалось однозначно найти эту игру в истории Xbox-профиля"));
    }

    private String deviceFor(String platformCode) {
        return switch (platformCode) {
            case "XBOX_360" -> "Xbox360";
            case "XBOX_ONE" -> "XboxOne";
            case "XBOX_SERIES" -> "XboxSeries";
            default -> null;
        };
    }

    private String normalizeTitle(String value) {
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replace("™", "").replace("®", "");
        return normalized.replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
    }

    private OpenXblProgress normalize(OpenXblProgress source) {
        int totalAchievements = Math.max(source.totalAchievements(), source.unlockedAchievements());
        int totalGamerscore = Math.max(source.totalGamerscore(), source.earnedGamerscore());
        return new OpenXblProgress(source.titleId(), totalAchievements,
                source.unlockedAchievements(), totalGamerscore, source.earnedGamerscore(),
                source.lastUnlockedAt(), source.exactAchievementDetails());
    }

    private OpenXblProgress merge(OpenXblProgress remote, XboxGameProgress existing) {
        if (existing == null) return remote;
        int unlockedAchievements = Math.max(remote.unlockedAchievements(), existing.getUnlockedAchievements());
        int earnedGamerscore = Math.max(remote.earnedGamerscore(), existing.getEarnedGamerscore());
        int totalAchievements = Math.max(Math.max(remote.totalAchievements(), existing.getTotalAchievements()),
                unlockedAchievements);
        int totalGamerscore = Math.max(Math.max(remote.totalGamerscore(), existing.getTotalGamerscore()),
                earnedGamerscore);
        return new OpenXblProgress(remote.titleId(), totalAchievements, unlockedAchievements,
                totalGamerscore, earnedGamerscore,
                latest(existing.getLastUnlockedAt(), remote.lastUnlockedAt()),
                remote.exactAchievementDetails());
    }

    private Instant latest(Instant first, Instant second) {
        if (first == null) return second;
        if (second == null) return first;
        return first.isAfter(second) ? first : second;
    }

    private XboxProgressResponse response(XboxGameProgress value) {
        return new XboxProgressResponse(value.getId(), value.getLibraryEntry().getId(),
                value.getTotalAchievements(), value.getUnlockedAchievements(),
                percent(value.getUnlockedAchievements(), value.getTotalAchievements()),
                value.getTotalGamerscore(), value.getEarnedGamerscore(),
                percent(value.getEarnedGamerscore(), value.getTotalGamerscore()),
                value.getLastUnlockedAt(), value.getLastUpdatedAt());
    }

    private double percent(int value, int total) {
        return total == 0 ? 0.0 : Math.round(value * 10000.0 / total) / 100.0;
    }
}
