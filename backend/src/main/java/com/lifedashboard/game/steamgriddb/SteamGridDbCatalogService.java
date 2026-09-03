package com.lifedashboard.game.steamgriddb;

import com.lifedashboard.common.error.InvalidRequestException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SteamGridDbCatalogService {
    private final SteamGridDbClient client;

    public SteamGridDbCatalogService(SteamGridDbClient client) {
        this.client = client;
    }

    public List<SteamGridDbGameCandidate> search(String query) {
        String value = query == null ? "" : query.trim();
        if (value.length() < 2)
            throw new InvalidRequestException(
                    "Запрос для поиска обложки должен содержать не менее 2 символов");
        return client.search(value);
    }

    public List<SteamGridDbCoverCandidate> covers(long gameId) {
        if (gameId <= 0) throw new InvalidRequestException("Некорректный идентификатор SteamGridDB");
        return client.covers(gameId);
    }
}
