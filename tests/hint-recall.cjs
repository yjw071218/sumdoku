const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = 'file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('sumdoku_language', 'ja'));
    await page.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
    await page.goto(url);
    await page.waitForFunction(() => window.app);

    const res = await page.evaluate(async () => {
      app.startNewGame('easy');
      await new Promise(res => {
        const t = setInterval(() => {
          if (app.cages?.length && app.currentView === 'game' && app.solution) {
            clearInterval(t);
            res();
          }
        }, 40);
      });
      await new Promise(r => setTimeout(r, 600));

      const fab = () => document.getElementById('btn-hint-recall');
      const isFabVisible = () => {
        const f = fab();
        if (!f || f.classList.contains('hidden')) return false;
        const style = getComputedStyle(f);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };
      const isCardOpen = () => app.dom.floatingHintCard && !app.dom.floatingHintCard.classList.contains('hidden');

      const log = {};

      // 1. 초기 상태: FAB 숨김
      log.initialFab = isFabVisible();

      // 2. 힌트 요청
      const scoreBefore = app.score;
      const hintsBefore = app.hintsRemaining;
      const hintsUsedBefore = app.hintsUsed || 0;
      app.showImmediateHint();
      await new Promise(r => setTimeout(r, 300));

      log.cardOpenAfterHint = isCardOpen();
      log.fabOpenDuringCard = isFabVisible();
      const scoreAfterFirstHint = app.score;
      const hintsAfterFirstHint = app.hintsRemaining;
      const hintsUsedAfterFirstHint = app.hintsUsed;
      const targetCell = { r: app.pendingHint.r, c: app.pendingHint.c, answer: app.pendingHint.answer };

      // 3. 힌트 카드 닫기 (칸 채우지 않음)
      app.dismissDeductiveHint();
      await new Promise(r => setTimeout(r, 200));

      log.cardOpenAfterDismiss = isCardOpen();
      log.fabVisibleAfterDismiss = isFabVisible();
      log.fabLabel = fab()?.getAttribute('aria-label');
      log.fabBadge = fab()?.querySelector('.fab-pos-badge')?.textContent;

      // 4. FAB 클릭 -> 힌트 재표시 (추가 감점/차감 없음)
      fab().click();
      await new Promise(r => setTimeout(r, 300));

      log.cardOpenAfterRecall = isCardOpen();
      log.fabVisibleDuringRecall = isFabVisible();
      log.scoreAfterRecall = app.score;
      log.hintsAfterRecall = app.hintsRemaining;
      log.hintsUsedAfterRecall = app.hintsUsed;
      log.recalledCell = { r: app.pendingHint.r, c: app.pendingHint.c, answer: app.pendingHint.answer };

      // 5. 다시 닫기 -> FAB 재등장
      app.dismissDeductiveHint();
      await new Promise(r => setTimeout(r, 200));
      log.fabVisibleAfterSecondDismiss = isFabVisible();

      // 6. 화면 전환 (home으로) -> FAB 숨김
      app.switchView('home');
      await new Promise(r => setTimeout(r, 100));
      log.fabVisibleInHome = isFabVisible();

      // 다시 게임 뷰로 -> FAB 복원
      app.switchView('game');
      await new Promise(r => setTimeout(r, 100));
      log.fabRestoredInGame = isFabVisible();

      // 7. 대상 칸 채우기 -> FAB 소멸
      app.board[targetCell.r][targetCell.c].val = targetCell.answer;
      app.updateBoardDisplay();
      await new Promise(r => setTimeout(r, 200));
      log.fabVisibleAfterFill = isFabVisible();
      log.unsolvedHintNull = app.unsolvedHint === null;

      // 8. 새 게임 시작 -> FAB 완전 소멸 유지
      app.startNewGame('easy');
      await new Promise(r => setTimeout(r, 300));
      log.fabVisibleAfterNewGame = isFabVisible();

      return {
        log,
        scoreBefore,
        scoreAfterFirstHint,
        hintsBefore,
        hintsAfterFirstHint,
        hintsUsedBefore,
        hintsUsedAfterFirstHint
      };
    });

    console.log('Result:', JSON.stringify(res.log, null, 2));

    assert.equal(res.log.initialFab, false, 'FAB should be hidden initially');
    assert.equal(res.log.cardOpenAfterHint, true, 'Card should be open after hint');
    assert.equal(res.log.fabOpenDuringCard, false, 'FAB should be hidden while card is open');
    assert.equal(res.log.cardOpenAfterDismiss, false, 'Card should be closed after dismiss');
    assert.equal(res.log.fabVisibleAfterDismiss, true, 'FAB should be visible when dismissed with empty target cell');
    assert.equal(res.log.fabLabel, 'ヒントを再表示', 'FAB label should be translated to Japanese');
    assert.match(res.log.fabBadge, /^\d+行\d+列$/, 'FAB badge should be in Japanese pos format (e.g., 1行4列)');

    assert.equal(res.log.cardOpenAfterRecall, true, 'Card should reopen on recall');
    assert.equal(res.log.fabVisibleDuringRecall, false, 'FAB should hide while reopened');
    assert.equal(res.log.scoreAfterRecall, res.scoreAfterFirstHint, 'Score should NOT be deducted again on recall');
    assert.equal(res.log.hintsAfterRecall, res.hintsAfterFirstHint, 'Hints should NOT be decremented again on recall');
    assert.equal(res.log.hintsUsedAfterRecall, res.hintsUsedAfterFirstHint, 'Hints used count should NOT increase on recall');

    assert.equal(res.log.fabVisibleAfterSecondDismiss, true, 'FAB should reappear after dismissing again');
    assert.equal(res.log.fabVisibleInHome, false, 'FAB should hide when leaving game view');
    assert.equal(res.log.fabRestoredInGame, true, 'FAB should restore when returning to game view');
    assert.equal(res.log.fabVisibleAfterFill, false, 'FAB should disappear once target cell is filled');
    assert.equal(res.log.unsolvedHintNull, true, 'unsolvedHint should be cleared once cell is filled');
    assert.equal(res.log.fabVisibleAfterNewGame, false, 'FAB should remain hidden in new game');

    assert.deepEqual(errors, []);
    console.log('PASS: hint-recall test passed completely!');
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exit(1);
});
