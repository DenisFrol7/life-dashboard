package com.lifedashboard.game.openxbl;

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

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
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
public class XboxImportService {
    private static final Duration BACKUP_SESSION_TTL = Duration.ofHours(2);
    private final XboxImportPreviewService previewService;
    private final ContentItemRepository contentItems;
    private final UserContentRepository userContent;
    private final UserGameRepository library;
    private final GamingPlatformRepository platforms;
    private final GameSourceRepository sources;
    private final UserRepository users;
    private final XboxGameMetadataResolver metadataResolver;
    private final DataTransferService dataTransfer;
    private final long userId;
    private final ConcurrentMap<String, BackupSession> backupSessions = new ConcurrentHashMap<>();

    public XboxImportService(XboxImportPreviewService previewService,
            ContentItemRepository contentItems, UserContentRepository userContent,
            UserGameRepository library, GamingPlatformRepository platforms,
            GameSourceRepository sources, UserRepository users,
            XboxGameMetadataResolver metadataResolver, DataTransferService dataTransfer,
            @Value("${app.default-user-id}") long userId) {
        this.previewService = previewService;
        this.contentItems = contentItems;
        this.userContent = userContent;
        this.library = library;
        this.platforms = platforms;
        this.sources = sources;
        this.users = users;
        this.metadataResolver = metadataResolver;
        this.dataTransfer = dataTransfer;
        this.userId = userId;
    }

    public XboxImportPreparation prepare(XboxImportSelection request) {
        Set<Long> selectedIds = new LinkedHashSet<>(request.titleIds());
        if (selectedIds.size() != request.titleIds().size()) {
            throw new InvalidRequestException("Список импорта содержит повторяющиеся Xbox Title ID");
        }
        XboxImportPreview preview = previewService.preview();
        Map<Long, XboxImportPreviewItem> available = validateAvailable(selectedIds, preview);
        String backupFile = dataTransfer.createAutomaticBackup().toString();
        Instant now = Instant.now();
        backupSessions.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
        String token = UUID.randomUUID().toString();
        backupSessions.put(token, new BackupSession(Map.copyOf(available), backupFile,
                now.plus(BACKUP_SESSION_TTL)));
        return new XboxImportPreparation(token, backupFile);
    }

