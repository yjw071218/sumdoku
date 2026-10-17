/* v1.1.4 앱 전용 상태바:
 * - 실제 안드로이드 폰 상태바와 동일하게 표시 (날짜 제거, 불필요한 알람/위치/블루투스/절전 아이콘 제거)
 * - 네트워크 계층 적용 (비행기 모드 > Wi-Fi > 모바일 데이터 우선순위, Wi-Fi 연결 시 모바일 데이터 숨김)
 * - 비정상 모드(방해 금지, 진동, 무음)만 선별 표시
 * - 카메라섬(펀치홀/노치) 영역 침범 방지 (--sb-left-max, --sb-right-max, --sb-pad-left, --sb-pad-right)
 */
(() => {
  const bridge = () => window.AndroidBridge && window.AndroidBridge.getDeviceStatus;
  const LABELS = {
    ko: { dnd: '방해 금지', vibrate: '진동', silent: '무음', charging: '충전 중', wifi: 'Wi-Fi', cellular: '모바일 데이터', airplane: '비행기 탑승 모드' },
    en: { dnd: 'Do not disturb', vibrate: 'Vibrate', silent: 'Silent', charging: 'Charging', wifi: 'Wi-Fi', cellular: 'Cellular data', airplane: 'Airplane mode' },
    ja: { dnd: 'おやすみモード', vibrate: 'マナーモード', silent: 'サイレント', charging: '充電中', wifi: 'Wi-Fi', cellular: 'モバイルデータ', airplane: '機内モード' },
    zh: { dnd: '勿扰模式', vibrate: '振动', silent: '静音', charging: '充电中', wifi: 'Wi-Fi', cellular: '移动数据', airplane: '飞行模式' },
    'zh-TW': { dnd: '勿擾模式', vibrate: '震動', silent: '靜音', charging: '充電中', wifi: 'Wi-Fi', cellular: '行動數據', airplane: '飛航模式' },
    es: { dnd: 'No molestar', vibrate: 'Vibración', silent: 'Silencio', charging: 'Cargando', wifi: 'Wi-Fi', cellular: 'Datos móviles', airplane: 'Modo avión' },
    fr: { dnd: 'Ne pas déranger', vibrate: 'Vibreur', silent: 'Silencieux', charging: 'En charge', wifi: 'Wi-Fi', cellular: 'Données mobiles', airplane: 'Mode avion' },
    de: { dnd: 'Nicht stören', vibrate: 'Vibration', silent: 'Lautlos', charging: 'Wird geladen', wifi: 'WLAN', cellular: 'Mobile Daten', airplane: 'Flugmodus' }
  };
  const lang = () => (window.I18N && LABELS[I18N.currentLang]) ? I18N.currentLang : 'ko';
  const OFFLINE_LABELS = {ko:'인터넷 연결 끊김',en:'No internet connection',ja:'インターネット未接続',zh:'无互联网连接','zh-TW':'無網際網路連線',es:'Sin conexión a Internet',fr:'Pas de connexion Internet',de:'Keine Internetverbindung'};
  const L = () => LABELS[lang()];
  let bar, safeTop = 0, last = {};

  function setTop(dp) {
    safeTop = Math.max(0, +dp || 0);
    document.documentElement.style.setProperty('--sb-safe', safeTop + 'px');
  }
  window.onAppSafeTop = setTop;

  function setCutout(safeTopDp, cutLeft, cutRight) {
    setTop(safeTopDp);
    if (!cutLeft || cutLeft <= 0 || !cutRight || cutRight <= 0) {
      document.documentElement.style.removeProperty('--sb-left-max');
      document.documentElement.style.removeProperty('--sb-right-max');
      document.documentElement.style.removeProperty('--sb-pad-left');
      document.documentElement.style.removeProperty('--sb-pad-right');
      return;
    }
    const winW = window.innerWidth || document.documentElement.clientWidth || 360;
    if (cutLeft < 80) {
      document.documentElement.style.setProperty('--sb-pad-left', Math.round(cutRight + 8) + 'px');
    } else if (cutRight > winW - 80) {
      document.documentElement.style.setProperty('--sb-pad-right', Math.round(winW - cutLeft + 8) + 'px');
    } else {
      const leftMax = Math.max(40, Math.round(cutLeft - 8));
      const rightMax = Math.max(40, Math.round(winW - cutRight - 8));
      document.documentElement.style.setProperty('--sb-left-max', leftMax + 'px');
      document.documentElement.style.setProperty('--sb-right-max', rightMax + 'px');
    }
  }
  window.onAppCutout = setCutout;

  const svg = (body, title) => `<svg viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
  const ICON = {
    offline: () => svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c-4 4-4 14 0 18M12 3c2 2 3 5 3 8M3 3l18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', OFFLINE_LABELS[lang()]),
    wifi: () => svg('<g><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></g>', L().wifi),
    cellular: () => svg('<path d="M3 15h2.5v4H3v-4zm4.5-4H10v8H7.5v-8zm4.5-4H14.5v12H12V7zm4.5-4H19v16h-2.5V3z" fill="currentColor"/>', L().cellular),
    // v2.0.5: 이더넷, 모바일 데이터 세대(5G/LTE) 표시
    ethernet: () => svg('<path d="M7 3h10v4h3v8h-4v6H8v-6H4V7h3V3zm2 6v4M12 9v4M15 9v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>', 'Ethernet'),
    cellData: gen => `<span class="sb-gen" aria-hidden="true">${/^(5G|LTE\+?|3G|2G)$/.test(gen || '') ? gen : '⇅'}</span>` + svg('<path d="M3 15h2.5v4H3v-4zm4.5-4H10v8H7.5v-8zm4.5-4H14.5v12H12V7zm4.5-4H19v16h-2.5V3z" fill="currentColor"/>', L().cellular),
    airplane: () => svg('<path d="M10.18 9L3 13.5V15l7.18-2.16V18L8 19.5V21l4-1 4 1v-1.5L13.82 18v-5.16L21 15v-1.5L13.82 9V3.5a1.82 1.82 0 0 0-3.64 0V9z" fill="currentColor"/>', L().airplane),
    dnd: () => svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7.5 12h9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>', L().dnd),
    vibrate: () => svg('<rect x="8" y="4" width="8" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 8v8M20 8v8M1.5 10v4M22.5 10v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', L().vibrate),
    silent: () => svg('<path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', L().silent)
  };

  function setHtmlIfChanged(el, html) {
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }

  function render() {
    if (!bar) return;
    const now = new Date(), loc = lang() === 'zh' ? 'zh-CN' : lang();
    let st = last;
    try { st = JSON.parse(window.AndroidBridge.getDeviceStatus()); } catch (_) {}
    last = st;
    if (st.safeTop != null && Math.abs(st.safeTop - safeTop) > 0.5) {
      if (st.cutLeft != null && st.cutRight != null) setCutout(st.safeTop, st.cutLeft, st.cutRight);
      else setTop(st.safeTop);
    }
    const hourCycle = st.is24 ? 'h23' : 'h12';
    const time = new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit', hourCycle }).format(now);
    bar.querySelector('.sb-time').textContent = time;

    // 실제 폰 상태바: 무음/진동/방해금지만 선별 표시
    const modes = [];
    if (st.dnd) modes.push(ICON.dnd());
    if (st.ringer === 'vibrate') modes.push(ICON.vibrate());
    else if (st.ringer === 'silent') modes.push(ICON.silent());
    setHtmlIfChanged(bar.querySelector('.sb-modes'), modes.join(''));

    // 네트워크: 비행기 모드 > Wi-Fi > 모바일 데이터 우선순위 (Wi-Fi 활성 시 모바일 데이터 숨김)
    if (st.airplane) {
      setHtmlIfChanged(bar.querySelector('.sb-airplane'), ICON.airplane());
      // 비행기 모드에서도 Wi-Fi·이더넷을 켜 두었다면 함께 보여 줍니다.
      setHtmlIfChanged(bar.querySelector('.sb-cellular'), st.ethernet ? ICON.ethernet() : '');
      setHtmlIfChanged(bar.querySelector('.sb-wifi'), !st.ethernet && st.wifi ? ICON.wifi() : '');
    } else {
      setHtmlIfChanged(bar.querySelector('.sb-airplane'), '');
      // 이더넷 > Wi-Fi > 모바일 데이터. 모바일 데이터는 5G/LTE 같은 세대 글자와 막대를 함께 보입니다.
      setHtmlIfChanged(bar.querySelector('.sb-cellular'), st.ethernet ? ICON.ethernet() : (!st.wifi && st.cellular ? ICON.cellData(st.cellGen) : ''));
      setHtmlIfChanged(bar.querySelector('.sb-wifi'), !st.ethernet && st.wifi ? ICON.wifi() : '');
    }

    const offline = typeof st.internet === 'boolean' ? !st.internet : st.wifi === false && st.cellular === false && !st.ethernet;
    setHtmlIfChanged(bar.querySelector('.sb-offline'), offline ? ICON.offline() : '');
    const lv = st.level >= 0 ? st.level : null;
    const batt = bar.querySelector('.sb-batt');
    batt.dataset.low = lv != null && lv <= 15 && !st.charging ? '1' : '';
    batt.dataset.charging = st.charging ? '1' : '';
    bar.querySelector('.sb-batt-fill').style.width = (lv ?? 100) + '%';
    bar.querySelector('.sb-batt-text').textContent = lv != null ? lv + '%' : '';

    const extra = [
      st.airplane && L().airplane,
      !st.airplane && st.ethernet && 'Ethernet',
      !st.airplane && !st.ethernet && st.wifi && L().wifi,
      !st.airplane && !st.ethernet && !st.wifi && st.cellular && L().cellular + (st.cellGen ? ' ' + st.cellGen : ''),
      offline && OFFLINE_LABELS[lang()],
      st.dnd && L().dnd,
      st.ringer === 'vibrate' && L().vibrate,
      st.ringer === 'silent' && L().silent,
      st.charging && L().charging
    ].filter(Boolean);
    bar.setAttribute('aria-label', [time, lv != null ? lv + '%' : '', ...extra].filter(Boolean).join(' · '));
  }

  window.onAppDeviceStatusChanged = () => render();
  window.addEventListener('focus', () => render());
  window.addEventListener('DOMContentLoaded', () => {
    if (!bridge()) return;
    document.body.classList.add('has-app-statusbar');
    bar = document.createElement('div');
    bar.id = 'app-statusbar'; bar.setAttribute('role', 'status'); bar.dataset.userContent = '';
    bar.innerHTML = '<span class="sb-left"><span class="sb-time"></span></span><span class="sb-right"><span class="sb-modes"></span><span class="sb-net"><span class="sb-airplane"></span><span class="sb-cellular"></span><span class="sb-wifi"></span></span><span class="sb-batt"><span class="sb-batt-body"><span class="sb-batt-fill"></span><span class="sb-bolt" aria-hidden="true"><svg viewBox="0 0 7 10" xmlns="http://www.w3.org/2000/svg"><path d="M4 0 0 6h3l-1 4 5-6H4z"/></svg></span></span><span class="sb-batt-text"></span></span></span>';
    (document.getElementById('app') || document.body).append(bar);
    const offline = document.createElement('span'); offline.className = 'sb-offline';
    bar.querySelector('.sb-net').append(offline);
    render();
    const tick = () => { render(); setTimeout(tick, 60000 - Date.now() % 60000 + 50); };
    setTimeout(tick, 60000 - Date.now() % 60000 + 50);
    // 네이티브 변경 이벤트가 기본 경로이며 폴링은 이벤트 누락을 보완합니다.
    setInterval(() => { if (!document.hidden) render(); }, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    if (window.I18N && I18N.setLanguage) { const base = I18N.setLanguage; I18N.setLanguage = function () { const r = base.apply(this, arguments); render(); return r; }; }
  });
})();
