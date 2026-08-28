package com.lifedashboard.content.myshows;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentType;
import com.lifedashboard.content.ContentFormat;
import com.lifedashboard.content.ReleaseStatus;
import com.lifedashboard.content.UserContent;
import com.lifedashboard.content.UserContentRepository;
import com.lifedashboard.content.UserContentStatus;
import com.lifedashboard.content.ContentSeason;
import com.lifedashboard.content.ContentSeasonRepository;
import com.lifedashboard.content.ContentEpisode;
import com.lifedashboard.content.ContentEpisodeRepository;
import com.lifedashboard.content.EpisodeWatch;
import com.lifedashboard.content.EpisodeWatchRepository;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DateUtil;
import org.springframework.beans.factory.annotation.Value;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.nio.file.Path;

@Service
public class MyShowsImportService {

    private static final List<String> SERIES_HEADERS = List.of(
            "Название", "Статус", "Оценка", "Длительность серии, мин.",
            "Просмотрено эпизодов", "Осталось эпизодов", "Потрачено часов", "Осталось часов");
    private static final List<String> EPISODE_HEADERS = List.of(
            "Сериал", "Сезон", "Эпизод", "Название", "Дата просмотра", "Оценка");

    private final ContentItemRepository contentRepository;
    private final KinopoiskCatalogClient kinopoisk;
    private final UserContentRepository libraryRepository;
    private final ContentSeasonRepository seasonRepository;
    private final ContentEpisodeRepository episodeRepository;
    private final EpisodeWatchRepository watchRepository;
    private final UserRepository userRepository;
    private final DataTransferService dataTransfer;
    private final long defaultUserId;

    public MyShowsImportService(ContentItemRepository contentRepository, KinopoiskCatalogClient kinopoisk,
            UserContentRepository libraryRepository, ContentSeasonRepository seasonRepository,
            ContentEpisodeRepository episodeRepository, EpisodeWatchRepository watchRepository,
            UserRepository userRepository, DataTransferService dataTransfer,
            @Value("${app.default-user-id}") long defaultUserId) {
        this.contentRepository = contentRepository;
        this.kinopoisk = kinopoisk;
        this.libraryRepository = libraryRepository;
        this.seasonRepository = seasonRepository;
        this.episodeRepository = episodeRepository;
        this.watchRepository = watchRepository;
        this.userRepository = userRepository;
        this.dataTransfer = dataTransfer;
        this.defaultUserId = defaultUserId;
    }

