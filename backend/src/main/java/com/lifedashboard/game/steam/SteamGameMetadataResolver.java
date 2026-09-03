package com.lifedashboard.game.steam;

import com.lifedashboard.game.rawg.RawgClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbCoverCandidate;
import com.lifedashboard.game.steamgriddb.SteamGridDbGameCandidate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Service
public class SteamGameMetadataResolver {
    private static final Logger log = LoggerFactory.getLogger(SteamGameMetadataResolver.class);
    private final RawgClient rawg;
    private final SteamGridDbClient steamGridDb;

    public SteamGameMetadataResolver(RawgClient rawg, SteamGridDbClient steamGridDb) {
        this.rawg = rawg;
        this.steamGridDb = steamGridDb;
    }

    public SteamGameMetadata resolve(SteamImportPreviewItem game) {
        RawgClient.GameData rawgData = resolveRawg(game);
        SteamGridDbGameCandidate artworkGame = null;
        SteamGridDbCoverCandidate cover = null;
        try {
            artworkGame = steamGridDb.findBySteamAppId(game.appId()).orElse(null);
            if (artworkGame != null) {
                List<SteamGridDbCoverCandidate> covers = steamGridDb.covers(artworkGame.steamGridDbId());
                cover = covers.isEmpty() ? null : covers.getFirst();
            }
        } catch (RuntimeException exception) {
            log.warn("SteamGridDB enrichment skipped for Steam app {}: {}",
                    game.appId(), exception.getClass().getSimpleName());
        }
        return new SteamGameMetadata(rawgData, artworkGame, cover);
    }

    private RawgClient.GameData resolveRawg(SteamImportPreviewItem game) {
        try {
            String expected = key(game.title());
            return rawg.search(game.title()).stream()
                    .filter(candidate -> expected.equals(key(candidate.title()))
                            || expected.equals(key(candidate.originalTitle())))
                    .findFirst()
                    .map(candidate -> rawg.getGame(candidate.rawgId()))
                    .orElse(null);
        } catch (RuntimeException exception) {
            log.warn("RAWG enrichment skipped for Steam app {}: {}",
                    game.appId(), exception.getClass().getSimpleName());
            return null;
        }
    }

    private String key(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFKD)
                .toLowerCase(Locale.ROOT)
                .replace("&", "and")
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^\\p{L}\\p{N}]", "");
    }
}
