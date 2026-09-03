package com.lifedashboard.game.steam;

import com.lifedashboard.game.rawg.RawgClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbCoverCandidate;
import com.lifedashboard.game.steamgriddb.SteamGridDbGameCandidate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SteamGameMetadataResolverTests {
    @Mock RawgClient rawg;
    @Mock SteamGridDbClient steamGridDb;

    @Test
    void resolvesExactRawgGameAndSteamGridDbCover() {
        RawgClient.GameData candidate = data(10L, "Portal® 2");
        RawgClient.GameData details = data(10L, "Portal 2");
        SteamGridDbGameCandidate artwork = new SteamGridDbGameCandidate(
                20L, "Portal 2", true, List.of("steam"));
        SteamGridDbCoverCandidate cover = new SteamGridDbCoverCandidate(
                20L, 30L, "cover", null, 5, null, null);
        when(rawg.search("Portal 2")).thenReturn(List.of(candidate));
        when(rawg.getGame(10L)).thenReturn(details);
        when(steamGridDb.findBySteamAppId(620L)).thenReturn(Optional.of(artwork));
        when(steamGridDb.covers(20L)).thenReturn(List.of(cover));

        SteamGameMetadata result = service().resolve(game(620L, "Portal 2"));

        assertEquals(details, result.rawg());
        assertEquals(artwork, result.steamGridDbGame());
        assertEquals(cover, result.verticalCover());
        verify(rawg).getGame(10L);
    }

    @Test
    void ignoresANonExactRawgResultAndMissingArtwork() {
        when(rawg.search("Portal 2")).thenReturn(List.of(data(11L, "Portal")));
        when(steamGridDb.findBySteamAppId(620L)).thenReturn(Optional.empty());

        SteamGameMetadata result = service().resolve(game(620L, "Portal 2"));

        assertNull(result.rawg());
        assertNull(result.steamGridDbGame());
        assertNull(result.verticalCover());
    }

    private SteamGameMetadataResolver service() {
        return new SteamGameMetadataResolver(rawg, steamGridDb);
    }

    private SteamImportPreviewItem game(long appId, String title) {
        return new SteamImportPreviewItem(appId, title, 0, null, null,
                SteamImportMatch.NEW, null, null, null);
    }

    private RawgClient.GameData data(long id, String title) {
        return new RawgClient.GameData(id, "slug", title, null,
                LocalDate.of(2020, 1, 1), null, null, null, null, List.of(), false);
    }
}
