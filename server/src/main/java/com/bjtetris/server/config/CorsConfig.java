package com.bjtetris.server.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

  private final AppProperties appProperties;

  public CorsConfig(AppProperties appProperties) {
    this.appProperties = appProperties;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    String allowedOrigin = appProperties.getFrontend().getBaseUrl();
    registry
        .addMapping("/api/**")
        .allowedOrigins(allowedOrigin)
        .allowedMethods("GET", "POST", "OPTIONS")
        .allowCredentials(true);
    registry
        .addMapping("/auth/logout")
        .allowedOrigins(allowedOrigin)
        .allowedMethods("POST", "OPTIONS")
        .allowCredentials(true);
  }
}
