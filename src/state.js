import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  HIDDEN_HEIGHT,
  PIECE_TYPES,
  STANDARD_PIECE_TYPES,
  NUMBERBLOCK_TYPES,
  PIECE_SHAPES,
  PIECE_COLOR,
  BASE_DROP_MS,
  SOFT_DROP_FACTOR,
  MIN_DROP_MS,
  SCORE_BY_LINES,
  VFX_ROTATE_MS,
  VFX_LINE_CLEAR_MS,
  VFX_IMPACT_MS,
} from './constants.js';

let pieceSerial = 1;

function cloneShape(shape) {
  return shape.map((row) => row.slice());
}

function getNextPieceSerial() {
  const id = pieceSerial;
  pieceSerial += 1;
  return id;
}

function getRandomItem(items) {
  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function getAvailablePieceTypes(includeNumberBlocks) {
  return includeNumberBlocks ? PIECE_TYPES : STANDARD_PIECE_TYPES;
}

function isNumberBlockType(type) {
  return NUMBERBLOCK_TYPES.includes(String(type));
}

export function makeBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
}

function randomPieceType(includeNumberBlocks = true) {
  const pieceTypes = getAvailablePieceTypes(includeNumberBlocks);
  return getRandomItem(pieceTypes);
}

function rotateShapeCW(shape) {
  const h = shape.length;
  const w = shape[0].length;
  const next = Array.from({ length: w }, () => Array(h).fill(0));

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!shape[y][x]) {
        continue;
      }
      next[x][h - 1 - y] = 1;
    }
  }

  return next;
}

function computeDropMs(level) {
  return Math.max(MIN_DROP_MS, Math.floor(BASE_DROP_MS * Math.pow(0.9, level - 1)));
}

function createPiece(type, includeNumberBlocks = true) {
  const pieceType = String(type || randomPieceType(includeNumberBlocks));
  const shape = cloneShape(PIECE_SHAPES[pieceType]);
  const width = shape[0].length;

  return {
    type: pieceType,
    shape,
    color: PIECE_COLOR[pieceType],
    pieceId: getNextPieceSerial(),
    x: Math.floor((BOARD_WIDTH - width) / 2),
    y: 0,
  };
}

function replaceWithRegularPiece(piece) {
  const pieceType = String(randomPieceType(false));
  const shape = cloneShape(PIECE_SHAPES[pieceType]);
  const width = shape[0].length;

  return {
    ...piece,
    type: pieceType,
    shape,
    color: PIECE_COLOR[pieceType],
    pieceId: getNextPieceSerial(),
    x: Math.min(Math.max(0, piece.x), BOARD_WIDTH - width),
  };
}

export function setNumberBlocksEnabled(state, enabled) {
  const nextValue = !!enabled;
  if (state.numberBlocksEnabled === nextValue) {
    return;
  }
  state.numberBlocksEnabled = nextValue;

  if (!nextValue) {
    if (state.active && isNumberBlockType(state.active.type)) {
      const convertedActive = replaceWithRegularPiece(state.active);
      if (canPlacePiece(state, convertedActive)) {
        state.active = convertedActive;
      }
    }
    if (state.next && isNumberBlockType(state.next.type)) {
      state.next = createPiece(undefined, false);
    }
    return;
  }

  if (!state.next) {
    state.next = createPiece(undefined, state.numberBlocksEnabled);
  }
}

function getDropMsForState(state) {
  return Math.max(MIN_DROP_MS, Math.floor(state.softDrop ? state.dropMs * SOFT_DROP_FACTOR : state.dropMs));
}

function emitEvent(state, event) {
  state.events.push(event);
}

function setRotateVfx(state) {
  state.vfx.rotateUntil = Date.now() + VFX_ROTATE_MS;
}

function setLineClearVfx(state, rows) {
  state.vfx.lineFlashUntil = Date.now() + VFX_LINE_CLEAR_MS;
  state.vfx.lineFlashRows = rows;
}

