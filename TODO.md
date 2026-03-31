# TODO

## OAuth 플로우 개선
- [ ] OAuth 콜백을 프론트엔드(tetris.jscraft.work)로 변경하여 tetris-api URL 노출 제거
  - PKCE 생성을 프론트에서 처리 (code_verifier → sessionStorage)
  - auth 서버 리다이렉트를 프론트에서 직접
  - 콜백 → 프론트 → 백엔드 API로 code 교환

## auth-dev 점검 결과
- [ ] ID 토큰에 displayName 클레임 추가 (OAuth2TokenCustomizer)
- [ ] OIDC Logout 엔드포인트 활성화 (.logoutEndpoint)
- [ ] 동의 화면 커스터마이징 (consent.html)
- [x] 회원가입 약관 검증 (@AssertTrue)
- [ ] 토큰 유효기간 설정 (access token 5분 → 30분~1시간)
- [ ] RegisteredClient 시드 데이터 업데이트 로직

## bj-tetris 백엔드 개선
- [ ] Spring Security OAuth2 Client 도입 → 자체 세션 관리 코드 제거 (슬라이딩 세션 포함)
- [ ] 세션 만료 시 사용자 알림 + 로그인 화면 이동
- [ ] X-Forwarded-Proto 헤더 확인 (cloudflared 환경)
