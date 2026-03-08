import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  HIDDEN_HEIGHT,
  NUMBERBLOCKS_IMAGES,
  VFX_LINE_CLEAR_MS,
  VFX_IMPACT_MS,
} from './constants.js';
import { getGhostPiece } from './state.js';

function isNumberBlockType(type) {
  return !!NUMBERBLOCKS_IMAGES[String(type)];
}

const pieceImageCache = new Map();

function getPieceImage(type) {
  const src = NUMBERBLOCKS_IMAGES[String(type)];
  if (!src) {
    return null;
  }

  const key = String(type);
  if (pieceImageCache.has(key)) {
    return pieceImageCache.get(key);
  }

  const img = new Image();
  img.src = src;
  pieceImageCache.set(key, img);
  return img;
}

function getCellMeta(cell) {
  if (typeof cell === 'object' && cell !== null) {
    return {
      color: cell.color || '#ffffff',
      type: cell.type || null,
      pieceId: cell.pieceId || null,
    };
  }
  return {
    color: typeof cell === 'string' ? cell : '#ffffff',
    type: null,
    pieceId: null,
  };
}

function getBoardBounds() {
  const shell = document.querySelector('.shell');
  const nextPanel = document.querySelector('.next-panel');
  const shellW = shell ? shell.clientWidth : window.innerWidth;
  const nextPanelRect = nextPanel ? nextPanel.getBoundingClientRect() : null;
  const nextPanelW = Number.isFinite(nextPanelRect && nextPanelRect.width)
    ? Math.ceil(nextPanelRect.width)
    : 0;
  const boardReserve = Math.max(0, shellW - 20 - nextPanelW);
  const shellH = window.innerHeight - 220;
  const maxW = Math.max(220, Math.floor(boardReserve));
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

export function resizeNextCanvas(nextCanvas) {
  if (!nextCanvas) {
    return null;
  }

  const rect = nextCanvas.getBoundingClientRect();
  const cssW = Math.max(72, Math.round(rect.width || 110));
  const cssH = Math.max(72, Math.round(rect.height || cssW));
  const scale = window.devicePixelRatio || 1;

  nextCanvas.style.width = `${cssW}px`;
  nextCanvas.style.height = `${cssH}px`;
  nextCanvas.width = Math.floor(cssW * scale);
  nextCanvas.height = Math.floor(cssH * scale);

  const nextCtx = nextCanvas.getContext('2d');
  nextCtx.setTransform(scale, 0, 0, scale, 0, 0);

  return {
    cell: Math.floor(Math.min(cssW, cssH) / 6),
    cssW,
    cssH,
  };
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

function drawCell(ctx, x, y, size, color, glow = false, alpha = 1, options = {}) {
  const { useImage = false, type = null } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (useImage && isNumberBlockType(type)) {
    const img = getPieceImage(type);
    if (img && img.complete && img.naturalWidth > 0) {
      const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
      const adjustedW = ratio > 1 ? Math.max(size * ratio, size) : size;
      const adjustedH = ratio > 1 ? size : Math.max(size / ratio, size);
      const drawW = Math.min(size, adjustedW);
      const drawH = Math.min(size, adjustedH);
      const offsetX = x * size + (size - drawW) / 2;
      const offsetY = y * size + (size - drawH) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x * size, y * size, size, size);
    }
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size, size);
  }
  if (glow) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x * size + size * 0.18, y * size + size * 0.18, size * 0.64, size * 0.64);
  }
  ctx.restore();
}

function drawPieceImage(ctx, x, y, width, height, color, type, alpha, glow = false, rotate = false) {
  const img = getPieceImage(type);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (rotate) {
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(Math.PI / 2);
      const renderW = height;
      const renderH = width;
      ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
    } else {
      ctx.drawImage(img, x, y, width, height);
    }

    if (glow) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + width * 0.18, y + height * 0.18, width * 0.64, height * 0.64);
    }
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
  if (glow) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x + width * 0.18, y + height * 0.18, width * 0.64, height * 0.64);
  }
  ctx.restore();
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

