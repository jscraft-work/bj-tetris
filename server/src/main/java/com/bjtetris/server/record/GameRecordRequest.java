package com.bjtetris.server.record;

import jakarta.validation.constraints.Min;

public record GameRecordRequest(@Min(0) int score, @Min(1) int level, @Min(0) int lines) {}
