/* Keyboard support and dialog focus, without changing game state or animations. */
(() => {
  window.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('app');
    const toast=document.getElementById('toast');
    toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true');
    for(const el of root.querySelectorAll('button[title]'))if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',el.title);
    for(const el of root.querySelectorAll('.btn-back-home'))el.setAttribute('aria-label','홈으로 돌아가기');
    const selectable=[...root.querySelectorAll('.battle-mode-card,.battle-diff-btn,.battle-tab-btn,#btn-pencil,#btn-cage-multi-calc')];
    for(const el of selectable){
      if(el.tagName!=='BUTTON'){
        el.setAttribute('role','button');el.tabIndex=0;
        el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();el.click();}});
      }
      const sync=()=>el.setAttribute('aria-pressed',String(el.classList.contains('active')));
      sync();new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']});
    }
    const input=document.getElementById('battle-input-target');
    input.addEventListener('input',()=>{
      input.removeAttribute('aria-invalid');document.getElementById('battle-connect-error').textContent='';
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();e.stopPropagation();document.getElementById('btn-battle-connect').click();}
    });
    const code=document.getElementById('battle-my-code');
    code.setAttribute('role','button');code.setAttribute('aria-label','방 접속 코드 복사');code.tabIndex=0;
    code.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();code.click();}});
    const visible=el=>el.getClientRects().length>0&&!el.closest('.hidden,.view:not(.active)');
    const focusable=modal=>[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(visible);
    let active=null;const returnFocus=new WeakMap();
    const syncDialog=()=>{
      const modals=[...root.querySelectorAll('.modal-backdrop')].filter(visible);
      modals.sort((a,b)=>(Number(getComputedStyle(a).zIndex)||0)-(Number(getComputedStyle(b).zIndex)||0));
      const next=modals.at(-1)||null;
      if(next===active)return;
      const previous=active;active=next;
      if(next){
        if(!returnFocus.has(next))returnFocus.set(next,document.activeElement);
        const card=next.querySelector('.modal-card')||next;
        card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.tabIndex=-1;
        const heading=card.querySelector('h2,h3,.result-big-title,.result-title');
        if(heading){if(!heading.id)heading.id=next.id+'-heading';card.setAttribute('aria-labelledby',heading.id);}
        if(!next.contains(document.activeElement)){
          const safe=next.querySelector('[data-cancel],#btn-cancel-forfeit,#btn-cancel-stats-reset');
          (safe||focusable(next)[0]||card).focus({preventScroll:true});
        }
      }else if(previous){
        const saved=returnFocus.get(previous);returnFocus.delete(previous);
        if(saved?.isConnected&&visible(saved))saved.focus({preventScroll:true});
      }
    };
    new MutationObserver(records=>{
      if(records.some(r=>r.type==='attributes'?r.target.matches('.modal-backdrop'):Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).some(n=>n.nodeType===1&&(n.matches('.modal-backdrop')||n.querySelector('.modal-backdrop')))))syncDialog();
    }).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',e=>{
      if(e.defaultPrevented||e.key!=='Tab'||!active)return;
      const all=focusable(active);if(!all.length){e.preventDefault();return;}
      const first=all[0],last=all.at(-1);
      if(e.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){e.preventDefault();first.focus();}
    });
    syncDialog();
  });
})();
