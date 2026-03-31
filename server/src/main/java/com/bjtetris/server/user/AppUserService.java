package com.bjtetris.server.user;

import java.time.Instant;
import java.util.Map;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppUserService {

  private final AppUserRepository appUserRepository;

  public AppUserService(AppUserRepository appUserRepository) {
    this.appUserRepository = appUserRepository;
  }

  @Transactional
  public AppUser upsertFromUserInfo(String issuer, Map<String, Object> userInfo) {
    String subjectId = stringValue(userInfo, "sub");
    if (subjectId == null || subjectId.isBlank()) {
      throw new IllegalStateException("userinfo 응답에 sub가 없습니다.");
    }

    AppUser user =
        appUserRepository
            .findByIssuerAndSubjectId(issuer, subjectId)
            .orElseGet(AppUser::new);

    user.setIssuer(issuer);
    user.setSubjectId(subjectId);
    user.setEmail(stringValue(userInfo, "email"));
    user.setUsername(stringValue(userInfo, "preferred_username"));
    user.setDisplayName(resolveDisplayName(userInfo));
    user.setUpdatedAt(Instant.now());
    if (user.getCreatedAt() == null) {
      user.setCreatedAt(Instant.now());
    }

    return appUserRepository.save(user);
  }

  private String resolveDisplayName(Map<String, Object> userInfo) {
    String[] candidates = {"preferred_username", "nickname", "name", "email", "sub"};
    for (String candidate : candidates) {
      String value = stringValue(userInfo, candidate);
      if (value != null && !value.isBlank()) {
        if ("email".equals(candidate) && value.contains("@")) {
          return value.substring(0, value.indexOf('@'));
        }
        return value;
      }
    }
    return "player";
  }

  @Transactional(readOnly = true)
  public AppUser resolveFromOidc(OidcUser oidcUser) {
    String issuer = oidcUser.getIssuer().toString();
    String subject = oidcUser.getSubject();
    return appUserRepository.findByIssuerAndSubjectId(issuer, subject)
        .orElseThrow(() -> new IllegalStateException("사용자를 찾을 수 없습니다."));
  }

  private String stringValue(Map<String, Object> source, String key) {
    Object value = source.get(key);
    return value == null ? null : String.valueOf(value);
  }
}
