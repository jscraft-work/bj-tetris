import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  HIDDEN_HEIGHT,
  VFX_LINE_CLEAR_MS,
  VFX_IMPACT_MS,
} from './constants.js';

function getBoardBounds() {
  const shell = document.querySelector('.board-area');
  const shellW = shell ? shell.clientWidth : window.innerWidth;
  const shellH = window.innerHeight - 220;
  const maxW = Math.max(220, Math.floor(shellW - 20));
  const maxH = Math.max(240, Math.floor(shellH));
  const cellByWidth = Math.floor(maxW / BOARD_WIDTH);
  const cellByHeight = Math.floor(maxH / VISIBLE_HEIGHT);
  const cell = Math.max(10, Math.min(cellByWidth, cellByHeight));

  return {
    cssW: cell * BOARD_WIDTH,
    cssH: cell * VISIBLE_HEIGHT,
    cell,
  };
}

export function resizeCanvas(canvas) {
  const { cssW, cssH, cell } = getBoardBounds();
  const scale = window.devicePixelRatio || 1;

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.floor(cssW * scale);
  canvas.height = Math.floor(cssH * scale);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  return { cell, cssW, cssH };
}

function drawGrid(ctx, layout) {
  const { cell } = layout;
  ctx.strokeStyle = '#28345d';
  ctx.lineWidth = 1;

  for (let x = 0; x <= BOARD_WIDTH; x += 1) {
    const px = x * cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, VISIBLE_HEIGHT * cell);
    ctx.stroke();
  }

  for (let y = 0; y <= VISIBLE_HEIGHT; y += 1) {
    const py = y * cell + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(BOARD_WIDTH * cell, py);
    ctx.stroke();
  }
}

function drawCell(ctx, x, y, size, color, glow = false) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  if (glow) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x * size + size * 0.18, y * size + size * 0.18, size * 0.64, size * 0.64);
    ctx.restore();
  }
}

function drawLineClearFlash(ctx, state, layout, now) {
  const { lineFlashUntil, lineFlashRows } = state.vfx;
  const remaining = lineFlashUntil - now;
  if (remaining <= 0 || !lineFlashRows.length) {
    return;
  }

  const alpha = Math.min(0.12, Math.max(0.03, remaining / VFX_LINE_CLEAR_MS));
  const { cell } = layout;
  ctx.save();
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  lineFlashRows.forEach((row) => {
    if (row >= 0 && row < VISIBLE_HEIGHT) {
      ctx.fillRect(0, row * cell, BOARD_WIDTH * cell, cell);
    }
  });
  ctx.restore();
}

function drawImpactPulse(ctx, state, layout, now) {
  const remaining = state.vfx.impactUntil - now;
  if (remaining <= 0) {
    return;
  }

  const rows = state.vfx.impactRows || [];
  if (rows.length !== 2) {
    return;
  }

  const { cell } = layout;
  const [startRow, endRow] = rows;
  if (startRow > endRow) {
    return;
  }
  const alpha = Math.min(0.06, Math.max(0.015, remaining / VFX_IMPACT_MS));
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(0, startRow * cell, BOARD_WIDTH * cell, (endRow - startRow + 1) * cell);
  ctx.restore();
}

export function render(state, layout, ctx, now = Date.now()) {
  const { cell } = layout;
  const boardW = BOARD_WIDTH * cell;
  const boardH = VISIBLE_HEIGHT * cell;

  ctx.clearRect(0, 0, boardW, boardH);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, boardW, boardH);

  for (let y = HIDDEN_HEIGHT; y < state.board.length; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const color = state.board[y][x];
      if (!color) {
        continue;
      }
      drawCell(ctx, x, y - HIDDEN_HEIGHT, cell, color, true);
    }
  }

  if (state.active) {
    state.active.shape.forEach((row, py) => {
      row.forEach((cellOccupied, px) => {
        if (!cellOccupied) {
          return;
        }
        const y = state.active.y + py - HIDDEN_HEIGHT;
        const x = state.active.x + px;
        if (y < 0 || y >= VISIBLE_HEIGHT) {
          return;
        }
        drawCell(ctx, x, y, cell, state.active.color, true);
      });
    });
  }

  // vfx removed to avoid residual color artifacts on empty cells
  drawGrid(ctx, layout);
}