    @Transactional
    public MyShowsImportResult importData(MultipartFile file, MyShowsImportRequest request) {
        if (file.isEmpty()) throw new InvalidRequestException("MyShows export file is empty");
        Map<String, MyShowsImportRequest.Choice> choices = new HashMap<>();
        if (request != null && request.choices() != null) {
            for (var choice : request.choices()) choices.put(normalize(choice.sourceTitle()), choice);
        }
        Path backup = dataTransfer.createAutomaticBackup();
        try (InputStream input = file.getInputStream(); Workbook workbook = WorkbookFactory.create(input)) {
            DataFormatter formatter = new DataFormatter(Locale.forLanguageTag("ru-RU"));
            Sheet seriesSheet = requiredSheet(workbook, "Сериалы");
            Sheet episodesSheet = requiredSheet(workbook, "Эпизоды");
            validateHeaders(seriesSheet, SERIES_HEADERS, formatter);
            validateHeaders(episodesSheet, EPISODE_HEADERS, formatter);
            User user = userRepository.findById(defaultUserId)
                    .orElseThrow(() -> new InvalidRequestException("Default user was not found"));
            Map<String, ContentItem> imported = new HashMap<>();
            Map<String, List<ContentItem>> existing = indexExisting(
                    contentRepository.findAllByItemTypeOrderByTitleAsc(ContentType.SERIES));
            int seriesCount = 0;
            int skipped = 0;
            for (int index = 1; index <= seriesSheet.getLastRowNum(); index++) {
                Row row = seriesSheet.getRow(index);
                String sourceTitle = value(row, 0, formatter);
                if (sourceTitle.isBlank()) continue;
                var choice = choices.get(normalize(sourceTitle));
                if (choice != null && "SKIP".equals(choice.action())) { skipped++; continue; }
                List<ContentItem> local = existing.getOrDefault(normalize(sourceTitle), List.of());
                ContentItem item;
                ContentItem byCatalogId = choice == null || choice.filmId() == null ? null
                        : contentRepository.findByKinopoiskFilmId(choice.filmId()).orElse(null);
                if (byCatalogId != null) {
                    item = byCatalogId;
                } else if (local.size() == 1) {
                    item = local.getFirst();
                    if (choice != null && choice.nameRu() != null && !choice.nameRu().isBlank()) {
                        item.update(choice.nameRu().trim(), blankToNull(choice.nameEn()), ContentType.SERIES,
                                item.getFormat(), item.getReleaseYear() != null ? item.getReleaseYear() : parseYear(choice.year()),
                                item.getDescription(), item.getCoverUrl(), item.getDurationMinutes(),
                                item.getReleaseStatus(), item.getGenre(), item.getDeveloper(), item.getReleaseDate(), false);
                    }
                } else {
                    item = new ContentItem(sourceTitle);
                    String originalTitle = choice == null ? null : choice.nameEn();
                    String displayTitle = choice == null ? null : blankToNull(choice.nameRu());
                    Integer year = parseYear(choice == null ? null : choice.year());
                    item.update(displayTitle == null ? sourceTitle : displayTitle, blankToNull(originalTitle), ContentType.SERIES,
                            ContentFormat.LIVE_ACTION, year, null, null, null,
                            ReleaseStatus.ONGOING, null, null, null, false);
                    item = contentRepository.save(item);
                }
                if (choice != null && choice.filmId() != null) item.setKinopoiskFilmId(choice.filmId());
                imported.put(normalize(sourceTitle), item);
                ContentItem selectedItem = item;
                UserContent library = libraryRepository.findByUserIdAndContentId(defaultUserId, selectedItem.getId())
                        .orElseGet(() -> new UserContent(user, selectedItem));
                library.update(mapStatus(value(row, 1, formatter)), mapRating(integer(row, 2, formatter)),
                        library.isFavorite(), library.getStartedAt(), library.getCompletedAt(), library.getPersonalNote());
                libraryRepository.save(library);
                seriesCount++;
            }
            int watches = importEpisodes(episodesSheet, formatter, imported, user);
            return new MyShowsImportResult(seriesCount, skipped, watches, backup.toString());
        } catch (IOException exception) {
            throw new InvalidRequestException("Could not read MyShows XLSX export");
        }
    }

    @Transactional
    public KinopoiskEnrichmentResult enrichFromKinopoisk(int batchSize) {
        int limit = Math.max(1, Math.min(batchSize, 20));
        List<ContentItem> all = contentRepository
                .findAllByItemTypeAndKinopoiskFilmIdIsNotNullOrderByTitleAsc(ContentType.SERIES);
        List<ContentItem> pending = all.stream()
                .filter(item -> item.getCoverUrl() == null || item.getCoverUrl().isBlank())
                .limit(limit).toList();
        if (pending.isEmpty()) return new KinopoiskEnrichmentResult(all.size(), 0, 0, false, null);
        Path backup = dataTransfer.createAutomaticBackup();
        int updated = 0;
        boolean rateLimited = false;
        for (ContentItem item : pending) {
            try {
                applyCatalog(item, kinopoisk.getCatalog(item.getKinopoiskFilmId()));
                updated++;
            } catch (InvalidRequestException exception) {
                String message = exception.getMessage().toLowerCase(Locale.ROOT);
                if (message.contains("rate limit") || message.contains("quota")) {
                    rateLimited = true;
                    break;
                }
                throw exception;
            }
        }
        int remaining = (int) all.stream().filter(item -> item.getCoverUrl() == null || item.getCoverUrl().isBlank()).count() - updated;
        return new KinopoiskEnrichmentResult(all.size(), updated, Math.max(0, remaining), rateLimited, backup.toString());
    }

