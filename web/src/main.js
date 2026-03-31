import {
  resizeCanvas,
  resizeNextCanvas,
  render,
  renderNext,
} from './render.js';
import {
  createInitialState,
  stepPhysics,
  moveActivePiece,
  rotateActivePiece,
  setSoftDrop,
  hardDropPiece,
  togglePause,
  drainEvents,
  setPoopSplashEnabled,
} from './state.js';
import {
  initAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
  play,
  isAudioEnabled,
  setMusicEnabled,
  getBgmTrackList,
  setBgmTrackIndex,
  getBgmTrackIndex,
} from './services/audio.js';
import { pulse, canVibrate, isVibrationEnabled } from './services/vibration.js';
import { SFX_KEYS, SPECIAL_BLOCK_TYPES } from './constants.js';
import { beginLogin } from './services/auth.js';
import {
  getCurrentUser,
  extractUserId,
  saveGameRecord,
  getLeaderboard,
  getMyRecords,
  logout,
} from './services/api.js';
import { showScreen, getCurrentScreen } from './screen.js';
import { showConfirm } from './ui/confirm.js';

const canvas = document.getElementById('gameCanvas');
const boardArea = document.querySelector('.board-area');
const nextCanvas = document.getElementById('nextCanvas');
const statusText = document.getElementById('statusText');
const levelText = document.getElementById('levelText');
const linesText = document.getElementById('linesText');
const scoreText = document.getElementById('scoreText');
const restartBtn = document.getElementById('restartBtn');
const overlay = document.getElementById('overlay');
const overlayStatus = document.getElementById('overlayStatus');
const overlaySub = document.getElementById('overlaySub');
const overlayAction = document.getElementById('overlayAction');
const ctrlLeft = document.getElementById('ctrlLeft');
const ctrlRight = document.getElementById('ctrlRight');
const ctrlRotate = document.getElementById('ctrlRotate');
const ctrlSoft = document.getElementById('ctrlSoft');
const ctrlHard = document.getElementById('ctrlHard');
const ctrlPause = document.getElementById('ctrlPause');
const toggleSpecialBlocksAllBtn = document.getElementById('toggleSpecialBlocksAllBtn');
const specialBlockSelectContainer = document.getElementById('specialBlockList');
const togglePoopSplashBtn = document.getElementById('togglePoopSplashBtn');
const toggleBgmBtn = document.getElementById('toggleBgmBtn');
const toggleBgmTracksAllBtn = document.getElementById('toggleBgmTracksAllBtn');
const exitToLobbyBtn = document.getElementById('exitToLobbyBtn');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const lobbyUserId = document.getElementById('lobbyUserId');
const lobbyStartBtn = document.getElementById('lobbyStartBtn');
const lobbyLogoutBtn = document.getElementById('lobbyLogoutBtn');
const lobbyExitBtn = document.getElementById('lobbyExitBtn');
const lobbyRankingBtn = document.getElementById('lobbyRankingBtn');
const lobbySettingsBtn = document.getElementById('lobbySettingsBtn');
const settingsPopup = document.getElementById('settingsPopup');
const settingsPopupClose = document.getElementById('settingsPopupClose');
const rankingPopup = document.getElementById('rankingPopup');
const rankingPopupClose = document.getElementById('rankingPopupClose');
const rankTabAll = document.getElementById('rankTabAll');
const rankTabMy = document.getElementById('rankTabMy');
const rankingList = document.getElementById('rankingList');
const bgmTrackSelectContainer = document.getElementById('bgmTrackList');
const ctx = canvas.getContext('2d');
const playLayout = document.querySelector('.play-layout');
const hud = document.querySelector('.hud');
const controlBar = document.querySelector('.control-bar');
const nextPanel = document.querySelector('.next-panel');
const shell = document.querySelector('.shell');

const HOLD_DELAY_MS = 170;
const HOLD_REPEAT_MS = 90;
const ROTATE_DEBOUNCE_MS = 120;
const BOARD_TOUCH_THRESHOLD = 14;
const BOARD_TOUCH_UP_HARD_DROP_MIN = 28;

const SPECIAL_BLOCKS_STORAGE_KEY = 'tetris.specialBlocksEnabled';
const SPECIAL_BLOCK_TYPES_STORAGE_KEY = 'tetris.specialBlockTypes';
const LEGACY_SPECIAL_BLOCKS_STORAGE_KEY = 'tetris.numberBlocksEnabled';
const POOP_SPLASH_ENABLED_STORAGE_KEY = 'tetris.poopSplashEnabled';
const MUSIC_ENABLED_STORAGE_KEY = 'tetris.musicEnabled';
const BGM_TRACK_INDEX_STORAGE_KEY = 'tetris.bgmTrackIndex';
const MAX_BGM_TRACK_LABEL_LENGTH = 26;
let selectedSpecialBlockTypes = readSpecialBlockTypes();
let poopSplashEnabled = readPoopSplashEnabledSetting();
let gameState = createInitialState({
  specialBlockTypes: selectedSpecialBlockTypes,
  poopSplashEnabled,
});
let lastTime = 0;
let layout = resizeCanvas(canvas);
let nextLayout = resizeNextCanvas(nextCanvas);
let bgmTrackNames = [];
let musicEnabled = readMusicEnabledSetting();
let selectedBgmTrackIndexes = readBgmTrackSelection();
let pointerLock = false;
const input = {
  moveDir: 0,
  holdStartedAt: 0,
  holdLastMoveAt: 0,
  softDrop: false,
  leftDown: false,
  rightDown: false,
  rotateCooldownUntil: 0,
};
const hudState = {
  status: '',
  level: '',
  lines: '',
  score: '',
};
const boardMovePointers = new Map();

setMusicEnabled(musicEnabled);
setBgmTrackIndex(selectedBgmTrackIndexes);

