package com.bjtetris.server.record;

import com.bjtetris.server.user.AppUser;
import com.bjtetris.server.user.AppUserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GameRecordController {

  private final AppUserService appUserService;
  private final GameRecordService gameRecordService;

  public GameRecordController(AppUserService appUserService, GameRecordService gameRecordService) {
    this.appUserService = appUserService;
    this.gameRecordService = gameRecordService;
  }

  @GetMapping("/leaderboard")
  public List<GameRecordResponse> leaderboard(@RequestParam(defaultValue = "50") int limit) {
    return gameRecordService.getLeaderboard(Math.min(Math.max(limit, 1), 100));
  }

  @GetMapping("/my-records")
  public ResponseEntity<?> myRecords(
      @RequestParam(defaultValue = "20") int limit,
      @AuthenticationPrincipal OidcUser oidcUser) {
    AppUser user = appUserService.resolveFromOidc(oidcUser);
    return ResponseEntity.ok(
        gameRecordService.getMyRecords(user.getId(), Math.min(Math.max(limit, 1), 100)));
  }

  @PostMapping("/records")
  public ResponseEntity<?> saveRecord(
      @Valid @RequestBody GameRecordRequest gameRecordRequest,
      @AuthenticationPrincipal OidcUser oidcUser) {
    AppUser user = appUserService.resolveFromOidc(oidcUser);
    gameRecordService.save(user, gameRecordRequest);
    return ResponseEntity.ok(Map.of("success", true));
  }
}
