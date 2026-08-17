package com.lifedashboard.content;

import com.lifedashboard.common.error.*;
import com.lifedashboard.content.dto.*;
import com.lifedashboard.user.*;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class ViewingService {
    private final ContentItemRepository items;
    private final ContentSeasonRepository seasons;
    private final ContentEpisodeRepository episodes;
    private final EpisodeWatchRepository episodeWatches;
    private final MovieWatchRepository movieWatches;
    private final SeasonCompletionRepository seasonCompletions;
    private final UserContentRepository library;
    private final UserRepository users;
    private final long userId;

    public ViewingService(ContentItemRepository items, ContentSeasonRepository seasons,
            ContentEpisodeRepository episodes, EpisodeWatchRepository episodeWatches,
            MovieWatchRepository movieWatches, SeasonCompletionRepository seasonCompletions,
            UserContentRepository library, UserRepository users,
            @Value("${app.default-user-id}") long userId) {
        this.items = items; this.seasons = seasons; this.episodes = episodes;
        this.episodeWatches = episodeWatches; this.movieWatches = movieWatches;
        this.seasonCompletions = seasonCompletions; this.library = library;
        this.users = users; this.userId = userId;
    }

    @Transactional
    public SeasonResponse createSeason(Long contentId, SeasonRequest request) {
        ContentItem content = item(contentId); requireSeries(content);
        if (seasons.existsByContentIdAndSeasonNumber(contentId, request.seasonNumber()))
            throw new DuplicateResourceException("Season number already exists");
        ContentSeason season = new ContentSeason(content);
        season.update(request.seasonNumber(), norm(request.title()), request.releaseYear());
        return response(seasons.save(season));
    }

    public List<SeasonResponse> seasons(Long id) {
        item(id); return seasons.findAllByContentIdOrderBySeasonNumber(id).stream()
                .map((@NonNull ContentSeason season) -> response(season)).toList();
    }

    @Transactional
    public SeasonResponse updateSeason(Long id, SeasonRequest request) {
        ContentSeason season = season(id); Long contentId = season.getContent().getId();
        if (seasons.existsByContentIdAndSeasonNumberAndIdNot(contentId, request.seasonNumber(), id))
            throw new DuplicateResourceException("Season number already exists");
        season.update(request.seasonNumber(), norm(request.title()), request.releaseYear());
        return response(season);
    }

    @Transactional
    public void deleteSeason(Long id) {
        ContentSeason season = season(id); ContentItem content = season.getContent();
        seasons.delete(season); seasons.flush(); refreshIfInLibrary(content);
    }

    @Transactional
    public EpisodeResponse createEpisode(Long seasonId, EpisodeRequest request) {
        ContentSeason season = season(seasonId);
        if (episodes.existsBySeasonIdAndEpisodeNumber(seasonId, request.episodeNumber()))
            throw new DuplicateResourceException("Episode number already exists");
        ContentEpisode episode = new ContentEpisode(season);
        episode.update(request.episodeNumber(), request.title().trim(), request.durationMinutes(), request.releaseDate());
        seasonCompletions.deleteByUserIdAndSeasonId(userId, seasonId);
        moveCompletedLibraryToProgress(season.getContent());
        return response(episodes.save(episode));
    }

    @Transactional
    public List<EpisodeResponse> createEpisodes(Long seasonId, BulkEpisodeRequest request) {
        ContentSeason season = season(seasonId);
        int next = episodes.findAllBySeasonIdOrderByEpisodeNumber(seasonId).stream()
                .mapToInt((@NonNull ContentEpisode episode) -> episode.getEpisodeNumber()).max().orElse(0) + 1;
        List<ContentEpisode> created = new ArrayList<>();
        for (int index = 0; index < request.count(); index++) {
            ContentEpisode episode = new ContentEpisode(season); int number = next + index;
            episode.update(number, "Эпизод " + number, request.durationMinutes(), null);
            created.add(episodes.save(episode));
        }
        if (Boolean.TRUE.equals(request.markWatched())) {
            User user = user(); Instant internalAt = request.watchedAt() == null ? Instant.now() : request.watchedAt();
            ensureLibrary(season.getContent(), user, internalAt);
            for (ContentEpisode episode : created)
                episodeWatches.save(new EpisodeWatch(user, episode, internalAt, 1, true));
            episodeWatches.flush(); saveCompletionIfFullyWatched(season, request.watchedAt()); refresh(season.getContent());
        } else {
            seasonCompletions.deleteByUserIdAndSeasonId(userId, seasonId);
            moveCompletedLibraryToProgress(season.getContent());
        }
        return created.stream().map((@NonNull ContentEpisode episode) -> response(episode)).toList();
    }

    public List<EpisodeResponse> episodes(Long id) {
        season(id); return episodes.findAllBySeasonIdOrderByEpisodeNumber(id).stream()
                .map((@NonNull ContentEpisode episode) -> response(episode)).toList();
    }

    @Transactional
    public EpisodeResponse updateEpisode(Long id, EpisodeRequest request) {
        ContentEpisode episode = episode(id); Long seasonId = episode.getSeason().getId();
        if (episodes.existsBySeasonIdAndEpisodeNumberAndIdNot(seasonId, request.episodeNumber(), id))
            throw new DuplicateResourceException("Episode number already exists");
        episode.update(request.episodeNumber(), request.title().trim(), request.durationMinutes(), request.releaseDate());
        return response(episode);
    }

    @Transactional
    public void deleteEpisode(Long id) {
        ContentEpisode episode = episode(id); ContentSeason season = episode.getSeason();
        ContentItem content = season.getContent(); episodes.delete(episode); episodes.flush();
        syncCompletion(season, null); refreshIfInLibrary(content);
    }

    @Transactional
    public void watchSeason(Long id, WatchRequest request) {
        ContentSeason season = season(id);
        List<ContentEpisode> seasonEpisodes = episodes.findAllBySeasonIdOrderByEpisodeNumber(id);
        if (seasonEpisodes.isEmpty()) throw new InvalidRequestException("Season has no episodes");
        Instant completedAt = request == null ? null : request.watchedAt();
        Instant internalAt = completedAt == null ? Instant.now() : completedAt; User user = user();
        ensureLibrary(season.getContent(), user, internalAt);
        for (ContentEpisode episode : seasonEpisodes)
            if (episodeWatches.countByEpisodeIdAndUserId(episode.getId(), userId) == 0)
                episodeWatches.save(new EpisodeWatch(user, episode, internalAt, 1, true));
        saveCompletion(season, completedAt, seasonEpisodes.size()); refresh(season.getContent());
    }

    @Transactional
    public void clearSeasonWatches(Long id) {
        ContentSeason season = season(id); episodeWatches.deleteAllByUserAndSeason(userId, id);
        seasonCompletions.deleteByUserIdAndSeasonId(userId, id); episodeWatches.flush();
        refreshIfInLibrary(season.getContent());
    }

    public SeasonCompletionResponse seasonCompletion(Long id) {
        season(id);
        return seasonCompletions.findByUserIdAndSeasonId(userId, id)
                .map((@NonNull SeasonCompletion completion) -> response(completion)).orElse(null);
    }

    @Transactional
    public WatchResponse watchEpisode(Long id, WatchRequest request) {
        ContentEpisode episode = episode(id); User user = user(); ensureLibrary(episode.getSeason().getContent(), user);
        EpisodeWatch watch = episodeWatches.save(new EpisodeWatch(user, episode, time(request),
                episodeWatches.maxNumber(id, userId) + 1));
        refresh(episode.getSeason().getContent()); return response(watch);
    }

    public List<WatchResponse> episodeHistory(Long id) {
        episode(id); return episodeWatches.findAllByEpisodeIdAndUserIdOrderByWatchNumber(id, userId).stream()
                .map((@NonNull EpisodeWatch watch) -> response(watch)).toList();
    }

    @Transactional
    public WatchResponse watchMovie(Long id, WatchRequest request) {
        ContentItem content = item(id);
        if (content.getItemType() != ContentType.MOVIE) throw new InvalidRequestException("Movie watch history is only available for MOVIE");
        User user = user(); Instant watchedAt = time(request); UserContent entry = ensureLibrary(content, user, watchedAt);
        MovieWatch watch = movieWatches.save(new MovieWatch(user, content, watchedAt, movieWatches.maxNumber(id, userId) + 1));
        entry.changeStatus(UserContentStatus.COMPLETED, watch.getWatchedAt());
        return new WatchResponse(watch.getId(), id, watch.getWatchedAt(), watch.getWatchNumber());
    }

    public List<WatchResponse> movieHistory(Long id) {
        item(id); return movieWatches.findAllByContentIdAndUserIdOrderByWatchNumber(id, userId).stream()
                .map((@NonNull MovieWatch watch) -> movieResponse(watch)).toList();
    }

    @Transactional public WatchResponse updateMovieWatch(Long id, WatchRequest request) { MovieWatch watch = movieWatch(id); watch.changeWatchedAt(time(request)); return movieResponse(watch); }
    @Transactional public void deleteMovieWatch(Long id) { movieWatches.delete(movieWatch(id)); }
    public Long contentIdForSeason(Long id) { return season(id).getContent().getId(); }
    public Long contentIdForEpisode(Long id) { return episode(id).getSeason().getContent().getId(); }

    private void refresh(ContentItem content) {
        long total = episodes.countByContent(content.getId()), watched = episodeWatches.watchedCount(userId, content.getId());
        UserContent entry = library.findByUserIdAndContentId(userId, content.getId()).orElseThrow();
        if (total > 0 && watched == total) {
            if (content.getReleaseStatus() == ReleaseStatus.ONGOING || content.getReleaseStatus() == ReleaseStatus.ANNOUNCED)
                entry.changeStatus(UserContentStatus.PAUSED, null);
            else entry.changeStatus(UserContentStatus.COMPLETED, completionDate(content));
        } else entry.changeStatus(UserContentStatus.IN_PROGRESS, null);
    }

    private void refreshIfInLibrary(ContentItem content) { if (library.findByUserIdAndContentId(userId, content.getId()).isPresent()) refresh(content); }
    private Instant completionDate(ContentItem content) {
        if (episodeWatches.individualWatchCount(userId, content.getId()) > 0) return Instant.now();
        return seasonCompletions.findAllByUserIdAndSeasonContentId(userId, content.getId()).stream()
                .map((@NonNull SeasonCompletion completion) -> completion.getCompletedAt())
                .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
    }
    private void moveCompletedLibraryToProgress(ContentItem content) { library.findAllByContentId(content.getId()).stream()
            .filter((@NonNull UserContent entry) -> entry.getStatus() == UserContentStatus.PAUSED || entry.getStatus() == UserContentStatus.COMPLETED)
            .forEach((@NonNull UserContent entry) -> entry.changeStatus(UserContentStatus.IN_PROGRESS, null)); }
    private void syncCompletion(ContentSeason season, Instant completedAt) {
        Optional<SeasonCompletion> existing = seasonCompletions.findByUserIdAndSeasonId(userId, season.getId());
        if (existing.isEmpty()) return;
        int total = episodes.findAllBySeasonIdOrderByEpisodeNumber(season.getId()).size();
        long watched = episodeWatches.watchedCountBySeason(userId, season.getId());
        if (total == 0 || watched < total) seasonCompletions.delete(existing.get());
        else saveCompletion(season, completedAt == null ? existing.get().getCompletedAt() : completedAt, total);
    }
    private void saveCompletionIfFullyWatched(ContentSeason season, Instant completedAt) {
        int total = episodes.findAllBySeasonIdOrderByEpisodeNumber(season.getId()).size();
        if (total > 0 && episodeWatches.watchedCountBySeason(userId, season.getId()) == total)
            saveCompletion(season, completedAt, total);
    }
    private void saveCompletion(ContentSeason season, Instant completedAt, int count) { SeasonCompletion completion = seasonCompletions.findByUserIdAndSeasonId(userId, season.getId()).orElseGet(() -> new SeasonCompletion(user(), season)); completion.update(completedAt, count); seasonCompletions.save(completion); }
    private UserContent ensureLibrary(ContentItem content, User user) { return ensureLibrary(content, user, Instant.now()); }
    private UserContent ensureLibrary(ContentItem content, User user, Instant startedAt) { return library.findByUserIdAndContentId(userId, content.getId()).orElseGet(() -> { UserContent entry = new UserContent(user, content); entry.update(UserContentStatus.IN_PROGRESS, null, false, startedAt, null, null); return library.save(entry); }); }
    private void requireSeries(ContentItem content) { if (content.getItemType() != ContentType.SERIES && content.getItemType() != ContentType.ANIME) throw new InvalidRequestException("Seasons are only available for SERIES and ANIME"); }
    private ContentItem item(Long id) { return items.findById(id).orElseThrow(() -> new ResourceNotFoundException("Content with id " + id + " was not found")); }
    private ContentSeason season(Long id) { return seasons.findById(id).orElseThrow(() -> new ResourceNotFoundException("Season with id " + id + " was not found")); }
    private ContentEpisode episode(Long id) { return episodes.findById(id).orElseThrow(() -> new ResourceNotFoundException("Episode with id " + id + " was not found")); }
    private MovieWatch movieWatch(Long id) { return movieWatches.findByIdAndUserId(id, userId).orElseThrow(() -> new ResourceNotFoundException("Movie watch with id " + id + " was not found")); }
    private User user() { return users.findById(userId).orElseThrow(() -> new ResourceNotFoundException("Default user was not found")); }
    private Instant time(WatchRequest request) { return request == null || request.watchedAt() == null ? Instant.now() : request.watchedAt(); }
    private String norm(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private SeasonResponse response(ContentSeason season) { return new SeasonResponse(season.getId(), season.getContent().getId(), season.getSeasonNumber(), season.getTitle(), season.getReleaseYear()); }
    private EpisodeResponse response(ContentEpisode episode) { return new EpisodeResponse(episode.getId(), episode.getSeason().getId(), episode.getEpisodeNumber(), episode.getTitle(), episode.getDurationMinutes(), episode.getReleaseDate()); }
    private WatchResponse response(EpisodeWatch watch) { return new WatchResponse(watch.getId(), watch.getEpisode().getId(), watch.getWatchedAt(), watch.getWatchNumber(), watch.isBulk()); }
    private WatchResponse movieResponse(MovieWatch watch) { return new WatchResponse(watch.getId(), watch.getContent().getId(), watch.getWatchedAt(), watch.getWatchNumber()); }
    private SeasonCompletionResponse response(SeasonCompletion completion) { return new SeasonCompletionResponse(completion.getId(), completion.getSeason().getId(), completion.getCompletedAt(), completion.getEpisodeCount()); }
}
