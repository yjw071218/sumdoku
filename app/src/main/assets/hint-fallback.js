/* v1.1.18 · 힌트가 "없음"으로 끝나지 않게 합니다.
 *
 * 측정해 보니 힌트가 안 나오는 경우는 대부분 판에 틀린 숫자가 들어 있을 때였습니다(16판 48회 중 17회).
 * 틀린 숫자가 있으면 사람 수준 엔진이 모순을 발견해 힌트를 포기하거나, 틀린 숫자를 사실로 믿고
 * 엉뚱한 힌트를 만들 수 있습니다. 그래서 아래 순서로 반드시 하나의 힌트를 만듭니다.
 *
 *   1) 틀린 숫자 바로잡기 : 정답과 다른 숫자가 있으면 그 칸을 먼저 알려 줍니다(선택한 칸 우선).
 *                          눈에 보이는 충돌(같은 행·열·박스·케이지 중복, 케이지 합 초과)이 있으면 그 근거를 그림과 함께 보여 줍니다.
 *   2) 사람 수준 힌트     : 기존 엔진(human-hint.js)
 *   3) 완화한 사람 수준   : 앞 단계·문장 수 상한을 늘려 다시 시도
 *   4) 전체 연역 엔진     : deduction.js 의 증명. 긴 증명은 앞부분을 "자세히"로 접어 둡니다.
 *   5) 최후 수단          : 후보가 가장 적은 칸의 후보와 정답을 보여 줍니다.
 *
 * 모든 결과는 human-hint.js 와 같은 형식(steps[k] = {text, viz})을 써서 보드 그림·자세히가 그대로 동작합니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined' || typeof KillerDeduction === 'undefined') return;
  const p = SumdokuApp.prototype;
  const pos = i => `${Math.floor(i / 9) + 1}행 ${i % 9 + 1}열`;
  const bits = m => { const o = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) o.push(d); return o; };
  const VZ = o => ({ area: [], area2: [], src: [], target: null, digits: [], arrows: [], labels: [], detail: [], ...o });
  const hasBatchim = n => [0, 1, 3, 6, 7, 8].includes(n % 10);
  const ga = n => `${n}${hasBatchim(n) ? '이' : '가'}`;
  const houses = [
    ...Array.from({ length: 9 }, (_, r) => ({ name: `${r + 1}행`, cells: Array.from({ length: 9 }, (_, c) => r * 9 + c) })),
    ...Array.from({ length: 9 }, (_, c) => ({ name: `${c + 1}열`, cells: Array.from({ length: 9 }, (_, r) => r * 9 + c) })),
    ...Array.from({ length: 9 }, (_, b) => ({ name: `${b + 1}번 박스`, cells: Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + k % 3) }))
  ];
  const valOf = (board, i) => { const c = board[Math.floor(i / 9)][i % 9]; return (typeof c === 'number' ? c : c && c.val) || 0; };
  const copyBoard = board => board.map(row => row.map(c => ({ val: (typeof c === 'number' ? c : c && c.val) || 0, notes: new Set() })));
  const finish = (h, extra) => ({
    ...h, ...extra,
    explanation: `${extra.steps.map((s, k) => `${k + 1}. ${s.text}`).join('\n')}\n→ ${pos(h.r * 9 + h.c)}은 ${h.answer}입니다.`,
    stepsCount: extra.steps.length
  });

  /* 1) 틀린 숫자 */
  function correctionHint(app) {
    const S = app.solution; if (!S) return null;
    const wrong = [];
    for (let i = 0; i < 81; i++) { const v = valOf(app.board, i); if (v && v !== S[Math.floor(i / 9)][i % 9]) wrong.push(i); }
    if (!wrong.length) return null;
    const sel = app.selected && app.selected.r >= 0 ? app.selected.r * 9 + app.selected.c : -1;
    const i = wrong.includes(sel) ? sel : wrong[0], r = Math.floor(i / 9), c = i % 9, bad = valOf(app.board, i), answer = S[r][c];
    const cages = (app.cages || []).map(cg => ({ sum: cg.sum, noSum: !!cg.noSum, cells: cg.cells.map(([rr, cc]) => rr * 9 + cc) }));
    const cage = cages.find(cg => cg.cells.includes(i));
    const steps = [];
    // 눈에 보이는 충돌
    const units = [...houses.filter(h => h.cells.includes(i)), ...(cage ? [{ name: cage.noSum ? '케이지' : `합 ${cage.sum} 케이지`, cells: cage.cells }] : [])];
    for (const u of units) {
      const dup = u.cells.filter(j => j !== i && valOf(app.board, j) === bad);
      if (dup.length) steps.push({ text: `${pos(i)}의 ${bad}${hasBatchim(bad) ? '은' : '는'} 같은 ${u.name}의 ${dup.map(pos).join(', ')}에 있는 ${bad}${hasBatchim(bad) ? '과' : '와'} 겹칩니다.`,
        viz: VZ({ area: u.cells, src: dup, target: i, digits: [{ i, d: bad, k: 'elim' }], arrows: dup.slice(0, 3).map(j => [j, i]), labels: [{ i, t: `${bad} ✕` }] }) });
    }
    if (cage && !cage.noSum) {
      const filled = cage.cells.filter(j => valOf(app.board, j)), sum = filled.reduce((s, j) => s + valOf(app.board, j), 0);
      const full = filled.length === cage.cells.length;
      if (sum > cage.sum || (full && sum !== cage.sum)) steps.push({
        text: `합 ${cage.sum} 케이지에 놓인 숫자의 합이 ${filled.map(j => valOf(app.board, j)).join(' + ')} = ${sum}${full ? `로 ${cage.sum}과 다릅니다.` : `로 이미 ${cage.sum}을 넘습니다.`}`,
        viz: VZ({ area: cage.cells, src: filled.filter(j => j !== i), target: i, digits: [{ i, d: bad, k: 'elim' }], labels: [{ i: cage.cells[0], t: `Σ${sum} ≠ ${cage.sum}` }] })
      });
    }
    if (!steps.length) steps.push({
      text: `${pos(i)}의 ${bad}${hasBatchim(bad) ? '은' : '는'} 지금 당장 겹치는 숫자는 없지만, 이 숫자로는 판을 끝까지 채울 수 없습니다(뒤에서 모순이 생깁니다).`,
      viz: VZ({ target: i, digits: [{ i, d: bad, k: 'elim' }], labels: [{ i, t: `${bad} ✕` }],
        detail: ['킬러 스도쿠의 정답은 하나뿐입니다. 이 칸에 다른 숫자를 넣어야만 모든 행·열·박스·케이지 조건을 동시에 만족할 수 있습니다.'] })
    });
    // 틀린 숫자를 모두 지운 판에서 이 칸의 근거를 다시 찾습니다.
    const clean = copyBoard(app.board); wrong.forEach(j => { clean[Math.floor(j / 9)][j % 9].val = 0; });
    let reason = null;
    for (const opts of [{}, { relaxed: true }]) {
      const h = KillerDeduction.hint(app.cages, clean, opts);
      if (h && h.r === r && h.c === c && h.answer === answer) { reason = h; break; }
    }
    steps.push({ text: `${pos(i)}의 ${bad}${hasBatchim(bad) ? '을' : '를'} 지우고 다시 생각해 봅니다.`, viz: VZ({ target: i, digits: [{ i, d: bad, k: 'elim' }] }) });
    if (reason && Array.isArray(reason.steps)) steps.push(...reason.steps);
    else steps.push({ text: `이 칸의 올바른 숫자는 ${answer}입니다.`, viz: VZ({ target: i, digits: [{ i, d: answer, k: 'ans' }], labels: [{ i, t: `= ${answer}` }] }) });
    return finish({ r, c, answer, level: 0, proof: [], badgeText: '숫자 바로잡기', posName: pos(i), cageInfo: cage ? (cage.noSum ? '케이지' : `케이지 합 ${cage.sum}`) : '', correction: true },
      { steps, extraWrong: wrong.length - 1 });
  }

  /* 4) 전체 연역 엔진 결과를 단계 형식으로 */
  function solverHint(app) {
    const fn = KillerDeduction.solverHint; if (!fn) return null;
    const h = fn(app.cages, app.board); if (!h) return null;
    const events = Array.isArray(h.proof) ? h.proof : [];
    const i = h.r * 9 + h.c;
    const vizOf = e => {
      const digits = [];
      (e.updates || []).forEach(u => bits(u.before & ~u.after).forEach(d => { if (digits.length < 24) digits.push({ i: u.i, d, k: 'elim' }); }));
      return VZ({ src: e.sources || [], digits, focus: i });
    };
    const singles = events.filter(e => e.technique === 'single'), key = events.filter(e => e.technique !== 'single');
    const shown = key.slice(-5), hidden = key.slice(0, key.length - shown.length);
    const steps = [];
    if (singles.length) steps.push({ text: '이미 놓인 숫자를 같은 행·열·박스·케이지의 다른 칸 후보에서 지웁니다.',
      viz: VZ({ focus: i, src: [...new Set(singles.flatMap(e => e.sources || []))].slice(0, 30), detail: singles.slice(0, 30).map(e => e.reason) }) });
    if (hidden.length) steps.push({ text: `앞선 ${hidden.length}단계의 후보 소거 (자세히에서 모두 볼 수 있습니다)`,
      viz: VZ({ focus: i, src: [...new Set(hidden.flatMap(e => e.sources || []))].slice(0, 30), detail: hidden.map((e, k) => `${k + 1}) ${e.reason}`) }) });
    shown.forEach(e => steps.push({ text: e.reason, viz: vizOf(e) }));
    steps.push({ text: `남는 숫자는 ${h.answer}뿐입니다.`, viz: VZ({ target: i, digits: [{ i, d: h.answer, k: 'ans' }], labels: [{ i, t: `= ${h.answer}` }] }) });
    return finish(h, { steps });
  }

  /* 5) 최후 수단: 후보가 가장 적은 칸 */
  function lastResort(app) {
    const S = app.solution; if (!S) return null;
    let res = null; try { res = KillerDeduction.solve(app.cages, app.board, false, 4); } catch (_) { res = null; }
    let best = -1, bestCnt = 10;
    for (let i = 0; i < 81; i++) {
      if (valOf(app.board, i)) continue;
      const m = res && res.candidates ? res.candidates[Math.floor(i / 9)][i % 9] : 0x3fe;
      const n = bits(m).length || 9;
      if (n < bestCnt) { bestCnt = n; best = i; }
    }
    if (best < 0) return null;
    const r = Math.floor(best / 9), c = best % 9, answer = S[r][c];
    const m = res && res.candidates ? res.candidates[r][c] : 0x3fe;
    const cand = bits(m).length ? bits(m) : [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const steps = [
      { text: '지금 판에서는 몇 단계의 추론만으로 바로 확정되는 칸을 찾지 못했습니다.', viz: VZ({ focus: best }) },
      { text: `후보가 가장 적은 ${pos(best)}의 후보는 ${cand.join('·')}입니다.`, viz: VZ({ target: best, digits: cand.map(d => ({ i: best, d, k: 'cand' })) }) },
      { text: `${pos(best)}의 정답은 ${answer}입니다. 이 숫자를 넣으면 다른 칸의 추론이 이어집니다.`, viz: VZ({ target: best, digits: [{ i: best, d: answer, k: 'ans' }], labels: [{ i: best, t: `= ${answer}` }] }) }
    ];
    const cage = (app.cages || []).find(cg => cg.cells.some(([rr, cc]) => rr === r && cc === c));
    return finish({ r, c, answer, level: 5, proof: [], badgeText: '후보 좁히기', posName: pos(best), cageInfo: cage ? (cage.noSum ? '케이지' : `케이지 합 ${cage.sum}`) : '' }, { steps });
  }

  p.findImmediateHint = function () {
    const tries = [
      () => correctionHint(this),
      () => KillerDeduction.hint(this.cages, this.board),
      () => KillerDeduction.hint(this.cages, this.board, { relaxed: true }),
      () => solverHint(this),
      () => lastResort(this)
    ];
    for (const t of tries) {
      let h = null;
      try { h = t(); } catch (e) { console.warn('hint step failed', e); }
      if (h) return h;
    }
    return null; // 빈칸이 하나도 없을 때만
  };

  // 테스트용
  window.SumdokuHintFallback = { correctionHint, solverHint, lastResort };
})();
