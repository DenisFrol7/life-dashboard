package com.lifedashboard.book.dto;
import jakarta.validation.constraints.PositiveOrZero;
public record BookProgressRequest(@PositiveOrZero int currentPage){}
