package com.lifedashboard.book;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.*;
public interface BookProgressRepository extends JpaRepository<BookProgress,Long>{
    Optional<BookProgress> findByUserIdAndBookId(Long userId,Long bookId);
    @EntityGraph(attributePaths = "book")
    List<BookProgress> findAllByUserId(Long userId);
    void deleteByUserIdAndBookId(Long userId,Long bookId);
}
