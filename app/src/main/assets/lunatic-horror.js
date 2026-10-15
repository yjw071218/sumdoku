/* ==========================================================================
   루나틱 공포 연출 (lunatic-horror.js)
   - 싱글 루나틱 게임 화면에서만 켜집니다(배틀·다른 난이도·다른 화면에서는 꺼짐).
   - 입장 암전 연출, 심장 박동 비네트, 실수 시 붉은 섬광·흔들림·진동,
     마지막 목숨 압박, 가끔 깜빡이는 붉은 눈(글자 연출 없음).
   - 게임 로직은 바꾸지 않고 화면만 덧씌웁니다.
   ========================================================================== */
(function () {
  if (typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;

  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  let overlay = null, whisperTimer = 0, observer = null, active = false, lastMistakes = -1, introKey = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'lh-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="lh-vignette"></div><div class="lh-noise"></div><div class="lh-flash"></div><div class="lh-eyes">● ●</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function parseMistakes() {
    const t = (document.getElementById('mistakes-count') || {}).textContent || '';
    const m = t.match(/(\d+)\s*\/\s*(\d+|∞)/);
    return m ? { n: +m[1], max: m[2] === '∞' ? Infinity : +m[2] } : null;
  }

  function hit() {
    const vg = document.getElementById('view-game');
    const ov = ensureOverlay();
    ov.classList.remove('hit'); void ov.offsetWidth; ov.classList.add('hit');
    if (!reduced() && vg) {
      vg.classList.remove('lh-shake'); void vg.offsetWidth; vg.classList.add('lh-shake');
      setTimeout(() => vg.classList.remove('lh-shake'), 450);
    }
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (_) {}
  }

  function updateDread() {
    const vg = document.getElementById('view-game');
    const mm = parseMistakes();
    if (!vg || !mm) return;
    const dread = mm.max !== Infinity && mm.n >= mm.max - 1 && mm.n < mm.max;
    vg.classList.toggle('lh-dread', dread);
    const ov = ensureOverlay();
    ov.classList.toggle('dread', dread);
    // 실수가 쌓일수록 심장 박동이 빨라집니다.
    const beat = dread ? 0.72 : Math.max(0.9, 1.6 - mm.n * 0.3);
    vg.style.setProperty('--lh-beat', beat + 's');
    ov.style.setProperty('--lh-beat', beat + 's');
    if (lastMistakes >= 0 && mm.n > lastMistakes) hit();
    lastMistakes = mm.n;
  }

  function schedule() {
    clearTimeout(whisperTimer);
    if (!active) return;
    const dread = document.getElementById('view-game')?.classList.contains('lh-dread');
    whisperTimer = setTimeout(whisper, (dread ? 14000 : 26000) + Math.random() * 20000);
  }

  function whisper() {
    if (!active) return;
    const app = window.app;
    if (reduced() || (app && (app.isPaused || app.isWin))) return schedule();
    const ov = ensureOverlay();
    const eyes = ov.querySelector('.lh-eyes');
    eyes.classList.remove('show'); void eyes.offsetWidth; eyes.classList.add('show');
    schedule();
  }

  function puzzleKey(app) {
    const cg = app.cages || [];
    return cg.map(c => (c.cells[0] || []).join('') + ':' + c.cells.length).join('|');
  }

  function intro(app) {
    if (reduced()) return;
    const key = puzzleKey(app);
    if (!key || introKey === key) return;
    introKey = key;
    const el = document.createElement('div');
    el.id = 'lh-intro';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }

  function sync(app) {
    app = app || window.app;
    if (!app) return;
    const on = app.currentView === 'game' && app.difficulty === 'lunatic' && !app.isBattle && !!(app.cages && app.cages.length);
    const vg = document.getElementById('view-game');
    if (vg) vg.classList.toggle('lunatic-mode', on);
    document.body.classList.toggle('lunatic-active', on);
    const ov = ensureOverlay();
    ov.classList.toggle('on', on);
    if (on) {
      intro(app);
      if (!active) {
        active = true;
        lastMistakes = -1;
        const mc = document.getElementById('mistakes-count');
        if (mc && !observer) {
          observer = new MutationObserver(() => { if (active) updateDread(); });
          observer.observe(mc, { childList: true, characterData: true, subtree: true });
        }
        schedule();
      }
      updateDread();
    } else if (active) {
      active = false;
      clearTimeout(whisperTimer);
      if (vg) vg.classList.remove('lh-dread', 'lh-shake');
      ov.classList.remove('dread', 'hit');
    }
  }

  ['switchView', 'renderBoard', 'showGameResultModal'].forEach(name => {
    const base = P[name];
    if (typeof base !== 'function') return;
    P[name] = function () {
      const r = base.apply(this, arguments);
      try { sync(this); } catch (_) {}
      return r;
    };
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(whisperTimer);
    else if (active) schedule();
  });

  window.LunaticHorror = { sync };
  if (window.app) sync(window.app);
})();
