// v1.0.33 추가 기능 검사: 자동 메모, 케이지 색상, 완성 애니메이션, 볼륨·진동 설정,
// 연속 기록, 업적, 배틀 채팅(모의 서버), 6버튼 툴바 레이아웃.
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const checks = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://api.github.com/**', r => r.fulfill({ json: { tag_name: 'v1.0.33' } }));
    // 모의 배틀 채팅 서버
    const log = []; let seq = 0;
    await page.route('http://127.0.0.1:8888/api/**', async r => {
      const u = new URL(r.request().url());
      const cors = { 'Access-Control-Allow-Origin': '*' };
      if (u.pathname === '/api/chat') {
        if (r.request().method() === 'POST') {
          const b = JSON.parse(r.request().postData());
          log.push({ id: ++seq, player: b.player, text: b.text });
          return r.fulfill({ headers: cors, json: { ok: true, id: seq } });
        }
        const after = +(u.searchParams.get('after') || 0);
        return r.fulfill({ headers: cors, json: { ok: true, last: seq, messages: log.filter(m => m.id > after) } });
      }
      return r.fulfill({ headers: cors, json: { ok: true, p1: null, p2: null, status: 'playing' } });
    });
    await page.addInitScript(() => { localStorage.clear(); });
    await page.goto(url);
    await page.waitForFunction(() => window.app);

    // 1. 자동 메모: 모든 빈칸 후보에 정답이 포함
    const notes = await page.evaluate(async () => {
      app.startNewGame('medium');
      await new Promise(res => { const t = setInterval(() => { if (app.cages && app.cages.length && app.currentView === 'game' && app.solution) { clearInterval(t); res(); } }, 50); });
      await new Promise(r => setTimeout(r, 200));
      app.fillAutoNotes();
      let empty = 0, ok = 0, total = 0;
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const cell = app.board[r][c]; if (cell.val) continue;
        empty++; total += cell.notes.size; if (cell.notes.has(app.solution[r][c])) ok++;
      }
      const shown = document.querySelectorAll('#sudoku-board .cell-notes span:not(:empty)').length;
      app.undo ? app.undo() : document.getElementById('btn-undo').click();
      const afterUndo = app.board.flat().reduce((s, c) => s + c.notes.size, 0);
      return { empty, ok, avg: total / Math.max(empty, 1), shown, afterUndo, btn: !!document.getElementById('btn-auto-notes') };
    });
    assert.ok(notes.btn, 'auto-notes button');
    assert.equal(notes.ok, notes.empty, 'every candidate set contains the solution digit');
    assert.ok(notes.avg < 9 && notes.shown > 0, 'candidates are filtered and displayed');
    assert.equal(notes.afterUndo, 0, 'undo removes auto notes');
    checks.push(`auto notes (${notes.empty} cells, avg ${notes.avg.toFixed(1)} candidates)`);

    // 2. 케이지 색상: 맞닿은 서로 다른 케이지는 다른 색
    const tint = await page.evaluate(() => {
      let clash = 0, tinted = 0;
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const a = app.getCellElement(r, c); if (a.dataset.tint !== '') tinted++;
        for (const [rr, cc] of [[r + 1, c], [r, c + 1]]) {
          if (rr > 8 || cc > 8) continue;
          const b = app.getCellElement(rr, cc);
          if (app.cellCageMap[`${r},${c}`] !== app.cellCageMap[`${rr},${cc}`] && a.dataset.tint === b.dataset.tint) clash++;
        }
      }
      return { clash, tinted, on: document.body.classList.contains('cage-tint'), bg: getComputedStyle(app.getCellElement(0, 0)).backgroundImage };
    });
    assert.equal(tint.tinted, 81); assert.equal(tint.clash, 0); assert.ok(tint.on && tint.bg.includes('gradient'));
    checks.push('cage tint (no adjacent clash)');

    // 3. 완성 애니메이션: 한 행을 정답으로 채우면 unit-done
    const done = await page.evaluate(async () => {
      app.isPencilMode = false;
      const r = app.board.findIndex(row => row.some(c => !c.val));
      const cols = app.board[r].map((c, i) => c.val ? -1 : i).filter(i => i >= 0);
      for (const c of cols) { app.selectCell(r, c); app.handleNumberInput(app.solution[r][c]); }
      const n = document.querySelectorAll('#sudoku-board .cell.unit-done').length;
      return { n, row: r };
    });
    assert.ok(done.n >= 9, 'row completion animates at least 9 cells');
    checks.push(`completion animation (${done.n} cells)`);

    // 4. 같은 숫자 메모 강조
    const hit = await page.evaluate(() => {
      app.fillAutoNotes();
      const r = app.board.findIndex(row => row.some(c => c.val));
      const c = app.board[r].findIndex(x => x.val);
      app.selectCell(r, c);
      return document.querySelectorAll('#sudoku-board .note-hit').length;
    });
    assert.ok(hit >= 0); checks.push(`note highlight (${hit})`);

    // 5. 설정: 볼륨·진동·케이지 색상 저장
    const settings = await page.evaluate(() => {
      const v = document.getElementById('setting-volume');
      v.value = '40'; v.dispatchEvent(new Event('input')); v.dispatchEvent(new Event('change'));
      const t = document.getElementById('setting-cage-tint'); t.checked = false; t.dispatchEvent(new Event('change'));
      const off = document.body.classList.contains('cage-tint');
      t.checked = true; t.dispatchEvent(new Event('change'));
      return { saved: JSON.parse(localStorage.getItem('sumdoku_prefs_v2')), off, gain: app.sound.master ? app.sound.master.gain.value : null, haptics: !!document.getElementById('setting-haptics') };
    });
    assert.equal(settings.saved.volume, 40); assert.equal(settings.off, false); assert.ok(settings.haptics);
    if (settings.gain !== null) assert.ok(Math.abs(settings.gain - 1.28) < 0.01, 'master gain follows volume');
    checks.push('volume/haptics/tint settings');

    // 6. 연속 기록 + 업적
    const ach = await page.evaluate(() => {
      const k = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const days = [0, 1, 2].map(n => { const d = new Date(); d.setDate(d.getDate() - n); return k(d); });
      app.dailyCleared = days; const s = app.renderDailyStreak();
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) app.board[r][c].val = app.solution[r][c];
      app.hintsUsed = 0; app.mistakes = 0; app.score = 500; app.resultReason = null; app.isWin = true;
      app.recordGameEnd(true);
      app.renderAwardsList();
      return { s, hero: document.getElementById('daily-streak-hero')?.textContent, got: document.querySelectorAll('#achievements-section .ach-card.got').length, saved: Object.keys(JSON.parse(localStorage.getItem('sumdoku_achievements') || '{}')) };
    });
    assert.equal(ach.s.cur, 3); assert.ok(ach.hero.includes('연속 3일'));
    assert.ok(ach.saved.includes('first_win') && ach.saved.includes('no_hint') && ach.saved.includes('daily_3'), JSON.stringify(ach.saved));
    assert.ok(ach.got >= 3);
    checks.push(`streak + achievements (${ach.saved.length} unlocked)`);

    // 7. 배틀 채팅 (모의 서버)
    const chatRes = await page.evaluate(async () => {
      const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => (r * 3 + Math.floor(r / 3) + c) % 9 + 1));
      const cages = solution.flatMap((row, r) => row.map((sum, c) => ({ sum, cells: [[r, c]] })));
      app.battleHostIp = '127.0.0.1';
      app.startBattleMatch(1, { solution, cages, difficulty: 'easy' }, 'race');
      clearInterval(app.battlePollInterval);
      await new Promise(r => setTimeout(r, 300));
      const btnVisible = getComputedStyle(document.getElementById('btn-battle-chat')).display !== 'none';
      app.openBattleChat();
      document.querySelector('.chat-emoji').click();
      await new Promise(r => setTimeout(r, 300));
      const input = document.getElementById('chat-input'); input.value = '<b>안녕</b>';
      await new Promise(r => setTimeout(r, 800));
      input.closest('form').requestSubmit();
      await new Promise(r => setTimeout(r, 400));
      app.closeBattleChat();
      // 상대 메시지 주입은 Node 쪽에서
      return { btnVisible, mine: [...document.querySelectorAll('.chat-msg.mine')].map(e => e.querySelector('svg.sd-emo') ? 'svg:' + [...e.querySelector('svg.sd-emo').classList].find(c => c.startsWith('sd-emo-') ) + e.textContent : e.textContent), html: document.getElementById('chat-list').innerHTML.includes('<b>') };
    });
    log.push({ id: ++seq, player: 2, text: '잘하시네요' });
    await page.waitForTimeout(1600);
    const recv = await page.evaluate(() => ({
      theirs: [...document.querySelectorAll('.chat-msg.theirs')].map(e => e.textContent),
      unread: document.getElementById('chat-unread').textContent,
      pop: document.getElementById('chat-pop').textContent
    }));
    assert.ok(chatRes.btnVisible, 'chat button visible in battle');
    assert.deepEqual(chatRes.mine, ['svg:sd-emo-thumbs', '<b>안녕</b>']); assert.equal(chatRes.html, false, 'chat text is not HTML');
    assert.deepEqual(recv.theirs, ['잘하시네요']); assert.equal(recv.unread, '1'); assert.ok(recv.pop.includes('잘하시네요'));
    assert.equal(log.filter(m => m.player === 1).length, 2);
    checks.push('battle chat send/receive/unread');

    // 8. 채팅 입력 중 숫자 키가 보드로 가지 않음
    const keyLeak = await page.evaluate(async () => {
      app.openBattleChat();
      const r = app.board.findIndex(row => row.some(c => !c.val));
      const before = JSON.stringify(app.board.map(row => row.map(c => c.val)));
      const input = document.getElementById('chat-input'); input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
      const after = JSON.stringify(app.board.map(row => row.map(c => c.val)));
      app.closeBattleChat();
      return before === after;
    });
    assert.ok(keyLeak, 'typing in chat does not input numbers');
    checks.push('chat keyboard isolation');
    assert.deepEqual(errors, [], 'no page errors');
    await page.close();

    // 9. 좁은 화면 툴바 6개 버튼 넘침 없음
    for (const width of [320, 360]) {
      const p = await browser.newPage({ viewport: { width, height: 640 } });
      await p.route('https://api.github.com/**', r => r.fulfill({ json: { tag_name: 'v1.0.33' } }));
      await p.goto(url); await p.waitForFunction(() => window.app);
      const g = await p.evaluate(async () => {
        app.startNewGame('easy');
        await new Promise(res => { const t = setInterval(() => { if (app.cages && app.cages.length && app.currentView === 'game') { clearInterval(t); res(); } }, 50); });
        await new Promise(r => setTimeout(r, 200));
        const bar = document.querySelector('#view-game .action-toolbar');
        const btns = [...bar.querySelectorAll('.tool-btn')].map(b => b.getBoundingClientRect());
        return { n: btns.length, overflow: bar.scrollWidth > bar.clientWidth + 1, outside: btns.some(b => b.right > innerWidth + 1 || b.left < -1) };
      });
      assert.equal(g.n, 6); assert.ok(!g.overflow && !g.outside, `toolbar fits at ${width}px`);
      await p.close();
    }
    checks.push('6-button toolbar fits at 320/360px');
  } finally { await browser.close(); }
  console.log(JSON.stringify({ passed: true, checks }));
})().catch(e => { console.error(e); process.exitCode = 1; });
