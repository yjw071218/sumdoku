/* v1.1.19 · 싱글 기록 기반 레이팅(RP)과 티어, Google Play 게임즈 리더보드
 *
 * 레이팅 변화(일반·일일 도전 게임만, 1:1 배틀·타임어택·스피드 레이스는 제외)
 *   클리어: 난이도 기본점 × 속도 보정 × 실수 보정 × 힌트 보정 × 난이도 상한 보정
 *     - 기본점  초급 8 · 중급 14 · 고급 22 · 전문가 32 · 루나틱 45
 *     - 속도    기준 시간(10·12·15·20·25분)보다 빠를수록 최대 ×1.3, 느리면 최소 ×0.5
 *     - 실수    1회마다 −15% (최소 ×0.4), 힌트 1회마다 −20% (최소 ×0.3)
 *     - 상한    난이도마다 기대 레이팅이 있어서(초급 1200 … 루나틱 3200) 그보다 높으면 얻는 점수가 줄어듭니다.
 *               쉬운 난이도만 반복해서는 높은 티어에 갈 수 없습니다.
 *   실패: 목숨 소진·시간 초과 시 기본점의 60%를 잃습니다(레이팅이 기대치보다 높을수록 더 많이).
 *         기권·중도 이탈은 레이팅에 반영하지 않습니다.
 *
 * 비활동 감소: 마지막 레이팅 게임 뒤 7일이 지나면 하루마다 레이팅의 1.5%(최소 5)를 잃습니다.
 *   다이아몬드 이상은 하루 2.5%. 감소는 1200(골드 IV) 아래로는 내려가지 않습니다.
 *
 * 티어: 브론즈 0 · 실버 800 · 골드 1200 · 플래티넘 1600 · 다이아몬드 2000 · 마스터 2400 · 그랜드마스터 2800
 *   브론즈~다이아몬드는 IV→I 네 단계, 마스터·그랜드마스터는 단계 없음.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const KEY = 'sumdoku_rating';
  const DAY = 86400000, GRACE_DAYS = 7, DECAY_FLOOR = 1200;
  const BASE = { easy: 8, medium: 14, hard: 22, expert: 32, lunatic: 45 };
  const PAR = { easy: 600, medium: 720, hard: 900, expert: 1200, lunatic: 1500 };
  const CAP = { easy: 1200, medium: 1700, hard: 2200, expert: 2700, lunatic: 3200 };
  const TIERS = [
    { id: 'bronze', ko: '브론즈', min: 0, color: '#b45309' },
    { id: 'silver', ko: '실버', min: 800, color: '#64748b' },
    { id: 'gold', ko: '골드', min: 1200, color: '#ca8a04' },
    { id: 'platinum', ko: '플래티넘', min: 1600, color: '#0d9488' },
    { id: 'diamond', ko: '다이아몬드', min: 2000, color: '#2563eb' },
    { id: 'master', ko: '마스터', min: 2400, color: '#9333ea' },
    { id: 'grandmaster', ko: '그랜드마스터', min: 2800, color: '#dc2626' }
  ];
  const ROMAN = ['IV', 'III', 'II', 'I'];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const tr = s => (window.I18N && typeof I18N.text === 'function' ? I18N.text(s) : s);
  const bridge = () => window.AndroidBridge;

  const load = () => {
    let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
    if (!s || typeof s !== 'object' || !Number.isFinite(s.rating)) s = { rating: 1000, peak: 1000, games: 0, lastActive: 0, lastDecay: 0, history: [] };
    if (!Array.isArray(s.history)) s.history = [];
    return s;
  };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} };

  function tierOf(rating) {
    let k = 0; for (let i = 0; i < TIERS.length; i++) if (rating >= TIERS[i].min) k = i;
    const t = TIERS[k], next = TIERS[k + 1];
    let division = '', divMin = t.min, divMax = next ? next.min : null;
    if (k <= 4) {
      const span = (next.min - t.min) / 4, d = clamp(Math.floor((rating - t.min) / span), 0, 3);
      division = ROMAN[d]; divMin = t.min + span * d; divMax = divMin + span;
    }
    return { ...t, index: k, division, name: tr(t.ko) + (division ? ' ' + division : ''), divMin, divMax, next };
  }

  /* 비활동 감소: 경과한 날마다 적용하고, 이미 적용한 날은 다시 깎지 않습니다. */
  function applyDecay(s, now = Date.now()) {
    if (!s.lastActive || s.rating <= DECAY_FLOOR) return 0;
    const start = Math.max(s.lastActive + GRACE_DAYS * DAY, s.lastDecay || 0);
    const days = Math.floor((now - start) / DAY);
    if (days <= 0) return 0;
    let lost = 0;
    for (let d = 0; d < days && s.rating > DECAY_FLOOR; d++) {
      const rate = s.rating >= 2000 ? 0.025 : 0.015;
      const x = Math.min(Math.max(5, Math.round(s.rating * rate)), s.rating - DECAY_FLOOR);
      s.rating -= x; lost += x;
    }
    s.lastDecay = start + days * DAY;
    if (lost) s.history.unshift({ t: now, d: -lost, why: 'decay' });
    s.history = s.history.slice(0, 30);
    return lost;
  }

  function computeDelta(s, g) {
    const base = BASE[g.difficulty]; if (!base) return 0;
    const cap = CAP[g.difficulty];
    if (!g.win) {
      const over = clamp(1 + (s.rating - cap) / 800, 0.6, 1.8);
      return -Math.round(base * 0.6 * over);
    }
    const speed = clamp(1.5 - g.seconds / PAR[g.difficulty], 0.5, 1.3);
    const mist = Math.max(0.4, 1 - 0.15 * (g.mistakes || 0));
    const hint = Math.max(0.3, 1 - 0.2 * (g.hints || 0));
    const room = clamp((cap - s.rating) / 400 + 1, 0.05, 1.5);
    return Math.max(1, Math.round(base * speed * mist * hint * room));
  }

  /* ---------- 리더보드 ---------- */
  const lbReady = key => !!bridge()?.isLeaderboardConfigured?.(key);
  const submit = (key, score) => { try { if (lbReady(key)) bridge().submitLeaderboardScore(key, String(Math.round(score))); } catch (_) {} };
  window.onLeaderboardResult = status => {
    const msg = { unconfigured: '리더보드가 아직 설정되지 않았습니다.', signin_failed: 'Google Play 게임즈에 로그인하지 못했습니다.', error: '리더보드를 열지 못했습니다.' }[status];
    if (msg) window.app?.showToast(tr(msg), 3500);
  };

  /* ---------- 게임 종료 연결 ---------- */
  const RATED_MODES = ['standard', 'daily', undefined, null, ''];
  const record = p.recordGameEnd;
  p.recordGameEnd = function (isWin, ...rest) {
    const out = record.call(this, isWin, ...rest);
    try {
      if (this.isBattle || this.gameMode === 'battle' || !RATED_MODES.includes(this.gameMode) && !this.isDaily) return out;
      if (this.resultReason === 'forfeit' || !this._ratingToken || this._ratedGameId === this._ratingToken) return out;
      const win = !!(isWin && this.score >= 0 && this.board?.every((row, r) => row.every((c, k) => c.val === this.solution?.[r]?.[k])));
      const s = load(); applyDecay(s);
      const g = { difficulty: this.difficulty, win, seconds: this.timerSeconds || 0, mistakes: this.mistakes || 0, hints: this.hintsUsed || 0 };
      const before = s.rating, beforeTier = tierOf(before);
      const delta = computeDelta(s, g);
      if (!delta) return out;
      s.rating = Math.max(0, s.rating + delta); s.peak = Math.max(s.peak, s.rating);
      s.games++; s.lastActive = Date.now(); s.lastDecay = 0;
      s.history.unshift({ t: Date.now(), d: delta, diff: g.difficulty, win }); s.history = s.history.slice(0, 30);
      save(s); this._ratedGameId = this._ratingToken;
      this.lastRatingChange = { before, after: s.rating, delta, tier: tierOf(s.rating), beforeTier };
      // 리더보드: 레이팅, 난이도별 최단 시간(밀리초), 일일 도전 시간
      submit('rating', s.rating);
      if (win) { submit(this.difficulty, g.seconds * 1000); if (this.isDaily) submit('daily', g.seconds * 1000); }
      const after = tierOf(s.rating);
      const sign = delta > 0 ? '+' : '';
      let msg = `${sign}${delta} RP · ${after.name} (${s.rating})`;
      if (after.index > beforeTier.index) msg = `🎉 ${after.name} ${tr('승급!')} ${msg}`;
      else if (after.index < beforeTier.index) msg = `${after.name} ${tr('강등')} · ${msg}`;
      setTimeout(() => this.showToast?.(msg, 3500), 900);
      this.renderRatingCard?.();
    } catch (e) { console.warn('rating', e); }
    return out;
  };

  // 게임마다 한 번만 반영하도록 새 게임·이어하기 때 고유 번호를 붙입니다.
  for (const name of ["startNewGame", "restoreOngoingGame"]) {
    const fn = p[name]; if (typeof fn !== "function") continue;
    p[name] = function (...a) { this._ratingToken = Date.now() + Math.random(); return fn.apply(this, a); };
  }

  /* ---------- 통계 화면 카드 ---------- */
  p.renderRatingCard = function () {
    const host = document.getElementById('panel-stats'); if (!host) return;
    let card = document.getElementById('rating-card');
    if (!card) {
      card = document.createElement('section'); card.id = 'rating-card'; card.className = 'rating-card';
      const anchor = host.querySelector('[data-i18n="stats_diff_records_title"]');
      host.insertBefore(card, anchor || host.firstChild);
    }
    const s = load(); const lost = applyDecay(s); if (lost) save(s);
    const t = tierOf(s.rating);
    const pct = t.divMax ? clamp((s.rating - t.divMin) / (t.divMax - t.divMin) * 100, 0, 100) : 100;
    const idle = s.lastActive ? Math.floor((Date.now() - s.lastActive) / DAY) : 0;
    const decayIn = GRACE_DAYS - idle;
    card.style.setProperty('--tier', t.color);
    card.innerHTML = '';
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const head = el('div', 'rc-top');
    const badge = el('div', 'rc-badge tier-' + t.id, t.ko[0] === '그' ? 'GM' : tr(t.ko).slice(0, 1));
    const info = el('div', 'rc-info');
    info.append(el('div', 'rc-tier', t.name), el('div', 'rc-rp', `${s.rating} RP · ${tr('최고')} ${s.peak}`));
    head.append(badge, info); card.append(el('h3', 'section-title', tr('랭크')), head);
    const bar = el('div', 'rc-bar'); const fill = el('div', 'rc-fill'); fill.style.width = pct.toFixed(1) + '%'; bar.append(fill); card.append(bar);
    card.append(el('div', 'rc-next', t.divMax ? `${tr('다음 단계까지')} ${Math.ceil(t.divMax - s.rating)} RP` : tr('최고 티어입니다')));
    if (!s.games) card.append(el('div', 'rc-note', tr('일반 게임이나 일일 도전을 클리어하면 레이팅이 쌓입니다.')));
    else if (s.rating > DECAY_FLOOR) card.append(el('div', 'rc-note' + (decayIn <= 2 ? ' warn' : ''),
      decayIn > 0 ? `${tr('비활동 감소까지')} ${decayIn}${({ ko: '일', ja: '日', zh: '天', 'zh-TW': '天' })[window.I18N?.currentLang || 'ko'] ?? ' d'}` : tr('비활동으로 레이팅이 매일 감소하고 있습니다')));
    if (lost) card.append(el('div', 'rc-note warn', `${tr('비활동 감소')} −${lost} RP`));
    const recent = s.history.slice(0, 5);
    if (recent.length) {
      const ul = el('div', 'rc-history');
      recent.forEach(h => ul.append(el('span', 'rc-chip ' + (h.d >= 0 ? 'up' : 'down'), `${h.d >= 0 ? '+' : ''}${h.d}`)));
      card.append(ul);
    }
    if (bridge()?.getDistribution?.() === 'play') {
      const row = el('div', 'rc-actions');
      [['랭킹 보기', 'rating'], ['전체 리더보드', '']].forEach(([label, key]) => {
        const b = el('button', 'btn btn-secondary', tr(label)); b.type = 'button';
        b.onclick = () => { try { bridge().showLeaderboard(key); } catch (_) { window.onLeaderboardResult('error'); } };
        row.append(b);
      });
      card.append(row);
    }
  };
  const renderStats = p.renderStatsView;
  if (renderStats) p.renderStatsView = function (...a) { const r = renderStats.apply(this, a); this.renderRatingCard(); return r; };

  // 언어가 바뀌면 다시 그립니다.
  new MutationObserver(() => window.app?.renderRatingCard?.()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.SumdokuRating = { load, save, tierOf, applyDecay, computeDelta, TIERS, KEY };
})();
