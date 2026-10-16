/* First launch language selection and explicit Google Play Games backups. */
(() => {
 const keys = ['settings','stats','daily_cleared','daily_session','ongoing_game','replays','achievements','ach_counters','prefs_v2','scratchpad','selected_diff','last_diff','last_mode','theme','rating'].map(k=>'sumdoku_'+k);
 const bridge=()=>window.AndroidBridge;
 let busy=false;
 // v1.1.30: 한국어·영어 외 언어도 번역표(UI_TRANSLATIONS)에서 찾아 표시합니다.
 const tr=(ko,en)=>{const l=window.I18N?.currentLang||'ko';if(l==='ko')return ko;return (window.UI_TRANSLATIONS?.[l]?.[ko])||en;};
 const toast=(ko,en)=>window.app?.showToast(tr(ko,en),5000);
 const allowed=()=>!window.app?.isBattle && window.app?.currentView!=='game';
 function dialog(title,body,yes,no,accept) {
  const el=document.createElement('div');el.className='modal-backdrop';el.id='cloud-confirm';
  const card=document.createElement('section');card.className='modal-card';card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
  const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=body;
  const footer=document.createElement('div');footer.className='modal-footer';
  for(const [label,fn] of [[no,()=>el.remove()],[yes,()=>{el.remove();accept();}]]) {const b=document.createElement('button');b.className='btn btn-secondary';b.textContent=label;b.onclick=fn;footer.append(b);}
  card.append(h,p,footer);el.append(card);document.getElementById('app').append(el);footer.lastChild.focus();
 }
 const pack=()=>JSON.stringify({format:'sumdoku-cloud',version:1,savedAt:Date.now(),data:Object.fromEntries(keys.filter(k=>localStorage.getItem(k)!==null).map(k=>[k,localStorage.getItem(k)]))});
 function validate(raw) {
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>2800000)throw Error('size');
  const p=JSON.parse(raw);if(p.format!=='sumdoku-cloud'||p.version!==1||!p.data||Array.isArray(p.data)||typeof p.data!=='object')throw Error('format');
  for(const [k,v] of Object.entries(p.data)) {if(!keys.includes(k)||typeof v!=='string')throw Error('key');
   if(['settings','stats','daily_cleared','daily_session','ongoing_game','replays','achievements','ach_counters','prefs_v2'].some(n=>k==='sumdoku_'+n)) {const j=JSON.parse(v);if(!j||typeof j!=='object')throw Error('data');}}
  if(!p.data.sumdoku_settings||!p.data.sumdoku_stats)throw Error('missing');return p;
 }
 function restore(p) {
  if(!allowed())return;
  const before=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]));
  try {
   localStorage.setItem('sumdoku_cloud_restore_backup',JSON.stringify(before));
   for(const k of keys) {if(k in p.data)localStorage.setItem(k,p.data[k]);else localStorage.removeItem(k);}
   window.app.syncPersistentBackup();
  }catch(e){for(const [k,v] of Object.entries(before)){if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}toast('저장 공간이 부족해 복원하지 못했습니다.','Not enough storage to restore.');return;}
  location.reload();
 }
 window.onCloudResult=(status,raw)=>{
  busy=false;
  if(status==='loaded') {
   if(!allowed())return;
   try {const p=validate(raw);dialog(tr('게임 데이터 불러오기','Load game data'),tr('현재 기록을 선택한 저장본으로 교체합니다. 기존 기록은 기기에 백업합니다.','Replace local progress with this save? A local backup will be kept.'),tr('불러오기','Load'),tr('취소','Cancel'),()=>restore(p));}
   catch(e){toast('호환되지 않거나 손상된 저장본입니다.','This save is incompatible or damaged.');}return;
  }
  const messages={signed_in:['Google Play 게임즈에 로그인했습니다.','Signed in to Google Play Games.'],saved:['저장했습니다. 인터넷 연결 후 다른 기기에서 불러올 수 있습니다.','Saved. Connect to the internet to sync to other devices.'],unconfigured:['Google Play 게임즈 연결 설정이 아직 완료되지 않았습니다.','Google Play Games is not configured yet.'],error:['연결하지 못했습니다. 계정과 인터넷 연결을 확인해 주세요.','Unable to connect. Check your account and internet connection.'],too_large:['저장 용량을 초과했습니다. 리플레이를 정리해 주세요.','Save too large. Remove older replays.']};
  if(status==='error'&&raw&&raw!=='-1'){
   // v1.1.30: 실패 코드별 안내(내부 테스트 진단용)
   const c=String(raw);
   if(c==='10')return toast('Play 게임즈 설정 오류(코드 10): Play Console의 OAuth 클라이언트 SHA-1이 앱 서명 키와 다르거나 테스터로 등록되지 않았습니다.','Play Games config error (code 10): OAuth client SHA-1 does not match the app signing key, or this account is not a tester.');
   if(c==='4')return toast('로그인이 필요합니다(코드 4). Play 게임즈 앱에 로그인했는지 확인해 주세요.','Sign-in required (code 4). Make sure you are signed in to Play Games.');
   if(c==='7')return toast('네트워크 오류(코드 7). 인터넷 연결을 확인해 주세요.','Network error (code 7). Check your connection.');
   if(c==='16')return toast('로그인을 취소했습니다.','Sign-in canceled.');
   {const l=window.I18N?.currentLang||'ko';const tpl=l==='ko'?'연결하지 못했습니다 (코드 {0}). 계정과 인터넷 연결을 확인해 주세요.':(window.UI_TRANSLATIONS?.[l]?.['연결하지 못했습니다 (코드 {0}). 계정과 인터넷 연결을 확인해 주세요.']||'Unable to connect (code {0}). Check your account and connection.');return window.app?.showToast(tpl.replace('{0}',c),5000);}
  }
  if(messages[status])toast(...messages[status]);
 };
 function initialize(){
  if(!localStorage.getItem('sumdoku_language')) {
   const el=document.createElement('div');el.className='modal-backdrop';el.id='first-language';el.dataset.selectId='first-language';
   el.innerHTML='<section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="first-language-title"><h3 id="first-language-title">언어 선택 · Choose your language</h3><div class="language-options"></div></section>';
   for(const lang of I18N.languages){const b=document.createElement('button');b.className='btn btn-secondary';b.textContent=lang.name;b.lang=lang.code;b.onclick=()=>{I18N.setLanguage(lang.code);window.app?.syncPersistentBackup();el.remove();};el.querySelector('.language-options').append(b);}
   document.getElementById('app').append(el);el.querySelector('button').focus();
  }
  if(bridge()?.getDistribution?.()!=='play')return;
  const host=document.querySelector('#panel-settings .settings-list-card');if(!host)return;
  const group=document.createElement('section');group.id='cloud-settings';
  const title=document.createElement('h3');title.textContent=tr('Google Play 게임즈 · 저장 데이터','Google Play Games · Saved data');
  const desc=document.createElement('p');desc.textContent=tr('같은 Google Play 게임즈 계정으로 다른 기기에서 불러올 수 있습니다. 저장 버튼으로 새 저장본을 만듭니다.','Use the same Google Play Games account on another device. Save creates a new backup.');group.append(title,desc);
  for(const [ko,en,action] of [['로그인','Sign in','cloudSignIn'],['지금 저장','Save now','cloudSave'],['불러오기','Load','cloudLoad']]){
   const b=document.createElement('button');b.className='btn btn-secondary';b.textContent=tr(ko,en);b.dataset.cloudAction=action;
   b.onclick=()=>{if(busy)return;if(!allowed()){toast('게임을 나간 뒤 이용해 주세요.','Return to the home screen first.');return;}
    if(!bridge().isCloudConfigured?.()){onCloudResult('unconfigured','');return;}
    if(action==='cloudSave'){window.app.saveSettings();window.app.saveStats();}
    busy=true;try{bridge()[action](...(action==='cloudSave'?[pack()]:[]));}catch(e){onCloudResult('error','');}};group.append(b);
  }
  const refresh=()=>{
   title.textContent=tr('Google Play 게임즈 · 저장 데이터','Google Play Games · Saved data');
   desc.textContent=tr('같은 Google Play 게임즈 계정으로 다른 기기에서 불러올 수 있습니다. 저장 버튼으로 새 저장본을 만듭니다.','Use the same Google Play Games account on another device. Save creates a new backup.');
   const labels={cloudSignIn:['로그인','Sign in'],cloudSave:['지금 저장','Save now'],cloudLoad:['불러오기','Load']};
   group.querySelectorAll('[data-cloud-action]').forEach(b=>b.textContent=tr(...labels[b.dataset.cloudAction]));
  };
  new MutationObserver(refresh).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  host.append(group);
 }
 window.SumdokuCloud={pack,validate};
 window.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0));
})();
