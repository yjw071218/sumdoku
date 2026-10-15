/* v1.0.35 · 사람이 실제로 따라 할 수 있는 추론만 힌트로 제공합니다.
 *
 * 기존 힌트는 전체 솔버의 증명 사슬을 그대로 보여 줘서 같은 케이지 문장이 여러 번 반복되거나
 * 사람이 머릿속으로 하기 어려운 대규모 소거가 섞였습니다. 이 엔진은 "현재 판 상태"만 보고
 * 아래 기법으로 바로 확정되는 칸을 찾고, 그 칸에 실제로 필요한 이유만 설명합니다.
 *
 *   1단계 기본 추론   : 케이지 마지막 칸, 남은 숫자 하나(네이키드 싱글), 숨은 싱글(행·열·박스)
 *   2단계 케이지 조합 : 케이지 합 조합 + 주변 숫자로 후보가 하나 / 케이지 안 숨은 싱글
 *   3단계 45의 법칙   : 한 행·열·박스에서 케이지 밖으로 남는 빈칸이 하나
 *   4단계 쌍·교차     : 네이키드 페어, 박스-줄 교차, 케이지 숫자 갇힘, 45의 법칙 두세 칸 합
 *                       (설명에 등장하는 앞 단계는 최대 3개)
 *
 * 어느 것에도 해당하지 않으면 null 을 돌려주고 힌트는 차감되지 않습니다.
 * 정답 배열은 전혀 사용하지 않습니다.
 */
