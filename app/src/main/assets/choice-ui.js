/* Theme-aware choices. Native selects retain values and change handlers. */
(() => {
  const buttons = new Map();
  let source = null;
  const dialog = document.createElement('dialog');
  dialog.className = 'choice-dialog';
  dialog.innerHTML = '<form method="dialog"><header><h2 id="choice-title"></h2><button class="choice-close" value="cancel">×</button></header><div class="choice-options" role="group" aria-labelledby="choice-title"></div></form>';
  dialog.setAttribute('aria-labelledby', 'choice-title');
  const title = dialog.querySelector('h2'), list = dialog.querySelector('.choice-options');
  function label(select) {
    return select.closest('.settings-item')?.querySelector('.s-title')?.textContent || select.closest('label')?.childNodes[0]?.textContent?.trim() || select.getAttribute('aria-label') || window.I18N.t('modal_confirm');
  }
  function sync() {
    document.querySelectorAll('select').forEach(select => {
      let button = buttons.get(select);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button'; button.className = 'settings-select app-choice-trigger';
        button.dataset.selectId = select.id;
        button.setAttribute('aria-haspopup', 'dialog');
        select.classList.add('app-choice-source'); select.tabIndex = -1; select.setAttribute('aria-hidden','true');
        select.after(button); buttons.set(select, button);
        button.addEventListener('click', () => open(select));
        select.addEventListener('change', sync);
      }
      const text = (select.selectedOptions[0]?.textContent || '') + ' ▾';
      if (button.textContent !== text) button.textContent = text;
      const name = label(select) + ': ' + text;
      if (button.getAttribute('aria-label') !== name) button.setAttribute('aria-label', name);
      button.disabled = select.disabled;
    });
  }
  function open(select) {
    source = select; title.textContent = label(select); list.replaceChildren();
    dialog.querySelector('.choice-close').setAttribute('aria-label', I18N.t('modal_close'));
    for (const option of select.options) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'choice-option'; button.disabled = option.disabled;
      button.textContent = option.textContent;
      if(select.id.endsWith('language'))button.dataset.userContent='';
      button.setAttribute('aria-pressed', String(option.selected));
      if (option.selected) button.classList.add('selected');
      button.onclick = () => {
        select.value = option.value;
        select.dispatchEvent(new Event('input', {bubbles:true}));
        select.dispatchEvent(new Event('change', {bubbles:true}));
        sync(); dialog.close();
      };
      list.append(button);
    }
    dialog.showModal();
    (list.querySelector('.selected') || list.querySelector('button'))?.focus();
  }
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close(); } });
  dialog.addEventListener('close', () => buttons.get(source)?.focus());
  dialog.addEventListener('keydown', e => {
    e.stopPropagation();
    if (!['ArrowDown','ArrowUp','Home','End'].includes(e.key)) return;
    const options=[...list.querySelectorAll('button:not(:disabled)')];
    let i=options.indexOf(document.activeElement);
    i=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;
    e.preventDefault(); options[i]?.focus();
  });
  window.addEventListener('DOMContentLoaded', () => {
    document.body.append(dialog); sync();
    let pending=false;
    new MutationObserver(() => { if(pending)return; pending=true; queueMicrotask(()=>{pending=false;sync();}); }).observe(document.body,{childList:true,subtree:true,characterData:true});
    window.addEventListener('pageshow',sync);
    document.addEventListener('visibilitychange', () => {
      if (window.app) { if(document.hidden)app.saveOngoingGame();else app.expireDailySession(); }
    });
    window.addEventListener('pagehide',()=>window.app?.saveOngoingGame());
    let day=window.app?.localDay();
    setInterval(()=>{
      const app=window.app;if(!app)return;
      if(day!==app.localDay()){day=app.localDay();app.expireDailySession();app.renderDailyCalendar();}
      if(app.isDaily && !document.hidden)app.saveOngoingGame();
    },1000);
  });
})();
