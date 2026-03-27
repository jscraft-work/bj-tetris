package com.bjtetris.server.auth;

import com.bjtetris.server.config.AppProperties;
import com.bjtetris.server.session.AppSession;
import com.bjtetris.server.session.SessionCookieService;
import com.bjtetris.server.user.AppUser;
import com.bjtetris.server.user.AppUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.view.RedirectView;
import org.springframework.web.util.UriComponentsBuilder;

@Controller
@RequestMapping("/auth")
public class AuthController {

  private final AppProperties appProperties;
  private final OAuthCookieService oAuthCookieService;
  private final OAuthClient oAuthClient;
  private final AppUserService appUserService;
  private final SessionCookieService sessionCookieService;

  public AuthController(
      AppProperties appProperties,
      OAuthCookieService oAuthCookieService,
      OAuthClient oAuthClient,
      AppUserService appUserService,
      SessionCookieService sessionCookieService) {
    this.appProperties = appProperties;
    this.oAuthCookieService = oAuthCookieService;
    this.oAuthClient = oAuthClient;
    this.appUserService = appUserService;
    this.sessionCookieService = sessionCookieService;
  }

  @GetMapping("/login")
  public RedirectView login(HttpServletRequest request, HttpServletResponse response) {
    OAuthCookieService.OAuthRequest oAuthRequest = oAuthCookieService.issue(response);
    String authorizeUrl =
        oAuthClient.buildAuthorizeUrl(buildCallbackUrl(request), oAuthRequest.state(), oAuthRequest.verifier());
    return new RedirectView(authorizeUrl);
  }

  @GetMapping("/callback")
  public RedirectView callback(
      @RequestParam(required = false) String code,
      @RequestParam(required = false) String state,
      @RequestParam(required = false) String error,
      @RequestParam(name = "error_description", required = false) String errorDescription,
      HttpServletRequest request,
      HttpServletResponse response) {
    try {
      if (error != null && !error.isBlank()) {
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, errorDescription == null ? error : errorDescription);
      }

      OAuthCookieService.OAuthRequest cookies = oAuthCookieService.read(request);
      if (cookies.state() == null || cookies.verifier() == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OAuth 상태 쿠키가 없습니다.");
      }
      if (state == null || !state.equals(cookies.state())) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "OAuth state 검증에 실패했습니다.");
      }
      if (code == null || code.isBlank()) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "authorization code가 없습니다.");
      }

      Map<String, Object> tokenResponse = oAuthClient.exchangeCode(code, buildCallbackUrl(request), cookies.verifier());
      String accessToken = stringValue(tokenResponse, "access_token");
      if (accessToken == null || accessToken.isBlank()) {
        throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "토큰 응답에 access_token이 없습니다.");
      }

      Map<String, Object> userInfo = oAuthClient.fetchUserInfo(accessToken);
      AppUser user = appUserService.upsertFromUserInfo(appProperties.getAuth().getIssuer(), userInfo);
      AppSession session = sessionCookieService.createSession(user);
      sessionCookieService.writeSessionCookie(response, session.getSessionToken());
      oAuthCookieService.clear(response);
      return new RedirectView("/");
    } catch (RuntimeException e) {
      oAuthCookieService.clear(response);
      return new RedirectView("/?authError=" + encode(e.getMessage()));
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
    sessionCookieService.invalidateSession(request, response);
    return ResponseEntity.noContent().build();
  }

  private String buildCallbackUrl(HttpServletRequest request) {
    return UriComponentsBuilder.fromHttpUrl(request.getRequestURL().toString())
        .replacePath(request.getContextPath() + "/auth/callback")
        .replaceQuery(null)
        .build()
        .toUriString();
  }

  private String encode(String message) {
    return java.net.URLEncoder.encode(message == null ? "로그인 실패" : message, java.nio.charset.StandardCharsets.UTF_8);
  }

  private String stringValue(Map<String, Object> source, String key) {
    Object value = source.get(key);
    return value == null ? null : String.valueOf(value);
  }
}
