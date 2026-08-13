package com.lifedashboard.content.dto;

import java.time.Instant;

public record MediaTimelineResponse(String id, Instant occurredAt, String title, String detail,
                                    Integer durationMinutes) {}
