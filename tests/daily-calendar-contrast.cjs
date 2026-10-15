// 일일 도전 달력: 선택한 날짜(일반·오늘·완료)의 숫자가 라이트·다크·세피아에서 배경 대비 3:1 이상인지 검사합니다.
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:844}});
 await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
 await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));await p.waitForFunction(()=>window.app);
 const rows=[];
 for(const theme of ['theme-light','theme-dark','theme-sepia']){
  const r=await p.evaluate(async theme=>{
   app.applyTheme(theme);app.switchView('daily');
   const btns=[...document.querySelectorAll('.cal-day-btn:not(.empty)')];
   const today=document.querySelector('.cal-day-btn.today');const plain=btns.find(x=>!x.classList.contains('today'));
   plain.classList.add('cleared');const plain2=btns.find(x=>!x.classList.contains('today')&&x!==plain);
   const parse=c=>{const m=c.match(/[\d.]+/g).map(Number);return {r:m[0],g:m[1],b:m[2],a:m[3]??1};};
   const lum=({r,g,b})=>{const f=v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
   const bgOf=el=>{let layers=[];for(let e=el;e;e=e.parentElement){const c=parse(getComputedStyle(e).backgroundColor);if(c.a>0)layers.push(c);if(c.a>=1)break;}
    let base={r:255,g:255,b:255};for(const c of layers.reverse())base={r:c.r*c.a+base.r*(1-c.a),g:c.g*c.a+base.g*(1-c.a),b:c.b*c.a+base.b*(1-c.a)};return base;};
   const ratio=el=>{const fg=parse(getComputedStyle(el).color),bg=bgOf(el);const [x,y]=[lum(fg),lum(bg)].sort((a,b)=>b-a);return +( (x+.05)/(y+.05)).toFixed(2);};
   const out={};
   for(const [k,el] of [['selected',plain2],['selectedCleared',plain],['todaySelected',today]]){if(!el)continue;el.click();await new Promise(r=>setTimeout(r,350));out[k]=ratio(el);out[k+'White']=getComputedStyle(el).backgroundColor;}
   return out;
  },theme);
  rows.push({theme,...r});
 }
 console.log(JSON.stringify(rows,null,1));
 for(const r of rows)for(const k of ['selected','selectedCleared','todaySelected'])if(r[k]!==undefined){
  assert.ok(r[k]>=3,`${r.theme} ${k} contrast ${r[k]}`);
  assert.notEqual(r[k+'White'],'rgb(255, 255, 255)');assert.notEqual(r[k+'White'],'rgb(239, 246, 255)');
 }
 console.log('PASS: selected calendar day readable in light/dark/sepia (plain, cleared, today)');
}finally{await b.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
