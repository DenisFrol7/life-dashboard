package com.lifedashboard.content.shikimori;

import java.util.List;

public record ShikimoriImportPreview(String token, int total, int completed, int watching,
        int planned, int existing, List<Item> items, List<String> warnings) {
    public record Item(long shikimoriId, String title, String originalTitle, String status,
            Integer score, int watchedEpisodes, int rewatches, Long existingContentId) {}
}
