package com.lifedashboard.book;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface BookProgressRepository extends JpaRepository<BookProgress,Long>{Optional<BookProgress> findByUserContentId(Long userContentId);}
