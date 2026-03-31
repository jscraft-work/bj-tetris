package com.bjtetris.server.user;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class UserController {

  private final AppUserService appUserService;

  public UserController(AppUserService appUserService) {
    this.appUserService = appUserService;
  }

  @GetMapping("/me")
  public ResponseEntity<CurrentUser> me(@AuthenticationPrincipal OidcUser oidcUser) {
    AppUser user = appUserService.resolveFromOidc(oidcUser);
    return ResponseEntity.ok(CurrentUser.from(user));
  }
}
