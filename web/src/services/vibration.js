let enabled = true;
let lastPulseMs = 0;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function canVibrate() {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    !!navigator.vibrate
  );
}

export function setVibrationEnabled(isEnabled) {
  enabled = !!isEnabled;
}

export function isVibrationEnabled() {
  return enabled;
}

export function pulse(patternOrDuration) {
  if (!enabled || !canVibrate()) {
    return;
  }

  const now = nowMs();
  if (now - lastPulseMs < 60) {
    return;
  }
  lastPulseMs = now;

  navigator.vibrate(patternOrDuration);
}
