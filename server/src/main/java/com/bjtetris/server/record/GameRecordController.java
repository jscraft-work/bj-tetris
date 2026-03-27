package com.bjtetris.server.record;

import com.bjtetris.server.session.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GameRecordController {

  private final CurrentUserService currentUserService;
  private final GameRecordService gameRecordService;

  public GameRecordController(CurrentUserService currentUserService, GameRecordService gameRecordService) {
    this.currentUserService = currentUserService;
    this.gameRecordService = gameRecordService;
  }

  @GetMapping("/leaderboard")
  public List<GameRecordResponse> leaderboard(@RequestParam(defaultValue = "50") int limit) {
    return gameRecordService.getLeaderboard(Math.min(Math.max(limit, 1), 100));
  }

  @GetMapping("/my-records")
  public ResponseEntity<?> myRecords(
      @RequestParam(defaultValue = "20") int limit, HttpServletRequest request) {
    return currentUserService
        .resolve(request)
        .<ResponseEntity<?>>map(
            user -> ResponseEntity.ok(gameRecordService.getMyRecords(user.getId(), Math.min(Math.max(limit, 1), 100))))
        .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "Unauthorized")));
  }

  @PostMapping("/records")
  public ResponseEntity<?> saveRecord(
      @Valid @RequestBody GameRecordRequest gameRecordRequest, HttpServletRequest request) {
    return currentUserService
        .resolve(request)
        .<ResponseEntity<?>>map(
            user -> {
              gameRecordService.save(user, gameRecordRequest);
              return ResponseEntity.ok(Map.of("success", true));
            })
        .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "Unauthorized")));
  }
}
