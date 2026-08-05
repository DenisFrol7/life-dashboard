package com.lifedashboard.content;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface UserContentRepository extends JpaRepository<UserContent, Long> {
    Optional<UserContent> findByUserIdAndContentId(Long userId, Long contentId);
    List<UserContent> findAllByUserIdOrderByIdDesc(Long userId);
    List<UserContent> findAllByUserIdAndStatusOrderByIdDesc(Long userId, UserContentStatus status);
}
