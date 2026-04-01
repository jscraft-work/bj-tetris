export const BOARD_WIDTH = 10;
export const VISIBLE_HEIGHT = 20;
export const HIDDEN_HEIGHT = 2;
export const BOARD_HEIGHT = VISIBLE_HEIGHT + HIDDEN_HEIGHT;
export const BASE_DROP_MS = 800;
export const SOFT_DROP_FACTOR = 0.2;
export const MIN_DROP_MS = 100;
export const VFX_ROTATE_MS = 140;
export const VFX_LINE_CLEAR_MS = 110;
export const VFX_LINE_FADE_MS = 350;
export const VFX_IMPACT_MS = 100;
export const VFX_ALL_CLEAR_MS = 1800;
export const VFX_POOP_SPLASH_MS = 420;
export const LOCK_DELAY_MS = 200;

export const STANDARD_PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
export const SPECIAL_BLOCK_TYPES = ['1', '2', '3', '4', 'D', 'd', 'b', 'F'];
export const PIECE_TYPES = [...STANDARD_PIECE_TYPES, ...SPECIAL_BLOCK_TYPES];

export const PIECE_SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
  1: [[1]],
  2: [[1], [1]],
  3: [[1], [1], [1]],
  4: [[1], [1], [1], [1]],
  D: [
    [1, 1],
    [1, 1],
  ],
  d: [
    [0, 1],
    [1, 1],
    [1, 1],
  ],
  b: [
    [1, 0],
    [1, 1],
    [1, 1],
  ],
  F: [
    [1, 1],
    [1, 1],
    [1, 1],
  ],
};

export const PIECE_COLOR = {
  I: '#3ed2f3',
  J: '#4f6dff',
  L: '#ff8f1a',
  O: '#ffd93d',
  S: '#40c4aa',
  T: '#b84dff',
  Z: '#ff3f6a',
  1: '#4fa8ff',
  2: '#7ed957',
  3: '#f5b400',
  4: '#ff6aa2',
  D: '#8b5a2b',
  d: '#d7322d',
  b: '#34a853',
  F: '#c6dff6',
};

export const SPECIAL_BLOCK_IMAGES = {
  O: './assets/blocks/question-block.svg',
  1: './assets/blocks/1.png',
  2: './assets/blocks/2.png',
  3: './assets/blocks/3.png',
  4: './assets/blocks/4.png',
  D: './assets/blocks/poop.svg',
  p: './assets/blocks/poop-mini.svg',
  d: './assets/blocks/d.svg',
  b: './assets/blocks/b.svg',
  F: './assets/blocks/fridge.svg',
};

export const SCORE_BY_LINES = [0, 100, 300, 500, 800];

export const SFX_KEYS = {
  MOVE: 'move',
  ROTATE: 'rotate',
  SOFT_DROP_TICK: 'soft_drop_tick',
  HARD_DROP: 'hard_drop',
  LOCK: 'lock',
  LINE_CLEAR_1: 'line_clear_1',
  LINE_CLEAR_2: 'line_clear_2',
  LINE_CLEAR_3: 'line_clear_3',
  LINE_CLEAR_4: 'line_clear_4',
  GAME_OVER: 'game_over',
  LEVEL_UP: 'level_up',
  PAUSE: 'pause',
  RESUME: 'resume',
  START: 'start',
  RESTART: 'restart',
};
