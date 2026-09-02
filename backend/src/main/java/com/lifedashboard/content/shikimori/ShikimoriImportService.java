package com.lifedashboard.content.shikimori;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class ShikimoriImportService {
    private static final int MAX_BYTES = 2 * 1024 * 1024;
    private final ContentItemRepository items;
    private final ContentSeasonRepository seasons;
    private final ContentEpisodeRepository episodes;
    private final EpisodeWatchRepository watches;
    private final UserRepository users;
    private final ContentService contentService;
    private final DataTransferService dataTransfer;
    private final ShikimoriClient shikimori;
    private final ObjectMapper mapper;
    private final long userId;
    private final ConcurrentMap<String, List<SourceItem>> previews = new ConcurrentHashMap<>();

    public ShikimoriImportService(ContentItemRepository items, ContentSeasonRepository seasons,
            ContentEpisodeRepository episodes, EpisodeWatchRepository watches, UserRepository users,
            ContentService contentService, DataTransferService dataTransfer, ShikimoriClient shikimori,
            ObjectMapper mapper, @Value("${app.default-user-id}") long userId) {
        this.items = items; this.seasons = seasons; this.episodes = episodes; this.watches = watches;
        this.users = users; this.contentService = contentService; this.dataTransfer = dataTransfer;
        this.shikimori = shikimori; this.mapper = mapper; this.userId = userId;
    }

    public ShikimoriImportPreview preview(MultipartFile file) {
        List<SourceItem> source = parse(file);
        String token = UUID.randomUUID().toString();
        previews.put(token, source);
        List<ShikimoriImportPreview.Item> rows = source.stream().map(item ->
                new ShikimoriImportPreview.Item(item.id(), item.titleRu(), item.title(), item.status(),
                        item.score() == 0 ? null : item.score(), item.episodes(), item.rewatches(),
                        findExisting(item).map(ContentItem::getId).orElse(null))).toList();
        int completed = (int) source.stream().filter(item -> "completed".equals(item.status())).count();
        int watching = (int) source.stream().filter(item -> "watching".equals(item.status())
                || "rewatching".equals(item.status())).count();
        int planned = (int) source.stream().filter(item -> "planned".equals(item.status())).count();
        int existing = (int) rows.stream().filter(item -> item.existingContentId() != null).count();
        return new ShikimoriImportPreview(token, source.size(), completed, watching, planned, existing, rows,
                List.of("Экспорт не содержит дат просмотра: импортированные отметки не попадут в статистику дня.",
                        "Новые полнометражные аниме будут добавлены в раздел «Фильмы».",
                        "Фильмы, уже связанные с Кинопоиском, будут полностью пропущены без изменения карточки и личных данных."));
    }

    @Transactional
    public ShikimoriImportResult importData(String token) {
        List<SourceItem> source = previews.remove(token);
        if (source == null) throw new InvalidRequestException("Срок предварительного просмотра Shikimori истёк — загрузите файл ещё раз");
        List<ResolvedItem> resolved = new ArrayList<>();
        for (SourceItem item : source) {
            resolved.add(new ResolvedItem(item, shikimori.getAnime(item.id())));
            try { Thread.sleep(250); } catch (InterruptedException exception) {
                Thread.currentThread().interrupt(); throw new InvalidRequestException("Импорт из Shikimori был прерван");
            }
        }
        String backup = dataTransfer.createAutomaticBackup().toString();
        User user = users.findById(userId).orElseThrow();
        int animeCreated = 0, moviesCreated = 0, updated = 0, skipped = 0, episodeWatches = 0;
        for (ResolvedItem resolvedItem : resolved) {
            SourceItem sourceItem = resolvedItem.source();
            ShikimoriClient.AnimeDetails details = resolvedItem.details();
            boolean movie = "movie".equals(details.kind());
            Optional<ContentItem> match = findExisting(sourceItem);
            if (match.isPresent() && shouldSkipKinopoiskMovie(movie, match.get())) {
                skipped++;
                continue;
            }
            ContentItem item = match.orElseGet(() -> new ContentItem(title(details, sourceItem)));
            boolean created = match.isEmpty();
            item.update(title(details, sourceItem), normalize(details.name()),
                    movie ? ContentType.MOVIE : ContentType.ANIME,
                    movie ? ContentFormat.ANIMATION : ContentFormat.ANIME,
                    details.airedOn() == null ? null : details.airedOn().getYear(), normalize(details.description()),
                    normalize(details.imageUrl()), details.duration() > 0 ? details.duration() : null,
                    releaseStatus(details.status()), normalize(details.genre()), null, details.airedOn(), false);
            item.setShikimoriId(sourceItem.id());
            items.save(item);
            if (created) { if (movie) moviesCreated++; else animeCreated++; } else updated++;
            contentService.putInLibrary(item.getId(), new LibraryEntryRequest(userStatus(sourceItem.status()),
                    sourceItem.score() > 0 ? sourceItem.score().shortValue() : null, false, null, null,
                    normalize(sourceItem.text())));
            if (!movie) episodeWatches += importEpisodes(item, sourceItem, details, user);
        }
        return new ShikimoriImportResult(source.size(), animeCreated, moviesCreated, updated, skipped,
                episodeWatches, backup);
    }

    private int importEpisodes(ContentItem item, SourceItem source, ShikimoriClient.AnimeDetails details, User user) {
        int total = Math.max(details.episodes(), Math.max(details.episodesAired(), source.episodes()));
        if (total == 0) return 0;
        ContentSeason season = seasons.findAllByContentIdOrderBySeasonNumber(item.getId()).stream().findFirst()
                .orElseGet(() -> { ContentSeason value = new ContentSeason(item); value.update(1, "Основной выпуск",
                    details.airedOn() == null ? null : details.airedOn().getYear()); return seasons.save(value); });
        Map<Integer, ContentEpisode> current = new HashMap<>();
        for (ContentEpisode episode : episodes.findAllBySeasonIdOrderByEpisodeNumber(season.getId()))
            current.put(episode.getEpisodeNumber(), episode);
        int addedWatches = 0;
        for (int number = 1; number <= total; number++) {
            ContentEpisode episode = current.get(number);
            if (episode == null) {
                episode = new ContentEpisode(season);
                episode.update(number, "Эпизод " + number, details.duration() > 0 ? details.duration() : null, null);
                episode = episodes.save(episode);
            }
            int desired = number <= source.episodes() ? 1 + source.rewatches() : 0;
            int existing = watches.maxNumber(episode.getId(), userId);
            for (int watchNumber = existing + 1; watchNumber <= desired; watchNumber++) {
                watches.save(new EpisodeWatch(user, episode, Instant.now(), watchNumber, true));
                addedWatches++;
            }
        }
        return addedWatches;
    }

    private List<SourceItem> parse(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new InvalidRequestException("Файл экспорта Shikimori пуст");
        if (file.getSize() > MAX_BYTES) throw new InvalidRequestException("Размер экспорта Shikimori превышает 2 МБ");
        try {
            JsonNode root = mapper.readTree(file.getBytes());
            if (!root.isArray()) throw new InvalidRequestException("Экспорт Shikimori должен содержать массив JSON");
            List<SourceItem> result = new ArrayList<>();
            Set<Long> ids = new HashSet<>();
            for (JsonNode node : root) {
                long id = node.path("target_id").asLong();
                if (id <= 0 || !ids.add(id)) continue;
                result.add(new SourceItem(id, text(node, "target_title"), text(node, "target_title_ru"),
                        text(node, "status"), node.path("score").asInt(), node.path("episodes").asInt(),
                        node.path("rewatches").asInt(), text(node, "text")));
            }
            if (result.isEmpty()) throw new InvalidRequestException("Экспорт Shikimori не содержит аниме");
            return List.copyOf(result);
        } catch (IOException exception) { throw new InvalidRequestException("Не удалось прочитать экспорт Shikimori"); }
    }

    private Optional<ContentItem> findExisting(SourceItem source) {
        Optional<ContentItem> linked = items.findByShikimoriId(source.id());
        if (linked.isPresent()) return linked;
        String russian = key(source.titleRu()), original = key(source.title());
        return items.findAllByOrderByTitleAsc().stream().filter(item -> item.getItemType() == ContentType.ANIME
                || item.getItemType() == ContentType.MOVIE).filter(item -> {
            String title = key(item.getTitle()), itemOriginal = key(item.getOriginalTitle());
            return (!russian.isEmpty() && (russian.equals(title) || russian.equals(itemOriginal)))
                    || (!original.isEmpty() && (original.equals(title) || original.equals(itemOriginal)));
        }).findFirst();
    }

    private String title(ShikimoriClient.AnimeDetails details, SourceItem source) {
        return first(details.russian(), source.titleRu(), details.name(), source.title(), "Anime " + source.id());
    }
    private ReleaseStatus releaseStatus(String status) { return switch (status == null ? "" : status) {
        case "anons" -> ReleaseStatus.ANNOUNCED; case "ongoing" -> ReleaseStatus.ONGOING;
        case "released" -> ReleaseStatus.ENDED; default -> ReleaseStatus.RELEASED; }; }
    private UserContentStatus userStatus(String status) { return switch (status == null ? "" : status) {
        case "watching", "rewatching" -> UserContentStatus.IN_PROGRESS; case "completed" -> UserContentStatus.COMPLETED;
        case "on_hold" -> UserContentStatus.PAUSED; case "dropped" -> UserContentStatus.DROPPED;
        default -> UserContentStatus.PLANNED; }; }
    private String first(String... values) { for (String value : values) if (value != null && !value.isBlank()) return value.trim(); return "—"; }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String key(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT); }
    private String text(JsonNode node, String field) { JsonNode value = node.get(field); return value == null || value.isNull() ? null : value.stringValue(); }
    static boolean shouldSkipKinopoiskMovie(boolean movie, ContentItem item) {
        return movie && item.getItemType() == ContentType.MOVIE && item.getKinopoiskFilmId() != null;
    }
    private record SourceItem(long id, String title, String titleRu, String status, Integer score,
            int episodes, int rewatches, String text) {}
    private record ResolvedItem(SourceItem source, ShikimoriClient.AnimeDetails details) {}
}
