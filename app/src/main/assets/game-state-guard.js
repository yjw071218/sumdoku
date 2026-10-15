/* v1.1.18 · "이어하기"에 1:1 배틀이나 이미 끝난 게임이 뜨지 않게 합니다.
 *
 * 원인: saveOngoingGame 은 isBattle 이 true 일 때만 저장을 건너뜁니다. 그런데 배틀이 끝나면
 * endBattleSession 이 isBattle 을 먼저 false 로 바꾸고, 그 뒤 홈으로 나갈 때(switchView) 배틀 판이
 * 일반 게임처럼 저장되었습니다. 목숨을 다 쓴 판도 막는 조건이 없어서, 이어하기를 누르면
 * 목숨이 모두 소진된 채 멈춘 판이 열렸습니다.
 *
 * 처리:
 *   - 저장 시: gameMode 가 'battle'(배틀 시작 때 설정되고 끝나도 유지됨)이면 저장하지 않습니다.
 *             일반 게임이 끝난 상태(실패 결과, 목숨 소진)면 저장 대신 이어하기 기록을 지웁니다.
 *             일일 도전은 하루 단위로 결과를 보존하는 기존 동작을 유지합니다.
 *   - 표시·복원 시: 이미 저장된 기록이 배틀이거나 끝난 게임이면 버리고 이어하기 버튼을 숨깁니다
 *             (이전 버전이 남긴 잘못된 기록 정리).
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const KEY = 'sumdoku_ongoing_game';

  const livesOut = (mistakes, rules) => {
    if (!rules) return false;
    const ml = rules.maxLives;
    // 무한 목숨이거나, 목숨을 다 써도 계속 진행하는 규칙이면 끝난 게임이 아닙니다.
    if (ml === 'unlimited' || rules.mistakeLimit === false || rules.livesExhaustedAction === 'continue') return false;
    const n = Number(ml);
    return Number.isFinite(n) && n > 0 && Number(mistakes) >= n;
  };
  // 이어하기로 열면 안 되는 저장 기록인가
  const invalidSaved = s => !s || !Array.isArray(s.board) || s.gameMode === 'battle' || s.isBattle || (!s.isDaily && (s.isWin || s.resultReason)) ||
    (!s.isDaily && livesOut(s.mistakes, s.gameRules));
  const dropSaved = app => { try { localStorage.removeItem(KEY); } catch (_) {} app.dom?.btnHomeContinue?.classList.add('hidden'); };

  const save = p.saveOngoingGame;
  p.saveOngoingGame = function (...a) {
    if (this.gameMode === 'battle' || this.isBattle) return;
    if (!this.isDaily) {
      const ended = (!this.isWin && this.resultReason) || livesOut(this.mistakes, this.rules || this.gameRules);
      if (ended && this.currentView === 'game') { dropSaved(this); return; }
    }
    return save.apply(this, a);
  };

  const check = p.checkContinueGame;
  p.checkContinueGame = function (...a) {
    let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (_) { s = null; }
    if (s && invalidSaved(s)) { dropSaved(this); return false; }
    return check.apply(this, a);
  };

  const restore = p.restoreOngoingGame;
  p.restoreOngoingGame = function (savedState = null, ...a) {
    if (!savedState) {
      let s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (_) { s = null; }
      if (s && invalidSaved(s)) { dropSaved(this); this.showToast?.('이어서 할 게임이 없습니다.'); return false; }
    }
    return restore.call(this, savedState, ...a);
  };

  window.SumdokuGameStateGuard = { invalidSaved };
})();