function setImpactVfx(state) {
  if (!state.active) {
    state.vfx.impactRows = [];
    state.vfx.impactUntil = 0;
    return;
  }

  let minRow = VISIBLE_HEIGHT - 1;
  let maxRow = 0;
  let found = false;

  state.active.shape.forEach((row, py) => {
    row.forEach((cell, px) => {
      if (!cell) {
        return;
      }
      const boardRow = state.active.y + py - HIDDEN_HEIGHT;
      if (boardRow < 0 || boardRow >= VISIBLE_HEIGHT) {
        return;
      }
      if (boardRow < minRow) {
        minRow = boardRow;
      }
      if (boardRow > maxRow) {
        maxRow = boardRow;
      }
      found = true;
    });
  });

  if (!found) {
    state.vfx.impactRows = [];
    state.vfx.impactUntil = 0;
    return;
  }

  state.vfx.impactRows = [minRow, maxRow];
  state.vfx.impactUntil = Date.now() + VFX_IMPACT_MS;
}

export function createInitialState(options = {}) {
  const numberBlocksEnabled = options.numberBlocksEnabled !== false;
  pieceSerial = 1;
  return {
    status: 'idle',
    board: makeBoard(),
    numberBlocksEnabled,
    active: createPiece(undefined, numberBlocksEnabled),
    next: createPiece(undefined, numberBlocksEnabled),
    score: 0,
    lines: 0,
    level: 1,
    dropMs: BASE_DROP_MS,
    dropAccumulator: 0,
    softDrop: false,
    lastClearLines: 0,
    events: [],
    vfx: {
      rotateUntil: 0,
      lineFlashUntil: 0,
      lineFlashRows: [],
      impactUntil: 0,
      impactRows: [],
    },
  };
}

export function drainEvents(state) {
  const events = state.events.slice();
  state.events.length = 0;
  return events;
}

export function canPlacePiece(state, piece) {
  const { shape, x, y } = piece;

  for (let py = 0; py < shape.length; py += 1) {
    for (let px = 0; px < shape[py].length; px += 1) {
      if (!shape[py][px]) {
        continue;
      }

      const nx = x + px;
      const ny = y + py;

      if (nx < 0 || nx >= BOARD_WIDTH || ny >= BOARD_HEIGHT) {
        return false;
      }
      if (ny < 0) {
        continue;
      }
      if (state.board[ny][nx] !== 0) {
        return false;
      }
    }
  }

  return true;
}

export function getGhostPiece(state) {
  if (!state.active) {
    return null;
  }

  const ghost = { ...state.active };
  while (true) {
    const next = { ...ghost, y: ghost.y + 1 };
    if (!canPlacePiece(state, next)) {
      break;
    }
    ghost.y += 1;
  }

  return ghost;
}

function lockActivePiece(state) {
  const piece = state.active;
  if (!piece) {
    return false;
  }

  let overflow = false;

  piece.shape.forEach((row, py) => {
    row.forEach((cell, px) => {
      if (!cell) {
        return;
      }

      const x = piece.x + px;
      const y = piece.y + py;
      if (y < 0) {
        return;
      }
      if (y < HIDDEN_HEIGHT) {
        overflow = true;
      }
      state.board[y][x] = {
        color: piece.color,
        type: piece.type,
        pieceId: piece.pieceId,
      };
    });
  });

  emitEvent(state, 'lock');
  return overflow;
}

function clearFullLines(state) {
  let cleared = 0;
  const clearedRows = [];
  for (let y = state.board.length - 1; y >= 0; y -= 1) {
    const isLineFull = state.board[y].every((cell) => cell !== 0);
    if (!isLineFull) {
      continue;
    }

    state.board.splice(y, 1);
    state.board.unshift(Array(BOARD_WIDTH).fill(0));
    cleared += 1;
    if (y >= HIDDEN_HEIGHT) {
      clearedRows.push(y - HIDDEN_HEIGHT);
    }
    y += 1;
  }

  if (cleared > 0) {
    state.score += SCORE_BY_LINES[Math.min(cleared, 4)] * state.level;
    state.lines += cleared;

    const eventName = `line_clear_${Math.min(cleared, 4)}`;
    emitEvent(state, eventName);
    setLineClearVfx(state, clearedRows);

    const nextLevel = Math.floor(state.lines / 10) + 1;
    if (nextLevel !== state.level) {
      state.level = nextLevel;
      state.dropMs = computeDropMs(state.level);
      emitEvent(state, 'level_up');
    }
  }

  state.lastClearLines = cleared;
  return cleared;
}

