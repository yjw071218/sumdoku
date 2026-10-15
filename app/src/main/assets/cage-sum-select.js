/* v1.1.18 · "영역 합산"을 켜면 아무 칸도 선택되지 않은 상태로 시작합니다.
 *
 * 이전에는 영역 합산을 누르는 순간 직전에 선택돼 있던 칸이 그대로 선택된 채 남고,
 * 그 칸의 케이지가 합산 목록에 자동으로 들어가 원하지 않는 케이지부터 더해졌습니다.
 * 이제는 선택 칸과 합산 목록을 모두 비운 채 시작하고, 사용자가 누르는 케이지만 더합니다.
 *
 * "선택 없음"은 selected = {r:-1, c:-1} 로 표현합니다. 이 상태에서 숫자 입력·지우기·메모가
 * 빈 좌표(board[-1])에 접근하지 않도록 막고, 방향키는 첫 칸(1행 1열)부터 다시 선택합니다.
 * 이 파일은 다른 스크립트가 감싼 입력 함수들보다 바깥에서 감싸도록 마지막에 불러옵니다.
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const none = app => !app.selected || app.selected.r < 0 || app.selected.c < 0;

  const toggle = p.toggleMultiCageMode;
  p.toggleMultiCageMode = function (...a) {
    const turningOn = !this.isMultiCageMode;
    // 원래 함수가 "선택 칸의 케이지 자동 추가"를 하지 않도록 먼저 선택을 비웁니다.
    if (turningOn) this.selected = { r: -1, c: -1 };
    const r = toggle.apply(this, a);
    if (turningOn) {
      this.selectedCages?.clear();
      this.updateMultiCageCalculation?.();
      this.updateHighlights?.();
      document.querySelectorAll('#sudoku-board .cell.selected').forEach(el => el.classList.remove('selected'));
    }
    return r;
  };

  // 선택이 없을 때 칸을 다루는 입력은 아무것도 하지 않습니다.
  for (const name of ['handleNumberInput', 'erase', 'toggleNoteInSelected', 'openDirectTyping']) {
    const fn = p[name];
    if (typeof fn !== 'function') continue;
    p[name] = function (...a) { if (none(this)) return; return fn.apply(this, a); };
  }

  // 방향키 등으로 범위를 벗어난 좌표가 들어오면 판 안으로 맞춥니다(선택 없음에서 ←↑ 를 눌러도 1행 1열).
  const select = p.selectCell;
  p.selectCell = function (r, c, ...a) {
    const clamp = x => Math.max(0, Math.min(8, Number.isFinite(x) ? x : 0));
    return select.call(this, clamp(r), clamp(c), ...a);
  };

  const helper = p.updateTabletCageHelper;
  if (helper) p.updateTabletCageHelper = function (r, c, ...a) { if (r < 0 || c < 0) return; return helper.call(this, r, c, ...a); };
})();
