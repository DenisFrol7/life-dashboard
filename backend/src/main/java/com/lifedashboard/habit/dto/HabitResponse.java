package com.lifedashboard.habit.dto;

import com.lifedashboard.habit.HabitDataSource;
import com.lifedashboard.habit.HabitScheduleType;
import com.lifedashboard.habit.HabitStatus;
import com.lifedashboard.habit.TrackingType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public record HabitResponse(
        Long id,
        String name,
        String description,
        TrackingType trackingType,
        HabitDataSource dataSource,
        BigDecimal targetValue,
        String unit,
        HabitScheduleType scheduleType,
        LocalDate startDate,
        LocalDate endDate,
        HabitStatus status,
        Set<Integer> scheduleDays
) {
}
