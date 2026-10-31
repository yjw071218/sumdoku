/* v2.7.1 · 언어 길이에 따른 레이아웃 흔들림 방지
 * 한 줄로 고정한 짧은 라벨(도구 이름, 상태줄, 콤보, 탭 이름 등)이 번역 때문에 넘치면
 * 줄바꿈 대신 글자 크기를 단계적으로 줄여 한 줄에 맞춥니다(최소 8px, 그래도 넘치면 말줄임).
 * 언어 변경 · 화면 회전 · 텍스트 변경 시 다시 맞춥니다. */
(() => {
  const SELECTORS = [
    '#view-game .tool-btn .tool-label',
    '#view-game .game-sub-bar .mistakes-item .sub-label',
    '#view-game .game-sub-bar .timer-item .sub-label',
    '#view-game .game-sub-bar .game-mode-tag',
    '#view-game .game-sub-bar .cm-label',
    '#view-game .combo-text',
    '#view-game .score-label',
    '.nav-tab .tab-label',
    '.stat-label',
    '.rc-tab-name',
    '.stats-diff-tab', '.stats-tab', '[data-stats-diff]',
    '#gen-pipeline-steps .gen-step-name',
    '.sd-report-row > .btn', '.sd-inbox-tabs span'
  ];
  const MIN = 8;
  const SEL = SELECTORS.join(',');
  let pending = false;
  function fitOne(el) {
    if (!el.isConnected || el.offsetParent === null) return;
    el.style.fontSize = ''; el.classList.remove('sd-fit-2');
    el.classList.add('sd-fit');
    const base = parseFloat(getComputedStyle(el).fontSize) || 12;
    let size = base, guard = 0;
    while (el.scrollWidth > el.clientWidth + 0.5 && size > MIN && guard++ < 24) {
      size = Math.max(MIN, size - 0.5);
      el.style.fontSize = size + 'px';
    }
    // 최소 크기에서도 넘치는 도구 이름(예: Note Automatiche)은 말줄임 대신 두 줄로 보여 줍니다.
    el.classList.toggle('sd-fit-2', el.classList.contains('tool-label') && el.scrollWidth > el.clientWidth + 0.5);
    if (el.classList.contains('sd-fit-2')) el.style.fontSize = '9px';
  }
  function fitAll() {
    pending = false;
    // 난이도 칸: 라벨+값+모드 태그가 안 들어가면 라벨을 숨깁니다(잘린 '…' 라벨 방지).
    document.querySelectorAll('#view-game .game-sub-bar .diff-item').forEach(d => {
      d.classList.remove('sd-diff-compact');
      const lab = d.querySelector('.sub-label');
      if (!lab || d.offsetParent === null) return;
      if (d.scrollWidth > d.clientWidth + 0.5 || lab.scrollWidth > lab.clientWidth + 0.5) d.classList.add('sd-diff-compact');
    });
    document.querySelectorAll(SELECTORS.join(',')).forEach(fitOne);
  }
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(() => requestAnimationFrame(fitAll)); }
  window.SumdokuFit = { schedule, fitAll };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  document.addEventListener('sumdoku:lang', schedule);
  function boot() {
    schedule();
    // 언어 변경·화면 전환(view active)·라벨 텍스트 변경을 감지합니다. 콤보 숫자처럼 자주 바뀌는 곳도 rAF 한 번으로 묶습니다.
    new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'attributes' && m.target === document.documentElement) { schedule(); return; }
        if (m.type === 'attributes' && m.attributeName === 'class' && m.target.classList?.contains('view')) { schedule(); return; }
        if (m.type === 'characterData' || m.type === 'childList') {
          const el = m.type === 'characterData' ? m.target.parentElement : m.target;
          if (el && el.closest && el.closest(SEL)) { schedule(); return; }
        }
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'dir', 'class'], subtree: true, childList: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
