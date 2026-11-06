package com.lifedashboard.common.cache;

import com.github.benmanes.caffeine.cache.Cache;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

class PreviewCacheFactoryTests {
    @Test
    void entriesExpireAfterThirtyMinutesEvenIfReadRecently() {
        AtomicLong time = new AtomicLong();
        Cache<String, String> cache = new PreviewCacheFactory(time::get).create(100);
        cache.put("film", "preview");
        time.addAndGet(Duration.ofMinutes(29).toNanos());
        assertEquals("preview", cache.getIfPresent("film"));

        time.addAndGet(Duration.ofMinutes(1).toNanos());

        assertNull(cache.getIfPresent("film"));
        cache.cleanUp();
        assertEquals(0, cache.estimatedSize());
    }

    @Test
    void refreshingPreviewStartsNewLifetime() {
        AtomicLong time = new AtomicLong();
        Cache<String, String> cache = new PreviewCacheFactory(time::get).create(100);
        cache.put("film", "old");
        time.addAndGet(Duration.ofMinutes(20).toNanos());
        cache.put("film", "new");

        time.addAndGet(Duration.ofMinutes(10).toNanos());
        assertEquals("new", cache.getIfPresent("film"));
        time.addAndGet(Duration.ofMinutes(20).toNanos());
        assertNull(cache.getIfPresent("film"));
    }

    @ParameterizedTest
    @ValueSource(ints = {10, 100})
    void abandonedPreviewsCannotKeepGrowingInMemory(int maximumSize) {
        Cache<Integer, String> cache = new PreviewCacheFactory().create(maximumSize);
        for (int index = 0; index < maximumSize + 20; index++) cache.put(index, "preview " + index);

        cache.cleanUp();

        assertEquals(maximumSize, cache.estimatedSize());
        long available = java.util.stream.IntStream.range(0, maximumSize + 20)
                .filter(index -> cache.getIfPresent(index) != null).count();
        assertEquals(maximumSize, available);
    }
}
