function getBackendBaseUrl() {
  return (window.__BJ_TETRIS_CONFIG__ && window.__BJ_TETRIS_CONFIG__.backendBaseUrl) || 'http://127.0.0.1:9001';
}

export async function beginLogin() {
  const res = await fetch(`${getBackendBaseUrl()}/oauth2/authorization/bj-auth`, {
      credentials: 'include',
    });
    const data = await res.json();

    // 2. auth서버로 직접 리다이렉트
    window.location.href = data.authorizeUrl;
}
