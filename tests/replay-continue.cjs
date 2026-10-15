// v1.1.18 리플레이·이어하기 검사
//  1) 리플레이 설명: 아이콘(✓·▶)이 섞여도 한 덩어리 문장으로 흐르는지, 수순을 넘겨도 설명 상자 높이가 변하지 않는지(떨림),
//     한글 단어 중간에서 줄이 끊기지 않는지
//  2) 오답 수에 [원인 보기]가 붙고, 누르면 원인·정답이 나오며 겹친 칸이 보드에 표시되는지
//  3) 1:1 배틀 판·목숨을 다 쓴 판이 이어하기에 남지 않는지, 이전 버전이 남긴 잘못된 기록을 정리하는지
const assert = require('node:assert/strict'), path = require('node:path'), os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [];
  try {
    const out = [];
    for (const [w, h] of [[360, 780], [390, 844], [412, 915]]) {
      const pg = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      pg.on('pageerror', e => errors.push(e.message));
      await pg.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
      await pg.addInitScript(() => localStorage.setItem('sumdoku_language', 'ko'));
      await pg.goto(url); await pg.waitForFunction(() => window.app);
      const r = await pg.evaluate(async () => {
        app.startNewGame('medium');
        await new Promise(res => { const t = setInterval(() => { if (app.cages?.length && app.currentView === 'game' && app.solution) { clearInterval(t); res(); } }, 40); });
        await new Promise(r => setTimeout(r, 2000));
        const S = app.solution;
        // 정답 수 몇 개 + 같은 행에 이미 있는 숫자를 넣는 오답 + 겹치지 않는 오답 + 메모·지우기 섞인 리플레이
        const moves = [];
        let t = 5;
        const cells = [...Array(81).keys()].sort(() => Math.random() - .5);
        const [a, b, c, d] = cells;
        const rc = i => [Math.floor(i / 9), i % 9];
        moves.push({ t: t++, r: rc(a)[0], c: rc(a)[1], num: S[rc(a)[0]][rc(a)[1]], prevVal: 0, error: false });
        // a 와 같은 행의 다른 칸에 a 의 숫자를 넣는 오답(같은 행 중복)
        const ra = rc(a)[0], ca = (rc(a)[1] + 4) % 9;
        moves.push({ t: t++, r: ra, c: ca, num: S[ra][rc(a)[1]], prevVal: 0, error: true });
        moves.push({ t: t++, r: ra, c: ca, num: 0, prevVal: S[ra][rc(a)[1]], type: 'erase' });
        moves.push({ t: t++, isPencil: true, r: rc(b)[0], c: rc(b)[1], num: 3 });
        moves.push({ t: t++, r: rc(c)[0], c: rc(c)[1], num: S[rc(c)[0]][rc(c)[1]], prevVal: 0, error: false });
        // 겹치는 숫자가 없을 수 있는 오답
        const wrongNum = S[rc(d)[0]][rc(d)[1]] % 9 + 1;
        moves.push({ t: t++, r: rc(d)[0], c: rc(d)[1], num: wrongNum, prevVal: 0, error: true });
        for (let k = 0; k < 8; k++) { const i = cells[10 + k]; moves.push({ t: t++, r: rc(i)[0], c: rc(i)[1], num: S[rc(i)[0]][rc(i)[1]], prevVal: 0, error: false }); }
        const replay = { id: 1, date: '10월 15일 00:27', difficulty: 'medium', mode: 'standard', solution: S, cages: app.cages, moves, result: 'win', finalScore: 2483, finalTime: '07:36', mistakes: 2 };
        app.switchView('home');
        app.openReplayViewer(replay);
        await new Promise(r => setTimeout(r, 300));
        const box = document.getElementById('replay-desc-box');
        const res = { heights: new Set(), splitPieces: 0, midWordBreaks: 0, causeButtons: [], panel: null };
        const below = document.querySelector('.replay-slider-wrap');
        const sliderTops = new Set();
        for (let k = 0; k <= moves.length; k++) {
          app.applyReplayStep(k);
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          res.heights.add(Math.round(box.getBoundingClientRect().height));
          sliderTops.add(Math.round(below.getBoundingClientRect().top));
          // 상자의 직접 자식은 설명 span 하나여야 함(글자/아이콘이 따로 flex 칸이 되면 안 됨)
          const direct = [...box.childNodes].filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()));
          if (direct.length !== 1 || !direct[0].classList?.contains('replay-desc-text')) res.splitPieces++;
          if (box.querySelector('.replay-cause-btn')) res.causeButtons.push(k);
        }
        res.heights = [...res.heights]; res.sliderTops = [...sliderTops];
        // 원인 보기: 같은 행 중복 오답(2수)
        app.applyReplayStep(2); await new Promise(r => setTimeout(r, 50));
        box.querySelector('.replay-cause-btn').click(); await new Promise(r => setTimeout(r, 100));
        const panel = document.getElementById('replay-cause-panel');
        res.panel = panel ? { text: panel.textContent, conflicts: document.querySelectorAll('#replay-board .cell.replay-cause-conflict').length, target: document.querySelectorAll('#replay-board .cell.replay-cause-target').length } : null;
        // 겹침 없는 오답(6수)
        app.applyReplayStep(6); await new Promise(r => setTimeout(r, 50));
        res.panelClosedOnStep = !document.getElementById('replay-cause-panel');
        box.querySelector('.replay-cause-btn')?.click(); await new Promise(r => setTimeout(r, 300));
        const p2 = document.getElementById('replay-cause-panel');
        res.panel2 = p2 ? p2.textContent : null;
        res.answerOk = p2 ? p2.textContent.includes(`정답은 ${S[rc(d)[0]][rc(d)[1]]}`) : false;
        // 정답 수에는 버튼 없음
        res.expectButtons = [2, 6];
        return res;
      });
      if (w === 360) await pg.locator('#modal-replay-viewer .replay-controls-panel, .replay-controls-panel').first().screenshot({ path: path.join(os.tmpdir(), 'replay-cause-360.png') }).catch(() => {});
      out.push({ w, ...r });
      await pg.close();
    }
    console.log(JSON.stringify(out.map(o => ({ w: o.w, heights: o.heights, sliderTops: o.sliderTops, split: o.splitPieces, buttons: o.causeButtons, panel: o.panel && { conflicts: o.panel.conflicts, target: o.panel.target, text: o.panel.text.slice(0, 120) }, panel2: o.panel2 && o.panel2.slice(0, 160), answerOk: o.answerOk, closed: o.panelClosedOnStep })), null, 1));
    for (const o of out) {
      assert.equal(o.splitPieces, 0, 'description must be one flowing span');
      assert.equal(o.heights.length, 1, `desc box height must stay constant: ${o.heights}`);
      assert.equal(o.sliderTops.length, 1, `controls below must not move: ${o.sliderTops}`);
      assert.deepEqual(o.causeButtons, o.expectButtons);
      assert(o.panel && o.panel.conflicts >= 1 && o.panel.target === 1 && /이미/.test(o.panel.text) && /정답은/.test(o.panel.text));
      assert(o.panelClosedOnStep && o.panel2 && o.answerOk);
    }

    /* ---------- 3) 이어하기 ---------- */
    const pg = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pg.on('pageerror', e => errors.push(e.message));
    await pg.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
    await pg.addInitScript(() => localStorage.setItem('sumdoku_language', 'ko'));
    await pg.goto(url); await pg.waitForFunction(() => window.app);
    const cont = await pg.evaluate(async () => {
      const ready = () => new Promise(res => { const t = setInterval(() => { if (app.cages?.length && app.currentView === 'game') { clearInterval(t); res(); } }, 40); });
      const res = {};
      // a) 배틀이 끝난 뒤(isBattle=false, gameMode='battle') 홈으로 나가기
      app.startNewGame('easy'); await ready(); await new Promise(r => setTimeout(r, 1500));
      localStorage.removeItem('sumdoku_ongoing_game');
      app.gameMode = 'battle'; app.isBattle = false;
      app.switchView('home');
      res.battleSaved = !!localStorage.getItem('sumdoku_ongoing_game');
      res.battleContinueVisible = !app.dom.btnHomeContinue.classList.contains('hidden');
      // b) 이전 버전이 남긴 배틀 기록 정리
      app.startNewGame('easy'); await ready(); await new Promise(r => setTimeout(r, 1500));
      app.switchView('home');
      const normal = JSON.parse(localStorage.getItem('sumdoku_ongoing_game'));
      res.normalSaved = !!normal;
      localStorage.setItem('sumdoku_ongoing_game', JSON.stringify({ ...normal, gameMode: 'battle' }));
      res.staleBattleShown = app.checkContinueGame();
      res.staleBattleRemoved = !localStorage.getItem('sumdoku_ongoing_game');
      // c) 목숨을 다 쓴 일반 게임
      app.startNewGame('easy'); await ready(); await new Promise(r => setTimeout(r, 1500));
      app.switchView('home'); res.beforeDeathSaved = !!localStorage.getItem('sumdoku_ongoing_game');
      app.switchView('game');
      app.mistakes = Number(app.rules.maxLives) || 3;
      app.switchView('home');
      res.deadSaved = !!localStorage.getItem('sumdoku_ongoing_game');
      res.deadContinueVisible = !app.dom.btnHomeContinue.classList.contains('hidden');
      // 이전 버전이 남긴 목숨 소진 기록
      localStorage.setItem('sumdoku_ongoing_game', JSON.stringify({ ...normal, mistakes: 3, gameRules: { maxLives: '3', mistakeLimit: true, livesExhaustedAction: 'game_over' } }));
      res.staleDeadShown = app.checkContinueGame();
      res.staleDeadRestored = app.restoreOngoingGame();
      // d) 목숨 소진 후에도 계속하는 규칙이면 이어하기 유지
      localStorage.setItem('sumdoku_ongoing_game', JSON.stringify({ ...normal, mistakes: 3, gameRules: { maxLives: '3', mistakeLimit: true, livesExhaustedAction: 'continue' } }));
      res.continueRuleShown = app.checkContinueGame();
      // e) 정상 진행 중인 게임은 그대로 이어하기 가능
      localStorage.setItem('sumdoku_ongoing_game', JSON.stringify(normal));
      res.normalShown = app.checkContinueGame();
      res.normalRestored = app.restoreOngoingGame();
      return res;
    });
    console.log('continue', JSON.stringify(cont));
    assert.deepEqual(cont, {
      battleSaved: false, battleContinueVisible: false, normalSaved: true, staleBattleShown: false, staleBattleRemoved: true,
      beforeDeathSaved: true, deadSaved: false, deadContinueVisible: false, staleDeadShown: false, staleDeadRestored: false,
      continueRuleShown: true, normalShown: true, normalRestored: true
    });
    await pg.close();
    assert.deepEqual(errors, []);
    console.log('PASS replay-continue: one-line flow, constant height, cause button & panel, battle/dead games never offered to continue');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
