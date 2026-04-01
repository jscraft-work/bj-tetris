import {
  BOARD_WIDTH,
  VISIBLE_HEIGHT,
  HIDDEN_HEIGHT,
  SPECIAL_BLOCK_IMAGES,
  VFX_LINE_CLEAR_MS,
  VFX_LINE_FADE_MS,
  VFX_IMPACT_MS,
  VFX_ALL_CLEAR_MS,
  VFX_POOP_SPLASH_MS,
} from './constants.js';
import { getGhostPiece } from './state.js';

function isSpecialBlockType(type) {
  return !!SPECIAL_BLOCK_IMAGES[String(type)];
}

const pieceImageCache = new Map();
const ANDROID_ASSET_PREFIX = 'file:///android_asset/';

function getPieceImageCandidates(type) {
  const src = SPECIAL_BLOCK_IMAGES[String(type)];
  if (!src) {
    return [];
  }

  const normalizedSrc = src.replace(/^\.\//, '');
  const href = window && window.location && window.location.href ? window.location.href : '';
  const isAndroidAssetPath = href.startsWith(ANDROID_ASSET_PREFIX);
  const candidates = [src];

  if (normalizedSrc !== src) {
    candidates.push(normalizedSrc);
  }

  if (isAndroidAssetPath) {
    candidates.push(`${ANDROID_ASSET_PREFIX}${normalizedSrc}`);
  }

  return Array.from(new Set(candidates));
}

function getPieceImage(type) {
  const srcCandidates = getPieceImageCandidates(type);
  if (!srcCandidates.length) {
    return null;
  }

  const key = String(type);
  if (pieceImageCache.has(key)) {
    return pieceImageCache.get(key);
  }

  const img = new Image();
  let srcIndex = 0;
  const tryNextSource = () => {
    if (srcIndex >= srcCandidates.length) {
      return;
    }
    img.src = srcCandidates[srcIndex];
    srcIndex += 1;
  };

  img.onerror = () => {
    tryNextSource();
  };
  tryNextSource();
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

function isMiniPoopType(type) {
  return String(type) === 'p';
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
  if (useImage && isSpecialBlockType(type)) {
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

function drawPieceImage(ctx, x, y, width, height, color, type, alpha, glow = false, quarterTurns = 0, shape = null) {
  const img = getPieceImage(type);
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (img && img.width > 0 && img.height > 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (shape && shape.length && shape[0] && shape[0].length) {
      const cellsY = shape.length;
      const cellsX = shape[0].length;
      const cellW = width / cellsX;
      const cellH = height / cellsY;
      ctx.beginPath();
      for (let py = 0; py < cellsY; py += 1) {
        for (let px = 0; px < cellsX; px += 1) {
          if (!shape[py][px]) {
            continue;
          }
          ctx.rect(x + px * cellW, y + py * cellH, cellW, cellH);
        }
      }
      ctx.clip();
    }
    if (turns === 0) {
      ctx.drawImage(img, x, y, width, height);
    } else {
      const isOddTurn = turns % 2 === 1;
      const drawW = isOddTurn ? height : width;
      const drawH = isOddTurn ? width : height;
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate((Math.PI / 2) * turns);
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
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

function getSpecialPieceQuarterTurns(piece) {
  if (piece.type !== '2' && piece.type !== '3' && piece.type !== '4') {
    return ((piece.rotation || 0) % 4 + 4) % 4;
  }

  const shapeHeight = piece.shape.length;
  const shapeWidth = piece.shape[0].length;
  // Keep legacy behavior for bar-style special blocks: only match board orientation.
  return shapeWidth > shapeHeight ? 1 : 0;
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

function drawPoopSplash(ctx, state, layout, now) {
  const remaining = state.vfx.poopSplashUntil - now;
  if (remaining <= 0) {
    return;
  }

  const cells = state.vfx.poopSplashCells || [];
  if (!cells.length) {
    return;
  }

  const progress = 1 - remaining / VFX_POOP_SPLASH_MS;
  const alpha = Math.max(0, 0.62 * (1 - progress));
  const { cell } = layout;

  ctx.save();
  cells.forEach(({ x, y }, index) => {
    const cx = (x + 0.5) * cell;
    const cy = (y + 0.5) * cell;
    const droplets = 10;
    for (let i = 0; i < droplets; i += 1) {
      const angle = ((index * 31 + i * 67) % 360) * (Math.PI / 180);
      const radius = (0.1 + progress * 0.82) * cell;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      const size = Math.max(1.6, cell * (0.075 + 0.038 * (i % 2)));
      ctx.fillStyle = `rgba(120, 74, 35, ${alpha})`;
      ctx.fillRect(px - size / 2, py - size / 2, size, size);

      const highlight = Math.max(1, size * 0.45);
      ctx.fillStyle = `rgba(186, 128, 86, ${alpha * 0.55})`;
      ctx.fillRect(px - highlight / 2, py - highlight / 2, highlight, highlight);
    }
  });
  ctx.restore();
}

function drawGhostPiece(state, ctx, layout) {
  const ghost = getGhostPiece(state);
  if (!ghost) {
    return;
  }

  const { cell } = layout;
  const ghostMeta = getCellMeta(ghost);
  if (isSpecialBlockType(ghostMeta.type)) {
    const quarterTurns = getSpecialPieceQuarterTurns(ghost);
    drawPieceImage(
      ctx,
      ghost.x * cell,
      (ghost.y - HIDDEN_HEIGHT) * cell,
      ghost.shape[0].length * cell,
      ghost.shape.length * cell,
      ghostMeta.color,
      ghostMeta.type,
      0.32,
      false,
      quarterTurns,
      ghost.shape,
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

  if (isSpecialBlockType(pieceMeta.type)) {
    const quarterTurns = getSpecialPieceQuarterTurns(piece);
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
      quarterTurns,
      piece.shape,
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

function drawAllClear(ctx, state, layout, now) {
  const remaining = state.vfx.allClearUntil - now;
  if (remaining <= 0) {
    return;
  }

  const { cell } = layout;
  const boardW = BOARD_WIDTH * cell;
  const boardH = VISIBLE_HEIGHT * cell;
  const elapsed = VFX_ALL_CLEAR_MS - remaining;
  const progress = elapsed / VFX_ALL_CLEAR_MS;

  const centerX = boardW / 2;
  const centerY = boardH * 0.42;

  ctx.save();

  const textAlpha = progress > 0.82 ? Math.max(0, 1 - (progress - 0.82) / 0.18) : 1;
  const scale = progress < 0.18 ? 0.8 + (progress / 0.18) * 0.2 : 1;
  const hue = (elapsed * 0.12) % 360;
  const glowColor = `hsl(${hue}, 100%, 70%)`;

  ctx.fillStyle = 'rgba(6, 12, 28, 0.72)';
  ctx.fillRect(0, 0, boardW, boardH);

  const panelW = boardW * 0.72;
  const panelH = Math.max(96, boardH * 0.28);
  const panelX = (boardW - panelW) / 2;
  const panelY = centerY - panelH / 2;

  ctx.globalAlpha = textAlpha;
  ctx.fillStyle = 'rgba(13, 24, 52, 0.92)';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(panelX + 1.5, panelY + 1.5, panelW - 3, panelH - 3);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(centerX, centerY - panelH * 0.08);
  ctx.scale(scale, scale);
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 18;
  ctx.font = `bold ${Math.max(22, Math.min(boardW / 6, cell * 2.1))}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ALL CLEAR!', 0, 0);
  ctx.restore();

  ctx.font = `bold ${Math.max(11, cell * 0.72)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(220, 232, 255, 0.92)';
  ctx.fillText('Board Reset Bonus', centerX, centerY + panelH * 0.18);

  const sparkleCount = 18;
  for (let i = 0; i < sparkleCount; i += 1) {
    const angle = ((i * 41 + elapsed * 0.08) % 360) * (Math.PI / 180);
    const radiusX = panelW * 0.44;
    const radiusY = panelH * 0.65;
    const px = centerX + Math.cos(angle) * radiusX;
    const py = centerY + Math.sin(angle) * radiusY;
    const size = 2 + (i % 3);
    ctx.fillStyle = `hsla(${(hue + i * 12) % 360}, 100%, 72%, ${0.35 * textAlpha})`;
    ctx.fillRect(px - size / 2, py - size / 2, size, size);
  }

  ctx.restore();
}

export function render(state, layout, ctx, now = Date.now()) {
  const { cell } = layout;
  const boardW = BOARD_WIDTH * cell;
  const boardH = VISIBLE_HEIGHT * cell;

  ctx.clearRect(0, 0, boardW, boardH);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, boardW, boardH);
  drawGrid(ctx, layout);

  const clearingRows = state.clearing ? state.clearing.rows : null;
  let clearingProgress = 0;
  if (state.clearing) {
    const elapsed = Date.now() - state.clearing.startedAt;
    clearingProgress = Math.min(1, elapsed / VFX_LINE_FADE_MS);
  }

  for (let y = HIDDEN_HEIGHT; y < state.board.length; y += 1) {
    const isClearing = clearingRows && clearingRows.includes(y);

    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const boardCell = state.board[y][x];
      if (!boardCell) {
        continue;
      }
      const boardMeta = getCellMeta(boardCell);
      const useMiniPoopImage = isMiniPoopType(boardMeta.type);
      const useCellImage = useMiniPoopImage;
      const cellGlow = !useCellImage;
      if (isClearing) {
        // Fade out: full alpha at start → 0 at end
        const alpha = Math.max(0, 1 - clearingProgress);
        drawCell(ctx, x, y - HIDDEN_HEIGHT, cell, boardMeta.color, cellGlow, alpha, {
          useImage: useCellImage,
          type: boardMeta.type,
        });
      } else {
        drawCell(ctx, x, y - HIDDEN_HEIGHT, cell, boardMeta.color, cellGlow, 1, {
          useImage: useCellImage,
          type: boardMeta.type,
        });
      }
    }
  }

  // White flash overlay on clearing rows
  if (state.clearing && clearingProgress < 0.35) {
    const flashAlpha = (1 - clearingProgress / 0.35) * 0.55;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    clearingRows.forEach((y) => {
      if (y >= HIDDEN_HEIGHT) {
        ctx.fillRect(0, (y - HIDDEN_HEIGHT) * cell, boardW, cell);
      }
    });
    ctx.restore();
  }

  if (state.active) {
    drawGhostPiece(state, ctx, layout);
    const activeMeta = getCellMeta(state.active);

    if (isSpecialBlockType(activeMeta.type)) {
      const quarterTurns = getSpecialPieceQuarterTurns(state.active);
      drawPieceImage(
        ctx,
        state.active.x * cell,
        (state.active.y - HIDDEN_HEIGHT) * cell,
        state.active.shape[0].length * cell,
        state.active.shape.length * cell,
        activeMeta.color,
        activeMeta.type,
        1,
        false,
        quarterTurns,
        state.active.shape,
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

  drawPoopSplash(ctx, state, layout, now);
  drawAllClear(ctx, state, layout, now);
}
