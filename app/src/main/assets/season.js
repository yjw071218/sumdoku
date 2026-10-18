/* v1.1.28 · 시즌 화면(랭킹 탭) · 명예의 전당 · 티어 보상 꾸미기
 *
 * 랭킹 탭 맨 위: 시즌 번호, 남은 기간, 이번 시즌 규칙(배치 5판·승급전·강등 보호·초반 가속)
 * 지난 시즌 보상 안내: 시즌이 바뀐 뒤 처음 열면 지난 시즌 최고 티어와 해금된 보상을 보여 줍니다.
 * 명예의 전당: 시즌별 최고 티어 엠블럼(프리시즌 포함).
 * 티어 보상: 지금까지 도달한 최고 티어로 영구 해금. 켜고 끌 수 있습니다.
 *   골드      금빛 보드 테두리
 *   플래티넘  청록 보드 테두리
 *   다이아몬드 입력 숫자 보석 색
 *   마스터    보라 빛 테두리
 *   그랜드마스터 그랜드마스터 테마(붉은·금색 보드) + 홈 화면 엠블럼
 */
(() => {
  const R = window.SumdokuRating;
  if (!R || typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const L = () => Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const T = {
    season: ['시즌', 'Season', 'シーズン', '赛季', '賽季', 'Temporada', 'Saison', 'Saison'],
    left: ['{0}일 남음', '{0} days left', '残り{0}日', '剩余{0}天', '剩餘{0}天', 'Quedan {0} días', '{0} jours restants', 'Noch {0} Tage'],
    rules: ['배치 5판(언랭크) · 승급 후 3판 강등 보호 · 배치 후 5판 RP +25%',
      '5 placement games (unranked) · 3-game shield after promotion · +25% RP for 5 games after placement',
      '配置5試合（アンランク）・昇格後3試合は降格保護・配置後5試合RP+25%',
      '定级赛5局（未定级）· 晋级后3局降级保护 · 定级后5局RP+25%',
      '定級賽5局（未定級）· 晉級後3局降級保護 · 定級後5局RP+25%',
      '5 clasificatorias (sin rango) · 3 partidas protegidas tras subir · +25% RP 5 partidas',
      '5 parties de placement (non classé) · 3 parties protégées après promotion · +25% RP sur 5 parties',
      '5 Platzierungsspiele (unplatziert) · 3 Spiele Schutz nach Aufstieg · +25% RP für 5 Spiele'],
    reset: ['시즌이 끝나면 RP가 1000 쪽으로 절반 압축되고 다시 배치 경기를 치릅니다.', 'At season end, RP is pulled halfway toward 1000 and placements restart.', 'シーズン終了時、RPは1000に向けて半分に圧縮され、再び配置試合を行います。', '赛季结束时RP向1000压缩一半，并重新进行定级赛。', '賽季結束時RP向1000壓縮一半，並重新進行定級賽。', 'Al final de temporada el RP se acerca a 1000 a la mitad y se repiten las clasificatorias.', 'En fin de saison, le RP est rapproché de moitié vers 1000 et les placements recommencent.', 'Am Saisonende wird RP zur Hälfte Richtung 1000 gezogen, dann neue Platzierungsspiele.'],
    rewardTitle: ['지난 시즌 보상', 'Last season reward', '前シーズン報酬', '上赛季奖励', '上賽季獎勵', 'Recompensa anterior', 'Récompense de saison', 'Saisonbelohnung'],
    rewardText: ['시즌 {0} 최종 티어: {1}. 이번 시즌 동안 아래 티어 보상을 쓸 수 있습니다.', 'Season {0} final tier: {1}. The tier rewards below are yours for this season.', 'シーズン{0}最終ティア：{1}。今シーズンは下のティア報酬を使えます。', '赛季{0}最终段位：{1}。本赛季可使用下方段位奖励。', '賽季{0}最終段位：{1}。本賽季可使用下方段位獎勵。', 'Rango final de la temporada {0}: {1}. Puedes usar estas recompensas esta temporada.', 'Rang final saison {0} : {1}. Ces récompenses sont à vous cette saison.', 'Finaler Rang Saison {0}: {1}. Diese Belohnungen gelten diese Saison.'],
    ok: ['확인', 'OK', 'OK', '确定', '確定', 'OK', 'OK', 'OK'],
    hof: ['명예의 전당', 'Hall of fame', '殿堂', '名人堂', '名人堂', 'Salón de la fama', 'Panthéon', 'Ruhmeshalle'],
    hofEmpty: ['시즌이 끝나면 그 시즌 최고 티어가 여기에 영구히 남습니다.', 'Each season\'s best tier is kept here forever when the season ends.', 'シーズン終了時、その最高ティアがここに永久に残ります。', '赛季结束后，该赛季最高段位会永久保存在这里。', '賽季結束後，該賽季最高段位會永久保存在這裡。', 'Al terminar cada temporada su mejor rango queda aquí para siempre.', 'À la fin de chaque saison, son meilleur rang reste ici.', 'Am Saisonende bleibt der beste Rang hier dauerhaft.'],
    startsIn: ['시즌 1 시작까지 {0}일', 'Season 1 starts in {0} days', 'シーズン1開始まで{0}日', '距赛季1开始还有{0}天', '距賽季1開始還有{0}天', 'La temporada 1 empieza en {0} días', 'Saison 1 dans {0} jours', 'Saison 1 beginnt in {0} Tagen'],
    pre: ['프리시즌', 'Preseason', 'プレシーズン', '季前赛', '季前賽', 'Pretemporada', 'Présaison', 'Vorsaison'],
    rewards: ['티어 보상', 'Tier rewards', 'ティア報酬', '段位奖励', '段位獎勵', 'Recompensas', 'Récompenses', 'Belohnungen'],
    rewardsNote: ['지난 시즌 배틀 최종 티어에 따라 이번 시즌 동안 쓸 수 있는 보상입니다. 시즌이 바뀌면 초기화됩니다.', 'Rewards for this season, based on your final ranked battle tier last season. They reset every season.', '前シーズンのバトル最終ティアに応じて今シーズン使える報酬です。シーズンごとにリセットされます。', '根据上赛季对战最终段位，本赛季可使用的奖励。每赛季重置。', '依上賽季對戰最終段位，本賽季可使用的獎勵。每賽季重設。', 'Recompensas de esta temporada según tu rango final de batalla anterior. Se reinician cada temporada.', 'Récompenses de la saison selon votre rang final en duel la saison passée. Réinitialisées à chaque saison.', 'Belohnungen dieser Saison nach deinem finalen Kampfrang der Vorsaison. Werden jede Saison zurückgesetzt.'],
    r_gold: ['금빛 보드 테두리', 'Gold board frame', '金の盤面枠', '金色棋盘边框', '金色棋盤邊框', 'Marco dorado', 'Cadre doré', 'Goldrahmen'],
    r_platinum: ['청록 보드 테두리', 'Platinum board frame', 'プラチナ盤面枠', '铂金棋盘边框', '白金棋盤邊框', 'Marco platino', 'Cadre platine', 'Platinrahmen'],
    r_diamond: ['보석 색 입력 숫자 · 다이아 승리 배너', 'Gem digits · Diamond victory banner', '宝石色の数字・ダイヤ勝利バナー', '宝石色数字 · 钻石胜利横幅', '寶石色數字 · 鑽石勝利橫幅', 'Dígitos joya · banner diamante', 'Chiffres gemme · bannière diamant', 'Edelstein-Ziffern · Diamant-Banner'],
    r_master: ['보라 빛 테두리 · 마스터 승리 배너', 'Master glow frame · Master victory banner', 'マスター枠・マスター勝利バナー', '大师边框 · 大师胜利横幅', '大師邊框 · 大師勝利橫幅', 'Marco maestro · banner maestro', 'Cadre maître · bannière maître', 'Meister-Rahmen · Meister-Banner'],
    r_silver: ['은빛 보드 테두리', 'Silver board frame', '銀の盤面枠', '银色棋盘边框', '銀色棋盤邊框', 'Marco plateado', 'Cadre argenté', 'Silberrahmen'],
    r_grandmaster: ['그랜드마스터 테마 · 전용 승리 배너', 'Grandmaster theme · victory banner', 'グランドマスターテーマ・エンブレム・勝利バナー', '宗师主题 · 徽章 · 专属胜利横幅', '宗師主題 · 徽章 · 專屬勝利橫幅', 'Tema gran maestro · emblema · banner', 'Thème grand maître · emblème · bannière', 'Großmeister-Thema · Emblem · Banner'],
    locked: ['잠김', 'Locked', 'ロック', '未解锁', '未解鎖', 'Bloqueado', 'Verrouillé', 'Gesperrt']
  };
  const t = k => T[k][L()] || T[k][1];
  const tr = s => (window.I18N && typeof I18N.text === 'function' ? I18N.text(s) : s);
  const diffName = d => (window.SumdokuDiffNames && SumdokuDiffNames[d] && SumdokuDiffNames[d][L()]) || d;
  const modeName = m => m === 'timeattack' ? ['타임어택', 'Time Attack', 'タイムアタック', '限时挑战', '限時挑戰', 'Contrarreloj', 'Contre-la-montre', 'Zeitangriff'][L()] : (m === 'battle' ? ['배틀', 'Battle', 'バトル', '对战', '對戰', 'Batalla', 'Duel', 'Kampf'][L()] : '');
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const tierById = id => R.TIERS.find(x => x.id === id);

  /* ---------- 꾸미기 ---------- */
  // v2.1.6: 실버 보상 추가. 상세 구성·컬렉션 화면은 tier-rewards.js가 담당합니다.
  const REWARDS = ['silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster']; // 티어 id = 보상 id
  const CKEY = 'sumdoku_rank_cosmetics';
  const loadC = () => { try { return JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (_) { return {}; } };
  const saveC = c => { try { localStorage.setItem(CKEY, JSON.stringify(c)); } catch (_) {} };
  // v2.1.9: 보상 = 직전 시즌 배틀 최종 티어(매 시즌 초기화). 개발자 모드는 rewardTierIndex 를 덮어씁니다.
  const unlockedIdx = () => (R.rewardTierIndex ? R.rewardTierIndex(R.loadAll()) : R.bestTierIndex(R.loadAll()));

  // 다이아몬드(4) · 마스터(5) · 그랜드마스터(6) 중 해금 및 활성화된 가장 높은 승리 배너 스킨 티어 반환
  function getVictoryBannerSkinTier(app) {
    const all = R.loadAll();
    let k = unlockedIdx();
    void all;
    // 현재 난이도·모드의 최고 기록(peak)이나 현재 레이팅으로 다이아 이상 달성한 경우도 함께 인정
    const diff = (app && (app.isBattle || app.gameMode === 'battle') ? app.battleDiff : app?.difficulty) || app?.difficulty;
    if (false && app && R.DIFFS.includes(diff)) {
      const m = (app.isBattle || app.gameMode === 'battle') ? 'battle' : (app.gameMode === 'timeattack' && !app.isDaily ? 'timeattack' : 'standard');
      const s = R.ladder(all, m).byDiff[diff];
      if (s && !(s.placement > 0) && s.games > 0) {
        k = Math.max(k, R.tierOf(Math.max(s.peak || 0, s.rating || 0)).index);
      }
    }
    const c = loadC();
    for (const id of ['grandmaster', 'master', 'diamond']) {
      const idx = R.TIERS.findIndex(x => x.id === id);
      if (k >= idx && c[id] !== false) return R.TIERS[idx];
    }
    return null;
  }

  // 결과 모달(#result-banner 또는 #battle-result-banner)에 다이아몬드·마스터·그랜드마스터 전용 금속 프레임 승리 배너 스킨 적용
  function applyVictoryBannerSkin(app, data, targetEl) {
    const banner = targetEl || (app?.isBattle ? document.getElementById('battle-result-banner') : null) || document.getElementById('result-banner') || document.getElementById('battle-result-banner');
    if (!banner) return;
    banner.classList.remove('tier-banner-skin', 'skin-diamond', 'skin-master', 'skin-grandmaster');
    banner.querySelector('.rb-skin-decor')?.remove();
    if (!data || data.status !== 'win') return;
    const skinTier = getVictoryBannerSkinTier(app);
    if (!skinTier) return;
    banner.classList.add('tier-banner-skin', 'skin-' + skinTier.id);
    banner.style.setProperty('--skin-tier', skinTier.color);
    const decor = document.createElement('div');
    decor.className = 'rb-skin-decor';
    decor.setAttribute('aria-hidden', 'true');
    decor.innerHTML =
      `<span class="rbs-corner tl"></span><span class="rbs-corner tr"></span>` +
      `<span class="rbs-corner bl"></span><span class="rbs-corner br"></span>` +
      `<span class="rbs-wing left">${R.tierSymbol(skinTier.id, 46)}</span>` +
      `<span class="rbs-wing right">${R.tierSymbol(skinTier.id, 46)}</span>` +
      `<span class="rbs-ribbon">${tr(skinTier.ko).toUpperCase()} VICTORY</span>`;
    banner.prepend(decor);
  }

  function applyCosmetics() {
    const k = unlockedIdx(), b = document.body;
    let c = loadC();
    // v2.1.9: 시즌이 바뀌면 장착 상태를 초기화합니다(새 시즌 보상은 다시 자동 장착).
    const sn = R.seasonOf();
    if (c._season !== sn) c = { _season: sn };
    // v2.1.7: 티어 보상은 하나만 장착합니다(여러 개가 켜지면 테두리·배너가 겹쳤습니다).
    //   새로 해금된 보상은 자동 장착, 기존 저장값에 여러 개가 켜져 있으면 가장 높은 것만 남깁니다.
    let fresh = '';
    REWARDS.forEach(id => { const idx = R.TIERS.findIndex(x => x.id === id); if (k >= idx && c[id] === undefined) fresh = id; });
    const owned = REWARDS.filter(id => k >= R.TIERS.findIndex(x => x.id === id));
    let pickId = fresh || [...owned].reverse().find(id => c[id] === true) || '';
    REWARDS.forEach(id => {
      const idx = R.TIERS.findIndex(x => x.id === id);
      if (k >= idx) c[id] = id === pickId;
      b.classList.toggle('rkc-' + id, k >= idx && id === pickId);
    });
    saveC(c);
    // v2.1.6: 홈 화면 그랜드마스터 엠블럼은 제거했습니다(이전 버전이 남긴 요소도 정리).
    document.getElementById('rkc-home-emblem')?.remove();
    // 새로 해금된 보상 축하 연출
    try { window.SumdokuTierRewards?.onCosmeticsApplied?.(); } catch (_) {}
  }

  /* ---------- 랭킹 탭 섹션 ---------- */
  function ensureSections() {
    const main = document.querySelector('#view-ranking .ranking-main');
    if (!main || document.getElementById('season-head')) return main;
    const head = mk('section', 'season-head'); head.id = 'season-head';
    const reward = mk('section', 'season-reward hidden'); reward.id = 'season-reward';
    main.prepend(head, reward);
    const hof = mk('section', 'ranking-ladder season-hof'); hof.id = 'season-hof';
    const cos = mk('section', 'ranking-ladder season-cos'); cos.id = 'season-cos';
    main.append(hof, cos);
    return main;
  }

  function renderSeason() {
    if (!ensureSections()) return;
    const all = R.loadAll(), n = R.seasonOf();
    const left = Math.max(0, Math.ceil((R.seasonEnd(n) - Date.now()) / 86400000));
    const head = document.getElementById('season-head');
    head.innerHTML = '';
    const top = mk('div', 'sh-top');
    top.append(mk('b', 'sh-n', n ? `${t('season')} ${n}` : t('pre')), mk('span', 'sh-left', n ? t('left').replace('{0}', left) : t('startsIn').replace('{0}', left)));
    const bar = mk('div', 'sh-bar'); const fill = mk('i'); fill.style.width = n ? Math.min(100, (56 - left) / 56 * 100).toFixed(1) + '%' : '0%'; bar.append(fill);
    head.append(top, bar, mk('p', 'sh-rules', t('rules')), mk('p', 'sh-reset', t('reset')));

    // 지난 시즌 보상 안내(한 번)
    const rw = document.getElementById('season-reward');
    const sr = all.seasonReward;
    if (sr && !sr.seen) {
      const tier = tierById(sr.tier);
      rw.classList.remove('hidden'); rw.innerHTML = '';
      rw.style.setProperty('--tier', tier.color);
      const em = mk('div', 'sr-em'); em.innerHTML = R.tierSymbol(tier.id, 72);
      const tx = mk('div', 'sr-tx'); tx.append(mk('b', null, t('rewardTitle')), mk('span', null, t('rewardText').replace('{0}', sr.season).replace('{1}', tr(tier.ko))));
      const ok = mk('button', 'btn btn-secondary', t('ok')); ok.type = 'button';
      ok.onclick = () => { const a = R.loadAll(); if (a.seasonReward) a.seasonReward.seen = true; R.saveAll(a); rw.classList.add('hidden'); };
      rw.append(em, tx, ok);
    } else rw.classList.add('hidden');

    // 명예의 전당
    const hof = document.getElementById('season-hof');
    hof.innerHTML = '';
    hof.append(mk('h3', 'section-title', t('hof')));
    const list = (all.hof || []).slice(0, 30);
    if (!list.length) hof.append(mk('p', 'ranking-hint', t('hofEmpty')));
    else {
      const grid = mk('div', 'hof-grid');
      list.forEach(h => {
        const tier = R.tierOf(h.best);
        const c = mk('div', 'hof-item'); c.style.setProperty('--tier', tier.color);
        const em = mk('div', 'hof-em'); em.innerHTML = R.tierSymbol(tier.id, 52, tier.division);
        c.append(em, mk('b', 'hof-s', h.season ? `${t('season')} ${h.season}` : t('pre')),
          mk('span', 'hof-d', `${diffName(h.diff)}`.trim()), mk('span', 'hof-t', `${tier.name} · ${h.best}`));
        grid.append(c);
      });
      hof.append(grid);
    }

    // 티어 보상
    const cos = document.getElementById('season-cos');
    cos.innerHTML = '';
    // v2.1.6: 컬렉션형 티어 보상 화면(tier-rewards.js). 없으면 아래 기본 목록을 그립니다.
    if (window.SumdokuTierRewards?.render) {
      try { window.SumdokuTierRewards.render(cos, { REWARDS, loadC, saveC, unlockedIdx, applyCosmetics, title: t('rewards'), note: t('rewardsNote') }); return; } catch (e) { console.warn('tier-rewards', e); cos.innerHTML = ''; }
    }
    cos.append(mk('h3', 'section-title', t('rewards')), mk('p', 'ranking-hint', t('rewardsNote')));
    const k = unlockedIdx(), c = loadC();
    REWARDS.forEach(id => {
      const tier = tierById(id), idx = R.TIERS.indexOf(tier), open = k >= idx;
      const row = mk('label', 'cos-row' + (open ? '' : ' locked')); row.style.setProperty('--tier', tier.color);
      const em = mk('span', 'cos-em'); em.innerHTML = R.tierSymbol(id, 34);
      const tx = mk('span', 'cos-tx'); tx.append(mk('b', null, tr(tier.ko)), mk('span', null, t('r_' + id)));
      row.append(em, tx);
      if (open) {
        const sw = mk('span', 'toggle-switch');
        const cb = mk('input'); cb.type = 'checkbox'; cb.checked = !!c[id];
        cb.onchange = () => { const cc = loadC(); cc[id] = cb.checked; saveC(cc); applyCosmetics(); };
        sw.append(cb, mk('span', 'slider')); row.append(sw);
      } else { const l = mk('span', 'cos-lock'); if (window.SumdokuIcon) l.append(SumdokuIcon.el('lock', 12)); l.append(document.createTextNode(' ' + t('locked'))); row.append(l); }
      cos.append(row);
    });
  }

  const rr = P.renderRankingView;
  if (rr) P.renderRankingView = function (...a) { const r = rr.apply(this, a); try { renderSeason(); } catch (e) { console.warn('season', e); } return r; };
  // 게임이 끝나 최고 티어가 바뀌면 꾸미기 해금 반영
  const rec = P.recordGameEnd;
  P.recordGameEnd = function (...a) { const r = rec.apply(this, a); try { applyCosmetics(); } catch (_) {} return r; };
  const showRes = P.showGameResultModal;
  if (showRes) {
    P.showGameResultModal = function (data, ...rest) {
      const r = showRes.call(this, data, ...rest);
      try { applyVictoryBannerSkin(this, data); } catch (e) { console.warn('banner-skin', e); }
      return r;
    };
  }
  const hbe = P.handleBattleEnd;
  if (hbe) {
    P.handleBattleEnd = function (isVictory, ...rest) {
      const r = hbe.apply(this, [isVictory, ...rest]);
      try {
        if (isVictory) applyVictoryBannerSkin(this, { status: 'win' }, document.getElementById('battle-result-banner'));
        applyCosmetics();
      } catch (e) { console.warn('season-battle-end', e); }
      return r;
    };
  }
  new MutationObserver(() => { if (window.app?.currentView === 'ranking') try { renderSeason(); } catch (_) {} })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  const init = () => { try { applyCosmetics(); } catch (e) { console.warn('cosmetics', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.SumdokuSeason = { applyCosmetics, renderSeason, applyVictoryBannerSkin, getVictoryBannerSkinTier };
})();