function normalizeSelectedSpecialBlockTypes(raw = []) {
  const source = Array.isArray(raw) ? raw : [];
  const normalized = [];
  SPECIAL_BLOCK_TYPES.forEach((type) => {
    if (source.includes(type) && !normalized.includes(type)) {
      normalized.push(type);
    }
  });
  return normalized;
}

function readSpecialBlockTypes() {
  try {
    const value = localStorage.getItem(SPECIAL_BLOCK_TYPES_STORAGE_KEY);
    if (value && value.startsWith('[')) {
      const parsed = JSON.parse(value);
      return normalizeSelectedSpecialBlockTypes(parsed);
    }

    const enabledValue = localStorage.getItem(SPECIAL_BLOCKS_STORAGE_KEY);
    if (enabledValue !== null) {
      return enabledValue === 'true' ? SPECIAL_BLOCK_TYPES.slice() : [];
    }

    const legacyValue = localStorage.getItem(LEGACY_SPECIAL_BLOCKS_STORAGE_KEY);
    if (legacyValue !== null) {
      return legacyValue === 'true' ? SPECIAL_BLOCK_TYPES.slice() : [];
    }

    return SPECIAL_BLOCK_TYPES.slice();
  } catch {
    return SPECIAL_BLOCK_TYPES.slice();
  }
}

function persistSpecialBlockTypes(values) {
  const normalized = normalizeSelectedSpecialBlockTypes(values);
  try {
    localStorage.setItem(SPECIAL_BLOCK_TYPES_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(SPECIAL_BLOCKS_STORAGE_KEY, String(normalized.length > 0));
    localStorage.setItem(LEGACY_SPECIAL_BLOCKS_STORAGE_KEY, String(normalized.length > 0));
  } catch {}
}

function readPoopSplashEnabledSetting() {
  try {
    const value = localStorage.getItem(POOP_SPLASH_ENABLED_STORAGE_KEY);
    if (value === null) {
      return true;
    }
    return value === 'true';
  } catch {
    return true;
  }
}

function persistPoopSplashEnabledSetting(value) {
  try {
    localStorage.setItem(POOP_SPLASH_ENABLED_STORAGE_KEY, String(!!value));
  } catch {}
}

function readMusicEnabledSetting() {
  try {
    const value = localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY);
    if (value === null) {
      return true;
    }
    return value === 'true';
  } catch {
    return true;
  }
}

function persistMusicEnabledSetting(value) {
  try {
    localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, String(!!value));
  } catch {}
}

function readBgmTrackSelection() {
  try {
    const value = localStorage.getItem(BGM_TRACK_INDEX_STORAGE_KEY);
    if (value === null) {
      return [];
    }

    if (value.trim() === '') {
      return [];
    }

    if (value.startsWith('[')) {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => Number.parseInt(item, 10))
        .filter((item) => Number.isInteger(item) && item >= 0);
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? [parsed] : [];
  } catch {
    return [];
  }
}

function persistBgmTrackSelection(values) {
  try {
    const valuesArray = Array.isArray(values)
      ? values.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value) && value >= 0)
      : [];
    const normalized = Array.from(new Set(valuesArray));
    localStorage.setItem(BGM_TRACK_INDEX_STORAGE_KEY, JSON.stringify(normalized));
  } catch {}
}

function normalizeSelectedTrackIndexes(raw = []) {
  const normalized = Array.isArray(raw)
    ? raw.map((value) => Number.parseInt(value, 10)).filter((value) => Number.isInteger(value) && value >= 0)
    : [];

  const unique = [];
  normalized.forEach((value) => {
    if (!unique.includes(value)) {
      unique.push(value);
    }
  });

  if (!bgmTrackNames.length) {
    return unique.sort((a, b) => a - b);
  }

  return unique
    .filter((value) => value < bgmTrackNames.length)
    .sort((a, b) => a - b);
}

function formatSpecialBlockLabel(type) {
  if (type === 'D') return 'D (똥)';
  if (type === 'd') return 'd (마리오)';
  if (type === 'b') return 'b (루이지)';
  if (type === 'F') return 'F (양문냉장고)';
  return `Block ${type}`;
}

function renderSpecialBlockCheckboxes() {
  if (!specialBlockSelectContainer) {
    return;
  }

  specialBlockSelectContainer.innerHTML = '';
  SPECIAL_BLOCK_TYPES.forEach((type) => {
    const label = document.createElement('label');
    label.className = 'special-block-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = type;
    checkbox.checked = selectedSpecialBlockTypes.includes(type);

    const text = document.createElement('span');
    text.textContent = formatSpecialBlockLabel(type);

    label.append(checkbox, text);
    specialBlockSelectContainer.appendChild(label);
  });
  updateSettingsTexts();
}

function renderBgmTrackCheckboxes() {
  if (!bgmTrackSelectContainer) {
    return;
  }

  bgmTrackSelectContainer.innerHTML = '';

  if (!bgmTrackNames.length) {
    const fallback = document.createElement('div');
    fallback.className = 'bgm-track-empty';
    fallback.textContent = '음원 목록을 불러오는 중입니다.';
    bgmTrackSelectContainer.appendChild(fallback);
    return;
  }

  bgmTrackNames.forEach((track, index) => {
    const label = document.createElement('label');
    label.className = 'bgm-track-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(index);
    checkbox.checked = selectedBgmTrackIndexes.includes(index);
    checkbox.disabled = !musicEnabled;

    const text = document.createElement('span');
    text.textContent = formatTrackLabel(track);

    label.append(checkbox, text);
    bgmTrackSelectContainer.appendChild(label);
  });

  updateSettingsTexts();
}

function formatTrackLabel(track) {
  const file = String(track || '')
    .split('/')
    .filter(Boolean)
    .pop();
  if (!file) {
    return 'track';
  }
  if (file.length <= MAX_BGM_TRACK_LABEL_LENGTH) {
    return file.replace(/\.mp3$/i, '');
  }
  return `${file.slice(0, MAX_BGM_TRACK_LABEL_LENGTH - 1)}…`;
}

