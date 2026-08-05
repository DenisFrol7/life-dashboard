package com.lifedashboard.content;

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
    private final long defaultUserId;

    public ContentService(ContentItemRepository contentRepository, UserContentRepository libraryRepository,
                          UserRepository userRepository, @Value("${app.default-user-id}") long defaultUserId) {
        this.contentRepository = contentRepository; this.libraryRepository = libraryRepository;
        this.userRepository = userRepository; this.defaultUserId = defaultUserId;
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
        return items.stream().map(this::toResponse).toList();
    }
    public ContentItemResponse get(Long id) { return toResponse(findContent(id)); }
    @Transactional
    public ContentItemResponse update(Long id, ContentItemRequest request) {
        validateFormat(request); ContentItem item = findContent(id); apply(item, request); return toResponse(item);
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
        return toResponse(libraryRepository.save(entry));
    }
    public List<LibraryEntryResponse> getLibrary(UserContentStatus status) {
        List<UserContent> entries = status == null ? libraryRepository.findAllByUserIdOrderByIdDesc(defaultUserId)
                : libraryRepository.findAllByUserIdAndStatusOrderByIdDesc(defaultUserId, status);
        return entries.stream().map(this::toResponse).toList();
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
            case GAME -> r.format() == null;
        };
        if (!valid) throw new InvalidRequestException("format is not valid for itemType " + r.itemType());
    }
    private void validateDates(LibraryEntryRequest r) {
        if (r.completedAt() != null && r.startedAt() != null && r.completedAt().isBefore(r.startedAt()))
            throw new InvalidRequestException("completedAt must not be before startedAt");
    }
    private void apply(ContentItem item, ContentItemRequest r) {
        item.update(r.title().trim(), normalize(r.originalTitle()), r.itemType(), r.format(), r.releaseYear(),
                normalize(r.description()), normalize(r.coverUrl()), r.durationMinutes(), r.releaseStatus());
    }
    private ContentItem findContent(Long id) { return contentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Content with id " + id + " was not found")); }
    private User findUser() { return userRepository.findById(defaultUserId)
            .orElseThrow(() -> new ResourceNotFoundException("Default user with id " + defaultUserId + " was not found")); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private ContentItemResponse toResponse(ContentItem i) { return new ContentItemResponse(i.getId(), i.getTitle(),
            i.getOriginalTitle(), i.getItemType(), i.getFormat(), i.getReleaseYear(), i.getDescription(),
            i.getCoverUrl(), i.getDurationMinutes(), i.getReleaseStatus()); }
    private LibraryEntryResponse toResponse(UserContent e) { return new LibraryEntryResponse(e.getId(),
            toResponse(e.getContent()), e.getStatus(), e.getRating(), e.isFavorite(), e.getStartedAt(),
            e.getCompletedAt(), e.getPersonalNote()); }
}
