/* v1.1.28 · 결과 화면 랭크 패널 + 엠블럼 재조립 승급
 *
 * - 게임이 끝나면 결과 창에 랭크 패널을 띄웁니다. 태블릿(가로 760px 이상)은 왼쪽, 휴대폰은 가운데.
 *   이전 RP에서 새 RP까지 숫자와 진행 막대가 차오르거나 줄어듭니다.
 * - 같은 티어 안에서 단계가 바뀌면 엠블럼 아래 숫자(IV~I)만 뒤집히듯 바뀝니다.
 * - 티어가 오르면 화면 가운데에서 이전 티어 엠블럼이 조각나 흩어진 뒤,
 *   조각들이 날아와 다음 티어 엠블럼으로 다시 조립됩니다(글자 없음).
 * - 휴대폰 '움직임 줄이기' 설정이면 애니메이션 없이 결과만 보여 줍니다.
 */
(() => {
  const R = window.SumdokuRating;
  if (!R || typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const L = () => Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const T = {
    label: ['랭크 티어', 'Rank tier', 'ランクティア', '段位', '段位', 'Rango', 'Rang', 'Rang'],
    ta: ['타임어택', 'Time Attack', 'タイムアタック', '限时挑战', '限時挑戰', 'Contrarreloj', 'Contre-la-montre', 'Zeitangriff'],
    keep: ['변동 없음', 'No change', '変動なし', '无变化', '無變化', 'Sin cambios', 'Inchangé', 'Unverändert'],
    seriesFail: ['승급전 실패', 'Series lost', '昇格戦失敗', '晋级赛失败', '晉級賽失敗', 'Serie perdida', 'Série perdue', 'Serie verloren'],
    seriesStart: ['승급전 시작', 'Series start', '昇格戦開始', '晋级赛开始', '晉級賽開始', 'Serie iniciada', 'Série lancée', 'Serie beginnt'],
    reveal: ['배치 완료', 'Placement done', '配置完了', '定级完成', '定級完成', 'Clasificación lista', 'Placement terminé', 'Platzierung fertig'],
    promoted: ['TIER PROMOTED', 'TIER PROMOTED', 'TIER PROMOTED', '段位晋升', '段位晉升', 'ASCENSO DE RANGO', 'PROMOTION DE RANG', 'RANGAUFSTIEG'],
    divUp: ['DIVISION UP', 'DIVISION UP', 'DIVISION UP', '阶段提升', '階段提升', 'SUBIDA DE DIVISIÓN', 'DIVISION SUPÉRIEURE', 'DIVISIONS-AUFSTIEG'],
    streak: ['{0}연속 클리어 보너스 +{1}', '{0}-win streak bonus +{1}', '{0}連続クリアボーナス +{1}', '连续通关{0}次奖励 +{1}', '連續通關{0}次獎勵 +{1}', 'Bonus racha {0}: +{1}', 'Bonus série {0} : +{1}', '{0}er-Serienbonus +{1}'],
    battleRank: ['배틀 랭크', 'Battle Rank', 'バトルランク', '对战段位', '對戰段位', 'Rango de batalla', 'Rang de duel', 'Kampf-Rang'],
    battleStreak: ['{0}연승 보너스 +{1}', '{0}-win streak bonus +{1}', '{0}連勝ボーナス +{1}', '{0}连胜奖励 +{1}', '{0}連勝獎勵 +{1}', 'Bonus racha {0}: +{1}', 'Bonus série {0} : +{1}', '{0}er-Siegesserie-Bonus +{1}']
  };
  const t = k => T[k][L()] || T[k][1];
  const tr = s => (window.I18N && typeof I18N.text === 'function' ? I18N.text(s) : s);
  const diffName = d => (window.SumdokuDiffNames && SumdokuDiffNames[d] && SumdokuDiffNames[d][L()]) || d;
  const MODES_NAMES = {
    race: ['⚡ 스피드 레이스', '⚡ Speed race', '⚡ スピードレース', '⚡ 竞速赛', '⚡ 競速賽', '⚡ Carrera', '⚡ Course', '⚡ Wettrennen'],
    score: ['⏱️ 타임어택', '⏱️ Time attack', '⏱️ タイムアタック', '⏱️ 计时赛', '⏱️ 計時賽', '⏱️ Contrarreloj', '⏱️ Contre-la-montre', '⏱️ Zeitangriff'],
    survival: ['🛡️ 서바이벌', '🛡️ Survival', '🛡️ サバイバル', '🛡️ 生存赛', '🛡️ 生存賽', '🛡️ Supervivencia', '🛡️ Survie', '🛡️ Überleben'],
    turn: ['♟️ 턴제', '♟️ Turn-based', '♟️ ターン制', '♟️ 回合制', '♟️ 回合制', '♟️ Por turnos', '♟️ Tour par tour', '♟️ Rundenbasiert']
  };
  const modeName = m => (MODES_NAMES[m] && (MODES_NAMES[m][L()] || MODES_NAMES[m][1])) || m;
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const tierKo = tier => tr(tier.ko);

  /* ---------- 엠블럼 조각 나누기 ----------
   * 조각마다 빈 <g>로 감싸서, 원래 transform(좌우 반전 날개 등)을 건드리지 않고 움직입니다. */
  function piecesOf(svg) {
    const body = svg.querySelector('.te-body');
    const out = [];
    const ns = 'http://www.w3.org/2000/svg';
    const wrapEl = (el, role) => {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'te-piece' + (role ? ' ' + role : ''));
      el.parentNode.insertBefore(g, el);
      g.append(el);
      return g;
    };
    if (body) {
      [...body.children].forEach(el => {
        const cls = el.getAttribute('class') || '';
        const role = cls.includes('te-wing') ? 'te-p-wing'
          : cls.includes('te-shield') ? 'te-p-shield'
          : (cls.includes('te-crown') || cls.includes('te-div-stars')) ? 'te-p-crown'
          : (cls.includes('te-aura') || cls.includes('te-rays')) ? 'te-p-aura'
          : 'te-p-armor';
        out.push(wrapEl(el, role));
      });
    }
    // 아래 명판(단계 숫자)은 한 덩어리로
    const plate = [...svg.children].filter(el => !['defs'].includes(el.tagName) && !el.classList.contains('te-body') && !el.classList.contains('te-spark'));
    if (plate.length) {
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'te-piece te-plate');
      svg.insertBefore(g, plate[0]);
      plate.forEach(el => g.append(el));
      out.push(g);
    }
    return out;
  }
  const centerOf = el => { try { const b = el.getBBox(); return [b.x + b.width / 2, b.y + b.height / 2, Math.max(b.width, b.height)]; } catch (_) { return [50, 46, 20]; } };
  // 중심에서 바깥으로 폭발하는 방향(작은 장식일수록 멀리)
  const scatter = el => {
    const [x, y, sz] = centerOf(el);
    let dx = x - 50, dy = y - 46; const len = Math.hypot(dx, dy);
    if (len < 4) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); } else { dx /= len; dy /= len; }
    const dist = 52 + Math.random() * 44 + Math.max(0, 42 - sz) * .85;
    return { tx: dx * dist + (Math.random() - .5) * 20, ty: dy * dist + (Math.random() - .5) * 20, rot: (Math.random() - .5) * 160, sc: .28 + Math.random() * .38 };
  };
  const anim = (el, frames, opts) => { el.style.transformBox = 'fill-box'; el.style.transformOrigin = 'center'; return el.animate(frames, { fill: 'both', ...opts }); };

  // 배틀그라운드 스타일: 한 번 안쪽으로 강하게 응축(implode)했다가 폭발(shatter)
  function disassemble(svg) {
    const ps = piecesOf(svg);
    return Promise.all(ps.map((g, i) => {
      const s = scatter(g);
      return anim(g, [
        { transform: 'none', opacity: 1, filter: 'brightness(1)' },
        { transform: `translate(${-s.tx * .14}px,${-s.ty * .14}px) scale(.86)`, opacity: 1, filter: 'brightness(2.2)', offset: .24 },
        { transform: `translate(${s.tx * .45}px,${s.ty * .45}px) rotate(${s.rot * .35}deg) scale(1.06)`, opacity: .95, filter: 'brightness(1.8)', offset: .48 },
        { transform: `translate(${s.tx}px,${s.ty}px) rotate(${s.rot}deg) scale(${s.sc})`, opacity: 0, filter: 'brightness(1)' }
      ], { duration: 640, delay: (ps.length - 1 - i) * 14, easing: 'cubic-bezier(.22,.8,.32,1)' }).finished.catch(() => {});
    }));
  }

  // 배틀그라운드 스타일 전술 포징 조립:
  // 1) 배경 아우라/베이스가 팽창하고, 2) 좌우 날개·검이 양옆에서 칼같이 전개되어 꽂히고,
  // 3) 메인 아머 실드와 코어가 위에서 육중하게 내려찍히며(Slam), 4) 상단 크라운과 하단 로마 숫자 명판이 스탬핑됩니다.
  function assemble(svg, total = 1280) {
    const ps = piecesOf(svg);
    const step = Math.min(82, (total - 580) / Math.max(1, ps.length));
    return Promise.all(ps.map((g, i) => {
      const isPlate = g.classList.contains('te-plate');
      const isCrown = g.classList.contains('te-p-crown');
      const isShield = g.classList.contains('te-p-shield');
      const isWing = g.classList.contains('te-p-wing');
      const [cx] = centerOf(g);
      let startFrame, midFrame, delay = i * step, dur = 580;

      if (isPlate) {
        // 하단 명판: 마지막에 위에서 거대한 스케일로 내려찍는 스탬프 연출
        startFrame = { transform: 'translateY(34px) scale(2.1)', opacity: 0, filter: 'brightness(2.5)' };
        midFrame = { transform: 'translateY(-3px) scale(.94)', opacity: 1, filter: 'brightness(1.5)', offset: .72 };
        delay = ps.length * step + 60;
        dur = 520;
      } else if (isCrown) {
        // 상단 왕관/별: 하늘에서 수직 강하 슬램
        startFrame = { transform: 'translateY(-42px) scale(1.8)', opacity: 0, filter: 'brightness(2.2)' };
        midFrame = { transform: 'translateY(2px) scale(.95)', opacity: 1, filter: 'brightness(1.4)', offset: .7 };
        delay = (ps.length - 1) * step;
      } else if (isWing) {
        // 날개: 안쪽에서 접혀 있다가 좌우로 날카롭게 펼쳐짐
        const dir = cx < 50 ? 28 : -28;
        startFrame = { transform: `translateX(${dir}px) scaleX(.2) scaleY(.5)`, opacity: 0, filter: 'brightness(2)' };
        midFrame = { transform: 'translateX(0) scaleX(1.12) scaleY(1.06)', opacity: 1, filter: 'brightness(1.4)', offset: .68 };
      } else if (isShield) {
        // 메인 방패: 정면에서 육중하게 꽂히는 아머 락인
        startFrame = { transform: 'scale(1.85)', opacity: 0, filter: 'brightness(2.2)' };
        midFrame = { transform: 'scale(.92)', opacity: 1, filter: 'brightness(1.4)', offset: .68 };
      } else {
        const s = scatter(g);
        startFrame = { transform: `translate(${s.tx * .85}px,${s.ty * .85}px) rotate(${s.rot * .7}deg) scale(${s.sc})`, opacity: 0, filter: 'brightness(2)' };
        midFrame = { transform: 'scale(1.06)', opacity: 1, filter: 'brightness(1.3)', offset: .65 };
      }
      return anim(g, [
        startFrame,
        midFrame,
        { transform: 'none', opacity: 1, filter: 'brightness(1)' }
      ], { duration: dur, delay, easing: 'cubic-bezier(.18,1.3,.32,1)' }).finished.catch(() => {});
    }));
  }

  /* ---------- 가운데 승급 연출: PUBG 스타일 전술 아머 파쇄 → 메탈 포징 슬램 ---------- */
  function playPromotion(fromTier, toTier) {
    // 이전 버전 호출 형식(tier, big) 호환
    if (typeof toTier === 'boolean' || toTier == null) {
      toTier = fromTier;
      fromTier = R.TIERS[Math.max(0, fromTier.index - 1)] ? R.tierOf(R.TIERS[Math.max(0, fromTier.index - 1)].min) : fromTier;
    }
    document.getElementById('tier-promo')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'tier-promo';
    wrap.className = 'tier-promo big rr-promo';
    wrap.style.setProperty('--tier', fromTier.color);
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-label', toTier.name);
    const size = Math.min(256, Math.round(Math.min(innerWidth, innerHeight) * .56));
    wrap.innerHTML =
      `<div class="rr-pillar"></div>` +
      `<div class="rr-hex-ring"></div>` +
      `<div class="rr-stage" style="width:${size}px;height:${size}px">${R.tierSymbol(fromTier.id, size, fromTier.division)}</div>` +
      `<div class="rr-banner">` +
      `  <div class="rr-b-kicker">${t('promoted')}</div>` +
      `  <div class="rr-b-title"><span class="rr-b-name">${tierKo(toTier)}</span>${toTier.division ? `<span class="rr-b-div">${toTier.division}</span>` : ''}</div>` +
      `  <div class="rr-b-line"></div>` +
      `</div>`;
    document.body.append(wrap);
    const stage = wrap.querySelector('.rr-stage');
    let closed = false, done;
    const finished = new Promise(r => { done = r; });
    const close = () => {
      if (closed) return;
      closed = true;
      wrap.classList.add('out');
      setTimeout(() => { wrap.remove(); done(); }, 360);
    };
    wrap.addEventListener('click', close);
    if (reduced()) {
      wrap.style.setProperty('--tier', toTier.color);
      stage.innerHTML = R.tierSymbol(toTier.id, size, toTier.division);
      wrap.classList.add('forged');
      R.promoSound?.(true, toTier.index);
      setTimeout(close, 1900);
      return finished;
    }
    (async () => {
      const old = stage.querySelector('svg');
      old.animate([{ transform: 'scale(.55)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'both' });
      R.promoSound?.(true, toTier.index, 'charge');
      await wait(480); if (closed) return;

      // 1단계: 고열 에너지 과부하 진동 + 아머 균열 플래시
      old.animate([
        { transform: 'translate(0,0) scale(1)', filter: 'brightness(1)' },
        { transform: 'translate(-3px,2px) rotate(-2deg) scale(1.03)', filter: 'brightness(1.4)' },
        { transform: 'translate(3px,-2px) rotate(2deg) scale(1.06)', filter: 'brightness(1.8)' },
        { transform: 'translate(-4px,-1px) rotate(-1.5deg) scale(1.08)', filter: 'brightness(2.3)' },
        { transform: 'translate(0,0) scale(.94)', filter: 'brightness(2.8)' }
      ], { duration: 420, iterations: 1 });
      stage.insertAdjacentHTML('beforeend', '<i class="rr-flash"></i>');
      await wait(380); if (closed) return;

      // 2단계: 구 티어 아머 파쇄 폭발
      R.promoSound?.(true, toTier.index, 'shatter');
      wrap.style.setProperty('--tier', toTier.color);
      wrap.classList.add('charging');
      await disassemble(old); if (closed) return;
      old.remove();

      // 3단계: 신규 티어 전술 포징 조립 (날개 전개 → 방패 결합 → 명판 스탬프)
      stage.insertAdjacentHTML('afterbegin', R.tierSymbol(toTier.id, size, toTier.division));
      const nsvg = stage.querySelector('svg');
      const asmPromise = assemble(nsvg, 1180);
      await wait(680); if (closed) return;

      // 4단계: 최종 락인 슬램(Slam) — 카메라 셰이크 + 이중 쇼크웨이브 + 용접 불꽃 파티클 + 배너 등장
      R.promoSound?.(true, toTier.index, 'slam');
      wrap.classList.remove('charging');
      wrap.classList.add('forged');
      let parts = '';
      for (let i = 0; i < 38; i++) {
        const ang = Math.round(Math.random() * 360);
        const dist = Math.round(size * .46 + Math.random() * size * .62);
        const dl = (Math.random() * .16).toFixed(2);
        const ember = i % 3 === 0 ? ' ember' : '';
        parts += `<i class="${ember}" style="--a:${ang}deg;--d:${dist}px;--dl:${dl}s"></i>`;
      }
      wrap.insertAdjacentHTML('afterbegin', `<div class="tp-burst"></div><div class="tp-shockwave"></div><div class="tp-shockwave s2"></div><div class="tp-parts">${parts}</div>`);
      wrap.animate([
        { transform: 'translate(0,0)' },
        { transform: 'translate(-6px,5px)' },
        { transform: 'translate(6px,-4px)' },
        { transform: 'translate(-4px,-3px)' },
        { transform: 'translate(3px,2px)' },
        { transform: 'translate(0,0)' }
      ], { duration: 360, easing: 'ease-out' });
      nsvg.animate([
        { transform: 'scale(1.18)', filter: 'brightness(2.1)' },
        { transform: 'scale(.95)', filter: 'brightness(1.3)', offset: .55 },
        { transform: 'scale(1)', filter: 'brightness(1)' }
      ], { duration: 480, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      await asmPromise; if (closed) return;
      await wait(2200);
      close();
    })();
    return finished;
  }
  R.playPromotion = playPromotion;

  /* ---------- 결과 창 랭크 패널 ---------- */
  function ensurePanel(isBattle) {
    if (isBattle) {
      const card = document.querySelector('#modal-battle-result .modal-battle-card');
      if (!card) return null;
      let panel = document.getElementById('rr-battle-panel');
      if (!panel) {
        panel = document.createElement('section');
        panel.id = 'rr-battle-panel'; panel.className = 'rr-panel rr-battle-panel';
        panel.innerHTML = '<div class="rr-emblem"></div><div class="rr-info"><div class="rr-label"></div>' +
          '<div class="rr-tier"><span class="rr-name"></span><span class="rr-div"></span></div>' +
          '<div class="rr-bar"><i></i></div><div class="rr-rp"><b class="rr-val"></b><span class="rr-unit">RP</span><span class="rr-delta"></span></div>' +
          '<div class="rr-note"></div><div class="rr-season"></div></div>';
        const banner = card.querySelector('#battle-result-banner');
        if (banner) banner.after(panel); else card.prepend(panel);
      }
      return { card, panel };
    }
    const card = document.querySelector('#modal-game-result .modal-game-result-card');
    if (!card) return null;
    let panel = document.getElementById('rr-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'rr-panel'; panel.className = 'rr-panel';
      panel.innerHTML = '<div class="rr-emblem"></div><div class="rr-info"><div class="rr-label"></div>' +
        '<div class="rr-tier"><span class="rr-name"></span><span class="rr-div"></span></div>' +
        '<div class="rr-bar"><i></i></div><div class="rr-rp"><b class="rr-val"></b><span class="rr-unit">RP</span><span class="rr-delta"></span></div>' +
        '<div class="rr-note"></div><div class="rr-season"></div></div>';
      const banner = card.querySelector('.result-banner');
      if (banner) banner.after(panel); else card.prepend(panel);
    }
    return { card, panel };
  }

  function paint(panel, rating, emblemTier) {
    const tier = R.tierOf(rating);
    const shown = emblemTier || tier;
    panel.style.setProperty('--tier', shown.color);
    panel.querySelector('.rr-name').textContent = tierKo(shown);
    panel.querySelector('.rr-div').textContent = shown.division ? ' ' + shown.division : '';
    panel.querySelector('.rr-val').textContent = Math.round(rating).toLocaleString();
    const pct = tier.divMax ? Math.max(0, Math.min(100, (rating - tier.divMin) / (tier.divMax - tier.divMin) * 100)) : 100;
    panel.querySelector('.rr-bar i').style.width = pct.toFixed(1) + '%';
  }
  const emblemSize = isBattle => (isBattle ? (matchMedia('(min-width: 760px)').matches ? 140 : 108) : (matchMedia('(min-width: 760px)').matches ? 196 : 126));
  function setEmblem(panel, tier, isBattle) {
    const box = panel.querySelector('.rr-emblem');
    box.innerHTML = R.tierSymbol(tier.id, emblemSize(isBattle), tier.division);
    box.dataset.key = tier.id + tier.division;
    return box.querySelector('svg');
  }
  // 단계(V→IV→III→II→I) 승급: PUBG 스타일 메탈 스탬프 락인 + 상단 별 점등 + 미니 쇼크웨이브
  function flipDivision(panel, tier, up, isBattle) {
    const box = panel.querySelector('.rr-emblem');
    const svg = setEmblem(panel, tier, isBattle);
    const plate = svg.querySelector('.te-plate') || svg.querySelector('text');
    const stars = svg.querySelector('.te-div-stars');
    if (!reduced()) {
      if (plate) {
        plate.style.transformBox = 'fill-box';
        plate.style.transformOrigin = 'center';
        plate.animate([
          { transform: up ? 'translateY(14px) scale(1.85)' : 'translateY(-8px) scale(.8)', opacity: 0, filter: 'brightness(2.4)' },
          { transform: 'translateY(-2px) scale(.93)', opacity: 1, filter: 'brightness(1.5)', offset: .65 },
          { transform: 'none', opacity: 1, filter: 'brightness(1)' }
        ], { duration: 460, easing: 'cubic-bezier(.18,1.35,.35,1)' });
      }
      if (stars && up) {
        stars.style.transformBox = 'fill-box';
        stars.style.transformOrigin = 'center';
        stars.animate([
          { transform: 'translateY(-10px) scale(1.7)', opacity: 0, filter: 'brightness(2.5)' },
          { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }
        ], { duration: 480, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      }
      if (up) {
        const wave = document.createElement('i');
        wave.className = 'rr-div-wave';
        box.append(wave);
        setTimeout(() => wave.remove(), 650);
      }
      box.animate([
        { transform: 'scale(1)', filter: `drop-shadow(0 0 0 ${tier.color})` },
        { transform: up ? 'scale(1.1)' : 'scale(.95)', filter: `drop-shadow(0 0 22px ${tier.color}) brightness(1.35)`, offset: .4 },
        { transform: 'scale(1)', filter: `drop-shadow(0 0 0 ${tier.color})` }
      ], { duration: 620, easing: 'ease-out' });
    }
    if (up) R.promoSound?.(false, tier.index);
  }

  async function runPanel(app, ch, isBattle) {
    isBattle = !!(isBattle || ch?.ladder === 'battle' || ch?.isBattle || app?.isBattle);
    const nodes = ensurePanel(isBattle); if (!nodes) return;
    const { card, panel } = nodes;
    card.classList.add('has-rank');
    panel.classList.remove('hidden');
    const label = isBattle
      ? `${t('battleRank')} · ${modeName(ch.battleMode || ch.mode)} · ${diffName(ch.difficulty)}`
      : `${t('label')} · ${ch.mode === 'timeattack' ? t('ta') + ' ' : ''}${diffName(ch.difficulty)}`;
    panel.querySelector('.rr-label').textContent = label;
    const d = panel.querySelector('.rr-delta');
    d.className = 'rr-delta' + (ch.delta > 0 ? ' up' : ch.delta < 0 ? ' down' : '');
    d.textContent = ch.delta ? `${ch.delta > 0 ? '+' : '−'}${Math.abs(ch.delta)} RP` : t('keep');
    const streakFmt = isBattle ? t('battleStreak') : t('streak');
    panel.querySelector('.rr-note').textContent = ch.bonus ? streakFmt.replace('{0}', ch.streak).replace('{1}', ch.bonus) : '';
    // ---- 시즌 정보(배치·승급전·보호·가속) ----
    const se = ch.season || {};
    let chips = panel.querySelector('.rr-season');
    if (!chips) { chips = document.createElement('div'); chips.className = 'rr-season'; panel.querySelector('.rr-info').append(chips); }
    chips.innerHTML = '';
    const chip = (cls, text) => { const c = document.createElement('span'); c.className = 'rr-chip ' + cls; c.textContent = text; chips.append(c); };
    if (se.placing) chip('place', `${tr('배치 경기')} ${se.placementDone} / ${R.PLACEMENT}`);
    if (se.seriesResult === 'start') chip('series', t('seriesStart'));
    if (se.series) chip('series', `${tr('승급전')} ${'●'.repeat(se.series.w)}${'✕'.repeat(se.series.l)}${'○'.repeat(Math.max(0, 3 - se.series.w - se.series.l))}`);
    if (se.seriesResult === 'lost') chip('series', t('seriesFail'));
    if (se.protectedHit || se.protect > 0) chip('protect', `🛡 ${tr('강등 보호')}${se.protect ? ' ' + se.protect + tr('판') : ''}`);
    if (se.boosted) chip('boost', `⚡ ${tr('시즌 초반 가속')} +25%`);
    const token = (app._rrToken = (app._rrToken || 0) + 1);
    const unrankedOf = done => ({ ...R.UNRANKED, index: -1, division: `${done}/${R.PLACEMENT}`, name: tr(R.UNRANKED.ko) });
    const paintUnranked = done => {
      const u = unrankedOf(done);
      panel.style.setProperty('--tier', u.color);
      setEmblem(panel, u, isBattle);
      panel.querySelector('.rr-name').textContent = u.name;
      panel.querySelector('.rr-div').textContent = '';
      panel.querySelector('.rr-val').textContent = '?';
      panel.querySelector('.rr-bar i').style.width = (done / R.PLACEMENT * 100).toFixed(1) + '%';
      return u;
    };
    if (se.placing && !se.revealed) {
      // 배치 중: RP는 숨기고 언랭크 엠블럼과 진행만 보여 줍니다.
      d.className = 'rr-delta'; d.textContent = '';
      paintUnranked(se.placementDone - 1);
      if (!reduced()) { await wait(500); if (token !== app._rrToken) return; }
      const u = paintUnranked(se.placementDone);
      if (!reduced()) { const tx = panel.querySelector('.rr-emblem text:last-of-type'); tx?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); }
      return;
    }
    if (se.revealed) {
      // 배치 완료: 언랭크 엠블럼이 분해되어 첫 티어로 재조립됩니다.
      chip('place', t('reveal'));
      const u = paintUnranked(R.PLACEMENT - 1);
      d.className = 'rr-delta'; d.textContent = '';
      const end = R.tierOf(ch.after);
      if (!reduced()) { await wait(700); if (token !== app._rrToken) return; await playPromotion(u, end); }
      setEmblem(panel, end, isBattle); paint(panel, ch.after, end);
      return;
    }
    let cur = R.tierOf(ch.before);
    setEmblem(panel, cur, isBattle);
    paint(panel, ch.before, cur);
    if (!ch.delta) return;
    if (reduced()) { const end = R.tierOf(ch.after); setEmblem(panel, end, isBattle); paint(panel, ch.after, end); return; }
    await wait(650);
    // RP를 한 칸씩 세며 단계·티어 변화를 반영합니다.
    const dur = Math.min(1600, 500 + Math.abs(ch.delta) * 14);
    let from = ch.before;
    const to = ch.after;
    while (token === app._rrToken) {
      const reached = await new Promise(resolve => {
        const start = performance.now(), span = to - from;
        const f0 = from;
        const frame = now => {
          if (token !== app._rrToken) return resolve(null);
          const k = Math.min(1, (now - start) / (dur * Math.abs(span) / Math.abs(to - ch.before) || 1));
          const v = f0 + span * (1 - Math.pow(1 - k, 2));
          const vt = R.tierOf(v);
          if (vt.index !== cur.index || vt.division !== cur.division) return resolve({ v, vt });
          paint(panel, v, cur);
          if (k >= 1) return resolve({ v: to, vt: R.tierOf(to), end: true });
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      if (!reached) return;
      const { v, vt } = reached;
      if (vt.index > cur.index) {
        // 티어 승급: 패널은 잠시 멈추고 가운데에서 재조립 연출
        paint(panel, Math.ceil(v), cur);
        await playPromotion(cur, vt);
        setEmblem(panel, vt, isBattle);
        panel.querySelector('.rr-emblem').animate([{ transform: 'scale(.7)', opacity: .3 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      } else if (vt.index < cur.index) {
        setEmblem(panel, vt, isBattle);
        panel.querySelector('.rr-emblem').animate([{ transform: 'translateY(-6px)', filter: 'grayscale(1)' }, { transform: 'none', filter: 'grayscale(0)' }], { duration: 500 });
      } else if (vt.division !== cur.division) {
        flipDivision(panel, vt, vt.divMin > cur.divMin, isBattle);
      }
      cur = vt;
      paint(panel, v, cur);
      if (reached.end) break;
      from = v;
      await wait(vt.index !== R.tierOf(from).index ? 0 : 220);
    }
  }

  R.runBattleResult = function (app, ch) {
    if (app && ch) runPanel(app, ch, true);
  };

  const origHandleBattleEnd = P.handleBattleEnd;
  P.handleBattleEnd = function (...args) {
    const r = origHandleBattleEnd.apply(this, args);
    try {
      const ch = this.lastBattleRatingChange;
      const card = document.querySelector('#modal-battle-result .modal-battle-card');
      if (ch && !ch._shown) {
        ch._shown = true;
        runPanel(this, ch, true);
      } else if (!ch) {
        this._rrToken = (this._rrToken || 0) + 1;
        document.getElementById('rr-battle-panel')?.classList.add('hidden');
        card?.classList.remove('has-rank');
      }
    } catch (e) { console.warn('rank-result battle', e); }
    return r;
  };

  const show = P.showGameResultModal;
  P.showGameResultModal = function (data, ...rest) {
    const r = show.call(this, data, ...rest);
    try {
      const ch = this.lastRatingChange;
      const card = document.querySelector('#modal-game-result .modal-game-result-card');
      if (ch && !ch._shown && !this.isBattle) { ch._shown = true; runPanel(this, ch, false); }
      else { this._rrToken = (this._rrToken || 0) + 1; document.getElementById('rr-panel')?.classList.add('hidden'); card?.classList.remove('has-rank'); }
    } catch (e) { console.warn('rank-result', e); }
    return r;
  };
})();