function updateSettingsTexts() {
  if (toggleSpecialBlocksAllBtn) {
    const allSelected = selectedSpecialBlockTypes.length === SPECIAL_BLOCK_TYPES.length;
    toggleSpecialBlocksAllBtn.textContent = allSelected ? '특수블록 전체 해제' : '특수블록 전체 선택';
  }
  if (togglePoopSplashBtn) {
    togglePoopSplashBtn.textContent = `똥 퍼짐 ${poopSplashEnabled ? 'ON' : 'OFF'}`;
  }
  if (toggleBgmBtn) {
    toggleBgmBtn.textContent = `BGM ${musicEnabled ? 'ON' : 'OFF'}`;
  }
  if (toggleBgmTracksAllBtn) {
    const allSelected = bgmTrackNames.length > 0 && selectedBgmTrackIndexes.length === bgmTrackNames.length;
    toggleBgmTracksAllBtn.textContent = allSelected ? '음원 전체 해제' : '음원 전체 선택';
    toggleBgmTracksAllBtn.disabled = !bgmTrackNames.length;
  }

  if (bgmTrackSelectContainer) {
    const inputs = bgmTrackSelectContainer.querySelectorAll('input[type="checkbox"]');
    inputs.forEach((input) => {
      input.disabled = !musicEnabled;
    });
  }
}

function loadBgmTrackList() {
  getBgmTrackList()
    .then((tracks) => {
      bgmTrackNames = Array.isArray(tracks) ? tracks : [];
      const next = normalizeSelectedTrackIndexes(selectedBgmTrackIndexes);
      selectedBgmTrackIndexes = next;
      renderBgmTrackCheckboxes();
      persistBgmTrackSelection(selectedBgmTrackIndexes);
      setBgmTrackIndex(selectedBgmTrackIndexes);
    })
    .catch(() => {
      bgmTrackNames = [];
      selectedBgmTrackIndexes = [];
      persistBgmTrackSelection(selectedBgmTrackIndexes);
      renderBgmTrackCheckboxes();
      setBgmTrackIndex(selectedBgmTrackIndexes);
    });
}

function syncNextPanelOffset(layoutForOffset) {
  if (!playLayout || !layoutForOffset) {
    return;
  }

  playLayout.style.setProperty('--board-width', `${layoutForOffset.cssW}px`);
  if (!shell || !hud || !controlBar) {
    return;
  }

  const boardArea = playLayout.querySelector('.board-area');
  const boardAreaRect = boardArea ? boardArea.getBoundingClientRect() : null;
  const boardWidth = Math.ceil(
    Number.isFinite(boardAreaRect && boardAreaRect.width)
      ? boardAreaRect.width
      : layoutForOffset.cssW,
  );
  const controlBarWidth = `${boardWidth}px`;
  shell.style.setProperty('--control-bar-width', controlBarWidth);
  controlBar.style.width = controlBarWidth;

  if (!nextPanel) {
    return;
  }

  const playLayoutRect = playLayout.getBoundingClientRect();
  const nextPanelRect = nextPanel.getBoundingClientRect();
  const nextCanvasRect = nextCanvas.getBoundingClientRect();
  const minWidth = Math.ceil(layoutForOffset.cssW + nextPanelRect.width + 2);
  const candidateFromPanel = Number.isFinite(nextPanelRect.right) && Number.isFinite(playLayoutRect.left)
    ? nextPanelRect.right - playLayoutRect.left
    : 0;
  const candidateFromCanvas = Number.isFinite(nextCanvasRect.right) && Number.isFinite(playLayoutRect.left)
    ? nextCanvasRect.right - playLayoutRect.left
    : 0;
  const width = Math.ceil(
    Math.max(
      Number.isFinite(playLayoutRect.width) ? playLayoutRect.width : 0,
      Number.isFinite(playLayout.scrollWidth) ? playLayout.scrollWidth : 0,
      candidateFromPanel,
      candidateFromCanvas,
      minWidth,
    ) + 2,
  );

  if (width > 0) {
    const widthPx = `${width}px`;
    shell.style.setProperty('--hud-control-width', widthPx);
    hud.style.width = widthPx;
  }
}

function applyHud() {
  const status = gameState.status.toUpperCase();
  const level = String(gameState.level);
  const lines = String(gameState.lines);
  const score = String(gameState.score);

  if (hudState.status !== status) {
    statusText.textContent = status;
    hudState.status = status;
  }
  if (hudState.level !== level) {
    levelText.textContent = level;
    hudState.level = level;
  }
  if (hudState.lines !== lines) {
    linesText.textContent = lines;
    hudState.lines = lines;
  }
  if (hudState.score !== score) {
    scoreText.textContent = score;
    hudState.score = score;
  }
  updateSettingsTexts();
}

function markPressed(button, active) {
  if (!button) {
    return;
  }

  button.classList.toggle('pressed', !!active);
}

function stopAllMovementInputs() {
  input.moveDir = 0;
  input.leftDown = false;
  input.rightDown = false;
  input.holdStartedAt = 0;
  input.holdLastMoveAt = 0;
  markPressed(ctrlLeft, false);
  markPressed(ctrlRight, false);
}

function startMoveLeft() {
  if (input.leftDown) {
    return;
  }

  input.leftDown = true;
  moveActivePiece(gameState, 'left');
  input.holdStartedAt = performance.now();
  input.holdLastMoveAt = input.holdStartedAt;
  input.moveDir = -1;
  markPressed(ctrlLeft, true);
  markPressed(ctrlRight, false);
}

function startMoveRight() {
  if (input.rightDown) {
    return;
  }

  input.rightDown = true;
  moveActivePiece(gameState, 'right');
  input.holdStartedAt = performance.now();
  input.holdLastMoveAt = input.holdStartedAt;
  input.moveDir = 1;
  markPressed(ctrlRight, true);
  markPressed(ctrlLeft, false);
}

