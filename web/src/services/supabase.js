const SUPABASE_URL = 'https://fslucyctlffqkxdmsohj.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzbHVjeWN0bGZmcWt4ZG1zb2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDg2NzUsImV4cCI6MjA4ODcyNDY3NX0.7yCIIjwcWwN-vrdGBQq7YmWTxqCG7TLEsYMXFoQAn5U';

const EMAIL_DOMAIN = 'bj-tetris.app';

let client = null;

function getClient() {
  if (client) return client;
  // eslint-disable-next-line no-undef -- loaded via CDN <script> tag
  client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}

function toEmail(id) {
  return `${id}@${EMAIL_DOMAIN}`;
}

/**
 * Login or auto-register.
 * 1. Try signIn. If success → done.
 * 2. If "Invalid login credentials" → try signUp (auto-register).
 *    - signUp returns user with empty identities → user exists, wrong PW.
 *    - signUp returns user with identities → new user created.
 */
export async function login(id, password) {
  const sb = getClient();
  const email = toEmail(id);

  // Try sign in first
  const { data: signInData, error: signInError } =
    await sb.auth.signInWithPassword({ email, password });

  if (!signInError) {
    return { user: signInData.user, isNewUser: false };
  }

  // If invalid credentials → could be wrong PW or non-existent user
  if (signInError.message.includes('Invalid login credentials')) {
    const { data: signUpData, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: { data: { display_name: id } },
    });

    if (!signUpError && signUpData.user) {
      // Empty identities = user already exists but PW was wrong
      if (
        signUpData.user.identities &&
        signUpData.user.identities.length === 0
      ) {
        return { user: null, error: '비밀번호가 올바르지 않습니다.' };
      }
      return { user: signUpData.user, isNewUser: true };
    }

    if (signUpError) {
      return { user: null, error: signUpError.message };
    }
  }

  return { user: null, error: signInError.message };
}

export async function logout() {
  const sb = getClient();
  await sb.auth.signOut();
}

export async function getCurrentUser() {
  const sb = getClient();
  const { data } = await sb.auth.getSession();
  return data?.session?.user || null;
}

export function extractUserId(user) {
  if (!user || !user.email) return '';
  return user.email.replace(`@${EMAIL_DOMAIN}`, '');
}

// ── Game Records ──

export async function saveGameRecord(score, level, lines) {
  const sb = getClient();
  const user = (await sb.auth.getSession()).data?.session?.user;
  if (!user) return { error: 'Not logged in' };

  const displayName = extractUserId(user);
  const { error } = await sb.from('game_records').insert({
    user_id: user.id,
    display_name: displayName,
    score,
    level,
    lines,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function getLeaderboard(limit = 50) {
  const sb = getClient();
  const { data, error } = await sb
    .from('game_records')
    .select('display_name, score, level, lines, played_at')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}

export async function getMyRecords(limit = 10) {
  const sb = getClient();
  const user = (await sb.auth.getSession()).data?.session?.user;
  if (!user) return [];

  const { data, error } = await sb
    .from('game_records')
    .select('display_name, score, level, lines, played_at')
    .eq('user_id', user.id)
    .order('score', { ascending: false })
    .limit(limit);

  if (error) return [];
  return data || [];
}
