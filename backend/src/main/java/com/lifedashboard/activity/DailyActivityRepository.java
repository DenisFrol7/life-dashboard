package com.lifedashboard.activity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyActivityRepository extends JpaRepository<DailyActivity, Long> {

    Optional<DailyActivity> findByUserIdAndActivityDate(Long userId, LocalDate activityDate);

    List<DailyActivity> findAllByUserIdAndActivityDateBetweenOrderByActivityDateAsc(
            Long userId,
            LocalDate from,
            LocalDate to
    );
}
