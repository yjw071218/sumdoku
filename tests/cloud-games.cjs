const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
await p.addInitScript(()=>{window.calls=[];window.AndroidBridge={getDistribution:()=> 'play',isCloudConfigured:()=>true,cloudSignIn:()=>{calls.push('login');onCloudResult('signed_in','');},cloudSave:d=>{calls.push(d);onCloudResult('saved','');},cloudLoad:()=>calls.push('load')};});
await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').replace(/\\/g,'/'));await p.waitForSelector('#first-language');assert.equal(await p.locator('#first-language button').count(),8);
await p.locator('#first-language button').filter({hasText:'English'}).click();assert.equal(await p.evaluate(()=>I18N.currentLang),'en');await p.reload();await p.waitForSelector('#cloud-settings',{state:'attached'});assert.equal(await p.locator('#first-language').count(),0);
const r=await p.evaluate(()=>{app.saveSettings();app.saveStats();localStorage.setItem('sumdoku_last_host_ip','private');localStorage.setItem('unrelated','keep');
 const raw=SumdokuCloud.pack(),valid=SumdokuCloud.validate(raw);let rejected=false;try{SumdokuCloud.validate(JSON.stringify({...valid,data:{...valid.data,unknown:'bad'}}));}catch(e){rejected=true;}
 document.querySelector('[data-cloud-action="cloudSave"]').click();onCloudResult('loaded',raw);const confirm=!!document.getElementById('cloud-confirm');document.querySelector('#cloud-confirm button').click();const canceled=!document.getElementById('cloud-confirm');
 return {excluded:!('sumdoku_last_host_ip' in valid.data),rejected,confirm,canceled,sent:calls.length,raw};});
assert.ok(r.excluded&&r.rejected&&r.confirm&&r.canceled);assert.equal(r.sent,1);
await p.evaluate(raw=>{onCloudResult('loaded',raw);document.querySelector('#cloud-confirm .modal-footer button:last-child').click();},r.raw);
await p.waitForTimeout(600);assert.equal(await p.evaluate(()=>localStorage.getItem('unrelated')),'keep');assert.equal(await p.evaluate(()=>I18N.currentLang),'en');assert.ok(await p.evaluate(()=>localStorage.getItem('sumdoku_cloud_restore_backup')));assert.deepEqual(errors,[]);
console.log('PASS: first language 8 options, saved choice, cloud export whitelist, schema rejection, cancel, restore and backup, unrelated data/language preserved');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
