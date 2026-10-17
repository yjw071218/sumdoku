/* v1.1.25 · 하단 '랭킹' 탭
 * - 모든 하단 내비게이션에서 '일일 도전'과 '나' 사이에 랭킹 탭을 넣습니다.
 * - 랭킹 화면: 일반·타임어택 × 5개 난이도 랭크 요약표 + 선택한 랭크의 상세 카드(rating.js)
 * - 상세 카드는 이 화면으로 옮겨지고, Play 배포판에서는 카드 안의 리더보드 버튼으로 순위를 볼 수 있습니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const T = {
    nav: ['랭킹', 'Ranking', 'ランキング', '排名', '排名', 'Ranking', 'Classement', 'Rangliste'],
    title: ['랭킹', 'Ranking', 'ランキング', '排名', '排名', 'Ranking', 'Classement', 'Rangliste'],
    summary: ['전체 랭크', 'All ranks', '全ランク', '全部段位', '全部段位', 'Todos los rangos', 'Tous les rangs', 'Alle Ränge'],
    battle: ['배틀', 'Battle', 'バトル', '对战', '對戰', 'Batalla', 'Duel', 'Kampf'],
    standard: ['일반', 'Standard', '通常', '普通', '一般', 'Normal', 'Normal', 'Normal'],
    timeattack: ['타임어택', 'Time Attack', 'タイムアタック', '限时挑战', '限時挑戰', 'Contrarreloj', 'Contre-la-montre', 'Zeitangriff'],
    difficulty: ['난이도', 'Difficulty', '難易度', '难度', '難度', 'Dificultad', 'Difficulté', 'Schwierigkeit'],
    hint: ['칸을 누르면 아래에 자세히 보여 줍니다.', 'Tap a cell to see details below.', 'マスをタップすると下に詳細を表示します。', '点击单元格可在下方查看详情。', '點擊儲存格可在下方查看詳情。', 'Toca una casilla para ver detalles abajo.', 'Touchez une case pour voir le détail ci-dessous.', 'Tippe auf ein Feld für Details unten.'],
    ladder: ['랭크 단계', 'Rank tiers', 'ランク段階', '段位等级', '段位等級', 'Niveles de rango', 'Paliers de rang', 'Rangstufen'],
    ladderSub: ['선택한 랭크의 위치', 'Position of the selected rank', '選択したランクの位置', '所选段位的位置', '所選段位的位置', 'Posición del rango elegido', 'Position du rang choisi', 'Position des gewählten Rangs'],
    you: ['현재', 'You', '現在', '当前', '目前', 'Tú', 'Vous', 'Du'],
    streak: ['연속 클리어 보너스', 'Win streak bonus', '連続クリアボーナス', '连续通关奖励', '連續通關獎勵', 'Bonus por racha', 'Bonus de série', 'Serienbonus'],
    streakN: ['{0}연속', '{0} in a row', '{0}連続', '连续{0}次', '連續{0}次', '{0} seguidas', "{0} d'affilée", '{0} in Folge'],
    streakNote: ['같은 모드·난이도에서 연속으로 클리어하면 얻는 RP가 늘어납니다. 실패하면 끊깁니다.', 'Consecutive clears in the same mode and difficulty earn extra RP. A loss resets the streak.', '同じモード・難易度で連続クリアすると獲得RPが増えます。失敗するとリセットされます。', '同一模式和难度连续通关可获得更多RP，失败则中断。', '同一模式和難度連續通關可獲得更多RP，失敗則中斷。', 'Ganar seguido en el mismo modo y dificultad da RP extra. Perder reinicia la racha.', 'Enchaîner les victoires dans le même mode et la même difficulté rapporte plus de RP. Une défaite remet la série à zéro.', 'Siege in Folge im selben Modus und Schwierigkeitsgrad bringen mehr RP. Eine Niederlage setzt die Serie zurück.'],
    board: ['순위', 'Leaderboard', '順位', '名次', '名次', 'Clasificación', 'Classement', 'Platzierung'],
    myRank: ['내 순위', 'My rank', '自分の順位', '我的名次', '我的名次', 'Mi puesto', 'Mon rang', 'Mein Platz'],
    noRank: ['아직 순위가 없습니다. 이 랭크로 한 판 플레이하면 등록됩니다.', 'No rank yet. Play a rated game in this rank to appear.', 'まだ順位がありません。このランクで1回プレイすると登録されます。', '还没有名次。用该段位玩一局即可上榜。', '還沒有名次。用該段位玩一局即可上榜。', 'Aún sin puesto. Juega una partida en este rango para aparecer.', 'Pas encore de rang. Jouez une partie dans ce rang pour apparaître.', 'Noch kein Platz. Spiele eine Partie in diesem Rang.'],
    signIn: ['Google Play 게임즈에 로그인하면 순위를 볼 수 있습니다.', 'Sign in to Google Play Games to see rankings.', 'Google Play ゲームにログインすると順位を見られます。', '登录 Google Play 游戏即可查看名次。', '登入 Google Play 遊戲即可查看名次。', 'Inicia sesión en Google Play Juegos para ver la clasificación.', 'Connectez-vous à Google Play Jeux pour voir le classement.', 'Melde dich bei Google Play Spiele an, um Platzierungen zu sehen.'],
    signInBtn: ['로그인하고 순위 보기', 'Sign in & view', 'ログインして見る', '登录并查看', '登入並查看', 'Iniciar sesión', 'Se connecter', 'Anmelden'],
    loading: ['순위를 불러오는 중…', 'Loading rankings…', '順位を読み込み中…', '正在加载名次…', '正在載入名次…', 'Cargando…', 'Chargement…', 'Wird geladen…'],
    notReady: ['이 랭크의 순위표는 준비 중입니다.', 'Rankings for this rank are coming soon.', 'このランクの順位表は準備中です。', '该段位排行榜即将推出。', '該段位排行榜即將推出。', 'Clasificación próximamente.', 'Classement bientôt disponible.', 'Rangliste folgt bald.'],
    failed: ['순위를 불러오지 못했습니다.', "Couldn't load rankings.", '順位を読み込めませんでした。', '无法加载名次。', '無法載入名次。', 'No se pudo cargar.', 'Chargement impossible.', 'Laden fehlgeschlagen.'],
    retry: ['다시 시도', 'Retry', '再試行', '重试', '重試', 'Reintentar', 'Réessayer', 'Erneut'],
    openAll: ['전체 순위 보기', 'Open full leaderboard', '全体順位を見る', '查看完整排行榜', '查看完整排行榜', 'Ver todo', 'Tout voir', 'Alle anzeigen'],
    unplayed: ['기록 없음', 'No games', '記録なし', '无记录', '無紀錄', 'Sin partidas', 'Aucune partie', 'Keine Spiele']
  };
  const L = () => Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const t = k => T[k][L()] || T[k][1];
  const diffName = d => (window.SumdokuDiffNames && SumdokuDiffNames[d] && SumdokuDiffNames[d][L()]) || d;

  // 기존 i18n 사전에도 넣어 data-i18n 갱신 시 같은 이름이 쓰이게 합니다.
  try { const D = window.I18N && I18N.dictionaries; if (D) LANGS.forEach((l, i) => { (D[l] ||= {}).nav_ranking = T.nav[i]; }); } catch (_) {}

  const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10v5a5 5 0 0 1-10 0z"></path>' +
    '<path d="M17 5h3v2a3 3 0 0 1-3 3"></path><path d="M7 5H4v2a3 3 0 0 0 3 3"></path></svg>';

  function addNavTabs() {
    document.querySelectorAll('.bottom-nav').forEach(nav => {
      if (nav.querySelector('[data-tab="ranking"]')) return;
      const me = nav.querySelector('[data-tab="stats"]');
      const b = document.createElement('button');
      b.className = 'nav-tab'; b.dataset.tab = 'ranking'; b.type = 'button';
      b.innerHTML = `<span class="tab-icon">${ICON}</span><span class="tab-label" data-i18n="nav_ranking"></span>`;
      b.querySelector('.tab-label').textContent = t('nav');
      b.addEventListener('click', () => { try { window.app.sound.play('click'); } catch (_) {} window.app.switchView('ranking'); });
      nav.insertBefore(b, me || null);
    });
  }

  function buildView() {
    if (document.getElementById('view-ranking')) return;
    const view = document.createElement('section');
    view.id = 'view-ranking'; view.className = 'view';
    view.innerHTML =
      '<div class="ranking-container">' +
      '  <header class="ranking-header"><h2 id="ranking-title"></h2></header>' +
      '  <main class="ranking-main">' +
      '    <section class="ranking-summary"><h3 class="section-title" id="ranking-summary-title"></h3>' +
      '      <div id="ranking-grid" class="ranking-grid" role="grid"></div>' +
      '      <p class="ranking-hint" id="ranking-hint"></p></section>' +
      '    <section id="ranking-board" class="ranking-board hidden"><h3 class="section-title" id="ranking-board-title"></h3><div id="ranking-board-body"></div></section>' +
      '    <div id="ranking-detail"></div>' +
      '    <section class="ranking-ladder"><h3 class="section-title" id="ranking-ladder-title"></h3>' +
      '      <p class="ranking-hint" id="ranking-ladder-sub"></p><div id="ranking-ladder-list" class="rl-list"></div></section>' +
      '    <section class="ranking-ladder"><h3 class="section-title" id="ranking-streak-title"></h3>' +
      '      <div id="ranking-streak-list" class="rs-list"></div><p class="ranking-hint" id="ranking-streak-note"></p></section>' +
      '  </main>' +
      '</div>';
    // 하단 탭은 다른 화면의 것을 복제해 같은 모양으로 둡니다.
    const srcNav = document.querySelector('#view-daily .bottom-nav') || document.querySelector('.bottom-nav');
    if (srcNav) view.append(srcNav.cloneNode(true));
    const daily = document.getElementById('view-daily');
    (daily && daily.parentElement || document.getElementById('app')).insertBefore(view, daily ? daily.nextSibling : null);
    // 복제된 탭에 이벤트 연결
    view.querySelectorAll('.bottom-nav .nav-tab').forEach(tab => tab.addEventListener('click', () => {
      try { window.app.sound.play('click'); } catch (_) {}
      window.app.switchView(tab.dataset.tab);
    }));
  }

  P.renderRankingView = function () {
    const R = window.SumdokuRating; if (!R) return;
    const all = R.loadAll();
    document.getElementById('ranking-title').textContent = t('title');
    document.getElementById('ranking-summary-title').textContent = t('summary');
    document.getElementById('ranking-hint').textContent = t('hint');
    const grid = document.getElementById('ranking-grid');
    grid.innerHTML = '';
    const cell = (cls, text) => { const e = document.createElement('div'); e.className = cls; if (text != null) e.textContent = text; return e; };
    grid.append(cell('rk-h', t('difficulty')), cell('rk-h', t('battle')), cell('rk-h', t('standard')), cell('rk-h', t('timeattack')));
    const curMode = this._rankMode || all.lastMode || 'battle';
    const curDiff = this._rankDiff || R.ladder(all, curMode).lastDiff || 'easy';
    R.DIFFS.forEach(d => {
      grid.append(cell('rk-diff', diffName(d)));
      R.MODES.forEach(m => {
        const s = R.ladder(all, m).byDiff[d], tier = R.shownTier(s), unr = tier.id === 'unranked';
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'rk-cell' + (m === curMode && d === curDiff ? ' on' : '') + (s.games ? '' : ' empty');
        b.style.setProperty('--tier', !unr && s.games ? tier.color : '#94a3b8');
        b.setAttribute('aria-label', `${diffName(d)} ${t(m)} ${unr ? tier.name : s.games ? tier.name + ' ' + s.rating + ' RP' : t('unplayed')}`);
        const sym = cell('rk-sym'); sym.innerHTML = unr || s.games ? R.tierSymbol(tier.id, 26, tier.division) : '';
        const txt = cell('rk-txt'); txt.append(cell('rk-tier', unr || s.games ? tier.name : '—'), cell('rk-rp', unr ? `${tier.placementDone} / ${R.PLACEMENT}` : s.games ? `${s.rating} RP` : t('unplayed')));
        b.append(sym, txt);
        b.onclick = () => { this._rankMode = m; this._rankDiff = d; this.renderRankingView(); };
        grid.append(b);
      });
    });
    this._rkBusy = true;
    try { this.renderRatingCard?.(); } finally { this._rkBusy = false; }
    renderLadder(R, R.ladder(all, curMode).byDiff[curDiff], curMode, curDiff);
    renderBoard(curMode, curDiff, R.ladder(all, curMode).byDiff[curDiff]);
    renderStreak(R, R.ladder(all, curMode).byDiff[curDiff]);
  };

  /* 랭크 단계 시각화: 위에서부터 그랜드마스터 → 브론즈. 단계가 있는 티어는 V~I 다섯 칸으로 나누고,
     선택한 랭크가 있는 칸을 강조하고 정확한 위치에 '현재' 표시를 둡니다. */
  function renderLadder(R, s, mode, diff) {
    document.getElementById('ranking-ladder-title').textContent = t('ladder');
    document.getElementById('ranking-ladder-sub').textContent = `${t('ladderSub')} · ${diffName(diff)} ${t(mode)} · ${s.rating} RP`;
    const list = document.getElementById('ranking-ladder-list');
    list.innerHTML = '';
    const me = R.shownTier(s);
    const tiers = R.TIERS.slice().reverse();
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    tiers.forEach((tier, k) => {
      const idx = R.TIERS.indexOf(tier), next = R.TIERS[idx + 1];
      const row = mk('div', 'rl-row' + (idx === me.index ? ' on' : '') + (idx < me.index ? ' passed' : ''));
      row.style.setProperty('--tier', tier.color);
      const name = R.tierOf(tier.min).name.replace(/\s+(V|IV|III|II|I)$/, '');
      const badge = mk('div', 'rl-badge rl-symbol'); badge.innerHTML = R.tierSymbol(tier.id, 38);
      const info = mk('div', 'rl-info');
      info.append(mk('div', 'rl-name', name), mk('div', 'rl-range', next ? `${tier.min} – ${next.min - 1} RP` : `${tier.min}+ RP`));
      const bar = mk('div', 'rl-bar');
      const divided = !!next && idx <= 4;
      const parts = divided ? 5 : 1;
      for (let d = 0; d < parts; d++) {
        // 단계마다 100 RP: 가장 아래 칸(V)은 1000 RP(1000 미만은 0)부터 시작
        const hi = divided ? next.min - (parts - 1 - d) * 100 : (next ? next.min : tier.min + 500);
        const lo = divided ? (d === 0 ? tier.min : hi - 100) : tier.min;
        const pLo = divided && d === 0 && s.rating >= hi - 100 ? hi - 100 : lo, span = hi - pLo;
        const seg = mk('div', 'rl-seg'); seg.append(mk('span', 'rl-lbl', divided ? ['V', 'IV', 'III', 'II', 'I'][d] : ''));
        if (s.rating >= hi || idx < me.index) seg.classList.add('full');
        if (idx === me.index && s.rating >= lo && (s.rating < hi || !next)) {
          seg.classList.add('cur');
          const pct = next ? Math.max(0, Math.min(100, (s.rating - pLo) / span * 100)) : 100;
          const fill = mk('i', 'rl-fill'); fill.style.width = pct.toFixed(1) + '%'; seg.append(fill);
          const pin = mk('b', 'rl-pin', t('you')); pin.style.left = `calc(${pct.toFixed(1)}% - 1px)`; seg.append(pin);
        }
        bar.append(seg);
      }
      row.append(badge, info, bar);
      list.append(row);
    });
  }

  /* ---------- Google Play 게임즈 순위 (Play 배포판에서만) ----------
     네이티브(Leaderboards.load)가 window.onLeaderboardRanks 로 결과를 돌려줍니다. 1분 동안 캐시합니다. */
  const bridge = () => window.AndroidBridge;
  const isPlay = () => { try { return bridge()?.getDistribution?.() === 'play' && typeof bridge().loadLeaderboardRanks === 'function'; } catch (_) { return false; } };
  const rankCache = {}; // key → { at, data }
  let pendingKey = null;
  const boardKey = (mode, diff) => (mode === 'timeattack' ? 'ta_rating_' : 'rating_') + diff;

  function renderBoard(mode, diff, s, force = false) {
    const sec = document.getElementById('ranking-board');
    if (!sec) return;
    if (!isPlay()) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    document.getElementById('ranking-board-title').textContent = `${t('board')} · ${diffName(diff)} ${t(mode)}`;
    const key = boardKey(mode, diff);
    let configured = false; try { configured = !!bridge().isLeaderboardConfigured(key); } catch (_) {}
    if (!configured) return paintBoard(key, { status: 'unconfigured' });
    const c = rankCache[key];
    if (c && !force && Date.now() - c.at < 60000) return paintBoard(key, c.data);
    paintBoard(key, { status: 'loading' });
    requestRanks(key, false);
  }
  function requestRanks(key, interactive) {
    pendingKey = key;
    try { bridge().loadLeaderboardRanks(key, 10, !!interactive); } catch (_) { paintBoard(key, { status: 'error' }); }
  }
  window.onLeaderboardRanks = data => {
    if (!data || !data.key) return;
    if (data.status === 'ok' || data.status === 'signin_required' || data.status === 'unconfigured') rankCache[data.key] = { at: Date.now(), data };
    if (data.key === pendingKey) paintBoard(data.key, data);
  };

  function paintBoard(key, data) {
    const body = document.getElementById('ranking-board-body');
    if (!body) return;
    body.innerHTML = '';
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const note = (text, btnLabel, onClick) => {
      const p = mk('p', 'rb-note', text); body.append(p);
      if (btnLabel) { const b = mk('button', 'btn btn-secondary rb-btn', btnLabel); b.type = 'button'; b.onclick = onClick; body.append(b); }
    };
    switch (data.status) {
      case 'loading': return note(t('loading'));
      case 'unconfigured': return note(t('notReady'));
      case 'signin_required':
      case 'signin_failed': return note(t('signIn'), t('signInBtn'), () => { paintBoard(key, { status: 'loading' }); requestRanks(key, true); });
      case 'error': return note(t('failed'), t('retry'), () => { paintBoard(key, { status: 'loading' }); requestRanks(key, false); });
    }
    // 내 순위
    const me = data.me;
    const mine = mk('div', 'rb-me');
    mine.append(mk('span', 'rb-me-label', t('myRank')));
    mine.append(mk('b', 'rb-me-rank', me && me.rank > 0 ? (me.displayRank || ('#' + me.rank)) : '—'));
    if (me && me.score != null) mine.append(mk('span', 'rb-me-score', `${me.score} RP`));
    body.append(mine);
    if (!me || !(me.rank > 0)) body.append(mk('p', 'rb-note', t('noRank')));
    // 상위 10명
    const top = Array.isArray(data.top) ? data.top : [];
    if (top.length) {
      const ol = mk('ol', 'rb-list');
      const R = window.SumdokuRating;
      top.forEach(row => {
        const li = mk('li', 'rb-row' + (me && row.playerId && row.playerId === me.playerId ? ' me' : ''));
        const tier = R ? R.tierOf(Number(row.score) || 0) : null;
        li.append(mk('span', 'rb-rank', row.displayRank || String(row.rank)));
        const sym = mk('span', 'rb-sym'); if (tier) sym.innerHTML = R.tierSymbol(tier.id, 22); li.append(sym);
        li.append(mk('span', 'rb-name', row.name || '—'));
        li.append(mk('span', 'rb-score', `${row.score}`));
        ol.append(li);
      });
      body.append(ol);
    }
    const all = mk('button', 'btn btn-secondary rb-btn', t('openAll')); all.type = 'button';
    all.onclick = () => { try { bridge().showLeaderboard(key); } catch (_) {} };
    body.append(all);
  }

  function renderStreak(R, s) {
    document.getElementById('ranking-streak-title').textContent = t('streak');
    document.getElementById('ranking-streak-note').textContent = t('streakNote');
    const list = document.getElementById('ranking-streak-list');
    list.innerHTML = '';
    const cur = s.streak || 0;
    [2, 3, 4, 5, 6].forEach(n => {
      const c = document.createElement('div');
      c.className = 'rs-chip' + (cur >= n && (n === 6 || cur < n + 1) ? ' on' : '') + (cur >= n ? ' reached' : '');
      const a = document.createElement('span'); a.textContent = t('streakN').replace('{0}', n === 6 ? '6+' : n);
      const b = document.createElement('b'); b.textContent = `+${Math.round(R.streakBonus(n) * 100)}%`;
      c.append(a, b); list.append(c);
    });
  }

  const sw = P.switchView;
  P.switchView = function (name, ...rest) {
    const r = sw.call(this, name, ...rest);
    if (name === 'ranking') { try { this.renderRankingView(); } catch (e) { console.warn('ranking', e); } }
    return r;
  };
  // 게임이 끝나 레이팅이 바뀌면 요약표도 갱신
  const rc = P.renderRatingCard;
  if (rc) P.renderRatingCard = function (...a) {
    const r = rc.apply(this, a);
    if (this.currentView === 'ranking' && !this._rkBusy) { this._rkBusy = true; try { this.renderRankingView(); } finally { this._rkBusy = false; } }
    return r;
  };

  function relabel() {
    document.querySelectorAll('.nav-tab[data-tab="ranking"] .tab-label').forEach(e => { e.textContent = t('nav'); });
    if (window.app && window.app.currentView === 'ranking') window.app.renderRankingView();
  }
  new MutationObserver(relabel).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  const init = () => { buildView(); addNavTabs(); relabel(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
