package com.bjtetris.server.session;

import com.bjtetris.server.user.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController {

  private final CurrentUserService currentUserService;

  public UserController(CurrentUserService currentUserService) {
    this.currentUserService = currentUserService;
  }

  @GetMapping("/me")
  public ResponseEntity<?> me(HttpServletRequest request) {
    return currentUserService
        .resolve(request)
        .<ResponseEntity<?>>map(user -> ResponseEntity.ok(CurrentUser.from(user)))
        .orElseGet(() -> ResponseEntity.status(401).body(Map.of("error", "Unauthorized")));
  }
}