function stopMoveLeft() {
  input.leftDown = false;
  if (input.moveDir === -1) {
    input.moveDir = 0;
    input.holdStartedAt = 0;
    input.holdLastMoveAt = 0;
  }
  markPressed(ctrlLeft, false);
}

function stopMoveRight() {
  input.rightDown = false;
  if (input.moveDir === 1) {
    input.moveDir = 0;
    input.holdStartedAt = 0;
    input.holdLastMoveAt = 0;
  }
  markPressed(ctrlRight, false);
}

function rotateActivePieceIfAllowed() {
  const now = performance.now();
  if (now < input.rotateCooldownUntil) {
    return;
  }

  rotateActivePiece(gameState);
  input.rotateCooldownUntil = now + ROTATE_DEBOUNCE_MS;
}

function setSoftDropInput(enabled) {
  input.softDrop = !!enabled;
  setSoftDrop(gameState, !!enabled);
  markPressed(ctrlSoft, !!enabled);
}

function ensureAudioReady() {
  if (pointerLock) {
    if (gameState.status === 'playing') {
      startBackgroundMusic();
    }
    return;
  }
  pointerLock = true;
  initAudio();
  if (gameState.status === 'playing') {
    startBackgroundMusic();
  }
}

function updateOverlay() {
  if (gameState.status === 'idle') {
    overlay.classList.remove('hidden');
    overlayStatus.textContent = 'READY';
    overlaySub.textContent = '시작 버튼을 눌러 게임을 시작하세요.';
    overlayAction.textContent = '시작';
    overlayAction.style.display = 'inline-block';
    restartBtn.textContent = '시작';
    return;
  }

  if (gameState.status === 'playing') {
    overlay.classList.add('hidden');
    overlayAction.textContent = '';
    restartBtn.textContent = 'Restart';
    return;
  }

  overlay.classList.remove('hidden');

  if (gameState.status === 'paused') {
    overlayStatus.textContent = 'PAUSED';
    overlaySub.textContent = '게임이 정지되었습니다.';
    overlayAction.textContent = '재개';
    overlayAction.style.display = 'inline-block';
    restartBtn.textContent = 'Restart';
    return;
  }

  if (gameState.status === 'gameover') {
    overlayStatus.textContent = 'GAME OVER';
    overlaySub.textContent = `레벨 ${gameState.level}  ·  라인 ${gameState.lines}  ·  점수 ${gameState.score}`;
    overlayAction.textContent = '재시작';
    overlayAction.style.display = 'inline-block';
    restartBtn.textContent = 'Restart';
    return;
  }

  overlayStatus.textContent = gameState.status.toUpperCase();
  overlaySub.textContent = '';
  overlayAction.style.display = 'none';
}

function hardRestart() {
  gameState = createInitialState({
    specialBlockTypes: selectedSpecialBlockTypes,
    poopSplashEnabled,
  });
  ensureAudioReady();
  gameState.status = 'playing';
  startBackgroundMusic();
  input.leftDown = false;
  input.rightDown = false;
  input.moveDir = 0;
  input.holdStartedAt = 0;
  input.holdLastMoveAt = 0;
  input.softDrop = false;
  overlay.classList.add('hidden');
  play(SFX_KEYS.RESTART);
}

function startGame() {
  if (gameState.status !== 'idle') {
    return;
  }

  gameState.status = 'playing';
  ensureAudioReady();
  startBackgroundMusic();
  play(SFX_KEYS.START);
  overlay.classList.add('hidden');
  overlayAction.textContent = '';
  overlayAction.style.display = 'none';
}

function onOverlayAction() {
  if (gameState.status === 'idle') {
    startGame();
    return;
  }
  if (gameState.status === 'paused') {
    if (togglePause(gameState)) {
      startBackgroundMusic();
    }
    return;
  }
  if (gameState.status === 'gameover') {
    hardRestart();
  }
}

function toggleBgm() {
  musicEnabled = !musicEnabled;
  setMusicEnabled(musicEnabled);
  persistMusicEnabledSetting(musicEnabled);
  ensureAudioReady();
  if (musicEnabled) {
    startBackgroundMusic();
  } else {
    stopBackgroundMusic();
  }
  updateSettingsTexts();
}

function togglePoopSplash() {
  poopSplashEnabled = !poopSplashEnabled;
  persistPoopSplashEnabledSetting(poopSplashEnabled);
  setPoopSplashEnabled(gameState, poopSplashEnabled);
  updateSettingsTexts();
}

function toggleAllSpecialBlocks() {
  if (selectedSpecialBlockTypes.length === SPECIAL_BLOCK_TYPES.length) {
    selectedSpecialBlockTypes = [];
  } else {
    selectedSpecialBlockTypes = SPECIAL_BLOCK_TYPES.slice();
  }
  persistSpecialBlockTypes(selectedSpecialBlockTypes);
  renderSpecialBlockCheckboxes();
  updateSettingsTexts();
}

function onSpecialBlockSelectChange(event) {
  if (!event.target || event.target.type !== 'checkbox') {
    return;
  }

  const type = String(event.target.value || '');
  const next = selectedSpecialBlockTypes.slice();
  if (event.target.checked) {
    if (!next.includes(type)) {
      next.push(type);
    }
  } else {
    const index = next.indexOf(type);
    if (index >= 0) {
      next.splice(index, 1);
    }
  }

  selectedSpecialBlockTypes = normalizeSelectedSpecialBlockTypes(next);
  persistSpecialBlockTypes(selectedSpecialBlockTypes);
  updateSettingsTexts();
}

function toggleAllBgmTracks() {
  if (!bgmTrackNames.length) {
    return;
  }
  if (selectedBgmTrackIndexes.length === bgmTrackNames.length) {
    selectedBgmTrackIndexes = [];
  } else {
    selectedBgmTrackIndexes = bgmTrackNames.map((_, index) => index);
  }
  selectedBgmTrackIndexes = normalizeSelectedTrackIndexes(selectedBgmTrackIndexes);
  persistBgmTrackSelection(selectedBgmTrackIndexes);
  setBgmTrackIndex(selectedBgmTrackIndexes);
  if (musicEnabled) {
    ensureAudioReady();
    startBackgroundMusic();
  }
  renderBgmTrackCheckboxes();
  updateSettingsTexts();
}

