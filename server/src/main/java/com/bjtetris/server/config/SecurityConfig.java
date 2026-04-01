package com.bjtetris.server.config;

import com.bjtetris.server.user.AppUserService;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.oidc.web.logout.OidcClientInitiatedLogoutSuccessHandler;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
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
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/health", "/api/leaderboard").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                new AntPathRequestMatcher("/api/**")
                        )
                )
                .oauth2Login(oauth2 -> oauth2
                        .authorizationEndpoint(auth -> auth
                                .authorizationRedirectStrategy((request, response, url) -> {
                                    response.setStatus(200);
                                    response.setContentType("application/json");
                                    String json = new ObjectMapper().writeValueAsString(Map.of("authorizeUrl", url));
                                    response.setContentLength(json.getBytes().length);
                                    response.getWriter().write(json);
                                    response.getWriter().flush();
                                })
                        )
                        .userInfoEndpoint(userInfo -> userInfo.oidcUserService(oidcUserService()))
                        .successHandler((request, response, authentication) -> {
                            response.setStatus(200);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"success\":true}");
                            response.getWriter().flush();
                        })
                        .failureHandler((request, response, exception) ->
                                response.sendRedirect(frontendBaseUrl + "?authError=" + exception.getMessage())
                        )
                )
                .logout(logout -> logout
                        .logoutRequestMatcher(new AntPathRequestMatcher("/auth/logout", "GET"))
                        .logoutSuccessHandler((request, response, authentication) -> {
                            var delegate = oidcLogoutSuccessHandler();
                            delegate.setRedirectStrategy((req, res, url) -> {
                                res.setStatus(200);
                                res.setContentType("application/json");
                                res.getWriter().write("{\"logoutUrl\":\"" + url + "\"}");
                                res.getWriter().flush();
                            });
                            delegate.onLogoutSuccess(request, response, authentication);
                        })
                );

        return http.build();
    }

    private OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService() {
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
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
