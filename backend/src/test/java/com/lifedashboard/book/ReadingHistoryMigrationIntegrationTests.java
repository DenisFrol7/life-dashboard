package com.lifedashboard.book;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ReadingHistoryMigrationIntegrationTests {
    @Autowired DataSource dataSource;

    @Test
    void migratesExistingHistoryWithoutChangingIdsValuesOrOwners() throws Exception {
        String schema = "reading_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway legacy = Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .target("34").cleanDisabled(false).load();
        try {
            legacy.migrate();
            try (Connection connection = dataSource.getConnection()) {
                String originalSchema = connection.getSchema();
                try {
                    connection.setSchema(schema);
                    JdbcTemplate jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
                    List<Long> bookIds = new ArrayList<>();
                    for (BookFormat format : BookFormat.values()) {
                        Long contentId = jdbc.queryForObject("""
                                INSERT INTO content_items(title,item_type,release_status)
                                VALUES (?,'BOOK','RELEASED') RETURNING id
                                """,Long.class,"Migration " + format);
                        boolean audio = format == BookFormat.AUDIOBOOK;
                        Long bookId = jdbc.queryForObject("""
                                INSERT INTO books(content_id,author,book_format,page_count,duration_minutes)
                                VALUES (?,'Author',?,?,?) RETURNING id
                                """,Long.class,contentId,format.name(),audio?null:200,audio?200:null);
                        bookIds.add(bookId);
                        seedHistory(jdbc,1L,contentId,audio);
                    }
                    Long otherUser = jdbc.queryForObject("""
                            INSERT INTO users(username,timezone) VALUES ('migration_other','Europe/Moscow') RETURNING id
                            """,Long.class);
                    Long firstContent = jdbc.queryForObject("SELECT content_id FROM books WHERE id=?",Long.class,bookIds.getFirst());
                    seedHistory(jdbc,otherUser,firstContent,false);
                    var progressBefore = jdbc.queryForList("SELECT id,current_page,current_minute,updated_at FROM book_progress ORDER BY id");
                    var sessionsBefore = jdbc.queryForList("SELECT id,started_at,duration_minutes,pages_read,listened_minutes,note FROM reading_sessions ORDER BY id");
                    var ownersBefore = jdbc.queryForList("""
                            SELECT progress.id,library.user_id,book.id AS book_id
                            FROM book_progress progress JOIN user_content library ON library.id=progress.user_content_id
                            JOIN books book ON book.content_id=library.content_id ORDER BY progress.id
                            """);

                    Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema).load().migrate();

                    assertEquals(progressBefore,jdbc.queryForList("SELECT id,current_page,current_minute,updated_at FROM book_progress ORDER BY id"));
                    assertEquals(sessionsBefore,jdbc.queryForList("SELECT id,started_at,duration_minutes,pages_read,listened_minutes,note FROM reading_sessions ORDER BY id"));
                    assertEquals(ownersBefore,jdbc.queryForList("SELECT id,user_id,book_id FROM book_progress ORDER BY id"));
                    assertEquals(3,jdbc.queryForObject("SELECT COUNT(*) FROM reading_sessions WHERE user_id=1",Integer.class));
                    assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM reading_sessions WHERE user_id=?",Integer.class,otherUser));

                    jdbc.update("DELETE FROM user_content");
                    assertEquals(4,jdbc.queryForObject("SELECT COUNT(*) FROM book_progress",Integer.class));
                    assertEquals(4,jdbc.queryForObject("SELECT COUNT(*) FROM reading_sessions",Integer.class));
                    jdbc.update("DELETE FROM books WHERE id=?",bookIds.getFirst());
                    assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM book_progress",Integer.class));
                    assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM reading_sessions",Integer.class));
                } finally {
                    connection.setSchema(originalSchema);
                }
            }
        } finally {
            // Flyway is restricted to the disposable schema created by this test.
            legacy.clean();
        }
    }

    private void seedHistory(JdbcTemplate jdbc,long userId,long contentId,boolean audio) {
        Long libraryId = jdbc.queryForObject("""
                INSERT INTO user_content(user_id,content_id,status) VALUES (?,?,'IN_PROGRESS') RETURNING id
                """,Long.class,userId,contentId);
        jdbc.update("""
                INSERT INTO book_progress(user_content_id,current_page,current_minute,updated_at)
                VALUES (?,?,?,'2020-02-01T12:00:00Z')
                """,libraryId,audio?0:70,audio?70:0);
        jdbc.update("""
                INSERT INTO reading_sessions(user_content_id,started_at,duration_minutes,pages_read,listened_minutes,note)
                VALUES (?,'2020-02-01T12:00:00Z',30,?,?,'Original session')
                """,libraryId,audio?0:20,audio?20:0);
    }
}
