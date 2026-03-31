package com.bjtetris.server.config;

import com.bjtetris.server.user.AppUserService;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

  private final AppProperties appProperties;
  private final AppUserService appUserService;
  private final ClientRegistrationRepository clientRegistrationRepository;

  public SecurityConfig(
      AppProperties appProperties,
      AppUserService appUserService,
      ClientRegistrationRepository clientRegistrationRepository) {
    this.appProperties = appProperties;
    this.appUserService = appUserService;
    this.clientRegistrationRepository = clientRegistrationRepository;
  }

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    String frontendBaseUrl = appProperties.getFrontend().getBaseUrl();

    http
        .csrf(csrf -> csrf.disable())
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/health", "/api/leaderboard").permitAll()
            .requestMatchers("/api/**").authenticated()
            .anyRequest().permitAll())
        .exceptionHandling(ex -> ex
            .defaultAuthenticationEntryPointFor(
                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                new AntPathRequestMatcher("/api/**")))
        .oauth2Login(oauth2 -> oauth2
            .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService()))
            .defaultSuccessUrl(frontendBaseUrl, true)
            .failureHandler((request, response, exception) ->
                response.sendRedirect(frontendBaseUrl + "?authError=" + exception.getMessage())))
        .logout(logout -> logout
            .logoutRequestMatcher(new AntPathRequestMatcher("/auth/logout", "GET"))
            .logoutSuccessHandler(oidcLogoutSuccessHandler()));

    return http.build();
  }

  private OAuth2UserService<OAuth2UserRequest, OidcUser> oidcUserService() {
    OidcUserService delegate = new OidcUserService();
    return userRequest -> {
      OidcUser oidcUser = delegate.loadUser(userRequest);
      String issuer = oidcUser.getIssuer().toString();
      appUserService.upsertFromUserInfo(issuer, oidcUser.getClaims());
      return oidcUser;
    };
  }

  private OidcClientInitiatedLogoutSuccessHandler oidcLogoutSuccessHandler() {
    OidcClientInitiatedLogoutSuccessHandler handler =
        new OidcClientInitiatedLogoutSuccessHandler(clientRegistrationRepository);
    handler.setPostLogoutRedirectUri(appProperties.getFrontend().getBaseUrl());
    return handler;
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of(appProperties.getFrontend().getBaseUrl()));
    config.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
    config.setAllowCredentials(true);
    config.setAllowedHeaders(List.of("*"));

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    source.registerCorsConfiguration("/auth/**", config);
    return source;
  }
}
