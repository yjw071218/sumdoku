// v1.1.18 힌트 보드 시각화 검사
//  1) 엔진: 여러 난이도·진행도에서 나온 힌트의 모든 단계에 그림 정보가 있고, 칸 번호·숫자가 올바른지
//  2) 화면: 단계마다 보드 위에 SVG 가 그려지고, 라벨이 보드 밖으로 나가지 않으며, ‹ › 와 목록 클릭으로 이동되는지
//  3) 닫기·정답 채우기 후 오버레이가 남지 않는지
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    /* ---------- 1) 엔진 ---------- */
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
    await page.addInitScript(() => localStorage.setItem('sumdoku_language', 'ko'));
    await page.goto(url); await page.waitForFunction(() => window.app && typeof KillerDeduction !== 'undefined');
    const engine = await page.evaluate(async () => {
      const levels = {}, problems = []; let hints = 0, steps = 0;
      const okCell = i => Number.isInteger(i) && i >= 0 && i < 81;
      for (const diff of ['easy', 'medium', 'hard', 'expert']) for (let g = 0; g < 2; g++) {
        app.startNewGame(diff);
        await new Promise(res => { const t = setInterval(() => { if (app.cages?.length && app.currentView === 'game' && app.solution) { clearInterval(t); res(); } }, 40); });
        // 힌트만 따라 판을 끝까지 풀며 모든 단계(기본~쌍·교차)의 힌트를 모읍니다.
        const b = app.board.map(row => row.map(c => ({ ...c, notes: new Set() })));
        for (let guard = 0; guard < 81; guard++) {
          const h = KillerDeduction.hint(app.cages, b);
          if (!h) break;
          hints++; levels[h.level] = (levels[h.level] || 0) + 1;
          if (!Array.isArray(h.steps) || !h.steps.length) { problems.push('no steps'); break; }
          const lines = h.explanation.split('\n'); lines.pop();
          if (lines.length !== h.steps.length) problems.push(`step count ${lines.length} vs ${h.steps.length}`);
          h.steps.forEach((s, k) => {
            steps++;
            if (!s.viz) { problems.push(`L${h.level} step ${k} no viz: ${s.text}`); return; }
            const v = s.viz;
            const drawn = v.area.length + v.area2.length + v.src.length + v.digits.length + v.arrows.length + v.labels.length + (v.target !== null ? 1 : 0);
            if (!drawn) problems.push(`L${h.level} empty viz: ${s.text}`);
            [...v.area, ...v.area2, ...v.src, ...v.arrows.flat(), ...v.digits.map(d => d.i), ...v.labels.map(l => l.i)].forEach(i => { if (!okCell(i)) problems.push('bad cell ' + i); });
            v.digits.forEach(d => { if (!(d.d >= 1 && d.d <= 9) || !['elim', 'cand', 'ans'].includes(d.k)) problems.push('bad digit ' + JSON.stringify(d)); });
            // 지워지는 후보는 실제 정답이 아니어야 합니다(잘못된 그림 방지).
            v.digits.filter(d => d.k === 'elim').forEach(d => { if (app.solution[Math.floor(d.i / 9)][d.i % 9] === d.d && !b[Math.floor(d.i / 9)][d.i % 9].val) problems.push(`elim of true value ${d.d} at ${d.i}`); });
            v.digits.filter(d => d.k === 'ans').forEach(d => { if (d.i !== h.r * 9 + h.c || d.d !== h.answer) problems.push('ans mismatch'); });
          });
          if (h.answer !== app.solution[h.r][h.c]) { problems.push('hint answer wrong'); break; }
          b[h.r][h.c].val = h.answer;
        }
      }
      return { hints, steps, levels, problems: problems.slice(0, 12) };
    });
    console.log('engine', JSON.stringify(engine));
    assert(engine.hints >= 20, 'too few hints');
    assert.deepEqual(engine.problems, []);
    assert(Object.keys(engine.levels).length >= 2, 'need at least two hint levels');
    await page.close();

    /* ---------- 2) 화면 ---------- */
    const out = [];
    for (const [width, height, theme] of [[320, 568, 0], [390, 844, 1], [412, 915, 2], [768, 1024, 0], [1280, 800, 1]]) {
      const pg = await browser.newPage({ viewport: { width, height } });
      pg.on('pageerror', e => errors.push(e.message));
      await pg.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
      await pg.addInitScript(() => localStorage.setItem('sumdoku_language', 'ko'));
      await pg.goto(url); await pg.waitForFunction(() => window.app);
      const r = await pg.evaluate(async theme => {
        while (app.currentThemeIndex !== theme) app.cycleTheme();
        app.startNewGame('medium');
        await new Promise(res => { const t = setInterval(() => { if (app.cages?.length && app.currentView === 'game') { clearInterval(t); res(); } }, 40); });
        await new Promise(r => setTimeout(r, 150));
        app.useHint(); document.querySelector('#hint-confirm [data-confirm]')?.click();
        await new Promise(r => setTimeout(r, 400));
        const svg = document.getElementById('hint-visual-layer'), frame = document.getElementById('board-frame');
        const hv = window.SumdokuHintVisual, st = hv.state();
        if (!svg || !st) return { fail: 'no overlay' };
        const res = { n: st.steps.length, perStep: [], outOfBounds: 0 };
        const fr = frame.getBoundingClientRect();
        for (let k = 0; k < st.steps.length; k++) {
          if (k) document.getElementById('hv-next').click();
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const shapes = svg.querySelectorAll('g.hv-root *').length;
          svg.querySelectorAll('.hv-label-bg').forEach(p => { const b = p.getBoundingClientRect(); if (b.left < fr.left - 1 || b.right > fr.right + 1 || b.top < fr.top - 1 || b.bottom > fr.bottom + 1) res.outOfBounds++; });
          const active = document.querySelectorAll('#hint-logic-text .hv-active').length;
          if (k) { await new Promise(r => setTimeout(r, 450)); const v = hv.state().steps[k].viz; const ids = [...(v.area || []), ...(v.src || []), ...(v.target != null ? [v.target] : [])];
            const tops = ids.map(i => document.querySelector(`#sudoku-board .cell[data-r="${Math.floor(i / 9)}"][data-c="${i % 9}"]`).getBoundingClientRect().top);
            if (tops.length && Math.min(...tops) < -2) res.hiddenStep = (res.hiddenStep || 0) + 1; }
          res.perStep.push({ shapes, active, idx: hv.state().index, counter: document.getElementById('hv-counter').textContent });
        }
        res.nextDisabledAtEnd = document.getElementById('hv-next').disabled;
        // 목록 첫 항목을 누르면 1단계로
        document.querySelector('#hint-logic-text .hint-steps li')?.click();
        res.backToFirst = hv.state().index === 0 && document.getElementById('hv-prev').disabled;
        // 오버레이가 입력을 막지 않는지: 오버레이 위치의 최상단 요소가 칸이어야 함
        // 화면에 보이는 칸 하나를 골라 검사합니다(작은 화면은 카드 때문에 보드 일부가 스크롤됨).
        const visibleCell = [...document.querySelectorAll('#sudoku-board .cell')].find(e => { const b = e.getBoundingClientRect(); return b.top > 0 && b.bottom < innerHeight && document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('.cell') === e; }) || document.querySelector('#sudoku-board .cell');
        const c = visibleCell.getBoundingClientRect();
        res.passThrough = !!document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2)?.closest('.cell');
        // 오버레이 크기가 보드와 같은지
        const sb = svg.getBoundingClientRect();
        res.sizeMatch = Math.abs(sb.width - frame.clientWidth) < 2 && Math.abs(sb.height - frame.clientHeight) < 2;
        return res;
      }, theme);
      if (width === 390 || width === 1280) {
        await pg.evaluate(() => window.SumdokuHintVisual.go(0));
        await pg.waitForTimeout(260);
        await pg.locator('#board-frame').screenshot({ path: path.join(os.tmpdir(), `hint-visual-${width}-step1.png`) });
        await pg.evaluate(() => window.SumdokuHintVisual.go(99));
        await pg.waitForTimeout(260);
        await pg.locator('#board-frame').screenshot({ path: path.join(os.tmpdir(), `hint-visual-${width}-last.png`) });
      }
      // 3) 정답 채우기 후 정리
      const after = await pg.evaluate(() => {
        document.getElementById('hint-answer-val').click();
        document.getElementById('btn-hint-card-apply').click();
        return { layer: !!document.getElementById('hint-visual-layer'), nav: !!document.getElementById('hv-nav'), cls: document.body.classList.contains('hint-visual-on'), state: !!window.SumdokuHintVisual.state() };
      });
      out.push({ width, height, theme, ...r, after });
      await pg.close();
    }
    const bad = out.filter(r => r.fail || r.hiddenStep || r.outOfBounds || !r.nextDisabledAtEnd || !r.backToFirst || !r.passThrough || !r.sizeMatch
      || r.perStep.some((s, k) => s.shapes === 0 || s.active !== 1 || s.idx !== k || s.counter !== `${k + 1} / ${r.n}`)
      || r.after.layer || r.after.nav || r.after.cls || r.after.state);
    console.log(JSON.stringify(out.map(r => ({ w: r.width, theme: r.theme, n: r.n, shapes: r.perStep?.map(s => s.shapes), oob: r.outOfBounds, after: r.after })), null, 1));
    assert.deepEqual(errors, []);
    assert.deepEqual(bad, []);
    console.log('PASS hint-visual: engine viz for every step, overlay per step, labels in bounds, prev/next/list navigation, pass-through input, cleanup after apply');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
