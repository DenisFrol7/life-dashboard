package com.lifedashboard.common.http;

import com.lifedashboard.common.error.ExternalApiTimeoutException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.time.Duration;

public final class ExternalApiHttp {
    private ExternalApiHttp() {}

    public static RestClient.Builder builder(String baseUrl) {
        return builder(baseUrl, Duration.ofSeconds(10), Duration.ofSeconds(30));
    }

    static RestClient.Builder builder(String baseUrl, Duration connectTimeout, Duration readTimeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(readTimeout);
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory);
    }

    public static void rethrowIfTimeout(RuntimeException exception, String apiName) {
        if (exception instanceof ExternalApiTimeoutException timeout) throw timeout;
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof SocketTimeoutException || cause instanceof HttpTimeoutException) {
                throw new ExternalApiTimeoutException(apiName, exception);
            }
        }
    }
}
