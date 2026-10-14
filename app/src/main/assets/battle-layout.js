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
