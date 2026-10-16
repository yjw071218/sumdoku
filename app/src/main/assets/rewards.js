/* 목숨·힌트 최대 3개 제한 + (Google Play판) 광고 보고 부활 · 광고 보고 힌트
 * - 제한: 설정값 목숨 1~3, 힌트 0~3 (일반·배틀 공통). 예전에 저장된 큰 값·무제한은 3으로 맞춥니다.
 * - 부활: 목숨을 모두 잃어 게임이 끝날 때, 한 게임에 최대 2번 '광고 보고 부활(허용 목숨 +1, 3/3 → 3/4)' 또는 '포기'를 고릅니다.
 * - 광고 힌트: '감점하고 보기'는 없고 광고로 받은 힌트는 -500점(추가 힌트와 같은 감점)으로 사용됩니다.
 * - 광고 힌트: 힌트를 모두 썼을 때 한 게임에 최대 3번 '광고 보고 힌트 +1'을 받을 수 있습니다.
 * - 배틀 모드에서는 부활·광고 힌트를 제공하지 않습니다. GitHub판·브라우저에서도 제공하지 않습니다.
 * - 광고 제거 구매자는 광고 없이 바로 보상을 받습니다(네이티브에서 처리).
 */
(() => {
  // ---------------- 번역 (localize-ui.js 보다 먼저 등록) ----------------
  const T = window.UI_TRANSLATIONS = window.UI_TRANSLATIONS || {};
  const rows = {
    '목숨 (최대 3)': ['Lives (max 3)','ライフ（最大3）','生命（最多3）','生命（最多3）','Vidas (máx. 3)','Vies (max 3)','Leben (max. 3)'],
    '힌트 (최대 3)': ['Hints (max 3)','ヒント（最大3）','提示（最多3）','提示（最多3）','Pistas (máx. 3)','Indices (max 3)','Hinweise (max. 3)'],
    '목숨을 모두 잃었습니다': ['You lost all your lives','ライフをすべて失いました','生命已全部用完','生命已全部用完','Perdiste todas tus vidas','Vous avez perdu toutes vos vies','Alle Leben verloren'],
    '광고를 보고 목숨 1개를 추가해 이어서 풀 수 있습니다. (남은 부활 {0}회)': ['Watch an ad to gain 1 extra life and keep going. ({0} revives left)','広告を見るとライフが1つ増えて続行できます。（残り復活{0}回）','观看广告可增加1条生命继续。（剩余复活{0}次）','觀看廣告可增加1條生命繼續。（剩餘復活{0}次）','Mira un anuncio para ganar 1 vida extra y seguir. (Quedan {0} resurrecciones)','Regardez une pub pour gagner 1 vie supplémentaire. ({0} résurrections restantes)','Sieh dir eine Werbung an für 1 Extra-Leben. (Noch {0} Wiederbelebungen)'],
    '목숨 1개로 이어서 풀 수 있습니다. (남은 부활 {0}회)': ['Continue with 1 life. ({0} revives left)','ライフ1つで続行できます。（残り復活{0}回）','可以1条生命继续。（剩余复活{0}次）','可以1條生命繼續。（剩餘復活{0}次）','Sigue con 1 vida. (Quedan {0} resurrecciones)','Continuez avec 1 vie. ({0} résurrections restantes)','Mit 1 Leben weiterspielen. (Noch {0} Wiederbelebungen)'],
    '광고 보고 부활': ['Watch ad & revive','広告を見て復活','看广告复活','看廣告復活','Ver anuncio y revivir','Pub et résurrection','Werbung ansehen & weiter'],
    '부활하기': ['Revive','復活する','复活','復活','Revivir','Ressusciter','Wiederbeleben'],
    '포기': ['Give up','あきらめる','放弃','放棄','Rendirse','Abandonner','Aufgeben'],
    '부활했습니다! 목숨 1개로 이어서 풀어 보세요.': ['Revived! Keep going with 1 life.','復活しました！ライフ1つで続けましょう。','已复活！以1条生命继续吧。','已復活！以1條生命繼續吧。','¡Revivido! Sigue con 1 vida.','Ressuscité ! Continuez avec 1 vie.','Wiederbelebt! Mit 1 Leben weiter.'],
    '힌트를 모두 사용했습니다': ['You used all your hints','ヒントをすべて使いました','提示已全部用完','提示已全部用完','Usaste todas tus pistas','Vous avez utilisé tous vos indices','Alle Hinweise verbraucht'],
    '광고를 보고 힌트 1개를 받을 수 있습니다. (사용 시 -500점, 이번 게임 남은 횟수 {0}회)': ['Watch an ad to get 1 hint. (-500 pts when used, {0} left this game)','広告を見るとヒントを1つもらえます。（使用時-500点・このゲームの残り{0}回）','观看广告可获得1个提示。（使用时扣500分，本局剩余{0}次）','觀看廣告可獲得1個提示。（使用時扣500分，本局剩餘{0}次）','Mira un anuncio para obtener 1 pista. (-500 pts al usarla, quedan {0})','Regardez une pub pour obtenir 1 indice. (-500 pts à l’usage, {0} restants)','Sieh dir eine Werbung an für 1 Hinweis. (-500 Pkt. bei Nutzung, noch {0})'],
    '힌트 1개를 받을 수 있습니다. (사용 시 -500점, 이번 게임 남은 횟수 {0}회)': ['Get 1 hint. (-500 pts when used, {0} left this game)','ヒントを1つもらえます。（使用時-500点・残り{0}回）','可获得1个提示。（使用时扣500分，本局剩余{0}次）','可獲得1個提示。（使用時扣500分，本局剩餘{0}次）','Obtén 1 pista. (-500 pts al usarla, quedan {0})','Obtenez 1 indice. (-500 pts à l’usage, {0} restants)','1 Hinweis erhalten. (-500 Pkt. bei Nutzung, noch {0})'],
    '광고 보고 힌트 받기': ['Watch ad for a hint','広告を見てヒント','看广告获取提示','看廣告獲得提示','Ver anuncio por una pista','Pub contre un indice','Werbung für Hinweis'],
    '힌트 받기': ['Get hint','ヒントをもらう','获取提示','獲得提示','Obtener pista','Obtenir un indice','Hinweis holen'],
    '50점 감점하고 보기': ['Use with -500 pts','50点減点して見る','扣500分查看','扣500分查看','Usar con -500 pts','Utiliser avec -500 pts','Mit -500 Pkt. nutzen'],
    '취소': ['Cancel','キャンセル','取消','取消','Cancelar','Annuler','Abbrechen'],
    '힌트 1개를 받았습니다.': ['You got 1 hint.','ヒントを1つもらいました。','获得了1个提示。','獲得了1個提示。','Obtuviste 1 pista.','Vous avez reçu 1 indice.','Du hast 1 Hinweis erhalten.'],
    '광고를 끝까지 보면 보상을 받을 수 있습니다.': ['Watch the whole ad to get the reward.','広告を最後まで見ると報酬がもらえます。','完整观看广告即可获得奖励。','完整觀看廣告即可獲得獎勵。','Mira el anuncio completo para obtener la recompensa.','Regardez la pub en entier pour obtenir la récompense.','Sieh dir die Werbung ganz an, um die Belohnung zu erhalten.'],
    '지금은 광고를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.': ['Can’t load an ad right now. Please try again shortly.','現在広告を読み込めません。しばらくしてから再度お試しください。','目前无法加载广告，请稍后再试。','目前無法載入廣告，請稍後再試。','No se puede cargar un anuncio ahora. Inténtalo en un momento.','Impossible de charger une pub pour le moment. Réessayez bientôt.','Werbung kann gerade nicht geladen werden. Bitte gleich erneut versuchen.'],
    '광고 불러오는 중…': ['Loading ad…','広告を読み込み中…','正在加载广告…','正在載入廣告…','Cargando anuncio…','Chargement de la pub…','Werbung wird geladen…'],
    '남은 힌트가 없습니다.': ['No hints left.','ヒントが残っていません。','没有剩余提示。','沒有剩餘提示。','No quedan pistas.','Plus d’indices.','Keine Hinweise mehr.']
  };
  const langs = ['en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  for (const [ko, list] of Object.entries(rows)) langs.forEach((l, i) => { (T[l] = T[l] || {})[ko] = list[i]; });

  if (typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const MAX_LIVES = 3, MAX_HINTS = 3, MAX_REVIVES = 2, MAX_AD_HINTS = 3;
  const bridge = () => window.AndroidBridge;
  const isPlay = () => { try { return bridge()?.getDistribution?.() === 'play'; } catch (_) { return false; } };
  const isAdFree = () => { try { return !!bridge()?.isAdFree?.(); } catch (_) { return false; } };
  const rewardsAvailable = app => isPlay() && !app.isBattle && typeof bridge()?.showRewarded === 'function';

  // ---------------- 목숨·힌트 최대 3개 ----------------
  const clamp = (v, lo, hi, def) => { const n = parseInt(v, 10); return String(isNaN(n) ? def : Math.max(lo, Math.min(hi, n))); };
  P.clampLifeHintSettings = function () {
    const s = this.settings; if (!s) return false;
    const before = JSON.stringify([s.maxLives, s.initialHints, s.mistakeLimit]);
    s.maxLives = clamp(s.maxLives === 'unlimited' ? MAX_LIVES : s.maxLives, 1, MAX_LIVES, MAX_LIVES);
    s.initialHints = clamp(s.initialHints === 'unlimited' ? MAX_HINTS : s.initialHints, 0, MAX_HINTS, MAX_HINTS);
    s.mistakeLimit = true; // 무제한 목숨 설정은 더 이상 제공하지 않습니다(스피드 레이스·타임어택은 경기 규칙에서 별도 처리).
    return before !== JSON.stringify([s.maxLives, s.initialHints, s.mistakeLimit]);
  };
  const baseSave = P.saveSettings;
  P.saveSettings = function () { this.clampLifeHintSettings(); return baseSave.apply(this, arguments); };
  const baseApply = P.applySettings;
  P.applySettings = function () {
    const changed = this.clampLifeHintSettings();
    const r = baseApply.apply(this, arguments);
    // 입력칸에 4 이상을 넣으면 즉시 3으로 되돌립니다.
    for (const id of ['setting-max-lives', 'modal-setting-max-lives']) { const el = document.getElementById(id); if (el && el.value !== this.settings.maxLives && document.activeElement !== el) el.value = this.settings.maxLives; }
    for (const id of ['setting-initial-hints', 'modal-setting-initial-hints']) { const el = document.getElementById(id); if (el && el.value !== this.settings.initialHints && document.activeElement !== el) el.value = this.settings.initialHints; }
    if (changed && baseSave) baseSave.call(this);
    return r;
  };
  // 포커스가 빠질 때도 범위 밖 값을 정리합니다.
  document.addEventListener('change', e => {
    const id = e.target?.id || '';
    if (!/^(modal-)?setting-(max-lives|initial-hints)$/.test(id) && !/^(maxLives|initialHints)$/.test(e.target?.dataset?.quickSetting || '')) return;
    const app = window.app; if (!app) return;
    app.clampLifeHintSettings(); baseSave?.call(app); app.applySettings?.(); app.syncQuickSettings?.();
    const isLives = /lives/i.test(id) || e.target.dataset.quickSetting === 'maxLives';
    e.target.value = isLives ? app.settings.maxLives : app.settings.initialHints;
  });

  // ---------------- 게임마다 횟수 초기화 ----------------
  const baseStart = P.startNewGame;
  P.startNewGame = function () { pending = null; this.revivesUsed = 0; this.adHintsUsed = 0; this.adHintCredit = 0; this._baseLives = null; closeOffer(); return baseStart.apply(this, arguments); };

  // ---------------- 공통: 선택 창 · 보상형 광고 요청 ----------------
  let offer = null, pending = null, seq = 0;
  function closeOffer() { if (offer) { offer.remove(); offer = null; } }
  function showOffer({ title, body, primary, secondary, tertiary, onPrimary, onSecondary, onTertiary }) {
    closeOffer();
    const el = document.createElement('div');
    el.id = 'reward-offer'; el.className = 'modal-backdrop reward-offer';
    el.innerHTML = '<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="reward-offer-title"><h3 id="reward-offer-title"></h3><p class="reward-offer-body"></p><div class="modal-footer"></div></section>';
    el.querySelector('h3').textContent = title;
    el.querySelector('.reward-offer-body').textContent = body;
    const footer = el.querySelector('.modal-footer');
    const add = (text, cls, fn) => { if (!text) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = text; b.onclick = fn; footer.append(b); return b; };
    add(tertiary, 'btn-secondary', onTertiary);
    add(secondary, 'btn-secondary', onSecondary);
    const main = add(primary, 'btn-primary', onPrimary);
    (document.getElementById('app') || document.body).append(el);
    offer = el;
    setTimeout(() => main?.focus(), 30);
    return el;
  }
  function requestReward(button, onEarned, onFail) {
    if (pending) return;
    const id = 'r' + (++seq);
    pending = { id, onEarned, onFail };
    if (button) { button.disabled = true; button.dataset.label = button.textContent; button.textContent = '광고 불러오는 중…'; }
    try { bridge().showRewarded(id); } catch (_) { window.onRewardResult(id, 'unavailable'); }
  }
  window.onRewardResult = (id, status) => {
    if (!pending || pending.id !== id) return;
    const p = pending; pending = null;
    const btn = offer?.querySelector('.btn-primary');
    if (btn && btn.dataset.label) { btn.disabled = false; btn.textContent = btn.dataset.label; }
    if (status === 'earned') p.onEarned();
    else { window.app?.showToast?.(status === 'closed' ? '광고를 끝까지 보면 보상을 받을 수 있습니다.' : '지금은 광고를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.'); p.onFail?.(status); }
  };

  // 부활 횟수만큼 허용 목숨을 늘립니다. 저장·복원 시 규칙이 3으로 정규화되므로 기본값 + 부활 횟수로 다시 계산합니다.
  function applyReviveLives(app, revives) {
    const r = app.rules;
    if (!r || r.maxLives === 'unlimited' || r.mistakeLimit === false) return;
    if (app._baseLives == null) app._baseLives = Math.min(MAX_LIVES, parseInt(r.maxLives, 10) || MAX_LIVES);
    const total = app._baseLives + Math.max(0, revives || 0);
    if (app.gameRules) app.gameRules.maxLives = String(total);
    app.maxMistakes = total;
  }

  // ---------------- 광고 보고 부활 (최대 2번, 포기 가능) ----------------
  const baseGameOver = P.handleGameOver;
  P.handleGameOver = function () {
    if (offer && this.resultReason === 'revive_offer') return;
    if (!rewardsAvailable(this) || this.isWin || (this.revivesUsed || 0) >= MAX_REVIVES || this.mistakes < this.maxMistakes) return baseGameOver.apply(this, arguments);
    // 결과 처리 전에 멈추고 선택을 기다립니다. resultReason 으로 입력을 막습니다.
    this.stopTimer(); this.resetCombo?.();
    this.resultReason = 'revive_offer';
    this.saveOngoingGame?.();
    this.sound?.play?.('error');
    const left = MAX_REVIVES - (this.revivesUsed || 0);
    const adFree = isAdFree();
    const giveUp = () => { closeOffer(); pending = null; this.resultReason = null; baseGameOver.call(this); };
    showOffer({
      title: '목숨을 모두 잃었습니다',
      body: adFree ? `목숨 1개로 이어서 풀 수 있습니다. (남은 부활 ${left}회)` : `광고를 보고 목숨 1개를 추가해 이어서 풀 수 있습니다. (남은 부활 ${left}회)`,
      primary: adFree ? '부활하기' : '광고 보고 부활',
      tertiary: '포기',
      onTertiary: giveUp,
      onPrimary: e => requestReward(e.currentTarget, () => {
        closeOffer();
        this.revivesUsed = (this.revivesUsed || 0) + 1;
        // v1.1.30: 실수 횟수는 그대로 두고 허용 목숨을 1칸 늘립니다(3/3 → 3/4).
        applyReviveLives(this, (this.revivesUsed || 0));
        const max = (this.rules.maxLives === 'unlimited' || !this.rules.mistakeLimit) ? '∞' : this.maxMistakes;
        if (this.dom.mistakes) this.dom.mistakes.textContent = `${this.mistakes} / ${max}`;
        this.resultReason = null;
        if (!this.isPaused) this.startTimer();
        this.saveOngoingGame?.();
        this.showToast('부활했습니다! 목숨 1개로 이어서 풀어 보세요.');
      })
    });
  };

  // ---------------- 광고 보고 힌트 (게임당 최대 3번) ----------------
  const baseHint = P.useHint;
  P.useHint = function () {
    const out = this.hintsRemaining <= 0 && this.rules.initialHints !== 'unlimited';
    const blocked = this.currentView !== 'game' || this.isPaused || this.isWin || this.resultReason;
    if (out && !blocked && rewardsAvailable(this) && (this.adHintsUsed || 0) >= MAX_AD_HINTS && !document.getElementById('hint-confirm')) {
      // 감점하고 바로 보기는 없앴습니다. 광고 힌트 횟수까지 다 쓰면 더 받을 수 없습니다.
      this.sound?.play?.('error');
      this.showToast?.('남은 힌트가 없습니다.');
      return;
    }
    if (!out || blocked || !rewardsAvailable(this) || document.getElementById('hint-confirm')) {
      return baseHint.apply(this, arguments);
    }
    const left = MAX_AD_HINTS - (this.adHintsUsed || 0);
    const adFree = isAdFree();
    this.sound?.play?.('click');
    showOffer({
      title: '힌트를 모두 사용했습니다',
      body: adFree ? `힌트 1개를 받을 수 있습니다. (사용 시 -500점, 이번 게임 남은 횟수 ${left}회)` : `광고를 보고 힌트 1개를 받을 수 있습니다. (사용 시 -500점, 이번 게임 남은 횟수 ${left}회)`,
      primary: adFree ? '힌트 받기' : '광고 보고 힌트 받기',
      tertiary: '취소',
      onTertiary: () => { closeOffer(); pending = null; },
      onPrimary: e => requestReward(e.currentTarget, () => {
        closeOffer();
        this.adHintsUsed = (this.adHintsUsed || 0) + 1;
        this.hintsRemaining = (this.hintsRemaining || 0) + 1;
        this.adHintCredit = (this.adHintCredit || 0) + 1; // 광고 힌트는 기존 추가 힌트와 같은 -500점으로 사용됩니다.
        this.updateHintBadge?.();
        this.saveOngoingGame?.();
        this.showToast('힌트 1개를 받았습니다.');
        baseHint.call(this); // 받은 힌트로 기존 힌트 확인 창을 엽니다.
      })
    });
  };

  // 이어하기로 부활 제안 상태까지 복원합니다.
  const baseRestore = P.restoreOngoingGame;
  P.restoreOngoingGame = function () {
    pending = null; closeOffer();
    const result = baseRestore.apply(this, arguments);
    try {
      this._baseLives = null;
      if ((this.revivesUsed || 0) > 0) {
        applyReviveLives(this, this.revivesUsed);
        const max = (this.rules.maxLives === 'unlimited' || !this.rules.mistakeLimit) ? '∞' : this.maxMistakes;
        if (this.dom?.mistakes) this.dom.mistakes.textContent = `${this.mistakes} / ${max}`;
      }
    } catch (_) {}
    if (this.resultReason === 'revive_offer') { this.resultReason = null; this.handleGameOver(); }
    return result;
  };

  // 앱 시작 시 저장된 설정을 한 번 정리합니다.
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => {
    const app = window.app; if (!app || !app.settings) return;
    if (app.clampLifeHintSettings()) { baseSave?.call(app); }
    app.applySettings?.(); app.syncQuickSettings?.();
  }, 0));
})();
