package com.lifedashboard.game.steam;

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
public class SteamImportPreviewService {
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^\\p{L}\\p{N}]+");
    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern EDITION_SUFFIX = Pattern.compile(
            "\\b(game of the year|goty|definitive|ultimate|complete|deluxe|enhanced|remastered|directors cut|director s cut) edition\\b|\\b(remastered|definitive edition|directors cut|director s cut)\\b");

    private final SteamClient steam;
    private final ContentItemRepository contentItems;
    private final UserGameRepository library;
    private final long userId;

    public SteamImportPreviewService(SteamClient steam, ContentItemRepository contentItems,
            UserGameRepository library, @Value("${app.default-user-id}") long userId) {
        this.steam = steam;
        this.contentItems = contentItems;
        this.library = library;
        this.userId = userId;
    }

    public SteamImportPreview preview() {
        SteamLibrary source = steam.library();
        List<ContentItem> catalog = contentItems.findAllByItemTypeOrderByTitleAsc(ContentType.GAME);
        List<UserGame> copies = library.findLibrary(userId, null, null);
        Map<Long, UserGame> copiesBySteamApp = new HashMap<>();
        Map<Long, List<UserGame>> copiesByContent = new HashMap<>();
        for (UserGame copy : copies) {
            Long contentId = copy.getUserContent().getContent().getId();
            copiesByContent.computeIfAbsent(contentId, ignored -> new ArrayList<>()).add(copy);
            if (copy.getSteamAppId() != null) copiesBySteamApp.put(copy.getSteamAppId(), copy);
        }
        Map<String, List<ContentItem>> exactTitles = exactTitles(catalog);
        List<SteamImportPreviewItem> rows = source.games().stream()
                .map(game -> match(game, catalog, exactTitles, copiesByContent, copiesBySteamApp))
                .sorted(Comparator.comparing(SteamImportPreviewItem::match)
                        .thenComparing(SteamImportPreviewItem::title, String.CASE_INSENSITIVE_ORDER))
                .toList();
        int already = count(rows, SteamImportMatch.ALREADY_IMPORTED);
        int matched = count(rows, SteamImportMatch.MATCHED);
        int review = count(rows, SteamImportMatch.REVIEW);
        int fresh = count(rows, SteamImportMatch.NEW);
        long playtime = source.games().stream().mapToLong(SteamOwnedGame::playtimeMinutes).sum();
        return new SteamImportPreview(source.profileName(), rows.size(), playtime,
                already, matched, review, fresh, rows);
    }

    private SteamImportPreviewItem match(SteamOwnedGame game, List<ContentItem> catalog,
            Map<String, List<ContentItem>> exactTitles, Map<Long, List<UserGame>> copiesByContent,
            Map<Long, UserGame> copiesBySteamApp) {
        UserGame linked = copiesBySteamApp.get(game.appId());
        if (linked != null) return row(game, SteamImportMatch.ALREADY_IMPORTED,
                linked.getUserContent().getContent(), linked.getId());

        List<ContentItem> exact = exactTitles.getOrDefault(normalize(game.title()), List.of());
        if (exact.size() == 1) {
            ContentItem item = exact.getFirst();
            UserGame steamCopy = copiesByContent.getOrDefault(item.getId(), List.of()).stream()
                    .filter(copy -> "STEAM".equals(copy.getSource().getCode()))
                    .findFirst().orElse(null);
            return row(game, steamCopy == null ? SteamImportMatch.MATCHED : SteamImportMatch.ALREADY_IMPORTED,
                    item, steamCopy == null ? null : steamCopy.getId());
        }
        if (exact.size() > 1) return row(game, SteamImportMatch.REVIEW, exact.getFirst(), null);

        ContentItem suggestion = null;
        double bestScore = 0;
        for (ContentItem item : catalog) {
            double score = Math.max(similarity(game.title(), item.getTitle()),
                    similarity(game.title(), item.getOriginalTitle()));
            if (score > bestScore) {
                bestScore = score;
                suggestion = item;
            }
        }
        return bestScore >= 0.90
                ? row(game, SteamImportMatch.REVIEW, suggestion, null)
                : row(game, SteamImportMatch.NEW, null, null);
    }

    private SteamImportPreviewItem row(SteamOwnedGame game, SteamImportMatch match,
            ContentItem item, Long libraryEntryId) {
        return new SteamImportPreviewItem(game.appId(), game.title(), game.playtimeMinutes(),
                game.lastPlayedAt(), game.iconUrl(), match, item == null ? null : item.getId(),
                item == null ? null : item.getTitle(), libraryEntryId);
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

    private void addTitle(Map<String, LinkedHashSet<ContentItem>> values, String title, ContentItem item) {
        String normalized = normalize(title);
        if (!normalized.isBlank()) values.computeIfAbsent(normalized, ignored -> new LinkedHashSet<>()).add(item);
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
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .toLowerCase(Locale.ROOT).replace("&", " and ");
        normalized = DIACRITICS.matcher(normalized).replaceAll("");
        return NON_ALPHANUMERIC.matcher(normalized).replaceAll(" ").trim().replaceAll("\\s+", " ");
    }

    private int count(List<SteamImportPreviewItem> rows, SteamImportMatch match) {
        return (int) rows.stream().filter(item -> item.match() == match).count();
    }
}
