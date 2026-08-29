package com.lifedashboard.content.myshows;

import java.time.LocalDate;
import java.util.List;

public record KinopoiskCatalogData(String nameRu, String nameOriginal, Integer year, String description,
                                   String coverUrl, String genre, String status, boolean completed,
                                   List<Season> seasons) {
    public record Season(int number, List<Episode> episodes) {}
    public record Episode(int number, String nameRu, String nameEn, LocalDate releaseDate) {}
}
