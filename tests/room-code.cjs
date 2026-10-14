// 4자리 방 코드: 같은 Wi-Fi에 방이 두 개 있어도 코드로 맞는 방에 접속, 없는 코드는 안내
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const joins=[];
  await page.route('https://api.github.com/**',r=>r.fulfill({json:{tag_name:'v1.0.35'}}));
  // 학교 Wi-Fi처럼 IP 앞자리가 다른 방장 (네이티브 탐색이 찾아 준 주소)
  await page.route(/http:\/\/10\.20\.99\.7:8888\/.*/,r=>{
   const u=new URL(r.request().url()),h={'Access-Control-Allow-Origin':'*'};
   if(u.pathname==='/api/join'){joins.push({host:'10.20.99.7',code:JSON.parse(r.request().postData()||'{}').code});return r.fulfill({headers:h,json:{ok:true,player:2}});}
   return r.fulfill({headers:h,json:{ok:true,status:'waiting',puzzle:{}}});
  });
  await page.route(/http:\/\/192\.168\.7\.\d+:8888\/.*/,r=>{
   const u=new URL(r.request().url()),host=u.hostname,h={'Access-Control-Allow-Origin':'*'};
   const rooms={'192.168.7.10':'1111','192.168.7.20':'2222','192.168.7.30':'4444'};
   if(!rooms[host])return r.abort();
   if(u.pathname==='/api/hello')return r.fulfill({headers:h,json:{ok:true,app:'sumdoku',code:rooms[host],status:'waiting',full:host==='192.168.7.30'}});
   if(u.pathname==='/api/join'){const b=JSON.parse(r.request().postData()||'{}');joins.push({host,code:b.code});
    return (!b.code||b.code===rooms[host])?r.fulfill({headers:h,json:{ok:true,player:2}}):r.fulfill({status:403,headers:h,json:{ok:false,error:'wrong_code'}});}
   return r.fulfill({headers:h,json:{ok:true,status:'waiting',p1Ready:true,p2Ready:false,puzzle:{}}});
  });
  await page.addInitScript(()=>localStorage.clear());
  await page.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  await page.waitForFunction(()=>window.app);
  const host=await page.evaluate(()=>{
   let sent=null;window.AndroidBridge={getLocalIpAddress:()=>'192.168.7.50',startBattleServer:(m,d,t,p)=>{sent=JSON.parse(p);return JSON.stringify({ok:true,ip:'192.168.7.50'})},stopBattleServer:()=>{}};
   app.openBattleLobby();app.createHostRoom();
   const shown=app.dom.battleMyCode.textContent;app.cancelRoomPreparation();
   return {shown,sent:sent&&sent.roomCode};
  });
  assert.match(host.shown,/^\d{4}$/);assert.equal(host.shown,host.sent,'room code is sent to the server');
  const join=async code=>page.evaluate(async code=>{
   app.cancelRoomPreparation();app.dom.tabBattleJoin.click();app.dom.battleInputTarget.value=code;
   await app.connectToHost();
   return {url:app.battleHostUrl,error:document.getElementById('battle-connect-error').textContent,joined:!app.dom.battleGuestRoomPanel.classList.contains('hidden')};
  },code);
  const t0=Date.now();const ok=await join('2222');const ms=Date.now()-t0;
  assert.ok(ok.joined,JSON.stringify(ok));assert.equal(ok.url,'http://192.168.7.20:8888');
  assert.deepEqual(joins.at(-1),{host:'192.168.7.20',code:'2222'});
  const other=await join('1111');assert.equal(other.url,'http://192.168.7.10:8888');
  const missing=await join('3333');assert.ok(!missing.joined&&missing.error.includes('3333'),JSON.stringify(missing));
  const full=await join('4444');assert.ok(!full.joined&&full.error.includes('이미 다른 사람'),JSON.stringify(full));
  const short=await join('123');assert.ok(!short.joined&&short.error.includes('4자리'));
  // v1.0.40: 앱(네이티브 탐색)에서는 IP 앞자리가 다른 방장도 찾고, 못 찾으면 IP·핫스팟 안내
  const native=await page.evaluate(async()=>{
   window.AndroidBridge.findRoomAsync=code=>setTimeout(()=>window.onRoomFound(code==='5555'?{ok:true,ip:'10.20.99.7',via:'broadcast'}:{ok:false,error:'not_found'}),30);
   app.cancelRoomPreparation();app.dom.tabBattleJoin.click();app.dom.battleInputTarget.value='5555';await app.connectToHost();
   const ok={url:app.battleHostUrl,joined:!app.dom.battleGuestRoomPanel.classList.contains('hidden')};
   app.cancelRoomPreparation();app.dom.tabBattleJoin.click();app.dom.battleInputTarget.value='6666';await app.connectToHost();
   return {ok,err:document.getElementById('battle-connect-error').textContent};
  });
  assert.equal(native.ok.url,'http://10.20.99.7:8888');assert.ok(native.ok.joined);
  assert.deepEqual(joins.at(-1),{host:'10.20.99.7',code:'5555'});
  assert.ok(native.err.includes('IP 주소')&&native.err.includes('핫스팟'),native.err);
  // v1.0.41: 끝 두 자리 입력 → 내 IP 앞 두 자리를 붙여 접속 (192.168.7.50 + '7.20' → 192.168.7.20)
  const shortIp=await join('7.20');
  assert.ok(shortIp.joined,JSON.stringify(shortIp));assert.equal(shortIp.url,'http://192.168.7.20:8888');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,findMs:ms,checks:['host 4-digit code','two rooms same Wi-Fi','not found','room full','bad length']}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
