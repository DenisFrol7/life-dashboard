package com.lifedashboard.common.http;

import com.lifedashboard.book.googlebooks.GoogleBooksClient;
import com.lifedashboard.common.error.ExternalApiTimeoutException;
import com.lifedashboard.common.error.InvalidRequestException;
import com.lifedashboard.content.myshows.KinopoiskCatalogClient;
import com.lifedashboard.content.shikimori.ShikimoriClient;
import com.lifedashboard.game.rawg.RawgClient;
import com.lifedashboard.game.steamgriddb.SteamGridDbClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.function.Supplier;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.anything;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ExternalApiClientTimeoutTests {
    enum Operation {
        GOOGLE_SEARCH, SHIKI_SEARCH, SHIKI_DETAILS, RAWG_SEARCH, RAWG_DETAILS,
        GRID_SEARCH, GRID_STEAM_LOOKUP, GRID_COVERS,
        KP_MOVIE_SEARCH, KP_SERIES_SEARCH, KP_MOVIE, KP_SERIES, KP_SEASONS, KP_RATINGS
    }

    @ParameterizedTest
    @EnumSource(Operation.class)
    void timeoutIsReportedWithoutRetryingOrLosingApiName(Operation operation) {
        var scenario = scenario(operation);
        var server = mockServer(scenario.adapter());
        if (operation == Operation.KP_SEASONS) {
            server.expect(anything()).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        }
        server.expect(anything()).andRespond(withException(new SocketTimeoutException("Test timeout with secret-key")));

        var exception = assertThrows(ExternalApiTimeoutException.class, scenario.call()::get);

        assertTrue(exception.getMessage().contains(scenario.apiName()));
        assertTrue(exception.getMessage().contains("Попробуйте позже"));
        assertFalse(exception.getMessage().contains("secret-key"));
        server.verify();
    }

    @ParameterizedTest
    @EnumSource(value = Operation.class, names = {"GOOGLE_SEARCH", "SHIKI_SEARCH", "RAWG_SEARCH", "GRID_SEARCH", "KP_MOVIE"})
    void actualClientUsesBoundedConnectionAndReadTimeouts(Operation operation) {
        var adapter = scenario(operation).adapter();
        RestClient client = (RestClient) ReflectionTestUtils.getField(adapter, "client");
        Object factory = ReflectionTestUtils.getField(client, "clientRequestFactory");

        assertInstanceOf(SimpleClientHttpRequestFactory.class, factory);
        assertEquals(10_000, ReflectionTestUtils.getField(factory, "connectTimeout"));
        assertEquals(30_000, ReflectionTestUtils.getField(factory, "readTimeout"));
    }

    @Test
    void connectionRefusalRemainsConnectionError() {
        var scenario = scenario(Operation.GOOGLE_SEARCH);
        var server = mockServer(scenario.adapter());
        server.expect(anything()).andRespond(withException(new ConnectException("Connection refused")));

        var exception = assertThrows(InvalidRequestException.class, scenario.call()::get);

        assertTrue(exception.getMessage().contains("подключиться"));
        server.verify();
    }

    @Test
    void rawgAuthenticationErrorIsNotReportedAsTimeout() {
        var scenario = scenario(Operation.RAWG_SEARCH);
        var server = mockServer(scenario.adapter());
        server.expect(anything()).andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        var exception = assertThrows(InvalidRequestException.class, scenario.call()::get);

        assertTrue(exception.getMessage().contains("API-ключ"));
        server.verify();
    }

    @Test
    void googleBooksStillRetriesServiceUnavailableResponses() {
        var scenario = scenario(Operation.GOOGLE_SEARCH);
        var server = mockServer(scenario.adapter());
        server.expect(anything()).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        server.expect(anything()).andRespond(withSuccess("{\"items\":[]}", MediaType.APPLICATION_JSON));

        assertEquals(java.util.List.of(), scenario.call().get());

        server.verify();
    }

    @Test
    void rawgStillRetriesServiceUnavailableResponses() {
        var scenario = scenario(Operation.RAWG_SEARCH);
        var server = mockServer(scenario.adapter());
        server.expect(anything()).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        server.expect(anything()).andRespond(withSuccess("{\"results\":[]}", MediaType.APPLICATION_JSON));

        assertEquals(java.util.List.of(), scenario.call().get());

        server.verify();
    }

    private MockRestServiceServer mockServer(Object adapter) {
        RestClient client = (RestClient) ReflectionTestUtils.getField(adapter, "client");
        RestClient.Builder builder = client.mutate();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        ReflectionTestUtils.setField(adapter, "client", builder.build());
        return server;
    }

    private Scenario scenario(Operation operation) {
        return switch (operation) {
            case GOOGLE_SEARCH -> {
                var client = new GoogleBooksClient("test-key");
                yield new Scenario(client, () -> client.search("book"), "Google Books");
            }
            case SHIKI_SEARCH, SHIKI_DETAILS -> {
                var client = new ShikimoriClient();
                yield new Scenario(client, () -> operation == Operation.SHIKI_SEARCH
                        ? client.search("anime") : client.getAnime(1), "Shikimori");
            }
            case RAWG_SEARCH, RAWG_DETAILS -> {
                var client = new RawgClient("test-key");
                yield new Scenario(client, () -> operation == Operation.RAWG_SEARCH
                        ? client.search("game") : client.getGame(1), "RAWG");
            }
            case GRID_SEARCH, GRID_STEAM_LOOKUP, GRID_COVERS -> {
                var client = new SteamGridDbClient("test-key");
                yield new Scenario(client, () -> switch (operation) {
                    case GRID_SEARCH -> client.search("game");
                    case GRID_STEAM_LOOKUP -> client.findBySteamAppId(1);
                    default -> client.covers(1);
                }, "SteamGridDB");
            }
            default -> {
                var client = new KinopoiskCatalogClient("test-key");
                yield new Scenario(client, () -> switch (operation) {
                    case KP_MOVIE_SEARCH -> client.searchMovies("movie");
                    case KP_SERIES_SEARCH -> client.searchSeries("series");
                    case KP_MOVIE -> client.getMovie(1);
                    case KP_SERIES, KP_SEASONS -> client.getCatalog(1);
                    default -> client.getUserRatings("test-profile");
                }, "Кинопоиска");
            }
        };
    }

    private record Scenario(Object adapter, Supplier<?> call, String apiName) {}
}