function onBgmTrackSelectChange(event) {
  if (!event.target || event.target.type !== 'checkbox') {
    return;
  }

  const parsed = Number.parseInt(event.target.value, 10);
  if (!Number.isInteger(parsed)) {
    return;
  }

  const next = selectedBgmTrackIndexes.slice();
  if (event.target.checked) {
    if (!next.includes(parsed)) {
      next.push(parsed);
    }
  } else {
    const index = next.indexOf(parsed);
    if (index >= 0) {
      next.splice(index, 1);
    }
  }

  selectedBgmTrackIndexes = normalizeSelectedTrackIndexes(next);
  persistBgmTrackSelection(selectedBgmTrackIndexes);
  setBgmTrackIndex(selectedBgmTrackIndexes);
  if (musicEnabled) {
    ensureAudioReady();
    startBackgroundMusic();
  }
  renderBgmTrackCheckboxes();
  updateSettingsTexts();
}

function handleEvents(events) {
  events.forEach((evt) => {
    switch (evt) {
      case 'piece_spawned':
        input.moveDir = 0;
        input.holdStartedAt = 0;
        input.holdLastMoveAt = 0;
        input.rotateCooldownUntil = 0;
        input.leftDown = false;
        input.rightDown = false;
        setSoftDropInput(false);
        markPressed(ctrlSoft, false);
        markPressed(ctrlLeft, false);
        markPressed(ctrlRight, false);
        return;
    case SFX_KEYS.MOVE:
      if (isAudioEnabled()) {
        play(SFX_KEYS.MOVE);
      }
        break;
      case SFX_KEYS.ROTATE:
        play(SFX_KEYS.ROTATE);
        break;
      case SFX_KEYS.SOFT_DROP_TICK:
        play(SFX_KEYS.SOFT_DROP_TICK);
        break;
      case SFX_KEYS.HARD_DROP:
        play(SFX_KEYS.HARD_DROP);
        if (isVibrationEnabled()) {
          pulse(20);
        }
        break;
      case SFX_KEYS.LOCK:
        if (isAudioEnabled()) {
          play(SFX_KEYS.LOCK);
        }
        break;
      case 'line_clear_1':
        play(SFX_KEYS.LINE_CLEAR_1);
        break;
      case 'line_clear_2':
        play(SFX_KEYS.LINE_CLEAR_2);
        if (isVibrationEnabled()) {
          pulse(12);
        }
        break;
      case 'line_clear_3':
        play(SFX_KEYS.LINE_CLEAR_3);
        if (isVibrationEnabled()) {
          pulse(12);
        }
        break;
      case 'line_clear_4':
        play(SFX_KEYS.LINE_CLEAR_4);
        if (isVibrationEnabled()) {
          pulse(20);
        }
        break;
      case 'all_clear':
        play(SFX_KEYS.LINE_CLEAR_4);
        if (isVibrationEnabled()) {
          pulse(30);
        }
        break;
      case SFX_KEYS.LEVEL_UP:
        play(SFX_KEYS.LEVEL_UP);
        break;
      case SFX_KEYS.GAME_OVER:
        play(SFX_KEYS.GAME_OVER);
        if (isVibrationEnabled() && canVibrate()) {
          pulse(35);
        }
        stopBackgroundMusic();
        // Save game record (async, non-blocking)
        saveGameRecord(gameState.score, gameState.level, gameState.lines).catch(() => {});
        break;
      case SFX_KEYS.PAUSE:
        play(SFX_KEYS.PAUSE);
        stopBackgroundMusic();
        break;
      case SFX_KEYS.RESUME:
        play(SFX_KEYS.RESUME);
        startBackgroundMusic();
        break;
      case SFX_KEYS.RESTART:
        play(SFX_KEYS.RESTART);
        break;
      case SFX_KEYS.START:
        play(SFX_KEYS.START);
        break;
      default:
        break;
    }
  });
}

function moveHoldDirection(now) {
  if (gameState.status !== 'playing') {
    stopAllMovementInputs();
    return;
  }

  const requestedDir = input.leftDown && !input.rightDown ? -1 : input.rightDown && !input.leftDown ? 1 : 0;
  if (requestedDir === 0) {
    input.moveDir = 0;
    input.holdStartedAt = 0;
    input.holdLastMoveAt = 0;
    markPressed(ctrlLeft, false);
    markPressed(ctrlRight, false);
    return;
  }

  if (requestedDir !== input.moveDir) {
    input.moveDir = requestedDir;
    input.holdStartedAt = now;
    input.holdLastMoveAt = now;
    moveActivePiece(gameState, requestedDir < 0 ? 'left' : 'right');
    markPressed(ctrlLeft, requestedDir < 0);
    markPressed(ctrlRight, requestedDir > 0);
    return;
  }

  const elapsed = now - input.holdStartedAt;
  const interval = elapsed >= HOLD_DELAY_MS ? HOLD_REPEAT_MS : HOLD_DELAY_MS - elapsed;
  if (now - input.holdLastMoveAt >= interval) {
    const moved = moveActivePiece(gameState, input.moveDir < 0 ? 'left' : 'right');
    input.holdLastMoveAt = now;
    if (!moved && elapsed < HOLD_DELAY_MS) {
      input.holdStartedAt = now - HOLD_DELAY_MS;
    }
  }
}

function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;

  if (getCurrentScreen() !== 'game') {
    requestAnimationFrame(gameLoop);
    return;
  }

  if (gameState.status === 'playing') {
    startBackgroundMusic();
  } else {
    stopBackgroundMusic();
  }

  moveHoldDirection(time);
  stepPhysics(gameState, Number.isFinite(delta) ? delta : 0);
  const events = drainEvents(gameState);
  handleEvents(events);

  render(gameState, layout, ctx, time);
  renderNext(gameState, nextLayout, nextCanvas);
  applyHud();
  updateOverlay();
  requestAnimationFrame(gameLoop);
}

