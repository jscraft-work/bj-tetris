import {
  resizeCanvas,
  resizeNextCanvas,
  render,
  renderNext,
} from './render.js';
import {
  createInitialState,
  setNumberBlocksEnabled,
  stepPhysics,
  moveActivePiece,
  rotateActivePiece,
  setSoftDrop,
  hardDropPiece,
  togglePause,
  drainEvents,
} from './state.js';
import {
  initAudio,
  startBackgroundMusic,
  stopBackgroundMusic,
  play,
  isAudioEnabled,
} from './services/audio.js';
import { pulse, canVibrate, isVibrationEnabled } from './services/vibration.js';
import { SFX_KEYS } from './constants.js';

const canvas = document.getElementById('gameCanvas');
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
const toggleNumberBlocksBtn = document.getElementById('toggleNumberBlocksBtn');
const ctx = canvas.getContext('2d');
const playLayout = document.querySelector('.play-layout');
const hud = document.querySelector('.hud');
const controlBar = document.querySelector('.control-bar');
const nextPanel = document.querySelector('.next-panel');
const shell = document.querySelector('.shell');

const HOLD_DELAY_MS = 170;
const HOLD_REPEAT_MS = 70;
const ROTATE_DEBOUNCE_MS = 120;

const NUMBER_BLOCKS_STORAGE_KEY = 'tetris.numberBlocksEnabled';
let gameState = createInitialState({
  numberBlocksEnabled: readNumberBlockSetting(),
});
let lastTime = 0;
let layout = resizeCanvas(canvas);
let nextLayout = resizeNextCanvas(nextCanvas);
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
let numberBlocksEnabled = gameState.numberBlocksEnabled;

function readNumberBlockSetting() {
  try {
    const value = localStorage.getItem(NUMBER_BLOCKS_STORAGE_KEY);
    if (value === null) {
      return true;
    }
    return value === 'true';
  } catch {
    return true;
  }
}

function persistNumberBlockSetting(value) {
  try {
    localStorage.setItem(NUMBER_BLOCKS_STORAGE_KEY, String(!!value));
  } catch {}
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
  if (toggleNumberBlocksBtn) {
    toggleNumberBlocksBtn.textContent = `NUMBER ${numberBlocksEnabled ? 'ON' : 'OFF'}`;
  }
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
    numberBlocksEnabled,
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

function toggleNumberBlocks() {
  numberBlocksEnabled = !numberBlocksEnabled;
  setNumberBlocksEnabled(gameState, numberBlocksEnabled);
  persistNumberBlockSetting(numberBlocksEnabled);
  applyHud();
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
      case SFX_KEYS.LEVEL_UP:
        play(SFX_KEYS.LEVEL_UP);
        break;
      case SFX_KEYS.GAME_OVER:
        play(SFX_KEYS.GAME_OVER);
        if (isVibrationEnabled() && canVibrate()) {
          pulse(35);
        }
        stopBackgroundMusic();
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
    const moved = moveActivePiece(gameState, requestedDir < 0 ? 'left' : 'right');
    input.holdLastMoveAt = now;
    if (!moved && elapsed < HOLD_DELAY_MS) {
      input.holdStartedAt = now - HOLD_DELAY_MS;
    }
  }
}

function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;

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
    if (!input.leftDown) {
      input.leftDown = true;
      moveActivePiece(gameState, 'left');
      input.holdStartedAt = performance.now();
      input.holdLastMoveAt = input.holdStartedAt;
      input.moveDir = -1;
      markPressed(ctrlLeft, true);
      markPressed(ctrlRight, false);
    }
    event.preventDefault();
    return;
  }

  if (key === 'ArrowRight' || key === 'KeyD') {
    ensureAudioReady();
    if (!input.rightDown) {
      input.rightDown = true;
      moveActivePiece(gameState, 'right');
      input.holdStartedAt = performance.now();
      input.holdLastMoveAt = input.holdStartedAt;
      input.moveDir = 1;
      markPressed(ctrlRight, true);
      markPressed(ctrlLeft, false);
    }
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
    input.leftDown = false;
    if (input.moveDir === -1) {
      input.moveDir = 0;
      input.holdStartedAt = 0;
      input.holdLastMoveAt = 0;
    }
    markPressed(ctrlLeft, false);
    return;
  }
  if (key === 'ArrowRight' || key === 'KeyD') {
    input.rightDown = false;
    if (input.moveDir === 1) {
      input.moveDir = 0;
      input.holdStartedAt = 0;
      input.holdLastMoveAt = 0;
    }
    markPressed(ctrlRight, false);
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

onTouchControlStart(ctrlLeft, (phase) => {
  if (gameState.status !== 'playing') {
    return;
  }
  if (phase === 'down') {
    if (!input.leftDown) {
      input.leftDown = true;
      moveActivePiece(gameState, 'left');
      input.holdStartedAt = performance.now();
      input.holdLastMoveAt = input.holdStartedAt;
      input.moveDir = -1;
      markPressed(ctrlRight, false);
    }
  } else {
    input.leftDown = false;
    if (input.moveDir === -1) {
      input.moveDir = 0;
      input.holdStartedAt = 0;
      input.holdLastMoveAt = 0;
    }
    markPressed(ctrlLeft, false);
  }
});

onTouchControlStart(ctrlRight, (phase) => {
  if (gameState.status !== 'playing') {
    return;
  }
  if (phase === 'down') {
    if (!input.rightDown) {
      input.rightDown = true;
      moveActivePiece(gameState, 'right');
      input.holdStartedAt = performance.now();
      input.holdLastMoveAt = input.holdStartedAt;
      input.moveDir = 1;
      markPressed(ctrlLeft, false);
    }
  } else {
    input.rightDown = false;
    if (input.moveDir === 1) {
      input.moveDir = 0;
      input.holdStartedAt = 0;
      input.holdLastMoveAt = 0;
    }
    markPressed(ctrlRight, false);
  }
});

onTouchControlStart(ctrlRotate, (phase) => {
  if (gameState.status !== 'playing') {
    return;
  }
  if (phase === 'down') {
    const now = performance.now();
    if (now >= input.rotateCooldownUntil) {
      rotateActivePiece(gameState);
      input.rotateCooldownUntil = now + ROTATE_DEBOUNCE_MS;
    }
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
restartBtn.addEventListener('click', onStartClick);
restartBtn.addEventListener('pointerdown', onStartClick);
if (toggleNumberBlocksBtn) {
  toggleNumberBlocksBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    toggleNumberBlocks();
  });
}
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
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

applyHud();
updateOverlay();
layout = resizeCanvas(canvas);
nextLayout = resizeNextCanvas(nextCanvas);
scheduleLayoutSync();
requestAnimationFrame((time) => {
  lastTime = time;
  gameLoop(time);
});
