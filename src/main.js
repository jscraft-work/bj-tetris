import { resizeCanvas, render } from './render.js';
import {
  createInitialState,
  stepPhysics,
  moveActivePiece,
  rotateActivePiece,
  setSoftDrop,
  hardDropPiece,
  togglePause,
} from './state.js';

const canvas = document.getElementById('gameCanvas');
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
const ctx = canvas.getContext('2d');

const HOLD_DELAY_MS = 170;
const HOLD_REPEAT_MS = 70;
const ROTATE_DEBOUNCE_MS = 120;

let gameState = createInitialState();
let lastTime = 0;
let layout = resizeCanvas(canvas);
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

function markPressed(button, active) {
  if (!button) {
    return;
  }

  button.classList.toggle('pressed', !!active);
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
}

function updateOverlay() {
  if (gameState.status === 'playing') {
    overlay.classList.add('hidden');
    overlayAction.textContent = '';
    return;
  }

  overlay.classList.remove('hidden');

  if (gameState.status === 'paused') {
    overlayStatus.textContent = 'PAUSED';
    overlaySub.textContent = '게임이 정지되었습니다.';
    overlayAction.textContent = '재개';
    overlayAction.style.display = 'inline-block';
    return;
  }

  if (gameState.status === 'gameover') {
    overlayStatus.textContent = 'GAME OVER';
    overlaySub.textContent = `레벨 ${gameState.level}  ·  라인 ${gameState.lines}  ·  점수 ${gameState.score}`;
    overlayAction.textContent = '재시작';
    overlayAction.style.display = 'inline-block';
    return;
  }

  overlayStatus.textContent = gameState.status.toUpperCase();
  overlaySub.textContent = '';
  overlayAction.style.display = 'none';
}

function hardRestart() {
  gameState = createInitialState();
  input.leftDown = false;
  input.rightDown = false;
  input.moveDir = 0;
  input.holdStartedAt = 0;
  input.holdLastMoveAt = 0;
  input.softDrop = false;
  overlay.classList.add('hidden');
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

  moveHoldDirection(time);
  stepPhysics(gameState, Number.isFinite(delta) ? delta : 0);
  render(gameState, layout, ctx);
  applyHud();
  updateOverlay();

  requestAnimationFrame(gameLoop);
}

function onKeyDown(event) {
  const key = event.code;

  if (gameState.status === 'gameover' && key !== 'KeyR') {
    return;
  }

  if (key === 'ArrowLeft' || key === 'KeyA') {
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
    if (!input.softDrop) {
      setSoftDropInput(true);
    }
    event.preventDefault();
    return;
  }

  if ((key === 'ArrowUp' || key === 'KeyW' || key === 'KeyE') && !event.repeat) {
    const now = performance.now();
    if (now >= input.rotateCooldownUntil) {
      rotateActivePiece(gameState);
      input.rotateCooldownUntil = now + ROTATE_DEBOUNCE_MS;
    }
    event.preventDefault();
    return;
  }

  if (key === 'Space') {
    if (!event.repeat) {
      hardDropPiece(gameState);
    }
    event.preventDefault();
    return;
  }

  if (key === 'KeyP') {
    if (togglePause(gameState)) {
      markPressed(ctrlPause, gameState.status === 'paused');
      if (gameState.status !== 'playing') {
        stopAllMovementInputs();
      }
    }
    event.preventDefault();
    return;
  }

  if (key === 'KeyR') {
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

function onOverlayAction() {
  if (gameState.status === 'paused') {
    togglePause(gameState);
    markPressed(ctrlPause, false);
    return;
  }

  if (gameState.status === 'gameover') {
    hardRestart();
  }
}

function onTouchControlStart(button, handler) {
  const pointerDownHandler = (event) => {
    event.preventDefault();
    markPressed(button, true);
    handler('down');
  };

  const pointerUpHandler = () => {
    markPressed(button, false);
    handler('up');
  };

  button.addEventListener('pointerdown', pointerDownHandler, { passive: false });
  button.addEventListener('pointerup', pointerUpHandler);
  button.addEventListener('pointercancel', pointerUpHandler);
  button.addEventListener('pointerleave', pointerUpHandler);
}

onTouchControlStart(ctrlLeft, (phase) => {
  if (phase === 'down') {
    if (gameState.status !== 'playing') {
      return;
    }
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
  if (phase === 'down') {
    if (gameState.status !== 'playing') {
      return;
    }
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
  if (phase === 'down') {
    const now = performance.now();
    if (now >= input.rotateCooldownUntil) {
      rotateActivePiece(gameState);
      input.rotateCooldownUntil = now + ROTATE_DEBOUNCE_MS;
    }
  }
});

onTouchControlStart(ctrlSoft, (phase) => {
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
  markPressed(ctrlPause, true);
});

ctrlPause.addEventListener('pointerup', () => {
  markPressed(ctrlPause, false);
  if (togglePause(gameState)) {
    if (gameState.status !== 'playing') {
      stopAllMovementInputs();
    }
  }
});

ctrlPause.addEventListener('pointercancel', () => {
  markPressed(ctrlPause, false);
});

restartBtn.addEventListener('click', hardRestart);
overlayAction.addEventListener('click', onOverlayAction);
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('resize', () => {
  layout = resizeCanvas(canvas);
});

layout = resizeCanvas(canvas);
applyHud();
updateOverlay();
requestAnimationFrame((time) => {
  lastTime = time;
  gameLoop(time);
});
