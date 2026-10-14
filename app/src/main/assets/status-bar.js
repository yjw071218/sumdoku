/* v1.1.1 앱 전용 상태바: 시스템 상태바를 숨기고 시간·Wi-Fi·배터리를 앱 테마로 그립니다.
 * Android 앱(AndroidBridge.getDeviceStatus)에서만 표시하며, 브라우저에서는 아무것도 바꾸지 않습니다. */
(() => {
  const bridge = () => window.AndroidBridge && window.AndroidBridge.getDeviceStatus;
  let bar, safeTop = 0, last = {};
  function setTop(dp) {
    safeTop = Math.max(0, +dp || 0);
    document.documentElement.style.setProperty('--sb-safe', safeTop + 'px');
  }
  window.onAppSafeTop = setTop;
  function wifiIcon(on) {
    return `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="${on ? 1 : .3}"/><circle cx="12" cy="19" r="1.6" fill="currentColor" opacity="${on ? 1 : .3}"/></svg>`;
  }
  function render() {
    if (!bar) return;
    const now = new Date();
    const time = now.toLocaleTimeString(document.documentElement.lang || 'ko', { hour: 'numeric', minute: '2-digit' });
    bar.querySelector('.sb-time').textContent = time;
    let st = last;
    try { st = JSON.parse(window.AndroidBridge.getDeviceStatus()); } catch (_) {}
    last = st;
    if (st.safeTop != null && Math.abs(st.safeTop - safeTop) > 0.5) setTop(st.safeTop);
    bar.querySelector('.sb-wifi').innerHTML = wifiIcon(!!st.wifi);
    const lv = st.level >= 0 ? st.level : null;
    const batt = bar.querySelector('.sb-batt');
    batt.dataset.low = lv != null && lv <= 15 && !st.charging ? '1' : '';
    batt.dataset.charging = st.charging ? '1' : '';
    bar.querySelector('.sb-batt-fill').style.width = (lv ?? 100) + '%';
    bar.querySelector('.sb-batt-text').textContent = lv != null ? lv + '%' : '';
    bar.setAttribute('aria-label', `${time} · ${lv != null ? lv + '%' : ''}${st.charging ? ' ⚡' : ''}`);
  }
  window.addEventListener('DOMContentLoaded', () => {
    if (!bridge()) return;
    document.body.classList.add('has-app-statusbar');
    bar = document.createElement('div');
    bar.id = 'app-statusbar'; bar.setAttribute('role', 'status'); bar.dataset.userContent = '';
    bar.innerHTML = '<span class="sb-time"></span><span class="sb-right"><span class="sb-wifi"></span><span class="sb-batt"><span class="sb-batt-body"><span class="sb-batt-fill"></span><span class="sb-bolt">⚡</span></span><span class="sb-batt-text"></span></span></span>';
    document.body.append(bar);
    render();
    // 분이 바뀌는 순간에 맞춰 갱신하고, 배터리는 30초마다 다시 읽습니다.
    const tick = () => { render(); setTimeout(tick, 60000 - Date.now() % 60000 + 50); };
    setTimeout(tick, 60000 - Date.now() % 60000 + 50);
    setInterval(render, 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  });
})();
