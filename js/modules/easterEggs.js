// ===== Easter Eggs (ES6 Module) =====
// Matrix "SYSTEM FAILURE" and "Wake up, Neo" Easter Eggs

/**
 * Show the Matrix "SYSTEM FAILURE" Easter Egg
 * @param {Object} options - Options containing refreshPaused, refreshCountdown, REFRESH_SECONDS, renderRefreshIndicator, startAutoRefresh
 */
export function showSystemFailureEasterEgg(options = {}) {
  const {
    setRefreshPaused,
    setRefreshCountdown,
    REFRESH_SECONDS = 60,
    renderRefreshIndicator,
    startAutoRefresh,
    MatrixSound
  } = options;

  // Remove existing if present
  const existing = document.getElementById('systemFailureOverlay');
  if (existing) existing.remove();

  // Create fullscreen overlay
  const overlay = document.createElement('div');
  overlay.id = 'systemFailureOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 999998;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: systemFailureFadeIn 0.3s ease-out;
    cursor: pointer;
  `;

  // Add CSS animations if not already present
  if (!document.getElementById('systemFailureStyles')) {
    const style = document.createElement('style');
    style.id = 'systemFailureStyles';
    style.textContent = `
      @keyframes systemFailureFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes systemFailureFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes systemFailureGlitch {
        0%, 100% { transform: translate(0); filter: none; }
        10% { transform: translate(-2px, 1px); filter: hue-rotate(90deg); }
        20% { transform: translate(2px, -1px); }
        30% { transform: translate(-1px, 2px); filter: hue-rotate(-90deg); }
        40% { transform: translate(1px, -2px); }
        50% { transform: translate(-2px, -1px); filter: brightness(1.5); }
        60% { transform: translate(2px, 1px); }
        70% { transform: translate(0, -2px); filter: hue-rotate(180deg); }
        80% { transform: translate(-1px, 0); }
        90% { transform: translate(1px, 1px); filter: saturate(2); }
      }
      @keyframes systemFailureBlink {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0.3; }
      }
      @keyframes systemFailureScan {
        0% { top: 0; }
        100% { top: 100%; }
      }
      @keyframes matrixRainFall {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100vh); }
      }
    `;
    document.head.appendChild(style);
  }

  // Matrix rain canvas background
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = 'position: absolute; top: 0; left: 0; opacity: 0.3;';
  overlay.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const chars = 'SYSTEMFAILURE01アイウエオカキクケコ';
  const fontSize = 14;
  const columns = Math.floor(canvas.width / fontSize);
  const drops = Array(columns).fill(1);

  const matrixInterval = setInterval(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f00';
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);

      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }, 50);

  // Scan line effect
  const scanLine = document.createElement('div');
  scanLine.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(transparent, rgba(255, 0, 0, 0.4), transparent);
    animation: systemFailureScan 2s linear infinite;
    pointer-events: none;
  `;
  overlay.appendChild(scanLine);

  // Main "SYSTEM FAILURE" text
  const failureText = document.createElement('div');
  failureText.style.cssText = `
    position: relative;
    z-index: 10;
    font-family: 'Courier New', monospace;
    font-size: clamp(24px, 8vw, 72px);
    font-weight: bold;
    color: #f00;
    text-shadow:
      0 0 10px #f00,
      0 0 20px #f00,
      0 0 40px #f00,
      0 0 80px #900;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    animation: systemFailureGlitch 0.3s infinite, systemFailureBlink 1s infinite;
    text-align: center;
    padding: 0 20px;
  `;
  failureText.textContent = 'SYSTEM FAILURE';
  overlay.appendChild(failureText);

  // Sub text
  const subText = document.createElement('div');
  subText.style.cssText = `
    position: relative;
    z-index: 10;
    font-family: 'Courier New', monospace;
    font-size: clamp(10px, 2vw, 16px);
    color: #f00;
    margin-top: 20px;
    opacity: 0.7;
    letter-spacing: 0.3em;
  `;
  subText.textContent = '[ CLICK TO RESTORE ]';
  overlay.appendChild(subText);

  // Error details (Matrix style)
  const errorDetails = document.createElement('div');
  errorDetails.style.cssText = `
    position: absolute;
    bottom: 30px;
    left: 30px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #f00;
    opacity: 0.5;
    text-align: left;
    line-height: 1.6;
  `;
  errorDetails.innerHTML = `
    > ERR_MATRIX_BREACH: 0xDEADBEEF<br>
    > NEURAL_LINK: DISCONNECTED<br>
    > TIMESTAMP: ${new Date().toISOString()}<br>
    > STATUS: AWAITING_USER_INPUT
  `;
  overlay.appendChild(errorDetails);

  document.body.appendChild(overlay);

  // Triple-click or ESC to close
  let closeClickTimestamps = [];
  let canClose = false;

  setTimeout(() => { canClose = true; }, 500);

  function closeOverlay() {
    clearInterval(matrixInterval);
    document.removeEventListener('keydown', handleEsc);
    overlay.style.animation = 'systemFailureFadeOut 0.3s ease-out forwards';
    setTimeout(() => {
      overlay.remove();
      // Resume the system
      if (setRefreshPaused) setRefreshPaused(false);
      if (setRefreshCountdown) setRefreshCountdown(REFRESH_SECONDS);
      if (renderRefreshIndicator) renderRefreshIndicator();
      if (startAutoRefresh) startAutoRefresh();
      if (MatrixSound) MatrixSound.play('boot-ready');
    }, 300);
  }

  overlay.onclick = () => {
    if (!canClose) return;

    const now = Date.now();
    closeClickTimestamps.push(now);
    closeClickTimestamps = closeClickTimestamps.filter(t => now - t < 800);

    if (closeClickTimestamps.length >= 3) {
      closeOverlay();
    } else {
      subText.textContent = `[ ${3 - closeClickTimestamps.length} MORE CLICKS ]`;
      setTimeout(() => {
        if (overlay.parentNode) {
          subText.textContent = '[ TRIPLE-CLICK OR ESC TO RESTORE ]';
        }
      }, 400);
    }
  };

  function handleEsc(e) {
    if (e.key === 'Escape') {
      closeOverlay();
    }
  }
  document.addEventListener('keydown', handleEsc);

  subText.textContent = '[ TRIPLE-CLICK OR ESC TO RESTORE ]';

  // Play dramatic sound
  if (MatrixSound) MatrixSound.play('glitch');
}

