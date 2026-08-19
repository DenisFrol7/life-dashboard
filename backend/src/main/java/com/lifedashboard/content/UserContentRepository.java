package com.lifedashboard.content;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.*;

public interface UserContentRepository extends JpaRepository<UserContent, Long> {
    Optional<UserContent> findByUserIdAndContentId(Long userId, Long contentId);
    @EntityGraph(attributePaths = "content")
    List<UserContent> findAllByUserIdOrderByIdDesc(Long userId);
    List<UserContent> findAllByUserIdAndStatusOrderByIdDesc(Long userId, UserContentStatus status);
    List<UserContent> findAllByContentId(Long contentId);
}
