function getBackendBaseUrl() {
  return (window.__BJ_TETRIS_CONFIG__ && window.__BJ_TETRIS_CONFIG__.backendBaseUrl) || 'http://127.0.0.1:9001';
}

export async function beginLogin() {
  const url = `${getBackendBaseUrl()}/oauth2/authorization/bj-auth`;
  console.log('[auth] fetching:', url);
  const res = await fetch(url, { credentials: 'include' });
  console.log('[auth] status:', res.status);
  console.log('[auth] content-length:', res.headers.get('content-length'));
  const text = await res.text();
  console.log('[auth] body length:', text.length);
  console.log('[auth] body:', text);
  const data = JSON.parse(text);
  window.location.href = data.authorizeUrl;
}
