package com.lifedashboard.content;

import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.data.DataTransferService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MovieCatalogServiceTests {
    @Mock ContentItemRepository items;
    @Mock KinopoiskCatalogClient kinopoisk;
    @Mock ContentService contentService;
    @Mock DataTransferService dataTransfer;

    @Test
    void marksSearchResultThatAlreadyExists() {
        ContentItem existing = mock(ContentItem.class);
        when(existing.getId()).thenReturn(42L);
        when(items.findByKinopoiskFilmId(301L)).thenReturn(Optional.of(existing));
        when(kinopoisk.searchMovies("Матрица")).thenReturn(List.of(
                new KinopoiskCatalogClient.MovieCandidate(301L, "Матрица", "The Matrix", "1999", "poster")));

        var result = service().searchKinopoisk("Матрица");

        assertEquals(1, result.size());
        assertEquals(42L, result.getFirst().existingContentId());
    }

    @Test
    void mapsKinopoiskMovieDetails() {
        when(items.findByKinopoiskFilmId(301L)).thenReturn(Optional.empty());
        when(kinopoisk.getMovie(301L)).thenReturn(new KinopoiskCatalogClient.MovieDetails(301L,
                "Матрица", "The Matrix", 1999, "Описание", "poster", 136,
                "фантастика, боевик", "COMPLETED", true));

        var result = service().previewKinopoisk(301L);

        assertEquals("Матрица", result.title());
        assertEquals(ContentFormat.LIVE_ACTION, result.format());
        assertEquals(ReleaseStatus.RELEASED, result.releaseStatus());
        assertEquals(136, result.durationMinutes());
    }

    @Test
    void rejectsDuplicateBeforeRequestingMovieDetails() {
        ContentItem existing = mock(ContentItem.class);
        when(existing.getId()).thenReturn(42L);
        when(items.findByKinopoiskFilmId(301L)).thenReturn(Optional.of(existing));

        var request = new ContentItemRequest("Матрица", "The Matrix", ContentType.MOVIE,
                ContentFormat.LIVE_ACTION, 1999, null, null, 136, ReleaseStatus.RELEASED);
        assertThrows(DuplicateResourceException.class, () -> service().createFromKinopoisk(301L, request));
        verify(kinopoisk, never()).getMovie(anyLong());
    }

    @Test
    void linksLegacyMovieInsteadOfCreatingDuplicate() {
        ContentItem existing = new ContentItem("8 РјРёР»СЏ");
        existing.update("8 РјРёР»СЏ", "8 Mile", ContentType.MOVIE, ContentFormat.LIVE_ACTION,
                2002, null, null, 110, ReleaseStatus.RELEASED, null, null, null, false);
        when(items.findByKinopoiskFilmId(821L)).thenReturn(Optional.empty());
        when(items.findAllByItemTypeOrderByTitleAsc(ContentType.MOVIE)).thenReturn(List.of(existing));
        when(kinopoisk.getMovie(821L)).thenReturn(new KinopoiskCatalogClient.MovieDetails(821L,
                "8 РјРёР»СЏ", "8 Mile", 2002, "РћРїРёСЃР°РЅРёРµ", "poster", 110,
                "РґСЂР°РјР°, РјСѓР·С‹РєР°", "COMPLETED", true));
        var request = new ContentItemRequest("8 РјРёР»СЏ", "8 Mile", ContentType.MOVIE,
                ContentFormat.LIVE_ACTION, 2002, "РћРїРёСЃР°РЅРёРµ", "poster", 110, ReleaseStatus.RELEASED);

        service().createFromKinopoisk(821L, request);

        assertEquals(821L, existing.getKinopoiskFilmId());
        verify(items).save(existing);
    }

    private MovieCatalogService service() { return new MovieCatalogService(items, kinopoisk, contentService, dataTransfer, 1L); }
}
