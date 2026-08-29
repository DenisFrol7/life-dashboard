package com.lifedashboard.content;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.common.error.*;
import com.lifedashboard.content.dto.*;
import com.lifedashboard.user.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class ContentService {
    private final ContentItemRepository contentRepository;
    private final UserContentRepository libraryRepository;
    private final UserRepository userRepository;
    private final ContentEpisodeRepository episodeRepository;
    private final EpisodeWatchRepository episodeWatchRepository;
    private final long defaultUserId;

    public ContentService(ContentItemRepository contentRepository, UserContentRepository libraryRepository,
                          UserRepository userRepository, ContentEpisodeRepository episodeRepository,
                          EpisodeWatchRepository episodeWatchRepository,
                          @Value("${app.default-user-id}") long defaultUserId) {
        this.contentRepository = contentRepository; this.libraryRepository = libraryRepository;
        this.userRepository = userRepository; this.episodeRepository = episodeRepository;
        this.episodeWatchRepository = episodeWatchRepository; this.defaultUserId = defaultUserId;
    }

    @Transactional
    public ContentItemResponse create(ContentItemRequest request) {
        validateFormat(request);
        ContentItem item = new ContentItem(request.title().trim());
        apply(item, request);
        return toResponse(contentRepository.save(item));
    }
    public List<ContentItemResponse> getAll(ContentType type) {
        List<ContentItem> items = type == null ? contentRepository.findAllByOrderByTitleAsc()
                : contentRepository.findAllByItemTypeOrderByTitleAsc(type);
        return items.stream().map((@NonNull ContentItem item) -> toResponse(item)).toList();
    }
    public ContentItemResponse get(Long id) { return toResponse(findContent(id)); }
    @Transactional
    public ContentItemResponse update(Long id, ContentItemRequest request) {
        validateFormat(request); ContentItem item = findContent(id); apply(item, request);
        libraryRepository.findByUserIdAndContentId(defaultUserId, id)
                .ifPresent(entry -> reconcileFullyWatchedStatus(item, entry));
        return toResponse(item);
    }
    @Transactional
    public void delete(Long id) { contentRepository.delete(findContent(id)); }

    @Transactional
    public LibraryEntryResponse putInLibrary(Long contentId, LibraryEntryRequest request) {
        validateDates(request);
        UserContent entry = libraryRepository.findByUserIdAndContentId(defaultUserId, contentId)
                .orElseGet(() -> new UserContent(findUser(), findContent(contentId)));
        entry.update(request.status(), request.rating(), request.favorite(), request.startedAt(),
                request.completedAt(), normalize(request.personalNote()));
        reconcileFullyWatchedStatus(entry.getContent(), entry);
        return toResponse(libraryRepository.save(entry));
    }
    public List<LibraryEntryResponse> getLibrary(UserContentStatus status) {
        List<UserContent> entries = status == null ? libraryRepository.findAllByUserIdOrderByIdDesc(defaultUserId)
                : libraryRepository.findAllByUserIdAndStatusOrderByIdDesc(defaultUserId, status);
        return entries.stream().map((@NonNull UserContent entry) -> toResponse(entry)).toList();
    }
    @Transactional
    public void removeFromLibrary(Long contentId) {
        UserContent entry = libraryRepository.findByUserIdAndContentId(defaultUserId, contentId)
                .orElseThrow(() -> new ResourceNotFoundException("Content " + contentId + " is not in the library"));
        libraryRepository.delete(entry);
    }

    private void validateFormat(ContentItemRequest r) {
        boolean valid = switch (r.itemType()) {
            case MOVIE, SERIES -> r.format() == ContentFormat.LIVE_ACTION || r.format() == ContentFormat.ANIMATION;
            case ANIME -> r.format() == ContentFormat.ANIME;
            case GAME, BOOK -> r.format() == null;
        };
        if (!valid) throw new InvalidRequestException("format is not valid for itemType " + r.itemType());
    }
    private void validateDates(LibraryEntryRequest r) {
        if (r.completedAt() != null && r.startedAt() != null && r.completedAt().isBefore(r.startedAt()))
            throw new InvalidRequestException("completedAt must not be before startedAt");
    }
    private void apply(ContentItem item, ContentItemRequest r) {
        item.update(r.title().trim(), normalize(r.originalTitle()), r.itemType(), r.format(), r.releaseYear(),
                normalize(r.description()), normalize(r.coverUrl()), r.durationMinutes(), r.releaseStatus(),
                normalize(r.genre()), normalize(r.developer()), r.releaseDate(), Boolean.TRUE.equals(r.xboxPlayAnywhere()));
    }
    private void reconcileFullyWatchedStatus(ContentItem item, UserContent entry) {
        if (item.getItemType() != ContentType.SERIES && item.getItemType() != ContentType.ANIME) return;
        long total = episodeRepository.countByContent(item.getId());
        if (total == 0 || episodeWatchRepository.watchedCount(defaultUserId, item.getId()) != total) return;
        if (item.getReleaseStatus() == ReleaseStatus.ONGOING || item.getReleaseStatus() == ReleaseStatus.ANNOUNCED)
            entry.changeStatus(UserContentStatus.PAUSED, null);
        else entry.changeStatus(UserContentStatus.COMPLETED, entry.getCompletedAt());
    }
    private ContentItem findContent(Long id) { return contentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Content with id " + id + " was not found")); }
    private User findUser() { return userRepository.findById(defaultUserId)
            .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found")); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private ContentItemResponse toResponse(ContentItem i) { return new ContentItemResponse(i.getId(), i.getTitle(),
            i.getOriginalTitle(), i.getItemType(), i.getFormat(), i.getReleaseYear(), i.getDescription(),
            i.getCoverUrl(), i.getDurationMinutes(), i.getReleaseStatus(), i.getGenre(), i.getDeveloper(),
            i.getReleaseDate(), i.isXboxPlayAnywhere()); }
    private LibraryEntryResponse toResponse(UserContent e) { return new LibraryEntryResponse(e.getId(),
            toResponse(e.getContent()), e.getStatus(), e.getRating(), e.isFavorite(), e.getStartedAt(),
            e.getCompletedAt(), e.getPersonalNote()); }
}
