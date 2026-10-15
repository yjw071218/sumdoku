/* ==========================================================================
   배경 음악 (bgm.js) · v1.1.23
   - 음원 파일 없이 Web Audio로 실시간 합성합니다(용량 0, 저작권 문제 없음).
   - 분위기 두 가지:
       calm    : 홈·일반 난이도. 부드러운 패드 + 펜타토닉 피아노풍 음 (느린 코드 진행)
       lunatic : 루나틱 게임. 낮은 단조 드론 + 드문 불협 음 (절제된 긴장감)
   - 일시정지·결과 화면에서는 소리를 줄이고, 앱이 백그라운드로 가면 멈춥니다.
   - 설정 > '배경 음악' 토글과 음량 슬라이더(사운드 항목 바로 아래)로 조절합니다.
   - 브라우저 정책상 첫 터치 이후에 재생을 시작합니다.
   ========================================================================== */
(function () {
  const KEY_ON = 'sumdoku_bgm_on', KEY_VOL = 'sumdoku_bgm_volume';
  const TXT = {
    title: { ko: '배경 음악', en: 'Background music', ja: 'BGM', zh: '背景音乐', 'zh-TW': '背景音樂', es: 'Música de fondo', fr: 'Musique de fond', de: 'Hintergrundmusik' },
    vol: { ko: '음악 음량', en: 'Music volume', ja: 'BGM音量', zh: '音乐音量', 'zh-TW': '音樂音量', es: 'Volumen de música', fr: 'Volume de la musique', de: 'Musiklautstärke' }
  };
  const lang = () => { try { return (window.I18N && window.I18N.currentLang) || 'ko'; } catch (_) { return 'ko'; } };
  const t = k => TXT[k][lang()] || TXT[k][String(lang()).split('-')[0]] || TXT[k].en;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // 코드 진행 (MIDI 음): calm = C장조 계열 Cmaj7 → Am7 → Fmaj7 → G6, lunatic = D단조 드론 위 불안한 색채
  const MOODS = {
    calm: {
      tempo: 64, // 한 박 = 60/tempo 초, 한 마디 4박
      chords: [[48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 64]],
      scale: [72, 74, 76, 79, 81, 84, 86, 88],
      noteChance: 0.42, padLevel: 0.05, noteLevel: 0.07, cutoff: 1400, wave: 'triangle'
    },
    lunatic: {
      tempo: 44,
      chords: [[38, 45, 50, 53], [38, 44, 50, 53], [37, 44, 49, 52], [38, 45, 50, 56]],
      scale: [62, 63, 65, 68, 69, 74, 75],
      noteChance: 0.2, padLevel: 0.06, noteLevel: 0.05, cutoff: 650, wave: 'sawtooth'
    }
  };

  let ctx = null, master = null, musicBus = null, delay = null, fb = null, wet = null;
  let timer = 0, nextBar = 0, barIndex = 0, mood = null, started = false, padVoices = [];
  let enabled = localStorage.getItem(KEY_ON) !== '0';
  let volume = Math.min(1, Math.max(0, parseFloat(localStorage.getItem(KEY_VOL) ?? '0.6')));
  if (!Number.isFinite(volume)) volume = 0.6;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // 효과음과 같은 AudioContext를 쓰면 기기 자원을 아낄 수 있습니다.
    const sfx = window.app && window.app.sound;
    if (sfx) { try { sfx.init(); } catch (_) {} }
    ctx = (sfx && sfx.ctx) || new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
    // 간단한 공간감: 피드백 딜레이
    delay = ctx.createDelay(2); delay.delayTime.value = 0.42;
    fb = ctx.createGain(); fb.gain.value = 0.35;
    wet = ctx.createGain(); wet.gain.value = 0.32;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200;
    musicBus.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(wet); wet.connect(master);
    return ctx;
  }

  function currentMood() {
    const app = window.app;
    if (!app) return 'calm';
    return app.currentView === 'game' && app.difficulty === 'lunatic' && !app.isBattle ? 'lunatic' : 'calm';
  }

  // 일시정지·결과 화면에서는 작게
  function targetGain() {
    if (!enabled || document.hidden) return 0;
    const app = window.app;
    const quiet = app && app.currentView === 'game' && (app.isPaused || app.isWin);
    return volume * 0.55 * (quiet ? 0.35 : 1);
  }

  function applyGain(sec = 1.2) {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(targetGain(), now + sec);
  }

  // 패드: 코드 구성음마다 살짝 어긋난 오실레이터 2개 → 저역 통과 필터, 천천히 부풀었다 사라짐
  function pad(chord, start, dur, m) {
    chord.forEach((n, k) => {
      [-6, 6].forEach(det => {
        const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o.type = m.wave; o.frequency.value = mtof(n); o.detune.value = det + k * 1.5;
        f.type = 'lowpass'; f.frequency.value = m.cutoff; f.Q.value = 0.3;
        const lvl = m.padLevel / chord.length / (m.wave === 'sawtooth' ? 2.2 : 1);
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(lvl, start + dur * 0.35);
        g.gain.linearRampToValueAtTime(lvl * 0.8, start + dur * 0.75);
        g.gain.linearRampToValueAtTime(0, start + dur + 0.6);
        o.connect(f); f.connect(g); g.connect(musicBus);
        o.start(start); o.stop(start + dur + 0.7);
        padVoices.push(o);
        o.onended = () => { padVoices = padVoices.filter(v => v !== o); };
      });
    });
  }

  // 멜로디 음: 사인파 + 배음 약간, 피아노처럼 빠르게 울리고 천천히 사라짐
  function pluck(n, start, m) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = 'sine'; o.frequency.value = mtof(n);
    o2.type = 'sine'; o2.frequency.value = mtof(n) * 2; g2.gain.value = 0.18;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(m.noteLevel, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, start + 2.6);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicBus);
    o.start(start); o2.start(start); o.stop(start + 2.7); o2.stop(start + 2.7);
  }

  function scheduleBar(start, m) {
    const beat = 60 / m.tempo, bar = beat * 4;
    const chord = m.chords[barIndex % m.chords.length];
    pad(chord, start, bar, m);
    // 8분음표 자리마다 확률적으로 음을 놓되, 직전 음과 가까운 음을 골라 선율처럼 들리게 합니다.
    let last = Math.floor(m.scale.length / 2);
    for (let s = 0; s < 8; s++) {
      if (Math.random() > m.noteChance) continue;
      last = Math.max(0, Math.min(m.scale.length - 1, last + Math.floor(Math.random() * 5) - 2));
      const swing = s % 2 ? beat * 0.06 : 0;
      pluck(m.scale[last], start + s * beat / 2 + swing, m);
    }
    // 루나틱: 마디 첫 박에 아주 낮은 울림(심장 박동처럼 약하게)
    if (m === MOODS.lunatic) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(58, start); o.frequency.exponentialRampToValueAtTime(38, start + 0.4);
      g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(0.09, start + 0.02); g.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      o.connect(g); g.connect(musicBus); o.start(start); o.stop(start + 0.65);
    }
    barIndex++;
    return bar;
  }

  function tick() {
    if (!ctx || !enabled || document.hidden) return;
    const want = currentMood();
    if (want !== mood) {
      // 분위기가 바뀌면 지금 울리는 패드를 빠르게 줄이고 다음 마디부터 새 곡으로
      mood = want; barIndex = 0;
      const now = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(musicBus.gain.value, now);
      musicBus.gain.linearRampToValueAtTime(0, now + 0.8);
      musicBus.gain.linearRampToValueAtTime(1, now + 1.6);
      nextBar = Math.max(nextBar, now + 0.9);
      delay.delayTime.setValueAtTime(mood === 'lunatic' ? 0.6 : 0.42, now);
    }
    applyGain(0.8);
    const m = MOODS[mood];
    while (nextBar < ctx.currentTime + 1.5) {
      if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.05;
      nextBar += scheduleBar(nextBar, m);
    }
  }

  function start() {
    if (!enabled) return;
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (_) {} }
    if (!started) { started = true; nextBar = ctx.currentTime + 0.1; mood = null; }
    clearInterval(timer);
    timer = setInterval(tick, 400);
    tick();
  }

  function stop(fade = 0.8) {
    clearInterval(timer); timer = 0;
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + fade);
    started = false;
  }

  function setEnabled(on) {
    enabled = !!on;
    localStorage.setItem(KEY_ON, enabled ? '1' : '0');
    if (enabled) start(); else stop();
    syncUI();
  }
  function setVolume(v) {
    volume = Math.min(1, Math.max(0, v));
    localStorage.setItem(KEY_VOL, String(volume));
    applyGain(0.2);
    syncUI();
  }

  // 첫 터치 이후 재생 (자동 재생 정책)
  const unlock = () => {
    if (enabled) start();
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, unlock, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, unlock, true));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(0.3);
    else if (enabled) start();
  });

  // ---------- 설정 화면: '사운드' 바로 아래에 토글과 음량 슬라이더 ----------
  function buildUI() {
    const sound = document.getElementById('setting-sound');
    const item = sound && sound.closest('.settings-item');
    if (!item || document.getElementById('setting-bgm')) return;
    const row = document.createElement('div');
    row.className = 'settings-item';
    row.id = 'setting-bgm-row';
    row.innerHTML = '<div class="settings-info"><span class="s-title" id="setting-bgm-title"></span></div>' +
      '<label class="toggle-switch"><input type="checkbox" id="setting-bgm"><span class="slider"></span></label>';
    const vrow = document.createElement('div');
    vrow.className = 'settings-item';
    vrow.id = 'setting-bgm-volume-row';
    vrow.innerHTML = '<div class="settings-info"><span class="s-title" id="setting-bgm-vol-title"></span></div>' +
      '<input type="range" id="setting-bgm-volume" min="0" max="100" step="5" class="bgm-volume">';
    item.after(row, vrow);
    row.querySelector('input').addEventListener('change', e => { setEnabled(e.target.checked); try { window.app?.sound?.play('click'); } catch (_) {} });
    vrow.querySelector('input').addEventListener('input', e => setVolume(e.target.value / 100));
    syncUI();
  }
  function syncUI() {
    const cb = document.getElementById('setting-bgm'), vr = document.getElementById('setting-bgm-volume');
    const tt = document.getElementById('setting-bgm-title'), vt = document.getElementById('setting-bgm-vol-title');
    if (cb) cb.checked = enabled;
    if (vr) { vr.value = Math.round(volume * 100); vr.disabled = !enabled; }
    if (tt) tt.textContent = t('title');
    if (vt) vt.textContent = t('vol');
    const vrow = document.getElementById('setting-bgm-volume-row');
    if (vrow) vrow.style.opacity = enabled ? '' : '.45';
  }

  // 언어를 바꾸면 설정 문구도 바꿉니다.
  if (window.I18N && typeof window.I18N.setLanguage === 'function') {
    const base = window.I18N.setLanguage.bind(window.I18N);
    window.I18N.setLanguage = function () { const r = base.apply(this, arguments); try { syncUI(); } catch (_) {} return r; };
  }

  // 화면 전환·일시정지 시 바로 분위기·음량 반영
  if (typeof SumdokuApp !== 'undefined') {
    const P = SumdokuApp.prototype;
    ['switchView', 'togglePause', 'showGameResultModal', 'startNewGame'].forEach(name => {
      const b = P[name];
      if (typeof b !== 'function') return;
      P[name] = function () {
        const r = b.apply(this, arguments);
        setTimeout(() => { try { if (timer) tick(); } catch (_) {} }, 0);
        return r;
      };
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI); else buildUI();
  window.SumdokuBGM = { start, stop, setEnabled, setVolume, get state() { return { enabled, volume, mood, running: !!timer, ctx: ctx && ctx.state }; } };
})();
