/* v1.1.30 · 성과 공유
 * - 결과 화면: [📤 성과 공유] 버튼 → 1080×1350 공유 카드(PNG)를 그려 Android 공유 시트로 보냅니다.
 *   카드 내용: 결과(클리어/실패), 난이도·모드, 소요 시간, 점수, 실수·힌트, 티어 엠블럼, RP 변화(랭크전) 또는 '일반전' 표시.
 *   ※ 퍼즐 보드·정답은 카드에 넣지 않습니다(랭크전 공정성).
 * - 랭크 카드(전적 화면): [📤 내 랭크 공유] 버튼 → 현재 난이도의 티어·RP·최고 기록 카드.
 * - 네이티브(AndroidBridge.shareImage)가 없으면 navigator.share(파일) → 텍스트 공유 → 이미지 저장 순으로 대체합니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const li = () => Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const T = {
    share: ['📤 성과 공유', '📤 Share result', '📤 成果を共有', '📤 分享成绩', '📤 分享成績', '📤 Compartir', '📤 Partager', '📤 Teilen'],
    shareRank: ['📤 내 랭크 공유', '📤 Share my rank', '📤 ランクを共有', '📤 分享我的段位', '📤 分享我的段位', '📤 Compartir rango', '📤 Partager mon rang', '📤 Rang teilen'],
    clear: ['CLEAR', 'CLEAR', 'CLEAR', '通关', '通關', 'COMPLETADO', 'RÉUSSI', 'GESCHAFFT'],
    fail: ['FAILED', 'FAILED', 'FAILED', '失败', '失敗', 'FALLIDO', 'ÉCHEC', 'GESCHEITERT'],
    time: ['소요 시간', 'Time', 'タイム', '用时', '用時', 'Tiempo', 'Temps', 'Zeit'],
    score: ['점수', 'Score', 'スコア', '分数', '分數', 'Puntos', 'Score', 'Punkte'],
    mistakes: ['실수', 'Mistakes', 'ミス', '失误', '失誤', 'Errores', 'Erreurs', 'Fehler'],
    hints: ['힌트', 'Hints', 'ヒント', '提示', '提示', 'Pistas', 'Indices', 'Hinweise'],
    ranked: ['랭크전', 'Ranked', 'ランク戦', '排位赛', '排位賽', 'Clasificatoria', 'Classé', 'Rangliste'],
    normal: ['일반전 · RP 무관', 'Normal · No RP', 'ノーマル · RPなし', '普通赛 · 无RP', '一般賽 · 無RP', 'Normal · Sin RP', 'Normal · Sans RP', 'Normal · Ohne RP'],
    daily: ['일일 도전', 'Daily Challenge', 'デイリー', '每日挑战', '每日挑戰', 'Desafío diario', 'Défi du jour', 'Tagesaufgabe'],
    timeattack: ['타임어택', 'Time Attack', 'タイムアタック', '计时赛', '計時賽', 'Contrarreloj', 'Contre-la-montre', 'Zeitangriff'],
    standard: ['클래식', 'Classic', 'クラシック', '经典', '經典', 'Clásico', 'Classique', 'Klassisch'],
    best: ['최고 기록', 'Peak', '最高記録', '最高纪录', '最高紀錄', 'Récord', 'Record', 'Bestwert'],
    games: ['경기 수', 'Games', '試合数', '对局数', '對局數', 'Partidas', 'Parties', 'Spiele'],
    streak: ['연속 클리어', 'Win streak', '連続クリア', '连胜', '連勝', 'Racha', 'Série', 'Serie'],
    placement: ['배치 경기 중', 'In placement', '配置戦中', '定级中', '定級中', 'En clasificación', 'En placement', 'In Platzierung'],
    tagline: ['킬러 스도쿠 · 100% 순수 연역 퍼즐', 'Killer Sudoku · 100% pure deduction', 'キラー数独 · 100%論理パズル', '杀手数独 · 100%纯逻辑', '殺手數獨 · 100%純邏輯', 'Killer Sudoku · 100% deducción', 'Killer Sudoku · 100 % déduction', 'Killer-Sudoku · 100 % Logik'],
    textWin: ['썸도쿠 {0} 클리어! ⏱ {1} · 🎯 {2}점', 'Cleared Sumdoku {0}! ⏱ {1} · 🎯 {2}', 'サムドク{0}をクリア！⏱ {1} · 🎯 {2}', '通关 Sumdoku {0}！⏱ {1} · 🎯 {2}', '通關 Sumdoku {0}！⏱ {1} · 🎯 {2}', '¡Completé Sumdoku {0}! ⏱ {1} · 🎯 {2}', 'Sumdoku {0} réussi ! ⏱ {1} · 🎯 {2}', 'Sumdoku {0} geschafft! ⏱ {1} · 🎯 {2}'],
    textFail: ['썸도쿠 {0} 도전 중! ⏱ {1} · 🎯 {2}점', 'Taking on Sumdoku {0}! ⏱ {1} · 🎯 {2}', 'サムドク{0}に挑戦中！⏱ {1} · 🎯 {2}', '挑战 Sumdoku {0}！⏱ {1} · 🎯 {2}', '挑戰 Sumdoku {0}！⏱ {1} · 🎯 {2}', '¡Desafiando Sumdoku {0}! ⏱ {1} · 🎯 {2}', 'Je relève Sumdoku {0} ! ⏱ {1} · 🎯 {2}', 'Sumdoku {0} im Visier! ⏱ {1} · 🎯 {2}'],
    textRank: ['썸도쿠 {0} 랭크: {1} ({2} RP)', 'My Sumdoku {0} rank: {1} ({2} RP)', 'サムドク{0}ランク：{1}（{2} RP）', 'Sumdoku {0} 段位：{1}（{2} RP）', 'Sumdoku {0} 段位：{1}（{2} RP）', 'Mi rango en Sumdoku {0}: {1} ({2} RP)', 'Mon rang Sumdoku {0} : {1} ({2} RP)', 'Mein Sumdoku-{0}-Rang: {1} ({2} RP)'],
    fallbackSaved: ['공유 이미지를 저장했습니다.', 'Share image saved.', '共有画像を保存しました。', '已保存分享图片。', '已儲存分享圖片。', 'Imagen guardada.', 'Image enregistrée.', 'Bild gespeichert.']
  };
  const tx = (k, ...a) => { let s = T[k][li()] || T[k][1]; a.forEach((v, n) => { s = s.split('{' + n + '}').join(v); }); return s; };
  const diffName = d => (window.SumdokuDiffNames?.[d]?.[li()]) || String(d || '').toUpperCase();
  const bridge = () => window.AndroidBridge;
  const R = () => window.SumdokuRating;
  const fmtTime = sec => { sec = Math.max(0, Math.round(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0'); };

  // ---------------- 캔버스 도우미 ----------------
  const W = 1080, H = 1350;
  function svgImage(svg) {
    return new Promise(res => {
      if (!svg) return res(null);
      let s = svg;
      if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    });
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Segoe UI",system-ui,sans-serif';
  function fitText(ctx, text, maxW, size, weight = 900) {
    let s = size;
    do { ctx.font = `${weight} ${s}px ${FONT}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 18);
  }
  function background(ctx, color) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b1020'); g.addColorStop(.55, '#111833'); g.addColorStop(1, '#05070f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 470, 40, W / 2, 470, 620);
    glow.addColorStop(0, color + 'aa'); glow.addColorStop(.45, color + '33'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    // 대각 스트라이프 질감
    ctx.save(); ctx.globalAlpha = .05; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    for (let x = -H; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke(); }
    ctx.restore();
    // 테두리 프레임
    ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = .75; ctx.lineWidth = 6; rr(ctx, 30, 30, W - 60, H - 60, 44); ctx.stroke();
    ctx.globalAlpha = .25; ctx.lineWidth = 2; rr(ctx, 48, 48, W - 96, H - 96, 34); ctx.stroke(); ctx.restore();
  }
  function header(ctx) {
    ctx.fillStyle = '#f8fafc'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `900 54px ${FONT}`; ctx.fillText('SUMDOKU', W / 2, 130);
    ctx.font = `700 28px ${FONT}`; ctx.fillStyle = 'rgba(226,232,240,.7)'; ctx.fillText(tx('tagline'), W / 2, 175);
  }
  function statBox(ctx, x, y, w, h, label, value, color) {
    ctx.save();
    rr(ctx, x, y, w, h, 26); ctx.fillStyle = 'rgba(15,23,42,.72)'; ctx.fill();
    ctx.strokeStyle = color + '88'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(203,213,225,.85)'; ctx.font = `800 28px ${FONT}`; ctx.fillText(label, x + w / 2, y + 50);
    ctx.fillStyle = '#fff'; fitText(ctx, value, w - 30, 56); ctx.fillText(value, x + w / 2, y + 122);
    ctx.restore();
  }
  function footer(ctx) {
    const d = new Date();
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(148,163,184,.8)'; ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`, W / 2, H - 82);
  }

  // ---------------- 카드 생성 ----------------
  async function resultCard(app, data) {
    const rc = app.lastRatingChange;
    const ranked = (app.isDaily || app.isRanked !== false) && !app.isBattle;
    const mode = app.gameMode === 'timeattack' && !app.isDaily ? 'timeattack' : 'standard';
    let tier = rc?.tier || null;
    if (!tier && R()) { try { tier = R().shownTier(R().ladder(R().loadAll(), mode).byDiff[app.difficulty]); } catch (_) {} }
    const color = (ranked && tier?.color) || '#64748b';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    background(ctx, color); header(ctx);
    // 엠블럼
    const em = ranked && tier && R() ? await svgImage(R().tierSymbol(tier.id, 380, tier.division)) : null;
    if (em) ctx.drawImage(em, W / 2 - 190, 215, 380, 380);
    else { ctx.textAlign = 'center'; ctx.font = `400 230px ${FONT}`; ctx.fillText(data?.status === 'win' ? '🏆' : '🧩', W / 2, 500); }
    // 결과 타이틀
    const win = data?.status === 'win';
    ctx.textAlign = 'center';
    ctx.fillStyle = win ? '#fde047' : '#fca5a5'; ctx.font = `900 92px ${FONT}`;
    ctx.shadowColor = color; ctx.shadowBlur = 28; ctx.fillText(tx(win ? 'clear' : 'fail'), W / 2, 700); ctx.shadowBlur = 0;
    const sub = `${app.isDaily ? tx('daily') : tx(mode)} · ${diffName(app.difficulty)}`;
    ctx.fillStyle = '#e2e8f0'; fitText(ctx, sub, W - 200, 44, 800); ctx.fillText(sub, W / 2, 762);
    // 랭크 줄
    let rankLine = tx('normal');
    if (ranked && tier) {
      if (rc && Number.isFinite(rc.after)) rankLine = `${tier.name} · ${Number(rc.after).toLocaleString()} RP${rc.delta ? ` (${rc.delta > 0 ? '+' : ''}${rc.delta})` : ''}`;
      else rankLine = `${tx('ranked')} · ${tier.name}`;
    }
    ctx.fillStyle = ranked ? '#fff' : 'rgba(203,213,225,.85)';
    fitText(ctx, rankLine, W - 200, 40, 800); ctx.fillText(rankLine, W / 2, 822);
    // 지표 4칸
    const secs = mode === 'timeattack' ? Math.max(0, (app.timeLimitTotal || 0) - (app.timeRemaining || 0)) : app.timerSeconds;
    const timeTxt = data?.time || fmtTime(secs);
    const scoreTxt = Number(data?.score ?? app.score ?? 0).toLocaleString();
    const mistTxt = data?.mistakes || `${app.mistakes || 0} / ${app.maxMistakes >= 999999 ? '∞' : app.maxMistakes}`;
    const hintTxt = String(app.hintsUsed || 0);
    const bx = 110, bw = (W - 220 - 30) / 2, bh = 160;
    statBox(ctx, bx, 880, bw, bh, '⏱ ' + tx('time'), timeTxt, color);
    statBox(ctx, bx + bw + 30, 880, bw, bh, '🎯 ' + tx('score'), scoreTxt, color);
    statBox(ctx, bx, 1060, bw, bh, '⚠️ ' + tx('mistakes'), String(mistTxt), color);
    statBox(ctx, bx + bw + 30, 1060, bw, bh, '💡 ' + tx('hints'), hintTxt, color);
    footer(ctx);
    const text = tx(win ? 'textWin' : 'textFail', diffName(app.difficulty), timeTxt, scoreTxt) + (ranked && tier ? ` · ${rankLine}` : '');
    return { url: cv.toDataURL('image/png'), text };
  }

  async function rankCard(app) {
    const r = R(); if (!r) return null;
    const mode = app._rankMode === 'timeattack' ? 'timeattack' : 'standard';
    const all = r.loadAll(), lad = r.ladder(all, mode);
    const diff = app._rankDiff || lad.lastDiff || 'medium';
    const s = lad.byDiff[diff]; const tier = r.shownTier(s);
    const color = s.games ? tier.color : '#64748b';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    background(ctx, color); header(ctx);
    const em = await svgImage(r.tierSymbol(tier.id, 460, tier.division));
    if (em) ctx.drawImage(em, W / 2 - 230, 210, 460, 460);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = color; ctx.shadowBlur = 30;
    fitText(ctx, tier.name, W - 200, 96); ctx.fillText(tier.name, W / 2, 780); ctx.shadowBlur = 0;
    const sub = `${tx(mode)} · ${diffName(diff)}`;
    ctx.fillStyle = '#e2e8f0'; fitText(ctx, sub, W - 200, 44, 800); ctx.fillText(sub, W / 2, 845);
    const unr = tier.id === 'unranked';
    const bx = 110, bw = (W - 220 - 30) / 2, bh = 160;
    statBox(ctx, bx, 885, bw, bh, 'RP', unr ? tx('placement') : Number(s.rating).toLocaleString(), color);
    statBox(ctx, bx + bw + 30, 885, bw, bh, tx('best'), Number(s.peak || s.rating).toLocaleString(), color);
    statBox(ctx, bx, 1060, bw, bh, tx('games'), String(s.games || 0), color);
    statBox(ctx, bx + bw + 30, 1060, bw, bh, '🔥 ' + tx('streak'), String(s.bestStreak || s.streak || 0), color);
    footer(ctx);
    return { url: cv.toDataURL('image/png'), text: tx('textRank', diffName(diff), tier.name, unr ? '-' : s.rating) };
  }

  async function deliver(card, app) {
    if (!card) return;
    const b = bridge();
    if (b?.shareImage) { try { b.shareImage(card.url, card.text); return; } catch (_) {} }
    try {
      const blob = await (await fetch(card.url)).blob();
      const file = new File([blob], 'sumdoku.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: card.text }); return; }
      if (navigator.share) { await navigator.share({ text: card.text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    if (b?.shareText) { b.shareText(card.text); return; }
    const a = document.createElement('a'); a.href = card.url; a.download = 'sumdoku.png'; document.body.append(a); a.click(); a.remove();
    app?.showToast?.(tx('fallbackSaved'));
  }

  let busy = false;
  P.shareResult = async function (data) {
    if (busy) return; busy = true;
    try { this.sound?.play?.('click'); await deliver(await resultCard(this, data || this._lastResultData), this); }
    catch (e) { console.warn('share', e); }
    finally { busy = false; }
  };
  P.shareRank = async function () {
    if (busy) return; busy = true;
    try { this.sound?.play?.('click'); await deliver(await rankCard(this), this); }
    catch (e) { console.warn('share-rank', e); }
    finally { busy = false; }
  };

  // ---------------- 버튼 연결 ----------------
  const baseResult = P.showGameResultModal;
  if (baseResult) P.showGameResultModal = function (data, ...rest) {
    this._lastResultData = data;
    const r = baseResult.call(this, data, ...rest);
    try {
      const host = document.querySelector('#modal-game-result .result-sub-actions');
      let btn = document.getElementById('btn-result-share');
      if (host && !btn) {
        btn = document.createElement('button');
        btn.id = 'btn-result-share'; btn.type = 'button'; btn.className = 'btn btn-secondary btn-result-share';
        btn.addEventListener('click', () => window.app?.shareResult?.());
        host.prepend(btn);
      }
      if (btn) btn.textContent = tx('share');
    } catch (_) {}
    return r;
  };
  const baseCard = P.renderRatingCard;
  if (baseCard) P.renderRatingCard = function (...a) {
    const r = baseCard.apply(this, a);
    try {
      const card = document.getElementById('rating-card');
      if (card && !card.querySelector('.rc-share-row')) {
        const row = document.createElement('div'); row.className = 'rc-share-row';
        const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary rc-share-btn'; b.textContent = tx('shareRank');
        b.addEventListener('click', () => window.app?.shareRank?.());
        row.append(b); card.append(row);
      }
    } catch (_) {}
    return r;
  };

  window.SumdokuShare = { resultCard, rankCard };
})();
