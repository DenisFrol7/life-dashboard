package com.lifedashboard.game.steamgriddb;

import com.lifedashboard.common.error.InvalidRequestException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SteamGridDbCatalogServiceTests {
    private final SteamGridDbClient client = mock(SteamGridDbClient.class);
    private final SteamGridDbCatalogService service = new SteamGridDbCatalogService(client);

    @Test
    void rejectsShortSearchQuery() {
        assertThrows(InvalidRequestException.class, () -> service.search("x"));
    }

    @Test
    void trimsSearchQuery() {
        var candidate = new SteamGridDbGameCandidate(10L, "Deus Ex", true, List.of("steam"));
        when(client.search("Deus Ex")).thenReturn(List.of(candidate));

        assertEquals(List.of(candidate), service.search("  Deus Ex  "));
        verify(client).search("Deus Ex");
    }

    @Test
    void loadsCoversForSelectedGame() {
        var cover = new SteamGridDbCoverCandidate(10L, 20L, "image", "thumb", 3,
                "alternate", "author");
        when(client.covers(10L)).thenReturn(List.of(cover));

        assertEquals(List.of(cover), service.covers(10L));
    }
}
