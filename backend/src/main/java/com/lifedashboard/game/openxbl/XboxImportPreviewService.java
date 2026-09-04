package com.lifedashboard.game.openxbl;

import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentType;
import com.lifedashboard.game.UserGame;
import com.lifedashboard.game.UserGameRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@Transactional(readOnly = true)
public class XboxImportPreviewService {
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern EDITION_SUFFIX = Pattern.compile(
            "\\b(game of the year|goty|definitive|ultimate|complete|deluxe|enhanced|remastered|directors cut|director s cut) edition\\b|\\b(remastered|definitive edition|directors cut|director s cut)\\b");

    private final OpenXblClient openXbl;
    private final ContentItemRepository contentItems;
    private final UserGameRepository library;
    private final long userId;

    public XboxImportPreviewService(OpenXblClient openXbl,
            ContentItemRepository contentItems, UserGameRepository library,
            @Value("${app.default-user-id}") long userId) {
        this.openXbl = openXbl;
        this.contentItems = contentItems;
        this.library = library;
        this.userId = userId;
    }

    public XboxImportPreview preview() {
        OpenXblTitleHistory source = openXbl.titleHistory();
        List<ContentItem> catalog = contentItems.findAllByItemTypeOrderByTitleAsc(ContentType.GAME);
        List<UserGame> copies = library.findLibrary(userId, null, null);
        Map<Long, UserGame> copiesByXboxTitle = new HashMap<>();
        Map<Long, List<UserGame>> copiesByContent = new HashMap<>();
        for (UserGame copy : copies) {
            Long contentId = copy.getUserContent().getContent().getId();
            copiesByContent.computeIfAbsent(contentId, ignored -> new ArrayList<>()).add(copy);
            if (copy.getXboxTitleId() != null) copiesByXboxTitle.put(copy.getXboxTitleId(), copy);
        }
        Map<String, List<ContentItem>> exactTitles = exactTitles(catalog);
        List<XboxImportPreviewItem> rows = source.titles().stream()
                .filter(title -> platformCode(title) != null)
                .map(title -> match(title, catalog, exactTitles, copiesByContent, copiesByXboxTitle))
                .sorted(Comparator.comparing(XboxImportPreviewItem::match)
                        .thenComparing(XboxImportPreviewItem::title, String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new XboxImportPreview(rows.size(),
                count(rows, XboxImportMatch.ALREADY_IMPORTED),
                count(rows, XboxImportMatch.MATCHED),
                count(rows, XboxImportMatch.REVIEW),
                count(rows, XboxImportMatch.NEW), rows);
    }

    private XboxImportPreviewItem match(OpenXblTitle game, List<ContentItem> catalog,
            Map<String, List<ContentItem>> exactTitles,
            Map<Long, List<UserGame>> copiesByContent,
            Map<Long, UserGame> copiesByXboxTitle) {
        UserGame linked = copiesByXboxTitle.get(game.titleId());
        if (linked != null) return row(game, XboxImportMatch.ALREADY_IMPORTED,
                linked.getUserContent().getContent(), linked.getId(),
                linked.getPlatform().getCode());

        String platformCode = platformCode(game);
        List<ContentItem> exact = exactTitles.getOrDefault(normalize(game.name()), List.of());
        if (exact.size() == 1) {
            ContentItem item = exact.getFirst();
            UserGame xboxCopy = copiesByContent.getOrDefault(item.getId(), List.of()).stream()
                    .filter(copy -> platformCode.equals(copy.getPlatform().getCode()))
                    .findFirst().orElse(null);
            return row(game, xboxCopy == null ? XboxImportMatch.MATCHED : XboxImportMatch.ALREADY_IMPORTED,
                    item, xboxCopy == null ? null : xboxCopy.getId(), platformCode);
        }
        if (exact.size() > 1) return row(game, XboxImportMatch.REVIEW,
                exact.getFirst(), null, platformCode);

        ContentItem suggestion = null;
        double bestScore = 0;
        for (ContentItem item : catalog) {
            double score = Math.max(similarity(game.name(), item.getTitle()),
                    similarity(game.name(), item.getOriginalTitle()));
            if (score > bestScore) {
                bestScore = score;
                suggestion = item;
            }
        }
        return bestScore >= 0.90
                ? row(game, XboxImportMatch.REVIEW, suggestion, null, platformCode)
                : row(game, XboxImportMatch.NEW, null, null, platformCode);
    }

    private XboxImportPreviewItem row(OpenXblTitle game, XboxImportMatch match,
            ContentItem item, Long libraryEntryId, String platformCode) {
        return new XboxImportPreviewItem(game.titleId(), game.name(), platformCode,
                game.lastPlayedAt(), game.imageUrl(), game.currentAchievements(),
                game.totalAchievements(), game.currentGamerscore(), game.totalGamerscore(),
                game.gamePass() ? "GAME_PASS" : "XBOX_STORE", match,
                item == null ? null : item.getId(), item == null ? null : item.getTitle(),
                libraryEntryId);
    }

    private String platformCode(OpenXblTitle title) {
        String mediaType = title.mediaItemType() == null
                ? "" : title.mediaItemType().toLowerCase(Locale.ROOT);
        if (mediaType.contains("360") || mediaType.contains("arcade")) return "XBOX_360";
        if (mediaType.contains("original")) return "ORIGINAL_XBOX";
        if (hasDevice(title, "XboxSeries")) return "XBOX_SERIES";
        if (hasDevice(title, "XboxOne")) return "XBOX_ONE";
        if (hasDevice(title, "Xbox360")) return "XBOX_360";
        return null;
    }

    private boolean hasDevice(OpenXblTitle title, String expected) {
        return title.devices().stream().anyMatch(device -> device.equalsIgnoreCase(expected));
    }

    private Map<String, List<ContentItem>> exactTitles(List<ContentItem> catalog) {
        Map<String, LinkedHashSet<ContentItem>> values = new HashMap<>();
        for (ContentItem item : catalog) {
            addTitle(values, item.getTitle(), item);
            addTitle(values, item.getOriginalTitle(), item);
        }
        Map<String, List<ContentItem>> result = new HashMap<>();
        values.forEach((title, items) -> result.put(title, List.copyOf(items)));
        return result;
    }

    private void addTitle(Map<String, LinkedHashSet<ContentItem>> values,
            String title, ContentItem item) {
        String normalized = normalize(title);
        if (!normalized.isBlank()) {
            values.computeIfAbsent(normalized, ignored -> new LinkedHashSet<>()).add(item);
        }
    }

    private double similarity(String left, String right) {
        if (right == null || right.isBlank()) return 0;
        String normalizedLeft = normalize(left);
        String normalizedRight = normalize(right);
        if (normalizedLeft.equals(normalizedRight)) return 1;
        String baseLeft = EDITION_SUFFIX.matcher(normalizedLeft).replaceAll("").trim();
        String baseRight = EDITION_SUFFIX.matcher(normalizedRight).replaceAll("").trim();
        if (!baseLeft.isBlank() && baseLeft.equals(baseRight)) return 0.95;
        Set<String> leftTokens = new HashSet<>(List.of(normalizedLeft.split(" ")));
        Set<String> rightTokens = new HashSet<>(List.of(normalizedRight.split(" ")));
        if (leftTokens.isEmpty() || rightTokens.isEmpty()) return 0;
        Set<String> intersection = new HashSet<>(leftTokens);
        intersection.retainAll(rightTokens);
        return intersection.size() * 2.0 / (leftTokens.size() + rightTokens.size());
    }

    private String normalize(String value) {
        if (value == null) return "";
        String normalized = Normalizer.normalize(value.replace("™", "").replace("®", ""),
                        Normalizer.Form.NFKD)
                .toLowerCase(Locale.ROOT).replace("&", " and ");
        normalized = DIACRITICS.matcher(normalized).replaceAll("");
        return NON_ALPHANUMERIC.matcher(normalized).replaceAll(" ")
                .trim().replaceAll("\\s+", " ");
    }

    private int count(List<XboxImportPreviewItem> rows, XboxImportMatch match) {
        return (int) rows.stream().filter(item -> item.match() == match).count();
    }
}
