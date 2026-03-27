package com.bjtetris.server.session;

import com.bjtetris.server.user.AppUser;

public record CurrentUser(Long id, String displayName, String email, String username) {

  public static CurrentUser from(AppUser user) {
    return new CurrentUser(user.getId(), user.getDisplayName(), user.getEmail(), user.getUsername());
  }
}
