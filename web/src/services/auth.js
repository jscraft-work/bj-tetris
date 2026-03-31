function getBackendBaseUrl() {
  return (window.__BJ_TETRIS_CONFIG__ && window.__BJ_TETRIS_CONFIG__.backendBaseUrl) || 'http://127.0.0.1:9001';
}

export function beginLogin() {
  window.location.assign(`${getBackendBaseUrl()}/oauth2/authorization/bj-auth`);
}
