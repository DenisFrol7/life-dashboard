package com.lifedashboard.content.myshows;

import java.util.List;

public record MyShowsImportRequest(List<Choice> choices) {
    public record Choice(String sourceTitle, String action, Long filmId,
                         String nameRu, String nameEn, String year) {}
}
