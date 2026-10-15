/* ==========================================================================
   배경 음악 (bgm.js) · v1.1.24
   - 음원 파일 없이 Web Audio로 실시간 합성합니다(용량 0, 저작권 문제 없음).
   - 게임 상황별 곡(우선순위 순):
       win           : 퍼즐 완성. 반짝이는 상승 팡파르 후 밝은 장조 곡
       lose          : 목숨을 모두 잃음. 느리고 가라앉는 단조 곡
       danger        : 마지막 목숨(일반). 빠른 베이스·드럼·현악 긴장감
       lunaticDanger : 마지막 목숨(루나틱). 더 어둡고 반음이 섞인 긴장감
       lunatic       : 루나틱. 낮은 드론·심장 박동·드문 종소리
       calm          : 홈·일반 게임. 8마디마다 코드 진행과 주 악기가 바뀝니다
   - 악기: 일렉트릭 피아노(FM), 플루트, 종(벨), 마림바, 하프, 현악 패드, 베이스, 킥, 하이햇
   - 상황이 바뀌면 다음 마디를 기다리지 않고 0.5초 크로스페이드로 즉시 전환합니다.
   - 일시정지·결과 화면에서는 작게, 앱이 백그라운드로 가면 멈춥니다.
   ========================================================================== */
(function () {
  const KEY_ON = 'sumdoku_bgm_on', KEY_VOL = 'sumdoku_bgm_volume';
  const DEFAULT_VOL = 0.85;
  const TXT = {
    title: { ko: '배경 음악', en: 'Background music', ja: 'BGM', zh: '背景音乐', 'zh-TW': '背景音樂', es: 'Música de fondo', fr: 'Musique de fond', de: 'Hintergrundmusik' },
    vol: { ko: '음악 음량', en: 'Music volume', ja: 'BGM音量', zh: '音乐音量', 'zh-TW': '音樂音量', es: 'Volumen de música', fr: 'Volume de la musique', de: 'Musiklautstärke' }
  };
  const lang = () => { try { return (window.I18N && window.I18N.currentLang) || 'ko'; } catch (_) { return 'ko'; } };
  const t = k => TXT[k][lang()] || TXT[k][String(lang()).split('-')[0]] || TXT[k].en;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const chance = p => Math.random() < p;

  let ctx = null, master = null, comp = null, delay = null, delayFb = null, delayWet = null, noiseBuf = null;
  let timer = 0, player = null, enabled = localStorage.getItem(KEY_ON) !== '0';
  let volume = parseFloat(localStorage.getItem(KEY_VOL) ?? String(DEFAULT_VOL));
  if (!Number.isFinite(volume)) volume = DEFAULT_VOL;
  volume = Math.min(1, Math.max(0, volume));

  /* ---------------------------------------------------------------- 오디오 그래프 */
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const sfx = window.app && window.app.sound;
    if (sfx) { try { sfx.init(); } catch (_) {} }
    ctx = (sfx && sfx.ctx) || new AC();
    // 음량을 올려도 찢어지지 않도록 컴프레서를 거칩니다.
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0;
    comp.connect(master); master.connect(ctx.destination);
    // 공간감: 필터를 거친 피드백 딜레이(모든 곡 공용 센드)
    delay = ctx.createDelay(2); delay.delayTime.value = 0.36;
    delayFb = ctx.createGain(); delayFb.gain.value = 0.32;
    delayWet = ctx.createGain(); delayWet.gain.value = 0.28;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
    delay.connect(tone); tone.connect(delayFb); delayFb.connect(delay); tone.connect(delayWet); delayWet.connect(comp);
    // 하이햇·숨소리용 잡음
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  /* ---------------------------------------------------------------- 악기 */
  // 모든 악기: (dest, 시작 시각, MIDI 음, 길이(초), 세기 0~1)
  const amp = (dest, lvl = 1) => { const g = ctx.createGain(); g.gain.value = lvl; g.connect(dest); return g; };
  const osc = (type, freq, t0, t1, dest) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0); o.connect(dest); o.start(t0); o.stop(t1); return o; };
  const noise = (t0, t1, dest) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.connect(dest); s.start(t0); s.stop(t1); return s; };

  const I = {
    // 일렉트릭 피아노: FM 합성. 치는 순간 밝고 점점 둥글어집니다.
    epiano(dest, t0, m, dur, v = 0.8) {
      const f = mtof(m), end = t0 + dur + 1.4, g = amp(dest, 0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.2 * v, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.06 * v, t0 + 0.5); g.gain.exponentialRampToValueAtTime(0.0008, end);
      const car = osc('sine', f, t0, end, g);
      const modG = ctx.createGain(); modG.gain.setValueAtTime(f * 2.2 * v, t0); modG.gain.exponentialRampToValueAtTime(f * 0.15, t0 + 0.7);
      const mod = ctx.createOscillator(); mod.frequency.value = f; mod.connect(modG); modG.connect(car.frequency); mod.start(t0); mod.stop(end);
      const tine = amp(g, 0.12); osc('sine', f * 4, t0, t0 + 0.3, tine);
    },
    // 플루트: 부드러운 시작, 비브라토, 약한 숨소리
    flute(dest, t0, m, dur, v = 0.8) {
      const f = mtof(m), end = t0 + dur + 0.2, g = amp(dest, 0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.14 * v, t0 + 0.07);
      g.gain.setValueAtTime(0.12 * v, t0 + Math.max(0.08, dur - 0.05)); g.gain.linearRampToValueAtTime(0, end);
      const o = osc('sine', f, t0, end, g);
      const o2g = amp(g, 0.08); osc('triangle', f * 2, t0, end, o2g);
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2;
      lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * 0.007, t0 + Math.min(0.3, dur));
      lfo.connect(lg); lg.connect(o.frequency); lfo.start(t0); lfo.stop(end);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 6;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.03 * v, t0); ng.gain.exponentialRampToValueAtTime(0.004 * v, t0 + 0.15);
      bp.connect(ng); ng.connect(g); noise(t0, end, bp);
    },
    // 종(벨): 비정수 배음으로 맑고 긴 울림
    bell(dest, t0, m, dur, v = 0.8) {
      const f = mtof(m), end = t0 + 2.8, g = amp(dest, 0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.12 * v, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0006, end);
      osc('sine', f, t0, end, g);
      const p2 = amp(g, 0.4); osc('sine', f * 2.76, t0, t0 + 1.4, p2);
      const p3 = amp(g, 0.16); osc('sine', f * 5.4, t0, t0 + 0.6, p3);
    },
    // 마림바: 짧고 나무 같은 타격음
    marimba(dest, t0, m, dur, v = 0.8) {
      const f = mtof(m), end = t0 + 0.7, g = amp(dest, 0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.26 * v, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0006, end);
      osc('sine', f, t0, end, g);
      const hg = ctx.createGain(); hg.gain.setValueAtTime(0.35, t0); hg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08); hg.connect(g);
      osc('sine', f * 4, t0, t0 + 0.1, hg);
    },
    // 하프·플럭: 필터가 빠르게 닫히는 톱니파
    harp(dest, t0, m, dur, v = 0.8, bright = 1) {
      const f = mtof(m), end = t0 + 1.6, g = amp(dest, 0);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.11 * v, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0006, end);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(Math.min(9000, f * 8 * bright), t0); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.2), t0 + 0.35);
      lp.connect(g); osc('sawtooth', f, t0, end, lp);
    },
    // 현악 패드: 살짝 어긋난 톱니파 3개, 천천히 부풀고 사라짐
    strings(dest, t0, chord, dur, v = 0.8, cutoff = 1600, attack = 0.5) {
      const end = t0 + dur + 0.9, lp = ctx.createBiquadFilter(), g = amp(dest, 0);
      lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.4; lp.connect(g);
      const lvl = 0.13 * v / Math.sqrt(chord.length * 3);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(lvl, t0 + attack);
      g.gain.setValueAtTime(lvl, t0 + Math.max(attack, dur - 0.1)); g.gain.linearRampToValueAtTime(0, end);
      chord.forEach(n => [-9, 0, 8].forEach(det => { const o = osc('sawtooth', mtof(n), t0, end, lp); o.detune.value = det; }));
    },
    // 베이스: 삼각파 + 사인 서브
    bass(dest, t0, m, dur, v = 0.8) {
      const f = mtof(m), end = t0 + dur + 0.12, lp = ctx.createBiquadFilter(), g = amp(dest, 0);
      lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.32 * v, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.18 * v, t0 + Math.min(0.3, dur)); g.gain.linearRampToValueAtTime(0, end);
      osc('triangle', f, t0, end, lp); const sg = amp(g, 0.6); osc('sine', f, t0, end, sg);
    },
    kick(dest, t0, v = 0.8) {
      const g = amp(dest, 0); g.gain.setValueAtTime(0.55 * v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
      const o = osc('sine', 130, t0, t0 + 0.32, g); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.14);
    },
    hat(dest, t0, v = 0.8, len = 0.05) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
      const g = amp(dest, 0); g.gain.setValueAtTime(0.07 * v, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + len);
      hp.connect(g); noise(t0, t0 + len + 0.02, hp);
    },
    // 바람 소리 같은 잡음 스윕(루나틱 배경)
    wind(dest, t0, dur, v = 0.8) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(1100, t0 + dur / 2); bp.frequency.exponentialRampToValueAtTime(250, t0 + dur);
      const g = amp(dest, 0); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05 * v, t0 + dur / 2); g.gain.linearRampToValueAtTime(0, t0 + dur);
      bp.connect(g); noise(t0, t0 + dur + 0.05, bp);
    }
  };

  /* ---------------------------------------------------------------- 선율 도우미 */
  // 강박에는 화음 구성음, 약박에는 음계에서 직전 음과 가까운 음을 골라 자연스러운 선율을 만듭니다.
  function nextNote(p, scale, chord, strong) {
    let pool = scale;
    if (strong) {
      const pcs = chord.map(n => n % 12);
      const tones = scale.filter(n => pcs.includes(n % 12));
      if (tones.length) pool = tones;
    }
    const last = p.lastNote ?? scale[Math.floor(scale.length / 2)];
    const sorted = pool.slice().sort((a, b) => Math.abs(a - last) - Math.abs(b - last));
    const pick = sorted[Math.min(sorted.length - 1, Math.floor(Math.random() * Math.min(3, sorted.length)))];
    p.lastNote = pick;
    return pick;
  }

  /* ---------------------------------------------------------------- 곡 정의 */
  // 화음: [근음(베이스), 구성음...]
  const C = {
    Cmaj7: [36, 55, 64, 71], Am7: [33, 52, 60, 67], Fmaj7: [41, 57, 64, 69], G6: [43, 55, 62, 64],
    Dm9: [38, 57, 64, 65], G7: [43, 53, 59, 65], Em7: [40, 55, 62, 67], Am9: [45, 55, 59, 64],
    Dm7: [38, 53, 60, 65], Gsus: [43, 55, 60, 62], Bb: [46, 53, 58, 62], Csus: [36, 55, 60, 65]
  };
  const MAJ = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];

  const MOODS = {
    calm: {
      tempo: 78, send: 0.3, delayTime: 0.38,
      sections: [
        { prog: [C.Cmaj7, C.Am7, C.Fmaj7, C.G6], lead: 'epiano', arp: null },
        { prog: [C.Dm9, C.G7, C.Em7, C.Am9], lead: 'flute', arp: 'harp' },
        { prog: [C.Fmaj7, C.Em7, C.Dm7, C.Gsus], lead: 'bell', arp: 'marimba' },
        { prog: [C.Am7, C.Fmaj7, C.Csus, C.G6], lead: 'epiano', arp: 'harp' }
      ],
      step(p, s, t, sd) {
        const sec = this.sections[Math.floor(p.bar / 8) % this.sections.length];
        const ch = sec.prog[p.bar % 4], bus = p.bus;
        if (s === 0) I.strings(bus, t, ch.slice(1), sd * 16, 0.75, 1500, 0.6);
        if (s === 0 || s === 8) I.bass(bus, t, ch[0] + (s === 8 && chance(0.4) ? 7 : 0), sd * 6, 0.7);
        if (sec.arp === 'harp' && s % 2 === 0) I.harp(bus, t, ch[1 + (s / 2) % 3] + 12, sd * 2, 0.45 + (s % 8 === 0 ? 0.2 : 0));
        if (sec.arp === 'marimba' && s % 4 === 2 && chance(0.7)) I.marimba(bus, t, rnd(ch.slice(1)) + 12, sd, 0.5);
        if (sec.arp === null && s % 4 === 2 && chance(0.35)) I.epiano(bus, t, rnd(ch.slice(1)), sd * 2, 0.35);
        const strong = s % 4 === 0;
        if ((strong && chance(0.72)) || (s % 2 === 0 && !strong && chance(0.28))) {
          const n = nextNote(p, MAJ.map(x => x + 12), ch, strong);
          I[sec.lead](bus, t, n, sd * (strong ? rnd([3, 4, 6]) : 2), 0.75);
        }
        if (s === 14 && p.bar % 4 === 3 && chance(0.5)) I.bell(bus, t, rnd(ch.slice(1)) + 24, sd, 0.35);
      }
    },
    lunatic: {
      tempo: 56, send: 0.42, delayTime: 0.62,
      prog: [[38, 45, 50, 53], [38, 44, 50, 53], [37, 44, 49, 52], [34, 41, 46, 50]],
      scale: [62, 63, 65, 68, 69, 72, 74, 75],
      step(p, s, t, sd) {
        const ch = this.prog[p.bar % 4], bus = p.bus;
        if (s === 0) { I.strings(bus, t, ch.slice(1), sd * 16, 0.9, 620, 1.2); I.bass(bus, t, ch[0] - 12, sd * 15, 0.65); }
        if (s === 0) I.kick(bus, t, 0.45);
        if (s === 3) I.kick(bus, t, 0.28);
        if (s % 2 === 0 && chance(0.16)) I.bell(bus, t, rnd(this.scale) + rnd([0, 12]), sd, 0.42);
        if (s === 8 && p.bar % 4 === 2) I.flute(bus, t, rnd(this.scale) - 12, sd * 10, 0.5);
        if (s === 0 && p.bar % 8 === 5) I.wind(bus, t, sd * 16, 0.8);
        if (s === 12 && chance(0.2)) I.marimba(bus, t, ch[1] + 1, sd, 0.3); // 반음 어긋난 불안한 음
      }
    },
    danger: {
      tempo: 120, send: 0.18, delayTime: 0.25,
      prog: [[45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62], [40, 56, 59, 64]],
      scale: [69, 71, 72, 74, 76, 77, 80, 81],
      pluckBright: 1,
      step(p, s, t, sd) {
        const ch = this.prog[p.bar % 4], bus = p.bus;
        if (s === 0) I.strings(bus, t, ch.slice(1), sd * 16, 0.85, 2200, 0.15);
        if (s % 2 === 0) I.bass(bus, t, ch[0] + (s % 4 === 2 ? 12 : 0), sd * 1.6, 0.8);
        if (s % 8 === 0) I.kick(bus, t, 0.75);
        else if (s % 8 === 4) I.kick(bus, t, 0.4);
        if (s % 4 === 2) I.hat(bus, t, 0.8);
        if (s % 2 === 1) I.hat(bus, t, 0.35, 0.03);
        const arp = [1, 2, 3, 2];
        I.harp(bus, t, ch[arp[s % 4]] + 12, sd, s % 4 === 0 ? 0.5 : 0.32, this.pluckBright);
        if ((s === 0 || s === 3 || s === 6 || s === 10) && chance(0.8)) I.marimba(bus, t, nextNote(p, this.scale, ch, s === 0), sd, 0.55);
      }
    },
    lunaticDanger: null, // 아래에서 danger를 바탕으로 만듭니다.
    win: {
      tempo: 100, send: 0.34, delayTime: 0.3,
      prog: [[36, 60, 64, 67], [35, 59, 62, 67], [33, 57, 60, 64], [41, 57, 60, 65], [41, 57, 60, 65], [43, 59, 62, 67], [36, 60, 64, 67], [36, 60, 64, 67]],
      scale: [72, 74, 76, 77, 79, 81, 84, 86],
      intro(p, t) {
        // 퍼즐 완성 팡파르: 종 상승 아르페지오 + 현악 화음 + 하프 글리산도
        [72, 76, 79, 84, 88, 91].forEach((n, k) => I.bell(p.bus, t + k * 0.085, n, 0.3, 0.8));
        I.strings(p.bus, t, [60, 64, 67, 72], 1.6, 1, 2600, 0.12);
        I.bass(p.bus, t, 36, 1.4, 0.8);
        [60, 64, 67, 72, 76, 79, 84].forEach((n, k) => I.harp(p.bus, t + 0.5 + k * 0.05, n, 0.2, 0.5, 1.4));
        I.flute(p.bus, t + 0.9, 84, 0.7, 0.7);
        return 1.6;
      },
      step(p, s, t, sd) {
        const ch = this.prog[p.bar % this.prog.length], bus = p.bus;
        if (s === 0) I.strings(bus, t, ch.slice(1), sd * 16, 0.7, 2400, 0.3);
        if (s === 0 || s === 6 || s === 8) I.bass(bus, t, ch[0], sd * 2, 0.75);
        if (s % 2 === 0) I.harp(bus, t, ch[1 + (s / 2) % 3] + (s >= 8 ? 12 : 0), sd * 2, 0.4, 1.3);
        if (s % 4 === 2) I.hat(bus, t, 0.5);
        if (s % 2 === 0 && chance(s % 4 === 0 ? 0.75 : 0.4)) I.flute(bus, t, nextNote(p, this.scale, ch, s % 4 === 0), sd * 2, 0.7);
        if (s === 15 && chance(0.4)) I.bell(bus, t, rnd(ch.slice(1)) + 24, sd, 0.4);
      }
    },
    lose: {
      tempo: 58, send: 0.4, delayTime: 0.55,
      prog: [[45, 57, 60, 64], [41, 57, 60, 65], [38, 53, 57, 62], [40, 56, 59, 62]],
      scale: [69, 67, 65, 64, 62, 60, 59, 57],
      step(p, s, t, sd) {
        const ch = this.prog[p.bar % 4], bus = p.bus;
        if (s === 0) { I.strings(bus, t, ch.slice(1), sd * 16, 0.7, 900, 0.9); I.bass(bus, t, ch[0], sd * 14, 0.55); }
        if (s % 4 === 0 && chance(0.7)) {
          // 천천히 내려가는 선율
          p.loseIdx = ((p.loseIdx ?? -1) + 1) % this.scale.length;
          I.epiano(bus, t, this.scale[p.loseIdx], sd * 4, 0.55);
        }
        if (s === 10 && chance(0.3)) I.bell(bus, t, ch[1] + 12, sd, 0.3);
      }
    }
  };
  MOODS.lunaticDanger = Object.assign(Object.create(MOODS.danger), {
    tempo: 106, send: 0.3, delayTime: 0.42, pluckBright: 0.55,
    prog: [[38, 50, 53, 57], [39, 51, 55, 58], [37, 49, 52, 56], [38, 50, 53, 56]],
    scale: [62, 63, 65, 67, 68, 70, 73, 74]
  });

  /* ---------------------------------------------------------------- 상황 판단 */
  function currentMood() {
    const app = window.app;
    if (!app || app.currentView !== 'game' || !(app.cages && app.cages.length)) return 'calm';
    if (app.isWin) return 'win';
    const lunatic = app.difficulty === 'lunatic' && !app.isBattle;
    const limited = (!app.rules || app.rules.mistakeLimit !== false) && Number.isFinite(app.maxMistakes) && app.maxMistakes < 999999;
    if (limited) {
      const m = app.mistakes || 0;
      if (m >= app.maxMistakes) return 'lose';
      if (m > 0 && app.maxMistakes - m === 1) return lunatic ? 'lunaticDanger' : 'danger';
    }
    return lunatic ? 'lunatic' : 'calm';
  }

  function targetGain() {
    if (!enabled || document.hidden) return 0;
    const app = window.app;
    const quiet = app && app.currentView === 'game' && app.isPaused && !app.isWin;
    return volume * 1.15 * (quiet ? 0.35 : 1);
  }

  function applyGain(sec = 0.4) {
    if (!ctx) return;
    const now = ctx.currentTime, want = targetGain();
    if (Math.abs(master.gain.value - want) < 0.002) return;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(want, now + sec);
  }

  /* ---------------------------------------------------------------- 재생기 */
  // 상황이 바뀌면 새 재생기를 바로 만들고 이전 재생기는 0.5초에 걸쳐 사라집니다.
  function switchTo(name) {
    const now = ctx.currentTime;
    if (player) {
      const old = player.bus;
      old.gain.cancelScheduledValues(now);
      old.gain.setValueAtTime(old.gain.value, now);
      old.gain.linearRampToValueAtTime(0, now + 0.5);
      setTimeout(() => { try { old.disconnect(); } catch (_) {} }, 900);
    }
    const mood = MOODS[name];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, now); bus.gain.linearRampToValueAtTime(1, now + 0.35);
    bus.connect(comp);
    const send = ctx.createGain(); send.gain.value = mood.send; bus.connect(send); send.connect(delay);
    delay.delayTime.setTargetAtTime(mood.delayTime, now, 0.2);
    player = { name, mood, bus, step: 0, bar: 0, next: now + 0.03, lastNote: null };
    if (mood.intro) player.next += mood.intro(player, now + 0.03);
  }

  function tick() {
    if (!ctx || !enabled || document.hidden) return;
    const want = currentMood();
    if (!player || player.name !== want) switchTo(want);
    applyGain();
    const p = player, sd = 60 / p.mood.tempo / 4;
    // 앞으로 0.25초 안의 16분음표만 예약하므로 상황 변화가 바로 반영됩니다.
    while (p.next < ctx.currentTime + 0.25) {
      if (p.next < ctx.currentTime - 0.1) p.next = ctx.currentTime + 0.02; // 탭 전환 등으로 밀렸을 때
      try { p.mood.step.call(p.mood, p, p.step, p.next, sd); } catch (_) {}
      p.next += sd;
      p.step = (p.step + 1) % 16;
      if (p.step === 0) p.bar++;
    }
  }

  function start() {
    if (!enabled || !ensureCtx()) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (_) {} }
    if (timer) return;
    timer = setInterval(tick, 80);
    tick();
  }

  function stop(fade = 0.6) {
    clearInterval(timer); timer = 0;
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + fade);
    if (player) { const old = player.bus; player = null; setTimeout(() => { try { old.disconnect(); } catch (_) {} }, fade * 1000 + 200); }
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
    applyGain(0.15);
    syncUI();
  }

  const unlock = () => {
    if (enabled) start();
    ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, unlock, true));
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, unlock, true));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(0.25);
    else if (enabled) start();
  });

  /* ---------------------------------------------------------------- 설정 화면 */
  function buildUI() {
    const sound = document.getElementById('setting-sound');
    const item = sound && sound.closest('.settings-item');
    if (!item || document.getElementById('setting-bgm')) return;
    const row = document.createElement('div');
    row.className = 'settings-item'; row.id = 'setting-bgm-row';
    row.innerHTML = '<div class="settings-info"><span class="s-title" id="setting-bgm-title"></span></div>' +
      '<label class="toggle-switch"><input type="checkbox" id="setting-bgm"><span class="slider"></span></label>';
    const vrow = document.createElement('div');
    vrow.className = 'settings-item'; vrow.id = 'setting-bgm-volume-row';
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
  if (window.I18N && typeof window.I18N.setLanguage === 'function') {
    const base = window.I18N.setLanguage.bind(window.I18N);
    window.I18N.setLanguage = function () { const r = base.apply(this, arguments); try { syncUI(); } catch (_) {} return r; };
  }

  // 화면 전환·실수·승리·일시정지 직후 바로 반영
  if (typeof SumdokuApp !== 'undefined') {
    const P = SumdokuApp.prototype;
    ['switchView', 'togglePause', 'showGameResultModal', 'startNewGame', 'updateBoardDisplay', 'restoreOngoingGame'].forEach(name => {
      const b = P[name];
      if (typeof b !== 'function') return;
      P[name] = function () {
        const r = b.apply(this, arguments);
        if (timer) setTimeout(() => { try { tick(); } catch (_) {} }, 0);
        return r;
      };
    });
  }
  const watchMistakes = () => {
    const mc = document.getElementById('mistakes-count');
    if (mc) new MutationObserver(() => { if (timer) tick(); }).observe(mc, { childList: true, characterData: true, subtree: true });
  };

  const init = () => { buildUI(); watchMistakes(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.SumdokuBGM = {
    start, stop, setEnabled, setVolume,
    get state() { return { enabled, volume, mood: player && player.name, running: !!timer, ctx: ctx && ctx.state, gain: master && +master.gain.value.toFixed(3) }; }
  };
})();
