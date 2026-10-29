package com.lifedashboard.common.http;

import com.lifedashboard.common.error.ExternalApiTimeoutException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.client.ResourceAccessException;
import tools.jackson.databind.JsonNode;

import java.net.InetSocketAddress;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

class ExternalApiHttpTests {
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void actualReadTimeoutStopsWaitingForHeadersOrBody(boolean delayBody) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        CountDownLatch release = new CountDownLatch(1);
        server.createContext("/ok", exchange -> {
            byte[] json = "{\"items\":[]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, json.length);
            try (var output = exchange.getResponseBody()) { output.write(json); }
        });
        server.createContext("/slow", exchange -> {
            try {
                if (delayBody) {
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(200, 0);
                    exchange.getResponseBody().write("{\"items\":[".getBytes(StandardCharsets.UTF_8));
                    exchange.getResponseBody().flush();
                }
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        server.start();
        try {
            var client = ExternalApiHttp.builder("http://127.0.0.1:" + server.getAddress().getPort(),
                    Duration.ofSeconds(1), Duration.ofMillis(200)).build();
            var normalResponse = client.get().uri("/ok").retrieve().body(JsonNode.class);
            assertNotNull(normalResponse);
            assertTrue(normalResponse.path("items").isArray());

            long started = System.nanoTime();
            var failure = assertThrows(RuntimeException.class,
                    () -> client.get().uri("/slow").retrieve().body(JsonNode.class));

            assertThrows(ExternalApiTimeoutException.class,
                    () -> ExternalApiHttp.rethrowIfTimeout(failure, "Test API"));
            assertTrue(Duration.ofNanos(System.nanoTime() - started).compareTo(Duration.ofSeconds(3)) < 0,
                    "The client must time out without waiting for the server to close the response");
        } finally {
            release.countDown();
            server.stop(0);
        }
    }

    @Test
    void detectsJdkHttpTimeoutThroughWrappedExceptions() {
        var timeout = new HttpTimeoutException("Test connect timeout");
        var wrapped = new ResourceAccessException("https://example.invalid/?key=secret", timeout);

        var failure = assertThrows(ExternalApiTimeoutException.class,
                () -> ExternalApiHttp.rethrowIfTimeout(wrapped, "Test API"));

        assertSame(wrapped, failure.getCause());
        assertTrue(failure.getMessage().contains("Test API"));
        assertFalse(failure.getMessage().contains("secret"));
    }
}
