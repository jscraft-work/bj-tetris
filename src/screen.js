const SCREENS = ['login', 'lobby', 'game'];
let currentScreen = 'login';
const listeners = [];

export function getCurrentScreen() {
  return currentScreen;
}

export function showScreen(name) {
  if (!SCREENS.includes(name)) return;
  currentScreen = name;
  SCREENS.forEach((s) => {
    const el = document.getElementById(`screen-${s}`);
    if (!el) return;
    if (s === name) {
      el.classList.remove('screen-hidden');
    } else {
      el.classList.add('screen-hidden');
    }
  });
  listeners.forEach((fn) => fn(name));
}

export function onScreenChange(fn) {
  listeners.push(fn);
}
