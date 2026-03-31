package com.bjtetris.server.auth;

import com.bjtetris.server.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Component
public class OAuthClient {

  private final RestClient restClient;
  private final AppProperties appProperties;

  public OAuthClient(AppProperties appProperties) {
    this.appProperties = appProperties;
    this.restClient = RestClient.builder().build();
  }

  public String buildAuthorizeUrl(String redirectUri, String state, String verifier, boolean forcePrompt) {
    String challenge = createCodeChallenge(verifier);
    var builder =
        org.springframework.web.util.UriComponentsBuilder.fromHttpUrl(appProperties.getAuth().getAuthorizeEndpoint())
            .queryParam("response_type", "code")
            .queryParam("client_id", appProperties.getAuth().getClientId())
            .queryParam("redirect_uri", redirectUri)
            .queryParam("scope", appProperties.getAuth().getScope())
            .queryParam("state", state)
            .queryParam("code_challenge", challenge)
            .queryParam("code_challenge_method", "S256");
    if (forcePrompt) {
      builder.queryParam("prompt", "login");
    }
    return builder.build().encode().toUriString();
  }

  public Map<String, Object> exchangeCode(String code, String redirectUri, String verifier) {
    MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
    body.add("grant_type", "authorization_code");
    body.add("client_id", appProperties.getAuth().getClientId());
    body.add("code", code);
    body.add("redirect_uri", redirectUri);
    body.add("code_verifier", verifier);

    return restClient
        .post()
        .uri(appProperties.getAuth().getTokenEndpoint())
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .body(body)
        .retrieve()
        .body(new ParameterizedTypeReference<>() {});
  }

  public Map<String, Object> fetchUserInfo(String accessToken) {
    Map<String, Object> response =
        restClient
            .get()
            .uri(appProperties.getAuth().getUserInfoEndpoint())
            .headers(headers -> headers.setBearerAuth(accessToken))
            .retrieve()
            .body(new ParameterizedTypeReference<>() {});

    return response == null ? new LinkedHashMap<>() : response;
  }

  public String buildLogoutUrl(String postLogoutRedirectUri, String idTokenHint) {
    String endSessionEndpoint = appProperties.getAuth().getEndSessionEndpoint();
    if (endSessionEndpoint == null || endSessionEndpoint.isBlank()) {
      return postLogoutRedirectUri;
    }

    var builder =
        org.springframework.web.util.UriComponentsBuilder.fromHttpUrl(endSessionEndpoint)
            .queryParam("post_logout_redirect_uri", postLogoutRedirectUri);
    if (idTokenHint != null && !idTokenHint.isBlank()) {
      builder.queryParam("id_token_hint", idTokenHint);
    }
    return builder.build().encode().toUriString();
  }

  private String createCodeChallenge(String verifier) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(verifier.getBytes(StandardCharsets.UTF_8));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", e);
    }
  }
}
