package com.lifedashboard.content;

import com.lifedashboard.common.error.DuplicateResourceException;
import com.lifedashboard.content.dto.ContentItemRequest;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.content.myshows.KinopoiskCatalogData;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SeriesKinopoiskServiceTests {
    @Mock ContentItemRepository items;
    @Mock ContentSeasonRepository seasons;
    @Mock ContentEpisodeRepository episodes;
    @Mock KinopoiskCatalogClient kinopoisk;

    @Test
    void marksSearchResultThatAlreadyExists() {
        ContentItem existing = mock(ContentItem.class);
        when(existing.getId()).thenReturn(12L);
        when(items.findByKinopoiskFilmId(77L)).thenReturn(Optional.of(existing));
        when(kinopoisk.searchSeries("Тьма")).thenReturn(List.of(
                new com.lifedashboard.content.myshows.KinopoiskMatchPreview.Candidate(
                        77L, "Тьма", "Dark", "2017", "TV_SERIES")));

        var result = service().search("Тьма");

        assertEquals(12L, result.getFirst().existingContentId());
    }

    @Test
    void previewsAndCreatesCompleteStructureWithoutLoadingCatalogTwice() {
        KinopoiskCatalogData catalog = new KinopoiskCatalogData("Тьма", "Dark", 2017,
                "Описание", "poster", "фантастика", "COMPLETED", true,
                List.of(new KinopoiskCatalogData.Season(1, List.of(
                        new KinopoiskCatalogData.Episode(1, "Тайны", "Secrets", LocalDate.of(2017, 12, 1)),
                        new KinopoiskCatalogData.Episode(2, null, "Lies", LocalDate.of(2017, 12, 1))))));
        when(items.findByKinopoiskFilmId(77L)).thenReturn(Optional.empty());
        when(kinopoisk.getCatalog(77L)).thenReturn(catalog);
        when(seasons.save(any(ContentSeason.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var request = new ContentItemRequest("Тьма", "Dark", ContentType.SERIES,
                ContentFormat.LIVE_ACTION, 2017, "Описание", "poster", null, ReleaseStatus.ENDED);

        var service = service();
        var preview = service.preview(77L);
        var created = service.create(77L, request);

        assertEquals(1, preview.seasonCount());
        assertEquals(2, preview.episodeCount());
        assertEquals("Тьма", created.title());
        verify(kinopoisk, times(1)).getCatalog(77L);
        verify(seasons).save(any(ContentSeason.class));
        verify(episodes, times(2)).save(any(ContentEpisode.class));
        verify(items).save(argThat(item -> Long.valueOf(77L).equals(item.getKinopoiskFilmId())));
    }

    @Test
    void rejectsDuplicateBeforeLoadingCatalog() {
        ContentItem existing = mock(ContentItem.class);
        when(existing.getId()).thenReturn(12L);
        when(items.findByKinopoiskFilmId(77L)).thenReturn(Optional.of(existing));
        var request = new ContentItemRequest("Тьма", "Dark", ContentType.SERIES,
                ContentFormat.LIVE_ACTION, 2017, null, null, null, ReleaseStatus.ENDED);

        assertThrows(DuplicateResourceException.class, () -> service().create(77L, request));
        verify(kinopoisk, never()).getCatalog(anyLong());
    }

    private SeriesKinopoiskService service() {
        return new SeriesKinopoiskService(items, seasons, episodes, kinopoisk);
    }
}
