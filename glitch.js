// glitch.js
// Matrix Glitch Overlay: global trigger

window.showMatrixGlitch = function() {
  const glitch = document.getElementById('matrixGlitch');
  if (glitch) {
    const codeEl = glitch.querySelector('.matrix-glitch-code');
    if (codeEl) {
      const palette = [
        '#22c55e', '#16a34a', '#14532d', '#a3a3a3', '#525252', '#eaff00', '#b3b300', '#d1fae5', '#d4d4d4'
      ];
      const glyphs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz░▒▓█▲◆◀▶◼︎◻︎※☰☲☷☯☢☣☠♠♣♥♦♤♧♡♢';
      let code = '';
      for (let i = 0; i < 10; i++) {
        let str = '';
        for (let j = 0; j < 8; j++) {
          const ch = glyphs[Math.floor(Math.random()*glyphs.length)];
          const color = palette[Math.floor(Math.random()*palette.length)];
          str += `<span style=\"color:${color};\">${ch.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
        }
        code += `<span>${str}</span>`;
      }
      codeEl.innerHTML = code;
    }
    glitch.style.display = 'flex';
    glitch.classList.add('active');
    setTimeout(() => {
      glitch.classList.remove('active');
      setTimeout(() => {
        glitch.style.display = 'none';
      }, 180);
    }, 360);
  }
};
