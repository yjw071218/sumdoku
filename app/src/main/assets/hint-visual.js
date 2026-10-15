/* v1.1.18 · 힌트 과정을 보드 위에 그립니다.
 *
 * 기존 힌트는 "3행 5열" 같은 좌표 문장만 보여 줘서 판과 번갈아 보며 위치를 찾아야 했습니다.
 * 힌트 엔진(human-hint.js)이 문장마다 함께 만든 시각화 정보(steps[k].viz)를 받아
 * 보드 위 SVG 오버레이에 단계별로 표시합니다.
 *
 *   - 영역 테두리   : 지금 보고 있는 행·열·박스·케이지를 굵은 점선으로 감쌉니다(보조 영역은 옅은 점선).
 *   - 근거 칸       : 이유가 되는 칸을 파랗게 칠합니다.
 *   - 대상 칸       : 확정할 칸을 주황 테두리로 표시합니다.
 *   - 칸 안 작은 숫자: 지워지는 후보(빨간 취소선), 남은 후보(파랑), 확정 숫자(초록)를 해당 칸 위치에 씁니다.
 *   - 화살표        : 근거 칸에서 영향을 받는 칸으로 이어 줍니다.
 *   - 짧은 라벨     : Σ15, 45 − 38 = 7 처럼 숫자·기호만 써서 번역 없이 모든 언어에서 읽힙니다.
 *
 * 단계 목록의 항목을 누르거나 ‹ › 버튼(키보드 ←/→)으로 단계를 넘깁니다.
 * 오버레이는 pointer-events:none 이라 칸 선택·입력을 막지 않습니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (name, attrs = {}, parent) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  let state = null; // { steps, index, target }

  const frame = () => document.getElementById('board-frame');
  const board = () => document.getElementById('sudoku-board');

  /* 셀 좌표: 실제 셀 DOM 의 위치를 재서 테두리 두께·여백이 달라도 정확히 맞춥니다. */
  const geometry = () => {
    const f = frame(), b = board();
    if (!f || !b) return null;
    const fr = f.getBoundingClientRect();
    const cells = new Array(81);
    b.querySelectorAll('.cell[data-r][data-c]').forEach(c => {
      const r = +c.dataset.r, col = +c.dataset.c, rect = c.getBoundingClientRect();
      cells[r * 9 + col] = { x: rect.left - fr.left - f.clientLeft, y: rect.top - fr.top - f.clientTop, w: rect.width, h: rect.height };
    });
    if (cells.some(c => !c)) return null;
    return { w: f.clientWidth, h: f.clientHeight, cells };
  };

  const ensureSvg = () => {
    let svg = document.getElementById('hint-visual-layer');
    if (!svg) {
      svg = el('svg', { id: 'hint-visual-layer', 'aria-hidden': 'true' });
      const defs = el('defs', {}, svg);
      const mk = el('marker', { id: 'hv-arrow', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L10,5 L0,10 z', class: 'hv-arrow-head' }, mk);
      frame()?.appendChild(svg);
    }
    return svg;
  };

  /* 칸 집합의 바깥 테두리만 선으로 잇습니다(행·열·박스·모양이 불규칙한 케이지 모두). */
  const outlinePath = (set, g, inset) => {
    const has = i => set.has(i);
    let d = '';
    set.forEach(i => {
      const r = Math.floor(i / 9), c = i % 9, b = g.cells[i];
      const x0 = b.x + inset, y0 = b.y + inset, x1 = b.x + b.w - inset, y1 = b.y + b.h - inset;
      const up = r > 0 && has(i - 9), down = r < 8 && has(i + 9), left = c > 0 && has(i - 1), right = c < 8 && has(i + 1);
      const X0 = left ? b.x : x0, X1 = right ? b.x + b.w : x1, Y0 = up ? b.y : y0, Y1 = down ? b.y + b.h : y1;
      if (!up) d += `M${X0},${y0}H${X1}`;
      if (!down) d += `M${X0},${y1}H${X1}`;
      if (!left) d += `M${x0},${Y0}V${Y1}`;
      if (!right) d += `M${x1},${Y0}V${Y1}`;
    });
    return d;
  };

  const center = (g, i) => { const b = g.cells[i]; return [b.x + b.w / 2, b.y + b.h / 2]; };
  // 후보 숫자 d 의 칸 안 위치(3×3 미니 격자)
  const candPos = (g, i, d) => { const b = g.cells[i]; const k = d - 1; return [b.x + b.w * ((k % 3) + 0.5) / 3, b.y + b.h * (Math.floor(k / 3) + 0.5) / 3]; };
  const pos = i => `${Math.floor(i / 9) + 1}행 ${i % 9 + 1}열`;

  /* v1.1.18 · 메모(후보 표시) 연동
     후보 숫자가 필요한 단계에서 사용자의 메모를 확인합니다.
       메모가 있으면   → 그 메모 자리를 초록 고리로 강조
       메모가 없으면   → 그 자리에 굵은 주황 숫자 + 점선 고리로 "적어 둘 메모"를 표시
       지워질 후보가 메모에 있으면 → 빨간 고리 + 취소선으로 "지울 메모" 표시 */
  const cellOf = i => window.app && app.board && app.board[Math.floor(i / 9)] && app.board[Math.floor(i / 9)][i % 9];
  const hasNote = (i, d) => { const c = cellOf(i); return !!(c && !c.val && c.notes && typeof c.notes.has === 'function' && c.notes.has(d)); };
  const isEmpty = i => { const c = cellOf(i); return !!c && !c.val; };
  const memoNeeds = v => {
    const by = new Map();
    ((v && v.digits) || []).forEach(({ i, d, k }) => {
      if (k !== 'cand' || !isEmpty(i)) return;
      const e = by.get(i) || { i, ds: [] }; if (!e.ds.includes(d)) e.ds.push(d); by.set(i, e);
    });
    return [...by.values()].map(e => ({ ...e, have: e.ds.filter(d => hasNote(e.i, d)), miss: e.ds.filter(d => !hasNote(e.i, d)) }));
  };
  const memoErase = v => ((v && v.digits) || []).filter(({ i, d, k }) => k === 'elim' && hasNote(i, d));

  const draw = () => {
    const svg = document.getElementById('hint-visual-layer');
    if (!state || !svg) return;
    const g = geometry();
    if (!g) return;
    svg.setAttribute('viewBox', `0 0 ${g.w} ${g.h}`);
    svg.setAttribute('width', g.w); svg.setAttribute('height', g.h);
    svg.querySelectorAll(':scope > g').forEach(n => n.remove());
    const step = state.steps[state.index];
    const v = (step && step.viz) || { area: [], area2: [], src: [], target: null, digits: [], arrows: [], labels: [] };
    const root = el('g', { class: 'hv-root' + (reduceMotion() ? '' : ' hv-animate') }, svg);
    const cw = g.cells[0].w;

    // 1) 근거 칸 음영
    (v.src || []).forEach(i => { const b = g.cells[i]; el('rect', { x: b.x + 1, y: b.y + 1, width: b.w - 2, height: b.h - 2, rx: 3, class: 'hv-src' }, root); });
    // 2) 영역 테두리 (보조 → 주)
    if (v.area2 && v.area2.length) el('path', { d: outlinePath(new Set(v.area2), g, cw * 0.06), class: 'hv-area2' }, root);
    if (v.area && v.area.length) el('path', { d: outlinePath(new Set(v.area), g, cw * 0.12), class: 'hv-area' }, root);
    // 3) 대상 칸 (확정할 칸). 대상이 없는 단계에서도 어디를 향하는지 옅게 표시
    const tgt = v.target !== null && v.target !== undefined ? v.target : v.focus;
    if (tgt !== null && tgt !== undefined) {
      const b = g.cells[tgt];
      el('rect', { x: b.x + 2, y: b.y + 2, width: b.w - 4, height: b.h - 4, rx: 5, class: v.target === tgt ? 'hv-target' : 'hv-focus' }, root);
    }
    // 4) 화살표
    (v.arrows || []).forEach(([a, bIdx]) => {
      const [x1, y1] = center(g, a), [x2, y2] = center(g, bIdx);
      const len = Math.hypot(x2 - x1, y2 - y1); if (!len) return;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len, pad = cw * 0.32;
      el('line', { x1: x1 + ux * pad, y1: y1 + uy * pad, x2: x2 - ux * pad, y2: y2 - uy * pad, class: 'hv-arrow', 'marker-end': 'url(#hv-arrow)' }, root);
    });
    // 5) 칸 안 작은 숫자
    const fs = Math.max(9, cw * 0.31);
    (v.digits || []).forEach(({ i, d, k }) => {
      if (k === 'ans') {
        const [x, y] = center(g, i);
        el('circle', { cx: x, cy: y, r: cw * 0.34, class: 'hv-ans-bg' }, root);
        const t = el('text', { x, y, class: 'hv-ans', 'font-size': cw * 0.5 }, root); t.textContent = d;
        return;
      }
      const [x, y] = candPos(g, i, d);
      const note = hasNote(i, d);
      if (k === 'cand' && isEmpty(i)) {
        if (note) {
          // 사용자의 메모가 이미 있음 → 그 자리를 강조
          el('circle', { cx: x, cy: y, r: fs * 0.7, class: 'hv-note-have' }, root);
          const t = el('text', { x, y, class: 'hv-cand hv-cand-have', 'font-size': fs }, root); t.textContent = d;
        } else {
          // 메모가 없음 → 굵은 글씨로 써 줌
          el('circle', { cx: x, cy: y, r: fs * 0.72, class: 'hv-note-need-bg' }, root);
          el('circle', { cx: x, cy: y, r: fs * 0.72, class: 'hv-note-need' }, root);
          const t = el('text', { x, y, class: 'hv-cand-need', 'font-size': fs * 1.12 }, root); t.textContent = d;
        }
        return;
      }
      el('circle', { cx: x, cy: y, r: fs * 0.62, class: k === 'elim' ? 'hv-elim-bg' : 'hv-cand-bg' }, root);
      if (k === 'elim' && note) el('circle', { cx: x, cy: y, r: fs * 0.72, class: 'hv-note-erase' }, root);
      const t = el('text', { x, y, class: k === 'elim' ? 'hv-elim' : 'hv-cand', 'font-size': fs }, root); t.textContent = d;
      if (k === 'elim') el('line', { x1: x - fs * 0.5, y1: y + fs * 0.42, x2: x + fs * 0.5, y2: y - fs * 0.42, class: 'hv-strike' }, root);
    });
    // 6) 라벨: 칸 위쪽(맨 윗줄이면 아래쪽)에 말풍선처럼 띄우고 보드 밖으로 나가지 않게 맞춥니다.
    const placed = [];
    (v.labels || []).forEach(({ i, t }) => {
      const b = g.cells[i];
      const lfs = Math.max(10, cw * 0.3), h = lfs * 1.55;
      const text = el('text', { class: 'hv-label', 'font-size': lfs }, root); text.textContent = t;
      let w; try { w = text.getComputedTextLength() + lfs * 0.9; } catch (_) { w = t.length * lfs * 0.62 + lfs * 0.9; }
      let x = b.x + b.w / 2 - w / 2, y = Math.floor(i / 9) === 0 ? b.y + b.h + 2 : b.y - h - 2;
      x = Math.max(2, Math.min(g.w - w - 2, x)); y = Math.max(2, Math.min(g.h - h - 2, y));
      // 라벨끼리 겹치면 아래로 비켜 놓습니다.
      for (const q of placed) if (x < q.x + q.w && q.x < x + w && y < q.y + q.h && q.y < y + h) y = Math.min(g.h - h - 2, q.y + q.h + 2);
      placed.push({ x, y, w, h });
      const pill = el('rect', { x, y, width: w, height: h, rx: h / 2, class: 'hv-label-bg' }, root);
      root.insertBefore(pill, text);
      text.setAttribute('x', x + w / 2); text.setAttribute('y', y + h / 2);
    });
  };

  /* 카드 안 메모 안내: 이 단계에서 필요한 메모와 지울 메모를 굵게 보여 줍니다. */
  const memoBox = v => {
    const needs = memoNeeds(v), erase = memoErase(v);
    if (!needs.length && !erase.length) return null;
    const box = document.createElement('div');
    box.className = 'hv-memo';
    const head = document.createElement('div'); head.className = 'hv-memo-head'; head.textContent = '✎ 메모 확인'; box.append(head);
    const row = (i, ds, cls, text) => {
      const r = document.createElement('div'); r.className = 'hv-memo-row ' + cls;
      const a = document.createElement('span'); a.className = 'hv-memo-pos'; a.textContent = pos(i);
      const b = document.createElement('b'); b.className = 'hv-memo-ds'; b.textContent = ds.join('·');
      const c = document.createElement('span'); c.className = 'hv-memo-st'; c.textContent = text;
      r.append(a, b, c); box.append(r);
    };
    needs.forEach(n => row(n.i, n.ds, n.miss.length ? 'miss' : 'have',
      !n.miss.length ? '✓ 메모 있음' : !n.have.length ? '메모 없음 — 적어 두세요' : `${n.miss.join('·')} 메모 추가 필요`));
    const by = new Map(); erase.forEach(({ i, d }) => { const a = by.get(i) || []; a.push(d); by.set(i, a); });
    by.forEach((ds, i) => row(i, ds, 'erase', '메모에서 지우기'));
    return box;
  };

  /* "자세히": 요약된 단계의 근거를 펼쳐 보여 줍니다. */
  const attachDetail = (li, k, detail) => {
    if (!detail || !detail.length || li.querySelector('.hv-more')) return;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'hv-more'; btn.textContent = '자세히';
    btn.setAttribute('aria-expanded', 'false');
    const list = document.createElement('ul'); list.className = 'hv-detail'; list.hidden = true;
    detail.forEach(t => {
      const item = document.createElement('li');
      item.textContent = t;
      if (/^✓/.test(t)) item.className = 'ok'; else if (/^✗/.test(t)) item.className = 'no';
      list.append(item);
    });
    btn.onclick = e => {
      e.stopPropagation();
      const open = list.hidden;
      list.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? '접기' : '자세히';
      if (state && state.index !== k) go(k, true);
      if (open) requestAnimationFrame(() => {
        const box = document.getElementById('hint-logic-text');
        if (!box) return;
        const top = list.offsetTop - box.offsetTop, bottom = top + list.offsetHeight;
        if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = Math.min(top - 40, bottom - box.clientHeight + 4);
      });
    };
    list.onclick = e => e.stopPropagation();
    li.append(btn, list);
  };

  /* 단계 목록·이동 버튼 */
  const renderControls = () => {
    const box = document.getElementById('hint-logic-text');
    if (!box || !state) return;
    const list = box.querySelector('ol.hint-steps');
    box.querySelectorAll('.hv-memo').forEach(n => n.remove());
    if (list) list.querySelectorAll(':scope > li').forEach((li, k) => {
      li.classList.toggle('hv-active', k === state.index);
      li.setAttribute('aria-current', k === state.index ? 'step' : 'false');
      if (k === state.index) {
        const memo = memoBox(state.steps[k] && state.steps[k].viz);
        if (memo) li.insertBefore(memo, li.querySelector('.hv-more') || null);
      }
    });
    const concl = box.querySelector('.hint-conclusion');
    concl?.classList.toggle('hv-active', state.index === state.conclusionIndex);
    const counter = document.getElementById('hv-counter');
    if (counter) counter.textContent = `${state.index + 1} / ${state.steps.length}`;
    const prev = document.getElementById('hv-prev'), next = document.getElementById('hv-next');
    if (prev) prev.disabled = state.index === 0;
    if (next) next.disabled = state.index === state.steps.length - 1;
    const active = list?.querySelectorAll(':scope > li')[state.index] || (state.index === state.conclusionIndex ? concl : null);
    if (active) {
      // 목록 상자 안에서만 스크롤해 화면 전체가 흔들리지 않게 합니다.
      const top = active.offsetTop - box.offsetTop, bottom = top + active.offsetHeight;
      if (top < box.scrollTop) box.scrollTop = top - 4;
      else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 4;
    }
  };

  /* 작은 화면에서는 힌트 카드를 보이게 하려고 보드 위쪽이 화면 밖으로 밀려날 수 있습니다.
     사용자가 단계를 넘길 때, 그 단계가 가리키는 칸이 화면 밖이면 그만큼만 스크롤해 보여 줍니다. */
  const revealStep = () => {
    const v = state && state.steps[state.index] && state.steps[state.index].viz;
    if (!v) return;
    const ids = [...(v.area || []), ...(v.src || []), ...(v.digits || []).map(d => d.i), ...(v.labels || []).map(l => l.i)];
    if (v.target !== null && v.target !== undefined) ids.push(v.target);
    if (!ids.length) return;
    const rects = [...new Set(ids)].map(i => document.querySelector(`#sudoku-board .cell[data-r="${Math.floor(i / 9)}"][data-c="${i % 9}"]`)?.getBoundingClientRect()).filter(Boolean);
    if (!rects.length) return;
    const top = Math.min(...rects.map(r => r.top)), bottom = Math.max(...rects.map(r => r.bottom));
    // 보드를 실제로 스크롤하는 조상(overflow auto/scroll + 넘침)을 찾습니다.
    let scroller = board()?.parentElement;
    while (scroller && scroller !== document.body) {
      const oy = getComputedStyle(scroller).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && scroller.scrollHeight > scroller.clientHeight + 1) break;
      scroller = scroller.parentElement;
    }
    if (!scroller || scroller === document.body) scroller = document.scrollingElement;
    const card = document.getElementById('floating-hint-card')?.getBoundingClientRect();
    const limit = card && card.top > 0 ? card.top : innerHeight;
    let dy = 0;
    if (top < 8) dy = top - 8;                              // 위로 잘림 → 위로 스크롤
    else if (bottom > limit - 4) dy = Math.min(bottom - limit + 4, top - 8); // 카드에 가림 → 아래로
    if (Math.abs(dy) > 1) scroller.scrollBy({ top: dy, behavior: reduceMotion() ? 'auto' : 'smooth' });
  };

  const go = (k, user = true) => {
    if (!state) return;
    state.index = Math.max(0, Math.min(state.steps.length - 1, k));
    draw(); renderControls();
    if (user) revealStep();
  };

  const clear = () => {
    state = null;
    document.getElementById('hint-visual-layer')?.remove();
    document.getElementById('hv-nav')?.remove();
    document.body.classList.remove('hint-visual-on');
  };

  const show = p.showImmediateHint;
  p.showImmediateHint = function () {
    clear();
    show.call(this);
    const h = this.pendingHint, card = this.dom.floatingHintCard;
    if (!h || !card || card.classList.contains('hidden') || !Array.isArray(h.steps) || !h.steps.length) return;
    const box = this.dom.hintLogicText;
    const list = box.querySelector('ol.hint-steps');
    const concl = box.querySelector('.hint-conclusion');
    // 마지막 단계(정답 확정)는 결론 문장과 같은 그림을 씁니다.
    const steps = h.steps.slice();
    const conclusionViz = { area: [], area2: [], src: [], target: h.r * 9 + h.c, digits: [{ i: h.r * 9 + h.c, d: h.answer, k: 'ans' }], arrows: [], labels: [{ i: h.r * 9 + h.c, t: `= ${h.answer}` }] };
    const hasConclusionStep = steps.length && steps[steps.length - 1].viz && steps[steps.length - 1].viz.target === h.r * 9 + h.c
      && (steps[steps.length - 1].viz.digits || []).some(x => x.k === 'ans');
    if (!hasConclusionStep) steps.push({ text: concl ? concl.textContent : '', viz: conclusionViz, conclusion: true });
    state = { steps, index: 0, conclusionIndex: hasConclusionStep ? -1 : steps.length - 1 };

    // 기존의 옅은 근거 칸 표시는 오버레이와 겹치므로 지웁니다(대상 칸 강조는 유지).
    document.querySelectorAll('#sudoku-board .cell.hint-evidence').forEach(c => c.classList.remove('hint-evidence'));
    document.body.classList.add('hint-visual-on');

    if (list) list.querySelectorAll(':scope > li').forEach((li, k) => {
      li.tabIndex = 0; li.setAttribute('role', 'button');
      li.onclick = () => go(k);
      li.onkeydown = e => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(k); } };
      attachDetail(li, k, steps[k] && steps[k].viz && steps[k].viz.detail);
    });
    if (concl && state.conclusionIndex >= 0) {
      concl.tabIndex = 0; concl.setAttribute('role', 'button');
      concl.onclick = () => go(state.conclusionIndex);
    }

    // 이동 막대: ‹  1 / 4  ›  (숫자·기호만 사용)
    const nav = document.createElement('div');
    nav.id = 'hv-nav'; nav.className = 'hv-nav';
    nav.innerHTML = '<button type="button" id="hv-prev" class="hv-btn" aria-label="Previous step">‹</button><span id="hv-counter" class="hv-counter" aria-live="polite"></span><button type="button" id="hv-next" class="hv-btn" aria-label="Next step">›</button>';
    nav.querySelector('#hv-prev').onclick = () => go(state.index - 1);
    nav.querySelector('#hv-next').onclick = () => go(state.index + 1);
    // 카드 높이를 늘리지 않도록 "대상 N행 M열" 줄 오른쪽에 붙입니다(없으면 설명 위에).
    const row = card.querySelector('.hint-target-row');
    if (row) row.appendChild(nav); else box.parentNode.insertBefore(nav, box);

    ensureSvg();
    requestAnimationFrame(() => go(0, false));
  };

  const dismiss = p.dismissDeductiveHint;
  p.dismissDeductiveHint = function () { clear(); return dismiss.call(this); };

  // 판이 다시 그려지거나 크기가 바뀌면 오버레이를 다시 계산합니다.
  const upd = p.updateBoardDisplay;
  if (upd) p.updateBoardDisplay = function (...a) { const r = upd.apply(this, a); if (state) requestAnimationFrame(() => { draw(); renderControls(); }); return r; };
  let raf = 0;
  const redraw = () => { if (!state) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
  window.addEventListener('resize', redraw);
  window.addEventListener('DOMContentLoaded', () => { const f = frame(); if (f && 'ResizeObserver' in window) new ResizeObserver(redraw).observe(f); });

  window.addEventListener('keydown', e => {
    if (!state || document.querySelector('.modal-backdrop:not(.hidden)')) return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' && e.altKey === false && document.activeElement?.closest?.('#floating-hint-card')) { e.preventDefault(); go(state.index + 1); }
    if (e.key === 'ArrowLeft' && e.altKey === false && document.activeElement?.closest?.('#floating-hint-card')) { e.preventDefault(); go(state.index - 1); }
  });

  // 테스트·디버그용
  window.SumdokuHintVisual = { state: () => state, go, draw };
})();
