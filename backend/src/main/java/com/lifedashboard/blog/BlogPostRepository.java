package com.lifedashboard.blog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface BlogPostRepository extends JpaRepository<BlogPost, Long>, JpaSpecificationExecutor<BlogPost> {

    Optional<BlogPost> findByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndSlug(Long userId, String slug);

    boolean existsByUserIdAndSlugAndIdNot(Long userId, String slug, Long id);
}
