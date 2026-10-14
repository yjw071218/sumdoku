/* v1.0.32: 힌트 카드를 보드 위에 띄우지 않고 조작부(툴바·키패드) 자리에 넣습니다.
 * 카드가 열려 있는 동안 키패드는 숨기고, 근거가 되는 칸을 보드에 옅게 표시합니다. */
(() => {
  const p = SumdokuApp.prototype;
  const clearMarks = () => document.querySelectorAll('#sudoku-board .cell.hint-evidence, #sudoku-board .cell.hint-target-highlight')
    .forEach(el => el.classList.remove('hint-evidence', 'hint-target-highlight'));
  const cellEl = i => document.querySelector(`#sudoku-board .cell[data-r="${Math.floor(i / 9)}"][data-c="${i % 9}"]`);

  const show = p.showImmediateHint;
  p.showImmediateHint = function () {
    show.call(this);
    const h = this.pendingHint, card = this.dom.floatingHintCard;
    if (!h || !card || card.classList.contains('hidden')) return;
    document.body.classList.add('hint-open');
    // 설명을 단계 목록으로 표시
    const lines = h.explanation.split('\n');
    const last = lines.pop();
    const list = document.createElement('ol');
    list.className = 'hint-steps';
    lines.forEach(l => { const li = document.createElement('li'); li.textContent = l.replace(/^\d+\.\s*/, ''); list.append(li); });
    const concl = document.createElement('p');
    concl.className = 'hint-conclusion';
    concl.textContent = last.replace(/^→\s*/, '');
    this.dom.hintLogicText.replaceChildren(list, concl);
    this.dom.hintLogicText.scrollTop = 0;
    // 근거 칸 표시 (대상 칸 제외)
    clearMarks();
    const target = h.r * 9 + h.c;
    const evidence = new Set();
    (h.proof || []).filter(s => s.technique !== 'single').slice(-4)
      .forEach(s => (s.sources || []).forEach(i => { if (i !== target) evidence.add(i); }));
    evidence.forEach(i => cellEl(i)?.classList.add('hint-evidence'));
    cellEl(target)?.classList.add('hint-target-highlight');
    // 정답은 눌러야 보이게
    const ans = this.dom.hintAnswerVal;
    ans.classList.add('concealed');
    ans.setAttribute('role', 'button');
    ans.tabIndex = 0;
    ans.title = '눌러서 정답 보기';
    ans.onclick = ans.onkeydown = e => { if (e.type === 'keydown' && !['Enter', ' '].includes(e.key)) return; e.preventDefault?.(); ans.classList.remove('concealed'); ans.removeAttribute('role'); ans.tabIndex = -1; ans.title = ''; };
    card.querySelector('#btn-hint-card-apply')?.focus({ preventScroll: true });
    requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };

  const dismiss = p.dismissDeductiveHint;
  p.dismissDeductiveHint = function () {
    dismiss.call(this);
    clearMarks();
    document.body.classList.remove('hint-open');
  };

  // 화면 전환/일시정지 시 남은 힌트 표시 정리
  const sv = p.switchView;
  p.switchView = function (v, ...a) { if (v !== 'game' && document.body.classList.contains('hint-open')) this.dismissDeductiveHint(); return sv.call(this, v, ...a); };

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('hint-open') && !document.querySelector('.modal-backdrop:not(.hidden)')) {
      window.app?.dismissDeductiveHint();
    }
  });
})();