function onKeyDown(event) {
  const key = event.code;
  if (gameState.status === 'idle') {
    return;
  }

  if (gameState.status === 'gameover' && key !== 'KeyR') {
    return;
  }

  if (key === 'ArrowLeft' || key === 'KeyA') {
    ensureAudioReady();
    startMoveLeft();
    event.preventDefault();
    return;
  }

  if (key === 'ArrowRight' || key === 'KeyD') {
    ensureAudioReady();
    startMoveRight();
    event.preventDefault();
    return;
  }

  if (key === 'ArrowDown' || key === 'KeyS') {
    ensureAudioReady();
    if (!input.softDrop) {
      setSoftDropInput(true);
    }
    event.preventDefault();
    return;
  }

  if ((key === 'ArrowUp' || key === 'KeyW' || key === 'KeyE') && !event.repeat) {
    ensureAudioReady();
    const now = performance.now();
    if (now >= input.rotateCooldownUntil) {
      rotateActivePiece(gameState);
      input.rotateCooldownUntil = now + ROTATE_DEBOUNCE_MS;
    }
    event.preventDefault();
    return;
  }

  if (key === 'Space') {
    ensureAudioReady();
    if (!event.repeat) {
      hardDropPiece(gameState);
    }
    event.preventDefault();
    return;
  }

  if (key === 'KeyP') {
    ensureAudioReady();
    if (togglePause(gameState)) {
      markPressed(ctrlPause, gameState.status === 'paused');
      if (gameState.status === 'playing') {
        startBackgroundMusic();
      } else {
        stopBackgroundMusic();
      }
      if (gameState.status !== 'playing') {
        stopAllMovementInputs();
      }
    }
    event.preventDefault();
    return;
  }

  if (key === 'KeyR') {
    ensureAudioReady();
    hardRestart();
    event.preventDefault();
  }
}

function onKeyUp(event) {
  const key = event.code;
  if (key === 'ArrowLeft' || key === 'KeyA') {
    stopMoveLeft();
    return;
  }
  if (key === 'ArrowRight' || key === 'KeyD') {
    stopMoveRight();
    return;
  }
  if (key === 'ArrowDown' || key === 'KeyS') {
    setSoftDropInput(false);
  }
}

function onTouchControlStart(button, handler) {
  const downHandler = (event) => {
    event.preventDefault();
    ensureAudioReady();
    markPressed(button, true);
    handler('down');
  };
  const upHandler = () => {
    markPressed(button, false);
    handler('up');
  };
  button.addEventListener('pointerdown', downHandler, { passive: false });
  button.addEventListener('pointerup', upHandler);
  button.addEventListener('pointercancel', upHandler);
  button.addEventListener('pointerleave', upHandler);
}

function getBoardTouchIntent(startX, startY, touchX, touchY) {
  const dx = touchX - startX;
  const dy = touchY - startY;

  if (Math.abs(dx) < BOARD_TOUCH_THRESHOLD && Math.abs(dy) < BOARD_TOUCH_THRESHOLD) {
    return null;
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }

  if (dy > 0) {
    return 'down';
  }

  if (dy <= -BOARD_TOUCH_UP_HARD_DROP_MIN) {
    return 'up';
  }

  return null;
}

function applyBoardIntent(pointerState, nextIntent) {
  const prev = pointerState.active;
  if (prev === nextIntent) {
    return;
  }

  if (prev === 'left') {
    stopMoveLeft();
  } else if (prev === 'right') {
    stopMoveRight();
  } else if (prev === 'down') {
    setSoftDropInput(false);
  }

  if (nextIntent === 'left') {
    startMoveLeft();
  } else if (nextIntent === 'right') {
    startMoveRight();
  } else if (nextIntent === 'down') {
    setSoftDropInput(true);
  } else if (nextIntent === 'up') {
    if (!pointerState.hardDropped) {
      hardDropPiece(gameState);
      pointerState.hardDropped = true;
    }
  }

  pointerState.active = nextIntent;
}

onTouchControlStart(ctrlLeft, (phase) => {
  if (gameState.status !== 'playing') {
    return;
  }
  if (phase === 'down') {
    startMoveLeft();
  } else {
    stopMoveLeft();
  }
});

onTouchControlStart(ctrlRight, (phase) => {
  if (gameState.status !== 'playing') {
    return;
  }
  if (phase === 'down') {
    startMoveRight();
  } else {
    stopMoveRight();
  }
});

function handleBoardTouchStart(event) {
  if (!boardArea || gameState.status !== 'playing') {
    return;
  }
  const pointerId = event.pointerId;
  if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
    return;
  }

  event.preventDefault();
  ensureAudioReady();
  boardMovePointers.set(pointerId, {
    startX: event.clientX,
    startY: event.clientY,
    active: 'pending',
    hardDropped: false,
  });

  try {
    boardArea.setPointerCapture(pointerId);
  } catch {}
}

function handleBoardTouchMove(event) {
  if (!boardArea || gameState.status !== 'playing') {
    return;
  }

  const pointerId = event.pointerId;
  if (!boardMovePointers.has(pointerId)) {
    return;
  }

  const pointerState = boardMovePointers.get(pointerId);
  const nextIntent = getBoardTouchIntent(
    pointerState.startX,
    pointerState.startY,
    event.clientX,
    event.clientY,
  );

  if (!nextIntent) {
    return;
  }

  applyBoardIntent(pointerState, nextIntent);
}

