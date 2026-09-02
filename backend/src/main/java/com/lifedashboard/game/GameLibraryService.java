package com.lifedashboard.game;

import org.jspecify.annotations.NonNull;
import com.lifedashboard.common.error.*;
import com.lifedashboard.content.*;
import com.lifedashboard.content.dto.LibraryEntryRequest;
import com.lifedashboard.content.dto.LibraryEntryResponse;
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
    private final GamePlaythroughRepository playthroughs;
    private final GameSessionRepository sessions;
    private final long userId;

    public GameLibraryService(GamingPlatformRepository platforms, GameSourceRepository sources,
            UserGameRepository games, ContentItemRepository contentItems, UserContentRepository userContent,
            ContentService contentService, GamePlaythroughRepository playthroughs, GameSessionRepository sessions,
            @Value("${app.default-user-id}") long userId) {
        this.platforms = platforms; this.sources = sources; this.games = games; this.contentItems = contentItems;
        this.userContent = userContent; this.contentService = contentService; this.playthroughs = playthroughs;
        this.sessions = sessions; this.userId = userId;
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
        validateGame(item);
        if (userContent.findByUserIdAndContentId(userId, contentId).isEmpty())
            contentService.putInLibrary(contentId, new LibraryEntryRequest(UserContentStatus.NOT_STARTED,
                    null, false, null, null, null));
        UserGame game = new UserGame(userContent.findByUserIdAndContentId(userId, contentId).orElseThrow());
        apply(game, request);
        games.save(game);
        syncCopyCompletion(game, request, null);
        return response(game);
    }
    public List<GameLibraryResponse> getAll(UserContentStatus status, Long platformId) {
        return games.findLibrary(userId, status, platformId).stream()
                .map((@NonNull UserGame game) -> response(game)).toList();
    }
    public GameLibraryResponse get(Long id) { return response(findGame(id)); }
    @Transactional
    public GameLibraryResponse update(Long id, GameLibraryRequest request) {
        UserGame game = findGame(id);
        UserContentStatus previousStatus = game.getStatus();
        apply(game, request);
        syncCopyCompletion(game, request, previousStatus);
        return response(game);
    }
    @Transactional public void delete(Long id) { games.delete(findGame(id)); }

    @Transactional
    public LibraryEntryResponse updateProfile(Long contentId, LibraryEntryRequest request) {
        ContentItem item = findContent(contentId);
        validateGame(item);
        return contentService.putInLibrary(contentId, request);
    }

    private void apply(UserGame game, GameLibraryRequest r) {
        if (r.completedAt() != null && r.startedAt() != null && r.completedAt().isBefore(r.startedAt()))
            throw new InvalidRequestException("Дата завершения не может быть раньше даты начала");
        GamingPlatform platform = platforms.findById(r.platformId())
                .orElseThrow(() -> new ResourceNotFoundException("Игровая платформа не найдена"));
        GameSource source = sources.findById(r.sourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Источник игры не найден"));
        if ((r.accessType() == GameAccessType.SUBSCRIPTION) != (source.getSourceType() == GameSourceType.SUBSCRIPTION))
            throw new InvalidRequestException("Тип доступа должен соответствовать выбранному источнику игры");
        game.update(platform, source, r.accessType(), normalize(r.edition()), r.acquiredAt(), normalize(r.note()),
                r.legacyPlaytimeMinutes(), r.status(), r.startedAt(), r.completedAt());
    }
    private void validateGame(ContentItem item) {
        if (item.getItemType() != ContentType.GAME)
            throw new InvalidRequestException("В игровую библиотеку можно добавлять только материалы типа «Игра»");
    }
    private ContentItem findContent(Long id) { return contentItems.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Материал с идентификатором " + id + " не найден")); }
    private UserGame findGame(Long id) { return games.findByIdAndUserContentUserId(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Копия игры с идентификатором " + id + " не найдена")); }
    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private void syncCopyCompletion(UserGame game, GameLibraryRequest request, UserContentStatus previousStatus) {
        if (request.status() != UserContentStatus.COMPLETED || request.completedAt() == null) return;
        int currentNumber = playthroughs.maxNumber(game.getId());
        if (previousStatus == UserContentStatus.COMPLETED && currentNumber > 0) {
            playthroughs.findByLibraryEntryIdAndPlaythroughNumber(game.getId(), currentNumber).ifPresent(item -> {
                item.updateCompletedAt(request.completedAt());
                if (item.getPlaytimeMinutes() == 0 && game.getLegacyPlaytimeMinutes() > 0)
                    item.updatePlaytimeMinutes(game.getLegacyPlaytimeMinutes());
            });
            return;
        }
        int number = currentNumber + 1;
        playthroughs.save(new GamePlaythrough(game, number, request.completedAt(),
                game.getLegacyPlaytimeMinutes() + sessions.totalMinutes(game.getId(), userId), null));
    }
    private GameLibraryResponse response(UserGame g) {
        UserContent u = g.getUserContent();
        return new GameLibraryResponse(g.getId(), u.getContent().getId(), u.getContent().getTitle(),
                new ReferenceResponse(g.getPlatform().getId(), g.getPlatform().getCode(), g.getPlatform().getName(), null),
                new ReferenceResponse(g.getSource().getId(), g.getSource().getCode(), g.getSource().getName(), g.getSource().getSourceType().name()),
                g.getAccessType(), g.getEdition(), g.getAcquiredAt(), g.getNote(), g.getStatus(), u.getRating(),
                u.isFavorite(), g.getStartedAt(), g.getCompletedAt(), u.getPersonalNote(),
                g.getLegacyPlaytimeMinutes());
    }
}
