package com.bjtetris.server.record;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameRecordRepository extends JpaRepository<GameRecord, Long> {

  List<GameRecord> findByUser_IdOrderByScoreDescPlayedAtDesc(Long userId, Pageable pageable);

  List<GameRecord> findAllByOrderByScoreDescPlayedAtDesc(Pageable pageable);
}
