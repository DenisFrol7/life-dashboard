package com.lifedashboard.game;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface GameSourceRepository extends JpaRepository<GameSource, Long> {
    List<GameSource> findAllByOrderByNameAsc();
    Optional<GameSource> findByCode(String code);
}
