package com.bjtetris.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

  private final Auth auth = new Auth();
  private final Session session = new Session();

  public Auth getAuth() {
    return auth;
  }

  public Session getSession() {
    return session;
  }

  public static class Auth {
    private String issuer;
    private String authorizeEndpoint;
    private String tokenEndpoint;
    private String userInfoEndpoint;
    private String clientId;
    private String scope = "openid";

    public String getIssuer() {
      return issuer;
    }

    public void setIssuer(String issuer) {
      this.issuer = issuer;
    }

    public String getAuthorizeEndpoint() {
      return authorizeEndpoint;
    }

    public void setAuthorizeEndpoint(String authorizeEndpoint) {
      this.authorizeEndpoint = authorizeEndpoint;
    }

    public String getTokenEndpoint() {
      return tokenEndpoint;
    }

    public void setTokenEndpoint(String tokenEndpoint) {
      this.tokenEndpoint = tokenEndpoint;
    }

    public String getUserInfoEndpoint() {
      return userInfoEndpoint;
    }

    public void setUserInfoEndpoint(String userInfoEndpoint) {
      this.userInfoEndpoint = userInfoEndpoint;
    }

    public String getClientId() {
      return clientId;
    }

    public void setClientId(String clientId) {
      this.clientId = clientId;
    }

    public String getScope() {
      return scope;
    }

    public void setScope(String scope) {
      this.scope = scope;
    }
  }

  public static class Session {
    private String cookieName = "BJ_TETRIS_SESSION";
    private String cookieDomain;
    private boolean cookieSecure;
    private long maxAgeSeconds = 1209600;

    public String getCookieName() {
      return cookieName;
    }

    public void setCookieName(String cookieName) {
      this.cookieName = cookieName;
    }

    public String getCookieDomain() {
      return cookieDomain;
    }

    public void setCookieDomain(String cookieDomain) {
      this.cookieDomain = cookieDomain;
    }

    public boolean isCookieSecure() {
      return cookieSecure;
    }

    public void setCookieSecure(boolean cookieSecure) {
      this.cookieSecure = cookieSecure;
    }

    public long getMaxAgeSeconds() {
      return maxAgeSeconds;
    }

    public void setMaxAgeSeconds(long maxAgeSeconds) {
      this.maxAgeSeconds = maxAgeSeconds;
    }
  }
}
