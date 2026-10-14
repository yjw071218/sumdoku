const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('assert'),path=require('path');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});const p=await b.newPage({viewport:{width:390,height:844}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
await p.addInitScript(()=>{window.__st={level:50,charging:false,wifi:true,ringer:'vibrate',dnd:true,safeTop:0};window.AndroidBridge={getDeviceStatus:()=>JSON.stringify(__st),getLocalIpAddress:()=>'1.1.1.1'};});
await p.clock.install({time:new Date('2026-10-14T21:05:00')});
await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app&&document.getElementById('app-statusbar'));
const out=[];for(const l of ['ko','en','ja','zh','zh-TW','es','fr','de']){out.push(await p.evaluate(l=>{I18N.setLanguage(l);const b=document.getElementById('app-statusbar');return l+': '+b.querySelector('.sb-time').textContent+' | '+b.getAttribute('aria-label')+' | icons '+b.querySelectorAll('.sb-modes svg').length},l));}
const bg=[];for(const t of ['theme-light','theme-dark','theme-sepia'])bg.push(await p.evaluate(async t=>{app.applyTheme(t);document.getElementById('app-statusbar').style.transition='none';const b=document.getElementById('app-statusbar');return b.parentElement.id+' '+document.getElementById('app').className+' '+getComputedStyle(b).backgroundColor},t));
console.log(out.join('\n'));console.log(bg);assert.equal(new Set(bg).size,3);assert.deepEqual(errs,[]);await b.close();})().catch(e=>{console.error(e);process.exit(1)});
