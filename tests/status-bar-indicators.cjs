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

  // 1. Verify all icons render
  const icons=await p.evaluate(()=>{
    const b=document.getElementById('app-statusbar');
    return {
      modesCount: b.querySelectorAll('.sb-modes svg').length, // location, alarm, bluetooth, dnd, vibrate, powerSave = 6
      hasWifi: !!b.querySelector('.sb-wifi svg'),
      hasCellular: !!b.querySelector('.sb-cellular svg'),
      hasAirplane: !!b.querySelector('.sb-airplane svg'),
      aria: b.getAttribute('aria-label')
    };
  });
  console.log('Icons:', icons);
  assert.equal(icons.modesCount, 6, 'Should have 6 mode icons');
  assert.equal(icons.hasWifi, true, 'Should have Wi-Fi');
  assert.equal(icons.hasCellular, true, 'Should have Cellular');
  assert.equal(icons.hasAirplane, false, 'Should not have Airplane yet');

  // 2. Toggle airplane mode on
  const airplaneState=await p.evaluate(()=>{
    window.__st.airplane=true;
    window.__st.cellular=false;
    document.dispatchEvent(new Event('visibilitychange'));
    const b=document.getElementById('app-statusbar');
    return {
      hasAirplane: !!b.querySelector('.sb-airplane svg'),
      hasCellular: !!b.querySelector('.sb-cellular svg'),
      aria: b.getAttribute('aria-label')
    };
  });
  console.log('Airplane state:', airplaneState);
  assert.equal(airplaneState.hasAirplane, true);
  assert.equal(airplaneState.hasCellular, false);

  // 3. Verify no animation on status bar icons (no bouncing!)
  const animationCheck=await p.evaluate(()=>{
    const svgs=[...document.querySelectorAll('#app-statusbar svg')];
    return svgs.map(s=>getComputedStyle(s).animationName);
  });
  console.log('Animation names on statusbar SVGs:', animationCheck);
  assert.ok(animationCheck.every(name=>name==='none'||name===''), 'No SVG should have bouncing animation');

  // 4. Test multilingual labels
  for(const l of ['ko','en','ja','zh','zh-TW','es','fr','de']){
    const aria=await p.evaluate(l=>{
      I18N.setLanguage(l);
      return document.getElementById('app-statusbar').getAttribute('aria-label');
    }, l);
    console.log(l+':', aria);
    assert.ok(aria.length > 20, `${l} aria-label should contain full status text`);
  }

  assert.deepEqual(errs, []);
  console.log('PASS: status-bar-indicators test');
  await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
