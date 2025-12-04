// boot.js
// Matrix Terminal Boot Overlay

function runTerminalBoot() {
  const overlay = document.getElementById('terminalBoot');
  if (!overlay) return;

  const line1 = document.getElementById('termLine1');
  const line2 = document.getElementById('termLine2');
  const line3 = document.getElementById('termLine3');
  const lineEls = [line1, line2, line3];

  const lines = [
    '> connecting to bittensor...',
    '> decrypting network data...',
    '> [pill me]'
  ];
  const delays = [800, 800, 600]; // ms per line
  const fadeDelay = 400;
  let i = 0;
  const MAX_BOOT_MS = 5000;
  const forcedTimeout = setTimeout(() => {
    try {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.classList.add('hidden');
        document.dispatchEvent(new CustomEvent('terminalBootDone'));
      }, fadeDelay);
    } catch (e) {}
  }, MAX_BOOT_MS);
  function showNext() {
    if (i < lines.length) {
      lineEls[i].textContent = lines[i];
      lineEls[i].classList.add('visible');
      i++;
      setTimeout(showNext, delays[i - 1]);
    } else {
      clearTimeout(forcedTimeout);
      setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
          overlay.classList.add('hidden');
          document.dispatchEvent(new CustomEvent('terminalBootDone'));
        }, fadeDelay);
      }, 800);
    }
  }
  showNext();
}

window.runTerminalBoot = runTerminalBoot;
