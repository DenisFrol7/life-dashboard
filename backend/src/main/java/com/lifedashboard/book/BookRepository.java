package com.lifedashboard.book;
import org.springframework.data.jpa.repository.*;
import java.util.*;
public interface BookRepository extends JpaRepository<Book,Long>{
    @EntityGraph(attributePaths = "content")
    @Query("select b from Book b order by b.content.title") List<Book> findCatalog();
    Optional<Book> findByContentId(Long contentId);
}
