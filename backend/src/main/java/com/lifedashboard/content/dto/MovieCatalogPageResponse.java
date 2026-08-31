package com.lifedashboard.content.dto;

import java.util.List;

public record MovieCatalogPageResponse(List<MovieCatalogResponse> items, int page, int size,
        int totalItems, boolean hasMore, Statistics statistics) {
    public record Statistics(int totalMovies, int inLibrary, int completed, int planned,
            int liveAction, int animation) {}
}