function drawGhostPiece(state, ctx, layout) {
  const ghost = getGhostPiece(state);
  if (!ghost) {
    return;
  }

  const { cell } = layout;
  const ghostMeta = getCellMeta(ghost);
  if (isNumberBlockType(ghostMeta.type)) {
    const isHorizontal = ghost.shape[0].length > ghost.shape.length;
    drawPieceImage(
      ctx,
      ghost.x * cell,
      (ghost.y - HIDDEN_HEIGHT) * cell,
      ghost.shape[0].length * cell,
      ghost.shape.length * cell,
      ghostMeta.color,
      ghostMeta.type,
      0.32,
      true,
      isHorizontal,
    );
    return;
  }

  ghost.shape.forEach((row, py) => {
    row.forEach((cellOccupied, px) => {
      if (!cellOccupied) {
        return;
      }
      const y = ghost.y + py - HIDDEN_HEIGHT;
      const x = ghost.x + px;
      if (y < 0 || y >= VISIBLE_HEIGHT) {
        return;
      }
      drawCell(ctx, x, y, cell, ghostMeta.color, true, 0.32);
    });
  });
}

function drawNextPiece(state, ctx, layout) {
  const piece = state.next;
  if (!piece || !ctx || !layout) {
    return;
  }

  const { cell, cssW, cssH } = layout;
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#070f20';
  ctx.fillRect(0, 0, cssW, cssH);

  if (!piece) {
    return;
  }

  const shapeWidth = piece.shape[0].length;
  const shapeHeight = piece.shape.length;
  const pieceOffsetX = Math.floor((cssW - shapeWidth * cell) / 2);
  const pieceOffsetY = Math.floor((cssH - shapeHeight * cell) / 2);
  const pieceMeta = getCellMeta(piece);

  ctx.save();
  ctx.translate(pieceOffsetX, pieceOffsetY);

  if (isNumberBlockType(pieceMeta.type)) {
    const isHorizontal = piece.shape[0].length > piece.shape.length;
    drawPieceImage(
      ctx,
      0,
      0,
      shapeWidth * cell,
      shapeHeight * cell,
      pieceMeta.color,
      pieceMeta.type,
      1,
      false,
      isHorizontal,
    );
  } else {
    piece.shape.forEach((row, py) => {
      row.forEach((cellOccupied, px) => {
        if (!cellOccupied) {
          return;
        }
        drawCell(ctx, px, py, cell, pieceMeta.color, false, 1);
      });
    });
  }
  ctx.restore();
}

export function renderNext(state, nextLayout, nextCanvas) {
  if (!nextCanvas || !nextLayout) {
    return;
  }

  const nextCtx = nextCanvas.getContext('2d');
  if (!nextCtx) {
    return;
  }

  drawNextPiece(state, nextCtx, nextLayout);
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
      const boardCell = state.board[y][x];
      if (!boardCell) {
        continue;
      }
      const boardMeta = getCellMeta(boardCell);
      drawCell(ctx, x, y - HIDDEN_HEIGHT, cell, boardMeta.color, true);
    }
  }

  if (state.active) {
    drawGhostPiece(state, ctx, layout);
    const activeMeta = getCellMeta(state.active);

    if (isNumberBlockType(activeMeta.type)) {
      const isHorizontal = state.active.shape[0].length > state.active.shape.length;
      drawPieceImage(
        ctx,
        state.active.x * cell,
        (state.active.y - HIDDEN_HEIGHT) * cell,
        state.active.shape[0].length * cell,
        state.active.shape.length * cell,
        activeMeta.color,
        activeMeta.type,
        1,
        true,
        isHorizontal,
      );
    }
    else {
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
          drawCell(ctx, x, y, cell, activeMeta.color, true);
        });
      });
    }
  }

  // vfx removed to avoid residual color artifacts on empty cells
  drawGrid(ctx, layout);
}
