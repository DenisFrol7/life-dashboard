package com.lifedashboard.content.shikimori;

import com.lifedashboard.content.*;
import com.lifedashboard.data.DataTransferService;
import com.lifedashboard.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShikimoriImportServiceTests {
    @Mock ContentItemRepository items;
    @Mock ContentSeasonRepository seasons;
    @Mock ContentEpisodeRepository episodes;
    @Mock EpisodeWatchRepository watches;
    @Mock UserRepository users;
    @Mock ContentService contentService;
    @Mock DataTransferService dataTransfer;
    @Mock ShikimoriClient shikimori;

    @Test
    void previewsExportWithoutCallingShikimoriOrChangingData() {
        ContentItem existing = mock(ContentItem.class);
        when(existing.getId()).thenReturn(42L);
        when(items.findByShikimoriId(1L)).thenReturn(Optional.of(existing));
        when(items.findByShikimoriId(2L)).thenReturn(Optional.empty());
        var file = new MockMultipartFile("file", "anime.json", "application/json", """
                [{"target_title":"First","target_title_ru":"Первое","target_id":1,
                  "score":8,"status":"completed","rewatches":0,"episodes":12,"text":null},
                 {"target_title":"Second","target_title_ru":"Второе","target_id":2,
                  "score":0,"status":"watching","rewatches":0,"episodes":3,"text":null}]
                """.getBytes());

        var preview = service().preview(file);

        assertEquals(2, preview.total());
        assertEquals(1, preview.completed());
        assertEquals(1, preview.watching());
        assertEquals(1, preview.existing());
        assertEquals(42L, preview.items().getFirst().existingContentId());
        verifyNoInteractions(shikimori, dataTransfer, contentService);
    }

    @Test
    void preservesExistingKinopoiskMovie() {
        ContentItem movie = new ContentItem("Твоё имя");
        movie.update("Твоё имя", "Kimi no Na wa.", ContentType.MOVIE, ContentFormat.ANIMATION,
                2016, "Описание Кинопоиска", "poster", 106, ReleaseStatus.RELEASED,
                "аниме", null, null, false);
        movie.setKinopoiskFilmId(958722L);

        assertTrue(ShikimoriImportService.shouldSkipKinopoiskMovie(true, movie));
        assertFalse(ShikimoriImportService.shouldSkipKinopoiskMovie(false, movie));
    }

    private ShikimoriImportService service() {
        return new ShikimoriImportService(items, seasons, episodes, watches, users, contentService,
                dataTransfer, shikimori, new ObjectMapper(), 1L);
    }
}
