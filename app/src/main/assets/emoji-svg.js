/* v2.1.8 · 이모지 → SVG 렌더러
 *
 * 번역 문자열·토스트·버튼 등 앱 곳곳의 이모지를 화면에 그려지는 순간 인라인 SVG로 바꿉니다.
 *  - 기기·폰트마다 모양이 달라지던 이모지를 앱 고유의 단색/포인트색 아이콘으로 통일
 *  - 문자열 원본은 그대로 두므로 번역표·로직(정규식 비교 등)은 영향을 받지 않습니다.
 *  - <option>, title/placeholder/aria-label 처럼 SVG를 넣을 수 없는 곳에서는 이모지를 지웁니다.
 *  - 입력칸(input/textarea)·contenteditable·canvas·svg 안은 건드리지 않습니다.
 *  - 캔버스(공유 이미지)용으로 SumdokuEmoji.draw(ctx, key, x, y, size, color) 를 제공합니다.
 */
(() => {
  const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  // 아이콘: [svg 내용, 기본 색(없으면 글자색)]
  const ICONS = {
    swords: [`<path ${S} d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path ${S} d="M9.5 6.5L13 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2"/>`],
    star: ['<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/>'],
    starOutline: [`<path ${S} d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/>`],
    starGold: ['<path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"/>', '#facc15'],
    trophy: ['<path d="M7 3h10v6a5 5 0 0 1-10 0z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M7 5H3.5v1.5A3.5 3.5 0 0 0 7 10M17 5h3.5v1.5A3.5 3.5 0 0 1 17 10"/><path d="M10.5 13.5h3v3.5h-3z"/><rect x="7" y="17" width="10" height="4" rx="1"/>', '#f59e0b'],
    timer: [`<circle ${S} cx="12" cy="13.5" r="7.5"/><path ${S} d="M12 9.5v4l2.8 2M9.5 2.5h5M19 6l1.5-1.5"/>`],
    alarm: [`<circle ${S} cx="12" cy="13" r="7.5"/><path ${S} d="M12 9v4l2.5 2M3 5.5L6 3M21 5.5L18 3"/>`],
    hourglass: [`<path ${S} d="M6 2.5h12M6 21.5h12M7 2.5c0 5 10 5 10 9.5s-10 4.5-10 9.5M17 2.5c0 5-10 5-10 9.5s10 4.5 10 9.5"/>`],
    check: [`<path ${S} stroke-width="2.8" d="M4.5 12.5l4.8 4.8L19.5 7"/>`],
    checkGreen: ['<rect x="2" y="2" width="20" height="20" rx="5"/><path fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" d="M6.5 12.5l3.8 3.8 7.2-8.3"/>', '#22c55e'],
    x: [`<path ${S} stroke-width="2.8" d="M6 6l12 12M18 6L6 18"/>`],
    xRed: [`<path ${S} stroke-width="3" d="M6 6l12 12M18 6L6 18"/>`, '#ef4444'],
    bolt: ['<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', '#facc15'],
    arrow: [`<path ${S} d="M4 12h15M13 6l6 6-6 6"/>`],
    sparkles: ['<path d="M10 3l1.8 5.7L17.5 10.5l-5.7 1.8L10 18l-1.8-5.7L2.5 10.5l5.7-1.8z"/><path d="M18.5 13.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/>', '#fbbf24'],
    shield: ['<path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z"/><path fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8.5 12l2.5 2.5 4.5-5"/>', '#3b82f6'],
    pawn: ['<circle cx="12" cy="6" r="3.3"/><path d="M9 10.5h6l1.2 6.5H7.8z"/><rect x="5.5" y="18" width="13" height="3.5" rx="1.2"/>'],
    puzzle: ['<path d="M4 7h4a2.5 2.5 0 1 1 5 0h4v4a2.5 2.5 0 1 1 0 5v4h-4a2.5 2.5 0 1 0-5 0H4v-4a2.5 2.5 0 1 0 0-5z"/>', '#8b5cf6'],
    warn: ['<path d="M12 2.5L22.5 21h-21z"/><path fill="none" stroke="#1f2937" stroke-width="2.4" stroke-linecap="round" d="M12 9.5v5M12 17.8v.2"/>', '#f59e0b'],
    target: ['<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6.5" fill="#fff"/><circle cx="12" cy="12" r="3.2"/>', '#ef4444'],
    bulb: ['<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/><rect x="8.5" y="18.2" width="7" height="1.8" rx=".9" fill="#94a3b8"/><rect x="9.5" y="20.8" width="5" height="1.6" rx=".8" fill="#94a3b8"/>', '#facc15'],
    ban: [`<circle ${S} stroke-width="2.6" cx="12" cy="12" r="9"/><path ${S} stroke-width="2.6" d="M5.6 5.6l12.8 12.8"/>`, '#ef4444'],
    dice: ['<rect x="3" y="3" width="18" height="18" rx="4"/><g fill="#fff"><circle cx="8" cy="8" r="1.7"/><circle cx="16" cy="8" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="8" cy="16" r="1.7"/><circle cx="16" cy="16" r="1.7"/></g>'],
    party: ['<path d="M3 21l5-14 9 9z" fill="#f59e0b"/><path fill="none" stroke="#ec4899" stroke-width="2" stroke-linecap="round" d="M14 3c0 3 2 3 2 5M19 6c-2 1-1 3-3 4M21 12c-3-1-4 1-6 0"/><circle cx="11" cy="4" r="1.2" fill="#22d3ee"/><circle cx="20" cy="17" r="1.2" fill="#a78bfa"/>'],
    fire: ['<path d="M12 22c-4.4 0-7.5-3-7.5-7 0-3.5 2.5-5.5 3.5-8.5 1.2 1.6 1.6 3 1.5 4.5C11.5 9 13 6 12.5 2c4 2.5 7 7 7 12 0 4.6-3.1 8-7.5 8z"/><path d="M12 22c-2 0-3.5-1.4-3.5-3.4 0-2 1.5-3 2.4-4.8 1 1.6 2.6 2.2 2.6 1 .8.9 2 2.2 2 3.8 0 2-1.5 3.4-3.5 3.4z" fill="#fde047"/>', '#f97316'],
    clipboard: [`<rect ${S} x="5" y="4" width="14" height="18" rx="2"/><rect ${S} x="9" y="2" width="6" height="4" rx="1"/><path ${S} d="M8.5 11h7M8.5 15h5"/>`],
    heart: ['<path d="M12 21s-8.5-5.2-8.5-11.2A4.8 4.8 0 0 1 12 6.5a4.8 4.8 0 0 1 8.5 3.3C20.5 15.8 12 21 12 21z"/>', '#ef4444'],
    heartBroken: ['<path d="M12 21s-8.5-5.2-8.5-11.2A4.8 4.8 0 0 1 12 6.5l-1.5 4 2.5 2-2 3 2.5-3-2.5-2 1.5-4a4.8 4.8 0 0 1 8.5 3.3C20.5 15.8 12 21 12 21z"/>', '#ef4444'],
    lock: [`<rect x="5" y="11" width="14" height="10" rx="2.2" fill="currentColor"/><path ${S} stroke-width="2.2" d="M8 11V8a4 4 0 0 1 8 0v3"/>`],
    user: ['<circle cx="12" cy="8" r="4.2"/><path d="M3.5 21c.6-4.4 4-7 8.5-7s7.9 2.6 8.5 7z"/>'],
    numbers: ['<rect x="2.5" y="2.5" width="19" height="19" rx="4"/><text x="12" y="16.3" font-size="10.5" font-weight="900" font-family="system-ui,sans-serif" text-anchor="middle" fill="#fff">123</text>', '#3b82f6'],
    calendar: [`<rect ${S} x="3" y="5" width="18" height="16" rx="2.5"/><path ${S} d="M3 10h18M8 3v4M16 3v4"/><rect x="7" y="13" width="3" height="3" rx=".6" fill="currentColor"/>`],
    flagWhite: [`<path ${S} d="M5 22V3"/><path d="M5 4h12l-2.5 4L17 12H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`],
    flagCheck: ['<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M5 22V3"/><path d="M5 4h14v9H5z" fill="#fff" stroke="currentColor" stroke-width="1.5"/><path d="M5 4h3.5v3H5zM12 4h3.5v3H12zM8.5 7H12v3H8.5zM15.5 7H19v3h-3.5zM5 10h3.5v3H5zM12 10h3.5v3H12z"/>'],
    scale: [`<path ${S} d="M12 3v18M7 21h10M4 7h16M12 4.5l-1 2.5M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>`],
    brain: [`<path ${S} d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3 2.5 2.5 0 0 0 3-1.5V5.5A2.5 2.5 0 0 0 9 4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3 2.5 2.5 0 0 1-3-1.5"/>`, '#ec4899'],
    gamepad: ['<path d="M7 7h10a5 5 0 0 1 4.8 6.3l-.9 3.4a2.6 2.6 0 0 1-4.5 1L14.5 15h-5l-1.9 2.7a2.6 2.6 0 0 1-4.5-1l-.9-3.4A5 5 0 0 1 7 7z"/><path fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" d="M7.5 10v4M5.5 12h4"/><circle cx="15.5" cy="11" r="1.1" fill="#fff"/><circle cx="17.5" cy="13" r="1.1" fill="#fff"/>'],
    wrench: ['<path d="M21 6.5a5.5 5.5 0 0 1-7.4 5.2L6 19.3a2 2 0 0 1-2.8-2.8l7.6-7.6A5.5 5.5 0 0 1 17.5 3l-3 3 .8 2.7 2.7.8 3-3z"/>'],
    search: [`<circle ${S} stroke-width="2.4" cx="10.5" cy="10.5" r="6.5"/><path ${S} stroke-width="2.6" d="M15.5 15.5L21 21"/>`],
    ruler: [`<path ${S} d="M3 21V3l18 18zM7 13v4h4M3 7h2M3 11h2M3 15h2"/>`],
    question: [`<circle cx="12" cy="12" r="10" fill="currentColor"/><path fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" d="M9.3 9.3a2.8 2.8 0 1 1 3.7 2.6c-.7.3-1 .9-1 1.6v.5M12 17.5v.2"/>`, '#3b82f6'],
    box: [`<path ${S} d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9"/>`, '#b45309'],
    gear: [`<circle ${S} cx="12" cy="12" r="3.2"/><path ${S} d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3"/><circle ${S} cx="12" cy="12" r="6.6"/>`],
    pencil: ['<path d="M15.5 4.5l4 4L8 20H4v-4z"/><path d="M17 3l4 4-1.2 1.2-4-4z" fill="#f472b6"/>'],
    memo: [`<rect x="4" y="2.5" width="14" height="19" rx="2" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/><path fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-linecap="round" d="M7 7.5h8M7 11h6M7 14.5h4"/><path d="M19.5 9.5l2 2-7.5 7.5-3 1 1-3z" fill="#f59e0b"/>`],
    globe: [`<circle ${S} cx="12" cy="12" r="9.5"/><path ${S} d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19"/>`, '#0ea5e9'],
    hand: ['<path d="M8 11V5a1.5 1.5 0 0 1 3 0v5V3.5a1.5 1.5 0 0 1 3 0V10V5a1.5 1.5 0 0 1 3 0v6V8.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.8-3.1L3.5 14a1.6 1.6 0 0 1 2.6-1.8L8 14z"/>', '#f59e0b'],
    plus: [`<path ${S} stroke-width="2.8" d="M12 5v14M5 12h14"/>`],
    minus: [`<path ${S} stroke-width="2.8" d="M5 12h14"/>`],
    medal1: ['<path d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z" fill="#3b82f6"/><circle cx="12" cy="15" r="7"/><text x="12" y="18.6" font-size="10" font-weight="900" font-family="system-ui,sans-serif" text-anchor="middle" fill="#78350f">1</text>', '#facc15'],
    medal2: ['<path d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z" fill="#3b82f6"/><circle cx="12" cy="15" r="7"/><text x="12" y="18.6" font-size="10" font-weight="900" font-family="system-ui,sans-serif" text-anchor="middle" fill="#334155">2</text>', '#cbd5e1'],
    medal3: ['<path d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z" fill="#3b82f6"/><circle cx="12" cy="15" r="7"/><text x="12" y="18.6" font-size="10" font-weight="900" font-family="system-ui,sans-serif" text-anchor="middle" fill="#fff">3</text>', '#d97706'],
    medal: ['<path d="M7 2h4l2 6H9zM13 2h4l-2 6h-4z" fill="#ef4444"/><circle cx="12" cy="15" r="7"/><path d="M12 11.3l1.1 2.3 2.5.3-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.3z" fill="#fff"/>', '#f59e0b'],
    crown: ['<path d="M3 8l4.5 4L12 4.5 16.5 12 21 8l-2 11H5L3 8z"/><rect x="5" y="20" width="14" height="2" rx="1"/>', '#f59e0b'],
    rocket: ['<path d="M12 2c3.5 2.2 5.5 6 5 11l-2.5 3h-5L7 13c-.5-5 1.5-8.8 5-11z"/><circle cx="12" cy="9" r="2" fill="#fff"/><path d="M7 13l-3 3 1 3 4-2.5M17 13l3 3-1 3-4-2.5" /><path d="M10 18h4l-2 4z" fill="#f97316"/>', '#64748b'],
    prev: ['<path d="M5 4h2.5v16H5zM20 4v16L8.5 12z"/>'],
    next: ['<path d="M16.5 4H19v16h-2.5zM4 4v16l11.5-8z"/>'],
    pause: ['<rect x="5.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14" y="4" width="4.5" height="16" rx="1.2"/>'],
    clapper: ['<rect x="3" y="9" width="18" height="12" rx="1.8"/><path d="M3 5.5l16.5-3 .7 3.8-16.5 3z"/><path fill="none" stroke="#fff" stroke-width="1.4" d="M7.5 4.7l1.6 3.5M12.5 3.8l1.6 3.5M17.5 2.9l1.6 3.5"/>'],
    trash: [`<path ${S} d="M4 6.5h16M9.5 6.5V4h5v2.5M6 6.5l1 14h10l1-14M10 10.5v6M14 10.5v6"/>`],
    gem: ['<path d="M6 3h12l4 6-10 12L2 9z"/><path fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.2" d="M2 9h20M9 3l3 18 3-18"/>', '#60a5fa'],
    mountain: ['<path d="M2 20l7-12 4 6 3-4 6 10z"/><path d="M9 8l1.8 3H7.2z" fill="#fff"/>', '#64748b'],
    thumbs: ['<path d="M2.5 10h4v11h-4zM8.5 10.5l4-7.5a2 2 0 0 1 3 2.2L14.5 9.5H20a2 2 0 0 1 2 2.4l-1.6 7.4a2.2 2.2 0 0 1-2.2 1.7H8.5z"/>', '#f59e0b'],
    clap: ['<path d="M6 13l4-8a1.5 1.5 0 0 1 2.6 1.4L11 10l4-6a1.5 1.5 0 0 1 2.5 1.6L15 10l3-3.5a1.5 1.5 0 0 1 2.2 2L16 14a7 7 0 0 1-10.5 1.6z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M3 6l1.5 1.5M5.5 3l.5 2M2.5 10h2"/>', '#f59e0b'],
    handshake: [`<path ${S} d="M2 12l4-4h4l2 2 2-2h4l4 4M6 8l-4 4 6 6 2-1.5M18 8l4 4-6 6-2-1.5M10 10l3 3a1.4 1.4 0 0 1-2 2l-2.5-2.5M12.5 15.5l1.5 1.5a1.4 1.4 0 0 0 2-2"/>`, '#f59e0b'],
    door: [`<path ${S} d="M5 21V3h11v18M3 21h18"/><circle cx="13" cy="12" r="1.2" fill="currentColor"/><path ${S} d="M16 6l3 1.5v12L16 21"/>`],
    home: ['<path d="M3 11L12 3l9 8h-2.5v10h-5v-6h-3v6h-5V11z"/>'],
    diamond: ['<path d="M12 2l9 10-9 10-9-10z"/>'],
    chart: ['<rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>', '#3b82f6'],
    refresh: [`<path ${S} d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>`],
    updown: [`<path ${S} d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4"/>`],
    palette: ['<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 9.8C22 6 17.5 3 12 3z"/><circle cx="7.5" cy="11" r="1.4" fill="#ef4444"/><circle cx="10" cy="7" r="1.4" fill="#22c55e"/><circle cx="14.5" cy="7" r="1.4" fill="#3b82f6"/>', '#e2b97a'],
    upload: [`<path ${S} d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>`],
    faceLaugh: ['<circle cx="12" cy="12" r="10"/><path fill="none" stroke="#78350f" stroke-width="1.8" stroke-linecap="round" d="M7 9.5l2 1-2 1M17 9.5l-2 1 2 1"/><path d="M6.5 13.5h11a5.5 5.5 0 0 1-11 0z" fill="#78350f"/><path d="M4 9.5c-1 2-1 4 .5 5M20 9.5c1 2 1 4-.5 5" fill="none" stroke="#38bdf8" stroke-width="1.6"/>', '#facc15'],
    faceWow: ['<circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="9.5" r="1.4" fill="#78350f"/><circle cx="15.5" cy="9.5" r="1.4" fill="#78350f"/><ellipse cx="12" cy="15.5" rx="2.3" ry="3" fill="#78350f"/>', '#facc15'],
    faceCry: ['<circle cx="12" cy="12" r="10"/><path fill="none" stroke="#78350f" stroke-width="1.8" stroke-linecap="round" d="M6.8 10h3.4M13.8 10h3.4M8.5 17.5a4.5 4.5 0 0 1 7 0"/><path d="M7.5 11v9M16.5 11v9" stroke="#38bdf8" stroke-width="2.4" stroke-linecap="round"/>', '#facc15'],
    faceCool: ['<circle cx="12" cy="12" r="10"/><path d="M4 8.5h16v1.5l-1.2 2.6a2.2 2.2 0 0 1-2 1.4h-1.6a2.2 2.2 0 0 1-2-1.4L12.5 11h-1l-.7 1.6a2.2 2.2 0 0 1-2 1.4H7.2a2.2 2.2 0 0 1-2-1.4L4 10z" fill="#1f2937"/><path fill="none" stroke="#78350f" stroke-width="1.8" stroke-linecap="round" d="M8.5 16.5c2 1.5 5 1.5 7 0"/>', '#facc15'],
    faceNo: ['<circle cx="12" cy="12" r="10"/><path fill="none" stroke="#78350f" stroke-width="1.8" stroke-linecap="round" d="M7 9.5h3M14 9.5h3M9.5 16h5"/><path fill="none" stroke="#ef4444" stroke-width="2.4" stroke-linecap="round" d="M5 5l14 14"/>', '#facc15']
  };
  const MAP = {
    '⚔': 'swords', '★': 'star', '☆': 'starOutline', '⭐': 'starGold', '🌟': 'sparkles', '✶': 'sparkles', '✨': 'sparkles', '✦': 'sparkles', '✧': 'sparkles', '❖': 'diamond',
    '🏆': 'trophy', '⏱': 'timer', '⏰': 'alarm', '⏳': 'hourglass', '✓': 'check', '✔': 'check', '✅': 'checkGreen',
    '✗': 'x', '✕': 'x', '✖': 'x', '❌': 'xRed', '⚡': 'bolt', '➔': 'arrow', '🛡': 'shield', '♟': 'pawn', '🧩': 'puzzle',
    '⚠': 'warn', '🎯': 'target', '💡': 'bulb', '🚫': 'ban', '🎲': 'dice', '🎉': 'party', '🔥': 'fire', '📋': 'clipboard',
    '💔': 'heartBroken', '❤': 'heart', '♥': 'heart', '🔒': 'lock', '👤': 'user', '🔢': 'numbers', '📅': 'calendar',
    '🏳': 'flagWhite', '🏁': 'flagCheck', '⚖': 'scale', '🧠': 'brain', '🎮': 'gamepad', '🔧': 'wrench', '🛠': 'wrench',
    '🔍': 'search', '🔎': 'search', '📐': 'ruler', '❓': 'question', '📦': 'box', '⚙': 'gear', '✎': 'pencil', '📝': 'memo',
    '🌐': 'globe', '🌏': 'globe', '🌍': 'globe', '🌎': 'globe', '✋': 'hand', '🙅': 'faceNo', '➕': 'plus', '➖': 'minus',
    '🥇': 'medal1', '🥈': 'medal2', '🥉': 'medal3', '🏅': 'medal', '👑': 'crown', '🚀': 'rocket', '⏮': 'prev', '⏭': 'next', '⏸': 'pause',
    '🎬': 'clapper', '🗑': 'trash', '💎': 'gem', '🏔': 'mountain', '👍': 'thumbs', '👏': 'clap', '🤝': 'handshake', '🚪': 'door', '🏠': 'home',
    '📊': 'chart', '🔄': 'refresh', '↺': 'refresh', '⇅': 'updown', '🎨': 'palette', '📤': 'upload',
    '😂': 'faceLaugh', '😮': 'faceWow', '😭': 'faceCry', '😎': 'faceCool'
  };
  const keys = Object.keys(MAP).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // 이모지 뒤의 변형 선택자(FE0F)·공백 하나는 아이콘에 흡수합니다.
  const RX = new RegExp('(' + keys.join('|') + ')\\uFE0F?', 'gu');
  const has = s => { RX.lastIndex = 0; return RX.test(s); };

  const svgOf = (key, extraCls = '') => {
    const ic = ICONS[key]; if (!ic) return '';
    const color = ic[1] ? ` style="color:${ic[1]}"` : '';
    return `<svg class="sd-emo sd-emo-${key}${extraCls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"${color}>${ic[0]}</svg>`;
  };
  const tpl = document.createElement('template');
  const nodeOf = key => { tpl.innerHTML = svgOf(key); return tpl.content.firstChild; };

  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG', 'svg', 'CANVAS', 'NOSCRIPT', 'CODE', 'PRE']);
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const strip = s => { RX.lastIndex = 0; return s.replace(RX, '').replace(/^\s+/, '').replace(/\s{2,}/g, ' '); };

  function convertText(node) {
    const p = node.parentNode;
    if (!p || p.nodeType !== 1 || SKIP.has(p.nodeName) || p.closest('svg,[contenteditable="true"],.sd-emo-off')) return;
    const s = node.nodeValue;
    if (!s || !has(s)) return;
    if (p.nodeName === 'OPTION' || p.nodeName === 'OPTGROUP' || p.nodeName === 'TITLE') { node.nodeValue = strip(s); return; }
    const frag = document.createDocumentFragment();
    let last = 0; RX.lastIndex = 0; let m;
    while ((m = RX.exec(s))) {
      if (m.index > last) frag.append(s.slice(last, m.index));
      const n = nodeOf(MAP[m[1]]);
      if (n) frag.append(n);
      last = m.index + m[0].length;
    }
    if (last < s.length) frag.append(s.slice(last));
    p.replaceChild(frag, node);
  }
  function convertAttrs(el) {
    for (const a of ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (v && has(v)) el.setAttribute(a, strip(v)); }
  }
  function walk(root) {
    if (root.nodeType === 3) { convertText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP.has(root.nodeName)) return; convertAttrs(root); }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => (n.nodeType === 1 && SKIP.has(n.nodeName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const texts = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) { if (has(n.nodeValue || '')) texts.push(n); } else convertAttrs(n); }
    texts.forEach(convertText);
  }

  let queued = new Set(), scheduled = false;
  const flush = () => { scheduled = false; const list = [...queued]; queued = new Set(); list.forEach(n => { if (n.isConnected) walk(n); }); };
  const queue = n => { queued.add(n); if (!scheduled) { scheduled = true; queueMicrotask(flush); } };
  const mo = new MutationObserver(recs => {
    for (const r of recs) {
      if (r.type === 'characterData') { if (has(r.target.nodeValue || '')) queue(r.target); }
      else if (r.type === 'attributes') { if (has(r.target.getAttribute(r.attributeName) || '')) queue(r.target); }
      else r.addedNodes.forEach(n => { if (n.nodeType === 1 ? has(n.textContent || '') || n.attributes?.length : has(n.nodeValue || '')) queue(n); });
    }
  });
  function start() {
    walk(document.body);
    if (has(document.title)) document.title = strip(document.title);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  /* ---------- 캔버스용 ---------- */
  const imgCache = new Map();
  function image(key, color) {
    const ic = ICONS[key]; if (!ic) return Promise.resolve(null);
    const c = color || ic[1] || '#e2e8f0', id = key + c;
    if (imgCache.has(id)) return imgCache.get(id);
    const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="${c}" color="${c}">${ic[0].replace(/currentColor/g, c)}</svg>`;
    const pr = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); });
    imgCache.set(id, pr); return pr;
  }
  async function draw(ctx, key, x, y, size, color) { const im = await image(key, color); if (im) ctx.drawImage(im, x, y, size, size); return !!im; }

  window.SumdokuEmoji = { svg: svgOf, draw, image, strip, map: MAP, icons: ICONS, convert: walk };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
