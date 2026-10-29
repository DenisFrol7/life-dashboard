package com.lifedashboard.game;

import com.lifedashboard.content.*;
import com.lifedashboard.game.dto.GameLibraryResponse;
import com.lifedashboard.game.dto.ReferenceResponse;
import com.lifedashboard.user.User;
import com.lifedashboard.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class GameLibraryQueryIntegrationTests {
    private static final Instant ACQUIRED = Instant.parse("2020-01-01T12:00:00Z");
    private static final Instant STARTED = Instant.parse("2026-01-01T12:00:00Z");
    private static final Instant COMPLETED = Instant.parse("2026-02-01T12:00:00Z");

    @Autowired GameLibraryService service;
    @Autowired UserGameRepository games;
    @Autowired ContentItemRepository content;
    @Autowired UserContentRepository profiles;
    @Autowired UserRepository users;
    @Autowired GamingPlatformRepository platforms;
    @Autowired GameSourceRepository sources;
    @Autowired EntityManager entityManager;
    @Autowired EntityManagerFactory entityManagerFactory;

    private Statistics statistics;
    private boolean statisticsWereEnabled;
    private User owner;
    private GamingPlatform pc;
    private GamingPlatform xbox;
    private GameSource steam;
    private GameSource gamePass;

    @BeforeEach
    void setUp() {
        statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statisticsWereEnabled = statistics.isStatisticsEnabled();
        statistics.setStatisticsEnabled(true);
        owner = users.findById(1L).orElseThrow();
        pc = platforms.findByCode("PC").orElseThrow();
        xbox = platforms.findByCode("XBOX_360").orElseThrow();
        steam = sources.findByCode("STEAM").orElseThrow();
        gamePass = sources.findByCode("GAME_PASS").orElseThrow();
    }

    @AfterEach
    void restoreStatisticsSetting() {
        statistics.setStatisticsEnabled(statisticsWereEnabled);
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 30})
    void loadsAllResponseFieldsInOneQueryRegardlessOfLibrarySize(int count) {
        List<GameLibraryResponse> expected = new ArrayList<>();
        for (int index = 0; index < count; index++) {
            var profile = createProfile(owner, "Query test game " + index);
            expected.add(createCopy(profile, index % 2 == 0 ? pc : xbox,
                    index % 2 == 0 ? steam : gamePass, UserContentStatus.COMPLETED, index));
        }
        expected.sort(Comparator.comparing(GameLibraryResponse::id).reversed());
        flushAndClear();
        long statementsBefore = statistics.getPrepareStatementCount();

        var actual = service.getAll(null, null);

        assertEquals(expected, actual);
        assertEquals(1, statistics.getPrepareStatementCount() - statementsBefore,
                "Library loading and DTO mapping must not query each game's related entities separately");
    }

    @ParameterizedTest
    @CsvSource({"false,false", "true,false", "false,true", "true,true"})
    void preservesCopyFiltersOrderingAndUserIsolation(boolean filterStatus, boolean filterPlatform) {
        var sharedProfile = createProfile(owner, "Game with multiple copies");
        // The profile is PLANNED, while individual copies have different statuses.
        var first = createCopy(sharedProfile, pc, steam, UserContentStatus.COMPLETED, 1);
        var second = createCopy(sharedProfile, xbox, gamePass, UserContentStatus.IN_PROGRESS, 2);
        var third = createCopy(createProfile(owner, "Another game"), pc, gamePass,
                UserContentStatus.IN_PROGRESS, 3);
        User anotherUser = users.save(new User("game-query-other-user", "Other user", null, "Europe/Moscow"));
        createCopy(createProfile(anotherUser, "Another user's game"), pc, steam,
                UserContentStatus.IN_PROGRESS, 4);
        Long platformId = filterPlatform ? pc.getId() : null;
        UserContentStatus status = filterStatus ? UserContentStatus.IN_PROGRESS : null;
        List<GameLibraryResponse> expected = List.of(third, second, first).stream()
                .filter(entry -> status == null || entry.status() == status)
                .filter(entry -> platformId == null || entry.platform().id().equals(platformId))
                .toList();
        flushAndClear();
        long statementsBefore = statistics.getPrepareStatementCount();

        var actual = service.getAll(status, platformId);

        assertEquals(expected, actual);
        assertEquals(1, statistics.getPrepareStatementCount() - statementsBefore);
    }

    @Test
    void emptyFilteredLibraryStillUsesOneQuery() {
        createCopy(createProfile(owner, "Excluded game"), pc, steam, UserContentStatus.COMPLETED, 1);
        flushAndClear();
        long statementsBefore = statistics.getPrepareStatementCount();

        assertTrue(service.getAll(UserContentStatus.IN_PROGRESS, xbox.getId()).isEmpty());

        assertEquals(1, statistics.getPrepareStatementCount() - statementsBefore);
    }

    private UserContent createProfile(User user, String title) {
        ContentItem item = new ContentItem(title);
        item.update(title, null, ContentType.GAME, null, 2020, null, null, null,
                ReleaseStatus.RELEASED, null, null, null, false);
        content.save(item);
        UserContent profile = new UserContent(user, item);
        profile.update(UserContentStatus.PLANNED, (short) 9, true, null, null, "Shared personal note");
        return profiles.save(profile);
    }

    private GameLibraryResponse createCopy(UserContent profile, GamingPlatform platform, GameSource source,
            UserContentStatus status, int index) {
        GameAccessType access = source.getSourceType() == GameSourceType.SUBSCRIPTION
                ? GameAccessType.SUBSCRIPTION : GameAccessType.OWNED;
        Instant completed = status == UserContentStatus.COMPLETED ? COMPLETED : null;
        UserGame game = new UserGame(profile);
        game.update(platform, source, access, "Edition " + index, ACQUIRED, "Copy note " + index,
                100L + index, status, STARTED, completed);
        game.linkSteamApp(100000L + index);
        game.linkXboxTitle(200000L + index);
        games.save(game);
        return new GameLibraryResponse(game.getId(), profile.getContent().getId(), profile.getContent().getTitle(),
                new ReferenceResponse(platform.getId(), platform.getCode(), platform.getName(), null),
                new ReferenceResponse(source.getId(), source.getCode(), source.getName(), source.getSourceType().name()),
                access, "Edition " + index, ACQUIRED, "Copy note " + index, status, (short) 9, true,
                STARTED, completed, "Shared personal note", 100L + index, 100000L + index, 200000L + index);
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
