package com.lifedashboard.game;

import com.lifedashboard.common.error.*;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import com.lifedashboard.game.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class GameLibraryService {
    private final GamingPlatformRepository platforms;
    private final GameSourceRepository sources;
    private final UserGameRepository games;
    private final ContentItemRepository contentItems;
    private final UserContentRepository userContent;
    private final ContentService contentService;
    private final long userId;

    public GameLibraryService(GamingPlatformRepository platforms, GameSourceRepository sources,
            UserGameRepository games, ContentItemRepository contentItems, UserContentRepository userContent,
            ContentService contentService, @Value("${app.default-user-id}") long userId) {
        this.platforms = platforms; this.sources = sources; this.games = games; this.contentItems = contentItems;
        this.userContent = userContent; this.contentService = contentService; this.userId = userId;
    }

    public List<ReferenceResponse> platforms() {
        return platforms.findAllByOrderByNameAsc().stream()
                .map(p -> new ReferenceResponse(p.getId(), p.getCode(), p.getName(), null)).toList();
    }
    public List<ReferenceResponse> sources() {
        return sources.findAllByOrderByNameAsc().stream()
                .map(s -> new ReferenceResponse(s.getId(), s.getCode(), s.getName(), s.getSourceType().name())).toList();
    }
    @Transactional
    public GameLibraryResponse create(Long contentId, GameLibraryRequest request) {
        ContentItem item = findContent(contentId);
        validateGame(item); validateRequest(request);
        contentService.putInLibrary(contentId, libraryRequest(request));
        UserGame game = new UserGame(userContent.findByUserIdAndContentId(userId, contentId).orElseThrow());
        apply(game, request);
        return response(games.save(game));
    }
    public List<GameLibraryResponse> getAll(UserContentStatus status, Long platformId) {
        return games.findLibrary(userId, status, platformId).stream().map(this::response).toList();
    }
    public GameLibraryResponse get(Long id) { return response(findGame(id)); }
    @Transactional
    public GameLibraryResponse update(Long id, GameLibraryRequest request) {
        validateRequest(request);
        UserGame game = findGame(id);
        contentService.putInLibrary(game.getUserContent().getContent().getId(), libraryRequest(request));
        apply(game, request);
        return response(game);
    }
    @Transactional public void delete(Long id) { games.delete(findGame(id)); }

    private void apply(UserGame game, GameLibraryRequest r) {
        GamingPlatform platform = platforms.findById(r.platformId())
                .orElseThrow(() -> new ResourceNotFoundException("Gaming platform was not found"));
        GameSource source = sources.findById(r.sourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Game source was not found"));
        if ((r.accessType() == GameAccessType.SUBSCRIPTION) != (source.getSourceType() == GameSourceType.SUBSCRIPTION))
            throw new InvalidRequestException("accessType must match the selected source type");
        game.update(platform, source, r.accessType(), normalize(r.edition()), r.acquiredAt(), normalize(r.note()));
    }
    private void validateRequest(GameLibraryRequest r) {
        if (r.completedAt() != null && r.startedAt() != null && r.completedAt().isBefore(r.startedAt()))
            throw new InvalidRequestException("completedAt must not be before startedAt");
    }
    private void validateGame(ContentItem item) {
        if (item.getItemType() != ContentType.GAME)
            throw new InvalidRequestException("Only content with itemType GAME can be added to the game library");
    }
    private ContentItem findContent(Long id) { return contentItems.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Content with id " + id + " was not found")); }
    private UserGame findGame(Long id) { return games.findByIdAndUserContentUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Game library entry with id " + id + " was not found")); }
    private LibraryEntryRequest libraryRequest(GameLibraryRequest r) { return new LibraryEntryRequest(r.status(),
            r.rating(), r.favorite(), r.startedAt(), r.completedAt(), r.personalNote()); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private GameLibraryResponse response(UserGame g) {
        UserContent u = g.getUserContent();
        return new GameLibraryResponse(g.getId(), u.getContent().getId(), u.getContent().getTitle(),
                new ReferenceResponse(g.getPlatform().getId(), g.getPlatform().getCode(), g.getPlatform().getName(), null),
                new ReferenceResponse(g.getSource().getId(), g.getSource().getCode(), g.getSource().getName(), g.getSource().getSourceType().name()),
                g.getAccessType(), g.getEdition(), g.getAcquiredAt(), g.getNote(), u.getStatus(), u.getRating(),
                u.isFavorite(), u.getStartedAt(), u.getCompletedAt(), u.getPersonalNote());
    }
}
