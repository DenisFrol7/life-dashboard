package com.lifedashboard.game.rawg;

import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.common.error.ResourceNotFoundException;
import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentType;
import com.lifedashboard.content.ReleaseStatus;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.dto.ContentItemResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@Transactional(readOnly = true)
public class RawgCatalogService {
    private final RawgClient rawg;
    private final ContentItemRepository items;
    private final ConcurrentMap<Long, RawgClient.GameData> previewCache = new ConcurrentHashMap<>();

    public RawgCatalogService(RawgClient rawg, ContentItemRepository items) {
        this.rawg = rawg;
        this.items = items;
    }

    public List<RawgGameCandidate> search(String query) {
        String value = query == null ? "" : query.trim();
        if (value.length() < 2)
            throw new InvalidRequestException("Запрос для поиска игры должен содержать не менее 2 символов");
        return rawg.search(value).stream().map(data -> new RawgGameCandidate(data.rawgId(), data.slug(),
                data.title(), data.releaseDate(), data.backgroundUrl(), data.platforms(), existing(data))).toList();
    }

    public RawgGameDetails preview(long rawgId) {
        RawgClient.GameData data = rawg.getGame(rawgId);
        previewCache.put(rawgId, data);
        return details(data, existing(data));
    }

    @Transactional
    public ContentItemResponse create(long rawgId, ContentItemRequest request) {
        validateGame(request);
        items.findByRawgId(rawgId).ifPresent(existing -> {
            throw new DuplicateResourceException("Игра RAWG уже есть в каталоге с идентификатором "
                    + existing.getId());
        });
        RawgClient.GameData data = cachedOrLoad(rawgId);
        ContentItem item = new ContentItem(request.title().trim());
        apply(item, request, data);
        item.linkRawg(rawgId, data.slug());
        return response(items.save(item));
    }

    @Transactional
    public ContentItemResponse update(long contentId, long rawgId, ContentItemRequest request) {
        validateGame(request);
        ContentItem item = items.findById(contentId)
                .orElseThrow(() -> new ResourceNotFoundException("Игра не найдена"));
        if (item.getItemType() != ContentType.GAME)
            throw new InvalidRequestException("Связать с RAWG можно только игру");
        items.findByRawgId(rawgId).filter(existing -> !existing.getId().equals(contentId)).ifPresent(existing -> {
            throw new DuplicateResourceException("Игра RAWG уже связана с другой записью каталога");
        });
        RawgClient.GameData data = cachedOrLoad(rawgId);
        apply(item, request, data);
        item.linkRawg(rawgId, data.slug());
        return response(item);
    }

    private RawgClient.GameData cachedOrLoad(long rawgId) {
        return Optional.ofNullable(previewCache.remove(rawgId)).orElseGet(() -> rawg.getGame(rawgId));
    }

    private void validateGame(ContentItemRequest request) {
        if (request.itemType() != ContentType.GAME || request.format() != null)
            throw new InvalidRequestException("Выбранная запись RAWG должна быть игрой");
    }

    private void apply(ContentItem item, ContentItemRequest request, RawgClient.GameData data) {
        item.update(request.title().trim(), normalize(request.originalTitle()), ContentType.GAME, null,
                request.releaseYear(), normalize(request.description()), normalize(request.coverUrl()), null,
                request.releaseStatus(), normalize(request.genre()), normalize(request.developer()),
                request.releaseDate(), Boolean.TRUE.equals(request.xboxPlayAnywhere()));
        String backgroundUrl = normalize(request.backgroundUrl());
        item.updateGameArtwork(backgroundUrl == null ? data.backgroundUrl() : backgroundUrl,
                request.steamGridDbGameId(),
                request.steamGridDbGridId());
    }

    private Long existing(RawgClient.GameData data) {
        return items.findByRawgId(data.rawgId()).or(() -> findLegacy(data)).map(ContentItem::getId).orElse(null);
    }

    private Optional<ContentItem> findLegacy(RawgClient.GameData data) {
        Integer year = data.releaseDate() == null ? null : data.releaseDate().getYear();
        String title = key(data.title());
        String originalTitle = key(data.originalTitle());
        return items.findAllByItemTypeOrderByTitleAsc(ContentType.GAME).stream()
                .filter(item -> item.getRawgId() == null)
                .filter(item -> year == null || item.getReleaseYear() == null || year.equals(item.getReleaseYear()))
                .filter(item -> title.equals(key(item.getTitle())) || title.equals(key(item.getOriginalTitle()))
                        || (!originalTitle.isEmpty() && (originalTitle.equals(key(item.getTitle()))
                        || originalTitle.equals(key(item.getOriginalTitle())))))
                .findFirst();
    }

    private RawgGameDetails details(RawgClient.GameData data, Long existingContentId) {
        LocalDate releaseDate = data.releaseDate();
        ReleaseStatus status = data.tba() || (releaseDate != null && releaseDate.isAfter(LocalDate.now()))
                ? ReleaseStatus.ANNOUNCED : ReleaseStatus.RELEASED;
        return new RawgGameDetails(data.rawgId(), data.slug(), "https://rawg.io/games/" + data.slug(),
                data.title(), data.originalTitle(), releaseDate == null ? null : releaseDate.getYear(),
                releaseDate, data.description(), data.backgroundUrl(), data.genre(), data.developer(), status,
                data.platforms(), existingContentId);
    }

    private ContentItemResponse response(ContentItem item) {
        return new ContentItemResponse(item.getId(), item.getTitle(), item.getOriginalTitle(), item.getItemType(),
                item.getFormat(), item.getReleaseYear(), item.getDescription(), item.getCoverUrl(),
                item.getDurationMinutes(), item.getReleaseStatus(), item.getGenre(), item.getDeveloper(),
                item.getReleaseDate(), item.isXboxPlayAnywhere(), item.getRawgId(), item.getRawgSlug(),
                item.getBackgroundUrl(), item.getSteamGridDbGameId(), item.getSteamGridDbGridId());
    }

    private String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String key(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }
}