    @Transactional
    public XboxImportResult importSelected(XboxImportRequest request) {
        BackupSession backup = requireBackup(request.backupToken());
        Map<Long, XboxImportGameRequest> selected = new LinkedHashMap<>();
        for (XboxImportGameRequest game : request.games()) {
            if (selected.putIfAbsent(game.titleId(), game) != null) {
                throw new InvalidRequestException(
                        "Список импорта содержит повторяющийся Xbox Title ID " + game.titleId());
            }
        }
        if (!backup.rows().keySet().containsAll(selected.keySet())) {
            throw new InvalidRequestException("Список импорта изменился после создания резервной копии");
        }
        User user = users.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Пользователь не найден"));

        int imported = 0;
        int catalogCreated = 0;
        int linkedExisting = 0;
        int skipped = 0;
        int rawgEnriched = 0;
        int steamGridDbCovers = 0;
        for (XboxImportGameRequest selectedGame : selected.values()) {
            XboxImportPreviewItem row = backup.rows().get(selectedGame.titleId());
            if (row.match() == XboxImportMatch.ALREADY_IMPORTED) {
                linkExistingCopy(row);
                skipped++;
                continue;
            }
            if (library.findByXboxTitleIdAndUserContentUserId(row.titleId(), userId).isPresent()) {
                skipped++;
                continue;
            }

            ContentItem content;
            if (row.matchedContentId() != null) {
                content = contentItems.findById(row.matchedContentId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Связанная карточка игры не найдена: " + row.matchedContentId()));
                linkedExisting++;
            } else {
                XboxGameMetadata metadata = metadataResolver.resolve(row);
                content = createCatalogItem(row, metadata);
                catalogCreated++;
                if (metadata.rawg() != null) rawgEnriched++;
                if (metadata.verticalCover() != null) steamGridDbCovers++;
            }

            GamingPlatform platform = platforms.findByCode(row.platformCode())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Игровая платформа " + row.platformCode() + " не найдена"));
            GameSource source = findSource(selectedGame.sourceCode());
            GameAccessType accessType = "GAME_PASS".equals(selectedGame.sourceCode())
                    ? GameAccessType.SUBSCRIPTION : GameAccessType.OWNED;
            UserContent entry = userContent.findByUserIdAndContentId(userId, content.getId())
                    .orElseGet(() -> createUserContent(user, content));
            UserGame copy = new UserGame(entry);
            copy.update(platform, source, accessType, null, null, null, 0,
                    UserContentStatus.NOT_STARTED, null, null);
            copy.linkXboxTitle(row.titleId());
            library.save(copy);
            imported++;
        }
        return new XboxImportResult(selected.size(), imported, catalogCreated,
                linkedExisting, skipped, rawgEnriched, steamGridDbCovers,
                backup.backupFile());
    }

    private Map<Long, XboxImportPreviewItem> validateAvailable(Set<Long> selectedIds,
            XboxImportPreview preview) {
        Map<Long, XboxImportPreviewItem> all = preview.games().stream()
                .collect(Collectors.toMap(XboxImportPreviewItem::titleId, Function.identity()));
        Set<Long> unknownIds = selectedIds.stream()
                .filter(titleId -> !all.containsKey(titleId))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!unknownIds.isEmpty()) {
            throw new InvalidRequestException(
                    "Выбранные игры отсутствуют в истории Xbox: " + unknownIds);
        }
        return selectedIds.stream().collect(Collectors.toMap(Function.identity(), all::get,
                (first, second) -> first, LinkedHashMap::new));
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

    private void linkExistingCopy(XboxImportPreviewItem row) {
        if (row.matchedLibraryEntryId() == null) return;
        library.findByIdAndUserContentUserId(row.matchedLibraryEntryId(), userId)
                .filter(copy -> copy.getXboxTitleId() == null)
                .ifPresent(copy -> copy.linkXboxTitle(row.titleId()));
    }

    private GameSource findSource(String code) {
        if (!"XBOX_STORE".equals(code) && !"GAME_PASS".equals(code)) {
            throw new InvalidRequestException("Недопустимый источник Xbox-игры: " + code);
        }
        return sources.findByCode(code)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Источник игр " + code + " не найден"));
    }

    private ContentItem createCatalogItem(XboxImportPreviewItem row, XboxGameMetadata metadata) {
        RawgClient.GameData rawg = metadata.rawg();
        String title = rawg == null ? row.title() : rawg.title();
        LocalDate releaseDate = rawg == null ? null : rawg.releaseDate();
        ReleaseStatus releaseStatus = rawg != null
                && (rawg.tba() || releaseDate != null && releaseDate.isAfter(LocalDate.now()))
                ? ReleaseStatus.ANNOUNCED : ReleaseStatus.RELEASED;
        String coverUrl = metadata.verticalCover() == null
                ? null : metadata.verticalCover().imageUrl();
        String backgroundUrl = rawg == null || rawg.backgroundUrl() == null
                ? row.imageUrl() : rawg.backgroundUrl();
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
        if (rawg != null) item.linkRawg(rawg.rawgId(), rawg.slug());
        return contentItems.save(item);
    }

    private UserContent createUserContent(User user, ContentItem content) {
        UserContent entry = new UserContent(user, content);
        entry.update(UserContentStatus.NOT_STARTED, null, false, null, null, null);
        return userContent.save(entry);
    }

    private record BackupSession(Map<Long, XboxImportPreviewItem> rows,
            String backupFile, Instant expiresAt) {}
}
