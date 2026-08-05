package com.lifedashboard.game;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface GamingPlatformRepository extends JpaRepository<GamingPlatform, Long> {
    List<GamingPlatform> findAllByOrderByNameAsc();
    Optional<GamingPlatform> findByCode(String code);
}