function handleBoardTouchEnd(event) {
  const pointerId = event.pointerId;
  if (!boardMovePointers.has(pointerId)) {
    return;
  }

  const pointerState = boardMovePointers.get(pointerId);
  boardMovePointers.delete(pointerId);

  if (pointerState.active === 'pending') {
    rotateActivePieceIfAllowed();
    return;
  }

  if (pointerState.active === 'left') {
    stopMoveLeft();
  } else if (pointerState.active === 'right') {
    stopMoveRight();
  } else if (pointerState.active === 'down') {
    setSoftDropInput(false);
  }
}

onTouchControlStart(ctrlRotate, (phase) => {
  if (gameState.status !== 'playing') {
    return;
  }
  if (phase === 'down') {
    rotateActivePieceIfAllowed();
  }
});

onTouchControlStart(ctrlSoft, (phase) => {
  if (gameState.status !== 'playing') {
    return;
  }
  if (phase === 'down') {
    setSoftDropInput(true);
  } else {
    setSoftDropInput(false);
  }
});

ctrlHard.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (gameState.status !== 'playing') {
    return;
  }
  ensureAudioReady();
  markPressed(ctrlHard, true);
  hardDropPiece(gameState);
});

ctrlHard.addEventListener('pointerup', () => {
  markPressed(ctrlHard, false);
});
ctrlHard.addEventListener('pointercancel', () => {
  markPressed(ctrlHard, false);
});

ctrlPause.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  ensureAudioReady();
  markPressed(ctrlPause, true);
});

ctrlPause.addEventListener('pointerup', () => {
  markPressed(ctrlPause, false);
  if (togglePause(gameState)) {
    if (gameState.status === 'playing') {
      startBackgroundMusic();
    } else {
      stopBackgroundMusic();
    }
    if (gameState.status !== 'playing') {
      stopAllMovementInputs();
    }
  }
});
ctrlPause.addEventListener('pointercancel', () => {
  markPressed(ctrlPause, false);
});

function onStartClick() {
  ensureAudioReady();
  if (gameState.status === 'idle') {
    startGame();
    return;
  }
  hardRestart();
}

function scheduleLayoutSync() {
  requestAnimationFrame(() => requestAnimationFrame(() => syncNextPanelOffset(layout)));
}

overlayAction.addEventListener('click', onOverlayAction);
overlayAction.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  onOverlayAction();
});

if (toggleBgmBtn) {
  toggleBgmBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    toggleBgm();
  });
}
if (togglePoopSplashBtn) {
  togglePoopSplashBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    togglePoopSplash();
  });
}
if (toggleBgmTracksAllBtn) {
  toggleBgmTracksAllBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    toggleAllBgmTracks();
  });
}
if (bgmTrackSelectContainer) {
  bgmTrackSelectContainer.addEventListener('change', onBgmTrackSelectChange);
}
if (specialBlockSelectContainer) {
  specialBlockSelectContainer.addEventListener('change', onSpecialBlockSelectChange);
}
restartBtn.addEventListener('click', onStartClick);
restartBtn.addEventListener('pointerdown', onStartClick);
if (toggleSpecialBlocksAllBtn) {
  toggleSpecialBlocksAllBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    toggleAllSpecialBlocks();
  });
}
if (boardArea) {
  boardArea.addEventListener('pointerdown', handleBoardTouchStart, { passive: false });
  boardArea.addEventListener('pointermove', handleBoardTouchMove, { passive: false });
  boardArea.addEventListener('pointerup', handleBoardTouchEnd);
  boardArea.addEventListener('pointercancel', handleBoardTouchEnd);
  boardArea.addEventListener('pointerleave', handleBoardTouchEnd);
}
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('pointerup', handleBoardTouchEnd);
window.addEventListener('pointercancel', handleBoardTouchEnd);
window.addEventListener('resize', () => {
  layout = resizeCanvas(canvas);
  nextLayout = resizeNextCanvas(nextCanvas);
  scheduleLayoutSync();
});
if (typeof ResizeObserver !== 'undefined' && playLayout && nextPanel) {
  const layoutSyncObserver = new ResizeObserver(() => {
    scheduleLayoutSync();
  });
  layoutSyncObserver.observe(playLayout);
  layoutSyncObserver.observe(nextPanel);
  layoutSyncObserver.observe(nextCanvas);
}

// ── Login Flow ──
if (loginBtn) {
  loginBtn.addEventListener('click', async () => {
    loginBtn.disabled = true;
    loginError.textContent = '';

    try {
      await beginLogin();
    } catch (err) {
      loginError.textContent = err instanceof Error ? err.message : '로그인을 시작하지 못했습니다.';
      loginBtn.disabled = false;
    }
  });
}

// ── Ranking ──
let currentRankTab = 'all';
let currentUserId = null;

function renderRanking(records, tab) {
  if (!rankingList) return;
  rankingList.innerHTML = '';

  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'ranking-empty';
    empty.textContent = '기록이 없습니다.';
    rankingList.appendChild(empty);
    return;
  }

  records.forEach((record, index) => {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    if (tab === 'all' && currentUserId && record.display_name === currentUserId) {
      row.classList.add('my-record');
    }

    const rank = document.createElement('span');
    rank.className = 'ranking-rank';
    rank.textContent = String(index + 1);

    const name = document.createElement('span');
    name.className = 'ranking-name';
    name.textContent = record.display_name || currentUserId || '-';

    const score = document.createElement('span');
    score.className = 'ranking-score';
    score.textContent = String(record.score);

    const level = document.createElement('span');
    level.className = 'ranking-level';
    level.textContent = String(record.level);

    const lines = document.createElement('span');
    lines.className = 'ranking-lines';
    lines.textContent = String(record.lines);

    row.append(rank, name, score, level, lines);
    rankingList.appendChild(row);
  });
}

async function loadRanking(tab) {
  currentRankTab = tab;
  if (rankTabAll) rankTabAll.classList.toggle('active', tab === 'all');
  if (rankTabMy) rankTabMy.classList.toggle('active', tab === 'my');

  if (rankingList) {
    rankingList.innerHTML = '<div class="ranking-empty">불러오는 중...</div>';
  }

  try {
    const records = tab === 'all' ? await getLeaderboard(50) : await getMyRecords(20);
    renderRanking(records, tab);
  } catch {
    if (rankingList) {
      rankingList.innerHTML = '<div class="ranking-empty">불러오기 실패</div>';
    }
  }
}

