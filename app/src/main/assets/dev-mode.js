/* v2.1.5 · 개발자 모드 (GitHub 배포판 전용)
 *
 * 활성화: 나 → 광고 제거 패널 맨 아래의 '숨겨진 칸'(보이지 않는 입력란)을 누르고 1q2w3e4r 를 입력합니다.
 *   - Google Play 배포판(getDistribution() === 'play')에서는 입력란 자체가 만들어지지 않습니다.
 *   - 활성화 상태는 localStorage 'sumdoku_dev_mode' 에 저장되며, 패널의 '개발자 모드 끄기'로 해제합니다.
 *
 * 기능
 *   1. 티어 세팅: 모드(배틀·일반·타임어택) × 난이도(전체 또는 하나)에 원하는 티어·단계 또는 RP를 직접 지정
 *      (배치 경기·승급전·강등 보호를 정리하고 최고 기록(peak)도 함께 맞춥니다)
 *   2. 잠금 해제: 티어 보상(꾸미기) 전체 해금 · 업적 전체 해금
 *   3. 랭크 초기화: 선택한 모드·난이도를 1000 RP 신규 상태로 되돌립니다.
 */
(() => {
  const DEV_KEY = 'sumdoku_dev_mode';
  const COS_KEY = 'sumdoku_dev_unlock_cosmetics';
  const CODE = '1q2w3e4r';
  const bridge = () => window.AndroidBridge;
  const distribution = () => { try { return bridge()?.getDistribution?.() || 'web'; } catch (_) { return 'web'; } };
  const isGithub = () => distribution() === 'github';

  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const L = () => Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const T = {
    hidden: ['개발자 코드', 'Developer code', '開発者コード', '开发者代码', '開發者代碼', 'Código de desarrollador', 'Code développeur', 'Entwicklercode'],
    on: ['개발자 모드가 활성화되었습니다.', 'Developer mode enabled.', '開発者モードを有効にしました。', '开发者模式已启用。', '開發者模式已啟用。', 'Modo desarrollador activado.', 'Mode développeur activé.', 'Entwicklermodus aktiviert.'],
    off: ['개발자 모드를 껐습니다.', 'Developer mode disabled.', '開発者モードをオフにしました。', '开发者模式已关闭。', '開發者模式已關閉。', 'Modo desarrollador desactivado.', 'Mode développeur désactivé.', 'Entwicklermodus deaktiviert.'],
    title: ['개발자 모드', 'Developer mode', '開発者モード', '开发者模式', '開發者模式', 'Modo desarrollador', 'Mode développeur', 'Entwicklermodus'],
    warn: ['GitHub판 전용 테스트 도구입니다. 바꾼 값은 이 기기의 기록에 바로 저장됩니다.', 'Test tools for the GitHub build only. Changes are saved to this device immediately.', 'GitHub版専用のテストツールです。変更はこの端末の記録にすぐ保存されます。', '仅限 GitHub 版的测试工具。更改会立即保存到本机记录。', '僅限 GitHub 版的測試工具。變更會立即儲存到本機紀錄。', 'Herramientas de prueba solo para la versión de GitHub. Los cambios se guardan al instante.', 'Outils de test pour la version GitHub uniquement. Les changements sont enregistrés aussitôt.', 'Testwerkzeuge nur für die GitHub-Version. Änderungen werden sofort gespeichert.'],
    tierSec: ['티어 세팅', 'Tier setup', 'ティア設定', '段位设置', '段位設定', 'Ajuste de rango', 'Réglage du rang', 'Rang einstellen'],
    mode: ['모드', 'Mode', 'モード', '模式', '模式', 'Modo', 'Mode', 'Modus'],
    diff: ['난이도', 'Difficulty', '難易度', '难度', '難度', 'Dificultad', 'Difficulté', 'Schwierigkeit'],
    all: ['전체 난이도', 'All difficulties', '全難易度', '全部难度', '全部難度', 'Todas', 'Toutes', 'Alle'],
    tier: ['티어', 'Tier', 'ティア', '段位', '段位', 'Rango', 'Rang', 'Rang'],
    rp: ['RP 직접 입력', 'Custom RP', 'RPを直接入力', '直接输入 RP', '直接輸入 RP', 'RP personalizado', 'RP personnalisé', 'Eigene RP'],
    apply: ['적용', 'Apply', '適用', '应用', '套用', 'Aplicar', 'Appliquer', 'Anwenden'],
    applied: ['티어를 설정했습니다: {0}', 'Tier set: {0}', 'ティアを設定しました: {0}', '已设置段位：{0}', '已設定段位：{0}', 'Rango ajustado: {0}', 'Rang défini : {0}', 'Rang gesetzt: {0}'],
    current: ['현재 상태', 'Current', '現在の状態', '当前状态', '目前狀態', 'Estado actual', 'État actuel', 'Aktuell'],
    unlockSec: ['잠금 해제', 'Unlocks', 'ロック解除', '解锁', '解鎖', 'Desbloqueos', 'Déblocages', 'Freischaltungen'],
    cos: ['티어 보상(꾸미기) 전체 해금', 'Unlock all tier rewards', 'ティア報酬をすべて解放', '解锁全部段位奖励', '解鎖全部段位獎勵', 'Desbloquear todas las recompensas', 'Débloquer toutes les récompenses', 'Alle Rangbelohnungen freischalten'],
    cosNote: ['그랜드마스터까지 모든 테두리·배너·테마를 켜고 끌 수 있습니다.', 'All frames, banners and themes up to Grandmaster become available.', 'グランドマスターまでの枠・バナー・テーマをすべて使えます。', '可使用直至宗师的全部边框、横幅和主题。', '可使用直至宗師的全部邊框、橫幅與主題。', 'Todos los marcos, banners y temas hasta Gran Maestro.', 'Tous les cadres, bannières et thèmes jusqu’à Grand maître.', 'Alle Rahmen, Banner und Themes bis Großmeister.'],
    ach: ['업적 전체 해금', 'Unlock all achievements', '実績をすべて解除', '解锁全部成就', '解鎖全部成就', 'Desbloquear logros', 'Débloquer tous les succès', 'Alle Erfolge freischalten'],
    achDone: ['업적 {0}개를 해금했습니다.', 'Unlocked {0} achievements.', '実績を{0}件解除しました。', '已解锁 {0} 个成就。', '已解鎖 {0} 個成就。', '{0} logros desbloqueados.', '{0} succès débloqués.', '{0} Erfolge freigeschaltet.'],
    achLock: ['업적 다시 잠그기', 'Re-lock achievements', '実績を再ロック', '重新锁定成就', '重新鎖定成就', 'Volver a bloquear logros', 'Reverrouiller les succès', 'Erfolge wieder sperren'],
    achLocked: ['업적을 모두 다시 잠갔습니다.', 'All achievements re-locked.', '実績をすべて再ロックしました。', '已重新锁定全部成就。', '已重新鎖定全部成就。', 'Logros bloqueados de nuevo.', 'Succès reverrouillés.', 'Alle Erfolge wieder gesperrt.'],
    resetSec: ['초기화', 'Reset', 'リセット', '重置', '重設', 'Restablecer', 'Réinitialiser', 'Zurücksetzen'],
    reset: ['선택한 랭크를 1000 RP로 초기화', 'Reset selected ranks to 1000 RP', '選択したランクを1000 RPにリセット', '将所选段位重置为 1000 RP', '將所選段位重設為 1000 RP', 'Restablecer a 1000 RP', 'Réinitialiser à 1000 RP', 'Auf 1000 RP zurücksetzen'],
    resetDone: ['랭크를 초기화했습니다.', 'Ranks reset.', 'ランクをリセットしました。', '段位已重置。', '段位已重設。', 'Rangos restablecidos.', 'Rangs réinitialisés.', 'Ränge zurückgesetzt.'],
    exit: ['개발자 모드 끄기', 'Turn off developer mode', '開発者モードをオフ', '关闭开发者模式', '關閉開發者模式', 'Desactivar modo desarrollador', 'Désactiver le mode développeur', 'Entwicklermodus ausschalten'],
    battle: ['배틀 (경쟁전)', 'Battle (ranked)', 'バトル（ランク戦）', '对战（排位）', '對戰（排位）', 'Batalla (clasificatoria)', 'Duel (classé)', 'Kampf (Rangliste)'],
    standard: ['일반', 'Standard', '通常', '普通', '一般', 'Normal', 'Normal', 'Normal'],
    timeattack: ['타임어택', 'Time Attack', 'タイムアタック', '限时挑战', '限時挑戰', 'Contrarreloj', 'Contre-la-montre', 'Zeitangriff'],
    games: ['{0}판', '{0} games', '{0}試合', '{0}局', '{0}局', '{0} partidas', '{0} parties', '{0} Spiele'],
    bad: ['RP는 0~9999 사이 숫자로 입력해 주세요.', 'Enter RP between 0 and 9999.', 'RPは0〜9999で入力してください。', '请输入 0~9999 之间的 RP。', '請輸入 0~9999 之間的 RP。', 'Introduce un RP entre 0 y 9999.', 'Saisissez un RP entre 0 et 9999.', 'RP zwischen 0 und 9999 eingeben.']
  };
  const t = (k, ...a) => { let s = (T[k] && (T[k][L()] || T[k][1])) || k; a.forEach((v, i) => { s = s.split('{' + i + '}').join(String(v)); }); return s; };
  const toast = (s, ms = 2600) => { try { window.app?.showToast?.(s, ms); } catch (_) {} };
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const isOn = () => { try { return isGithub() && localStorage.getItem(DEV_KEY) === '1'; } catch (_) { return false; } };
  const cosUnlocked = () => { try { return isOn() && localStorage.getItem(COS_KEY) === '1'; } catch (_) { return false; } };

  /* ---------- 티어 보상 해금: 최고 티어 판정을 개발자 설정으로 덮어씁니다 ---------- */
  function patchRating() {
    const R = window.SumdokuRating;
    if (!R || R._devPatched) return;
    R._devPatched = true;
    const base = R.bestTierIndex;
    R.bestTierIndex = function (all) {
      const k = base.call(this, all);
      return cosUnlocked() ? Math.max(k, R.TIERS.length - 1) : k;
    };
  }

  function refreshAll() {
    const app = window.app;
    try { app?.renderRatingCard?.(); } catch (_) {}
    try { app?.updateHeaderRankBadge?.(); } catch (_) {}
    try { window.SumdokuSeason?.applyCosmetics?.(); } catch (_) {}
    try { if (document.getElementById('view-ranking')?.classList.contains('active')) app?.renderRankingView?.(); } catch (_) {}
    try { app?.renderAchievements?.(); } catch (_) {}
  }

  /* ---------- 랭크 조작 ---------- */
  const targets = (mode, diff) => {
    const R = window.SumdokuRating;
    return diff === 'all' ? R.DIFFS.slice() : [diff];
  };
  function setRating(mode, diff, rp) {
    const R = window.SumdokuRating;
    const all = R.loadAll();
    const lad = R.ladder(all, mode);
    for (const d of targets(mode, diff)) {
      const s = lad.byDiff[d];
      if (!s) continue;
      s.rating = rp;
      s.peak = rp; // 개발자 설정값을 최고 기록으로도 맞춥니다(꾸미기 해금 판정 일관성).
      s.seasonBest = rp;
      s.placement = 0; s.series = null; s.protect = 0; s.boost = 0;
      s.games = Math.max(1, s.games || 0);
      s.seasonGames = Math.max(1, s.seasonGames || 0);
      s.lastActive = Date.now(); s.lastDecay = 0;
      if (!Array.isArray(s.history)) s.history = [];
      s.history.unshift({ t: Date.now(), d: 0, why: 'dev', diff: d, mode });
      s.history = s.history.slice(0, 30);
    }
    if (mode === 'battle') { all.lastMode = 'battle'; lad.lastDiff = diff === 'all' ? (lad.lastDiff || 'expert') : diff; }
    R.saveAll(all);
    refreshAll();
  }
  function resetRating(mode, diff) {
    const R = window.SumdokuRating;
    const all = R.loadAll();
    const lad = R.ladder(all, mode);
    for (const d of targets(mode, diff)) {
      const s = lad.byDiff[d];
      if (!s) continue;
      Object.assign(s, { rating: 1000, peak: 1000, games: 0, streak: 0, bestStreak: 0, placement: R.seasonOf() ? R.PLACEMENT : 0,
        series: null, protect: 0, boost: 0, seasonGames: 0, seasonBest: 0, history: [], lastActive: 0, lastDecay: 0 });
    }
    R.saveAll(all);
    refreshAll();
  }

  /* ---------- UI ---------- */
  function tierOptions() {
    const R = window.SumdokuRating;
    const out = [];
    const ROMAN = ['V', 'IV', 'III', 'II', 'I'];
    R.TIERS.forEach((tier, i) => {
      const next = R.TIERS[i + 1];
      if (!next) { out.push({ rp: tier.min, label: R.tierOf(tier.min).name + ` (${tier.min}+)` }); return; }
      // 단계마다 100 RP: 다음 티어 시작점에서 아래로 I(−100), II(−200) … V(−500)
      ROMAN.forEach((_, d) => {
        const rp = Math.max(tier.min, next.min - (ROMAN.length - d) * 100);
        const name = R.tierOf(rp).name;
        if (!out.some(o => o.label.startsWith(name + ' '))) out.push({ rp, label: `${name} (${rp})` });
      });
    });
    return out;
  }

  function statusText(mode, diff) {
    const R = window.SumdokuRating;
    const all = R.loadAll();
    const lad = R.ladder(all, mode);
    const diffs = targets(mode, diff);
    const names = window.SumdokuDiffNames;
    return diffs.map(d => {
      const s = lad.byDiff[d];
      const tier = R.shownTier(s);
      const dn = (names && names[d] && names[d][L()]) || d;
      return `${dn}: ${tier.name} · ${s.rating} RP · ${t('games', s.games || 0)}`;
    }).join('\n');
  }

  function renderPanel() {
    const host = document.getElementById('panel-noads');
    if (!host) return;
    let box = document.getElementById('dev-mode-panel');
    if (!isOn()) { box?.remove(); return; }
    const R = window.SumdokuRating;
    if (!R) return;
    if (!box) { box = mk('section', 'info-card dev-card'); box.id = 'dev-mode-panel'; box.dataset.userContent = ''; }
    const hiddenWrap = document.getElementById('dev-code-wrap');
    if (hiddenWrap && hiddenWrap.parentElement === host) host.insertBefore(box, hiddenWrap); else host.append(box);
    const prev = { mode: box.dataset.mode || 'battle', diff: box.dataset.diff || 'all' };
    box.replaceChildren();

    const h3 = mk('h3', 'dev-title'); if (window.SumdokuIcon) h3.append(SumdokuIcon.el('wrench', 16), document.createTextNode(' ')); h3.append(document.createTextNode(t('title')));
    box.append(h3, mk('p', 'dev-warn', t('warn')));

    // 1. 티어 세팅
    const sec1 = mk('div', 'dev-sec');
    sec1.append(mk('h4', 'dev-sub', t('tierSec')));
    const row = (label, ctl) => { const r = mk('label', 'dev-row'); r.append(mk('span', 'dev-lbl', label), ctl); return r; };
    const selMode = mk('select', 'dev-input');
    ['battle', 'standard', 'timeattack'].forEach(m => { const o = mk('option', '', t(m)); o.value = m; selMode.append(o); });
    selMode.value = prev.mode;
    const selDiff = mk('select', 'dev-input');
    { const o = mk('option', '', t('all')); o.value = 'all'; selDiff.append(o); }
    R.DIFFS.forEach(d => { const N = window.SumdokuDiffNames; const o = mk('option', '', (N && N[d] && N[d][L()]) || d); o.value = d; selDiff.append(o); });
    selDiff.value = prev.diff;
    const selTier = mk('select', 'dev-input');
    tierOptions().forEach(o => { const e = mk('option', '', o.label); e.value = String(o.rp); selTier.append(e); });
    const rpIn = mk('input', 'dev-input'); rpIn.type = 'number'; rpIn.min = '0'; rpIn.max = '9999'; rpIn.step = '1'; rpIn.inputMode = 'numeric';
    rpIn.placeholder = 'RP';
    const status = mk('pre', 'dev-status');
    const syncStatus = () => { box.dataset.mode = selMode.value; box.dataset.diff = selDiff.value; status.textContent = statusText(selMode.value, selDiff.value); };
    selMode.onchange = syncStatus; selDiff.onchange = syncStatus;
    selTier.onchange = () => { rpIn.value = selTier.value; };
    rpIn.value = selTier.value;
    const applyBtn = mk('button', 'btn btn-primary dev-btn', t('apply')); applyBtn.type = 'button';
    applyBtn.onclick = () => {
      const rp = Math.round(Number(rpIn.value));
      if (!Number.isFinite(rp) || rp < 0 || rp > 9999 || rpIn.value === '') { toast(t('bad')); return; }
      setRating(selMode.value, selDiff.value, rp);
      try { window.app?.sound?.play?.('badge'); } catch (_) {}
      toast(t('applied', `${R.tierOf(rp).name} · ${rp} RP`));
      syncStatus();
    };
    sec1.append(row(t('mode'), selMode), row(t('diff'), selDiff), row(t('tier'), selTier), row(t('rp'), rpIn), applyBtn,
      mk('div', 'dev-lbl dev-cur', t('current')), status);
    box.append(sec1);
    syncStatus();

    // 2. 잠금 해제
    const sec2 = mk('div', 'dev-sec');
    sec2.append(mk('h4', 'dev-sub', t('unlockSec')));
    const cosRow = mk('label', 'dev-toggle');
    const cosCb = mk('input'); cosCb.type = 'checkbox'; cosCb.checked = cosUnlocked();
    cosCb.onchange = () => { try { localStorage.setItem(COS_KEY, cosCb.checked ? '1' : '0'); } catch (_) {} refreshAll(); };
    const cosTx = mk('span'); cosTx.append(mk('b', '', t('cos')), mk('small', '', t('cosNote')));
    cosRow.append(cosCb, cosTx);
    const A = window.SumdokuAchievements;
    const achBtn = mk('button', 'btn btn-secondary dev-btn', t('ach')); achBtn.type = 'button';
    achBtn.onclick = () => {
      if (!A) return;
      const day = new Date(); const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      let n = 0; A.list.forEach(a => { if (!A.unlocked[a.id]) { A.unlocked[a.id] = key; n++; } });
      A.save(); refreshAll(); toast(t('achDone', n));
    };
    const achLockBtn = mk('button', 'btn btn-secondary dev-btn', t('achLock')); achLockBtn.type = 'button';
    achLockBtn.onclick = () => { if (!A) return; Object.keys(A.unlocked).forEach(k => delete A.unlocked[k]); A.save(); refreshAll(); toast(t('achLocked')); };
    sec2.append(cosRow, achBtn, achLockBtn);
    box.append(sec2);

    // 3. 초기화 · 끄기
    const sec3 = mk('div', 'dev-sec');
    sec3.append(mk('h4', 'dev-sub', t('resetSec')));
    const resetBtn = mk('button', 'btn btn-secondary dev-btn', t('reset')); resetBtn.type = 'button';
    resetBtn.onclick = () => { resetRating(selMode.value, selDiff.value); syncStatus(); toast(t('resetDone')); };
    const exitBtn = mk('button', 'btn btn-secondary dev-btn dev-exit', t('exit')); exitBtn.type = 'button';
    exitBtn.onclick = () => {
      try { localStorage.removeItem(DEV_KEY); localStorage.removeItem(COS_KEY); } catch (_) {}
      renderPanel(); refreshAll(); toast(t('off'));
    };
    sec3.append(resetBtn, exitBtn);
    box.append(sec3);
  }

  // 광고 제거 패널 맨 아래의 숨겨진 칸
  function mountHiddenInput() {
    if (!isGithub()) return;
    const host = document.getElementById('panel-noads');
    if (!host || document.getElementById('dev-code-wrap')) return;
    const wrap = mk('div', 'dev-code-wrap'); wrap.id = 'dev-code-wrap';
    const input = mk('input', 'dev-code-input');
    input.id = 'dev-code-input';
    input.type = 'password';
    input.autocomplete = 'off'; input.spellcheck = false;
    input.setAttribute('aria-label', t('hidden'));
    input.setAttribute('data-user-content', '');
    input.addEventListener('input', () => {
      if (input.value.trim() !== CODE) return;
      input.value = '';
      input.blur();
      try { localStorage.setItem(DEV_KEY, '1'); } catch (_) {}
      try { window.app?.sound?.play?.('badge'); } catch (_) {}
      toast(t('on'), 3000);
      renderPanel();
      document.getElementById('dev-mode-panel')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
    wrap.append(input);
    host.append(wrap);
  }

  function init() {
    patchRating();
    if (!isGithub()) return;
    mountHiddenInput();
    renderPanel();
    // 광고 제거 패널을 열 때마다 최신 상태로 다시 그립니다.
    const P = typeof SumdokuApp !== 'undefined' ? SumdokuApp.prototype : null;
    if (P && P.openHubPanel && !P._devHub) {
      P._devHub = true;
      const base = P.openHubPanel;
      P.openHubPanel = function (id) { const r = base.apply(this, arguments); if (id === 'panel-noads') { mountHiddenInput(); renderPanel(); } return r; };
    }
    new MutationObserver(() => { if (document.getElementById('dev-mode-panel')) renderPanel(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    if (cosUnlocked()) refreshAll();
  }

  window.SumdokuDevMode = { isOn, isGithub, renderPanel, setRating, resetRating };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
