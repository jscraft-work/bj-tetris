package com.bjtetris.server.record;

import com.bjtetris.server.user.AppUser;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GameRecordService {

  private final GameRecordRepository gameRecordRepository;

  public GameRecordService(GameRecordRepository gameRecordRepository) {
    this.gameRecordRepository = gameRecordRepository;
  }

  @Transactional
  public void save(AppUser user, GameRecordRequest request) {
    GameRecord record = new GameRecord();
    record.setUser(user);
    record.setDisplayName(user.getDisplayName());
    record.setScore(request.score());
    record.setLevel(request.level());
    record.setLines(request.lines());
    record.setPlayedAt(Instant.now());
    gameRecordRepository.save(record);
  }

  @Transactional(readOnly = true)
  public List<GameRecordResponse> getLeaderboard(int limit) {
    return gameRecordRepository.findAllByOrderByScoreDescPlayedAtDesc(PageRequest.of(0, limit)).stream()
        .map(GameRecordResponse::from)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<GameRecordResponse> getMyRecords(Long userId, int limit) {
    return gameRecordRepository.findByUser_IdOrderByScoreDescPlayedAtDesc(userId, PageRequest.of(0, limit)).stream()
        .map(GameRecordResponse::from)
        .toList();
  }
}