if (rankTabAll) {
  rankTabAll.addEventListener('click', () => loadRanking('all'));
}
if (rankTabMy) {
  rankTabMy.addEventListener('click', () => loadRanking('my'));
}

// ── Popup Show/Hide ──
function showSettingsPopup() {
  if (settingsPopup) settingsPopup.classList.remove('hidden');
  renderSpecialBlockCheckboxes();
  loadBgmTrackList();
  updateSettingsTexts();
}

function hideSettingsPopup() {
  if (settingsPopup) settingsPopup.classList.add('hidden');
}

function showRankingPopup() {
  if (rankingPopup) rankingPopup.classList.remove('hidden');
  loadRanking(currentRankTab);
}

function hideRankingPopup() {
  if (rankingPopup) rankingPopup.classList.add('hidden');
}

if (lobbySettingsBtn) {
  lobbySettingsBtn.addEventListener('click', showSettingsPopup);
}
if (settingsPopupClose) {
  settingsPopupClose.addEventListener('click', hideSettingsPopup);
}
if (lobbyRankingBtn) {
  lobbyRankingBtn.addEventListener('click', showRankingPopup);
}
if (rankingPopupClose) {
  rankingPopupClose.addEventListener('click', hideRankingPopup);
}

// Close popups when clicking the overlay background
if (settingsPopup) {
  settingsPopup.addEventListener('click', (e) => {
    if (e.target === settingsPopup) hideSettingsPopup();
  });
}
if (rankingPopup) {
  rankingPopup.addEventListener('click', (e) => {
    if (e.target === rankingPopup) hideRankingPopup();
  });
}

// ── Lobby Flow ──
function navigateToLobby(user) {
  const displayId = extractUserId(user);
  currentUserId = displayId;
  if (lobbyUserId) {
    lobbyUserId.textContent = displayId ? `${displayId} 님` : '';
  }
  hideSettingsPopup();
  hideRankingPopup();
  showScreen('lobby');
  updateSettingsTexts();
}

function startGameFromLobby() {
  gameState = createInitialState({
    specialBlockTypes: selectedSpecialBlockTypes,
    poopSplashEnabled,
  });
  gameState.status = 'playing';
  ensureAudioReady();
  startBackgroundMusic();
  play(SFX_KEYS.START);
  overlay.classList.add('hidden');
  showScreen('game');
  requestAnimationFrame(() => {
    layout = resizeCanvas(canvas);
    nextLayout = resizeNextCanvas(nextCanvas);
    scheduleLayoutSync();
  });
}

function exitToLobby() {
  stopBackgroundMusic();
  stopAllMovementInputs();
  gameState = createInitialState({
    specialBlockTypes: selectedSpecialBlockTypes,
    poopSplashEnabled,
  });
  hideSettingsPopup();
  hideRankingPopup();
  showScreen('lobby');
  updateSettingsTexts();
}

if (lobbyStartBtn) {
  lobbyStartBtn.addEventListener('click', () => {
    startGameFromLobby();
  });
}

if (lobbyLogoutBtn) {
  lobbyLogoutBtn.addEventListener('click', () => {
    logout();
  });
}

if (lobbyExitBtn) {
  lobbyExitBtn.addEventListener('click', async () => {
    const confirmed = await showConfirm('종료할까요?');
    if (confirmed) {
      if (window.AndroidBridge && window.AndroidBridge.closeApp) {
        window.AndroidBridge.closeApp();
      } else {
        window.close();
      }
    }
  });
}

// ── Game Screen: Exit to Lobby ──
if (exitToLobbyBtn) {
  exitToLobbyBtn.addEventListener('click', async () => {
    if (gameState.status === 'playing') {
      togglePause(gameState);
      stopBackgroundMusic();
      stopAllMovementInputs();
    }
    const confirmed = await showConfirm('로비로 돌아갈까요?');
    if (confirmed) {
      exitToLobby();
    } else if (gameState.status === 'paused') {
      togglePause(gameState);
      startBackgroundMusic();
    }
  });
}

// ── Visibility Change: Background BGM + Pause ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (getCurrentScreen() === 'game' && gameState.status === 'playing') {
      togglePause(gameState);
      stopBackgroundMusic();
      stopAllMovementInputs();
    }
  }
});

// ── Android Back Button ──
window.__onAndroidBack = async () => {
  const screen = getCurrentScreen();

  if (screen === 'game') {
    if (gameState.status === 'playing') {
      togglePause(gameState);
      stopBackgroundMusic();
      stopAllMovementInputs();
    }
    const confirmed = await showConfirm('로비로 돌아갈까요?');
    if (confirmed) {
      exitToLobby();
    } else if (gameState.status === 'paused') {
      togglePause(gameState);
      startBackgroundMusic();
    }
    return;
  }

  if (screen === 'lobby') {
    const confirmed = await showConfirm('종료할까요?');
    if (confirmed) {
      if (window.AndroidBridge && window.AndroidBridge.closeApp) {
        window.AndroidBridge.closeApp();
      } else {
        window.close();
      }
    }
    return;
  }

  // Login screen: default back
  if (window.AndroidBridge && window.AndroidBridge.defaultBack) {
    window.AndroidBridge.defaultBack();
  }
};

// ── Initialization ──
(async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    if (authError && loginError) {
      loginError.textContent = authError;
      window.history.replaceState({}, '', window.location.pathname);
    }

    const user = await getCurrentUser();
    if (user) {
      navigateToLobby(user);
    } else {
      showScreen('login');
    }
  } catch {
    showScreen('login');
  }
})();

requestAnimationFrame((time) => {
  lastTime = time;
  gameLoop(time);
});
