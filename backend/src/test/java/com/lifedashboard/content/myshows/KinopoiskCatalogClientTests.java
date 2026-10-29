package com.lifedashboard.content.myshows;

import com.lifedashboard.common.error.InvalidRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class KinopoiskCatalogClientTests {
    private static final String BASE = "https://kinopoiskapiunofficial.tech";
    private KinopoiskCatalogClient client;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
        server = MockRestServiceServer.bindTo(builder).build();
        client = new KinopoiskCatalogClient("test-key");
        ReflectionTestUtils.setField(client, "client", builder.build());
    }

    @ParameterizedTest
    @ValueSource(strings = {"movie", "search", "seriesDetails", "seriesSeasons"})
    void dailyQuotaUsesTypedExceptionWithoutRetrying(String operation) {
        if (operation.equals("seriesSeasons")) {
            server.expect(requestTo(BASE + "/api/v2.2/films/1"))
                    .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));
        }
        String path = switch (operation) {
            case "search" -> "/api/v2.1/films/search-by-keyword?keyword=test&page=1";
            case "seriesSeasons" -> "/api/v2.2/films/1/seasons";
            default -> "/api/v2.2/films/1";
        };
        server.expect(requestTo(BASE + path)).andRespond(withStatus(HttpStatus.PAYMENT_REQUIRED));

        KinopoiskLimitException error = assertThrows(KinopoiskLimitException.class, () -> {
            switch (operation) {
                case "movie" -> client.getMovie(1);
                case "search" -> client.searchSeries("test");
                default -> client.getCatalog(1);
            }
        });

        assertTrue(error.getMessage().contains("402"));
        server.verify();
    }

    @Test
    void exhaustedRateLimitRetriesUseTypedException() {
        server.expect(ExpectedCount.times(4), requestTo(BASE + "/api/v2.2/films/1"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));

        KinopoiskLimitException error = assertThrows(KinopoiskLimitException.class, () -> client.getMovie(1));

        assertTrue(error.getMessage().contains("429"));
        server.verify();
    }

    @Test
    void temporaryRateLimitCanRecoverOnRetry() {
        server.expect(requestTo(BASE + "/api/v2.2/films/1"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS));
        server.expect(requestTo(BASE + "/api/v2.2/films/1"))
                .andRespond(withSuccess("{\"nameRu\":\"Movie\"}", MediaType.APPLICATION_JSON));

        assertEquals("Movie", client.getMovie(1).nameRu());

        server.verify();
    }

    @Test
    void invalidApiKeyIsNotClassifiedAsQuotaLimit() {
        server.expect(requestTo(BASE + "/api/v2.2/films/1"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        var error = assertThrows(InvalidRequestException.class, () -> client.getMovie(1));

        assertFalse(error instanceof KinopoiskLimitException);
        server.verify();
    }
}
