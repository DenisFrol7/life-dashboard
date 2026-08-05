package com.lifedashboard.content;
import org.springframework.data.jpa.repository.JpaRepository; import java.util.*;
public interface ContentSeasonRepository extends JpaRepository<ContentSeason,Long>{
 List<ContentSeason> findAllByContentIdOrderBySeasonNumber(Long id); boolean existsByContentIdAndSeasonNumber(Long id,Integer n);
}
