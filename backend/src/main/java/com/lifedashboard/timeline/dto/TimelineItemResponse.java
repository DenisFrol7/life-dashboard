package com.lifedashboard.timeline.dto;

public record TimelineItemResponse(String id, String kind, String time, String title, String detail,
                                   String value, Integer durationMinutes, boolean completed) {}