export function spawnNextPiece(state) {
  state.active = state.next;
  state.next = createPiece(undefined, state.numberBlocksEnabled);
  emitEvent(state, 'piece_spawned');
  if (!canPlacePiece(state, state.active)) {
    state.status = 'gameover';
    emitEvent(state, 'game_over');
  }
}

function settleActive(state) {
  const overflow = lockActivePiece(state);
  clearFullLines(state);

  if (overflow) {
    state.status = 'gameover';
    emitEvent(state, 'game_over');
    return;
  }

  spawnNextPiece(state);
}

export function stepDrop(state) {
  if (state.status !== 'playing') {
    return;
  }

  const next = { ...state.active, y: state.active.y + 1 };
  if (canPlacePiece(state, next)) {
    state.active = next;
    emitEvent(state, 'move');
    return;
  }

  settleActive(state);
}

export function moveActivePiece(state, direction) {
  if (state.status !== 'playing' || !state.active) {
    return false;
  }

  const dx = direction === 'left' ? -1 : 1;
  const next = { ...state.active, x: state.active.x + dx };
  if (!canPlacePiece(state, next)) {
    return false;
  }

  state.active = next;
  emitEvent(state, 'move');
  return true;
}

export function rotateActivePiece(state) {
  if (state.status !== 'playing' || !state.active) {
    return false;
  }

  const rotated = {
    ...state.active,
    shape: rotateShapeCW(state.active.shape),
  };

  const attempts = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    const [dx, dy] = attempts[i];
    const candidate = {
      ...rotated,
      x: rotated.x + dx,
      y: rotated.y + dy,
    };

    if (canPlacePiece(state, candidate)) {
      state.active = candidate;
      emitEvent(state, 'rotate');
      setRotateVfx(state);
      return true;
    }
  }

  return false;
}

export function setSoftDrop(state, enabled) {
  if (state.status !== 'playing') {
    state.softDrop = false;
    return;
  }
  state.softDrop = !!enabled;
}

export function hardDropPiece(state) {
  if (state.status !== 'playing' || !state.active) {
    return 0;
  }

  let distance = 0;
  while (true) {
    const next = { ...state.active, y: state.active.y + 1 };
    if (!canPlacePiece(state, next)) {
      break;
    }
    state.active = next;
    distance += 1;
    emitEvent(state, 'move');
  }

  if (distance > 0) {
    state.score += distance * 2;
    emitEvent(state, 'hard_drop');
    setImpactVfx(state);
  }

  settleActive(state);
  return distance;
}

export function togglePause(state) {
  if (state.status === 'playing') {
    state.status = 'paused';
    state.softDrop = false;
    state.dropAccumulator = 0;
    emitEvent(state, 'pause');
    return true;
  }

  if (state.status === 'paused') {
    state.status = 'playing';
    state.dropAccumulator = 0;
    emitEvent(state, 'resume');
    return true;
  }

  return false;
}

export function stepPhysics(state, deltaMs) {
  if (state.status !== 'playing') {
    return;
  }

  state.dropAccumulator += deltaMs;
  const dropMs = getDropMsForState(state);
  while (state.dropAccumulator >= dropMs && state.status === 'playing') {
    state.dropAccumulator -= dropMs;
    stepDrop(state);
    if (state.status === 'gameover') {
      break;
    }
  }

  if (state.softDrop && state.status === 'playing') {
    emitEvent(state, 'soft_drop_tick');
  }
}
