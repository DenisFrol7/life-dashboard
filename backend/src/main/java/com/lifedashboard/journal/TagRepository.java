package com.lifedashboard.journal;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TagRepository extends JpaRepository<Tag, Long> {

    List<Tag> findAllByUserIdOrderByNameAscIdAsc(Long userId);

    Optional<Tag> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndSlug(Long userId, String slug);

    boolean existsByUserIdAndSlugAndIdNot(Long userId, String slug, Long id);
}