(() => {
  if (typeof KillerDeduction === 'undefined') return;
  const ALL = 0x3fe;
  const bits = m => { const o = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) o.push(d); return o; };
  const cnt = m => bits(m).length;
  const pos = i => `${Math.floor(i / 9) + 1}행 ${i % 9 + 1}열`;
  const join = a => a.join('·');
  // 숫자 뒤 조사: 0·1·3·6·7·8은 받침이 있음(영·일·삼·육·칠·팔)
  const hasBatchim = n => [0, 1, 3, 6, 7, 8].includes(n % 10);
  const ga = n => `${n}${hasBatchim(n) ? '이' : '가'}`;
  const eul = n => `${n}${hasBatchim(n) ? '을' : '를'}`;
  // "N행 M열" 은 '열'로 끝나므로 받침 있음
  const posGa = i => `${pos(i)}이`;
  const LEVEL_NAME = ['', '기본 추론', '케이지 조합', '45의 법칙', '쌍·교차 후보'];
  // 설명에 펼칠 앞 단계 수·문장 수 상한. hint(..., {relaxed:true}) 는 더 긴 설명도 허용합니다(v1.1.18).
  let MAX_STEPS = 4, LINE_CAP = 8;

  const houses = [
    ...Array.from({ length: 9 }, (_, r) => ({ kind: 'row', name: `${r + 1}행`, cells: Array.from({ length: 9 }, (_, c) => r * 9 + c) })),
    ...Array.from({ length: 9 }, (_, c) => ({ kind: 'col', name: `${c + 1}열`, cells: Array.from({ length: 9 }, (_, r) => r * 9 + c) })),
    ...Array.from({ length: 9 }, (_, b) => ({ kind: 'box', name: `${b + 1}번 박스`, cells: Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + k % 3) }))
  ];
  const houseOf = Array.from({ length: 81 }, (_, i) => houses.filter(h => h.cells.includes(i)));

  function hint(cages, board, opts = {}) {
    MAX_STEPS = opts.relaxed ? 9 : 4; LINE_CAP = opts.relaxed ? 16 : 8;
    const val = new Uint8Array(81);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const cell = board && board[r] ? board[r][c] : 0;
      val[r * 9 + c] = (typeof cell === 'number' ? cell : cell && cell.val) || 0;
    }
    const cageUnits = cages.map(cg => ({ kind: 'cage', name: `합 ${cg.sum} 케이지`, sum: cg.sum, cells: cg.cells.map(([r, c]) => r * 9 + c) }));
    const cageOf = new Array(81);
    cageUnits.forEach(u => u.cells.forEach(i => { cageOf[i] = u; }));
    const unitsOf = i => cageOf[i] ? [...houseOf[i], cageOf[i]] : houseOf[i];

    // 판 자체가 모순이면(잘못 입력한 숫자) 힌트를 주지 않습니다.
    for (const u of [...houses, ...cageUnits]) {
      const seen = new Set();
      for (const i of u.cells) if (val[i]) { if (seen.has(val[i])) return null; seen.add(val[i]); }
    }

    // why[i][d] : 칸 i 에서 숫자 d 가 빠진 이유. group 이 같은 이유는 한 줄로 묶습니다.
    //   placed(이미 놓인 숫자) / cage(케이지 조합) / step(4단계 소거)
    const why = Array.from({ length: 81 }, () => new Array(10).fill(null));
    const masks = new Uint16Array(81);
    for (let i = 0; i < 81; i++) {
      if (val[i]) continue;
      let m = ALL;
      for (const u of unitsOf(i)) for (const j of u.cells) {
        const d = val[j];
        if (d && (m & (1 << d))) { m &= ~(1 << d); why[i][d] = { type: 'placed', unit: u.name, uc: u.cells, group: `placed|${u.name}`, src: [j] }; }
      }
      masks[i] = m;
      if (!m) return null;
    }
    const base = Uint16Array.from(masks);
    // 4단계 소거는 앞선 소거에 기댈 수 있으므로 의존 단계를 함께 기록하고, 설명에 순서대로 펼칩니다.
    const stepDeps = cells => { const out = new Map(); for (const j of cells) for (let x = 1; x <= 9; x++) { const w = why[j][x]; if (w && w.type === 'step' && !(masks[j] & (1 << x))) out.set(w.group, w); } return [...out.values()]; };
    const stepDepsOf = (cells, d) => { const out = new Map(); for (const j of cells) { const w = why[j][d]; if (w && w.type === 'step') out.set(w.group, w); } return [...out.values()]; };
    const expand = ws => { const seen = new Set(), order = []; const add = w => { if (seen.has(w.group)) return; seen.add(w.group); (w.deps || []).forEach(add); order.push(w); }; ws.forEach(add); return order; };
    const candidates = [];
    const push = h => candidates.push(h);

    /* v1.1.18 · 보드 시각화
     * 각 설명 문장에 "보드에 무엇을 그릴지"를 함께 기록합니다.
     *   area   : 굵은 점선으로 감쌀 영역(행·열·박스·케이지)        area2 : 보조 영역(포함된 케이지 등)
     *   src    : 근거가 되는 칸(파란 음영)                         target: 확정할 칸(주황 테두리)
     *   digits : 칸 안의 작은 숫자 {i, d, k}  k = elim(빨강 취소선) | cand(파랑 후보) | ans(초록 정답)
     *   arrows : 근거 칸 → 영향 받는 칸 화살표 [from, to]          labels: 짧은 라벨 {i, t} (숫자·기호만 사용)
     * 문장과 1:1로 짝지어 결과의 steps 에 담습니다. */
    const VZ = o => ({ area: [], area2: [], src: [], target: null, digits: [], arrows: [], labels: [], detail: [], ...o });
    const item = (t, v) => ({ t, v: v || null });
    const arrowsTo = (from, to, max = 4) => {
      const out = [];
      for (const a of from) { if (out.length >= max) break; let best = null, bd = 99; for (const b of to) { const dd = Math.abs(Math.floor(a / 9) - Math.floor(b / 9)) + Math.abs(a % 9 - b % 9); if (dd && dd < bd) { bd = dd; best = b; } } if (best !== null) out.push([a, best]); }
      return out;
    };
    // 같은 이유(group)로 여러 칸·숫자가 지워지면 시각화 하나에 누적합니다.
    const stepViz = new Map();
    const vizFor = (group, base) => { let v = stepViz.get(group); if (!v) { v = VZ(base); stepViz.set(group, v); } return v; };
    const addElim = (v, j, d) => { if (!v.digits.some(x => x.i === j && x.d === d && x.k === 'elim') && v.digits.length < 24) v.digits.push({ i: j, d, k: 'elim' }); };
    // intro 는 문자열 또는 {t, v} 로 받습니다.
    const pushItem = (lines, viz, x) => { if (typeof x === 'string') { lines.push(x); viz.push(null); } else { lines.push(x.t); viz.push(x.v); } };

    /* v1.1.18 · "자세히" — 한 줄로 요약된 문장 뒤의 실제 근거를 펼칩니다(viz.detail).
     *   reasonOf   : 칸 j 에서 숫자 d 가 빠진 이유 한 문장
     *   cellDetail : 칸 j 의 후보가 왜 keepMask 만 남았는지 이유별로 묶어 설명
     *   comboDetail: 케이지(또는 45의 법칙 가상 케이지)의 모든 숫자 조합과 각 조합이 되는/안 되는 이유 */
    const reasonOf = (j, d) => {
      const w = why[j][d]; if (!w) return null;
      if (w.type === 'placed') return `같은 ${w.unit}의 ${pos(w.src[0])}에 이미 ${ga(d)} 있음`;
      return String(w.text).replace(/\{d\}/g, String(d));
    };
    const cellDetail = (j, keepMask = 0) => {
      const groups = new Map();
      for (let d = 1; d <= 9; d++) {
        if (keepMask & (1 << d)) continue;
        const w = why[j][d]; if (!w) continue;
        const key = w.type === 'placed' ? `placed|${w.unit}` : w.group;
        const g = groups.get(key) || { w, ds: [] };
        g.ds.push(d); groups.set(key, g);
      }
      return [...groups.values()].map(g => g.w.type === 'placed'
        ? `${pos(j)}: ${join(g.ds)} 제외 — 같은 ${g.w.unit}에 이미 있음 (${g.ds.map(d => `${pos(why[j][d].src[0])}의 ${d}`).join(', ')})`
        : `${pos(j)}: ${join(g.ds)} 제외 — ${String(g.w.text).replace(/\{d\}/g, join(g.ds))}`);
    };
    const comboDetail = (u, maskArr = masks) => {
      const empty = u.cells.filter(i => !val[i]);
      if (empty.length < 2) return [];
      const placedDs = u.cells.filter(i => val[i]).map(i => val[i]);
      const target = u.sum - placedDs.reduce((a, b) => a + b, 0);
      const all = [];
      const rec = (start, k, left, mask) => {
        if (all.length > 60) return;
        if (!k) { if (!left) all.push(mask); return; }
        for (let d = start; d <= 9 && d <= left; d++) if (!placedDs.includes(d)) rec(d + 1, k - 1, left - d, mask | (1 << d));
      };
      rec(1, empty.length, target, 0);
      // 이 조합의 숫자를 각 빈칸 후보에 하나씩 배치할 수 있는지(이분 매칭)
      const fits = ds => { const used = new Array(empty.length).fill(false); const go = k => { if (k === ds.length) return true; for (let e = 0; e < empty.length; e++) if (!used[e] && (maskArr[empty[e]] & (1 << ds[k]))) { used[e] = true; if (go(k + 1)) return true; used[e] = false; } return false; }; return go(0); };
      const out = [`${u.virtual ? u.note || u.name : u.name}: 빈 ${empty.length}칸의 합 ${target}${placedDs.length ? ` (이미 ${join(placedDs)} 있음)` : ''}, 서로 다른 숫자 조합 ${all.length}가지`];
      all.slice(0, 10).forEach(m => {
        const ds = bits(m);
        if (fits(ds)) { out.push(`✓ ${ds.join('+')}`); return; }
        const lone = ds.find(d => !empty.some(j => maskArr[j] & (1 << d)));
        if (lone) {
          const where = empty.map(j => { const r = reasonOf(j, lone); return r ? `${pos(j)}: ${r}` : null; }).filter(Boolean).slice(0, 2).join(' / ');
          out.push(`✗ ${ds.join('+')} — ${ga(lone)} 들어갈 빈칸이 없음${where ? ` (${where})` : ''}`);
        } else out.push(`✗ ${ds.join('+')} — 각 칸의 남은 후보로는 한 칸에 하나씩 배치할 수 없음 (${empty.map(j => `${pos(j)}: ${join(bits(maskArr[j]))}`).join(', ')})`);
      });
      if (all.length > 10) out.push(`… 외 ${all.length - 10}가지`);
      return out;
    };

    /* 칸 i 가 v 로 확정되는 이유(네이키드 싱글) */
    const describeNaked = (i, v, intro = []) => {
      const groups = new Map();
      for (let d = 1; d <= 9; d++) if (d !== v) {
        const w = why[i][d]; if (!w) return null;
        const g = groups.get(w.group) || { w, ds: [], src: [] };
        g.ds.push(d); g.src.push(...w.src); groups.set(w.group, g);
      }
      const gs = [...groups.values()];
      const steps = expand(gs.filter(g => g.w.type === 'step').map(g => g.w));
      if (steps.length > MAX_STEPS) return null;
      const lines = [], viz = [];
      intro.forEach(x => pushItem(lines, viz, x));
      steps.forEach(w => { lines.push(w.text); viz.push(w.viz || null); });
      const placed = gs.filter(g => g.w.type === 'placed');
      if (placed.length) {
        lines.push(`${pos(i)}과 같은 ${placed.map(g => `${g.w.unit}에 ${join(g.ds)}`).join(', ')}${hasBatchim(placed[placed.length - 1].ds.slice(-1)[0]) ? '이' : '가'} 이미 있습니다.`);
        const src = [...new Set(placed.flatMap(g => g.src))];
        viz.push(VZ({ area: [...new Set(placed.flatMap(g => g.w.uc || []))], src, target: i, arrows: arrowsTo(src, [i], 6),
          digits: placed.flatMap(g => g.ds.map(d => ({ i, d, k: 'elim' }))),
          detail: placed.flatMap(g => g.ds.map(d => `${d}: ${pos(why[i][d].src[0])}에 있음 (같은 ${g.w.unit})`)) }));
      }
      gs.filter(g => g.w.type === 'cage').forEach(g => {
        lines.push(`${g.w.text.replace('{d}', join(g.ds))}`);
        viz.push(VZ({ area: g.w.uc || [], src: g.w.src, target: i, digits: g.ds.map(d => ({ i, d, k: 'elim' })), detail: comboDetail(cageOf[i], base) }));
      });
      lines.push(`남는 숫자는 ${v}뿐입니다.`);
      viz.push(VZ({ target: i, digits: [{ i, d: v, k: 'ans' }], labels: [{ i, t: `= ${v}` }],
        detail: [...cellDetail(i, 1 << v), `${pos(i)}에 남는 후보는 ${v} 하나입니다.`] }));
      return { lines, viz, src: gs.flatMap(g => g.src), stepCount: steps.length };
    };

    /* 단위 u 에서 숫자 d 가 칸 i 에만 들어가는 이유(숨은 싱글) */
    const describeHidden = (u, d, i, intro = []) => {
      const empty = u.cells.filter(j => !val[j] && j !== i);
      const groups = new Map();
      for (const j of empty) {
        const w = why[j][d]; if (!w) return null;
        const g = groups.get(w.group) || { w, cells: [], src: [] };
        g.cells.push(j); g.src.push(...w.src); groups.set(w.group, g);
      }
      const gs = [...groups.values()];
      const steps = expand(gs.filter(g => g.w.type === 'step').map(g => g.w));
      if (steps.length > MAX_STEPS) return null;
      const lines = [], viz = [];
      intro.forEach(x => pushItem(lines, viz, x));
      const stepNo = new Map();
      steps.forEach(w => { lines.push(w.text); viz.push(w.viz || null); stepNo.set(w.group, lines.length); });
      gs.forEach(g => {
        const where = g.cells.map(pos).join(', ');
        const src = [...new Set(g.src)];
        const elims = g.cells.map(j => ({ i: j, d, k: 'elim' }));
        if (g.w.type === 'placed') {
          lines.push(`${where}: 같은 ${g.w.unit}에 이미 ${ga(d)} 있음`);
          viz.push(VZ({ area: g.w.uc || [], area2: u.cells, src, digits: elims, arrows: arrowsTo(src, g.cells, 4),
            detail: g.cells.map(j => `${pos(j)}: ${reasonOf(j, d)}`) }));
        } else if (g.w.type === 'cage') {
          lines.push(`${where}: ${g.w.text.replace('{d}', String(d))}`);
          viz.push(VZ({ area: g.w.uc || [], area2: u.cells, src, digits: elims, detail: comboDetail(cageOf[g.cells[0]], base) }));
        } else {
          lines.push(`${where}: ${stepNo.get(g.w.group)}번 이유로 ${d} 제외`);
          viz.push(VZ({ area: (g.w.viz && g.w.viz.area) || [], area2: u.cells, src, digits: elims,
            detail: [`${stepNo.get(g.w.group)}번 단계: ${g.w.text}`, ...((g.w.viz && g.w.viz.detail) || [])] }));
        }
      });
      lines.push(`${u.name}에서 ${ga(d)} 들어갈 수 있는 곳은 ${pos(i)}뿐입니다.`);
      viz.push(VZ({ area: u.cells, target: i, digits: [{ i, d, k: 'ans' }], labels: [{ i, t: `= ${d}` }],
        detail: [...u.cells.filter(j => j !== i).map(j => val[j] ? `${pos(j)}: 이미 ${val[j]}` : `${pos(j)}: ${reasonOf(j, d) || `${d} 불가`}`), `${u.name}에서 ${ga(d)} 남는 자리는 ${pos(i)}뿐입니다.`] }));
      return { lines, viz, src: gs.flatMap(g => g.src), stepCount: steps.length };
    };

    const scanSingles = (level, units, introFor = () => []) => {
      for (let i = 0; i < 81; i++) {
        if (val[i] || cnt(masks[i]) !== 1) continue;
        if (level > 1 && cnt(base[i]) === 1) continue; // 더 쉬운 단계에서 이미 찾음
        const v = bits(masks[i])[0];
        const res = describeNaked(i, v, level >= 2 ? introFor(cageOf[i]) : []);
        if (res) push({ level, i, v, cost: level * 10 + res.lines.length + res.stepCount * 2, ...res });
      }
      for (const u of units) {
        const empty = u.cells.filter(i => !val[i]);
        const present = new Set(u.cells.filter(i => val[i]).map(i => val[i]));
        for (let d = 1; d <= 9; d++) {
          if (present.has(d)) continue;
          if (u.kind === 'cage' && !((level >= 3 ? u.mandatory2 : u.mandatory) & (1 << d))) continue;
          const spots = empty.filter(i => masks[i] & (1 << d));
          if (spots.length !== 1) continue;
          const intro = u.kind === 'cage' ? [...introFor(u), item(`${u.name}의 가능한 조합에는 모두 ${ga(d)} 들어갑니다.`,
            VZ({ area: u.cells, digits: empty.map(j => ({ i: j, d, k: 'cand' })), labels: [{ i: u.cells[0], t: `Σ${u.sum} ∋ ${d}` }],
            detail: comboDetail(u, level >= 3 ? masks : base).filter(x => !x.startsWith('✗')).concat(`위의 가능한 조합에 모두 ${ga(d)} 있으므로 이 케이지 어딘가에 ${ga(d)} 반드시 들어갑니다.`) }))] : [];
          const res = describeHidden(u, d, spots[0], intro);
          if (res) push({ level, i: spots[0], v: d, cost: level * 10 + 1.5 + res.lines.length + res.stepCount * 2, ...res });
        }
      }
    };

    /* ---------- 1단계 ---------- */
    for (const u of cageUnits) {
      const empty = u.cells.filter(i => !val[i]);
      if (empty.length !== 1) continue;
      const placed = u.cells.filter(i => val[i]);
      const v = u.sum - placed.reduce((s, i) => s + val[i], 0);
      if (v < 1 || v > 9 || !(base[empty[0]] & (1 << v))) return null;
      push({ level: 1, i: empty[0], v, cost: 9, src: placed, lines: [
        `${u.name}에서 비어 있는 칸은 ${pos(empty[0])} 하나뿐입니다.`,
        placed.length
          ? `합 ${u.sum}에서 이미 놓인 ${placed.map(j => val[j]).join(' + ')}${placed.length > 1 ? ` = ${u.sum - v}` : ''}${hasBatchim(u.sum - v) ? '을' : '를'} 빼면 ${v}입니다.`
          : `한 칸짜리 케이지이므로 그 칸의 숫자는 합과 같은 ${v}입니다.`
      ], viz: [
        VZ({ area: u.cells, target: empty[0], labels: [{ i: u.cells[0], t: `Σ${u.sum}` }] }),
        VZ({ area: u.cells, src: placed, target: empty[0], digits: [{ i: empty[0], d: v, k: 'ans' }],
          labels: [{ i: empty[0], t: placed.length ? `${u.sum} − ${u.sum - v} = ${v}` : `= ${v}` }],
          detail: [...placed.map(j => `${pos(j)} = ${val[j]}`), `${u.sum}${placed.map(j => ` − ${val[j]}`).join('')} = ${v}`] })
      ] });
    }
    scanSingles(1, houses);

    /* ---------- 2단계: 케이지 조합 ---------- */
    const comboInfo = new Map();
    const runCombos = (units, step) => {
      let changed = false;
      for (const u of units) {
        const empty = u.cells.filter(i => !val[i]);
        if (empty.length < 2) continue;
        const target = u.sum - u.cells.reduce((s, i) => s + val[i], 0);
        const support = new Uint16Array(empty.length), sets = new Set();
        let nodes = 0, aborted = false;
        const walk = (k, left, used) => {
          if (++nodes > 60000) { aborted = true; return false; }
          if (k === empty.length) { if (left) return false; sets.add(used); return true; }
          let any = false;
          for (const d of bits(masks[empty[k]] & ~used)) {
            if (d > left) break;
            if (walk(k + 1, left - d, used | (1 << d))) { support[k] |= 1 << d; any = true; }
          }
          return any;
        };
        walk(0, target, 0);
        if (aborted) continue; // 끝까지 확인하지 못하면 아무것도 지우지 않음
        if (!sets.size) return null;
        const combos = [...sets];
        u.mandatory = combos.reduce((m, x) => m & x, ALL);
        comboInfo.set(u, { empty, target, combos });
        empty.forEach((i, k) => {
          const removed = masks[i] & ~support[k];
          if (!removed) return;
          for (const d of bits(removed)) {
            const inAny = combos.some(x => x & (1 << d));
            let group, text;
            if (!inAny) { group = `cage|${u.name}|none`; text = u.virtual ? `${u.name}이므로 가능한 조합은 ${combos.slice(0, 4).map(x => bits(x).join('+')).join(', ')}${combos.length > 4 ? ' 등' : ''}뿐 → {d} 제외` : step ? `${u.name}의 가능한 조합은 이제 ${combos.slice(0, 4).map(x => bits(x).join('+')).join(', ')}${combos.length > 4 ? ' 등' : ''}뿐이므로 {d} 제외` : `${u.name}의 가능한 조합에 없는 숫자 {d} 제외`; }
            else if (empty.length === 2) {
              const o = empty[1 - k];
              group = `cage|${u.name}|pair|${d}`;
              text = `${eul(d)} 넣으면 ${posGa(o)} ${target - d}${hasBatchim(target - d) ? '이어야' : '여야'} 하는데 그 칸에 ${target - d}${hasBatchim(target - d) ? '은' : '는'} 올 수 없음`;
            } else { group = `cage|${u.name}|fit|${d}`; text = `${eul(d)} 넣으면 ${u.name}의 나머지 칸을 합 ${target - d}로 채울 수 없음`; }
            if (step) {
              // 조합 설명은 그룹을 처음 만들 때(소거 전 후보 기준) 한 번만 계산합니다.
              const sv = stepViz.get(group) || vizFor(group, { detail: comboDetail(u, masks), area: u.cells, src: u.cells.filter(j => j !== i && val[j]),
                labels: [{ i: empty[0], t: `Σ${target}` }] });
              addElim(sv, i, d);
              if (empty.length === 2 && inAny) { const o = empty[1 - k]; if (!sv.arrows.length) sv.arrows.push([i, o]); }
              why[i][d] = { type: 'step', group, deps: stepDeps(empty), viz: sv, text: text.startsWith(u.name) ? text.replace('{d}', String(d)) : `${u.name}: ${text.replace('{d}', String(d))}`, src: u.cells.filter(j => j !== i) };
            } else why[i][d] = { type: 'cage', group, text, uc: u.cells, src: u.cells.filter(j => j !== i) };
          }
          masks[i] &= support[k]; changed = true;
        });
      }
      return changed;
    };
    const comboIntro = u => {
      const info = u && (comboInfo2 || comboInfo).get(u); if (!info) return [];
      const shown = info.combos.slice(0, 4).map(x => bits(x).join('+'));
      const placed = u.cells.filter(i => val[i]);
      return [item(`${u.name}${placed.length ? `(이미 ${join(placed.map(i => val[i]))} 있음)` : ''}: 빈 ${info.empty.length}칸의 합 ${info.target}, 가능한 조합 ${shown.join(', ')}${info.combos.length > 4 ? ' 등' : ''}`,
        VZ({ area: u.cells, src: placed, labels: [{ i: info.empty[0], t: `Σ${info.target}: ${shown.slice(0, 3).join(' | ')}${info.combos.length > 3 ? ' …' : ''}` }],
          detail: comboDetail(u, base) }))];
    };
    let comboInfo2 = null;
    if (runCombos(cageUnits, false) === null) return null;
    // 설명에 쓰는 조합은 2단계(주변 숫자만 반영) 기준으로 고정합니다.
    comboInfo2 = new Map(comboInfo);
    cageUnits.forEach(u => { u.mandatory2 = u.mandatory || 0; });
    scanSingles(2, [...cageUnits, ...houses], comboIntro);

    /* ---------- 3단계: 45의 법칙 (남는 빈칸 하나) ---------- */
    const virtual = [];
    for (const h of houses) {
      const inside = new Set(h.cells);
      const contained = cageUnits.filter(u => u.cells.every(i => inside.has(i)));
      const touching = cageUnits.filter(u => u.cells.some(i => inside.has(i)) && u.cells.some(i => !inside.has(i)));
      if (contained.length) {
        const covered = new Set(contained.flatMap(u => u.cells));
        const rest = h.cells.filter(i => !covered.has(i));
        const restEmpty = rest.filter(i => !val[i]), known = rest.filter(j => val[j]);
        const cs = contained.reduce((s, u) => s + u.sum, 0);
        const sum = 45 - cs - known.reduce((s, j) => s + val[j], 0);
        const intro = [
          `${h.name}의 숫자 합은 1부터 9까지 더한 45입니다.`,
          `${h.name} 안에 완전히 들어 있는 케이지의 합: ${contained.length > 1 ? `${contained.map(u => u.sum).join(' + ')} = ${cs}` : cs}`
        ];
        if (restEmpty.length === 1) {
          const i = restEmpty[0];
          const cageLabels = contained.map(u => ({ i: u.cells[0], t: `Σ${u.sum}` }));
          if (sum >= 1 && sum <= 9 && masks[i] & (1 << sum)) push({ level: 3, i, v: sum, cost: 30, src: [...covered, ...known], lines: [
            ...intro,
            known.length ? `케이지 밖의 나머지 칸 중 ${known.map(j => `${pos(j)}=${val[j]}`).join(', ')}은 이미 놓여 있고, 빈칸은 ${pos(i)} 하나입니다.` : `케이지 밖에 남는 칸은 ${pos(i)} 하나입니다.`,
            `${pos(i)} = 45 − ${cs}${known.length ? ' − ' + known.map(j => val[j]).join(' − ') : ''} = ${sum}`
          ], viz: [
            VZ({ area: h.cells, labels: [{ i: h.cells[0], t: 'Σ45' }] }),
            VZ({ area: h.cells, area2: [...covered], src: [...covered], labels: cageLabels.length > 1 ? [...cageLabels, { i: h.cells[0], t: `= ${cs}` }] : cageLabels,
              detail: [...contained.map(u => `${u.name}: ${u.cells.map(pos).join(', ')}`), `합계 ${contained.map(u => u.sum).join(' + ')} = ${cs}`] }),
            VZ({ area: h.cells, area2: [...covered], src: known, target: i,
              detail: rest.map(j => val[j] ? `${pos(j)} = ${val[j]} (케이지 밖, 이미 놓임)` : `${pos(j)}: 케이지 밖 빈칸`) }),
            VZ({ area: h.cells, target: i, digits: [{ i, d: sum, k: 'ans' }], labels: [{ i, t: `45 − ${45 - sum} = ${sum}` }] })
          ] });
        } else if (restEmpty.length >= 2 && restEmpty.length <= 3) {
          virtual.push({ kind: 'cage', virtual: true, name: `45의 법칙(${h.name})`, sum, cells: restEmpty, note: `45의 법칙: ${h.name}에서 케이지 밖 빈칸 ${restEmpty.map(pos).join(' + ')} = 45 − ${cs}${known.length ? ' − ' + known.map(j => val[j]).join(' − ') : ''} = ${sum}` });
        }
      }
      if (!touching.length) continue;
      const all = [...contained, ...touching];
      const allCells = new Set(all.flatMap(u => u.cells));
      const uncovered = h.cells.filter(j => !allCells.has(j));
      if (uncovered.some(j => !val[j])) continue;
      const outside = touching.flatMap(u => u.cells.filter(i => !inside.has(i)));
      const outEmpty = outside.filter(i => !val[i]);
      if (outEmpty.length !== 1) continue;
      const i = outEmpty[0], ts = all.reduce((s, u) => s + u.sum, 0), us = uncovered.reduce((s, j) => s + val[j], 0);
      const knownOut = outside.filter(j => val[j]);
      const v = ts + us - 45 - knownOut.reduce((s, j) => s + val[j], 0);
      if (v >= 1 && v <= 9 && masks[i] & (1 << v)) push({ level: 3, i, v, cost: 32, src: [...allCells], lines: [
        `${h.name}의 숫자 합은 45입니다.`,
        `${h.name}에 걸친 케이지를 모두 더하면 ${all.length > 1 ? `${all.map(u => u.sum).join(' + ')} = ${ts}` : ts}${us ? `, 케이지 밖 숫자 ${uncovered.map(j => val[j]).join('+')}까지 더하면 ${ts + us}` : ''}입니다.`,
        `45를 넘는 ${ts + us - 45}${hasBatchim(ts + us - 45) ? '은' : '는'} ${h.name} 밖으로 튀어나온 칸의 합이고, 그중 빈칸은 ${pos(i)} 하나입니다.`,
        knownOut.length ? `${pos(i)} = ${ts + us - 45} − ${knownOut.map(j => val[j]).join(' − ')} = ${v}` : `따라서 ${pos(i)} = ${ts + us} − 45 = ${v}`
      ], viz: [
        VZ({ area: h.cells, labels: [{ i: h.cells[0], t: 'Σ45' }] }),
        VZ({ area: h.cells, area2: [...allCells], src: uncovered, labels: all.map(u => ({ i: u.cells[0], t: `Σ${u.sum}` })),
          detail: [...all.map(u => `${u.name}: ${u.cells.map(j => `${pos(j)}${inside.has(j) ? '' : '(밖)'}`).join(', ')}`), `${all.map(u => u.sum).join(' + ')}${us ? ` + ${us}` : ''} = ${ts + us}`] }),
        VZ({ area: h.cells, area2: outside, src: knownOut, target: i, labels: [{ i, t: `Σ${ts + us - 45}` }] }),
        VZ({ area2: outside, target: i, digits: [{ i, d: v, k: 'ans' }], labels: [{ i, t: `= ${v}` }] })
      ] });
    }

    /* ---------- 4단계 ---------- */
    if (!candidates.length) {
      let changed = false;
      const elim = (j, d, group, text, src, deps = [], area = []) => {
        if (val[j] || !(masks[j] & (1 << d))) return;
        // 근거 칸에는 남은 후보를 파랑으로, 지워지는 칸에는 빨간 취소선을 그립니다.
        const sv = vizFor(group, { area, src, digits: src.flatMap(s => bits(masks[s]).map(x => ({ i: s, d: x, k: 'cand' }))) });
        addElim(sv, j, d);
        if (sv.arrows.length < 3) sv.arrows.push(...arrowsTo([src[0]], [j], 1));
        why[j][d] = { type: 'step', group, text, src, deps, viz: sv }; masks[j] &= ~(1 << d); changed = true;
      };
      if (virtual.length) {
        // 45의 법칙 가상 케이지는 이유 문장에 계산식을 붙여 둡니다.
        virtual.forEach(v => { v.name = v.note; });
        if (runCombos(virtual, true) === null) return null;
      }
      for (let round = 0; round < 4 && !candidates.length; round++) {
        changed = round === 0 && virtual.length > 0;
        for (const u of [...houses, ...cageUnits]) {
          const empty = u.cells.filter(i => !val[i]);
          for (let a = 0; a < empty.length; a++) for (let b = a + 1; b < empty.length; b++) {
            const m = masks[empty[a]];
            if (cnt(m) !== 2 || masks[empty[b]] !== m) continue;
            const pairCage = cageOf[empty[a]] === cageOf[empty[b]] && u.kind !== 'cage' ? `${cageOf[empty[a]].name} 조합과 주변 숫자를 보면 ` : '';
            const text = `${pairCage}${pos(empty[a])}·${pos(empty[b])}에는 ${join(bits(m))}만 올 수 있으므로 ${u.name}의 다른 칸에서 ${join(bits(m))} 제외`;
            const pg = `pair|${u.name}|${m}`;
            // 두 칸에 왜 이 두 숫자만 남는지 칸별 근거를 함께 둡니다.
            if (!stepViz.has(pg) && empty.some(j => j !== empty[a] && j !== empty[b] && bits(m).some(d => masks[j] & (1 << d))))
              vizFor(pg, { area: u.cells, src: [empty[a], empty[b]], digits: [empty[a], empty[b]].flatMap(x => bits(m).map(d => ({ i: x, d, k: 'cand' }))),
                detail: [...cellDetail(empty[a], m), ...cellDetail(empty[b], m), `두 칸이 ${join(bits(m))}${hasBatchim(bits(m)[1]) ? '을' : '를'} 나눠 가지므로 ${u.name}의 다른 칸에는 ${join(bits(m))}${hasBatchim(bits(m)[1]) ? '이' : '가'} 올 수 없습니다.`] });
            for (const j of empty) if (j !== empty[a] && j !== empty[b]) for (const d of bits(m)) elim(j, d, pg, text, [empty[a], empty[b]], stepDeps([empty[a], empty[b]]), u.cells);
          }
        }
        const confine = (u, d, spots) => {
          for (const h of houses) {
            if (h === u || !spots.every(i => h.cells.includes(i))) continue;
            const text = `${u.name}의 ${ga(d)} ${h.name} 위의 칸(${spots.map(pos).join(', ')})에만 올 수 있으므로 ${h.name}의 나머지 칸에서 ${d} 제외`;
            const group = `confine|${u.name}|${h.name}|${d}`;
            // 갇힌 숫자 d 만 근거 칸에 표시하고, u 는 주 영역·h 는 보조 영역으로 그립니다.
            if (!stepViz.has(group)) vizFor(group, { area: u.cells, area2: h.cells, src: spots, digits: spots.map(s => ({ i: s, d, k: 'cand' })),
              detail: [...u.cells.filter(x => !spots.includes(x)).map(x => val[x] ? `${pos(x)}: 이미 ${val[x]}` : `${pos(x)}: ${reasonOf(x, d) || `${d} 불가`}`),
                `그래서 ${u.name}의 ${ga(d)} ${spots.map(pos).join(', ')} 중 하나에 들어가고, 이 칸들은 모두 ${h.name}에 있습니다.`] });
            for (const j of h.cells) if (!u.cells.includes(j)) elim(j, d, group, text, spots, stepDepsOf(u.cells.filter(x => !spots.includes(x)), d));
          }
        };
        for (const bx of houses) for (let d = 1; d <= 9; d++) {
          if (bx.cells.some(i => val[i] === d)) continue;
          const spots = bx.cells.filter(i => !val[i] && masks[i] & (1 << d));
          if (spots.length >= 2 && spots.length <= 3) confine(bx, d, spots);
        }
        for (const u of cageUnits) if (u.mandatory) for (const d of bits(u.mandatory)) {
          if (u.cells.some(i => val[i] === d)) continue;
          const spots = u.cells.filter(i => !val[i] && masks[i] & (1 << d));
          if (spots.length >= 2) confine(u, d, spots);
        }
        const r = runCombos([...cageUnits, ...virtual], true);
        if (r === null) return null;
        if (!changed && !r) break;
        scanSingles(4, [...houses, ...cageUnits], comboIntro);
        const keep = candidates.filter(h => h.lines.length <= LINE_CAP);
        candidates.length = 0; candidates.push(...keep);
      }
    }

    // 7줄을 넘는 설명은 사람이 따라가기 어렵다고 보고 제외합니다.
    const usable = candidates.filter(h => new Set(h.lines).size <= LINE_CAP);
    candidates.length = 0; candidates.push(...usable);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.level - b.level || (a.lines.length > 6) - (b.lines.length > 6) || a.cost - b.cost || a.i - b.i);
    const h = candidates[0], r = Math.floor(h.i / 9), c = h.i % 9;
    // 문장 중복을 지우면서 각 문장의 시각화를 그대로 짝지어 둡니다.
    const lines = [], steps = [];
    h.lines.forEach((t, k) => { if (lines.includes(t)) return; lines.push(t); steps.push({ text: t, viz: (h.viz && h.viz[k]) || null }); });
    const cage = cageOf[h.i];
    steps.forEach(s => { if (s.viz && s.viz.target === null) s.viz = { ...s.viz, focus: h.i }; });
    return {
      r, c, answer: h.v, level: h.level, stepsCount: lines.length, steps,
      proof: [{ technique: 'human', sources: [...new Set(h.src)].filter(j => j !== h.i) }],
      badgeText: LEVEL_NAME[h.level], posName: pos(h.i), cageInfo: cage ? `케이지 합 ${cage.sum}` : '',
      explanation: `${lines.map((l, k) => `${k + 1}. ${l}`).join('\n')}\n→ ${pos(h.i)}은 ${h.v}입니다.`
    };
  }

  KillerDeduction.solverHint = KillerDeduction.hint;
  KillerDeduction.hint = hint;
})();
