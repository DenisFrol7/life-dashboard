package com.lifedashboard.content;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ContentItemRepository extends JpaRepository<ContentItem, Long> {
    List<ContentItem> findAllByOrderByTitleAsc();
    List<ContentItem> findAllByItemTypeOrderByTitleAsc(ContentType itemType);
    Optional<ContentItem> findByTitle(String title);
}
