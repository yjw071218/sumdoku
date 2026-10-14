/* Measure remaining space after the HUD and controls, including safe-area padding.
 * ResizeObserver also handles font scaling, rotation and expanded sum controls. */
(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const view=document.getElementById('view-game');
    const main=view.querySelector('.game-main-content');
    const column=view.querySelector('.board-column');
    const controls=view.querySelector('.controls-column');
    const wrapper=view.querySelector('.board-frame-wrapper');
    let scheduled=false;
    const fit=()=>{
      scheduled=false;
      if(!document.body.classList.contains('battle-active'))return;
      const wide=getComputedStyle(main).flexDirection==='row';
      const gap=parseFloat(getComputedStyle(main).gap)||0;
      const reserve=parseFloat(getComputedStyle(wrapper).paddingTop)||0;
      const pad=parseFloat(getComputedStyle(main).paddingBottom)||0;
      const height=main.clientHeight-pad-(wide?0:controls.getBoundingClientRect().height+gap)-reserve;
      const width=column.clientWidth;
      const size=Math.max(0,Math.floor(Math.min(width,height,620)));
      if(view.style.getPropertyValue('--battle-board-size')!==`${size}px`)view.style.setProperty('--battle-board-size',`${size}px`);
    };
    const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(fit);}};
    const observer=new ResizeObserver(schedule);
    [view,main,column,controls].forEach(el=>observer.observe(el));
    new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
    window.visualViewport?.addEventListener('resize',schedule);
    window.addEventListener('resize',schedule);
  });
})();

/* v1.0.36: 추론 도우미가 실제로 보이는 화면(태블릿)인지 표시 → 영역 합산 캡슐 숨김 */
(() => {
  window.addEventListener('DOMContentLoaded', () => {
    const card = document.getElementById('tablet-assistant-card');
    if (!card) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      if (document.body.classList.contains('hint-open')) return; // 힌트 중에는 카드가 숨겨지므로 판정 유지
      const on = getComputedStyle(card).display !== 'none';
      if (document.body.classList.contains('assistant-visible') !== on) document.body.classList.toggle('assistant-visible', on);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(sync); };
    new ResizeObserver(schedule).observe(document.getElementById('view-game'));
    new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', schedule);
    sync();
  });
})();
