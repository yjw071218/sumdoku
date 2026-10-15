const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
  const p = await b.newPage();
  await p.addInitScript(() => localStorage.setItem('sumdoku_language', 'ja'));
  await p.goto('file:///' + path.resolve('app/src/main/assets/index.html').replace(/\\/g, '/'));
  await p.waitForFunction(() => window.app);
  
  const allHangul = new Set();
  const allSamples = new Map();
  for (const diff of ['easy', 'medium', 'hard', 'expert']) {
    await p.evaluate(async (d) => {
      app.startNewGame(d);
      await new Promise(res => {
        const t = setInterval(() => {
          if (app.cages?.length && app.currentView === 'game') { clearInterval(t); res(); }
        }, 40);
      });
    }, diff);

    for (let k = 0; k < 25; k++) {
      const stepInfo = await p.evaluate(async () => {
        const h = app.findImmediateHint();
        if (!h) return null;
        app.showImmediateHint();
        await new Promise(r => setTimeout(r, 60));

        const st = window.SumdokuHintVisual?.state();
        const unloc = [];
        if (st && st.steps) {
          for (let s = 0; s < st.steps.length; s++) {
            window.SumdokuHintVisual.go(s, false);
            // Click all detail buttons in this step
            document.querySelectorAll('#hint-logic-text .hv-more').forEach(btn => {
              if (btn.getAttribute('aria-expanded') === 'false') btn.click();
            });

            // Read the entire floating card text
            const cardText = document.getElementById('floating-hint-card')?.innerText || '';
            const matches = cardText.match(/[가-힣]+/g);
            if (matches) {
              unloc.push({ step: s, text: cardText, hangul: matches });
            }
          }
        }
        app.board[h.r][h.c].val = h.answer;
        app.dismissDeductiveHint();
        return unloc;
      });

      if (!stepInfo) break;
      for (const info of stepInfo) {
        for (const h of info.hangul) {
          allHangul.add(h);
          if (!allSamples.has(h)) {
            const line = info.text.split('\n').find(l => l.includes(h));
            allSamples.set(h, line);
          }
        }
      }
    }
  }
  console.log('Unique Hangul words found in ja mode:', [...allHangul]);
  for (const [h, line] of allSamples.entries()) {
    console.log(`Word [${h}] in line:`, line);
  }
  await b.close();
})();
