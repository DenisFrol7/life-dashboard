package com.lifedashboard.content.shikimori;

public record ShikimoriAnimeCandidate(long shikimoriId, String title, String originalTitle,
        String kind, String status, String coverUrl, Long existingContentId) {}