    private void applyCatalog(ContentItem item, KinopoiskCatalogData catalog) {
        item.update(blankToNull(catalog.nameRu()) == null ? item.getTitle() : catalog.nameRu().trim(),
                blankToNull(catalog.nameOriginal()), ContentType.SERIES,
                item.getFormat() == null ? ContentFormat.LIVE_ACTION : item.getFormat(),
                catalog.year() == null || catalog.year() == 0 ? item.getReleaseYear() : catalog.year(),
                blankToNull(catalog.description()), blankToNull(catalog.coverUrl()), item.getDurationMinutes(),
                mapReleaseStatus(catalog.status()), blankToNull(catalog.genre()), item.getDeveloper(),
                item.getReleaseDate(), false);
        contentRepository.save(item);
        Map<Integer, ContentSeason> currentSeasons = new HashMap<>();
        for (ContentSeason season : seasonRepository.findAllByContentIdOrderBySeasonNumber(item.getId())) {
            currentSeasons.put(season.getSeasonNumber(), season);
        }
        for (KinopoiskCatalogData.Season sourceSeason : catalog.seasons()) {
            if (sourceSeason.number() < 1) continue;
            ContentSeason season = currentSeasons.computeIfAbsent(sourceSeason.number(), number -> {
                ContentSeason created = new ContentSeason(item);
                created.update(number, "Сезон " + number, null);
                return seasonRepository.save(created);
            });
            Map<Integer, ContentEpisode> currentEpisodes = new HashMap<>();
            for (ContentEpisode episode : episodeRepository.findAllBySeasonIdOrderByEpisodeNumber(season.getId())) {
                currentEpisodes.put(episode.getEpisodeNumber(), episode);
            }
            for (KinopoiskCatalogData.Episode sourceEpisode : sourceSeason.episodes()) {
                if (sourceEpisode.number() < 1) continue;
                ContentEpisode episode = currentEpisodes.get(sourceEpisode.number());
                if (episode == null) episode = new ContentEpisode(season);
                String title = blankToNull(sourceEpisode.nameRu());
                if (title == null) title = blankToNull(sourceEpisode.nameEn());
                if (title == null) title = "Эпизод " + sourceEpisode.number();
                episode.update(sourceEpisode.number(), title, episode.getDurationMinutes(), sourceEpisode.releaseDate());
                episodeRepository.save(episode);
            }
        }
    }

    private ReleaseStatus mapReleaseStatus(String value) {
        if (value == null) return ReleaseStatus.RELEASED;
        return switch (value) {
            case "ONGOING", "FILMING", "PRE_PRODUCTION", "POST_PRODUCTION" -> ReleaseStatus.ONGOING;
            case "ANNOUNCED" -> ReleaseStatus.ANNOUNCED;
            case "COMPLETED" -> ReleaseStatus.ENDED;
            case "CLOSED", "CANCELLED" -> ReleaseStatus.CANCELLED;
            default -> ReleaseStatus.RELEASED;
        };
    }

    private int importEpisodes(Sheet sheet, DataFormatter formatter, Map<String, ContentItem> imported, User user) {
        Map<String, ContentSeason> seasons = new HashMap<>();
        Map<String, ContentEpisode> episodes = new HashMap<>();
        int createdWatches = 0;
        for (int index = 1; index <= sheet.getLastRowNum(); index++) {
            Row row = sheet.getRow(index);
            ContentItem content = imported.get(normalize(value(row, 0, formatter)));
            Integer seasonNumber = integer(row, 1, formatter);
            Integer episodeNumber = integer(row, 2, formatter);
            if (content == null || seasonNumber == null || seasonNumber < 1 || episodeNumber == null || episodeNumber < 1) continue;
            String seasonKey = content.getId() + ":" + seasonNumber;
            ContentSeason season = seasons.computeIfAbsent(seasonKey, ignored -> seasonRepository
                    .findAllByContentIdOrderBySeasonNumber(content.getId()).stream()
                    .filter(candidate -> candidate.getSeasonNumber().equals(seasonNumber)).findFirst()
                    .orElseGet(() -> {
                        ContentSeason created = new ContentSeason(content);
                        created.update(seasonNumber, "Сезон " + seasonNumber, null);
                        return seasonRepository.save(created);
                    }));
            String episodeKey = season.getId() + ":" + episodeNumber;
            ContentEpisode episode = episodes.computeIfAbsent(episodeKey, ignored -> episodeRepository
                    .findAllBySeasonIdOrderByEpisodeNumber(season.getId()).stream()
                    .filter(candidate -> candidate.getEpisodeNumber().equals(episodeNumber)).findFirst()
                    .orElseGet(() -> {
                        ContentEpisode created = new ContentEpisode(season);
                        String title = blankToNull(value(row, 3, formatter));
                        created.update(episodeNumber, title == null ? "Эпизод " + episodeNumber : title, null, null);
                        return episodeRepository.save(created);
                    }));
            Instant watchedAt = watchedAt(row, 4, formatter);
            if (watchedAt != null && !watchRepository.existsByEpisodeIdAndUserIdAndWatchedAt(
                    episode.getId(), defaultUserId, watchedAt)) {
                int watchNumber = watchRepository.maxNumber(episode.getId(), defaultUserId) + 1;
                watchRepository.save(new EpisodeWatch(user, episode, watchedAt, watchNumber));
                createdWatches++;
            }
        }
        return createdWatches;
    }

