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
      // 판이 처음 뜬 시각 기록(양쪽 동시 표시 확인용)
      setInterval(() => { if (window.app && app.isBattle && !window.__boardAt) window.__boardAt = Date.now(); if (window.app && !app.isBattle) window.__boardAt = 0; }, 5);
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
    // v2.0.5: 방 화면이 새 전체 화면으로 뜨고, 방장이 그 안에서 설정을 바꿉니다.
    await A.p.waitForSelector('#om-room-screen:not(.hidden)');
    await A.p.click('#om-room-screen .om-r-modes .om-chip:nth-child(3)');   // 서바이벌
    await A.p.click('#om-room-screen .om-r-lives .om-chip:nth-child(2)');   // 목숨 2
    await A.p.click('#om-room-screen .om-r-hints .om-chip:nth-child(2)');   // 힌트 1
    await A.p.click('#om-room-screen .om-r-auto .om-chip:nth-child(2)');    // 자동 메모 끔
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
  let last = '', startedByHost = false;
  while (Date.now() < deadline) {
    const s = await Promise.all([A, B].map(X => X.p.evaluate(() => ({
      st: OnlineMatch.state, role: OnlineMatch.role, peers: OnlineMatch.peers.size,
      trackers: OnlineMatch.trackers.filter(t => t.open).length, battle: !!app.isBattle, view: app.currentView
    }))));
    const line = JSON.stringify(s);
    if (line !== last) { console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', line); last = line; }
    if (s[0].battle && s[1].battle) break;
    if (ROOM && s[0].st === 'matched' && !s[0].battle && !startedByHost) {
      const joined = await A.p.evaluate(() => !!app.guestJoined);
      if (joined) {
        await new Promise(r => setTimeout(r, 3000));
        const auto = await A.p.evaluate(() => !!app.isBattle);
        const guestUi = await B.p.evaluate(() => ({ open: !document.getElementById('om-room-screen').classList.contains('hidden'), ro: document.querySelector('#om-room-screen .om-r-modes .om-chip').disabled, mode: OnlineMatch.roomCfg.mode }));
        console.log(!auto ? 'PASS: room did not auto-start after guest joined' : 'FAIL: room auto-started');
        console.log(guestUi.open && guestUi.ro && guestUi.mode === 'survival' ? 'PASS: guest sees room screen with read-only host settings' : 'FAIL: guest room ui ' + JSON.stringify(guestUi));
        // v2.0.7: 참가자가 준비하기 전에는 시작 버튼이 꺼져 있어야 합니다.
        const before = await A.p.evaluate(() => document.querySelector('#om-room-screen .om-room-start').disabled);
        await B.p.click('#om-room-screen .om-room-ready');
        await A.p.waitForFunction(() => OnlineMatch.guestReady && !document.querySelector('#om-room-screen .om-room-start').disabled, null, { timeout: 8000 });
        console.log(before ? 'PASS: start disabled until guest is ready, enabled after Ready' : 'FAIL: start enabled before ready');
        await A.p.click('#om-room-screen .om-room-start');
        startedByHost = true;
      }
    }
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
  const at = await Promise.all([A, B].map(X => X.p.evaluate(() => window.__boardAt)));
  const gap = Math.abs(at[0] - at[1]);
  console.log(gap <= 150 ? `PASS: boards appeared ${gap} ms apart` : `FAIL: boards ${gap} ms apart`);
  const fin = await Promise.all([A, B].map(X => X.p.evaluate(() => ({ battle: !!app.isBattle, role: app.battleRole, url: app.battleHostUrl, sol: JSON.stringify(app.solution), rules: app.gameRules }))));
  const ok = fin[0].battle && fin[1].battle && fin[0].sol === fin[1].sol && fin[0].role !== fin[1].role;
  console.log('roles', fin.map(f => f.role), 'guest url', fin.find(f => f.role === 2)?.url);
  console.log('rules', JSON.stringify(fin[0].rules));
  if (ROOM) {
    const modes = await Promise.all([A, B].map(X => X.p.evaluate(() => app.battleMode)));
    const r = fin[0].rules || {};
    const roomOk = modes[0] === 'survival' && modes[1] === 'survival' && r.maxLives === '2' && r.initialHints === '1' && r.allowAutoNotes === false && JSON.stringify(fin[1].rules) === JSON.stringify(r);
    console.log(roomOk ? 'PASS: room settings (survival, 2 lives, 1 hint, auto-notes off) applied on both devices' : 'FAIL: room settings ' + modes + ' ' + JSON.stringify(fin.map(f => f.rules)));
    if (!roomOk) { await browser.close(); process.exit(1); }
  }
  if (!ROOM) console.log(fin[0].rules?.allowAutoNotes === false && fin[1].rules?.allowAutoNotes === false ? 'PASS: random match has auto-notes off' : 'FAIL: random auto-notes ' + JSON.stringify(fin[0].rules));
  console.log(ok ? 'PASS: matched over public trackers, same puzzle on both sides' : 'FAIL');
  // 진행 동기화: 참가자 진행이 방장에게 전달되는지
  if (ok) {
    await new Promise(r => setTimeout(r, 4000));
    const opp = await Promise.all([A, B].map(X => X.p.evaluate(() => JSON.stringify(app.oppState))));
    console.log('oppState', opp);
  }
  // v2.0.5 재대결: 신청 → 거절 표시 → 다시 신청 → 수락 → 둘 다 대기실로
  let rmOk = false;
  if (ok) {
    const rm = X => X.p.evaluate(() => JSON.stringify(OnlineMatch.rematch));
    await A.p.evaluate(() => app.requestBattleRematch());
    await B.p.waitForFunction(() => OnlineMatch.rematch && OnlineMatch.rematch.in, null, { timeout: 8000 });
    await B.p.evaluate(() => OnlineMatch.rejectRematch());
    await A.p.waitForFunction(() => OnlineMatch.rematch && OnlineMatch.rematch.rejected, null, { timeout: 8000 });
    console.log('PASS: rematch declined → requester sees', await rm(A));
    await A.p.evaluate(() => { OnlineMatch.rematch = null; app.requestBattleRematch(); });
    await B.p.waitForFunction(() => OnlineMatch.rematch && OnlineMatch.rematch.in, null, { timeout: 8000 });
    await B.p.evaluate(() => OnlineMatch.acceptRematch());
    await Promise.all([A, B].map(X => X.p.waitForFunction(() => !app.isBattle && OnlineMatch.rematch === null, null, { timeout: 10000 })));
    if (ROOM) {
      await A.p.waitForFunction(() => !document.getElementById('om-room-screen').classList.contains('hidden') && app.guestJoined, null, { timeout: 15000 });
      const reset = await A.p.evaluate(() => !OnlineMatch.guestReady && document.querySelector('#om-room-screen .om-room-start').disabled);
      console.log(reset ? 'PASS: rematch requires Ready again' : 'FAIL: ready not reset on rematch');
      await B.p.waitForSelector('#om-room-screen .om-room-ready:not([hidden])', { timeout: 15000 });
      await B.p.click('#om-room-screen .om-room-ready');
      await A.p.waitForFunction(() => !document.querySelector('#om-room-screen .om-room-start').disabled, null, { timeout: 8000 });
      await A.p.click('#om-room-screen .om-room-start');
    }
    await Promise.all([A, B].map(X => X.p.waitForFunction(() => app.isBattle, null, { timeout: 60000 })));
    const sols = await Promise.all([A, B].map(X => X.p.evaluate(() => JSON.stringify(app.solution))));
    rmOk = sols[0] === sols[1] && sols[0] !== fin[0].sol;
    console.log(rmOk ? 'PASS: rematch accepted → new game on both devices' : 'FAIL: rematch');
  }
  // v2.0.9: 경기 중 상대가 나가면 → 결과 화면에 재도전 버튼 대신 '상대가 나갔습니다', 로비 재진입 시 멈춘 VS 없음
  if (rmOk) {
    await B.p.evaluate(() => { const p = OnlineMatch.partnerPeer(); OnlineMatch.sendTo(p, { t: 'bye' }); OnlineMatch.closePeer(p); });
    await A.p.waitForFunction(() => !app.dom.modalBattleResult.classList.contains('hidden') || (OnlineMatch.rematch && OnlineMatch.rematch.left), null, { timeout: 20000 }).catch(() => {});
    await A.p.evaluate(() => { if (app.isBattle) app.handleBattleEnd(true, 'left'); });
    const st = await A.p.evaluate(() => ({ left: !!(OnlineMatch.rematch && OnlineMatch.rematch.left), btnHidden: app.dom.btnBattleRematch.hidden }));
    await A.p.evaluate(() => app.requestBattleRematch());
    await A.p.evaluate(() => { app.dom.modalBattleResult.classList.add('hidden'); app.openBattleLobby(); });
    const after = await A.p.evaluate(() => ({ state: OnlineMatch.state, fx: !!document.querySelector('#om-match-fx.on') }));
    const leaveOk = st.left && st.btnHidden && after.state === 'idle' && !after.fx;
    console.log(leaveOk ? 'PASS: opponent left → no rematch, lobby reopens clean' : 'FAIL: leave ' + JSON.stringify([st, after]));
  }
  console.log('errors', A.errs, B.errs);
  await browser.close();
  process.exit(ok && rmOk && (profOk || DIST === 'github') ? 0 : 1);
})();
