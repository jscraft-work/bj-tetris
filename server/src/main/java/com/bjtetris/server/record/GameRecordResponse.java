package com.bjtetris.server.record;

import java.time.Instant;

public record GameRecordResponse(
    String displayName, int score, int level, int lines, Instant playedAt) {

  public static GameRecordResponse from(GameRecord record) {
    return new GameRecordResponse(
        record.getDisplayName(),
        record.getScore(),
        record.getLevel(),
        record.getLines(),
        record.getPlayedAt());
  }
}
