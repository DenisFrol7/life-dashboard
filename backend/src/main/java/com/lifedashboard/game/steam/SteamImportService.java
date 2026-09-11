package com.lifedashboard.game.steam;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentType;
import com.lifedashboard.content.ReleaseStatus;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.content.UserContentRepository;
import com.lifedashboard.content.UserContentStatus;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.game.GameAccessType;
import com.lifedashboard.game.GameSource;
import com.lifedashboard.game.GameSourceRepository;
import com.lifedashboard.game.GameSessionRepository;
import com.lifedashboard.game.GamingPlatform;
import com.lifedashboard.game.GamingPlatformRepository;
import com.lifedashboard.game.UserGame;
import com.lifedashboard.game.UserGameRepository;
import com.lifedashboard.game.rawg.RawgClient;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SteamImportService {
    private static final Duration BACKUP_SESSION_TTL = Duration.ofHours(2);
    private final SteamImportPreviewService previewService;
    private final ContentItemRepository contentItems;
    private final UserContentRepository userContent;
    private final UserGameRepository library;
    private final GameSessionRepository sessions;
    private final GamingPlatformRepository platforms;
    private final GameSourceRepository sources;
    private final UserRepository users;
    private final SteamGameMetadataResolver metadataResolver;
    private final DataTransferService dataTransfer;
    private final long userId;
    private final ConcurrentMap<String, BackupSession> backupSessions = new ConcurrentHashMap<>();

    public SteamImportService(SteamImportPreviewService previewService,
            ContentItemRepository contentItems, UserContentRepository userContent,
            UserGameRepository library, GameSessionRepository sessions,
            GamingPlatformRepository platforms,
            GameSourceRepository sources, UserRepository users,
            SteamGameMetadataResolver metadataResolver,
            DataTransferService dataTransfer,
            @Value("${app.default-user-id}") long userId) {
        this.previewService = previewService;
        this.contentItems = contentItems;
        this.userContent = userContent;
        this.library = library;
        this.sessions = sessions;
        this.platforms = platforms;
        this.sources = sources;
        this.users = users;
        this.metadataResolver = metadataResolver;
        this.dataTransfer = dataTransfer;
        this.userId = userId;
    }

    public SteamImportPreparation prepare(SteamImportSelection request) {
        Set<Long> selectedIds = new LinkedHashSet<>(request.appIds());
        if (selectedIds.size() != request.appIds().size()) {
            throw new InvalidRequestException("Список импорта содержит повторяющиеся Steam App ID");
        }
        SteamImportPreview preview = previewService.preview();
        Map<Long, SteamImportPreviewItem> available = validateAvailable(selectedIds, preview);
        String backupFile = dataTransfer.createAutomaticBackup().toString();
        Instant now = Instant.now();
        backupSessions.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
        String token = UUID.randomUUID().toString();
        backupSessions.put(token, new BackupSession(Map.copyOf(available), backupFile,
                now.plus(BACKUP_SESSION_TTL)));
        return new SteamImportPreparation(token, backupFile);
    }

    @Transactional
    public SteamImportResult importSelected(SteamImportRequest request) {
        BackupSession backup = requireBackup(request.backupToken());
        Map<Long, SteamImportGameRequest> selected = new LinkedHashMap<>();
        for (SteamImportGameRequest game : request.games()) {
            if (selected.putIfAbsent(game.appId(), game) != null) {
                throw new InvalidRequestException(
                        "Список импорта содержит повторяющийся Steam App ID " + game.appId());
            }
        }
        if (!backup.rows().keySet().containsAll(selected.keySet()))
            throw new InvalidRequestException("Список импорта изменился после создания резервной копии");
        validateResolutions(selected, backup);

        GamingPlatform pc = platforms.findByCode("PC")
                .orElseThrow(() -> new ResourceNotFoundException("Игровая платформа PC не найдена"));
        GameSource steam = sources.findByCode("STEAM")
                .orElseThrow(() -> new ResourceNotFoundException("Источник Steam не найден"));
        User user = users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        int imported = 0;
        int catalogCreated = 0;
        int linkedExisting = 0;
        int skipped = 0;
        int rawgEnriched = 0;
        int steamGridDbCovers = 0;
        for (SteamImportGameRequest selectedGame : selected.values()) {
            long appId = selectedGame.appId();
            SteamImportPreviewItem row = backup.rows().get(appId);
            if (row.match() == SteamImportMatch.ALREADY_IMPORTED) {
                skipped++;
                continue;
            }
            if (library.findBySteamAppIdAndUserContentUserId(appId, userId).isPresent()) {
                skipped++;
                continue;
            }

            if (selectedGame.resolution() != SteamImportResolution.NEW_GAME
                    && linkExistingCopy(row)) {
                imported++;
                linkedExisting++;
                continue;
            }

            Long matchedContentId = resolvedContentId(row, selectedGame);
            ContentItem content;
            if (matchedContentId != null) {
                content = contentItems.findById(matchedContentId)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Связанная карточка игры не найдена: " + matchedContentId));
                linkedExisting++;
            } else {
                SteamGameMetadata metadata = metadataResolver.resolve(row);
                content = createCatalogItem(row, metadata);
                catalogCreated++;
                if (metadata.rawg() != null) rawgEnriched++;
                if (metadata.verticalCover() != null) steamGridDbCovers++;
            }

            UserContent entry = userContent.findByUserIdAndContentId(userId, content.getId())
                    .orElseGet(() -> createUserContent(user, content));
            UserGame copy = new UserGame(entry);
            copy.update(pc, steam, GameAccessType.OWNED, null, null, null,
                    row.playtimeMinutes(), UserContentStatus.NOT_STARTED, null, null);
            copy.linkSteamApp(appId);
            library.save(copy);
            imported++;
        }
        return new SteamImportResult(selected.size(), imported, catalogCreated,
                linkedExisting, skipped, rawgEnriched, steamGridDbCovers,
                backup.backupFile());
    }

    private Map<Long, SteamImportPreviewItem> validateAvailable(Set<Long> selectedIds,
            SteamImportPreview preview) {
        Map<Long, SteamImportPreviewItem> available = preview.games().stream()
                .collect(Collectors.toMap(SteamImportPreviewItem::appId, Function.identity()));
        Set<Long> unknownIds = selectedIds.stream()
                .filter(appId -> !available.containsKey(appId))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!unknownIds.isEmpty())
            throw new InvalidRequestException("Выбранные игры отсутствуют в библиотеке Steam: " + unknownIds);
        return available;
    }

    private BackupSession requireBackup(String token) {
        BackupSession backup = backupSessions.get(token);
        if (backup == null || backup.expiresAt().isBefore(Instant.now())) {
            if (backup != null) backupSessions.remove(token);
            throw new InvalidRequestException(
                    "Резервная копия для импорта не найдена или устарела — начните импорт заново");
        }
        return backup;
    }

    private void validateResolutions(Map<Long, SteamImportGameRequest> selected,
            BackupSession backup) {
        for (SteamImportGameRequest request : selected.values()) {
            SteamImportPreviewItem row = backup.rows().get(request.appId());
            if (row.match() == SteamImportMatch.REVIEW && request.resolution() == null) {
                throw new InvalidRequestException(
                        "Выберите способ добавления для Steam-игры «" + row.title() + "»");
            }
            if (row.match() != SteamImportMatch.MATCHED
                    && row.match() != SteamImportMatch.REVIEW
                    && request.resolution() != null) {
                throw new InvalidRequestException(
                        "Способ добавления можно выбирать только для найденных совпадений");
            }
        }
    }

    private Long resolvedContentId(SteamImportPreviewItem row,
            SteamImportGameRequest request) {
        if (row.match() != SteamImportMatch.MATCHED
                && row.match() != SteamImportMatch.REVIEW) return row.matchedContentId();
        if (request.resolution() == SteamImportResolution.NEW_GAME) return null;
        if (row.matchedContentId() == null) {
            throw new InvalidRequestException(
                    "Для Steam-игры «" + row.title() + "» не найдена карточка для связи");
        }
        return row.matchedContentId();
    }

    private boolean linkExistingCopy(SteamImportPreviewItem row) {
        if (row.matchedLibraryEntryId() == null) return false;
        return library.findByIdAndUserContentUserId(row.matchedLibraryEntryId(), userId)
                .filter(copy -> copy.getSteamAppId() == null)
                .filter(copy -> "STEAM".equals(copy.getSource().getCode()))
                .map(copy -> {
                    long trackedMinutes = sessions.totalMinutes(copy.getId(), userId);
                    copy.linkSteamApp(row.appId(),
                            Math.max(0, row.playtimeMinutes() - trackedMinutes));
                    return true;
                })
                .orElse(false);
    }

    private ContentItem createCatalogItem(SteamImportPreviewItem row, SteamGameMetadata metadata) {
        RawgClient.GameData rawg = metadata.rawg();
        String title = rawg == null ? row.title() : rawg.title();
        LocalDate releaseDate = rawg == null ? null : rawg.releaseDate();
        ReleaseStatus releaseStatus = rawg != null
                && (rawg.tba() || releaseDate != null && releaseDate.isAfter(LocalDate.now()))
                ? ReleaseStatus.ANNOUNCED : ReleaseStatus.RELEASED;
        String coverUrl = metadata.verticalCover() == null
                ? null : metadata.verticalCover().imageUrl();
        String backgroundUrl = rawg == null || rawg.backgroundUrl() == null
                ? steamHeaderUrl(row.appId()) : rawg.backgroundUrl();
        ContentItem item = new ContentItem(title);
        item.update(title, rawg == null ? null : rawg.originalTitle(), ContentType.GAME, null,
                releaseDate == null ? null : releaseDate.getYear(),
                rawg == null ? null : rawg.description(), coverUrl, null, releaseStatus,
                rawg == null ? null : rawg.genre(), rawg == null ? null : rawg.developer(),
                releaseDate, false);
        item.updateGameArtwork(backgroundUrl,
                metadata.steamGridDbGame() == null
                        ? null : metadata.steamGridDbGame().steamGridDbId(),
                metadata.verticalCover() == null ? null : metadata.verticalCover().gridId());
        if (rawg != null && contentItems.findByRawgId(rawg.rawgId()).isEmpty()) {
            item.linkRawg(rawg.rawgId(), rawg.slug());
        }
        return contentItems.save(item);
    }

    private UserContent createUserContent(User user, ContentItem content) {
        UserContent entry = new UserContent(user, content);
        entry.update(UserContentStatus.NOT_STARTED, null, false, null, null, null);
        return userContent.save(entry);
    }

    private String steamHeaderUrl(long appId) {
        return "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/"
                + appId + "/header.jpg";
    }

    private record BackupSession(Map<Long, SteamImportPreviewItem> rows,
            String backupFile, Instant expiresAt) {}
}
