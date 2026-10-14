const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('assert'),path=require('path');
(async()=>{
  const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const p=await b.newPage({viewport:{width:390,height:844}});
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await p.addInitScript(()=>{
    window.__st={
      level:75,charging:true,wifi:true,cellular:true,airplane:false,
      bluetooth:true,alarm:true,powerSave:true,location:true,
      ringer:'vibrate',dnd:true,safeTop:24
    };
    window.AndroidBridge={
      getDeviceStatus:()=>JSON.stringify(window.__st),
      getLocalIpAddress:()=>'1.1.1.1'
    };
  });
  await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  await p.waitForFunction(()=>window.app&&document.getElementById('app-statusbar'));

  // 1. Verify authentic indicators: only DND & vibrate modes (no phantom alarm/location/bluetooth), Wi-Fi hides cellular
  const icons=await p.evaluate(()=>{
    const b=document.getElementById('app-statusbar');
    return {
      modesCount: b.querySelectorAll('.sb-modes svg').length, // only dnd and vibrate = 2
      hasWifi: !!b.querySelector('.sb-wifi svg'),
      hasCellular: !!b.querySelector('.sb-cellular svg'),
      hasAirplane: !!b.querySelector('.sb-airplane svg'),
      aria: b.getAttribute('aria-label')
    };
  });
  console.log('Icons:', icons);
  assert.equal(icons.modesCount, 2, 'Should only have 2 mode icons (dnd, vibrate)');
  assert.equal(icons.hasWifi, true, 'Should have Wi-Fi');
  assert.equal(icons.hasCellular, false, 'Cellular should be hidden when Wi-Fi is connected');
  assert.equal(icons.hasAirplane, false, 'Should not have Airplane yet');

  // 2. Turn off Wi-Fi -> Cellular should now appear
  const cellState=await p.evaluate(()=>{
    window.__st.wifi=false;
    window.__st.cellular=true;
    document.dispatchEvent(new Event('visibilitychange'));
    const b=document.getElementById('app-statusbar');
    return {
      hasWifi: !!b.querySelector('.sb-wifi svg'),
      hasCellular: !!b.querySelector('.sb-cellular svg')
    };
  });
  console.log('Cellular fallback state:', cellState);
  assert.equal(cellState.hasWifi, false);
  assert.equal(cellState.hasCellular, true);

  // 3. Toggle airplane mode on -> both Wi-Fi and Cellular hidden
  const airplaneState=await p.evaluate(()=>{
    window.__st.airplane=true;
    document.dispatchEvent(new Event('visibilitychange'));
    const b=document.getElementById('app-statusbar');
    return {
      hasAirplane: !!b.querySelector('.sb-airplane svg'),
      hasCellular: !!b.querySelector('.sb-cellular svg'),
      hasWifi: !!b.querySelector('.sb-wifi svg'),
      aria: b.getAttribute('aria-label')
    };
  });
  console.log('Airplane state:', airplaneState);
  assert.equal(airplaneState.hasAirplane, true);
  assert.equal(airplaneState.hasCellular, false);
  assert.equal(airplaneState.hasWifi, false);

  // 4. Test camera island cutout protection
  const cutoutChecks=await p.evaluate(()=>{
    const results={};
    // Center cutout (e.g. 175 to 215 on 390px screen)
    window.onAppCutout(36, 175, 215);
    const left1=document.querySelector('.sb-left').getBoundingClientRect();
    const right1=document.querySelector('.sb-right').getBoundingClientRect();
    results.centerSafe = left1.right <= 175 && right1.left >= 215;

    // Corner left punch hole (15 to 55)
    window.onAppCutout(36, 15, 55);
    const left2=document.querySelector('.sb-left').getBoundingClientRect();
    results.cornerLeftSafe = left2.left >= 55;

    // Corner right punch hole (335 to 375 on 390px screen)
    window.onAppCutout(36, 335, 375);
    const right3=document.querySelector('.sb-right').getBoundingClientRect();
    results.cornerRightSafe = right3.right <= 335;

    return results;
  });
  console.log('Camera cutout protection checks:', cutoutChecks);
  assert.equal(cutoutChecks.centerSafe, true, 'Center cutout must not be overlapped');
  assert.equal(cutoutChecks.cornerLeftSafe, true, 'Left corner cutout must not be overlapped');
  assert.equal(cutoutChecks.cornerRightSafe, true, 'Right corner cutout must not be overlapped');

  // 5. Verify no animation on status bar icons (no bouncing!)
  const animationCheck=await p.evaluate(()=>{
    const svgs=[...document.querySelectorAll('#app-statusbar svg')];
    return svgs.map(s=>getComputedStyle(s).animationName);
  });
  console.log('Animation names on statusbar SVGs:', animationCheck);
  assert.ok(animationCheck.every(name=>name==='none'||name===''), 'No SVG should have bouncing animation');

  // 6. Test multilingual labels
  for(const l of ['ko','en','ja','zh','zh-TW','es','fr','de']){
    const aria=await p.evaluate(l=>{
      I18N.setLanguage(l);
      return document.getElementById('app-statusbar').getAttribute('aria-label');
    }, l);
    console.log(l+':', aria);
    assert.ok(aria.length > 10, `${l} aria-label should contain status text`);
  }

  assert.deepEqual(errs, []);
  console.log('PASS: status-bar-indicators test');
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
