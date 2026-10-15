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
    grid.append(cell('rk-h', t('difficulty')), cell('rk-h', t('standard')), cell('rk-h', t('timeattack')));
    const curMode = this._rankMode || all.lastMode || 'standard';
    const curDiff = this._rankDiff || R.ladder(all, curMode).lastDiff || 'easy';
    R.DIFFS.forEach(d => {
      grid.append(cell('rk-diff', diffName(d)));
      R.MODES.forEach(m => {
        const s = R.ladder(all, m).byDiff[d], tier = R.tierOf(s.rating);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'rk-cell' + (m === curMode && d === curDiff ? ' on' : '') + (s.games ? '' : ' empty');
        b.style.setProperty('--tier', s.games ? tier.color : '#94a3b8');
        b.setAttribute('aria-label', `${diffName(d)} ${t(m)} ${s.games ? tier.name + ' ' + s.rating + ' RP' : t('unplayed')}`);
        b.append(cell('rk-tier', s.games ? tier.name : '—'), cell('rk-rp', s.games ? `${s.rating} RP` : t('unplayed')));
        b.onclick = () => { this._rankMode = m; this._rankDiff = d; this.renderRankingView(); };
        grid.append(b);
      });
    });
    this._rkBusy = true;
    try { this.renderRatingCard?.(); } finally { this._rkBusy = false; }
    renderLadder(R, R.ladder(all, curMode).byDiff[curDiff], curMode, curDiff);
    renderStreak(R, R.ladder(all, curMode).byDiff[curDiff]);
  };

  /* 랭크 단계 시각화: 위에서부터 그랜드마스터 → 브론즈. 단계가 있는 티어는 IV~I 네 칸으로 나누고,
     선택한 랭크가 있는 칸을 강조하고 정확한 위치에 '현재' 표시를 둡니다. */
  function renderLadder(R, s, mode, diff) {
    document.getElementById('ranking-ladder-title').textContent = t('ladder');
    document.getElementById('ranking-ladder-sub').textContent = `${t('ladderSub')} · ${diffName(diff)} ${t(mode)} · ${s.rating} RP`;
    const list = document.getElementById('ranking-ladder-list');
    list.innerHTML = '';
    const me = R.tierOf(s.rating);
    const tiers = R.TIERS.slice().reverse();
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    tiers.forEach((tier, k) => {
      const idx = R.TIERS.indexOf(tier), next = R.TIERS[idx + 1];
      const row = mk('div', 'rl-row' + (idx === me.index ? ' on' : '') + (idx < me.index ? ' passed' : ''));
      row.style.setProperty('--tier', tier.color);
      const name = R.tierOf(tier.min).name.replace(/\s+(IV|III|II|I)$/, '');
      const badge = mk('div', 'rl-badge', tier.id === 'grandmaster' ? 'GM' : name.slice(0, 1));
      const info = mk('div', 'rl-info');
      info.append(mk('div', 'rl-name', name), mk('div', 'rl-range', next ? `${tier.min} – ${next.min - 1} RP` : `${tier.min}+ RP`));
      const bar = mk('div', 'rl-bar');
      const divided = !!next && idx <= 4;
      const parts = divided ? 4 : 1, span = next ? (next.min - tier.min) / parts : 400;
      for (let d = 0; d < parts; d++) {
        const lo = tier.min + span * d, hi = lo + span;
        const seg = mk('div', 'rl-seg'); seg.append(mk('span', 'rl-lbl', divided ? ['IV', 'III', 'II', 'I'][d] : ''));
        if (s.rating >= hi || idx < me.index) seg.classList.add('full');
        if (idx === me.index && s.rating >= lo && (s.rating < hi || !next)) {
          seg.classList.add('cur');
          const pct = next ? Math.max(0, Math.min(100, (s.rating - lo) / span * 100)) : 100;
          const fill = mk('i', 'rl-fill'); fill.style.width = pct.toFixed(1) + '%'; seg.append(fill);
          const pin = mk('b', 'rl-pin', t('you')); pin.style.left = `calc(${pct.toFixed(1)}% - 1px)`; seg.append(pin);
        }
        bar.append(seg);
      }
      row.append(badge, info, bar);
      list.append(row);
    });
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
