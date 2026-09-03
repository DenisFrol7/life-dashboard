package com.lifedashboard.game.rawg;

import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.ContentItem;
import com.lifedashboard.content.ContentItemRepository;
import com.lifedashboard.content.ContentType;
import com.lifedashboard.content.ReleaseStatus;
import com.lifedashboard.content.dto.ContentItemRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RawgCatalogServiceTests {
    @Mock RawgClient rawg;
    @Mock ContentItemRepository items;

    @Test
    void rejectsShortSearchQuery() {
        assertThrows(InvalidRequestException.class, () -> service().search("x"));
    }

    @Test
    void marksAnExistingManualGameInSearchResults() {
        var data = gameData();
        ContentItem existing = mock(ContentItem.class);
        when(existing.getId()).thenReturn(42L);
        when(existing.getRawgId()).thenReturn(null);
        when(existing.getTitle()).thenReturn("Deus Ex: Human Revolution");
        when(existing.getReleaseYear()).thenReturn(2011);
        when(rawg.search("Deus Ex")).thenReturn(List.of(data));
        when(items.findByRawgId(2870L)).thenReturn(Optional.empty());
        when(items.findAllByItemTypeOrderByTitleAsc(ContentType.GAME)).thenReturn(List.of(existing));

        var candidate = service().search(" Deus Ex ").getFirst();

        assertEquals("Deus Ex: Human Revolution", candidate.title());
        assertEquals(List.of("PC", "Xbox 360"), candidate.platforms());
        assertEquals(42L, candidate.existingContentId());
    }

    @Test
    void createsLinkedGameFromEditableRequest() {
        var data = gameData();
        var request = new ContentItemRequest("Deus Ex: Human Revolution", null, ContentType.GAME,
                null, 2011, "Описание", "https://example.test/cover.jpg", null,
                ReleaseStatus.RELEASED, "Action, RPG", "Eidos Montreal",
                LocalDate.of(2011, 8, 23), false);
        when(items.findByRawgId(2870L)).thenReturn(Optional.empty());
        when(rawg.getGame(2870L)).thenReturn(data);
        when(items.save(any(ContentItem.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service().create(2870L, request);

        assertEquals(2870L, result.rawgId());
        assertEquals("deus-ex-human-revolution", result.rawgSlug());
        assertEquals("Eidos Montreal", result.developer());
        assertEquals("cover", result.backgroundUrl());
        verify(items).save(any(ContentItem.class));
    }

    private RawgCatalogService service() { return new RawgCatalogService(rawg, items); }

    private RawgClient.GameData gameData() {
        return new RawgClient.GameData(2870L, "deus-ex-human-revolution",
                "Deus Ex: Human Revolution", null, LocalDate.of(2011, 8, 23),
                "Description", "cover", "Action, RPG", "Eidos Montreal",
                List.of("PC", "Xbox 360"), false);
    }
}
