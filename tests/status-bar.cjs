const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const url='file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/');
 const errors=[];const results=[];
 for(const [w,h,safe] of [[360,740,0],[390,844,32],[1024,768,24]]){
  const p=await b.newPage({viewport:{width:w,height:h}});p.on('pageerror',e=>errors.push(e.message));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await p.addInitScript(safe=>{window.__st={level:14,charging:false,wifi:true,safeTop:safe};window.AndroidBridge={getDeviceStatus:()=>JSON.stringify(window.__st),getLocalIpAddress:()=>'192.168.0.2'};},safe);
  await p.goto(url);await p.waitForFunction(()=>window.app&&document.getElementById('app-statusbar'));await p.waitForTimeout(500);
  const r=await p.evaluate(()=>{const bar=document.getElementById('app-statusbar').getBoundingClientRect();const out={barH:Math.round(bar.height),overlap:[]};
   for(const id of ['view-home','view-stats','view-daily']){app.switchView(id.slice(5));const v=document.getElementById(id).getBoundingClientRect();out[id]=Math.round(v.top);}
   app.switchView('home');
   out.text=document.querySelector('.sb-time').textContent+'|'+document.querySelector('.sb-batt-text').textContent;out.low=document.querySelector('.sb-batt').dataset.low;
   window.__st.charging=true;window.__st.level=80;document.dispatchEvent(new Event('visibilitychange'));out.charging=document.querySelector('.sb-batt').dataset.charging;out.fill=document.querySelector('.sb-batt-fill').style.width;
   const body=document.querySelector('.sb-batt-body').getBoundingClientRect(),bolt=document.querySelector('.sb-bolt svg').getBoundingClientRect();
   out.centered=Math.abs(body.left+body.width/2-bolt.left-bolt.width/2)<0.5&&Math.abs(body.top+body.height/2-bolt.top-bolt.height/2)<0.5;
   out.contained=bolt.top>=body.top&&bolt.bottom<=body.bottom&&bolt.left>=body.left&&bolt.right<=body.right;
   return out;});
  assert.equal(r.barH,Math.max(30,safe));for(const k of ['view-home','view-stats','view-daily'])assert.ok(r[k]>=r.barH,k+' '+JSON.stringify(r));
  assert.equal(r.low,'1');assert.equal(r.charging,'1');assert.equal(r.fill,'80%');assert.match(r.text,/\d.*\|14%/);
  assert.ok(r.centered&&r.contained,'charging bolt centered inside battery: '+JSON.stringify(r));
  if(w===390)await p.screenshot({path:'build/statusbar-390.png'});
  results.push(`${w}px:${r.text}`);await p.close();}
 // 브라우저(브리지 없음)에서는 표시하지 않음
 const p=await b.newPage();await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));await p.goto(url);await p.waitForFunction(()=>window.app);
 assert.equal(await p.locator('#app-statusbar').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: app status bar',results.join(', '));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
