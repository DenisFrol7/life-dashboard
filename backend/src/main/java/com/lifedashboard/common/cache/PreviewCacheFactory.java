package com.lifedashboard.common.cache;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.Scheduler;
import com.github.benmanes.caffeine.cache.Ticker;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class PreviewCacheFactory {
    private final Ticker ticker;

    public PreviewCacheFactory() {
        this(Ticker.systemTicker());
    }

    public PreviewCacheFactory(Ticker ticker) {
        this.ticker = ticker;
    }

    public <K, V> Cache<K, V> create(long maximumSize) {
        return Caffeine.newBuilder()
                .maximumSize(maximumSize)
                .expireAfterWrite(Duration.ofMinutes(30))
                .scheduler(Scheduler.systemScheduler())
                .ticker(ticker)
                .build();
    }
}
