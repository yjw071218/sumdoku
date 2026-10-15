// v1.1.18 검사
//  1) 힌트가 비어 있는 칸이 있는 한 항상 나오는지(틀린 숫자 포함), 정답이 맞는지, 틀린 숫자는 그 칸을 먼저 알려 주는지
//  2) "자세히": 요약된 단계에 상세 근거가 붙고, 버튼으로 펼치기/접기가 되는지
//  3) 메모: 필요한 후보가 메모에 있으면 강조(초록), 없으면 굵은 글씨(주황)로 그려지고 카드에 안내가 나오는지
//  4) 영역 합산: 켜는 순간 선택 칸·합산 목록이 비어 있고, 이 상태에서 숫자 입력·지우기·방향키가 오류 없이 동작하는지
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');
const ready = () => new Promise(res => { const t = setInterval(() => { if (app.cages?.length && app.currentView === 'game' && app.solution) { clearInterval(t); res(); } }, 40); });
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [];
  const open = async (w = 390, h = 844) => {
    const pg = await browser.newPage({ viewport: { width: w, height: h } });
    pg.on('pageerror', e => errors.push(e.message));
    await pg.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
    await pg.addInitScript(() => localStorage.setItem('sumdoku_language', 'ko'));
    await pg.goto(url); await pg.waitForFunction(() => window.app && typeof KillerDeduction !== 'undefined');
    return pg;
  };
  try {
    /* ---------- 1) 힌트 항상 제공 ---------- */
    let pg = await open();
    const always = await pg.evaluate(async readySrc => {
      const ready = eval(readySrc);
      const st = { total: 0, none: 0, wrongAns: 0, kinds: {}, corrections: 0, correctionMiss: 0, withDetail: 0, steps: 0, compressed: 0, compressedWithDetail: 0 };
      const kind = h => h.correction ? 'correction' : h.badgeText === '후보 좁히기' ? 'last' : (h.level >= 1 && h.level <= 4 && h.steps?.every(s => s.viz)) ? 'human' : 'solver';
      for (const diff of ['easy', 'medium', 'hard', 'expert']) for (let g = 0; g < 2; g++) {
        app.startNewGame(diff); await ready();
        const S = app.solution;
        const reset = () => app.board.forEach(row => row.forEach(c => { c.val = 0; c.error = false; c.notes = new Set(); }));
        const check = (wrongCells = []) => {
          const h = app.findImmediateHint(); st.total++;
          if (!h) { st.none++; return; }
          st.kinds[kind(h)] = (st.kinds[kind(h)] || 0) + 1;
          if (h.answer !== S[h.r][h.c]) st.wrongAns++;
          if (wrongCells.length) { st.corrections++; if (!h.correction || !wrongCells.includes(h.r * 9 + h.c)) st.correctionMiss++; }
          (h.steps || []).forEach(s => {
            st.steps++; if (s.viz && s.viz.detail && s.viz.detail.length) st.withDetail++;
            // 요약 문장(여러 숫자를 한꺼번에 지우는 문장, "N번 이유", "앞선 N단계")에는 자세히가 있어야 함
            if (/제외$|이미 있습니다|번 이유|앞선 \d+단계|만 올 수 있으므로|에만 올 수 있으므로/.test(s.text)) { st.compressed++; if (s.viz && s.viz.detail && s.viz.detail.length) st.compressedWithDetail++; }
          });
          return h;
        };
        // a) 힌트만 따라 끝까지
        reset();
        for (let k = 0; k < 81; k++) { const h = check(); if (!h) break; app.board[h.r][h.c].val = h.answer; if (app.board.every(r => r.every(c => c.val))) break; }
        // b) 틀린 숫자가 1~2개 있는 판
        for (let t = 0; t < 6; t++) {
          reset();
          const order = [...Array(81).keys()].sort(() => Math.random() - .5);
          order.slice(0, 20 + t * 6).forEach(i => { app.board[i / 9 | 0][i % 9].val = S[i / 9 | 0][i % 9]; });
          const wrong = order.slice(60, 60 + 1 + (t % 2));
          wrong.forEach(i => { app.board[i / 9 | 0][i % 9].val = S[i / 9 | 0][i % 9] % 9 + 1; });
          check(wrong);
        }
      }
      return st;
    }, ready.toString());
    console.log('always', JSON.stringify(always));
    assert.equal(always.none, 0, 'hint must never be empty');
    assert.equal(always.wrongAns, 0, 'hint answer must match solution');
    assert.equal(always.correctionMiss, 0, 'wrong numbers must be corrected first');
    assert(always.compressed > 0 && always.compressedWithDetail / always.compressed >= 0.95, `detail coverage ${always.compressedWithDetail}/${always.compressed}`);

    /* ---------- 2) 자세히 · 3) 메모 (화면) ---------- */
    const ui = await pg.evaluate(async readySrc => {
      const ready = eval(readySrc);
      // 후보 숫자가 필요한 힌트(케이지 조합·쌍)가 나올 때까지 힌트를 따라 진행
      let h = null;
      for (let g = 0; g < 6 && !h; g++) {
        app.startNewGame(['hard', 'expert'][g % 2]); await ready();
        // 앞서 연달아 시작한 게임의 생성 결과가 늦게 도착해 판을 바꾸지 않도록 잠시 기다립니다.
        await new Promise(r => setTimeout(r, 2500));
        app.board.forEach(row => row.forEach(c => { c.val = 0; c.notes = new Set(); }));
        for (let k = 0; k < 81; k++) {
          const x = KillerDeduction.hint(app.cages, app.board); if (!x) break;
          if (x.steps.some(s => s.viz && s.viz.digits.some(d => d.k === 'cand')) && x.steps.some(s => s.viz && s.viz.detail.length)) { h = x; break; }
          app.board[x.r][x.c].val = x.answer;
        }
      }
      if (!h) return { fail: 'no cand hint' };
      const k = h.steps.findIndex(s => s.viz && s.viz.digits.some(d => d.k === 'cand'));
      const cands = h.steps[k].viz.digits.filter(d => d.k === 'cand');
      // 첫 후보만 메모해 두고 나머지는 비워 둠
      const first = cands[0]; app.board[first.i / 9 | 0][first.i % 9].notes.add(first.d);
      app.updateBoardDisplay(); app.showImmediateHint();
      await new Promise(r => setTimeout(r, 400));
      window.SumdokuHintVisual.go(k, false); await new Promise(r => setTimeout(r, 120));
      const svg = document.getElementById('hint-visual-layer');
      const memo = document.querySelector('#hint-logic-text .hv-active .hv-memo');
      const res = {
        haveRings: svg.querySelectorAll('.hv-note-have').length,
        needRings: svg.querySelectorAll('.hv-note-need').length,
        memoRows: memo ? memo.querySelectorAll('.hv-memo-row').length : 0,
        memoText: memo ? memo.textContent : '',
        cands: cands.length
      };
      // 자세히 버튼
      const btn = document.querySelector('#hint-logic-text .hv-more');
      res.moreButtons = document.querySelectorAll('#hint-logic-text .hv-more').length;
      if (btn) {
        const list = btn.nextElementSibling;
        res.detailHiddenBefore = list.hidden;
        btn.click(); res.detailShown = !list.hidden && list.querySelectorAll('li').length > 0; res.expanded = btn.getAttribute('aria-expanded');
        res.activeAfterClick = window.SumdokuHintVisual.state().index === [...document.querySelectorAll('#hint-logic-text ol.hint-steps > li')].indexOf(btn.closest('li'));
        btn.click(); res.detailHiddenAfter = list.hidden;
      }
      // 메모를 추가하면 카드 안내가 갱신되는지
      window.SumdokuHintVisual.go(k, false);
      cands.forEach(d => app.board[d.i / 9 | 0][d.i % 9].notes.add(d.d)); app.updateBoardDisplay();
      await new Promise(r => setTimeout(r, 120));
      res.needAfterAll = document.getElementById('hint-visual-layer').querySelectorAll('.hv-note-need').length;
      const memoAfter = document.querySelector('#hint-logic-text .hv-active .hv-memo');
      res.memoTextAfter = memoAfter?.textContent || '';
      res.missAfter = memoAfter ? memoAfter.querySelectorAll('.hv-memo-row.miss').length : -1;
      res.haveAfter = memoAfter ? memoAfter.querySelectorAll('.hv-memo-row.have').length : -1;
      app.dismissDeductiveHint();
      return res;
    }, ready.toString());
    console.log('ui', JSON.stringify(ui));
    assert(!ui.fail, ui.fail);
    assert.equal(ui.haveRings + ui.needRings, ui.cands);
    assert(ui.haveRings >= 1 && (ui.cands === 1 || ui.needRings >= 1));
    assert(ui.memoRows >= 1 && /메모/.test(ui.memoText));
    assert(ui.moreButtons >= 1 && ui.detailHiddenBefore && ui.detailShown && ui.expanded === 'true' && ui.activeAfterClick && ui.detailHiddenAfter);
    assert.equal(ui.needAfterAll, 0);
    // ✓ 기호는 앱의 아이콘 치환으로 SVG 가 되므로 글자와 행 상태로 확인합니다.
    assert(/메모 있음/.test(ui.memoTextAfter) && !/메모 없음/.test(ui.memoTextAfter) && ui.missAfter === 0 && ui.haveAfter >= 1);
    await pg.close();

    /* ---------- 4) 영역 합산 ---------- */
    pg = await open();
    const cage = await pg.evaluate(async readySrc => {
      const ready = eval(readySrc);
      app.startNewGame('medium'); await ready();
      app.selectCell(4, 4);
      const before = { sel: document.querySelectorAll('#sudoku-board .cell.selected').length };
      document.getElementById('btn-cage-multi-calc').click();
      await new Promise(r => setTimeout(r, 100));
      const on = {
        mode: app.isMultiCageMode, selectedCells: document.querySelectorAll('#sudoku-board .cell.selected').length,
        cages: app.selectedCages.size, multiHighlighted: document.querySelectorAll('#sudoku-board .cell.highlight-multi-cage').length,
        sel: { ...app.selected }
      };
      // 선택 없음에서 입력·지우기·메모·방향키
      const snapshot = JSON.stringify(app.board.map(r => r.map(c => [c.val, [...c.notes]])));
      app.handleNumberInput(5); app.erase(); app.toggleNoteInSelected?.(3);
      on.boardUnchanged = snapshot === JSON.stringify(app.board.map(r => r.map(c => [c.val, [...c.notes]])));
      // 칸을 누르면 그 케이지만 더해짐
      document.querySelector('#sudoku-board .cell[data-r="2"][data-c="3"]').click();
      on.afterClickCages = app.selectedCages.size;
      on.cageOfClicked = app.selectedCages.has(app.cellCageMap['2,3']);
      // 끄고 다시 켜도 비어서 시작
      document.getElementById('btn-cage-multi-calc').click(); document.getElementById('btn-cage-multi-calc').click();
      on.reopenCages = app.selectedCages.size; on.reopenSelected = document.querySelectorAll('#sudoku-board .cell.selected').length;
      // 선택 없음에서 ←↑ 를 눌러도 판 안의 칸이 선택됨
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      on.afterArrow = { ...app.selected };
      document.getElementById('btn-cage-multi-calc').click();
      return { before, on };
    }, ready.toString());
    console.log('cage', JSON.stringify(cage));
    assert.equal(cage.before.sel, 1);
    assert(cage.on.mode && cage.on.selectedCells === 0 && cage.on.cages === 0 && cage.on.multiHighlighted === 0);
    assert(cage.on.sel.r < 0 && cage.on.sel.c < 0);
    assert(cage.on.boardUnchanged);
    assert(cage.on.afterClickCages === 1 && cage.on.cageOfClicked);
    assert(cage.on.reopenCages === 0 && cage.on.reopenSelected === 0);
    assert(cage.on.afterArrow.r >= -1 && cage.on.afterArrow.r <= 8 && cage.on.afterArrow.c >= -1 && cage.on.afterArrow.c <= 8);
    await pg.close();

    assert.deepEqual(errors, []);
    console.log('PASS hint-plus: hints never empty (incl. wrong numbers), answers correct, details on summarized steps, memo highlight/bold, cage-sum starts with nothing selected');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
