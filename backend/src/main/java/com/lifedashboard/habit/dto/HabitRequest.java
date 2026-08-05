package com.lifedashboard.habit.dto;

import com.lifedashboard.habit.HabitDataSource;
import com.lifedashboard.habit.HabitScheduleType;
import com.lifedashboard.habit.HabitStatus;
import com.lifedashboard.habit.TrackingType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public record HabitRequest(
        @NotBlank @Size(max = 200) String name,
        String description,
        @NotNull TrackingType trackingType,
        @NotNull HabitDataSource dataSource,
        @DecimalMin("0.00") @Digits(integer = 12, fraction = 2) BigDecimal targetValue,
        @Size(max = 50) String unit,
        @NotNull HabitScheduleType scheduleType,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        @NotNull HabitStatus status,
        Set<@NotNull @Min(1) @Max(7) Integer> scheduleDays
) {
}