    private UserContentStatus mapStatus(String raw) {
        String value = normalize(raw);
        if (value.contains("смотрю") || value.contains("watching")) return UserContentStatus.IN_PROGRESS;
        if (value.contains("полностью посмотрел") || value.contains("просмотр") || value.contains("completed")) return UserContentStatus.COMPLETED;
        if (value.contains("пауз") || value.contains("paused")) return UserContentStatus.PAUSED;
        if (value.contains("перестал") || value.contains("брош") || value.contains("dropped") || value.contains("stopped")) return UserContentStatus.DROPPED;
        return UserContentStatus.PLANNED;
    }

    private Short mapRating(Integer rating) {
        if (rating == null || rating < 1) return null;
        return (short) Math.min(10, rating * 2);
    }

    private Instant watchedAt(Row row, int column, DataFormatter formatter) {
        Cell cell = row == null ? null : row.getCell(column);
        try {
            LocalDateTime dateTime;
            if (cell != null && cell.getCellType() == org.apache.poi.ss.usermodel.CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                dateTime = cell.getLocalDateTimeCellValue();
            } else {
                String raw = value(row, column, formatter);
                if (raw.isBlank()) return null;
                LocalDate date = null;
                for (String pattern : List.of("dd.MM.yyyy", "d.M.yyyy", "yyyy-MM-dd")) {
                    try { date = LocalDate.parse(raw, DateTimeFormatter.ofPattern(pattern)); break; }
                    catch (DateTimeParseException ignored) { }
                }
                if (date == null) return null;
                dateTime = date.atTime(12, 0);
            }
            return dateTime.atZone(ZoneId.of(userZone())).toInstant();
        } catch (RuntimeException exception) { return null; }
    }

    private String userZone() {
        return userRepository.findById(defaultUserId).map(User::getTimezone).orElse("Europe/Moscow");
    }

