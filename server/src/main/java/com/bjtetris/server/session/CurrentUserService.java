package com.bjtetris.server.session;

import com.bjtetris.server.user.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

  private final SessionCookieService sessionCookieService;

  public CurrentUserService(SessionCookieService sessionCookieService) {
    this.sessionCookieService = sessionCookieService;
  }

  public Optional<AppUser> resolve(HttpServletRequest request) {
    return sessionCookieService.resolveSession(request).map(AppSession::getUser);
  }
}
