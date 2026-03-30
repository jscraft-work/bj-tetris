const FORCE_LOGIN_KEY = 'bjTetris.forcePromptLogin';

function getBackendBaseUrl() {
  return (window.__BJ_TETRIS_CONFIG__ && window.__BJ_TETRIS_CONFIG__.backendBaseUrl) || 'http://127.0.0.1:9001';
}

export async function beginLogin() {
  const backendBaseUrl = getBackendBaseUrl();
  const shouldForcePrompt = sessionStorage.getItem(FORCE_LOGIN_KEY) === 'true';
  const loginUrl = new URL(`${backendBaseUrl}/auth/login`);
  if (shouldForcePrompt) {
    loginUrl.searchParams.set('prompt', 'login');
  }
  window.location.assign(loginUrl.toString());
}

export function markForcePromptLogin() {
  sessionStorage.setItem(FORCE_LOGIN_KEY, 'true');
}

export function clearForcePromptLogin() {
  sessionStorage.removeItem(FORCE_LOGIN_KEY);
}
