const PKCE_VERIFIER_STORAGE_KEY = 'bj-tetris.oauth.pkceVerifier';
const OAUTH_STATE_STORAGE_KEY = 'bj-tetris.oauth.state';
const OAUTH_TOKEN_STORAGE_KEY = 'bj-tetris.oauth.tokens';
const DEFAULT_SCOPE = 'openid profile email';
const PKCE_METHOD = 'S256';
const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function getAuthConfig() {
  const config = window.__BJ_TETRIS_AUTH_CONFIG__ || {};
  return {
    issuer: config.issuer || '',
    authorizeEndpoint: config.authorizeEndpoint || '',
    tokenEndpoint: config.tokenEndpoint || '',
    userInfoEndpoint: config.userInfoEndpoint || '',
    endSessionEndpoint: config.endSessionEndpoint || '',
    jwksUri: config.jwksUri || '',
    clientId: config.clientId || '',
    scope: config.scope || DEFAULT_SCOPE,
    redirectUri: config.redirectUri || new URL('./callback', window.location.href).toString(),
    additionalParams: config.additionalParams || {},
  };
}

function randomString(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => PKCE_CHARSET[byte % PKCE_CHARSET.length]).join('');
}

function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let output = '';
  bytes.forEach((byte) => {
    output += String.fromCharCode(byte);
  });

  return btoa(output).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createCodeChallenge(verifier) {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toBase64Url(digest);
}

function readPkceState() {
  return {
    verifier: sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY) || '',
    state: sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY) || '',
  };
}

function clearPkceState() {
  sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY);
}

export function getStoredTokens() {
  try {
    const value = sessionStorage.getItem(OAUTH_TOKEN_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens) {
  sessionStorage.setItem(OAUTH_TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

export async function beginLogin() {
  if (!window.crypto?.subtle) {
    throw new Error('현재 브라우저는 PKCE 로그인을 지원하지 않습니다.');
  }

  const { authorizeEndpoint, clientId, scope, redirectUri, additionalParams } = getAuthConfig();
  if (!authorizeEndpoint || !clientId) {
    throw new Error('인증 서버 설정이 비어 있습니다. authorizeEndpoint/clientId를 채워주세요.');
  }

  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = await createCodeChallenge(verifier);

  sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state);

  const authUrl = new URL(authorizeEndpoint);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', PKCE_METHOD);
  authUrl.searchParams.set('state', state);

  Object.entries(additionalParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      authUrl.searchParams.set(key, String(value));
    }
  });

  window.location.assign(authUrl.toString());
}

export async function exchangeAuthorizationCode(code, returnedState) {
  const { tokenEndpoint, clientId, redirectUri } = getAuthConfig();
  if (!tokenEndpoint || !clientId) {
    throw new Error('토큰 교환 설정이 비어 있습니다. tokenEndpoint/clientId를 채워주세요.');
  }

  const { verifier, state } = readPkceState();
  if (!code) {
    throw new Error('authorization code가 없습니다.');
  }
  if (!verifier || !state) {
    throw new Error('PKCE 세션 정보가 없습니다. 로그인부터 다시 시작하세요.');
  }
  if (returnedState !== state) {
    throw new Error('state 검증에 실패했습니다.');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', clientId);
  body.set('code', code);
  body.set('redirect_uri', redirectUri);
  body.set('code_verifier', verifier);

  let response;
  try {
    response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  } catch (error) {
    const pageProtocol = window.location.protocol;
    const tokenProtocol = new URL(tokenEndpoint).protocol;
    const hints = [];

    if (pageProtocol === 'https:' && tokenProtocol === 'http:') {
      hints.push('HTTPS 페이지에서 HTTP 토큰 엔드포인트로는 호출할 수 없습니다.');
    }
    if (tokenEndpoint.includes('127.0.0.1') || tokenEndpoint.includes('localhost')) {
      hints.push('127.0.0.1/localhost 는 현재 브라우저나 기기 자신을 가리킵니다.');
    }
    hints.push(`tokenEndpoint=${tokenEndpoint}`);

    throw new Error(
      `토큰 요청 자체가 실패했습니다. ${hints.join(' ')} ${
        error instanceof Error && error.message ? `원본 오류: ${error.message}` : ''
      }`.trim(),
    );
  }

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message =
      payload?.error_description || payload?.error || `토큰 교환에 실패했습니다. (${response.status})`;
    throw new Error(message);
  }

  clearPkceState();
  storeTokens(payload);
  return payload;
}
