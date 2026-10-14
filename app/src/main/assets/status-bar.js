/* v1.1.3 앱 전용 상태바: 시스템 상태바를 숨기고 날짜·요일·24시간 시계·시스템 모드(위치/알람/블루투스/방해 금지/진동/무음/절전)·네트워크(비행기/모바일 데이터/Wi-Fi)·배터리를 앱 테마로 그립니다.
 * 상태바는 #app 안에 두어 선택한 테마(라이트/다크/세피아) 색을 그대로 따릅니다.
 * Android 앱(AndroidBridge.getDeviceStatus)에서만 표시하며, 브라우저에서는 아무것도 바꾸지 않습니다. */
(() => {
  const bridge = () => window.AndroidBridge && window.AndroidBridge.getDeviceStatus;
  const LABELS = {
    ko: {
      dnd: '방해 금지', vibrate: '진동', silent: '무음', charging: '충전 중', wifi: 'Wi-Fi 연결됨', nowifi: 'Wi-Fi 없음',
      cellular: '모바일 데이터', airplane: '비행기 탑승 모드', bluetooth: '블루투스', alarm: '알람 설정됨', powerSave: '절전 모드', location: '위치 서비스'
    },
    en: {
      dnd: 'Do not disturb', vibrate: 'Vibrate', silent: 'Silent', charging: 'Charging', wifi: 'Wi-Fi connected', nowifi: 'No Wi-Fi',
      cellular: 'Cellular data', airplane: 'Airplane mode', bluetooth: 'Bluetooth', alarm: 'Alarm set', powerSave: 'Battery saver', location: 'Location'
    },
    ja: {
      dnd: 'おやすみモード', vibrate: 'マナーモード', silent: 'サイレント', charging: '充電中', wifi: 'Wi-Fi接続中', nowifi: 'Wi-Fiなし',
      cellular: 'モバイルデータ', airplane: '機内モード', bluetooth: 'Bluetooth', alarm: 'アラーム設定中', powerSave: '省電力モード', location: '位置情報'
    },
    zh: {
      dnd: '勿扰模式', vibrate: '振动', silent: '静音', charging: '充电中', wifi: '已连接 Wi-Fi', nowifi: '无 Wi-Fi',
      cellular: '移动数据', airplane: '飞行模式', bluetooth: '蓝牙', alarm: '已设闹钟', powerSave: '省电模式', location: '定位服务'
    },
    'zh-TW': {
      dnd: '勿擾模式', vibrate: '震動', silent: '靜音', charging: '充電中', wifi: '已連線 Wi-Fi', nowifi: '無 Wi-Fi',
      cellular: '行動數據', airplane: '飛航模式', bluetooth: '藍牙', alarm: '已設鬧鐘', powerSave: '省電模式', location: '定位服務'
    },
    es: {
      dnd: 'No molestar', vibrate: 'Vibración', silent: 'Silencio', charging: 'Cargando', wifi: 'Wi-Fi conectado', nowifi: 'Sin Wi-Fi',
      cellular: 'Datos móviles', airplane: 'Modo avión', bluetooth: 'Bluetooth', alarm: 'Alarma activada', powerSave: 'Ahorro de batería', location: 'Ubicación'
    },
    fr: {
      dnd: 'Ne pas déranger', vibrate: 'Vibreur', silent: 'Silencieux', charging: 'En charge', wifi: 'Wi-Fi connecté', nowifi: 'Pas de Wi-Fi',
      cellular: 'Données mobiles', airplane: 'Mode avion', bluetooth: 'Bluetooth', alarm: 'Alarme activée', powerSave: 'Économiseur de batterie', location: 'Localisation'
    },
    de: {
      dnd: 'Nicht stören', vibrate: 'Vibration', silent: 'Lautlos', charging: 'Wird geladen', wifi: 'WLAN verbunden', nowifi: 'Kein WLAN',
      cellular: 'Mobile Daten', airplane: 'Flugmodus', bluetooth: 'Bluetooth', alarm: 'Wecker gestellt', powerSave: 'Energiesparmodus', location: 'Standort'
    }
  };
  const lang = () => (window.I18N && LABELS[I18N.currentLang]) ? I18N.currentLang : 'ko';
  const L = () => LABELS[lang()];
  let bar, safeTop = 0, last = {};
  function setTop(dp) {
    safeTop = Math.max(0, +dp || 0);
    document.documentElement.style.setProperty('--sb-safe', safeTop + 'px');
  }
  window.onAppSafeTop = setTop;
  const svg = (body, title) => `<svg viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
  const ICON = {
    wifi: on => svg(`<g opacity="${on ? 1 : .3}"><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></g>`, on ? L().wifi : L().nowifi),
    cellular: () => svg('<path d="M3 15h2.5v4H3v-4zm4.5-4H10v8H7.5v-8zm4.5-4H14.5v12H12V7zm4.5-4H19v16h-2.5V3z" fill="currentColor"/>', L().cellular),
    airplane: () => svg('<path d="M10.18 9L3 13.5V15l7.18-2.16V18L8 19.5V21l4-1 4 1v-1.5L13.82 18v-5.16L21 15v-1.5L13.82 9V3.5a1.82 1.82 0 0 0-3.64 0V9z" fill="currentColor"/>', L().airplane),
    bluetooth: () => svg('<path d="M7 7l10 10-5 5V2l5 5L7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>', L().bluetooth),
    alarm: () => svg('<circle cx="12" cy="13" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.5v3.5l2.5 1.5M4.5 4.5l3 2M19.5 4.5l-3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', L().alarm),
    dnd: () => svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7.5 12h9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>', L().dnd),
    vibrate: () => svg('<rect x="8" y="4" width="8" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 8v8M20 8v8M1.5 10v4M22.5 10v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', L().vibrate),
    silent: () => svg('<path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', L().silent),
    powerSave: () => svg('<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v9M7.5 12h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>', L().powerSave),
    location: () => svg('<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9" r="2.5" fill="currentColor"/>', L().location)
  };

  function setHtmlIfChanged(el, html) {
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }

  function render() {
    if (!bar) return;
    const now = new Date(), loc = lang() === 'zh' ? 'zh-CN' : lang();
    const time = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
    const date = new Intl.DateTimeFormat(loc, { month: 'short', day: 'numeric', weekday: 'short' }).format(now);
    bar.querySelector('.sb-time').textContent = time;
    bar.querySelector('.sb-date').textContent = date;
    let st = last;
    try { st = JSON.parse(window.AndroidBridge.getDeviceStatus()); } catch (_) {}
    last = st;
    if (st.safeTop != null && Math.abs(st.safeTop - safeTop) > 0.5) setTop(st.safeTop);

    const modes = [];
    if (st.location) modes.push(ICON.location());
    if (st.alarm) modes.push(ICON.alarm());
    if (st.bluetooth) modes.push(ICON.bluetooth());
    if (st.dnd) modes.push(ICON.dnd());
    if (st.ringer === 'vibrate') modes.push(ICON.vibrate());
    else if (st.ringer === 'silent') modes.push(ICON.silent());
    if (st.powerSave) modes.push(ICON.powerSave());
    setHtmlIfChanged(bar.querySelector('.sb-modes'), modes.join(''));

    if (st.airplane) {
      setHtmlIfChanged(bar.querySelector('.sb-airplane'), ICON.airplane());
      setHtmlIfChanged(bar.querySelector('.sb-cellular'), '');
    } else {
      setHtmlIfChanged(bar.querySelector('.sb-airplane'), '');
      setHtmlIfChanged(bar.querySelector('.sb-cellular'), st.cellular ? ICON.cellular() : '');
    }
    setHtmlIfChanged(bar.querySelector('.sb-wifi'), st.wifi ? ICON.wifi(true) : (st.cellular || st.airplane ? '' : ICON.wifi(false)));

    const lv = st.level >= 0 ? st.level : null;
    const batt = bar.querySelector('.sb-batt');
    batt.dataset.low = lv != null && lv <= 15 && !st.charging ? '1' : '';
    batt.dataset.charging = st.charging ? '1' : '';
    bar.querySelector('.sb-batt-fill').style.width = (lv ?? 100) + '%';
    bar.querySelector('.sb-batt-text').textContent = lv != null ? lv + '%' : '';

    const extra = [
      st.airplane && L().airplane,
      st.cellular && L().cellular,
      st.wifi && L().wifi,
      st.location && L().location,
      st.alarm && L().alarm,
      st.bluetooth && L().bluetooth,
      st.dnd && L().dnd,
      st.ringer === 'vibrate' && L().vibrate,
      st.ringer === 'silent' && L().silent,
      st.powerSave && L().powerSave,
      st.charging && L().charging
    ].filter(Boolean);
    bar.setAttribute('aria-label', [date, time, lv != null ? lv + '%' : '', ...extra].filter(Boolean).join(' · '));
  }

  window.addEventListener('DOMContentLoaded', () => {
    if (!bridge()) return;
    document.body.classList.add('has-app-statusbar');
    bar = document.createElement('div');
    bar.id = 'app-statusbar'; bar.setAttribute('role', 'status'); bar.dataset.userContent = '';
    bar.innerHTML = '<span class="sb-left"><span class="sb-time"></span><span class="sb-date"></span></span><span class="sb-right"><span class="sb-modes"></span><span class="sb-net"><span class="sb-airplane"></span><span class="sb-cellular"></span><span class="sb-wifi"></span></span><span class="sb-batt"><span class="sb-batt-body"><span class="sb-batt-fill"></span><span class="sb-bolt">⚡</span></span><span class="sb-batt-text"></span></span></span>';
    (document.getElementById('app') || document.body).append(bar);
    render();
    const tick = () => { render(); setTimeout(tick, 60000 - Date.now() % 60000 + 50); };
    setTimeout(tick, 60000 - Date.now() % 60000 + 50);
    setInterval(render, 5000); // 배터리·네트워크·모드 상태 변화 주기적 갱신
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    if (window.I18N && I18N.setLanguage) { const base = I18N.setLanguage; I18N.setLanguage = function () { const r = base.apply(this, arguments); render(); return r; }; }
  });
})();
