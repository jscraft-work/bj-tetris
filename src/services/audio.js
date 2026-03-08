import { SFX_KEYS } from '../constants.js';

const SFX_DEFINITIONS = {
  [SFX_KEYS.MOVE]: { type: 'square', freq: 420, dur: 45, gain: 0.08, cooldown: 80 },
  [SFX_KEYS.ROTATE]: { type: 'triangle', freq: 660, dur: 48, gain: 0.09, cooldown: 120 },
  [SFX_KEYS.SOFT_DROP_TICK]: { type: 'square', freq: 300, dur: 20, gain: 0.05, cooldown: 70 },
  [SFX_KEYS.HARD_DROP]: { type: 'triangle', freq: 860, dur: 60, gain: 0.11, cooldown: 100 },
  [SFX_KEYS.LOCK]: { type: 'sine', freq: 240, dur: 50, gain: 0.07, cooldown: 70 },
  [SFX_KEYS.LINE_CLEAR_1]: { type: 'triangle', freq: 520, dur: 80, gain: 0.13, cooldown: 50 },
  [SFX_KEYS.LINE_CLEAR_2]: { type: 'triangle', freq: 650, dur: 85, gain: 0.14, cooldown: 40 },
  [SFX_KEYS.LINE_CLEAR_3]: { type: 'triangle', freq: 760, dur: 90, gain: 0.15, cooldown: 40 },
  [SFX_KEYS.LINE_CLEAR_4]: { type: 'triangle', freq: 900, dur: 110, gain: 0.17, cooldown: 40 },
  [SFX_KEYS.GAME_OVER]: { type: 'sawtooth', freq: 180, dur: 130, gain: 0.15, cooldown: 0 },
  [SFX_KEYS.LEVEL_UP]: { type: 'triangle', freq: 700, dur: 100, gain: 0.12, cooldown: 100 },
  [SFX_KEYS.PAUSE]: { type: 'sine', freq: 260, dur: 40, gain: 0.08, cooldown: 0 },
  [SFX_KEYS.RESUME]: { type: 'sine', freq: 460, dur: 40, gain: 0.08, cooldown: 0 },
  [SFX_KEYS.START]: { type: 'triangle', freq: 600, dur: 90, gain: 0.1, cooldown: 0 },
  [SFX_KEYS.RESTART]: { type: 'triangle', freq: 640, dur: 80, gain: 0.1, cooldown: 0 },
};

let ctx = null;
let enabled = true;
let musicEnabled = true;
const lastPlayed = new Map();
let bgmMode = 'stopped';
let bgmTrackAudio = null;
let bgmLastTrackIndex = -1;
let bgmTrackErrorStreak = 0;
let bgmTrackListReady = false;
let bgmTrackListLoading = null;
let bgmTrackList = [];

const BGM_TRACK_MANIFEST_URL = './assets/bgm/manifest.json';
const BGM_TRACK_VOLUME = 0.28;
function normalizeTrackPath(candidate) {
  const raw = String(candidate || '').trim();
  if (!raw) {
    return '';
  }

  if (/^(https?:)?\/\//.test(raw) || raw.startsWith('http:') || raw.startsWith('https:')) {
    return raw;
  }

  if (raw.startsWith('./') || raw.startsWith('../') || raw.startsWith('/')) {
    return raw;
  }

  return `./assets/bgm/${raw}`;
}

function loadBgmTrackList() {
  if (bgmTrackListReady) {
    return Promise.resolve(bgmTrackList);
  }

  if (bgmTrackListLoading) {
    return bgmTrackListLoading;
  }

  bgmTrackListLoading = (async () => {
    try {
      const response = await fetch(BGM_TRACK_MANIFEST_URL, { cache: 'no-store' });
      if (!response.ok) {
        bgmTrackList = [];
        return;
      }

      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : payload.tracks;
      if (!Array.isArray(list)) {
        bgmTrackList = [];
        return;
      }

      const next = [];
      for (const item of list) {
        const path = normalizeTrackPath(item);
        if (path && !next.includes(path)) {
          next.push(path);
        }
      }
      bgmTrackList = next;
    } catch (error) {
      bgmTrackList = [];
    } finally {
      bgmTrackListReady = true;
      bgmTrackListLoading = null;
    }
  })();

  return bgmTrackListLoading;
}

