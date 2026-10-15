const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  
  await page.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
  await page.route('http://127.0.0.1:8888/**', r => r.fulfill({ json: { ok: true, status: 'playing', p1: {}, p2: {} } }));
  await page.addInitScript(() => {
    window.AndroidBridge = {
      getDeviceStatus: () => JSON.stringify({ level: 80, wifi: true, cellular: false, charging: false, ringer: 'normal', dnd: false, internet: true, safeTop: 32 }),
      isWifiConnected: () => true,
      isMobileDataEnabled: () => false,
      getVersion: () => '1.1.15'
    };
  });

  await page.goto('file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  await page.waitForFunction(() => window.app);

  console.log('--- 1. Testing button icons (no inverted exclamation mark / info icon leakage) ---');
  const brokenButtons = await page.evaluate(() => {
    // Check all buttons for line-icon with path containing 'M12 11v6m0-10v1' (info path)
    const broken = [];
    document.querySelectorAll('button').forEach(btn => {
      const svgs = btn.querySelectorAll('svg.line-icon path');
      svgs.forEach(p => {
        const d = p.getAttribute('d') || '';
        if (d.includes('M12 11v6m0-10v1')) {
          broken.push({ id: btn.id, cls: btn.className, text: btn.textContent.trim() });
        }
      });
    });
    return broken;
  });
  assert.equal(brokenButtons.length, 0, `Found broken buttons with info icon: ${JSON.stringify(brokenButtons)}`);
  console.log('PASS: No broken buttons found (0 broken buttons with info icon).');

  console.log('--- 2. Testing replay controls order ---');
  const orderCheck = await page.evaluate(() => {
    const panel = document.querySelector('.replay-controls-panel');
    const oppPanel = document.getElementById('replay-battle-opp-panel');
    const playBar = document.querySelector('.replay-playback-bar');
    const sliderWrap = document.querySelector('.replay-slider-wrap');
    
    // Play bar and slider must be placed BEFORE opponent panel in DOM order
    const isSliderBeforeOpp = !!(sliderWrap.compareDocumentPosition(oppPanel) & Node.DOCUMENT_POSITION_FOLLOWING);
    const isPlayBarBeforeOpp = !!(playBar.compareDocumentPosition(oppPanel) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { isSliderBeforeOpp, isPlayBarBeforeOpp };
  });
  assert.ok(orderCheck.isSliderBeforeOpp, 'Slider must be before opponent panel');
  assert.ok(orderCheck.isPlayBarBeforeOpp, 'Playback buttons must be before opponent panel');
  console.log('PASS: Replay controls are placed above opponent panel for optimal mobile reachability.');

  console.log('--- 3. Testing opponent replay board rendering (grid, cage sum, notes) ---');
  const oppBoardResult = await page.evaluate(() => {
    const dummyReplay = {
      mode: 'battle',
      battleMode: 'race',
      difficulty: 'easy',
      moves: [],
      cages: [
        { sum: 11, cells: [[0, 0], [0, 1]], labelCell: [0, 0] },
        { sum: 7, cells: [[0, 2]], labelCell: [0, 2] }
      ],
      oppTimeline: [
        {
          step: 0,
          board: '000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          notes: '12;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;'
        },
        {
          step: 1,
          board: '500000000000000000000000000000000000000000000000000000000000000000000000000000000',
          notes: ';45;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;'
        }
      ]
    };
    app.renderReplayOppBoard(dummyReplay, dummyReplay.oppTimeline[0].board, dummyReplay.oppTimeline[0].notes);
    const el = document.getElementById('replay-opp-board');
    const cell0 = el.children[0];
    const sumEl = cell0.querySelector('.cell-cage-sum');
    const notesEl = cell0.querySelector('.cell-notes');
    const note1 = notesEl ? notesEl.querySelector('[data-note="1"]').textContent : '';
    const note2 = notesEl ? notesEl.querySelector('[data-note="2"]').textContent : '';
    const hasCageBorder = !!cell0.querySelector('.cage-inset-border');
    const hasBoxRight = cell0.classList.contains('border-box-right') || el.children[2].classList.contains('border-box-right');
    const hasBoxBottom = el.children[18].classList.contains('border-box-bottom');

    // Step 2 update
    app.renderReplayOppBoard(dummyReplay, dummyReplay.oppTimeline[1].board, dummyReplay.oppTimeline[1].notes);
    const val0 = cell0.querySelector('.cell-value').textContent;
    const cell1 = el.children[1];
    const notes1 = cell1.querySelector('.cell-notes');
    const note4InCell1 = notes1 ? notes1.querySelector('[data-note="4"]').textContent : '';

    return {
      sumText: sumEl ? sumEl.textContent : '',
      note1,
      note2,
      hasCageBorder,
      hasBoxRight,
      hasBoxBottom,
      val0,
      note4InCell1
    };
  });

  assert.equal(oppBoardResult.sumText, '11', 'Cage sum badge must be 11');
  assert.equal(oppBoardResult.note1, '1', 'Note 1 must be rendered in step 0');
  assert.equal(oppBoardResult.note2, '2', 'Note 2 must be rendered in step 0');
  assert.ok(oppBoardResult.hasCageBorder, 'Cage inset border must be rendered');
  assert.ok(oppBoardResult.hasBoxRight, '3x3 box vertical divider must be rendered');
  assert.ok(oppBoardResult.hasBoxBottom, '3x3 box horizontal divider must be rendered');
  assert.equal(oppBoardResult.val0, '5', 'Cell value must be 5 in step 1');
  assert.equal(oppBoardResult.note4InCell1, '4', 'Note 4 must be rendered in cell 1 in step 1');
  console.log('PASS: Opponent replay board properly displays accurate grid, cage sums, notes, and values.');

  console.log('--- 4. Testing speed race & score mode: infinite lives and mistake penalty ---');
  // 1) Test Timeattack mode (single mode)
  const timeattackResult = await page.evaluate(() => {
    const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => (r * 3 + Math.floor(r / 3) + c) % 9 + 1));
    const cages = solution.flatMap((row, r) => row.map((sum, c) => ({ sum, cells: [[r, c]] })));
    app.sound.play = () => {};
    app.startNewGame('easy', null, 'timeattack', { solution, cages, anchorCount: 0 });
    app.stopTimer();
    clearInterval(app.timerInterval);

    const initialLives = app.dom.mistakes.textContent;
    const initialScore = app.score;

    app.selected = { r: 0, c: 0 };
    app.handleNumberInput((solution[0][0] % 9) + 1);
    const after1Lives = app.dom.mistakes.textContent;
    const after1Score = app.score;

    for (let i = 1; i < 4; i++) {
      app.selected = { r: 0, c: i };
      app.handleNumberInput((solution[0][i] % 9) + 1);
    }
    const after4Lives = app.dom.mistakes.textContent;
    const after4Mistakes = app.mistakes;

    return {
      initialLives,
      after1Lives,
      scoreDelta: after1Score - initialScore,
      after4Lives,
      after4Mistakes,
      isPaused: app.isPaused,
      isWin: app.isWin
    };
  });
  assert.equal(timeattackResult.initialLives, '0 / ∞', 'Timeattack lives must start at 0 / ∞');
  assert.equal(timeattackResult.scoreDelta, -200, 'First mistake in timeattack must deduct 200 points');
  assert.equal(timeattackResult.after1Lives, '1 / ∞', 'Lives must update to 1 / ∞');
  assert.equal(timeattackResult.after4Lives, '4 / ∞', 'Lives must update to 4 / ∞ after 4 mistakes');
  assert.equal(timeattackResult.isPaused, false, 'Game must not be paused/over after 4 mistakes');
  console.log('PASS: Timeattack mode infinite lives & mistake penalty verified.');

  // 2) Test Battle Race & Score rules normalization & initialization
  const battleRulesResult = await page.evaluate(() => {
    const puzzle = {
      rules: { maxLives: '3', mistakeLimit: true, livesExhaustedAction: 'game_over' },
      difficulty: 'easy'
    };
    app.sound.play = () => {};
    // Test normalizedRules helper directly
    const raceRules = normalizedRules(puzzle.rules, 'race');
    const scoreRules = normalizedRules(puzzle.rules, 'score');
    const turnRules = normalizedRules(puzzle.rules, 'turn');

    // Test in-app battle setup for race
    const solution = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => (r * 3 + Math.floor(r / 3) + c) % 9 + 1));
    const cages = solution.flatMap((row, r) => row.map((sum, c) => ({ sum, cells: [[r, c]] })));
    app.battleHostIp = '127.0.0.1';
    app.battleHostUrl = 'http://127.0.0.1:8888';
    app.battleFetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, status: 'playing' }) });

    // Mock startNewGame to avoid heavy DOM rebuild during test
    const origStartNewGame = app.startNewGame;
    let newGameCalledWithRules = null;
    app.startNewGame = function(diff, rng, mode, pData) {
      newGameCalledWithRules = { ...app.rules };
    };

    app.startBattleMatch(1, { solution, cages, rules: puzzle.rules }, 'race');
    clearInterval(app.battlePollInterval);
    const raceBattleRules = { ...app.rules };
    const raceMaxMistakes = app.maxMistakes;

    app.startBattleMatch(1, { solution, cages, rules: puzzle.rules }, 'score');
    clearInterval(app.battlePollInterval);
    const scoreBattleRules = { ...app.rules };
    const scoreMaxMistakes = app.maxMistakes;

    app.startNewGame = origStartNewGame;

    return {
      raceRules,
      scoreRules,
      turnRules,
      raceBattleRules,
      raceMaxMistakes,
      scoreBattleRules,
      scoreMaxMistakes
    };
  });

  assert.equal(battleRulesResult.raceRules.maxLives, 'unlimited', 'Race mode maxLives must be unlimited');
  assert.equal(battleRulesResult.raceRules.mistakeLimit, false, 'Race mode mistakeLimit must be false');
  assert.equal(battleRulesResult.raceRules.livesExhaustedAction, 'continue', 'Race mode livesExhaustedAction must be continue');

  assert.equal(battleRulesResult.scoreRules.maxLives, 'unlimited', 'Score mode maxLives must be unlimited');
  assert.equal(battleRulesResult.scoreRules.mistakeLimit, false, 'Score mode mistakeLimit must be false');
  assert.equal(battleRulesResult.scoreRules.livesExhaustedAction, 'continue', 'Score mode livesExhaustedAction must be continue');

  assert.equal(battleRulesResult.turnRules.maxLives, '3', 'Turn mode retains configured maxLives');
  assert.equal(battleRulesResult.turnRules.mistakeLimit, true, 'Turn mode retains mistakeLimit');

  assert.equal(battleRulesResult.raceBattleRules.maxLives, 'unlimited', 'startBattleMatch must enforce unlimited lives for race');
  assert.equal(battleRulesResult.raceBattleRules.mistakeLimit, false, 'startBattleMatch must enforce mistakeLimit false for race');
  assert.equal(battleRulesResult.raceMaxMistakes, 999999, 'startBattleMatch maxMistakes must be 999999 for race');

  assert.equal(battleRulesResult.scoreBattleRules.maxLives, 'unlimited', 'startBattleMatch must enforce unlimited lives for score');
  assert.equal(battleRulesResult.scoreBattleRules.mistakeLimit, false, 'startBattleMatch must enforce mistakeLimit false for score');
  assert.equal(battleRulesResult.scoreMaxMistakes, 999999, 'startBattleMatch maxMistakes must be 999999 for score');
  console.log('PASS: Battle race & score modes infinite lives rules verification passed.');

  console.log('\n=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  try { await browser.close(); } catch (_) {}
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
