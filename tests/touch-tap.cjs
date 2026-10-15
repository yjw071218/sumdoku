// v1.1.18 터치 씹힘 검사
// 모바일 터치 에뮬레이션으로 손가락이 0~12px 움직이는 탭을 칸·키패드에 보내고, 입력이 들어갔는지 셉니다.
// 14px 를 넘는 움직임(20px)은 스크롤로 보고 입력되지 않아야 합니다. 같은 요소가 두 번 눌리는(중복 실행) 일도 없어야 합니다.
// 같은 칸을 빠르게 두 번 누를 때 오류(openDirectTyping 미정의)가 나지 않는지도 확인합니다.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');
const OFF = false;
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const results = {};
  const errors = [];
  try {
    for (const [w, h] of [[390, 844], [360, 640]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
      pg.on('pageerror', e => errors.push(e.message));
      await pg.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
      await pg.addInitScript(() => localStorage.setItem('sumdoku_language', 'ko'));
      await pg.goto(url); await pg.waitForFunction(() => window.app);
      await pg.evaluate(async () => {
        app.startNewGame('easy');
        await new Promise(res => { const t = setInterval(() => { if (app.cages?.length && app.currentView === 'game' && app.solution) { clearInterval(t); res(); } }, 40); });
        await new Promise(r => setTimeout(r, 1500));
        // 입력 소리·결과 판정이 측정에 끼어들지 않게: 판을 비우고 실수 무시
        app.board.forEach(row => row.forEach(c => { c.val = 0; c.notes = new Set(); c.error = false; }));
        app.updateBoardDisplay();
        if (app.isPencilMode) app.togglePencilMode?.();
      });
      const tap = async (x, y, dx, dy) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let s = 1; s <= 4; s++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * s / 4, y: y + dy * s / 4 }] });
          await new Promise(r => setTimeout(r, 18));
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await new Promise(r => setTimeout(r, 160));
      };
      const center = sel => pg.evaluate(sel => { const b = document.querySelector(sel).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
      // 빠른 연속 클릭의 두 번째 이벤트도 selectCell까지 도달해야 합니다.
      const rapid = await pg.evaluate(() => {
        const original=app.selectCell; let count=0;
        app.selectCell=function(...args){count++;return original.apply(this,args);};
        const cell=document.querySelector('#sudoku-board .cell[data-r="4"][data-c="4"]');
        app.lastCellClick=null;
        cell.click();cell.click();
        app.selectCell=original;
        return {count,r:app.selected.r,c:app.selected.c};
      });
      assert.deepEqual(rapid,{count:2,r:4,c:4});
      const out = {};
      for (const d of [0, 4, 8, 12, 20]) {
        let cellOk = 0, keyOk = 0, dup = 0; const N = 6;
        for (let k = 0; k < N; k++) {
          const t = await pg.evaluate(k => {
            const r = (k * 4 + 1) % 9, c = (k * 7 + 2) % 9;
            app.mistakes = 0; app.isWin = false; app.resultReason = null; app.isPaused = false;
            document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
            app.board[r][c].val = 0; app.board[r][c].error = false; app.updateBoardDisplay();
            app.selectCell((r + 4) % 9, (c + 4) % 9); // 다른 칸을 먼저 선택해 둠
            document.querySelector(`#sudoku-board .cell[data-r="${r}"][data-c="${c}"]`).scrollIntoView({ block: 'center', behavior: 'instant' });
            return { r, c, num: app.solution[r][c] };
          }, k);
          await new Promise(r => setTimeout(r, 300));
          const cp = await center(`#sudoku-board .cell[data-r="${t.r}"][data-c="${t.c}"]`);
          await tap(cp.x, cp.y, d * 0.6, d);
          if (await pg.evaluate(t => app.selected.r === t.r && app.selected.c === t.c, t)) cellOk++;
          // 키패드: 이 칸의 정답 숫자(실수로 게임이 끝나지 않게)
          await pg.evaluate(t => { app.selectCell(t.r, t.c); app.board[t.r][t.c].val = 0; app.updateBoardDisplay(); window.__inputs = 0; const orig = app.__hni || (app.__hni = app.handleNumberInput); app.handleNumberInput = function (...a) { window.__inputs++; return orig.apply(this, a); }; document.querySelector(`.key-btn[data-num="${t.num}"]`).scrollIntoView({ block: 'center', behavior: 'instant' }); }, t);
          await new Promise(r => setTimeout(r, 300));
          const kp = await center(`.key-btn[data-num="${t.num}"]`);
          await tap(kp.x, kp.y, d * 0.6, d);
          const r2 = await pg.evaluate(t => ({ ok: app.board[t.r][t.c].val === t.num, n: window.__inputs }), t);
          if (r2.ok) keyOk++;
          if (r2.n > 1) dup++;
          await pg.evaluate(() => { app.handleNumberInput = app.__hni; });
        }
        out[`${d}px`] = { cell: cellOk, key: keyOk, dup, of: N };
      }
      results[`${w}x${h}`] = out;
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log((OFF ? '[수정 전] ' : '[수정 후] ') + JSON.stringify(results));
  if (OFF) return;
  for (const [vp, o] of Object.entries(results)) {
    for (const d of ['0px', '4px', '8px', '12px']) {
      assert.equal(o[d].cell, o[d].of, `${vp} ${d} cell taps lost`);
      assert.equal(o[d].key, o[d].of, `${vp} ${d} keypad taps lost`);
      assert.equal(o[d].dup, 0, `${vp} ${d} duplicated input`);
    }
    assert.equal(o['20px'].key, 0, `${vp} 20px drag must stay a scroll, not input`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS touch-tap: taps with up to 12px finger movement always register once; 20px drags stay scrolls');
})().catch(e => { console.error(e); process.exit(1); });
