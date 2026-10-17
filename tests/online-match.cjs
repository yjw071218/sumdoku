// v2.0.1 · 온라인 랜덤 매칭 E2E: 실제 공개 WebTorrent 트래커로 두 브라우저를 매칭하고,
// WebRTC DataChannel 터널을 통해 방장 기기의 루프백 BattleServer(127.0.0.1:8888)로 경기를 시작하는지 확인합니다.
// 사전 준비: 루프백 BattleServer를 8888 포트로 실행해 두어야 합니다(BattleServer.startLoopback).
// 실행: PLAYWRIGHT_MODULE=playwright-core 경로 node tests/online-match.cjs
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const INDEX = 'file:///' + path.resolve(__dirname, '../app/src/main/assets/index.html').split(path.sep).join('/');
const ZONE = process.env.ZONE || 'global';
// ZONE_B를 다르게 주면 '구역 분리' 검사: 서로 다른 구역끼리는 매칭되면 안 됩니다.
const ZONE_B = process.env.ZONE_B || ZONE;
const SEPARATE = ZONE_B !== ZONE;
// ROOM=1: A가 6자리 원격 방을 만들고 B가 번호로 참가합니다. LOGIN=0: B는 Play 게임즈 로그인 거부 → 배틀 진입 차단 확인.
const ROOM = process.env.ROOM === '1';
const NOLOGIN = process.env.LOGIN === '0';
const DIST = process.env.DIST || 'play';

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const open = async (name, zone, lang = 'ko', login = true) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('https://api.github.com/**', r => r.fulfill({ json: {} }));
    await p.addInitScript(({ zone, lang, nick, login, dist }) => {
      localStorage.setItem('sumdoku_language', lang);
      localStorage.setItem('sumdoku_theme', 'theme-dark');
      localStorage.setItem('sumdoku_online_zone', zone);
      localStorage.setItem('sumdoku_online_mode', 'race');
      localStorage.setItem('sumdoku_online_diff', 'easy');
      window.AndroidBridge = {
        getDistribution: () => dist, isAdFree: () => true, setSecureScreen: () => {},
        isWifiConnected: () => false, setBattleNetwork: () => true,
        startOnlineBattleServer: () => JSON.stringify({ ok: true, ip: '127.0.0.1', port: 8888 }),
        stopBattleServer: () => {}, dhtStart: () => false, dhtStop: () => {}, dhtSend: () => {},
        copyToClipboard: () => {},
        // Google Play 게임즈 로그인 흉내: 표시 이름과 Play 계정 국가를 돌려줍니다.
        requestPlayerProfile: interactive => setTimeout(() => window.onPlayerProfile(login
          ? { signedIn: true, name: nick, id: 'g' + nick, cc: lang === 'ja' ? 'JP' : 'KR' }
          : { signedIn: false, reason: interactive ? 'canceled' : 'signed_out' }), 50)
      };
    }, { zone, lang, nick: 'Play' + name, login, dist: DIST });
    await p.goto(INDEX);
    await p.waitForFunction(() => window.app && window.OnlineMatch && !document.documentElement.classList.contains('boot-pending'));
    return { p, errs, name };
  };
  const A = await open('A', ZONE, 'ko'), B = await open('B', ZONE_B, 'ja', !NOLOGIN);
  if (NOLOGIN) {
    await B.p.evaluate(() => app.openBattleLobby());
    await B.p.waitForTimeout(800);
    const hidden = await B.p.evaluate(() => document.getElementById('modal-battle-lobby').classList.contains('hidden'));
    const blocked = DIST === 'github' ? !hidden : hidden;
    console.log(blocked ? (DIST === 'github' ? 'PASS: GitHub build opens battle without sign-in' : 'PASS: Play build blocks battle without sign-in') : 'FAIL: login gate ' + DIST);
    await browser.close(); process.exit(blocked ? 0 : 1);
  }

  // 부팅 깜빡임 수정 확인: 저장된 다크 테마가 공개 시점에 이미 적용되어 있어야 합니다.
  const themeA = await A.p.evaluate(() => document.getElementById('app').className);
  console.log('boot theme:', themeA.includes('theme-dark') ? 'OK (dark applied before reveal)' : 'FAIL ' + themeA);

  for (const X of [A, B]) {
    await X.p.evaluate(() => app.openBattleLobby());
    await X.p.waitForSelector('#modal-battle-lobby:not(.hidden)');
    // v2.0.4: 로비가 바로 온라인 화면으로 열립니다(탭 없음).
    await X.p.waitForSelector('#battle-online-view .om-start');
  }
  if (ROOM) {
    // 원격 방: 서로 다른 구역·모드여도 번호만 같으면 연결되어야 합니다(방장 설정을 따름).
    await B.p.evaluate(() => { OnlineMatch.setMode('score'); OnlineMatch.setZone('americas'); });
    for (const X of [A, B]) await X.p.click('#battle-online-view .om-kind[data-kind="room"]');
    await A.p.click('#battle-online-view .om-room-create');
    const code = await A.p.evaluate(() => OnlineMatch.roomCode);
    const shown = await A.p.evaluate(() => document.querySelector('.om-room-code').textContent);
    console.log('room code', code, 'shown', JSON.stringify(shown));
    await B.p.fill('#battle-online-view .om-room-input', code);
    await B.p.click('#battle-online-view .om-room-join');
  } else {
    for (const X of [A, B]) await X.p.click('#battle-online-view .om-start');
  }
  const t0 = Date.now();
  const deadline = t0 + (SEPARATE ? 30000 : 150000);
  let last = '';
  while (Date.now() < deadline) {
    const s = await Promise.all([A, B].map(X => X.p.evaluate(() => ({
      st: OnlineMatch.state, role: OnlineMatch.role, peers: OnlineMatch.peers.size,
      trackers: OnlineMatch.trackers.filter(t => t.open).length, battle: !!app.isBattle, view: app.currentView
    }))));
    const line = JSON.stringify(s);
    if (line !== last) { console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', line); last = line; }
    if (s[0].battle && s[1].battle) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (SEPARATE) {
    const st = await Promise.all([A, B].map(X => X.p.evaluate(() => OnlineMatch.state + '/' + OnlineMatch.peers.size)));
    const sepOk = st.every(x => x.startsWith('searching/0'));
    console.log(sepOk ? `PASS: zones ${ZONE} / ${ZONE_B} stayed separated (${st})` : `FAIL: cross-zone contact ${st}`);
    await browser.close(); process.exit(sepOk ? 0 : 1);
  }
  // 닉네임·국기·티어 교환과 다국어 확인
  const prof = await Promise.all([A, B].map(X => X.p.evaluate(() => ({ p2: app.dom.battleP2Name.textContent, p1: app.dom.battleP1Name.textContent, tab: document.getElementById('tab-battle-online').textContent, partner: OnlineMatch.partnerProfile }))));
  console.log('profiles', JSON.stringify(prof));
  const profOk = prof[0].p2.includes('PlayB') && prof[1].p2.includes('PlayA') && prof[0].p2.includes('🇯🇵') && prof[1].p2.includes('🇰🇷') && prof[1].tab.includes('オンライン') && prof[0].tab.includes('온라인');
  console.log(profOk ? 'PASS: Play Games names + Play country flags exchanged, HUD shows opponent, tab localized (ko/ja)' : 'FAIL: profile');
  const fin = await Promise.all([A, B].map(X => X.p.evaluate(() => ({ battle: !!app.isBattle, role: app.battleRole, url: app.battleHostUrl, sol: JSON.stringify(app.solution), rules: app.gameRules }))));
  const ok = fin[0].battle && fin[1].battle && fin[0].sol === fin[1].sol && fin[0].role !== fin[1].role;
  console.log('roles', fin.map(f => f.role), 'guest url', fin.find(f => f.role === 2)?.url);
  console.log('rules', JSON.stringify(fin[0].rules));
  if (ROOM) {
    const modes = await Promise.all([A, B].map(X => X.p.evaluate(() => app.battleMode)));
    const roomOk = modes[0] === 'race' && modes[1] === 'race';
    console.log(roomOk ? 'PASS: remote room by 6-digit code, guest followed host mode (race)' : 'FAIL: room mode ' + modes);
    if (!roomOk) { await browser.close(); process.exit(1); }
  }
  console.log(ok ? 'PASS: matched over public trackers, same puzzle on both sides' : 'FAIL');
  // 진행 동기화: 참가자 진행이 방장에게 전달되는지
  if (ok) {
    await new Promise(r => setTimeout(r, 4000));
    const opp = await Promise.all([A, B].map(X => X.p.evaluate(() => JSON.stringify(app.oppState))));
    console.log('oppState', opp);
  }
  console.log('errors', A.errs, B.errs);
  await browser.close();
  process.exit(ok && profOk ? 0 : 1);
})();
