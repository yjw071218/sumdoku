/* v1.1.18 · 리플레이 설명 줄 정리 + 틀린 수 "원인 보기"
 *
 * 1) 설명 글자 깨짐
 *    설명 상자가 display:flex 인데, 앱이 ✓·▶ 같은 기호를 아이콘(span)으로 바꿔 넣으면서
 *    "글자 / 아이콘 / 글자"가 각각 다른 칸이 되어 세 덩어리로 따로 줄바꿈되었습니다
 *    ("[01:05] (5행, 6열) 칸에 숫자 4 입력 ( | ✓ | 정답 확정)").
 *    → 설명 전체를 하나의 span 으로 감싸 한 문장으로 흐르게 합니다.
 * 2) 덜덜 떨림
 *    수순마다 설명이 한 줄↔두 줄로 바뀌며 상자 높이가 변해 아래 슬라이더·버튼이 위아래로 움직였습니다.
 *    → 상자 높이를 두 줄 기준으로 고정합니다(CSS). 단어 중간 줄바꿈("확/정")도 막습니다.
 * 3) 원인 보기
 *    오답 수에서는 설명 끝에 [원인 보기] 버튼을 붙입니다. 누르면 그 수를 두기 직전 판을 기준으로
 *      - 같은 행·열·박스·케이지에 이미 있는 같은 숫자(보드에 빨갛게 표시)
 *      - 케이지 합 초과·불일치, 남은 칸으로 합을 맞출 수 없음
 *      - 위가 아니면, 이 칸의 남은 후보와 정답이 확정되는 추론 과정(힌트 엔진)
 *    을 보여 줍니다. 정답 배열은 "정답이 무엇인지" 확인할 때만 쓰고, 이유는 판 상태로 설명합니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const pos = (r, c) => `${r + 1}행 ${c + 1}열`;
  const hasBatchim = n => [0, 1, 3, 6, 7, 8].includes(n % 10);
  const ga = n => `${n}${hasBatchim(n) ? '이' : '가'}`;
  const eun = n => `${n}${hasBatchim(n) ? '은' : '는'}`;
  const eul = n => `${n}${hasBatchim(n) ? '을' : '를'}`;
  const boxName = (r, c) => `${Math.floor(r / 3) * 3 + Math.floor(c / 3) + 1}번 박스`;

  /* 수순 k(1부터)를 두기 직전의 판 */
  const boardBefore = (replay, k) => {
    const vals = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let i = 0; i < k - 1; i++) {
      const m = replay.moves[i];
      if (!m || m.isPencil) continue;
      if (m.type === 'erase') vals[m.r][m.c] = 0; else vals[m.r][m.c] = m.num;
    }
    return vals;
  };

  /* 서로 다른 k개 숫자(사용 불가 숫자 제외)로 합 target 을 만들 수 있는가 + 가능한 최소/최대 */
  const sumRange = (k, used) => {
    const free = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !used.has(d));
    if (free.length < k) return null;
    return { min: free.slice(0, k).reduce((a, b) => a + b, 0), max: free.slice(-k).reduce((a, b) => a + b, 0), free };
  };
  const canMake = (k, target, free) => {
    const rec = (start, k, left) => { if (!k) return left === 0; for (let i = start; i < free.length && free[i] <= left; i++) if (rec(i + 1, k - 1, left - free[i])) return true; return false; };
    return rec(0, k, target);
  };

  function analyzeMistake(replay, k) {
    const m = replay.moves[k - 1];
    if (!m || m.isPencil || m.type === 'erase' || m.type === 'hint') return null;
    const S = replay.solution, cages = replay.cages || [];
    const { r, c, num } = m;
    const answer = S && S[r] ? S[r][c] : null;
    const vals = boardBefore(replay, k);
    const out = { r, c, num, answer, reasons: [], conflicts: [], chain: [], candidates: null };

    // 1) 같은 숫자 충돌
    const units = [
      { name: `${r + 1}행`, cells: Array.from({ length: 9 }, (_, j) => [r, j]) },
      { name: `${c + 1}열`, cells: Array.from({ length: 9 }, (_, j) => [j, c]) },
      { name: boxName(r, c), cells: Array.from({ length: 9 }, (_, j) => [Math.floor(r / 3) * 3 + Math.floor(j / 3), Math.floor(c / 3) * 3 + j % 3]) }
    ];
    const cage = cages.find(cg => cg.cells.some(([rr, cc]) => rr === r && cc === c));
    if (cage) units.push({ name: `합 ${cage.sum} 케이지`, cells: cage.cells });
    for (const u of units) {
      const dup = u.cells.filter(([rr, cc]) => !(rr === r && cc === c) && vals[rr][cc] === num);
      if (!dup.length) continue;
      dup.forEach(x => out.conflicts.push(x));
      const wrongOther = dup.filter(([rr, cc]) => S && S[rr][cc] !== num);
      out.reasons.push(`같은 ${u.name}에 이미 ${ga(num)} 있습니다 (${dup.map(([rr, cc]) => pos(rr, cc)).join(', ')}).` +
        (wrongOther.length ? ` (그 ${num}도 사실은 틀린 숫자였습니다.)` : ''));
    }
    // 2) 케이지 합
    if (cage) {
      const others = cage.cells.filter(([rr, cc]) => !(rr === r && cc === c));
      const placed = others.filter(([rr, cc]) => vals[rr][cc]);
      const placedSum = placed.reduce((s, [rr, cc]) => s + vals[rr][cc], 0);
      const empty = others.length - placed.length;
      const total = placedSum + num;
      const already = placed.length ? `이미 ${placed.map(([rr, cc]) => vals[rr][cc]).join(' + ')}${placed.length > 1 ? ` = ${placedSum}` : ''}이 있는 ` : '';
      if (total > cage.sum) out.reasons.push(`${already}합 ${cage.sum} 케이지에 ${eul(num)} 넣으면 ${total}이 되어 합을 넘습니다.`);
      else if (!empty && total !== cage.sum) out.reasons.push(`합 ${cage.sum} 케이지의 마지막 칸인데, ${eul(num)} 넣으면 합이 ${total}이 되어 ${cage.sum}과 맞지 않습니다.`);
      else if (empty) {
        const used = new Set([...placed.map(([rr, cc]) => vals[rr][cc]), num]);
        const left = cage.sum - total, rg = sumRange(empty, used);
        if (left <= 0) out.reasons.push(`${already}합 ${cage.sum} 케이지에 ${eul(num)} 넣으면 합이 벌써 ${total}이 되어, 남은 빈칸 ${empty}개에 넣을 숫자가 없습니다.`);
        else if (empty === 1 && (left > 9 || used.has(left)))
          out.reasons.push(`${already}합 ${cage.sum} 케이지에 ${eul(num)} 넣으면 남은 한 칸에 ${ga(left)} 들어가야 하는데, ${left > 9 ? '한 칸에는 1~9만 들어갑니다' : `${eun(left)} 이미 이 케이지에 있습니다`}.`);
        else if (!rg || left < rg.min || left > rg.max || !canMake(empty, left, rg.free))
          out.reasons.push(`${already}합 ${cage.sum} 케이지에 ${eul(num)} 넣으면 남은 빈칸 ${empty}개의 합이 ${left}이어야 하는데, 서로 다른 숫자로는 만들 수 없습니다${rg ? ` (가능한 합 ${rg.min}~${rg.max})` : ''}.`);
      }
    }
    // 3) 바로 보이는 충돌이 없으면: 후보와 추론 과정
    if (typeof KillerDeduction !== 'undefined' && S) {
      // 틀린 숫자는 지운 판으로 따집니다.
      const clean = vals.map((row, rr) => row.map((v, cc) => (v && v === S[rr][cc] ? v : 0)));
      try {
        const res = KillerDeduction.solve(cages, clean, false, 4);
        if (res && res.candidates && !res.contradiction) {
          const mask = res.candidates[r][c];
          const cands = []; for (let d = 1; d <= 9; d++) if (mask & (1 << d)) cands.push(d);
          out.candidates = cands;
          if (!out.reasons.length && cands.length && !cands.includes(num))
            out.reasons.push(`그때 판의 숫자와 케이지 조합으로 따지면 ${pos(r, c)}에 올 수 있는 숫자는 ${cands.join('·')}뿐이라 ${eun(num)} 들어갈 수 없습니다.`);
        }
      } catch (_) {}
      // 이 칸이 확정되는 추론 과정: 힌트를 따라 채우다가 이 칸 차례가 오면 그 설명을 가져옵니다.
      const work = clean.map(row => row.slice());
      let before = 0;
      for (let g = 0; g < 81; g++) {
        let h = null;
        try { h = KillerDeduction.hint(cages, work) || KillerDeduction.hint(cages, work, { relaxed: true }); } catch (_) { h = null; }
        if (!h || h.answer !== S[h.r][h.c]) break;
        if (h.r === r && h.c === c) {
          out.chain = (h.steps || []).map(s => s.text);
          if (!out.chain.length && h.explanation) out.chain = h.explanation.split('\n').map(l => l.replace(/^\d+\.\s*/, ''));
          out.before = before;
          break;
        }
        work[h.r][h.c] = h.answer; before++;
      }
    }
    if (!out.reasons.length) out.reasons.push(`그 순간에는 같은 줄·박스·케이지에 겹치는 숫자가 없었지만, ${eun(num)} 이 칸에 들어갈 수 없는 숫자였습니다. 아래 풀이처럼 다른 칸을 채워 가면 이 칸은 ${answer}로 정해집니다.`);
    return out;
  }

  /* ---------- 화면 ---------- */
  const descBox = () => document.getElementById('replay-desc-box');
  const clearMarks = () => document.querySelectorAll('#replay-board .cell.replay-cause-conflict, #replay-board .cell.replay-cause-target')
    .forEach(el => el.classList.remove('replay-cause-conflict', 'replay-cause-target'));
  const closePanel = () => { document.getElementById('replay-cause-panel')?.remove(); clearMarks(); };

  function showCause(app, k) {
    closePanel();
    const replay = app.activeReplay; if (!replay) return;
    const a = analyzeMistake(replay, k); if (!a) return;
    const panel = document.createElement('section');
    panel.id = 'replay-cause-panel'; panel.className = 'replay-cause-panel';
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', '틀린 원인');
    const head = document.createElement('div'); head.className = 'rc-head';
    const title = document.createElement('strong'); title.textContent = `틀린 원인 · ${pos(a.r, a.c)}에 ${a.num}`;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'rc-close'; close.textContent = '닫기'; close.onclick = closePanel;
    head.append(title, close); panel.append(head);
    const ul = document.createElement('ul'); ul.className = 'rc-reasons';
    a.reasons.forEach(t => { const li = document.createElement('li'); li.textContent = t; ul.append(li); });
    panel.append(ul);
    if (a.answer) {
      const ans = document.createElement('p'); ans.className = 'rc-answer';
      ans.textContent = `이 칸의 정답은 ${a.answer}입니다.` + (a.candidates && a.candidates.length > 1 ? ` (그때 남아 있던 후보: ${a.candidates.join('·')})` : '');
      panel.append(ans);
    }
    if (a.chain.length) {
      const det = document.createElement('details'); det.className = 'rc-chain';
      const sum = document.createElement('summary');
      sum.textContent = a.before ? `정답 ${ga(a.answer)} 나오는 풀이 (다른 ${a.before}칸을 먼저 채운 뒤)` : `정답 ${ga(a.answer)} 나오는 풀이`;
      const ol = document.createElement('ol');
      a.chain.forEach(t => { const li = document.createElement('li'); li.textContent = t; ol.append(li); });
      det.append(sum, ol); panel.append(det);
    }
    const box = descBox();
    box?.parentNode?.insertBefore(panel, box.nextSibling);
    // 보드: 겹친 칸은 빨강, 틀린 수를 둔 칸은 주황 테두리
    const cellEl = (r, c) => document.querySelector(`#replay-board .cell[data-r="${r}"][data-c="${c}"]`);
    a.conflicts.forEach(([r, c]) => cellEl(r, c)?.classList.add('replay-cause-conflict'));
    cellEl(a.r, a.c)?.classList.add('replay-cause-target');
    panel.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /* 설명이 두 줄 높이를 넘으면 글자를 조금씩 줄여 맞춥니다(상자 높이는 CSS 로 고정 → 떨림 없음). */
  const fitDesc = box => {
    const span = box.querySelector(':scope > .replay-desc-text');
    if (!span) return;
    span.style.fontSize = '';
    const limit = box.clientHeight - 6;
    for (let scale = 1; scale >= 0.74 && span.scrollHeight > limit; scale -= 0.06) span.style.fontSize = `${scale.toFixed(2)}em`;
  };

  /* "9 / 14 수" → "10 / 14 수"처럼 자릿수가 바뀌면 수순 칸 폭이 1px 바뀌어 옆 제목이 한 줄 더 감기며
     화면 전체가 위아래로 흔들렸습니다. 이 리플레이에서 가장 긴 표시("14 / 14 수") 폭으로 고정합니다. */
  const lockPillWidth = total => {
    const pill = document.querySelector('#modal-replay-viewer .replay-step-pill') || document.querySelector('.replay-step-pill');
    if (!pill || pill.dataset.lockedFor === String(total)) return;
    const keep = pill.textContent;
    pill.style.minWidth = ''; pill.style.width = '';
    pill.textContent = `${total} / ${total} 수`;
    const w = Math.ceil(pill.getBoundingClientRect().width) + 2;
    pill.textContent = keep;
    if (w > 2) { pill.style.width = `${w}px`; pill.dataset.lockedFor = String(total); }
  };

  const apply = p.applyReplayStep;
  p.applyReplayStep = function (targetStep, ...rest) {
    const prevStep = this.replayStep;
    const r = apply.call(this, targetStep, ...rest);
    const box = descBox();
    if (!box || !this.activeReplay) return r;
    if (this.replayStep !== prevStep || !box.querySelector('.replay-desc-text')) closePanel();
    // 설명을 한 덩어리로 감쌉니다(아이콘 치환이 일어나도 한 문장으로 흐름).
    if (!box.querySelector(':scope > .replay-desc-text')) {
      const span = document.createElement('span'); span.className = 'replay-desc-text';
      while (box.firstChild) span.appendChild(box.firstChild);
      box.appendChild(span);
    }
    const k = this.replayStep, m = this.activeReplay.moves[k - 1];
    if (k > 0 && m && m.error && !m.isPencil && m.type !== 'erase' && m.type !== 'hint') {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'replay-cause-btn'; btn.textContent = '원인 보기';
      btn.onclick = e => { e.stopPropagation(); if (document.getElementById('replay-cause-panel')) closePanel(); else { this.pauseReplayPlay?.(); showCause(this, k); } };
      box.querySelector('.replay-desc-text').append(' ', btn);
    }
    lockPillWidth(this.activeReplay.moves.length);
    fitDesc(box);
    // 아이콘 치환(✓·▶ → 아이콘)은 다음 틱에 일어날 수 있어 한 번 더 맞춥니다.
    requestAnimationFrame(() => fitDesc(box));
    return r;
  };
  const closeViewer = p.closeReplayViewer;
  if (closeViewer) p.closeReplayViewer = function (...a) { closePanel(); return closeViewer.apply(this, a); };

  window.SumdokuReplayCause = { analyzeMistake };
})();