    private Integer parseYear(String value) {
        if (value == null) return null;
        try { return Integer.parseInt(value.replaceAll("[^0-9].*$", "")); }
        catch (NumberFormatException exception) { return null; }
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    public KinopoiskMatchPreview matchWithKinopoisk(MultipartFile file) {
        MyShowsImportPreview source = preview(file);
        List<KinopoiskMatchPreview.SeriesMatch> matches = new ArrayList<>();
        int matched = 0;
        int review = 0;
        int notFound = 0;
        for (MyShowsImportPreview.SeriesPreview item : source.series()) {
            List<KinopoiskMatchPreview.Candidate> candidates = kinopoisk.searchSeries(item.title());
            List<KinopoiskMatchPreview.Candidate> exact = candidates.stream()
                    .filter(candidate -> normalize(item.title()).equals(normalize(candidate.nameRu()))
                            || normalize(item.title()).equals(normalize(candidate.nameEn())))
                    .toList();
            String status;
            Long selectedId = null;
            if (exact.size() == 1) {
                status = "MATCHED";
                selectedId = exact.getFirst().filmId();
                matched++;
            } else if (candidates.isEmpty()) {
                status = "NOT_FOUND";
                notFound++;
            } else {
                status = "REVIEW";
                review++;
            }
            matches.add(new KinopoiskMatchPreview.SeriesMatch(item.title(), item.status(), status,
                    selectedId, candidates));
        }
        return new KinopoiskMatchPreview(source.totalSeries(), matched, review, notFound, List.copyOf(matches));
    }

    public MyShowsImportPreview preview(MultipartFile file) {
        if (file.isEmpty()) throw new InvalidRequestException("MyShows export file is empty");
        try (InputStream input = file.getInputStream(); Workbook workbook = WorkbookFactory.create(input)) {
            DataFormatter formatter = new DataFormatter(Locale.forLanguageTag("ru-RU"));
            Sheet seriesSheet = requiredSheet(workbook, "Сериалы");
            Sheet episodesSheet = requiredSheet(workbook, "Эпизоды");
            validateHeaders(seriesSheet, SERIES_HEADERS, formatter);
            validateHeaders(episodesSheet, EPISODE_HEADERS, formatter);

            List<ContentItem> existing = contentRepository.findAllByItemTypeOrderByTitleAsc(ContentType.SERIES);
            Map<String, List<ContentItem>> byTitle = indexExisting(existing);
            Map<String, Integer> statuses = new LinkedHashMap<>();
            List<MyShowsImportPreview.SeriesPreview> rows = new ArrayList<>();
            int matched = 0;
            int fresh = 0;
            int ambiguous = 0;

            for (int index = 1; index <= seriesSheet.getLastRowNum(); index++) {
                Row row = seriesSheet.getRow(index);
                String title = value(row, 0, formatter);
                if (title.isBlank()) continue;
                String status = value(row, 1, formatter);
                statuses.merge(status, 1, Integer::sum);
                List<ContentItem> candidates = byTitle.getOrDefault(normalize(title), List.of());
                String match;
                Long contentId = null;
                if (candidates.size() == 1) {
                    match = "MATCHED";
                    contentId = candidates.getFirst().getId();
                    matched++;
                } else if (candidates.isEmpty()) {
                    match = "NEW";
                    fresh++;
                } else {
                    match = "AMBIGUOUS";
                    ambiguous++;
                }
                rows.add(new MyShowsImportPreview.SeriesPreview(title, status, integer(row, 2, formatter),
                        integer(row, 4, formatter), integer(row, 5, formatter), match, contentId));
            }

            int episodeWatches = countDataRows(episodesSheet, formatter);
            List<String> warnings = new ArrayList<>();
            warnings.add("Оценки MyShows используют шкалу 1–5 и при импорте будут преобразованы в шкалу 1–10.");
            warnings.add("Экспорт содержит только просмотренные эпизоды; непросмотренные эпизоды нельзя распределить по сезонам без внешнего каталога.");
            if (ambiguous > 0) warnings.add("Неоднозначные совпадения будут пропущены до ручного сопоставления.");
            return new MyShowsImportPreview(rows.size(), episodeWatches, matched, fresh, ambiguous,
                    Map.copyOf(statuses), List.copyOf(rows), List.copyOf(warnings));
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof InvalidRequestException invalid) throw invalid;
            throw new InvalidRequestException("Could not read MyShows XLSX export");
        }
    }

    private Sheet requiredSheet(Workbook workbook, String name) {
        Sheet sheet = workbook.getSheet(name);
        if (sheet == null) throw new InvalidRequestException("MyShows export does not contain sheet: " + name);
        return sheet;
    }

    private void validateHeaders(Sheet sheet, List<String> expected, DataFormatter formatter) {
        Row header = sheet.getRow(0);
        for (int column = 0; column < expected.size(); column++) {
            if (!expected.get(column).equals(value(header, column, formatter))) {
                throw new InvalidRequestException("Unexpected columns on MyShows sheet: " + sheet.getSheetName());
            }
        }
    }

    private Map<String, List<ContentItem>> indexExisting(List<ContentItem> items) {
        Map<String, List<ContentItem>> result = new LinkedHashMap<>();
        for (ContentItem item : items) {
            addCandidate(result, item.getTitle(), item);
            if (item.getOriginalTitle() != null) {
                addCandidate(result, item.getOriginalTitle(), item);
            }
        }
        return result;
    }

    private void addCandidate(Map<String, List<ContentItem>> index, String title, ContentItem item) {
        List<ContentItem> candidates = index.computeIfAbsent(normalize(title), ignored -> new ArrayList<>());
        if (candidates.stream().noneMatch(candidate -> candidate.getId().equals(item.getId()))) candidates.add(item);
    }

    private int countDataRows(Sheet sheet, DataFormatter formatter) {
        int count = 0;
        for (int index = 1; index <= sheet.getLastRowNum(); index++) {
            if (!value(sheet.getRow(index), 0, formatter).isBlank()) count++;
        }
        return count;
    }

    private String value(Row row, int column, DataFormatter formatter) {
        return row == null ? "" : formatter.formatCellValue(row.getCell(column)).trim();
    }

    private Integer integer(Row row, int column, DataFormatter formatter) {
        String value = value(row, column, formatter);
        if (value.isBlank()) return null;
        try { return (int) Math.round(Double.parseDouble(value.replace(',', '.'))); }
        catch (NumberFormatException exception) { return null; }
    }

    private String normalize(String value) {
        return value == null ? "" : value.strip().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
