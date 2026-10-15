/* ==========================================================================
   루나틱 화면 (lunatic-horror.js) · v1.1.22 절제 버전
   - 싱글 루나틱 게임 화면에서만 켜집니다(배틀·다른 난이도·다른 화면에서는 꺼짐).
   - 어두운 팔레트와 옅은 비네트, '?' 배지 맥박(실수할수록 조금 빨라짐),
     실수 시 짧은 붉은 섬광·작은 흔들림만 남겼습니다. 입장 암전·붉은 눈·잡음은 제거했습니다.
   - 게임 로직은 바꾸지 않고 화면만 덧씌웁니다.
   ========================================================================== */
(function () {
  if (typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;

  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  let overlay = null, observer = null, active = false, lastMistakes = -1;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'lh-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="lh-vignette"></div><div class="lh-flash"></div>';
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
      setTimeout(() => vg.classList.remove('lh-shake'), 280);
    }
    try { if (navigator.vibrate) navigator.vibrate(40); } catch (_) {}
  }

  function updateDread() {
    const vg = document.getElementById('view-game');
    const mm = parseMistakes();
    if (!vg || !mm) return;
    const dread = mm.max !== Infinity && mm.n >= mm.max - 1 && mm.n < mm.max;
    vg.classList.toggle('lh-dread', dread);
    const ov = ensureOverlay();
    ov.classList.toggle('dread', dread);
    // '?' 배지 맥박: 실수가 쌓일수록 조금씩 빨라집니다.
    const beat = dread ? 1.0 : Math.max(1.2, 1.8 - mm.n * 0.3);
    vg.style.setProperty('--lh-beat', beat + 's');
    if (lastMistakes >= 0 && mm.n > lastMistakes) hit();
    lastMistakes = mm.n;
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
      if (!active) {
        active = true;
        lastMistakes = -1;
        const mc = document.getElementById('mistakes-count');
        if (mc && !observer) {
          observer = new MutationObserver(() => { if (active) updateDread(); });
          observer.observe(mc, { childList: true, characterData: true, subtree: true });
        }
      }
      updateDread();
    } else if (active) {
      active = false;
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

  window.LunaticHorror = { sync };
  if (window.app) sync(window.app);
})();
