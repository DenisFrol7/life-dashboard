package com.lifedashboard.book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.*;
public interface BookProgressRepository extends JpaRepository<BookProgress,Long>{
    Optional<BookProgress> findByUserContentId(Long userContentId);
    @EntityGraph(attributePaths = "userContent")
    List<BookProgress> findAllByUserContentUserId(Long userId);
}