function createTrackBgmAudio() {
  if (bgmTrackAudio) {
    return bgmTrackAudio;
  }

  bgmTrackAudio = new Audio();
  bgmTrackAudio.loop = false;
  bgmTrackAudio.preload = 'auto';
  bgmTrackAudio.volume = BGM_TRACK_VOLUME;
  bgmTrackAudio.crossOrigin = 'anonymous';
  bgmTrackAudio.addEventListener('ended', () => {
    if (bgmMode !== 'track') {
      return;
    }
    startTrackMusic();
  });
  bgmTrackAudio.addEventListener('error', () => {
    if (bgmMode !== 'track') {
      return;
    }
    bgmTrackErrorStreak += 1;
    if (bgmTrackErrorStreak >= Math.max(1, bgmTrackList.length)) {
      stopTrackMusic();
      bgmTrackErrorStreak = 0;
      bgmMode = 'stopped';
      return;
    }
    startTrackMusic(true);
  });

  return bgmTrackAudio;
}

function stopTrackMusic() {
  if (!bgmTrackAudio) {
    return;
  }
  bgmTrackAudio.pause();
  bgmTrackAudio.currentTime = 0;
}

function getRandomTrackIndex() {
  const total = bgmTrackList.length;
  if (!total) {
    return -1;
  }
  if (total === 1) {
    return 0;
  }

  let nextIndex = Math.floor(Math.random() * total);
  if (total > 1 && nextIndex === bgmLastTrackIndex) {
    nextIndex = (nextIndex + 1) % total;
  }
  bgmLastTrackIndex = nextIndex;
  return nextIndex;
}

function startTrackMusic(forcePlay = false) {
  if (!bgmTrackList.length || !musicEnabled || !enabled) {
    return;
  }

  const audio = createTrackBgmAudio();
  if (!audio) {
    return;
  }

  if (!forcePlay && bgmMode === 'track' && !audio.paused) {
    return;
  }

  bgmMode = 'track';
  bgmTrackErrorStreak = 0;
  const index = getRandomTrackIndex();
  if (index < 0) {
    return;
  }
  audio.volume = BGM_TRACK_VOLUME;
  audio.src = bgmTrackList[index];
  audio.currentTime = 0;
  audio.play().catch(() => {
    stopTrackMusic();
    bgmMode = 'stopped';
  });
}

function ensureContext() {
  if (ctx) {
    return ctx;
  }

  const AudioApi = (globalThis && (globalThis.AudioContext || globalThis.webkitAudioContext)) || null;
  if (!AudioApi) {
    return null;
  }

  ctx = new AudioApi();
  return ctx;
}

export function initAudio() {
  const audioContext = ensureContext();
  if (audioContext && audioContext.state === 'suspended' && typeof audioContext.resume === 'function') {
    audioContext.resume().catch(() => {});
  }
}

export function setAudioEnabled(isEnabled) {
  enabled = !!isEnabled;
}

export function setMusicEnabled(isEnabled) {
  musicEnabled = !!isEnabled;
  if (!musicEnabled) {
    stopBackgroundMusic();
    bgmMode = 'stopped';
  }
}

export function isMusicEnabled() {
  return musicEnabled;
}

export function isAudioEnabled() {
  return enabled;
}

export function canPlayAudio() {
  return !!ensureContext();
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function startBackgroundMusic() {
  if (!musicEnabled || !enabled) {
    return;
  }

  if (!bgmTrackListReady) {
    loadBgmTrackList()
      .then(() => {
        if (!musicEnabled || !enabled) {
          return;
        }
        if (!bgmTrackList.length) {
          return;
        }
        startTrackMusic();
      })
      .catch(() => {
        bgmTrackListReady = true;
        bgmTrackList = [];
      });
    return;
  }

  if (bgmTrackList.length > 0) {
    startTrackMusic();
    return;
  }
}

export function stopBackgroundMusic() {
  stopTrackMusic();
  bgmMode = 'stopped';
}

function playTone(def) {
  if (!ctx || ctx.state !== 'running') {
    return;
  }

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = def.type || 'square';
  osc.frequency.setValueAtTime(def.freq || 440, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(def.gain || 0.08, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (def.dur || 60) / 1000);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + (def.dur || 60) / 1000 + 0.01);
}

export function play(effect) {
  if (!enabled || !ctx) {
    return;
  }

  const def = SFX_DEFINITIONS[effect];
  if (!def) {
    return;
  }

  const cd = def.cooldown || 0;
  const key = `${effect}`;
  const last = lastPlayed.get(key) || 0;
  const t = nowMs();
  if (cd > 0 && t - last < cd) {
    return;
  }

  lastPlayed.set(key, t);
  playTone(def);
}
