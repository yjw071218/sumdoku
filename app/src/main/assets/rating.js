/* v1.1.25 · 난이도별 레이팅(RP)과 티어, Google Play 게임즈 리더보드
 *
 * 랭크는 난이도(초급·중급·고급·전문가·루나틱)마다 따로 책정됩니다. 각 난이도는 1000 RP에서 시작합니다.
 * 레이팅 변화(일반·일일 도전 게임만, 1:1 배틀·타임어택·스피드 레이스는 제외) — 플레이한 난이도의 레이팅만 바뀝니다.
 *   클리어: 기본점 24 × 속도 보정 × 실수 보정 × 힌트 보정 × 높이 보정
 *     - 속도    난이도별 기준 시간(10·12·15·20·25분)보다 빠를수록 최대 ×1.3, 느리면 최소 ×0.5
 *     - 실수    1회마다 −15% (최소 ×0.4), 힌트 1회마다 −20% (최소 ×0.3)
 *     - 높이    레이팅이 높을수록 얻는 점수가 줄어듭니다(2000 RP에서 ×1, 최소 ×0.3).
 *   실패: 목숨 소진·시간 초과 시 기본점의 60%를 잃습니다(레이팅이 높을수록 더 많이). 기권·중도 이탈은 반영하지 않습니다.
 *
 * 비활동 감소: 난이도마다 따로, 마지막 게임 뒤 7일이 지나면 하루마다 1.5%(다이아몬드 이상 2.5%, 최소 5)를 잃습니다.
 *   감소는 1200(골드 IV) 아래로는 내려가지 않습니다.
 *
 * 이전 버전(통합 랭크) 기록: 기록이 있는 난이도로 기존 레이팅을 옮기고(이전 난이도 상한까지), 나머지는 1000에서 시작합니다.
 *
 * 타임어택(v1.1.25): 일반 랭크와 별도로, 난이도마다 따로 책정됩니다(1000 RP 시작).
 *   클리어 여부와 상관없이 '최종 점수'로만 정합니다. 시간 안에 다 풀지 못해도 레이팅이 내려가지 않습니다.
 *     - 보정 점수 = 최종 점수 × 난이도 가중치(초급 0.6 · 중급 0.8 · 고급 1 · 전문가 1.25 · 루나틱 1.6)
 *     - 기대 점수 = 2000 × 2^((레이팅 − 1000) / 400)   (1000 RP → 2,000점, 1400 → 4,000, 1800 → 8,000, 2200 → 16,000)
 *     - 변화 = 32 × log2(보정 점수 / 기대 점수), 0 ~ +48 사이
 *       기대 점수보다 높으면 오르고, 낮으면 그대로입니다. 레이팅이 오를수록 기대 점수가 두 배씩 커져 자연스럽게 한계가 생깁니다.
 *   힌트·목숨 사용 감점이 반영된 최종 점수를 씁니다. 비활동 감소는 일반 랭크와 같습니다.
 *
 * 연속 클리어 보너스(v1.1.25): 같은 모드·같은 난이도에서 연속으로 클리어하면 얻는 RP가 늘어납니다.
 *   2연속 +10% · 3연속 +20% · 4연속 +30% · 5연속 +40% · 6연속 이상 +50%
 *   실패(목숨 소진·시간 초과)하면 연속 기록이 끊깁니다. RP를 얻은 판에만 적용합니다.
 *
 * 난이도 배율(v1.1.25): 난이도가 높을수록 RP 변화 폭(얻는 RP·잃는 RP 모두)이 커집니다.
 *   초급 ×1 · 중급 ×1.25 · 고급 ×1.5 · 전문가 ×2 · 루나틱 ×2.5   (타임어택 점수 기반 RP도 같은 배율)
 *
 * 티어: 브론즈 0~999 · 실버 1000 · 골드 1200 · 플래티넘 1600 · 다이아몬드 2000 · 마스터 2400 · 그랜드마스터 2800
 */
