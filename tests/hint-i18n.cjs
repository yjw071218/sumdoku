const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try {
  const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('sumdoku_language','ko'));
  await p.route('https://api.github.com/**',r=>r.fulfill({json:{}}));
  await p.goto('file:///'+path.resolve('app/src/main/assets/index.html').split(path.sep).join('/'));
  const result=await p.evaluate(()=>{
   const cases=['자세히','접기','✎ 메모 확인','✓ 메모 있음','메모 없음 — 적어 두세요','메모에서 지우기','원인 보기','숫자 바로잡기','후보 좁히기','언어 선택 · Choose your language','게임 시작 상태입니다. [','] 버튼을 누르거나 슬라이더로 수순을 확인하세요.',
    '5행 3열: 3 제외 — 45의 법칙: 3열에서 케이지 밖 빈칸 5행 3열 + 9행 3열 = 45 − 41 = 4: 3을 넣으면 9행 3열이 1이어야 하는데 그 칸에 1은 올 수 없음',
    '합 15 케이지: 빈 2칸의 합 15, 가능한 조합 6+9, 7+8',
    '1행 1열과 같은 1행에 2·3, 1번 박스에 4가 이미 있습니다.',
    '같은 1행에 이미 3이 있습니다 (1행 2열).',
    '정답 3이 나오는 풀이 (다른 2칸을 먼저 채운 뒤)',
    '이미 3이 있는 합 8 케이지에 7을 넣으면 10이 되어 합을 넘습니다.',
    '1·2 메모 추가 필요','Previous step','Next step'];
   const failures=[];
   for(const l of ['en','ja','zh','zh-TW','es','fr','de']) for(const s of cases){const out=I18N.text(s,l);if(/[가-힣]|\$\d|\[\[/.test(out))failures.push({l,s,out});}
   return {count:cases.length*7,failures};
  });
  assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[]);
  console.log('PASS hint-i18n: '+result.count+' dynamic/control translations across seven languages');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