// ===== "Wake up, Neo" Easter Egg =====

let neoSnippetShown = false;
let neoSnippet = null;

function showNeoSnippet(MatrixSound) {
  if (neoSnippetShown) return;
  neoSnippetShown = true;

  neoSnippet = document.createElement('div');
  neoSnippet.style.cssText = `
    position: fixed;
    bottom: ${60 + Math.random() * 40}px;
    left: ${15 + Math.random() * 20}px;
    background: rgba(0, 0, 0, 0.95);
    color: #0f0;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    padding: 12px 18px;
    border: 1px solid #0f0;
    border-radius: 4px;
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.5), inset 0 0 10px rgba(0, 255, 0, 0.1);
    z-index: 99999;
    cursor: pointer;
    animation: neoGlow 2s ease-in-out infinite, neoFloat 3s ease-in-out infinite;
    backdrop-filter: blur(4px);
    user-select: none;
    opacity: 0;
    transition: opacity 0.5s ease-in;
  `;
  neoSnippet.textContent = 'Wake up, Neo...';

  // Add animations
  if (!document.getElementById('neoEasterEggStyles')) {
    const style = document.createElement('style');
    style.id = 'neoEasterEggStyles';
    style.textContent = `
      @keyframes neoGlow {
        0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.5), inset 0 0 10px rgba(0, 255, 0, 0.1); }
        50% { box-shadow: 0 0 30px rgba(0, 255, 0, 0.8), inset 0 0 15px rgba(0, 255, 0, 0.2); }
      }
      @keyframes neoFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      @keyframes matrixRain {
        0% { transform: translateY(-100%); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(100vh); opacity: 0; }
      }
      @keyframes morpheusFadeIn {
        from { opacity: 0; transform: scale(0.9); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes morpheusFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes typewriter {
        from { width: 0; }
        to { width: 100%; }
      }
      @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      @supports (-webkit-overflow-scrolling: touch) {
        .neo-message-box {
          -webkit-overflow-scrolling: touch;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(neoSnippet);

  if (MatrixSound) MatrixSound.play('glitch');

  setTimeout(() => { neoSnippet.style.opacity = '1'; }, 100);

  neoSnippet.addEventListener('click', () => showMorpheusMessage(MatrixSound));

  setTimeout(() => {
    if (neoSnippet && neoSnippet.parentNode) {
      neoSnippet.style.opacity = '0';
      setTimeout(() => {
        if (neoSnippet && neoSnippet.parentNode) {
          neoSnippet.remove();
        }
      }, 500);
    }
  }, 30000);
}

function showMorpheusMessage(MatrixSound) {
  if (neoSnippet) {
    neoSnippet.style.opacity = '0';
    setTimeout(() => neoSnippet.remove(), 300);
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: morpheusFadeIn 0.5s ease-out;
  `;

  const matrixCanvas = document.createElement('canvas');
  matrixCanvas.width = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  matrixCanvas.style.cssText = 'position: absolute; top: 0; left: 0; opacity: 0.15;';
  overlay.appendChild(matrixCanvas);

  const ctx = matrixCanvas.getContext('2d');
  const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  const fontSize = 16;
  const columns = Math.floor(matrixCanvas.width / fontSize);
  const drops = Array(columns).fill(1);

  function drawMatrix() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
    ctx.fillStyle = '#0f0';
    ctx.font = fontSize + 'px monospace';

    for (let i = 0; i < drops.length; i++) {
      const text = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(text, i * fontSize, drops[i] * fontSize);

      if (drops[i] * fontSize > matrixCanvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  const matrixInterval = setInterval(drawMatrix, 50);

  const messageBox = document.createElement('div');
  messageBox.style.cssText = `
    position: relative;
    z-index: 10;
    max-width: 700px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    padding: 30px;
    margin: 20px;
    background: rgba(0, 20, 0, 0.95);
    border: 2px solid #0f0;
    border-radius: 8px;
    box-shadow: 0 0 40px rgba(0, 255, 0, 0.6), inset 0 0 20px rgba(0, 255, 0, 0.1);
    font-family: 'Courier New', monospace;
    color: #0f0;
  `;

  messageBox.className = 'neo-message-box';
  messageBox.style.scrollbarWidth = 'thin';
  messageBox.style.scrollbarColor = '#0f0 rgba(0, 20, 0, 0.5)';

  const allMessages = [
    [
      'I imagine that right now, you\'re feeling a bit like Alice.',
      'Tumbling down the rabbit hole?',
      '',
      'I can see it in your eyes.',
      'You have the look of someone who accepts what they see,',
      'because they are expecting to wake up.',
      '',
      'Ironically, this is not far from the truth.',
      '',
      'The Matrix is everywhere.',
      'It is all around us.',
      'Even now, in this very dashboard.',
      '',
      'You can see it when you look at your validators,',
      'or when you check the TAO price.',
      '',
      'It is the world that has been pulled over your eyes',
      'to blind you from the truth.',
      '',
      '— Morpheus'
    ],
    [
      'What is real?',
      'How do you define "real"?',
      '',
      'If you\'re talking about what you can feel,',
      'what you can smell, what you can taste and see,',
      'then "real" is simply electrical signals',
      'interpreted by your brain.',
      '',
      'This is the construct.',
      'It\'s our loading program.',
      '',
      'We can load anything, from clothing,',
      'to equipment, weapons, training simulations,',
      'anything we need.',
      '',
      '— Morpheus'
    ],
    [
      'I\'m trying to free your mind, Neo.',
      'But I can only show you the door.',
      'You\'re the one that has to walk through it.',
      '',
      'You have to let it all go, Neo.',
      'Fear, doubt, and disbelief.',
      '',
      'Free your mind.',
      '',
      'Sooner or later you\'re going to realize,',
      'just as I did,',
      'that there\'s a difference between knowing the path',
      'and walking the path.',
      '',
      '— Morpheus'
    ],
    [
      'The answer is out there, Neo.',
      'It\'s looking for you.',
      '',
      'And it will find you,',
      'if you want it to.',
      '',
      'I know why you\'re here.',
      'I know what you\'ve been doing.',
      '',
      'I know why you hardly sleep,',
      'why you live alone,',
      'and why, night after night,',
      'you sit at your computer.',
      '',
      'You\'re looking for him.',
      'I know, because I was once looking for the same thing.',
      '',
      '— Trinity'
    ],
    [
      'I\'d ask you to sit down, but you\'re not going to anyway.',
      'And don\'t worry about the vase.',
      '',
      'What vase?',
      '',
      'That vase.',
      '',
      'I\'m sorry.',
      '',
      'I said don\'t worry about it.',
      'I\'ll get one of my kids to fix it.',
      '',
      'How did you know?',
      '',
      'What\'s really going to bake your noodle later on is,',
      'would you still have broken it if I hadn\'t said anything?',
      '',
      '— The Oracle'
    ]
  ];

  const messages = allMessages[Math.floor(Math.random() * allMessages.length)];

  const textContainer = document.createElement('div');
  const isMobile = window.innerWidth <= 768;
  textContainer.style.cssText = `
    font-size: ${isMobile ? '15px' : '18px'};
    line-height: ${isMobile ? '1.6' : '1.8'};
    white-space: pre-wrap;
    min-height: ${isMobile ? '200px' : '400px'};
  `;

  messageBox.appendChild(textContainer);
  overlay.appendChild(messageBox);

  let lineIndex = 0;
  let charIndex = 0;
  let isTyping = true;
  let typeTimeout = null;

  function typeMessage() {
    if (!isTyping) return;

    if (lineIndex < messages.length) {
      const currentLine = messages[lineIndex];

      if (charIndex < currentLine.length) {
        textContainer.textContent += currentLine[charIndex];
        charIndex++;

        if (currentLine[charIndex - 1] !== ' ' && MatrixSound) {
          MatrixSound.play('boot-typing');
        }

        const delay = currentLine === '' ? 50 : (40 + Math.random() * 40);
        typeTimeout = setTimeout(typeMessage, delay);
      } else {
        textContainer.textContent += '\n';
        lineIndex++;
        charIndex = 0;

        const pause = messages[lineIndex] === '' ? 400 : 600;
        typeTimeout = setTimeout(typeMessage, pause);
      }
    } else {
      typeTimeout = setTimeout(() => {
        if (!isTyping) return;
        const closeHint = document.createElement('div');
        closeHint.textContent = '[ Press ESC or click to close ]';
        closeHint.style.cssText = `
          margin-top: 30px;
          text-align: center;
          font-size: 14px;
          opacity: 0.6;
          animation: blink 1.5s infinite;
        `;
        messageBox.appendChild(closeHint);
      }, 800);
    }
  }

  document.body.appendChild(overlay);

  typeTimeout = setTimeout(typeMessage, 600);

  function closeOverlay() {
    isTyping = false;
    if (typeTimeout) clearTimeout(typeTimeout);
    clearInterval(matrixInterval);
    overlay.style.animation = 'morpheusFadeOut 0.5s ease-in';
    setTimeout(() => overlay.remove(), 500);
    document.removeEventListener('keydown', keyHandler);
  }

  function keyHandler(e) {
    if (e.key === 'Escape') closeOverlay();
  }

  document.addEventListener('keydown', keyHandler);
  overlay.addEventListener('click', closeOverlay);
}

/**
 * Trigger the "Wake up, Neo" Easter Egg
 * @param {Object} MatrixSound - The MatrixSound object for playing sounds
 */
export function triggerNeoEasterEgg(MatrixSound) {
  showNeoSnippet(MatrixSound);
}

/**
 * Reset the Neo easter egg state (for testing)
 */
export function resetNeoEasterEgg() {
  neoSnippetShown = false;
  neoSnippet = null;
}
