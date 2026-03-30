package com.bjtetris.server.session;

import com.bjtetris.server.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class SessionCookieService {

  private final AppProperties appProperties;
  private final AppSessionRepository appSessionRepository;
  private final SecureRandom secureRandom = new SecureRandom();

  public SessionCookieService(AppProperties appProperties, AppSessionRepository appSessionRepository) {
    this.appProperties = appProperties;
    this.appSessionRepository = appSessionRepository;
  }

  public AppSession createSession(com.bjtetris.server.user.AppUser user, String idToken) {
    AppSession session = new AppSession();
    session.setUser(user);
    session.setSessionToken(generateToken());
    session.setIdToken(idToken);
    session.setCreatedAt(Instant.now());
    session.setExpiresAt(Instant.now().plusSeconds(appProperties.getSession().getMaxAgeSeconds()));
    return appSessionRepository.save(session);
  }

  public Optional<AppSession> resolveSession(HttpServletRequest request) {
    String token = readCookieValue(request, appProperties.getSession().getCookieName());
    if (token == null || token.isBlank()) {
      return Optional.empty();
    }

    Optional<AppSession> session = appSessionRepository.findBySessionToken(token);
    if (session.isEmpty()) {
      return Optional.empty();
    }

    if (session.get().getExpiresAt().isBefore(Instant.now())) {
      appSessionRepository.delete(session.get());
      return Optional.empty();
    }

    return session;
  }

  public void writeSessionCookie(HttpServletResponse response, String sessionToken) {
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(appProperties.getSession().getCookieName(), sessionToken, false));
  }

  public void clearSessionCookie(HttpServletResponse response) {
    response.addHeader(HttpHeaders.SET_COOKIE, buildCookie(appProperties.getSession().getCookieName(), "", true));
  }

  public void invalidateSession(HttpServletRequest request, HttpServletResponse response) {
    resolveSession(request).ifPresent(appSessionRepository::delete);
    clearSessionCookie(response);
  }

  private String buildCookie(String name, String value, boolean expired) {
    ResponseCookie.ResponseCookieBuilder builder =
        ResponseCookie.from(name, value)
            .httpOnly(true)
            .secure(appProperties.getSession().isCookieSecure())
            .sameSite("Lax")
            .path("/");

    String domain = appProperties.getSession().getCookieDomain();
    if (domain != null && !domain.isBlank()) {
      builder.domain(domain);
    }

    builder.maxAge(expired ? 0 : appProperties.getSession().getMaxAgeSeconds());
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

  private String generateToken() {
    byte[] bytes = new byte[32];
    secureRandom.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }
}
