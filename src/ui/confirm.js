export function showConfirm(message) {
  return new Promise((resolve) => {
    const dialog = document.getElementById('confirmDialog');
    const msgEl = document.getElementById('confirmMessage');
    const yesBtn = document.getElementById('confirmYes');
    const noBtn = document.getElementById('confirmNo');

    msgEl.textContent = message;
    dialog.classList.remove('hidden');

    function cleanup(result) {
      dialog.classList.add('hidden');
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      resolve(result);
    }

    function onYes() {
      cleanup(true);
    }
    function onNo() {
      cleanup(false);
    }

    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
  });
}