(() => {
  if (typeof SumdokuApp === 'undefined') return;
  const p = SumdokuApp.prototype;
  const KEY = 'sumdoku_rating';
  const DAY = 86400000, GRACE_DAYS = 7, DECAY_FLOOR = 1200;
  const DIFFS = ['easy', 'medium', 'hard', 'expert', 'lunatic'];
  const BASE_POINTS = 24;
  const RP_MULT = { easy: 1, medium: 1.25, hard: 1.5, expert: 2, lunatic: 2.5 };
  // 연속 클리어 보너스 비율: 2연속부터 10%씩, 최대 50%
  const streakBonus = n => n >= 2 ? Math.min(0.5, 0.1 * (n - 1)) : 0;
  const STREAK_TXT = {
    ko: n => `🔥 ${n}연속 클리어`, en: n => `🔥 ${n} clears in a row`, ja: n => `🔥 ${n}連続クリア`, zh: n => `🔥 连续通关${n}次`,
    'zh-TW': n => `🔥 連續通關${n}次`, es: n => `🔥 ${n} seguidas`, fr: n => `🔥 ${n} d'affilée`, de: n => `🔥 ${n} in Folge`
  };
  const streakText = n => (STREAK_TXT[(window.I18N && I18N.currentLang) || 'ko'] || STREAK_TXT.en)(n);
  // 타임어택 점수 보정: 원래 가중치(0.6·0.8·1·1.25·1.6)를 게임 점수 난이도 배율(1·1.25·1.5·2·2.5)로 나눈 값.
  // 게임 점수가 이미 난이도만큼 커지므로 두 번 곱해지지 않게 합니다.
  const TA_WEIGHT = { easy: 0.6 / 1, medium: 0.8 / 1.25, hard: 1 / 1.5, expert: 1.25 / 2, lunatic: 1.6 / 2.5 };
  const taExpected = r => Math.round(2000 * Math.pow(2, (r - 1000) / 400));
  const PAR = { easy: 600, medium: 720, hard: 900, expert: 1200, lunatic: 1500 };
  const OLD_CAP = { easy: 1200, medium: 1700, hard: 2200, expert: 2700, lunatic: 3200 }; // 이전 버전 기록 이전용
  const TIERS = [
    { id: 'bronze', ko: '브론즈', min: 0, color: '#b45309' },
    { id: 'silver', ko: '실버', min: 1000, color: '#64748b' },
    { id: 'gold', ko: '골드', min: 1200, color: '#ca8a04' },
    { id: 'platinum', ko: '플래티넘', min: 1600, color: '#0d9488' },
    { id: 'diamond', ko: '다이아몬드', min: 2000, color: '#2563eb' },
    { id: 'master', ko: '마스터', min: 2400, color: '#9333ea' },
    { id: 'grandmaster', ko: '그랜드마스터', min: 2800, color: '#dc2626' }
  ];
  const ROMAN = ['IV', 'III', 'II', 'I'];

  /* v1.1.27 · 티어 엠블럼(SVG) — 티어마다 외형이 달라지고 장식이 단계적으로 커집니다.
   *   브론즈   원형 동전 + 리벳 테두리 + 스도쿠 격자
   *   실버     육각 철판 + 볼트 + 교차한 연필
   *   골드     네 방향 가시 + 팔각 메달 + 연필·격자
   *   플래티넘 톱니 링 + 양옆 칼날 + 조준선 메달
   *   다이아몬드 8방향 칼날 별 + 월계수 + 보석 + 리본
   *   마스터   햇살 가시 + 월계관 + 중간 날개 + 방패와 왕관
   *   그랜드마스터 거대한 3겹 날개 + 교차한 홀 + 붉은 방패 + 큰 왕관
   *   단계(IV~I)는 아래 가운데 명판에 새깁니다. size: 픽셀, division: 'IV'~'I' */
  const PAL = {
    bronze: ['#ffd9b0', '#b8682f', '#4a1d08'], silver: ['#ffffff', '#a3afbf', '#2b3544'], gold: ['#fff3b8', '#e2a91a', '#5e3700'],
    platinum: ['#d6fff7', '#33b8a6', '#0a423d'], diamond: ['#e4f0ff', '#4f8ff7', '#0e2463'], master: ['#f6e6ff', '#a55cff', '#33086a'], grandmaster: ['#ffe2e2', '#e8293a', '#43040c']
  };
  const METAL = { light: '#fff8e6', mid: '#d9b45a', dark: '#5e4310' }; // 공통 금 장식
  let symSeq = 0;
  function tierSymbol(id, size = 40, division = '') {
    const t = TIERS.find(x => x.id === id) || TIERS[0];
    const k = TIERS.indexOf(t), [lt, c, dk] = PAL[t.id], u = 'te' + (++symSeq), G = n => `url(#${u}${n})`;
    const f1 = n => n.toFixed(1);
    const defs =
      `<linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${lt}"/><stop offset=".6" stop-color="${c}"/><stop offset="1" stop-color="${dk}"/></linearGradient>` +
      `<linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset=".55" stop-color="${c}"/><stop offset="1" stop-color="${dk}"/></linearGradient>` +
      `<linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fb"/><stop offset=".5" stop-color="#9aa6b6"/><stop offset="1" stop-color="#3b4554"/></linearGradient>` +
      `<linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${METAL.light}"/><stop offset=".5" stop-color="${METAL.mid}"/><stop offset="1" stop-color="${METAL.dark}"/></linearGradient>` +
      `<radialGradient id="${u}f" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${c}"/><stop offset=".65" stop-color="${dk}"/><stop offset="1" stop-color="#05070b"/></radialGradient>` +
      `<radialGradient id="${u}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${lt}" stop-opacity=".85"/><stop offset=".55" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="${u}c" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${lt}"/><stop offset="1" stop-color="${c}"/></radialGradient>`;
    const CX = 50, CY = 45;
    const poly = (n, r, rot = -90, cx = CX, cy = CY) => { let d = ''; for (let i = 0; i < n; i++) { const a = (rot + i * 360 / n) * Math.PI / 180; d += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * r) + ' ' + f1(cy + Math.sin(a) * r); } return d + 'Z'; };
    const starP = (n, ro, ri, rot = -90, cx = CX, cy = CY) => { let d = ''; for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? ri : ro; d += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * r) + ' ' + f1(cy + Math.sin(a) * r); } return d + 'Z'; };
    const circle = (r, fill, stroke, sw = 1.4) => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
    const rivets = (n, r, rr = 1.6, rot = -90) => { let s = ''; for (let i = 0; i < n; i++) { const a = (rot + i * 360 / n) * Math.PI / 180; s += `<circle cx="${f1(CX + Math.cos(a) * r)}" cy="${f1(CY + Math.sin(a) * r)}" r="${rr}" fill="${G('b')}" stroke="${dk}" stroke-width=".6"/>`; } return s; };
    // 깃털 하나: 기점 (bx,by)에서 각도 a(도, 화면 기준), 길이 L, 폭 w
    const feather = (bx, by, a, L, w) => {
      const r = a * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r), nx = -dy, ny = dx;
      const tx = bx + dx * L, ty = by + dy * L, mx = bx + dx * L * .55, my = by + dy * L * .55;
      return `M${f1(bx + nx * w * .5)} ${f1(by + ny * w * .5)} Q${f1(mx + nx * w)} ${f1(my + ny * w)} ${f1(tx)} ${f1(ty)} Q${f1(mx - nx * w * .35)} ${f1(my - ny * w * .35)} ${f1(bx - nx * w * .5)} ${f1(by - ny * w * .5)}Z`;
    };
    // 날개: 3겹(긴 칼깃 → 중간깃 → 덮깃). scale 1이면 그랜드마스터 크기
    const wings = (scale, fill) => {
      const bx = CX - 10, by = CY + 4;
      let p1 = '', p2 = '', p3 = '';
      const n1 = 8; for (let i = 0; i < n1; i++) { const a = 200 - i * 12; p1 += feather(bx, by, a, (44 - Math.abs(i - 2.5) * 2.6) * scale, 12 * scale); }
      const n2 = 7; for (let i = 0; i < n2; i++) { const a = 202 - i * 13; p2 += feather(bx + 2, by - 1, a, (30 - Math.abs(i - 2.5) * 1.8) * scale, 11 * scale); }
      const n3 = 6; for (let i = 0; i < n3; i++) { const a = 205 - i * 16; p3 += feather(bx + 4, by - 2, a, 17 * scale, 10 * scale); }
      const one = `<path d="${p1}" fill="${fill}" stroke="${dk}" stroke-width=".9" stroke-linejoin="round"/>` +
        `<path d="${p2}" fill="${G('b')}" stroke="${dk}" stroke-width=".8" stroke-linejoin="round"/>` +
        `<path d="${p3}" fill="${G('c')}" stroke="${dk}" stroke-width=".7" stroke-linejoin="round"/>`;
      return `<g class="te-wing">${one}</g><g class="te-wing" transform="translate(100 0) scale(-1 1)">${one}</g>`;
    };
    const laurel = (r, from, to, n, fill) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const a = (from + (to - from) * i / (n - 1)) * Math.PI / 180, x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
        const deg = (a * 180 / Math.PI) + 90;
        s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="2.2" ry="5" transform="rotate(${f1(deg - 35)} ${f1(x)} ${f1(y)})"/>`;
      }
      const g = `<g fill="${fill}" stroke="${dk}" stroke-width=".6">${s}</g>`;
      return g + `<g transform="translate(100 0) scale(-1 1)">${g}</g>`;
    };
    // 문양들
    const grid = (s = 1, cy = CY) => { let q = ''; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) q += `<rect x="${f1(CX - 9 * s + j * 6 * s)}" y="${f1(cy - 9 * s + i * 6 * s)}" width="${f1(5 * s)}" height="${f1(5 * s)}" rx="${f1(.8 * s)}"/>`;
      return `<g fill="${G('c')}" stroke="${dk}" stroke-width=".6">${q}</g>`; };
    const pencil = (deg, len = 34, w = 5) => `<g transform="rotate(${deg} ${CX} ${CY})"><rect x="${CX - w / 2}" y="${CY - len / 2}" width="${w}" height="${len - 7}" rx="1" fill="${G('a')}" stroke="${METAL.dark}" stroke-width=".7"/>` +
      `<rect x="${CX - w / 2}" y="${CY - len / 2}" width="${w}" height="3" fill="#b9c2cc" stroke="${METAL.dark}" stroke-width=".5"/>` +
      `<path d="M${CX - w / 2} ${CY + len / 2 - 7} L${CX} ${CY + len / 2} L${CX + w / 2} ${CY + len / 2 - 7}Z" fill="#f2d7b0" stroke="${METAL.dark}" stroke-width=".6"/><path d="M${CX - 1} ${CY + len / 2 - 2} L${CX} ${CY + len / 2} L${CX + 1} ${CY + len / 2 - 2}Z" fill="#333"/></g>`;
    const pencils = (len, w) => pencil(-38, len, w) + pencil(38, len, w);
    const gem = (cy, s) => `<g transform="translate(${CX} ${cy}) scale(${s})"><path d="M-9 -2 L-5 -7 H5 L9 -2 L0 9 Z" fill="${G('c')}" stroke="${dk}" stroke-width="1.1" stroke-linejoin="round"/><path d="M-9 -2 H9 M-5 -7 L-2 -2 L0 9 L2 -2 L5 -7" fill="none" stroke="#fff" stroke-width=".7" opacity=".85"/></g>`;
    const crown = (cy, s, fill) => `<g transform="translate(${CX} ${cy}) scale(${s})"><path d="M-12 7 L-13 -5 L-6 1 L0 -9 L6 1 L13 -5 L12 7 Z" fill="${fill}" stroke="${METAL.dark}" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<rect x="-12.5" y="6" width="25" height="4" rx="1" fill="${G('a')}" stroke="${METAL.dark}" stroke-width=".7"/>` +
      `<circle cx="0" cy="-9" r="1.8" fill="#fff"/><circle cx="-13" cy="-5" r="1.4" fill="#fff"/><circle cx="13" cy="-5" r="1.4" fill="#fff"/><circle cx="0" cy="2" r="2" fill="${c}" stroke="#fff" stroke-width=".6"/></g>`;
    const crosshair = r => `<g fill="none" stroke="${lt}" stroke-width="1.2"><circle cx="${CX}" cy="${CY}" r="${r}"/><circle cx="${CX}" cy="${CY}" r="${r * .55}"/><path d="M${CX - r - 3} ${CY} H${CX - r * .3} M${CX + r * .3} ${CY} H${CX + r + 3} M${CX} ${CY - r - 3} V${CY - r * .3} M${CX} ${CY + r * .3} V${CY + r + 3}"/></g>`;
    const heater = (w, h, top, fill) => `<path d="M${CX - w} ${top} H${CX + w} V${top + h * .45} C${CX + w} ${top + h * .8} ${CX + w * .4} ${top + h * .95} ${CX} ${top + h} C${CX - w * .4} ${top + h * .95} ${CX - w} ${top + h * .8} ${CX - w} ${top + h * .45} Z" fill="${fill}" stroke="${METAL.dark}" stroke-width="1.6"/>` +
      `<path d="M${CX - w + 3} ${top + 3} H${CX + w - 3} V${top + h * .45} C${CX + w - 3} ${top + h * .76} ${CX + w * .35} ${top + h * .9} ${CX} ${top + h - 3.5} C${CX - w * .35} ${top + h * .9} ${CX - w + 3} ${top + h * .76} ${CX - w + 3} ${top + h * .45} Z" fill="none" stroke="${METAL.light}" stroke-width=".8" opacity=".8"/>`;
    const glow = r => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="${G('g')}"/>`;
    const rays = (n, R, cls = 'te-rays') => { let d = ''; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; d += `M${CX} ${CY} L${f1(CX + Math.cos(a - .05) * R)} ${f1(CY + Math.sin(a - .05) * R)} L${f1(CX + Math.cos(a + .05) * R)} ${f1(CY + Math.sin(a + .05) * R)}Z`; } return `<path class="${cls}" d="${d}" fill="${lt}" opacity=".35"/>`; };
    const shine = (r) => `<path d="M${CX - r * .7} ${CY - r * .35} A${r} ${r} 0 0 1 ${CX + r * .7} ${CY - r * .35} A${r * 1.4} ${r * 1.4} 0 0 0 ${CX - r * .7} ${CY - r * .35}Z" fill="#fff" opacity=".3"/>`;

    let art = '';
    switch (t.id) {
      case 'bronze':
        art = circle(29, G('b'), dk, 2) + circle(25, G('r'), dk, 1) + rivets(16, 27.2, 1.3) + circle(20.5, G('f'), dk, 1.2) + grid(1.15, CY - 2) + shine(20);
        break;
      case 'silver':
        art = `<path d="${poly(6, 32, -90)}" fill="${G('b')}" stroke="${dk}" stroke-width="2"/><path d="${poly(6, 27.5, -90)}" fill="${G('r')}" stroke="${lt}" stroke-width="1"/>` +
          rivets(6, 29.7, 1.8) + `<path d="${poly(6, 22, -90)}" fill="${G('f')}" stroke="${dk}" stroke-width="1.2"/>` + pencils(34, 5) + shine(22);
        break;
      case 'gold':
        art = glow(44) + `<path d="${starP(4, 46, 16, -90)}" fill="${G('b')}" stroke="${dk}" stroke-width="1.4"/>` +
          `<path d="${starP(4, 38, 16, -45)}" fill="${G('r')}" stroke="${dk}" stroke-width="1"/>` +
          `<path d="${poly(8, 29, -67.5)}" fill="${G('b')}" stroke="${dk}" stroke-width="2"/><path d="${poly(8, 23, -67.5)}" fill="${G('f')}" stroke="${lt}" stroke-width="1"/>` +
          rivets(8, 26, 1.4, -67.5) + grid(.75, CY - 4) + pencils(36, 4.5) + shine(23);
        break;
      case 'platinum':
        art = glow(46) + rays(12, 46) +
          `<path d="M${CX - 44} ${CY} L${CX - 26} ${CY - 6} L${CX - 26} ${CY + 6}Z M${CX + 44} ${CY} L${CX + 26} ${CY - 6} L${CX + 26} ${CY + 6}Z M${CX} ${CY - 46} L${CX - 6} ${CY - 28} L${CX + 6} ${CY - 28}Z" fill="${G('s')}" stroke="#2b3544" stroke-width="1"/>` +
          `<path d="${starP(16, 34, 29)}" fill="${G('b')}" stroke="${dk}" stroke-width="1.6"/>` + circle(27, G('r'), dk, 1) + rivets(16, 30.8, 1.1) +
          circle(22.5, G('f'), lt, 1.2) + crosshair(15) + pencils(38, 4.5) + shine(22);
        break;
      case 'diamond':
        art = glow(48) + rays(16, 48) +
          `<path d="${starP(8, 46, 12, -90)}" fill="${G('s')}" stroke="#2b3544" stroke-width="1"/>` +
          `<path d="${starP(8, 36, 12, -67.5)}" fill="${G('b')}" stroke="${dk}" stroke-width="1"/>` +
          laurel(33, 100, 200, 8, G('a')) +
          circle(25, G('a'), METAL.dark, 1.8) + circle(21, G('f'), lt, 1.2) + rivets(12, 23, 1) + gem(CY - 2, 1.5) + shine(21);
        break;
      case 'master':
        art = glow(50) + rays(20, 50) +
          `<path d="${starP(16, 47, 30)}" fill="${G('a')}" stroke="${METAL.dark}" stroke-width="1" opacity=".95"/>` +
          wings(.85, G('r')) + laurel(28, 110, 200, 7, '#6bbf59') +
          heater(17, 36, CY - 16, G('b')) + `<path d="M${CX - 13} ${CY - 12} H${CX + 13} V${CY + 2} C${CX + 13} ${CY + 10} ${CX + 6} ${CY + 15} ${CX} ${CY + 17} C${CX - 6} ${CY + 15} ${CX - 13} ${CY + 10} ${CX - 13} ${CY + 2}Z" fill="${G('f')}"/>` +
          grid(.7, CY + 1) + crown(CY - 22, 1, G('a'));
        break;
      case 'grandmaster':
        art = glow(46) + rays(20, 50) +
          `<g transform="rotate(-35 ${CX} ${CY})"><rect x="${CX - 1.8}" y="${CY - 40}" width="3.6" height="78" rx="1.5" fill="${G('a')}" stroke="${METAL.dark}" stroke-width=".7"/><circle cx="${CX}" cy="${CY - 41}" r="3.5" fill="${G('c')}" stroke="${METAL.dark}" stroke-width=".7"/></g>` +
          `<g transform="rotate(35 ${CX} ${CY})"><rect x="${CX - 1.8}" y="${CY - 40}" width="3.6" height="78" rx="1.5" fill="${G('a')}" stroke="${METAL.dark}" stroke-width=".7"/><circle cx="${CX}" cy="${CY - 41}" r="3.5" fill="${G('c')}" stroke="${METAL.dark}" stroke-width=".7"/></g>` +
          wings(1.05, `url(#${u}s)`) +
          heater(18, 40, CY - 15, G('a')) + `<path d="M${CX - 14} ${CY - 11} H${CX + 14} V${CY + 4} C${CX + 14} ${CY + 13} ${CX + 6} ${CY + 18} ${CX} ${CY + 21} C${CX - 6} ${CY + 18} ${CX - 14} ${CY + 13} ${CX - 14} ${CY + 4}Z" fill="${G('r')}" stroke="${dk}" stroke-width=".8"/>` +
          grid(.72, CY + 3) + crown(CY - 23, 1.35, G('r'));
        break;
    }
    // 단계 명판: 아래 가운데
    const plate = division ? (() => {
      const w = 13, y = 80, h = 13;
      const fs = division.length >= 3 ? 9.5 : division.length === 2 ? 10.5 : 11.5;
      return `<path d="M${CX - w - 4} ${y} H${CX + w + 4} L${CX + w} ${y + h / 2} L${CX + w + 4} ${y + h} H${CX - w - 4} L${CX - w} ${y + h / 2} Z" fill="${G('f')}" stroke="${G('a')}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<text x="${CX}" y="${y + h / 2 + fs * .36}" text-anchor="middle" font-size="${fs}" font-weight="900" font-family="Georgia,'Times New Roman',serif" fill="${G('c')}" stroke="${dk}" stroke-width=".5" paint-order="stroke">${division}</text>`;
    })() : '';
    const spark = k >= 2 ? `<path class="te-spark" d="M72 18 L73.6 22.4 L78 24 L73.6 25.6 L72 30 L70.4 25.6 L66 24 L70.4 22.4Z" fill="#fff"/>` : '';
    return `<svg class="tier-symbol tier-symbol-${t.id} te-k${k}" style="--tier:${c}" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-hidden="true"><defs>${defs}</defs><g class="te-body">${art}</g>${plate}${spark}</svg>`;
  }

  /* v1.1.26 · 승급 연출: 큰 티어 승급은 상승음 + 금관 팡파르 + 종소리와 전체 화면 연출,
   *   단계 승급(IV→III 등)은 짧은 아르페지오와 작은 연출. 화면을 누르면 닫힙니다. 효과음 설정을 따릅니다. */
  function promoSound(big, k) {
    try {
      const sfx = window.app && window.app.sound; if (!sfx || !sfx.enabled) return;
      sfx.init(); const ctx = sfx.ctx; if (!ctx) return;
      const out = ctx.createGain(); out.gain.value = .9; out.connect(sfx.out || ctx.destination);
      const t0 = ctx.currentTime + .05, mtof = m => 440 * Math.pow(2, (m - 69) / 12);
      const tone = (m, at, dur, type, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = mtof(m);
        g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(v, at + .015); g.gain.exponentialRampToValueAtTime(.0008, at + dur);
        o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + .05); };
      const base = 60 + Math.min(k, 6);
      if (!big) { [0, 4, 7, 12].forEach((s, i) => tone(base + 12 + s, t0 + i * .07, .5, 'triangle', .12)); return; }
      const sw = ctx.createOscillator(), sg = ctx.createGain(), lp = ctx.createBiquadFilter(); sw.type = 'sawtooth';
      sw.frequency.setValueAtTime(180, t0); sw.frequency.exponentialRampToValueAtTime(1400, t0 + .55);
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      sg.gain.setValueAtTime(0, t0); sg.gain.linearRampToValueAtTime(.06, t0 + .3); sg.gain.linearRampToValueAtTime(0, t0 + .6);
      sw.connect(lp); lp.connect(sg); sg.connect(out); sw.start(t0); sw.stop(t0 + .65);
      const f = t0 + .6;
      [0, 7, 12].forEach((s, i) => { tone(base + s, f + i * .12, .25, 'sawtooth', .06); tone(base + s, f + i * .12, .25, 'square', .03); });
      [0, 4, 7, 12, 16].forEach(s => { tone(base + s, f + .42, 1.6, 'sawtooth', .045); tone(base + s + 12, f + .42, 1.4, 'triangle', .05); });
      tone(base - 12, f + .42, 1.6, 'sine', .25);
      [24, 28, 31, 36, 40].forEach((s, i) => tone(base + s, f + .5 + i * .06, 1.2, 'sine', .07));
    } catch (_) {}
  }
  function playPromotion(tier, big) {
    const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
    document.getElementById('tier-promo')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'tier-promo'; wrap.className = 'tier-promo' + (big ? ' big' : ' small') + (reduced ? ' reduced' : '');
    wrap.style.setProperty('--tier', tier.color);
    wrap.setAttribute('role', 'status');
    let parts = '';
    if (big && !reduced) for (let i = 0; i < 26; i++) {
      parts += `<i style="--a:${Math.round(Math.random() * 360)}deg;--d:${Math.round(90 + Math.random() * 120)}px;--dl:${(.55 + Math.random() * .3).toFixed(2)}s"></i>`;
    }
    wrap.innerHTML = `<div class="tp-burst"></div><div class="tp-parts">${parts}</div><div class="tp-emblem">${tierSymbol(tier.id, big ? 200 : 140, tier.division)}</div>`;
    wrap.setAttribute('aria-label', tier.name);
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 350); };
    wrap.addEventListener('click', close);
    document.body.append(wrap);
    setTimeout(close, big ? 3600 : 2000);
    promoSound(big, tier.index);
  }

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const tr = s => (window.I18N && typeof I18N.text === 'function' ? I18N.text(s) : s);
  const bridge = () => window.AndroidBridge;

  const fresh = () => ({ rating: 1000, peak: 1000, games: 0, lastActive: 0, lastDecay: 0, history: [] });
  const fix = l => {
    if (!l || typeof l !== 'object' || !Number.isFinite(l.rating)) return fresh();
    if (!Array.isArray(l.history)) l.history = [];
    if (!Number.isFinite(l.peak)) l.peak = l.rating;
    return l;
  };
  // 저장 형식: { v: 2, lastDiff, byDiff: { easy: {...}, medium: {...}, ... } } (키는 그대로라 클라우드 저장도 함께 옮겨집니다)
  const loadAll = () => {
    let raw = null; try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (_) {}
    let all;
    if (raw && raw.v === 2 && raw.byDiff) all = raw;
    else {
      all = { v: 2, lastDiff: null, byDiff: {} };
      if (raw && Number.isFinite(raw.rating)) {
        const hist = Array.isArray(raw.history) ? raw.history : [];
        DIFFS.filter(d => hist.some(h => h.diff === d)).forEach(d => {
          const r = Math.min(raw.rating, OLD_CAP[d]);
          all.byDiff[d] = { rating: r, peak: Math.min(Math.max(raw.peak || r, r), OLD_CAP[d]), games: hist.filter(h => h.diff === d).length,
            lastActive: raw.lastActive || 0, lastDecay: raw.lastDecay || 0, history: hist.filter(h => h.diff === d) };
        });
        all.lastDiff = (hist.find(h => DIFFS.includes(h.diff)) || {}).diff || null;
        all.migratedFrom = raw.rating;
      }
    }
    DIFFS.forEach(d => { all.byDiff[d] = fix(all.byDiff[d]); });
    if (!all.ta || typeof all.ta !== 'object') all.ta = { lastDiff: null, byDiff: {} };
    if (!all.ta.byDiff) all.ta.byDiff = {};
    DIFFS.forEach(d => { all.ta.byDiff[d] = fix(all.ta.byDiff[d]); });
    return all;
  };
  const MODES = ['standard', 'timeattack'];
  // 모드별 사다리: 일반은 최상위 byDiff/lastDiff, 타임어택은 all.ta
  const ladder = (all, mode) => mode === 'timeattack' ? all.ta : all;
  const saveAll = all => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (_) {} };
  const load = d => loadAll().byDiff[DIFFS.includes(d) ? d : 'easy'];

  function tierOf(rating) {
    let k = 0; for (let i = 0; i < TIERS.length; i++) if (rating >= TIERS[i].min) k = i;
    const t = TIERS[k], next = TIERS[k + 1];
    let division = '', divMin = t.min, divMax = next ? next.min : null;
    if (k <= 4) {
      const span = (next.min - t.min) / ROMAN.length, d = clamp(Math.floor((rating - t.min) / span), 0, ROMAN.length - 1);
      division = ROMAN[d]; divMin = t.min + span * d; divMax = divMin + span;
    }
    return { ...t, index: k, division, name: tr(t.ko) + (division ? ' ' + division : ''), divMin, divMax, next };
  }

  /* 비활동 감소: 경과한 날마다 적용하고, 이미 적용한 날은 다시 깎지 않습니다. */
  function applyDecay(s, now = Date.now()) {
    if (!s.lastActive || s.rating <= DECAY_FLOOR) return 0;
    const start = Math.max(s.lastActive + GRACE_DAYS * DAY, s.lastDecay || 0);
    const days = Math.floor((now - start) / DAY);
    if (days <= 0) return 0;
    let lost = 0;
    for (let d = 0; d < days && s.rating > DECAY_FLOOR; d++) {
      const rate = s.rating >= 2000 ? 0.025 : 0.015;
      const x = Math.min(Math.max(5, Math.round(s.rating * rate)), s.rating - DECAY_FLOOR);
      s.rating -= x; lost += x;
    }
    s.lastDecay = start + days * DAY;
    if (lost) s.history.unshift({ t: now, d: -lost, why: 'decay' });
    s.history = s.history.slice(0, 30);
    return lost;
  }

  function computeDelta(s, g) {
    if (!DIFFS.includes(g.difficulty)) return 0;
    if (g.mode === 'timeattack') {
      const adj = Math.max(0, g.score || 0) * (TA_WEIGHT[g.difficulty] || 1);
      if (adj <= 0) return 0;
      const expected = 2000 * Math.pow(2, (s.rating - 1000) / 400);
      return Math.round(clamp(32 * Math.log2(adj / expected), 0, 48) * (RP_MULT[g.difficulty] || 1));
    }
    const base = BASE_POINTS * (RP_MULT[g.difficulty] || 1);
    if (!g.win) {
      const over = clamp(1 + (s.rating - 1600) / 1000, 0.6, 1.8);
      return -Math.round(base * 0.6 * over);
    }
    const ta = g.mode === 'timeattack';
    const speed = ta ? clamp(0.6 + 0.8 * clamp(g.remainFrac || 0, 0, 1), 0.6, 1.4) : clamp(1.5 - g.seconds / PAR[g.difficulty], 0.5, 1.3);
    // 타임어택은 목숨 제한이 없으므로 실수 보정을 조금 약하게 둡니다.
    const mist = Math.max(0.4, 1 - (ta ? 0.08 : 0.15) * (g.mistakes || 0));
    const hint = Math.max(0.3, 1 - 0.2 * (g.hints || 0));
    const height = clamp(1 + (2000 - s.rating) / 1500, 0.3, 1.4);
    return Math.max(1, Math.round(base * speed * mist * hint * height));
  }

  const MODE_NAMES = {
    standard: ['일반', 'Standard', '通常', '普通', '一般', 'Normal', 'Normal', 'Normal'],
    timeattack: ['타임어택', 'Time Attack', 'タイムアタック', '限时挑战', '限時挑戰', 'Contrarreloj', 'Contre-la-montre', 'Zeitangriff']
  };
  const modeName = m => {
    const langs = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
    return MODE_NAMES[m][Math.max(0, langs.indexOf((window.I18N && I18N.currentLang) || 'ko'))];
  };
  const diffName = d => {
    const N = window.SumdokuDiffNames, langs = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
    const i = Math.max(0, langs.indexOf((window.I18N && I18N.currentLang) || 'ko'));
    return (N && N[d] && N[d][i]) || d;
  };

  /* ---------- 리더보드 ---------- */
  const lbReady = key => !!bridge()?.isLeaderboardConfigured?.(key);
  const submit = (key, score) => { try { if (lbReady(key)) bridge().submitLeaderboardScore(key, String(Math.round(score))); } catch (_) {} };
  window.onLeaderboardResult = status => {
    const msg = { unconfigured: '리더보드가 아직 설정되지 않았습니다.', signin_failed: 'Google Play 게임즈에 로그인하지 못했습니다.', error: '리더보드를 열지 못했습니다.' }[status];
    if (msg) window.app?.showToast(tr(msg), 3500);
  };

  /* ---------- 게임 종료 연결 ---------- */
  const RATED_MODES = ['standard', 'daily', undefined, null, ''];
  const record = p.recordGameEnd;
  p.recordGameEnd = function (isWin, ...rest) {
    const out = record.call(this, isWin, ...rest);
    try {
      const mode = this.gameMode === 'timeattack' && !this.isDaily ? 'timeattack' : 'standard';
      if (this.isBattle || this.gameMode === 'battle' || (mode === 'standard' && !RATED_MODES.includes(this.gameMode) && !this.isDaily)) return out;
      if (this.resultReason === 'forfeit' || !this._ratingToken || this._ratedGameId === this._ratingToken) return out;
      const win = !!(isWin && this.score >= 0 && this.board?.every((row, r) => row.every((c, k) => c.val === this.solution?.[r]?.[k])));
      if (!DIFFS.includes(this.difficulty)) return out;
      const all = loadAll(), lad = ladder(all, mode), s = lad.byDiff[this.difficulty]; applyDecay(s);
      const total = this.timeLimitTotal || 0;
      const g = { mode, score: this.score || 0, difficulty: this.difficulty, win, mistakes: this.mistakes || 0, hints: this.hintsUsed || 0,
        seconds: mode === 'timeattack' ? Math.max(0, total - (this.timeRemaining || 0)) : (this.timerSeconds || 0),
        remainFrac: mode === 'timeattack' && total ? (this.timeRemaining || 0) / total : 0 };
      const before = s.rating, beforeTier = tierOf(before);
      // 연속 클리어: 이기면 이어지고, 지면 끊깁니다.
      s.streak = win ? (s.streak || 0) + 1 : 0;
      s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
      let delta = computeDelta(s, g);
      const bonusRate = delta > 0 ? streakBonus(s.streak) : 0;
      const bonus = bonusRate ? Math.max(1, Math.round(delta * bonusRate)) : 0;
      delta += bonus;
      if (!delta) {
        saveAll(all);
        if (mode === 'timeattack' && (this.score || 0) > 0) {
          const need = Math.ceil(taExpected(s.rating) / (TA_WEIGHT[g.difficulty] || 1));
          setTimeout(() => this.showToast?.(`${modeName(mode)} · ${diffName(g.difficulty)} · ${tr('레이팅 유지')} (${s.rating}) · ${tr('상승 기준')} ${need.toLocaleString()}`, 3500), 900);
          this._ratedGameId = this._ratingToken;
        }
        return out;
      }
      s.rating = Math.max(0, s.rating + delta); s.peak = Math.max(s.peak, s.rating);
      s.games++; s.lastActive = Date.now(); s.lastDecay = 0;
      s.history.unshift({ t: Date.now(), d: delta, bonus, streak: s.streak, diff: g.difficulty, mode, win }); s.history = s.history.slice(0, 30);
      lad.lastDiff = g.difficulty; all.lastMode = mode;
      saveAll(all); this._ratedGameId = this._ratingToken; this._rankDiff = g.difficulty; this._rankMode = mode;
      this.lastRatingChange = { mode, streak: s.streak, bonus, difficulty: g.difficulty, before, after: s.rating, delta, tier: tierOf(s.rating), beforeTier };
      // 리더보드: 레이팅, 난이도별 최단 시간(밀리초), 일일 도전 시간
      if (mode === 'timeattack') {
        submit('ta_rating_' + g.difficulty, s.rating);
        submit('ta_rating', Math.max(...DIFFS.map(d => all.ta.byDiff[d].rating)));
      } else {
        submit('rating_' + g.difficulty, s.rating);
        submit('rating', Math.max(...DIFFS.map(d => all.byDiff[d].rating)));
        if (win) { submit(this.difficulty, g.seconds * 1000); if (this.isDaily) submit('daily', g.seconds * 1000); }
      }
      const after = tierOf(s.rating);
      const sign = delta > 0 ? '+' : '';
      let msg = `${mode === 'timeattack' ? modeName(mode) + ' · ' : ''}${diffName(g.difficulty)} · ${sign}${delta} RP · ${after.name} (${s.rating})`;
      if (bonus) msg += ` · ${streakText(s.streak)} +${bonus} (+${Math.round(bonusRate * 100)}%)`;
      if (after.index > beforeTier.index) msg = `🎉 ${after.name} ${tr('승급!')} ${msg}`;
      else if (after.index < beforeTier.index) msg = `${after.name} ${tr('강등')} · ${msg}`;
      setTimeout(() => this.showToast?.(msg, 3500), 900);
      // 승급 연출: 결과 화면이 뜬 뒤 보여 줍니다.
      if (after.index > beforeTier.index) setTimeout(() => playPromotion(after, true), 1200);
      else if (after.index === beforeTier.index && after.divMin > beforeTier.divMin) setTimeout(() => playPromotion(after, false), 1200);
      this.renderRatingCard?.();
    } catch (e) { console.warn('rating', e); }
    return out;
  };

  // 게임마다 한 번만 반영하도록 새 게임·이어하기 때 고유 번호를 붙입니다.
  for (const name of ["startNewGame", "restoreOngoingGame"]) {
    const fn = p[name]; if (typeof fn !== "function") continue;
    p[name] = function (...a) { this._ratingToken = Date.now() + Math.random(); return fn.apply(this, a); };
  }

  /* ---------- 통계 화면 카드 ---------- */
  p.renderRatingCard = function () {
    // 랭킹 탭이 있으면 그 화면에 그립니다(v1.1.25). 없으면 예전처럼 통계 패널에 둡니다.
    const rankHost = document.getElementById('ranking-detail');
    const host = rankHost || document.getElementById('panel-stats'); if (!host) return;
    let card = document.getElementById('rating-card');
    if (card && rankHost && card.parentElement !== rankHost) { rankHost.append(card); }
    if (!card) {
      card = document.createElement('section'); card.id = 'rating-card'; card.className = 'rating-card';
      const anchor = host.querySelector('[data-i18n="stats_diff_records_title"]');
      if (rankHost) rankHost.append(card); else host.insertBefore(card, anchor || host.firstChild);
    }
    const all = loadAll();
    const mode = MODES.includes(this._rankMode) ? this._rankMode : (all.lastMode || 'standard');
    const lad = ladder(all, mode);
    const cur = DIFFS.includes(this._rankDiff) ? this._rankDiff : (lad.lastDiff || 'easy');
    let lost = 0;
    MODES.forEach(m => DIFFS.forEach(d => { const x = applyDecay(ladder(all, m).byDiff[d]); if (m === mode && d === cur) lost = x; }));
    saveAll(all);
    const s = lad.byDiff[cur];
    const t = tierOf(s.rating);
    const pct = t.divMax ? clamp((s.rating - t.divMin) / (t.divMax - t.divMin) * 100, 0, 100) : 100;
    const idle = s.lastActive ? Math.floor((Date.now() - s.lastActive) / DAY) : 0;
    const decayIn = GRACE_DAYS - idle;
    card.style.setProperty('--tier', t.color);
    card.innerHTML = '';
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const head = el('div', 'rc-top');
    const badge = el('div', 'rc-badge rc-symbol tier-' + t.id); badge.innerHTML = tierSymbol(t.id, 56, t.division);
    const info = el('div', 'rc-info');
    info.append(el('div', 'rc-tier', t.name), el('div', 'rc-rp', `${s.rating} RP · ${tr('최고')} ${s.peak}`));
    head.append(badge, info); card.append(el('h3', 'section-title', tr('난이도별 랭크')));
    // 난이도 탭: 이름과 그 난이도의 티어(티어 색 밑줄)를 함께 보여 줍니다.
    // 모드 전환(일반 / 타임어택)
    const modes = el('div', 'rc-modes'); modes.setAttribute('role', 'tablist');
    MODES.forEach(m => {
      const b = el('button', 'rc-mode' + (m === mode ? ' on' : ''), modeName(m));
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', m === mode ? 'true' : 'false');
      b.onclick = () => { this._rankMode = m; this._rankDiff = ladder(loadAll(), m).lastDiff || this._rankDiff; this.renderRatingCard(); };
      modes.append(b);
    });
    card.append(modes);
    const tabs = el('div', 'rc-tabs'); tabs.setAttribute('role', 'tablist');
    DIFFS.forEach(d => {
      const ds = lad.byDiff[d], dt = tierOf(ds.rating), b = el('button', 'rc-tab' + (d === cur ? ' on' : ''));
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', d === cur ? 'true' : 'false');
      b.style.setProperty('--tab-tier', ds.games ? dt.color : '#94a3b8');
      b.append(el('span', 'rc-tab-name', diffName(d)), el('span', 'rc-tab-tier', ds.games ? dt.name : '—'));
      b.onclick = () => { this._rankDiff = d; this.renderRatingCard(); };
      tabs.append(b);
    });
    card.append(tabs, head);
    const bar = el('div', 'rc-bar'); const fill = el('div', 'rc-fill'); fill.style.width = pct.toFixed(1) + '%'; bar.append(fill); card.append(bar);
    if ((s.streak || 0) >= 1) card.append(el('div', 'rc-streak', `${streakText(s.streak)} · ${tr('다음 클리어 보너스')} +${Math.round(streakBonus(s.streak + 1) * 100)}%`));
    card.append(el('div', 'rc-next', t.divMax ? `${tr('다음 단계까지')} ${Math.ceil(t.divMax - s.rating)} RP` : tr('최고 티어입니다')));
    if (mode === 'timeattack') card.append(el('div', 'rc-note', `${tr('상승 기준 점수')} ${Math.ceil(taExpected(s.rating) / (TA_WEIGHT[cur] || 1)).toLocaleString()}`));
    if (!s.games) card.append(el('div', 'rc-note', tr(mode === 'timeattack' ? '이 난이도의 타임어택에서 기준보다 높은 점수를 내면 레이팅이 오릅니다.' : '이 난이도의 일반 게임이나 일일 도전을 클리어하면 레이팅이 쌓입니다.')));
    else if (s.rating > DECAY_FLOOR) card.append(el('div', 'rc-note' + (decayIn <= 2 ? ' warn' : ''),
      decayIn > 0 ? `${tr('비활동 감소까지')} ${decayIn}${({ ko: '일', ja: '日', zh: '天', 'zh-TW': '天' })[window.I18N?.currentLang || 'ko'] ?? ' d'}` : tr('비활동으로 레이팅이 매일 감소하고 있습니다')));
    if (lost) card.append(el('div', 'rc-note warn', `${tr('비활동 감소')} −${lost} RP`));
    const recent = s.history.slice(0, 5);
    if (recent.length) {
      const ul = el('div', 'rc-history');
      recent.forEach(h => ul.append(el('span', 'rc-chip ' + (h.d >= 0 ? 'up' : 'down'), `${h.d >= 0 ? '+' : ''}${h.d}`)));
      card.append(ul);
    }
    if (bridge()?.getDistribution?.() === 'play') {
      const row = el('div', 'rc-actions');
      [['랭킹 보기', (() => { const pre = mode === 'timeattack' ? 'ta_rating' : 'rating'; return lbReady(pre + '_' + cur) ? pre + '_' + cur : pre; })()], ['전체 리더보드', '']].forEach(([label, key]) => {
        const b = el('button', 'btn btn-secondary', tr(label)); b.type = 'button';
        b.onclick = () => { try { bridge().showLeaderboard(key); } catch (_) { window.onLeaderboardResult('error'); } };
        row.append(b);
      });
      card.append(row);
    }
  };
  const renderStats = p.renderStatsView;
  if (renderStats) p.renderStatsView = function (...a) { const r = renderStats.apply(this, a); this.renderRatingCard(); return r; };

  // 언어가 바뀌면 다시 그립니다.
  new MutationObserver(() => window.app?.renderRatingCard?.()).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.SumdokuRating = { tierSymbol, playPromotion, load, loadAll, saveAll, ladder, tierOf, applyDecay, computeDelta, RP_MULT, streakBonus, taExpected, TA_WEIGHT, TIERS, KEY, DIFFS, MODES };
})();
