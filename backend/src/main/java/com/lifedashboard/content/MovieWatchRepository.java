package com.lifedashboard.content;
import org.springframework.data.jpa.repository.*; import org.springframework.data.repository.query.Param; import java.util.*;
public interface MovieWatchRepository extends JpaRepository<MovieWatch,Long>{
 List<MovieWatch> findAllByContentIdAndUserIdOrderByWatchNumber(Long c,Long u);
 Optional<MovieWatch> findByIdAndUserId(Long id,Long userId);
 @Query("select coalesce(max(w.watchNumber),0) from MovieWatch w where w.content.id=:c and w.user.id=:u") int maxNumber(@Param("c")Long c,@Param("u")Long u);
}
