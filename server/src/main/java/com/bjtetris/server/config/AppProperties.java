package com.bjtetris.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

  private final Frontend frontend = new Frontend();

  public Frontend getFrontend() {
    return frontend;
  }

  public static class Frontend {
    private String baseUrl = "http://127.0.0.1:5500";

    public String getBaseUrl() {
      return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
    }
  }
}
