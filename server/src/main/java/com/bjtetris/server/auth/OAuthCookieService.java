package com.bjtetris.server.auth;

import com.bjtetris.server.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class OAuthCookieService {

  public record OAuthRequest(String state, String verifier) {}

  private static final String OAUTH_STATE_COOKIE = "BJ_TETRIS_OAUTH_STATE";
  private static final String OAUTH_VERIFIER_COOKIE = "BJ_TETRIS_OAUTH_VERIFIER";

  private final AppProperties appProperties;
  private final SecureRandom secureRandom = new SecureRandom();

  public OAuthCookieService(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  public OAuthRequest issue(HttpServletResponse response) {
    OAuthRequest oauthRequest = new OAuthRequest(generateToken(24), generateToken(48));
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(OAUTH_STATE_COOKIE, oauthRequest.state(), false));
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(OAUTH_VERIFIER_COOKIE, oauthRequest.verifier(), false));
    return oauthRequest;
  }

  public OAuthRequest read(HttpServletRequest request) {
    return new OAuthRequest(readCookieValue(request, OAUTH_STATE_COOKIE), readCookieValue(request, OAUTH_VERIFIER_COOKIE));
  }

  public void clear(HttpServletResponse response) {
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(OAUTH_STATE_COOKIE, "", true));
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(OAUTH_VERIFIER_COOKIE, "", true));
  }

  private String buildCookie(String name, String value, boolean expired) {
    ResponseCookie.ResponseCookieBuilder builder =
        ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(appProperties.getSession().isCookieSecure())
            .sameSite("Lax")
            .path("/auth");

    String domain = appProperties.getSession().getCookieDomain();
    if (domain != null && !domain.isBlank()) {
      builder.domain(domain);
    }

    builder.maxAge(expired ? 0 : 600);
    return builder.build().toString();
  }

  private String readCookieValue(HttpServletRequest request, String cookieName) {
    if (request.getCookies() == null) {
      return null;
    }

    for (Cookie cookie : request.getCookies()) {
      if (cookieName.equals(cookie.getName())) {
        return cookie.getValue();
      }
    }
    return null;
  }

  private String generateToken(int bytesLength) {
    byte[] bytes = new byte[bytesLength];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
