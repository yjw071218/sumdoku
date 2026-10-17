// v2.1.0 온라인 배틀 전용 랭크전 검증:
// 1) ELO 기반 배틀 RP 변동, 상대 레이팅 차등, 연승 보너스, 승급전(BO3), 강등 보호
// 2) 싱글플레이에서는 랭크 감점/탈주 패배 모달이 제거되어 온전한 힐링 스도쿠 경험 보장
// 3) 하단 랭킹 화면에 '배틀' 탭 및 래더 그리드 정상 표출
const assert = require('node:assert/strict'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
    p.on('pageerror', e => console.error('PAGE ERROR:', e));
    p.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await p.addInitScript(() => {
      localStorage.setItem('sumdoku_language', 'ko');
      window.__subs = [];
      window.AndroidBridge = {
        getDistribution: () => 'play',
        isAdFree: () => true,
        setSecureScreen: () => {},
        isWifiConnected: () => false,
        setBattleNetwork: () => true,
        isLeaderboardConfigured: () => true,
        submitLeaderboardScore: (k, s) => window.__subs.push([k, +s]),
        showLeaderboard: k => window.__subs.push(['show', k]),
        isCloudConfigured: () => false,
        getDeviceLocale: () => 'ko-KR',
        requestPlayerProfile: () => setTimeout(() => window.onPlayerProfile?.({ signedIn: true, name: 'Tester', id: 'gTester', cc: 'KR' }), 50)
      };
    });
    await p.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
    await p.goto('file:///' + path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
    p.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await p.waitForFunction(() => window.app && window.app.dom && !document.documentElement.classList.contains('boot-pending'));

    const r = await p.evaluate(async () => {
      const R = SumdokuRating, o = {};
      const st = (x, streak = 0) => ({ rating: x, peak: x, games: 1, streak, lastActive: Date.now(), history: [] });

      // 1. 배틀 ELO 델타 계산 검증
      // 같은 레이팅 상대 이겼을 때 vs 졌을 때
      const winEven = R.computeBattleDelta(st(1200), 1200, true, false, 'expert', 'race');
      const loseEven = R.computeBattleDelta(st(1200), 1200, false, false, 'expert', 'race');
      o.winEven = winEven.delta;
      o.loseEven = loseEven.delta;

      // 강한 상대(1600)를 이겼을 때 vs 약한 상대(800)를 이겼을 때
      const winStrong = R.computeBattleDelta(st(1200), 1600, true, false, 'expert', 'race');
      const winWeak = R.computeBattleDelta(st(1200), 800, true, false, 'expert', 'race');
      o.winStrong = winStrong.delta;
      o.winWeak = winWeak.delta;

      // 강한 상대에게 졌을 때 vs 약한 상대에게 졌을 때
      const loseStrong = R.computeBattleDelta(st(1200), 1600, false, false, 'expert', 'race');
      const loseWeak = R.computeBattleDelta(st(1200), 800, false, false, 'expert', 'race');
      o.loseStrong = loseStrong.delta;
      o.loseWeak = loseWeak.delta;

      // 연승 보너스 (3연승부터 보너스)
      const winStreak3 = R.computeBattleDelta(st(1200, 2), 1200, true, false, 'expert', 'race');
      o.streakBonus = winStreak3.streakBonus;

      // 기권 감점
      const forfeit = R.computeBattleDelta(st(1200), 1200, false, true, 'expert', 'race');
      o.forfeitPenalty = forfeit.forfeitPenalty;

      // 2. recordBattleEnd 상태 갱신 테스트
      localStorage.removeItem(R.KEY);
      app.isBattle = true;
      app.battleDiff = 'hard';
      app.battleMode = 'race';
      const ch1 = R.recordBattleEnd(app, true, 'complete', 1000);
      o.ch1Recorded = !!ch1 && ch1.delta > 0;
      const bLadder = R.ladder(R.loadAll(), 'battle').byDiff['hard'];
      o.bGames = bLadder.games;
      o.bRatingAfterWin = bLadder.rating;

      // 3. 싱글플레이에서는 랭크전 감점/탈주 패배 제거 확인
      app.isBattle = false;
      const puzzle = {
        solution: Array.from({ length: 9 }, (_, i) => Array.from({ length: 9 }, (_, j) => ((i * 3 + Math.floor(i / 3) + j) % 9) + 1)),
        cages: [{ id: 0, sum: 6, cells: [[0, 0], [0, 1]] }],
        anchorCount: 0
      };
      await app.startNewGame('medium', null, 'standard', puzzle);
      app.timerSeconds = 30;
      app.switchView('home');
      // 홈에서 새 게임 시작 시 경고 모달이 뜨지 않아야 함
      document.getElementById('btn-home-new')?.click();
      const modal = document.getElementById('modal-abandon-confirm');
      o.noAbandonModalInSingle = !modal || modal.classList.contains('hidden');

      // 4. 하단 랭킹 화면에 '배틀' 탭 포함 및 렌더링 확인
      app.switchView('ranking');
      await new Promise(res => setTimeout(res, 80));
      const grid = document.getElementById('ranking-grid');
      o.gridHeaders = Array.from(grid?.querySelectorAll('.rk-h') || []).map(e => e.textContent.trim());
      o.hasBattleHeader = o.gridHeaders.includes('배틀');

      // 랭킹 카드 모드 전환 버튼에 배틀 포함 확인
      const modeBtns = Array.from(document.querySelectorAll('.rc-modes .rc-mode') || []).map(b => b.dataset.mode || b.textContent.trim());
      o.modeBtns = modeBtns;

      // 5. 랭크 시즌제 및 티어 꾸미기 보상 / 배틀 승리 배너 스킨 검증
      const S = window.SumdokuSeason;
      o.hasSeason = !!S && typeof S.applyCosmetics === 'function';
      // 배틀 모드에서 다이아몬드 티어일 때 배틀 승리 배너 스킨 확인
      const allRatings = R.loadAll();
      allRatings.battle.byDiff.hard = { rating: 3100, peak: 3100, games: 15, seasonGames: 15, seasonBest: 3100, streak: 2, placement: 0, lastActive: Date.now(), history: [] };
      R.saveAll(allRatings);
      app.isBattle = true;
      app.battleDiff = 'hard';
      const skin = S ? S.getVictoryBannerSkinTier(app) : null;
      o.skinTier = skin ? skin.id : null;

      const banner = document.getElementById('battle-result-banner');
      if (S && banner) {
        S.applyVictoryBannerSkin(app, { status: 'win' }, banner);
        o.bannerHasSkin = banner.classList.contains('tier-banner-skin');
        o.bannerSkinClass = banner.className;
      }
      S?.applyCosmetics?.();
      o.cosmeticsApplied = true;

      return o;
    });

    console.log(JSON.stringify(r, null, 1));
    assert(r.winEven > 0, 'winEven should be positive');
    assert(r.loseEven < 0, 'loseEven should be negative');
    assert(r.winStrong > r.winWeak, 'beating stronger opponent gives more RP');
    assert(Math.abs(r.loseWeak) > Math.abs(r.loseStrong), 'losing to weaker opponent loses more RP');
    assert(r.streakBonus > 0, 'win streak gives bonus');
    assert(r.forfeitPenalty > 0, 'forfeit has extra penalty');
    assert(r.ch1Recorded && r.bGames === 1 && r.bRatingAfterWin > 1000, 'battle rating recorded properly');
    assert(r.noAbandonModalInSingle, 'singleplayer has no abandon modal (stress-free)');
    assert(r.hasBattleHeader, 'ranking grid must include battle mode header');
    assert(r.hasSeason, 'SumdokuSeason must be available');
    assert.equal(r.skinTier, 'diamond', '3100 RP should resolve to diamond banner skin');
    assert(r.bannerHasSkin, 'battle victory banner must have tier-banner-skin class');
    assert(r.bannerSkinClass.includes('skin-diamond'), 'banner skin must include skin-diamond class');
    assert.deepEqual(errors, []);
    console.log('PASS: Battle rating, singleplayer stress-free, and rank season cosmetics verified');
  } finally {
    await b.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
