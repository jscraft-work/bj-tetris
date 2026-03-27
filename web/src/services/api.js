async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getCurrentUser() {
  return request('/api/me');
}

export function extractUserId(user) {
  return user?.displayName || '';
}

export async function saveGameRecord(score, level, lines) {
  const response = await request('/api/records', {
    method: 'POST',
    body: JSON.stringify({ score, level, lines }),
  });

  return response || { error: 'Not logged in' };
}

export async function getLeaderboard(limit = 50) {
  return (await request(`/api/leaderboard?limit=${limit}`)) || [];
}

export async function getMyRecords(limit = 10) {
  return (await request(`/api/my-records?limit=${limit}`)) || [];
}

export async function logout() {
  await request('/auth/logout', {
    method: 'POST',
  });
}
