// v2.0.1 · 첫 실행 깜빡임 수정
// 문제: index.html의 기본값(라이트 테마·한국어)이 먼저 그려진 뒤, 스크립트가 모두 실행되고 나서야
//       저장된 테마·언어로 바뀌어 기본 화면이 잠깐 보였습니다.
// 해결: <head>의 인라인 스크립트가 저장된 테마를 가장 먼저 적용하고 본문을 숨겨 둡니다(boot-pending).
//       모든 모듈의 초기화·번역 적용이 끝난 뒤(load + 2프레임) 이 파일이 본문을 공개하고,
//       네이티브 쪽에도 준비 완료를 알려 WebView를 표시합니다.
(function () {
  'use strict';
  const BG = { 'theme-light': '#f8fafc', 'theme-dark': '#0f172a', 'theme-sepia': '#faf5eb' };
  const root = document.documentElement;

  function syncBootTheme(theme) {
    if (!BG[theme]) theme = 'theme-light';
    Object.keys(BG).forEach(t => root.classList.remove('boot-' + t));
    root.classList.add('boot-' + theme);
    root.style.backgroundColor = BG[theme];
    // 다음 실행 때 네이티브가 WebView 배경을 미리 같은 색으로 칠하도록 저장합니다(흰 화면 번쩍임 방지).
    try { window.AndroidBridge?.setBootBackground?.(BG[theme]); } catch (_) {}
  }

  // 테마가 바뀔 때마다 html 배경과 네이티브 배경색을 함께 갱신합니다.
  if (typeof SumdokuApp !== 'undefined' && SumdokuApp.prototype.applyTheme && !SumdokuApp.prototype.applyTheme.__bootSync) {
    const base = SumdokuApp.prototype.applyTheme;
    SumdokuApp.prototype.applyTheme = function (themeName) {
      const r = base.apply(this, arguments);
      try { syncBootTheme(this.themes?.[this.currentThemeIndex] || themeName); } catch (_) {}
      return r;
    };
    SumdokuApp.prototype.applyTheme.__bootSync = true;
  }

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    try {
      const app = window.app;
      if (app && app.themes) syncBootTheme(app.themes[app.currentThemeIndex]);
      // 혹시 초기화 순서상 번역이 덜 적용된 요소가 있으면 공개 직전에 한 번 더 적용합니다.
      if (window.I18N && I18N.currentLang && I18N.currentLang !== 'ko' && typeof I18N.applyToDOM === 'function') I18N.applyToDOM();
    } catch (_) {}
    root.classList.remove('boot-pending');
    try { window.AndroidBridge?.onAppReady?.(); } catch (_) {}
  }

  function revealAfterPaint() {
    requestAnimationFrame(() => requestAnimationFrame(reveal));
  }

  if (document.readyState === 'complete') revealAfterPaint();
  else window.addEventListener('load', revealAfterPaint, { once: true });
  // 어떤 이유로든 load가 늦어져도 화면이 영영 숨겨지지 않도록 안전장치를 둡니다.
  setTimeout(reveal, 3500);
})();
