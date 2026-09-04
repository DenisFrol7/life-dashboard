package com.lifedashboard.game.openxbl;

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
public class XboxGameMetadataResolver {
    private static final Logger log = LoggerFactory.getLogger(XboxGameMetadataResolver.class);
    private final RawgClient rawg;
    private final SteamGridDbClient steamGridDb;

    public XboxGameMetadataResolver(RawgClient rawg, SteamGridDbClient steamGridDb) {
        this.rawg = rawg;
        this.steamGridDb = steamGridDb;
    }

    public XboxGameMetadata resolve(XboxImportPreviewItem game) {
        RawgClient.GameData rawgData = resolveRawg(game.title());
        SteamGridDbGameCandidate artworkGame = null;
        SteamGridDbCoverCandidate cover = null;
        String artworkTitle = rawgData == null ? game.title() : rawgData.title();
        try {
            String expected = key(artworkTitle);
            artworkGame = steamGridDb.search(artworkTitle).stream()
                    .filter(candidate -> expected.equals(key(candidate.name())))
                    .findFirst().orElse(null);
            if (artworkGame != null) {
                List<SteamGridDbCoverCandidate> covers = steamGridDb.covers(
                        artworkGame.steamGridDbId());
                cover = covers.isEmpty() ? null : covers.getFirst();
            }
        } catch (RuntimeException exception) {
            log.warn("SteamGridDB enrichment skipped for Xbox title {}: {}",
                    game.titleId(), exception.getClass().getSimpleName());
        }
        return new XboxGameMetadata(rawgData, artworkGame, cover);
    }

    private RawgClient.GameData resolveRawg(String title) {
        try {
            String expected = key(title);
            return rawg.search(title).stream()
                    .filter(candidate -> expected.equals(key(candidate.title()))
                            || expected.equals(key(candidate.originalTitle())))
                    .findFirst()
                    .map(candidate -> rawg.getGame(candidate.rawgId()))
                    .orElse(null);
        } catch (RuntimeException exception) {
            log.warn("RAWG enrichment skipped for Xbox title '{}': {}",
                    title, exception.getClass().getSimpleName());
            return null;
        }
    }

    private String key(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value.replace("™", "").replace("®", ""),
                        Normalizer.Form.NFKD)
                .toLowerCase(Locale.ROOT)
                .replace("&", "and")
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^\\p{L}\\p{N}]", "");
    }
}
