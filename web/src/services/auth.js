function getBackendBaseUrl() {
  return (window.__BJ_TETRIS_CONFIG__ && window.__BJ_TETRIS_CONFIG__.backendBaseUrl) || 'http://127.0.0.1:9001';
}

export async function beginLogin() {
  const res = await fetch(`${getBackendBaseUrl()}/oauth2/authorization/bj-auth`, {
    credentials: 'include',
  });
  const data = await res.json();
  window.location.href = data.authorizeUrl;
}
