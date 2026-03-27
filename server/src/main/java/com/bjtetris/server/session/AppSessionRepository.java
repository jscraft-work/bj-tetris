package com.bjtetris.server.session;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppSessionRepository extends JpaRepository<AppSession, Long> {

  Optional<AppSession> findBySessionToken(String sessionToken);

  void deleteBySessionToken(String sessionToken);

  void deleteByExpiresAtBefore(Instant expiresAt);
}
