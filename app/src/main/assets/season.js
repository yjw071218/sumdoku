/* v1.1.28 · 랭킹 탭 티어 보상 꾸미기
 * v2.2.1: 시즌제 삭제 — 시즌 정보·지난 시즌 보상 안내·명예의 전당을 없앴습니다.
 * 티어 보상: 배틀에서 도달한 최고 티어로 영구 해금. 하나만 장착하며 켜고 끌 수 있습니다(구성은 tier-rewards.js).
 */
(() => {
  const R = window.SumdokuRating;
  if (!R || typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const L = () => Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const T = {
    rewards: ['티어 보상', 'Tier rewards', 'ティア報酬', '段位奖励', '段位獎勵', 'Recompensas', 'Récompenses', 'Belohnungen'],
    rewardsNote: ['경쟁전 배틀에서 해당 티어에 한 번이라도 도달하면 보상이 영구히 해금됩니다.', 'Reach a tier in ranked battles once and its reward is yours forever.', 'ランク戦バトルで一度でもそのティアに到達すると、報酬が永久に解放されます。', '在排位对战中达到该段位一次，奖励即永久解锁。', '在排位對戰中達到該段位一次，獎勵即永久解鎖。', 'Alcanza un rango en duelos clasificatorios una vez y su recompensa será tuya para siempre.', 'Atteignez un rang une fois en duel classé et sa récompense vous appartient pour toujours.', 'Erreiche einen Rang einmal in Ranglisten-Kämpfen und die Belohnung gehört dir für immer.'],
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
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const tierById = id => R.TIERS.find(x => x.id === id);

  /* ---------- 꾸미기 ---------- */
  // v2.1.6: 실버 보상 추가. 상세 구성·컬렉션 화면은 tier-rewards.js가 담당합니다.
  const REWARDS = ['silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster']; // 티어 id = 보상 id
  const CKEY = 'sumdoku_rank_cosmetics';
  const loadC = () => { try { return JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (_) { return {}; } };
  const saveC = c => { try { localStorage.setItem(CKEY, JSON.stringify(c)); } catch (_) {} };
  // v2.2.1: 보상 = 배틀에서 도달한 최고 티어(영구). 개발자 모드는 rewardTierIndex 를 덮어씁니다.
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
    const c = loadC();
    delete c._season; // v2.1.9 시즌 초기화 표식(더 이상 쓰지 않음)
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
    if (!main) return null;
    // v2.2.1: 이전 버전이 만든 시즌 섹션이 남아 있으면 지웁니다.
    ['season-head', 'season-reward', 'season-hof'].forEach(id => document.getElementById(id)?.remove());
    if (!document.getElementById('season-cos')) { const cos = mk('section', 'ranking-ladder season-cos'); cos.id = 'season-cos'; main.append(cos); }
    return main;
  }

  function renderSeason() {
    if (!ensureSections()) return;
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
