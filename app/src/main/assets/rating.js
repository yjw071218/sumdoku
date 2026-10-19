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
 * 티어: 브론즈 0~1499 · 실버 1500 · 골드 2000 · 플래티넘 2500 · 다이아몬드 3000 · 마스터 3500 · 그랜드마스터 4000 (브론즈~다이아몬드 V~I, 단계당 100 RP)
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
    { id: 'silver', ko: '실버', min: 1500, color: '#64748b' },
    { id: 'gold', ko: '골드', min: 2000, color: '#ca8a04' },
    { id: 'platinum', ko: '플래티넘', min: 2500, color: '#0d9488' },
    { id: 'diamond', ko: '다이아몬드', min: 3000, color: '#2563eb' },
    { id: 'master', ko: '마스터', min: 3500, color: '#9333ea' },
    { id: 'grandmaster', ko: '그랜드마스터', min: 4000, color: '#dc2626' }
  ];
  const ROMAN = ['V', 'IV', 'III', 'II', 'I']; // 5단계(V→IV→III→II→I), 단계마다 100 RP (1000 RP = 브론즈 V 시작)

  /* v1.1.29 · PUBG 경쟁전 스타일 택티컬 엠블럼(SVG) — 다층 입체 금속 베젤 + 장갑 크레스트 + 단계(V~I)별 외형 진화
   *   언랭크       건메탈 육각 독태그 장갑판 + 전술 스텐실 '?' + 볼트
   *   브론즈       황동 리벳 팔각 중장갑 방패 + 양각 베벨 코어 + 전술 격자
   *   실버         브러시드 스틸 날개형 셰브론 실드 + 측면 장갑 블레이드 + 교차 전술 펜슬
   *   골드         로열 골드 4방향 검날 크레스트 + 금빛 월계관 + 입체 방패 + 상단 스타 크라운
   *   플래티넘     티타늄-시안 2겹 날개 + 8각 기계식 베젤 + 택티컬 조준 코어 + 플라즈마 젬
   *   다이아몬드   크리스탈 3겹 발키리 날개 + 8방향 칼날 스타 + 다면 컷 다이아몬드 코어 + 황금 월계관
   *   마스터       아케인 퍼플-골드 3겹 대날개 + 교차 의장검 + 후광 링 + 황제 크라운 + 루비 코어
   *   그랜드마스터 태양빛 진홍·순금 4겹 신화 날개 + 회전 룬 후광 + 불꽃 아우라 + 쌍홀(Scepter) + 5성 제왕관
   *   같은 티어 안에서도 단계(V→I)가 오를수록 상단 별·측면 장갑·하단 셰브론 핀이 추가되어 더 위압적으로 진화합니다. */
  const PAL = {
    bronze: ['#ffe0ba', '#c87132', '#522008', '#ff9b4e'],
    silver: ['#ffffff', '#94a7bc', '#233040', '#dbeafe'],
    gold: ['#fff8c4', '#eab308', '#5c3800', '#fde047'],
    platinum: ['#dffef9', '#14b8a6', '#063935', '#5eead4'],
    diamond: ['#e8f3ff', '#3b82f6', '#0b1e54', '#93c5fd'],
    master: ['#f7e8ff', '#a855f7', '#2b0656', '#e879f9'],
    grandmaster: ['#ffe4e6', '#ef233c', '#3d030a', '#fbbf24']
  };
  const METAL = { light: '#fffbeb', mid: '#e0b24c', dark: '#543809', edge: '#9a6f18' };
  const STEEL = { light: '#f8fafc', mid: '#8b9bb0', dark: '#1e293b' };
  let symSeq = 0;

  function tierSymbol(id, size = 40, division = '') {
    const f1 = n => n.toFixed(1);
    const CX = 50, CY = 46;

    // 언랭크(배치 중): 건메탈 택티컬 독태그 실드 + 경고 스트라이프 + 스텐실 '?'
    if (id === 'unranked') {
      const u = 'teu' + (++symSeq);
      const plate = division ? (
        `<g class="te-plate">` +
        `<path d="M30 80 L34 76 H66 L70 80 L66 93 H34 Z" fill="#0f172a" stroke="#64748b" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M33 80 H67" stroke="#94a3b8" stroke-width=".6" opacity=".5"/>` +
        `<text x="50" y="88.8" text-anchor="middle" font-size="9.5" font-weight="900" font-family="system-ui,sans-serif" letter-spacing=".5" fill="#e2e8f0">${division}</text></g>`
      ) : '';
      return `<svg class="tier-symbol tier-symbol-unranked" style="--tier:#64748b" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-hidden="true"><defs>` +
        `<linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset=".45" stop-color="#64748b"/><stop offset="1" stop-color="#0f172a"/></linearGradient>` +
        `<linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#090d16"/></linearGradient></defs>` +
        `<g class="te-body">` +
        `<path d="M50 8 L82 18 L85 46 L68 74 L50 83 L32 74 L15 46 L18 18 Z" fill="url(#${u}a)" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>` +
        `<path d="M50 13 L77 21.5 L79.5 45.5 L64.5 70 L50 77.5 L35.5 70 L20.5 45.5 L23 21.5 Z" fill="url(#${u}b)" stroke="#94a3b8" stroke-width="1"/>` +
        `<path d="M30 28 H70 M30 62 H70" stroke="#475569" stroke-width="1" stroke-dasharray="3 2"/>` +
        `<circle cx="26" cy="24" r="1.6" fill="#cbd5e1"/><circle cx="74" cy="24" r="1.6" fill="#cbd5e1"/><circle cx="24" cy="46" r="1.6" fill="#cbd5e1"/><circle cx="76" cy="46" r="1.6" fill="#cbd5e1"/>` +
        `<text x="50" y="56" text-anchor="middle" font-size="31" font-weight="900" font-family="Georgia,serif" fill="#cbd5e1" stroke="#020617" stroke-width="1.5" paint-order="stroke">?</text>` +
        `</g>${plate}</svg>`;
    }

    const t = TIERS.find(x => x.id === id) || TIERS[0];
    const k = TIERS.indexOf(t);
    const [lt, c, dk, acc] = PAL[t.id];
    const u = 'te' + (++symSeq), G = n => `url(#${u}${n})`;
    // division 단계(V=1, IV=2, III=3, II=4, I=5). 표시가 없거나 마스터 이상이면 5(풀 장식)
    const divRank = { V: 1, IV: 2, III: 3, II: 4, I: 5 }[division] || (k >= 5 ? 5 : 3);

    const defs =
      // 메인 티어 금속 그라데이션 (4단 입체 반사)
      `<linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".22" stop-color="${lt}"/><stop offset=".55" stop-color="${c}"/><stop offset=".82" stop-color="${dk}"/><stop offset="1" stop-color="${c}"/></linearGradient>` +
      `<linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${dk}"/></linearGradient>` +
      // 역방향 베벨 그라데이션 (음각·내부 테두리 입체감)
      `<linearGradient id="${u}i" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${lt}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="${dk}"/></linearGradient>` +
      // 브러시드 스틸 / 실버 블레이드
      `<linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${STEEL.light}"/><stop offset=".48" stop-color="${STEEL.mid}"/><stop offset=".85" stop-color="${STEEL.dark}"/><stop offset="1" stop-color="${STEEL.mid}"/></linearGradient>` +
      // 골드 트림 (배그 특유의 묵직한 황금 장갑 테두리)
      `<linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${METAL.light}"/><stop offset=".35" stop-color="${METAL.mid}"/><stop offset=".78" stop-color="${METAL.dark}"/><stop offset="1" stop-color="${METAL.mid}"/></linearGradient>` +
      // 딥 아머 코어 배경
      `<radialGradient id="${u}f" cx=".5" cy=".32" r=".78"><stop offset="0" stop-color="${c}"/><stop offset=".55" stop-color="${dk}"/><stop offset="1" stop-color="#04060c"/></radialGradient>` +
      // 후광 글로우
      `<radialGradient id="${u}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${acc}" stop-opacity=".9"/><stop offset=".5" stop-color="${c}" stop-opacity=".4"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>` +
      // 보석·크리스탈 하이라이트
      `<radialGradient id="${u}c" cx=".35" cy=".28" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="${lt}"/><stop offset=".8" stop-color="${c}"/><stop offset="1" stop-color="${dk}"/></radialGradient>`;

    const poly = (n, r, rot = -90, cx = CX, cy = CY) => {
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = (rot + i * 360 / n) * Math.PI / 180;
        d += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * r) + ' ' + f1(cy + Math.sin(a) * r);
      }
      return d + 'Z';
    };
    const starP = (n, ro, ri, rot = -90, cx = CX, cy = CY) => {
      let d = '';
      for (let i = 0; i < n * 2; i++) {
        const a = (rot + i * 180 / n) * Math.PI / 180, r = i % 2 ? ri : ro;
        d += (i ? 'L' : 'M') + f1(cx + Math.cos(a) * r) + ' ' + f1(cy + Math.sin(a) * r);
      }
      return d + 'Z';
    };
    const rivets = (n, r, rr = 1.4, rot = -90, cy = CY) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const a = (rot + i * 360 / n) * Math.PI / 180;
        s += `<circle cx="${f1(CX + Math.cos(a) * r)}" cy="${f1(cy + Math.sin(a) * r)}" r="${rr}" fill="${G('a')}" stroke="${dk}" stroke-width=".5"/>`;
      }
      return `<g class="te-rivets">${s}</g>`;
    };

    // PUBG 스타일 날카로운 메카닉·발키리 칼깃 (개별 각면 + 중심 능선)
    const bladeFeather = (bx, by, deg, L, w) => {
      const r = deg * Math.PI / 180, dx = Math.cos(r), dy = Math.sin(r), nx = -dy, ny = dx;
      const tx = bx + dx * L, ty = by + dy * L;
      const m1x = bx + dx * L * .62 + nx * w * .58, m1y = by + dy * L * .62 + ny * w * .58;
      const m2x = bx + dx * L * .45 - nx * w * .38, m2y = by + dy * L * .45 - ny * w * .38;
      return `M${f1(bx)} ${f1(by)} L${f1(m1x)} ${f1(m1y)} L${f1(tx)} ${f1(ty)} L${f1(m2x)} ${f1(m2y)} Z`;
    };
    // 다겹 전술 날개: 외곽 장갑깃 + 중간 블레이드깃 + 내부 코어깃
    const tacWings = (scale, outerFill, midFill, innerFill, layers = 3) => {
      const bx = CX - 9, by = CY + 3;
      let p1 = '', p2 = '', p3 = '', ridge = '';
      const n1 = 7;
      for (let i = 0; i < n1; i++) {
        const a = 212 - i * 13.5;
        const len = (45 - Math.abs(i - 2.2) * 3.1) * scale;
        p1 += bladeFeather(bx, by, a, len, 9.5 * scale);
        const r = a * Math.PI / 180;
        ridge += `M${f1(bx)} ${f1(by)} L${f1(bx + Math.cos(r) * len * .92)} ${f1(by + Math.sin(r) * len * .92)}`;
      }
      const n2 = 6;
      for (let i = 0; i < n2; i++) {
        const a = 208 - i * 14.5;
        p2 += bladeFeather(bx + 2, by - 1, a, (32 - Math.abs(i - 2) * 2.2) * scale, 8.2 * scale);
      }
      if (layers >= 3) {
        const n3 = 5;
        for (let i = 0; i < n3; i++) {
          const a = 204 - i * 16;
          p3 += bladeFeather(bx + 4, by - 2, a, 20 * scale, 7 * scale);
        }
      }
      const one =
        `<path d="${p1}" fill="${outerFill}" stroke="${dk}" stroke-width="1" stroke-linejoin="round"/>` +
        `<path d="${ridge}" stroke="${lt}" stroke-width=".55" opacity=".75"/>` +
        `<path d="${p2}" fill="${midFill}" stroke="${dk}" stroke-width=".85" stroke-linejoin="round"/>` +
        (p3 ? `<path d="${p3}" fill="${innerFill}" stroke="${dk}" stroke-width=".75" stroke-linejoin="round"/>` : '');
      return `<g class="te-wing te-wing-l">${one}</g><g class="te-wing te-wing-r" transform="translate(100 0) scale(-1 1)">${one}</g>`;
    };

    // 금속 월계관 (날카로운 겹잎)
    const tacLaurel = (r, from, to, n, fill) => {
      let s = '';
      for (let i = 0; i < n; i++) {
        const a = (from + (to - from) * i / (n - 1)) * Math.PI / 180;
        const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
        const deg = (a * 180 / Math.PI) + 90;
        s += `<path d="M0 -6 L2.4 -1 L0 5 L-2.4 -1 Z" transform="translate(${f1(x)} ${f1(y)}) rotate(${f1(deg - 28)})"/>`;
      }
      const g = `<g class="te-laurel" fill="${fill}" stroke="${dk}" stroke-width=".6" stroke-linejoin="round">${s}</g>`;
      return g + `<g class="te-laurel" transform="translate(100 0) scale(-1 1)">${g}</g>`;
    };

    // PUBG 스타일 다각 아머 실드 (외곽 프레임 + 역베벨 림 + 딥 코어 + 상단 하이라이트)
    const armorShield = (w, h, top, rimFill, bezelFill, coreFill) => {
      const b = top + h, m = top + h * .52, sh = top + h * .14;
      const outer = `M${CX} ${top} L${CX + w * .78} ${sh} L${CX + w} ${m} L${CX + w * .62} ${top + h * .82} L${CX} ${b} L${CX - w * .62} ${top + h * .82} L${CX - w} ${m} L${CX - w * .78} ${sh} Z`;
      const iw = w * .84, ih = h * .84, it = top + h * .08, ib = it + ih, im = it + ih * .52, ish = it + ih * .14;
      const mid = `M${CX} ${it} L${CX + iw * .78} ${ish} L${CX + iw} ${im} L${CX + iw * .62} ${it + ih * .82} L${CX} ${ib} L${CX - iw * .62} ${it + ih * .82} L${CX - iw} ${im} L${CX - iw * .78} ${ish} Z`;
      const cw = w * .72, ch = h * .72, ct = top + h * .14, cb = ct + ch, cm = ct + ch * .52, csh = ct + ch * .14;
      const core = `M${CX} ${ct} L${CX + cw * .78} ${csh} L${CX + cw} ${cm} L${CX + cw * .62} ${ct + ch * .82} L${CX} ${cb} L${CX - cw * .62} ${ct + ch * .82} L${CX - cw} ${cm} L${CX - cw * .78} ${csh} Z`;
      return `<g class="te-shield">` +
        `<path d="${outer}" fill="${rimFill}" stroke="${dk}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="${mid}" fill="${bezelFill}" stroke="${lt}" stroke-width=".8" stroke-linejoin="round"/>` +
        `<path d="${core}" fill="${coreFill}" stroke="${dk}" stroke-width="1" stroke-linejoin="round"/>` +
        `<path d="M${CX} ${ct + 1} L${CX + cw * .72} ${csh + 1} L${CX} ${cm - 2} L${CX - cw * .72} ${csh + 1} Z" fill="#fff" opacity=".16"/>` +
        `</g>`;
    };

    // 문양: 3x3 스도쿠 전술 코어 / 교차 검·연필 / 다면 보석 / 제왕 크라운
    const tacGrid = (s = 1, cy = CY) => {
      let q = '';
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const isCenter = i === 1 && j === 1;
        q += `<rect x="${f1(CX - 8.5 * s + j * 6 * s)}" y="${f1(cy - 8.5 * s + i * 6 * s)}" width="${f1(5 * s)}" height="${f1(5 * s)}" rx="${f1(.7 * s)}" fill="${isCenter ? '#fff' : G('c')}" opacity="${isCenter ? '1' : '.9'}"/>`;
      }
      return `<g class="te-core-grid" stroke="${dk}" stroke-width=".65">${q}</g>`;
    };
    const tacSwords = (deg, len = 42, w = 4.2) =>
      `<g class="te-sword" transform="rotate(${deg} ${CX} ${CY})">` +
      // 칼날 (좌우 투톤 베벨)
      `<path d="M${CX} ${CY - len / 2 - 4} L${CX + w / 2} ${CY - len / 2 + 5} V${CY + len / 2 - 8} H${CX} Z" fill="#fff" stroke="${dk}" stroke-width=".5"/>` +
      `<path d="M${CX} ${CY - len / 2 - 4} L${CX - w / 2} ${CY - len / 2 + 5} V${CY + len / 2 - 8} H${CX} Z" fill="${G('s')}" stroke="${dk}" stroke-width=".5"/>` +
      // 코등이(가드) & 손잡이 & 폼멜
      `<path d="M${CX - w * 1.6} ${CY + len / 2 - 8} L${CX} ${CY + len / 2 - 10} L${CX + w * 1.6} ${CY + len / 2 - 8} L${CX + w * 1.2} ${CY + len / 2 - 5.5} H${CX - w * 1.2} Z" fill="${G('a')}" stroke="${METAL.dark}" stroke-width=".6"/>` +
      `<rect x="${CX - w * .38}" y="${CY + len / 2 - 5.5}" width="${w * .76}" height="6.5" rx=".8" fill="${dk}" stroke="${METAL.mid}" stroke-width=".5"/>` +
      `<circle cx="${CX}" cy="${CY + len / 2 + 2}" r="${w * .55}" fill="${G('a')}" stroke="${METAL.dark}" stroke-width=".6"/>` +
      `</g>`;
    const crossedBlades = (len = 44, w = 4.2) => tacSwords(-38, len, w) + tacSwords(38, len, w);

    // 다면 컷팅 보석 (PUBG 다이아·마스터 센터 코어)
    const facetGem = (cy = CY, s = 1.35) =>
      `<g class="te-gem" transform="translate(${CX} ${cy}) scale(${s})">` +
      `<polygon points="0,-10 7,-4 7,4 0,10 -7,4 -7,-4" fill="${G('c')}" stroke="${dk}" stroke-width="1" stroke-linejoin="round"/>` +
      `<polygon points="0,-10 7,-4 3,-1 0,-5" fill="#fff" opacity=".75"/>` +
      `<polygon points="-7,-4 0,-10 0,-5 -3,-1" fill="${lt}" opacity=".85"/>` +
      `<polygon points="0,10 7,4 3,1 0,5" fill="${dk}" opacity=".55"/>` +
      `<polygon points="0,-5 3,-1 0,5 -3,-1" fill="#fff" opacity=".5"/>` +
      `<polygon points="0,-10 7,-4 7,4 0,10 -7,4 -7,-4" fill="none" stroke="${lt}" stroke-width=".5"/>` +
      `</g>`;

    // 임페리얼 크라운 (마스터·그랜드마스터 상단 왕관)
    const impCrown = (cy, s, fill) =>
      `<g class="te-crown" transform="translate(${CX} ${cy}) scale(${s})">` +
      `<path d="M-13 6 L-15 -5 L-7 1 L-4 -6 L0 -10 L4 -6 L7 1 L15 -5 L13 6 Z" fill="${fill}" stroke="${METAL.dark}" stroke-width="1" stroke-linejoin="round"/>` +
      `<path d="M-13 6 L-7 1 L0 -10 L7 1 L13 6 Z" fill="#fff" opacity=".28"/>` +
      `<rect x="-13.5" y="5.5" width="27" height="4" rx="1.2" fill="${G('a')}" stroke="${METAL.dark}" stroke-width=".8"/>` +
      `<circle cx="0" cy="-10.5" r="1.9" fill="#fff" stroke="${METAL.dark}" stroke-width=".5"/>` +
      `<circle cx="-15" cy="-5.5" r="1.5" fill="${lt}"/><circle cx="15" cy="-5.5" r="1.5" fill="${lt}"/>` +
      `<polygon points="0,0 2.2,2.2 0,4.4 -2.2,2.2" fill="${c}" stroke="#fff" stroke-width=".5"/>` +
      `<circle cx="-7" cy="7.5" r="1.1" fill="${c}"/><circle cx="7" cy="7.5" r="1.1" fill="${c}"/>` +
      `</g>`;

    // 단계(V~I)에 따라 추가되는 상단 전술 스타 & 하단 셰브론 윙
    const divStars = (y, count, r = 2.6) => {
      if (count <= 0) return '';
      let s = '';
      const gap = 5.6, startX = CX - (count - 1) * gap / 2;
      for (let i = 0; i < count; i++) {
        const sx = startX + i * gap, sy = y + Math.abs(i - (count - 1) / 2) * 1.1;
        s += `<path d="${starP(5, r, r * .45, -90, sx, sy)}" fill="${G('a')}" stroke="${dk}" stroke-width=".55"/>`;
      }
      return `<g class="te-div-stars">${s}</g>`;
    };
    const sideFlanges = (tierLv) => {
      if (tierLv < 2) return '';
      const w = 31 + tierLv * 1.5;
      return `<g class="te-flange">` +
        `<path d="M${CX - w} ${CY - 9} L${CX - w - 6} ${CY - 3} L${CX - w - 4} ${CY + 9} L${CX - w + 2} ${CY + 13} Z" fill="${G('a')}" stroke="${dk}" stroke-width=".8"/>` +
        `<path d="M${CX + w} ${CY - 9} L${CX + w + 6} ${CY - 3} L${CX + w + 4} ${CY + 9} L${CX + w - 2} ${CY + 13} Z" fill="${G('a')}" stroke="${dk}" stroke-width=".8"/>` +
        `</g>`;
    };

    const glow = r => `<circle class="te-aura" cx="${CX}" cy="${CY}" r="${r}" fill="${G('g')}"/>`;
    const rays = (n, R, cls = 'te-rays') => {
      let d = '';
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        d += `M${CX} ${CY} L${f1(CX + Math.cos(a - .045) * R)} ${f1(CY + Math.sin(a - .045) * R)} L${f1(CX + Math.cos(a + .045) * R)} ${f1(CY + Math.sin(a + .045) * R)}Z`;
      }
      return `<path class="${cls}" d="${d}" fill="${lt}" opacity=".36"/>`;
    };
    const haloRing = (r) =>
      `<g class="te-rays">` +
      `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${lt}" stroke-width="1.1" stroke-dasharray="5 3" opacity=".65"/>` +
      `<circle cx="${CX}" cy="${CY}" r="${r - 3.5}" fill="none" stroke="${G('a')}" stroke-width=".7" opacity=".55"/>` +
      `</g>`;

    let art = '';
    switch (t.id) {
      case 'bronze':
        // 브론즈: 팔각 중장갑 방패 + 리벳 베젤 + 스도쿠 코어 + 단계별 상단 핍
        art =
          (divRank >= 3 ? sideFlanges(2) : '') +
          `<path d="${poly(8, 32, -67.5)}" fill="${G('b')}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>` +
          `<path d="${poly(8, 28, -67.5)}" fill="${G('i')}" stroke="${lt}" stroke-width=".9"/>` +
          rivets(8, 30, 1.35, -67.5) +
          armorShield(20, 42, CY - 20, G('r'), G('i'), G('f')) +
          tacGrid(1.05, CY + 1) +
          divStars(17, Math.min(3, Math.ceil(divRank / 2)), 2.5);
        break;

      case 'silver':
        // 실버: 브러시드 스틸 측면 칼날 + 교차 전술 블레이드 + 6각 장갑 실드
        art =
          `<g class="te-wing"><path d="M12 34 L28 28 L25 54 L15 48 Z M88 34 L72 28 L75 54 L85 48 Z" fill="${G('s')}" stroke="${dk}" stroke-width="1.2" stroke-linejoin="round"/></g>` +
          crossedBlades(56, 3.8) +
          `<path d="${poly(6, 31, -90)}" fill="${G('b')}" stroke="${dk}" stroke-width="2" stroke-linejoin="round"/>` +
          `<path d="${poly(6, 26.5, -90)}" fill="${G('i')}" stroke="#fff" stroke-width=".9"/>` +
          rivets(6, 28.8, 1.5, -90) +
          armorShield(19, 41, CY - 19.5, G('s'), G('i'), G('f')) +
          tacGrid(1.0, CY + 1) +
          divStars(15.5, Math.min(4, divRank), 2.6);
        break;

      case 'gold':
        // 골드: 후광 + 4방향 황금 검날 스타 + 월계관 + 로열 골드 장갑 방패 + 상단 크라운/스타
        art =
          glow(44) +
          `<path d="${starP(4, 46, 17, -90)}" fill="${G('a')}" stroke="${dk}" stroke-width="1.3" stroke-linejoin="round"/>` +
          `<path d="${starP(4, 39, 17, -45)}" fill="${G('b')}" stroke="${dk}" stroke-width="1.1" stroke-linejoin="round"/>` +
          tacLaurel(33, 108, 198, 7, G('a')) +
          crossedBlades(58, 4) +
          armorShield(21, 44, CY - 21, G('b'), G('i'), G('f')) +
          tacGrid(1.0, CY + 2) +
          impCrown(CY - 22, .82, G('a')) +
          divStars(11.5, Math.min(5, divRank), 2.3);
        break;

      case 'platinum':
        // 플래티넘: 시안 에너지 후광 + 2겹 메카닉 윙 + 12각 톱니 베젤 + 택티컬 조준선 + 플라즈마 보석
        art =
          glow(47) + rays(12, 46) +
          tacWings(.78, G('s'), G('b'), G('c'), 2) +
          `<path d="${starP(12, 34, 29.5, -90)}" fill="${G('s')}" stroke="${dk}" stroke-width="1.4" stroke-linejoin="round"/>` +
          armorShield(21, 45, CY - 21.5, G('b'), G('a'), G('f')) +
          `<g fill="none" stroke="${lt}" stroke-width="1.1" opacity=".85"><circle cx="${CX}" cy="${CY}" r="13"/><path d="M${CX - 17} ${CY} H${CX - 7} M${CX + 7} ${CY} H${CX + 17} M${CX} ${CY - 17} V${CY - 7} M${CX} ${CY + 7} V${CY + 17}"/></g>` +
          facetGem(CY, 1.18) +
          impCrown(CY - 23, .92, G('s')) +
          divStars(11, Math.min(5, divRank), 2.4);
        break;

      case 'diamond':
        // 다이아몬드: 8방향 크리스탈 스타 + 3겹 발키리 날개 + 황금 월계관 + 대형 다면 다이아몬드 코어
        art =
          glow(50) + rays(16, 49) +
          `<path d="${starP(8, 47, 15, -90)}" fill="${G('s')}" stroke="${dk}" stroke-width="1.1" stroke-linejoin="round"/>` +
          `<path d="${starP(8, 39, 15, -67.5)}" fill="${G('b')}" stroke="${dk}" stroke-width="1" stroke-linejoin="round"/>` +
          tacWings(.92, G('b'), G('s'), G('c'), 3) +
          tacLaurel(31, 105, 202, 8, G('a')) +
          armorShield(21.5, 46, CY - 22, G('a'), G('b'), G('f')) +
          facetGem(CY + 1, 1.48) +
          impCrown(CY - 24, 1.05, G('a')) +
          divStars(10, Math.min(5, divRank), 2.5);
        break;

      case 'master':
        // 마스터: 회전 룬 후광 + 20각 황금 태양림 + 교차 의장검 + 3겹 대날개 + 황제 크라운 + 아케인 코어
        art =
          glow(52) + rays(20, 51) + haloRing(44) +
          `<path d="${starP(16, 46, 33)}" fill="${G('a')}" stroke="${METAL.dark}" stroke-width="1" opacity=".95"/>` +
          crossedBlades(68, 4.4) +
          tacWings(1.04, G('a'), G('b'), G('c'), 3) +
          tacLaurel(30, 104, 204, 8, G('a')) +
          armorShield(22, 47, CY - 22, G('a'), G('b'), G('f')) +
          tacGrid(.78, CY + 2) +
          facetGem(CY + 2, 1.15) +
          impCrown(CY - 25, 1.25, G('a'));
        break;

      case 'grandmaster':
        // 그랜드마스터 (PUBG 프레데터/컨커러 급): 회전 이중 후광 + 타오르는 진홍 불꽃 + 쌍홀 + 4겹 황금 대날개 + 5성 제왕관
        art =
          glow(56) + rays(28, 55) + haloRing(47) +
          `<path d="${starP(20, 49, 35)}" fill="${G('a')}" stroke="${METAL.dark}" stroke-width="1"/>` +
          `<path d="${starP(20, 43, 32, -81)}" fill="${G('r')}" stroke="${dk}" stroke-width=".85"/>` +
          `<path class="te-flame" d="M50 -4 C56 6 64 4 62 15 C69 9 75 16 71 26 C66 20 59 22 57 16 C54 22 46 22 43 16 C41 22 34 20 29 26 C25 16 31 9 38 15 C36 4 44 6 50 -4Z" fill="${G('r')}" stroke="${METAL.mid}" stroke-width="1"/>` +
          crossedBlades(74, 4.8) +
          tacWings(1.16, G('a'), G('r'), G('c'), 3) +
          tacLaurel(32, 100, 206, 9, G('a')) +
          armorShield(23, 49, CY - 22.5, G('a'), G('r'), G('f')) +
          tacGrid(.82, CY + 3) +
          facetGem(CY + 3, 1.28) +
          impCrown(CY - 26.5, 1.45, G('a')) +
          divStars(6.5, 5, 2.3);
        break;
    }

    // 하단 택티컬 셰브론 명판 (볼트 + 메탈릭 로마 숫자 배지)
    const plate = division ? (() => {
      const w = 15, y = 78.5, h = 14.5;
      const fs = division.length >= 3 ? 9.5 : division.length === 2 ? 10.8 : 11.8;
      return `<g class="te-plate">` +
        `<path d="M${CX - w - 5} ${y + 3} L${CX - w} ${y} H${CX + w} L${CX + w + 5} ${y + 3} L${CX + w + 2} ${y + h - 2} L${CX} ${y + h + 2.5} L${CX - w - 2} ${y + h - 2} Z" fill="${G('a')}" stroke="${dk}" stroke-width="1.3" stroke-linejoin="round"/>` +
        `<path d="M${CX - w - 2} ${y + 3.5} L${CX - w + 1.5} ${y + 1.6} H${CX + w - 1.5} L${CX + w + 2} ${y + 3.5} L${CX + w} ${y + h - 3} L${CX} ${y + h + .5} L${CX - w} ${y + h - 3} Z" fill="${G('f')}" stroke="${lt}" stroke-width=".6" stroke-linejoin="round"/>` +
        `<circle cx="${CX - w - 1.2}" cy="${y + h * .46}" r="1.1" fill="${METAL.light}"/><circle cx="${CX + w + 1.2}" cy="${y + h * .46}" r="1.1" fill="${METAL.light}"/>` +
        `<text x="${CX}" y="${y + h * .52 + fs * .35}" text-anchor="middle" font-size="${fs}" font-weight="900" font-family="Georgia,'Times New Roman',serif" letter-spacing=".5" fill="${G('c')}" stroke="${dk}" stroke-width=".6" paint-order="stroke">${division}</text>` +
        `</g>`;
    })() : '';

    const spark = k >= 2 ? (
      `<path class="te-spark" d="M73 16 L74.8 21.2 L80 23 L74.8 24.8 L73 30 L71.2 24.8 L66 23 L71.2 21.2Z" fill="#fff"/>` +
      (k >= 4 ? `<path class="te-spark te-spark-2" d="M26 20 L27.3 23.7 L31 25 L27.3 26.3 L26 30 L24.7 26.3 L21 25 L24.7 23.7Z" fill="${lt}"/>` : '')
    ) : '';
    return `<svg class="tier-symbol tier-symbol-${t.id} te-k${k} te-div-${divRank}" style="--tier:${c}" width="${size}" height="${size}" viewBox="-9 -11 118 118" overflow="visible" role="img" aria-hidden="true"><defs>${defs}</defs><g class="te-body">${art}</g>${plate}${spark}</svg>`;
  }

  /* v1.1.29 · PUBG 경쟁전 스타일 사운드:
   *   - 단계 승급(small): 금속 잠금 해제 클랭크 + 전술 스탬프 임팩트 + 상승 브라스 코드
   *   - 티어 승급(big): 저음 에너지 차지 → 아머 크랙 → 중량감 있는 메탈 포징 슬램(서브베이스 드롭) → 웅장한 금관 팡파르 + 크리스탈 차임 */
  function promoSound(big, k, phase = 'full') {
    try {
      const sfx = window.app && window.app.sound; if (!sfx || !sfx.enabled) return;
      sfx.init(); const ctx = sfx.ctx; if (!ctx) return;
      const out = ctx.createGain(); out.gain.value = .92; out.connect(sfx.out || ctx.destination);
      const t0 = ctx.currentTime + .02, mtof = m => 440 * Math.pow(2, (m - 69) / 12);
      const tone = (m, at, dur, type, v, det = 0) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(v, at + .014);
        g.gain.exponentialRampToValueAtTime(.0008, at + dur);
        o.connect(g); g.connect(out); o.start(at); o.stop(at + dur + .04);
      };
      // 메탈릭 타격 노이즈 + 서브 임팩트 헬퍼
      const metalHit = (at, punch = .28, pitch = 140) => {
        const sub = ctx.createOscillator(), sg = ctx.createGain();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(pitch, at);
        sub.frequency.exponentialRampToValueAtTime(34, at + .32);
        sg.gain.setValueAtTime(punch, at);
        sg.gain.exponentialRampToValueAtTime(.001, at + .35);
        sub.connect(sg); sg.connect(out); sub.start(at); sub.stop(at + .38);
        // 금속 배음 클랭크
        [820, 1340, 2180].forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle'; o.frequency.setValueAtTime(f * (1 + k * .04), at);
          o.frequency.exponentialRampToValueAtTime(f * .72, at + .18);
          g.gain.setValueAtTime(punch * (.28 - i * .06), at);
          g.gain.exponentialRampToValueAtTime(.0008, at + .22);
          o.connect(g); g.connect(out); o.start(at); o.stop(at + .24);
        });
      };

      const base = 60 + Math.min(Math.max(0, k || 0), 6);
      if (!big) {
        metalHit(t0, .2, 120);
        [0, 4, 7, 12].forEach((s, i) => {
          tone(base + 12 + s, t0 + .06 + i * .065, .48, 'sawtooth', .065);
          tone(base + 12 + s, t0 + .06 + i * .065, .52, 'triangle', .11);
        });
        return;
      }
      if (phase === 'charge') {
        // 엠블럼 에너지 응축 라이저
        const sw = ctx.createOscillator(), sg = ctx.createGain(), lp = ctx.createBiquadFilter();
        sw.type = 'sawtooth';
        sw.frequency.setValueAtTime(95, t0);
        sw.frequency.exponentialRampToValueAtTime(680, t0 + .65);
        lp.type = 'lowpass'; lp.frequency.value = 1400;
        sg.gain.setValueAtTime(.001, t0);
        sg.gain.linearRampToValueAtTime(.09, t0 + .55);
        sg.gain.linearRampToValueAtTime(.001, t0 + .7);
        sw.connect(lp); lp.connect(sg); sg.connect(out); sw.start(t0); sw.stop(t0 + .72);
        return;
      }
      if (phase === 'shatter') {
        metalHit(t0, .24, 180);
        [19, 24, 28, 31].forEach((s, i) => tone(base + s, t0 + i * .03, .22, 'square', .045));
        return;
      }
      if (phase === 'slam') {
        // 날개/장갑 결합 후 마지막 명판 스탬프 슬램 + 브라스 팡파르
        metalHit(t0, .38, 150);
        [0, 4, 7, 12, 16].forEach(s => {
          tone(base + s, t0 + .04, 1.7, 'sawtooth', .055, -6);
          tone(base + s, t0 + .04, 1.7, 'sawtooth', .055, 6);
          tone(base + s + 12, t0 + .04, 1.5, 'triangle', .06);
        });
        tone(base - 12, t0 + .04, 1.8, 'sine', .28);
        [24, 28, 31, 36, 40].forEach((s, i) => tone(base + s, t0 + .12 + i * .055, 1.25, 'sine', .075));
        return;
      }
      // 기본 통합 사운드 (phase === 'full')
      const sw = ctx.createOscillator(), sg = ctx.createGain(), lp = ctx.createBiquadFilter(); sw.type = 'sawtooth';
      sw.frequency.setValueAtTime(140, t0); sw.frequency.exponentialRampToValueAtTime(1400, t0 + .55);
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      sg.gain.setValueAtTime(0, t0); sg.gain.linearRampToValueAtTime(.07, t0 + .3); sg.gain.linearRampToValueAtTime(0, t0 + .6);
      sw.connect(lp); lp.connect(sg); sg.connect(out); sw.start(t0); sw.stop(t0 + .65);
      const f = t0 + .58;
      metalHit(f, .32, 145);
      [0, 7, 12].forEach((s, i) => { tone(base + s, f + i * .11, .28, 'sawtooth', .065); tone(base + s, f + i * .11, .28, 'square', .035); });
      metalHit(f + .4, .36, 130);
      [0, 4, 7, 12, 16].forEach(s => { tone(base + s, f + .42, 1.65, 'sawtooth', .05, -5); tone(base + s + 12, f + .42, 1.45, 'triangle', .055); });
      tone(base - 12, f + .42, 1.7, 'sine', .26);
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
    if (big && !reduced) for (let i = 0; i < 32; i++) {
      parts += `<i style="--a:${Math.round(Math.random() * 360)}deg;--d:${Math.round(95 + Math.random() * 140)}px;--dl:${(.45 + Math.random() * .3).toFixed(2)}s"></i>`;
    }
    wrap.innerHTML = `<div class="tp-burst"></div><div class="tp-shockwave"></div><div class="tp-parts">${parts}</div><div class="tp-emblem">${tierSymbol(tier.id, big ? 210 : 148, tier.division)}</div>`;
    wrap.setAttribute('aria-label', tier.name);
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 350); };
    wrap.addEventListener('click', close);
    document.body.append(wrap);
    setTimeout(close, big ? 3800 : 2100);
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
    // v2.1.0: 온라인 배틀 랜덤 매칭 전용 래더 (난이도별 배틀 RP/티어)
    if (!all.battle || typeof all.battle !== 'object') all.battle = { lastDiff: null, byDiff: {} };
    if (!all.battle.byDiff) all.battle.byDiff = {};
    DIFFS.forEach(d => { all.battle.byDiff[d] = fix(all.battle.byDiff[d]); });
    if (ensureSeason(all)) saveAll(all);
    return all;
  };
  const MODES = ['battle'];
  // 경쟁전 랭크 사다리: 난이도별 배틀 랭크(all.battle)만 사용합니다.
  const ladder = (all, mode) => (mode === 'timeattack' && all.ta ? all.ta : (mode === 'standard' && all.byDiff ? all : all.battle));
  const saveAll = all => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (_) {} };
  const load = d => loadAll().battle.byDiff[DIFFS.includes(d) ? d : 'expert'];

  const DIV_RP = 100;

  /* ---------- 랭크 규칙 ----------
   * v2.2.1: 시즌제를 없앴습니다(RP 초기화·배치 경기·시즌 보상 없음). 랭크는 계속 쌓입니다.
   * 승급: 다음 티어 RP에 닿으면 바로 승급하고, 승급 직후 3판은 티어 시작점 아래로 떨어지지 않습니다(강등 보호).
   * 티어 보상: 배틀(경쟁전)에서 한 번이라도 도달한 최고 티어로 영구 해금됩니다(최고 RP = peak 기준). */
  const PLACEMENT = 5, BOOST_GAMES = 5;
  const UNRANKED = { id: 'unranked', ko: '언랭크', min: 0, color: '#64748b' };
  // 예전 시즌제가 남긴 배치 경기·시즌 보상 상태를 정리합니다.
  function ensureSeason(all) {
    let changed = false;
    MODES.forEach(m => DIFFS.forEach(d => {
      const s = ladder(all, m).byDiff[d];
      if (s && (s.placement > 0 || s.boost > 0)) { s.placement = 0; s.boost = 0; changed = true; }
    }));
    if (all.seasonReward) { delete all.seasonReward; changed = true; }
    return changed;
  }
  // 화면에 보일 티어: 배치 중이면 언랭크
  function shownTier(s) {
    if (s && s.placement > 0) return { ...UNRANKED, index: -1, division: '', name: tr(UNRANKED.ko), divMin: 0, divMax: null, next: TIERS[0], placementDone: PLACEMENT - s.placement };
    return tierOf(s ? s.rating : 1000);
  }
  // 지금까지 도달한 최고 티어(모든 랭크 기록)
  function bestTierIndex(all) {
    let k = -1;
    (all.hof || []).forEach(h => { if (h && Number.isFinite(h.best)) k = Math.max(k, tierOf(h.best).index); });
    ['battle', 'standard', 'timeattack'].forEach(m => DIFFS.forEach(d => {
      const s = ladder(all, m)?.byDiff?.[d];
      if (s && !(s.placement > 0) && ((s.seasonGames || 0) > 0 || (s.games || 0) > 0)) {
        k = Math.max(k, tierOf(Math.max(s.seasonBest || 0, s.peak || 0, s.rating || 0)).index);
      }
    }));
    return k;
  }
  // v2.2.1: 티어 보상 해금 = 배틀에서 도달한 최고 티어(영구). RP가 다시 떨어져도 잠기지 않습니다.
  function rewardTierIndex(all) {
    let k = -1;
    DIFFS.forEach(d => {
      const s = ladder(all, 'battle')?.byDiff?.[d];
      if (s && (s.games || 0) > 0) k = Math.max(k, tierOf(Math.max(s.peak || 0, s.rating || 0)).index);
    });
    (all.hof || []).forEach(h => { if (h && h.mode === 'battle' && Number.isFinite(h.best)) k = Math.max(k, tierOf(h.best).index); });
    return k;
  }
  function tierOf(rating) {
    let k = 0; for (let i = 0; i < TIERS.length; i++) if (rating >= TIERS[i].min) k = i;
    const t = TIERS[k], next = TIERS[k + 1];
    let division = '', divMin = t.min, divMax = next ? next.min : null;
    if (k <= 4) {
      // 다음 티어 시작점에서 100 RP씩 아래로 I, II, III, IV, V. 가장 아래 단계(V)는 1000 RP(1000 미만은 0)부터 시작합니다.
      const d = clamp(ROMAN.length - 1 - Math.floor((next.min - 1 - rating) / DIV_RP), 0, ROMAN.length - 1);
      division = ROMAN[d]; divMax = next.min - (ROMAN.length - 1 - d) * DIV_RP;
      const baseMin = divMax - DIV_RP;
      divMin = d === 0 && rating < baseMin ? t.min : baseMin;
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
    battle: ['배틀', 'Battle', 'バトル', '对战', '對戰', 'Batalla', 'Duel', 'Kampf'],
    standard: ['일반', 'Standard', '通常', '普通', '一般', 'Normal', 'Normal', 'Normal'],
    timeattack: ['타임어택', 'Time Attack', 'タイムアタック', '限时挑战', '限時挑戰', 'Contrarreloj', 'Contre-la-montre', 'Zeitangriff']
  };
  const modeName = m => {
    const langs = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
    const names = MODE_NAMES[m] || MODE_NAMES.battle;
    return names[Math.max(0, langs.indexOf((window.I18N && I18N.currentLang) || 'ko'))];
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

  /* ---------- v2.1.0 온라인 배틀 전용 ELO 랭크 계산 ---------- */
  function computeBattleDelta(s, oppRating, isWin, isForfeit, diff, battleMode) {
    const myR = (s && s.rating) || 1000;
    const oppR = typeof oppRating === 'number' && oppRating > 0 ? oppRating : 1000;
    const expected = 1 / (1 + Math.pow(10, (oppR - myR) / 400));
    const k = 32 * (RP_MULT[diff] || 1);
    let base = 0, bonus = 0, forfeitPenalty = 0;
    if (isWin) {
      base = Math.max(10, Math.min(64, Math.round(k * (1 - expected))));
      const nextStreak = (s && typeof s.streak === 'number' ? s.streak : 0) + 1;
      const rate = streakBonus(nextStreak);
      bonus = rate > 0 ? Math.max(1, Math.round(base * rate)) : 0;
    } else if (isForfeit) {
      base = -Math.max(12, Math.min(56, Math.round(k * expected * 0.75)));
      forfeitPenalty = Math.max(10, Math.round(k * 0.35));
    } else {
      base = -Math.max(8, Math.min(56, Math.round(k * expected * 0.75)));
    }
    const delta = isWin ? (base + bonus) : (base - forfeitPenalty);
    return {
      delta,
      base,
      streakBonus: bonus,
      forfeitPenalty,
      expected,
      valueOf() { return delta; },
      toString() { return String(delta); }
    };
  }

  function recordBattleEnd(app, isWin, reason, oppRating) {
    try {
      if (!app) return null;
      const diff = DIFFS.includes(app.battleDiff) ? app.battleDiff : 'expert';
      const battleMode = app.battleMode || 'race';
      const win = !!isWin;
      const isForfeit = !win && (reason === 'forfeit' || reason === 'opponent_left' || reason === 'disconnect');
      const oppQuit = win && reason === 'opp_forfeit';
      const all = loadAll();
      const lad = ladder(all, 'battle');
      const s = lad.byDiff[diff];
      applyDecay(s);

      const before = s.rating, beforeTier = tierOf(before);
      const calc = computeBattleDelta(s, oppRating, win, isForfeit && !win, diff, battleMode);
      s.streak = win ? (s.streak || 0) + 1 : 0;
      s.bestStreak = Math.max(s.bestStreak || 0, s.streak);

      let delta = calc.delta;
      // v2.1.5: 상대 기권승 — 현재 판 점수(진행도)에 비례해 RP가 오릅니다. 시작 직후 기권이어도 최소 +5 RP.
      //   배율 = 0.4 + 0.6 × min(1, 내 점수 / 기준점수), 기준점수는 난이도별 완주 점수 근사치입니다.
      if (oppQuit) {
        const ref = { easy: 4000, medium: 6000, hard: 8000, expert: 10000, lunatic: 12000 }[diff] || 8000;
        const ratio = Math.max(0, Math.min(1, (Number(app.score) || 0) / ref));
        const factor = 0.4 + 0.6 * ratio;
        delta = Math.max(5, Math.round((calc.base + (calc.streakBonus || 0)) * factor));
        calc.forfeitWinFactor = factor;
      }
      const bonus = calc.streakBonus || 0;
      const bonusRate = delta > 0 ? streakBonus(s.streak) : 0;

      const rawDelta = delta, placing = s.placement > 0, hadSeries = !!s.series;
      let seriesResult = null, protectedHit = false, revealed = false, boosted = false;

      if (placing) {
        if (delta > 0) delta = Math.round(delta * 1.5);
        s.placement--;
        if (!s.placement) { revealed = true; s.boost = BOOST_GAMES; }
      } else {
        if (s.boost > 0) { if (delta > 0) { delta = Math.round(delta * 1.25); boosted = true; } s.boost--; }
        const bt = tierOf(s.rating);
        // v2.2.0: 승급전 폐지 — RP가 다음 티어 기준에 닿으면 바로 승급하고 3판 강등 보호를 받습니다.
        if (s.series) s.series = null;
        const promoted = delta > 0 && bt.next && tierOf(s.rating + delta).index > bt.index;
        if (promoted) s.protect = 3;
        if (promoted) seriesResult = 'won';
        if (delta < 0 && s.protect > 0 && seriesResult !== 'won') {
          const floor = TIERS[Math.max(0, bt.index)].min;
          if (s.rating + delta < floor) { delta = floor - s.rating; protectedHit = true; }
        }
        if (s.protect > 0 && seriesResult !== 'won') s.protect--;
      }

      s.seasonGames = (s.seasonGames || 0) + 1;
      const season = { placing, revealed, placementDone: PLACEMENT - (s.placement || 0), series: s.series ? { ...s.series } : null,
        seriesResult, protectedHit, protect: s.protect || 0, boosted, boost: s.boost || 0, hadSeries };

      s.rating = Math.max(0, s.rating + delta);
      s.peak = Math.max(s.peak, s.rating);
      s.games++; s.lastActive = Date.now(); s.lastDecay = 0;
      if (!s.placement) s.seasonBest = Math.max(s.seasonBest || 0, s.rating);
      s.history.unshift({ t: Date.now(), d: delta, bonus, streak: s.streak, diff, mode: 'battle', battleMode, win });
      s.history = s.history.slice(0, 30);
      lad.lastDiff = diff;
      all.lastMode = 'battle';
      saveAll(all);
      try { window.SumdokuSeason?.applyCosmetics?.(); } catch (_) {}

      app._rankDiff = diff;
      app._rankMode = 'battle';
      const after = tierOf(s.rating);
      const sign = delta > 0 ? '+' : '';
      let msg = `${diffName(diff)} · ${sign}${delta} RP · ${after.name} (${s.rating})`;
      if (bonus) msg += ` · ${streakText(s.streak)} +${bonus} (+${Math.round(bonusRate * 100)}%)`;
      if (after.index > beforeTier.index) msg = `${after.name} ${tr('승급')} · ${msg}`;
      else if (after.index < beforeTier.index) msg = `${after.name} ${tr('강등')} · ${msg}`;

      const change = { mode: 'battle', battleMode, oppForfeit: oppQuit, forfeitWinFactor: calc.forfeitWinFactor || null, streak: s.streak, bonus, difficulty: diff, before, after: s.rating, delta, tier: after, beforeTier, season, oppRating, msg };
      app.lastBattleRatingChange = change;
      app.renderRatingCard?.();
      return change;
    } catch (e) {
      console.warn('recordBattleEnd error', e);
      return null;
    }
  }

  /* ---------- 게임 종료 연결 ---------- */
  const RATED_MODES = ['standard', 'daily', undefined, null, ''];
  const record = p.recordGameEnd;
  p.recordGameEnd = function (isWin, ...rest) {
    this.lastRatingChange = null;
    const out = record.call(this, isWin, ...rest);
    try {
      // v2.1.0: 싱글플레이는 순수 두뇌 퍼즐(힐링 모드)로 운영하여 RP 변동을 없앱니다.
      if (!this.isBattle) {
        this.lastRatingChange = null;
        return out;
      }
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
      // ---- v1.1.28 시즌 규칙 ----
      const rawDelta = delta, placing = s.placement > 0, hadSeries = !!s.series;
      let seriesResult = null, protectedHit = false, revealed = false, boosted = false;
      if (placing) {
        if (delta > 0) delta = Math.round(delta * 1.5);
        s.placement--;
        if (!s.placement) { revealed = true; s.boost = BOOST_GAMES; }
      } else {
        if (s.boost > 0) { if (delta > 0) { delta = Math.round(delta * 1.25); boosted = true; } s.boost--; }
        const bt = tierOf(s.rating);
        // v2.2.0: 승급전 폐지 — RP가 다음 티어 기준에 닿으면 바로 승급하고 3판 강등 보호를 받습니다.
        if (s.series) s.series = null;
        const promoted = delta > 0 && bt.next && tierOf(s.rating + delta).index > bt.index;
        if (promoted) s.protect = 3;
        if (promoted) seriesResult = 'won';
        if (delta < 0 && s.protect > 0 && seriesResult !== 'won') {
          const floor = TIERS[Math.max(0, bt.index)].min;
          if (s.rating + delta < floor) { delta = floor - s.rating; protectedHit = true; }
        }
        if (s.protect > 0 && seriesResult !== 'won') s.protect--;
      }
      s.seasonGames = (s.seasonGames || 0) + 1;
      const season = { placing, revealed, placementDone: PLACEMENT - (s.placement || 0), series: s.series ? { ...s.series } : null,
        seriesResult, protectedHit, protect: s.protect || 0, boosted, boost: s.boost || 0, hadSeries };
      if (!delta && (placing || hadSeries || seriesResult)) {
        // RP 변화는 없지만 배치·승급전 진행은 저장합니다.
        s.games++; s.lastActive = Date.now(); s.lastDecay = 0;
        if (!s.placement) s.seasonBest = Math.max(s.seasonBest || 0, s.rating);
        lad.lastDiff = g.difficulty; all.lastMode = mode;
        saveAll(all); this._ratedGameId = this._ratingToken; this._rankDiff = g.difficulty; this._rankMode = mode;
        this.lastRatingChange = { mode, streak: s.streak, bonus, difficulty: g.difficulty, before, after: s.rating, delta: 0, tier: tierOf(s.rating), beforeTier, season };
        this.renderRatingCard?.();
        return out;
      }
      if (!delta) {
        saveAll(all);
        this.lastRatingChange = { mode, streak: s.streak, bonus: 0, difficulty: g.difficulty, before, after: s.rating, delta: 0, tier: tierOf(s.rating), beforeTier, season };
        if (mode === 'timeattack' && (this.score || 0) > 0) {
          const need = Math.ceil(taExpected(s.rating) / (TA_WEIGHT[g.difficulty] || 1));
          setTimeout(() => this.showToast?.(`${modeName(mode)} · ${diffName(g.difficulty)} · ${tr('레이팅 유지')} (${s.rating}) · ${tr('상승 기준')} ${need.toLocaleString()}`, 3500), 900);
          this._ratedGameId = this._ratingToken;
        }
        return out;
      }
      s.rating = Math.max(0, s.rating + delta); s.peak = Math.max(s.peak, s.rating);
      s.games++; s.lastActive = Date.now(); s.lastDecay = 0;
      if (!s.placement) s.seasonBest = Math.max(s.seasonBest || 0, s.rating);
      s.history.unshift({ t: Date.now(), d: delta, bonus, streak: s.streak, diff: g.difficulty, mode, win }); s.history = s.history.slice(0, 30);
      lad.lastDiff = g.difficulty; all.lastMode = mode;
      saveAll(all); this._ratedGameId = this._ratingToken; this._rankDiff = g.difficulty; this._rankMode = mode;
      this.lastRatingChange = { mode, streak: s.streak, bonus, difficulty: g.difficulty, before, after: s.rating, delta, tier: tierOf(s.rating), beforeTier, season };
      // 리더보드: 레이팅, 난이도별 최단 시간(밀리초), 일일 도전 시간
      const sk = 's' + all.season + '_';
      if (s.placement > 0) { /* 배치 중에는 순위에 올리지 않습니다 */ }
      else if (mode === 'timeattack') {
        submit(sk + 'ta_rating_' + g.difficulty, s.rating);
        submit('ta_rating_' + g.difficulty, s.rating);
        submit('ta_rating', Math.max(...DIFFS.map(d => all.ta.byDiff[d].rating)));
      } else {
        submit(sk + 'rating_' + g.difficulty, s.rating);
        submit('rating_' + g.difficulty, s.rating);
        submit('rating', Math.max(...DIFFS.map(d => all.byDiff[d].rating)));
        if (win) { submit(this.difficulty, g.seconds * 1000); if (this.isDaily) submit('daily', g.seconds * 1000); }
      }
      const after = tierOf(s.rating);
      const sign = delta > 0 ? '+' : '';
      let msg = `${mode === 'timeattack' ? modeName(mode) + ' · ' : ''}${diffName(g.difficulty)} · ${sign}${delta} RP · ${after.name} (${s.rating})`;
      if (bonus) msg += ` · ${streakText(s.streak)} +${bonus} (+${Math.round(bonusRate * 100)}%)`;
      if (after.index > beforeTier.index) msg = `${after.name} ${tr('승급')} · ${msg}`;
      else if (after.index < beforeTier.index) msg = `${after.name} ${tr('강등')} · ${msg}`;
      // v1.1.28: RP 변화·단계·승급 연출은 결과 화면의 랭크 패널(rank-result.js)에서 보여 줍니다.
      this.lastRatingChange.msg = msg;
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
    const mode = 'battle';
    const lad = ladder(all, mode);
    const cur = DIFFS.includes(this._rankDiff) ? this._rankDiff : (lad.lastDiff || 'easy');
    let lost = 0;
    DIFFS.forEach(d => { const x = applyDecay(lad.byDiff[d]); if (d === cur) lost = x; });
    saveAll(all);
    const s = lad.byDiff[cur];
    const t = shownTier(s), unr = t.id === 'unranked';
    const pct = unr ? t.placementDone / PLACEMENT * 100 : t.divMax ? clamp((s.rating - t.divMin) / (t.divMax - t.divMin) * 100, 0, 100) : 100;
    const idle = s.lastActive ? Math.floor((Date.now() - s.lastActive) / DAY) : 0;
    const decayIn = GRACE_DAYS - idle;
    card.style.setProperty('--tier', t.color);
    card.innerHTML = '';
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const head = el('div', 'rc-top');
    const badge = el('div', 'rc-badge rc-symbol tier-' + t.id); badge.innerHTML = tierSymbol(t.id, 56, t.division);
    const info = el('div', 'rc-info');
    info.append(el('div', 'rc-tier', t.name), el('div', 'rc-rp', unr ? `${tr('배치 경기')} ${t.placementDone} / ${PLACEMENT}` : `${s.rating} RP · ${tr('최고')} ${s.peak}`));
    head.append(badge, info); card.append(el('h3', 'section-title', tr('난이도별 랭크')));
    // 난이도 탭: 이름과 그 난이도의 티어(티어 색 밑줄)를 함께 보여 줍니다. (일반·타임어택 모드는 제외하고 난이도별 경쟁전 티어만 표시)
    const tabs = el('div', 'rc-tabs'); tabs.setAttribute('role', 'tablist');
    DIFFS.forEach(d => {
      const ds = lad.byDiff[d], dt = shownTier(ds), b = el('button', 'rc-tab' + (d === cur ? ' on' : ''));
      b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', d === cur ? 'true' : 'false');
      b.style.setProperty('--tab-tier', ds.games ? dt.color : '#94a3b8');
      b.append(el('span', 'rc-tab-name', diffName(d)), el('span', 'rc-tab-tier', ds.games ? dt.name : '—'));
      b.onclick = () => { this._rankMode = 'battle'; this._rankDiff = d; this.renderRatingCard(); };
      tabs.append(b);
    });
    card.append(tabs, head);
    const bar = el('div', 'rc-bar'); const fill = el('div', 'rc-fill'); fill.style.width = pct.toFixed(1) + '%'; bar.append(fill); card.append(bar);
    if ((s.streak || 0) >= 1) card.append(el('div', 'rc-streak', `${streakText(s.streak)} · ${tr('다음 클리어 보너스')} +${Math.round(streakBonus(s.streak + 1) * 100)}%`));
    if (false && s.series) card.append(el('div', 'rc-series', `${tr('승급전')} ${'●'.repeat(s.series.w)}${'✕'.repeat(s.series.l)}${'○'.repeat(Math.max(0, 3 - s.series.w - s.series.l))} · ${tr('3판 2선승')}`));
    if (s.protect > 0) card.append(el('div', 'rc-protect', `🛡 ${tr('강등 보호')} ${s.protect}${tr('판')}`));
    if (s.boost > 0) card.append(el('div', 'rc-boost', `⚡ ${tr('시즌 초반 가속')} +25% · ${s.boost}${tr('판')}`));
    if (unr) card.append(el('div', 'rc-next', `${tr('배치 경기')} ${PLACEMENT - t.placementDone}${tr('판')} ${tr('남음')} · ${tr('얻는 RP')} ×1.5`));
    else card.append(el('div', 'rc-next', t.divMax ? `${tr('다음 단계까지')} ${Math.ceil(t.divMax - s.rating)} RP` : tr('최고 티어입니다')));
    if (!s.games) card.append(el('div', 'rc-note', tr('이 난이도의 경쟁전 배틀에서 승리하면 레이팅이 오릅니다.')));
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
      [['랭킹 보기', lbReady('rating_' + cur) ? 'rating_' + cur : 'rating'], ['전체 리더보드', '']].forEach(([label, key]) => {
        const b = el('button', 'btn btn-secondary', tr(label)); b.type = 'button';
        b.onclick = () => { try { bridge().showLeaderboard(key); } catch (_) { window.onLeaderboardResult('error'); } };
        row.append(b);
      });
      card.append(row);
    }
  };
  const renderStats = p.renderStatsView;
  if (renderStats) p.renderStatsView = function (...a) { const r = renderStats.apply(this, a); this.renderRatingCard(); return r; };

  /* ---------- v1.1.29 · 일반전 / 랭크전 구분 & 인게임 상단 미니 티어 배지 HUD ----------
   * - 새 게임 모달(#modal-difficulty)에서 '🏆 랭크전 (RP 반영)'과 '🎮 일반전 (연습 · RP 무관)'을 선택할 수 있습니다.
   * - 기본값은 랭크전(isRanked = true)이라 기존 동작·테스트와 호환되며, 일반전으로 시작하면 RP·연승·승급전에 영향을 주지 않습니다.
   * - 게임 보드 상단 서브바(.diff-item) 옆에 현재 난이도의 실시간 미니 택티컬 엠블럼 + 티어명 + RP 배지를 표시합니다. */
  const QKEY = 'sumdoku_queue_type'; // 'ranked' | 'normal'
  const Q_TXT = {
    label: ['매치 유형', 'Match Queue', 'マッチ種別', '比赛类型', '比賽類型', 'Tipo de partida', 'Type de partie', 'Spieltyp'],
    ranked: ['🏆 랭크전 (RP 반영)', '🏆 Ranked (RP)', '🏆 ランク戦 (RP)', '🏆 排位赛 (RP)', '🏆 排位賽 (RP)', '🏆 Clasificatoria (RP)', '🏆 Classé (RP)', '🏆 Rangliste (RP)'],
    normal: ['🎮 일반전 (연습 · RP 무관)', '🎮 Normal (Casual)', '🎮 ノーマル (練習)', '🎮 普通赛 (练习)', '🎮 一般賽 (練習)', '🎮 Normal (Práctica)', '🎮 Normal (Entraînement)', '🎮 Normal (Übung)'],
    rankedDesc: ['승패와 기록에 따라 티어와 RP가 변동됩니다. 실수 3회·힌트 3개로 고정됩니다(광고 부활·힌트 가능).', 'Tier and RP change by result. Mistakes and hints are fixed at 3 (ad revive/hints still available).', '勝敗と記録に応じてティアとRPが変動します。ミス3回・ヒント3個で固定（広告で復活・ヒント可）。', '段位与RP会根据胜负和成绩变动。失误与提示固定为3次（可看广告复活/获取提示）。', '段位與RP會根據勝負和成績變動。失誤與提示固定為3次（可看廣告復活/獲取提示）。', 'El rango y RP cambian según el resultado. Errores y pistas fijos en 3 (anuncios disponibles).', 'Le rang et les RP changent selon le résultat. Erreurs et indices fixés à 3 (pubs disponibles).', 'Rang und RP ändern sich je nach Ergebnis. Fehler und Hinweise fest auf 3 (Werbung möglich).'],
    normalDesc: ['RP와 연승 기록 변동 없이 부담 없이 연습할 수 있습니다.', 'Practice freely without affecting your RP or win streak.', 'RPや連勝記録の変動なしで気軽に練習できます。', '不影响RP与连胜记录，可轻松练习。', '不影響RP與連勝紀錄，可輕鬆練習。', 'Practica libremente sin afectar tu RP ni racha.', 'Entraînez-vous sans affecter vos RP ni votre série.', 'Übe frei ohne Einfluss auf RP oder Siegesserie.'],
    casualBadge: ['일반전 · RP 무관', 'Normal · No RP', 'ノーマル · RPなし', '普通赛 · 无RP', '一般賽 · 無RP', 'Normal · Sin RP', 'Normal · Sans RP', 'Normal · Ohne RP'],
    placeShort: ['배치', 'Place', '配置', '定级', '定級', 'Clasif.', 'Place.', 'Platz.'],
    abandonTitle: ['⚠️ 진행 중인 랭크전 포기 경고', '⚠️ Abandon Ongoing Ranked Match?', '⚠️ 進行中のランク戦を放棄しますか？', '⚠️ 放弃进行中的排位赛警告', '⚠️ 放棄進行中的排位賽警告', '⚠️ ¿Abandonar partida clasificatoria?', '⚠️ Abandonner la partie classée ?', '⚠️ Laufendes Ranglistenspiel aufgeben?'],
    abandonDesc: [
      '진행 중인 경기를 이어서 완료하지 않고 새 게임을 시작하면 기권(패배) 처리되어 랭크 점수(RP)가 차감됩니다.',
      'Starting a new game without continuing your ongoing match counts as a forfeit and deducts RP.',
      '進行中の試合を続けずに新しいゲームを始めると棄権（敗北）扱いとなり、RPが減少します。',
      '若不继续当前对局而开始新游戏，当前对局将按弃权（战败）处理并扣除RP。',
      '若不繼續目前對局而開始新遊戲，目前對局將按棄權（戰敗）處理並扣除RP。',
      'Iniciar una nueva partida sin continuar la actual contará como derrota y restará RP.',
      'Lancer une nouvelle partie sans continuer la partie en cours comptera comme un abandon et réduira vos RP.',
      'Wenn du ein neues Spiel startest, ohne das laufende fortzusetzen, wird es als Niederlage gewertet und RP werden abgezogen.'
    ],
    abandonDailyNote: [
      '※ 일일 도전은 진행 중인 경기의 점수 차감 없이 시작할 수 있습니다.',
      '※ Daily Challenges can be started without any RP penalty.',
      '※ デイリーチャレンジはRP減少なしで開始できます。',
      '※ 每日挑战可直接开始，不会扣除当前对局RP。',
      '※ 每日挑戰可直接開始，不會扣除目前對局RP。',
      '※ El desafío diario se puede iniciar sin penalización de RP.',
      '※ Le défi quotidien peut être lancé sans pénalité de RP.',
      '※ Die tägliche Herausforderung kann ohne RP-Abzug gestartet werden.'
    ],
    abandonPenaltyLbl: ['포기 시 차감 점수', 'Forfeit RP Penalty', '放棄時の減少RP', '弃权扣除分数', '棄權扣除分數', 'Penalización por abandono', 'Pénalité d’abandon', 'RP-Abzug bei Aufgabe'],
    abandonStreakReset: ['연승 초기화', 'Streak reset', '連勝リセット', '连胜重置', '連勝重置', 'Racha reiniciada', 'Série réinitialisée', 'Serie zurückgesetzt'],
    abandonBtnResume: ['이전 경기 이어하기', 'Continue Ongoing Match', '前の試合を続ける', '继续上局比赛', '繼續上局比賽', 'Continuar partida', 'Continuer la partie', 'Spiel fortsetzen'],
    abandonBtnConfirm: ['감점 감수하고 새 게임 ({0} RP)', 'Forfeit & New Game ({0} RP)', '減点して新規ゲーム ({0} RP)', '扣分并开始新游戏 ({0} RP)', '扣分並開始新遊戲 ({0} RP)', 'Abandonar y nueva ({0} RP)', 'Abandonner et nouvelle ({0} RP)', 'Aufgeben & Neues Spiel ({0} RP)'],
    abandonBtnCancel: ['취소', 'Cancel', 'キャンセル', '取消', '取消', 'Cancelar', 'Annuler', 'Abbrechen'],
    abandonToast: [
      '💔 {0} 경기 포기로 {1} RP 차감 ({2} → {3} RP)',
      '💔 {0} forfeited: {1} RP ({2} → {3} RP)',
      '💔 {0} 試合放棄により {1} RP 減少 ({2} → {3} RP)',
      '💔 放弃 {0} 对局，扣除 {1} RP ({2} → {3} RP)',
      '💔 放棄 {0} 對局，扣除 {1} RP ({2} → {3} RP)',
      '💔 {0} abandonada: {1} RP ({2} → {3} RP)',
      '💔 {0} abandonnée : {1} RP ({2} → {3} RP)',
      '💔 {0} aufgegeben: {1} RP ({2} → {3} RP)'
    ]
  };
  const qt = k => {
    const langs = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
    const i = Math.max(0, langs.indexOf((window.I18N && I18N.currentLang) || 'ko'));
    return (Q_TXT[k] && (Q_TXT[k][i] || Q_TXT[k][1])) || k;
  };

  function getSavedQueue() {
    try { return localStorage.getItem(QKEY) === 'normal' ? 'normal' : 'ranked'; } catch (_) { return 'ranked'; }
  }
  function setSavedQueue(q) {
    try { localStorage.setItem(QKEY, q === 'normal' ? 'normal' : 'ranked'); } catch (_) {}
  }

  /* ---------- v2.1.0: 싱글플레이는 순수 힐링 모드로 운영하므로 탈주 감점 모달/차감을 완전히 비활성화합니다 ---------- */
  function getAbandonableOngoingGame(app) {
    return null;
  }

  function previewAbandonPenalty(st) {
    if (!st || !DIFFS.includes(st.difficulty)) return null;
    const mode = st.gameMode === 'timeattack' ? 'timeattack' : 'standard';
    const diff = st.difficulty;
    const all = loadAll();
    const s = ladder(all, mode).byDiff[diff] || fresh();
    const base = BASE_POINTS * (RP_MULT[diff] || 1);
    const over = clamp(1 + (s.rating - 1600) / 1000, 0.6, 1.8);
    const delta = -Math.round(base * 0.6 * over);
    const before = s.rating;
    const after = Math.max(0, before + delta);
    const beforeTier = shownTier(s);
    const afterTier = (s.placement && s.placement > 1) ? beforeTier : tierOf(after);
    return {
      mode,
      diff,
      delta,
      before,
      after,
      beforeTier,
      afterTier,
      streak: s.streak || 0,
      timerSeconds: st.timerSeconds || 0,
      score: st.score || 0
    };
  }

  function applyAbandonPenalty(app, st) {
    const target = st || getAbandonableOngoingGame(app);
    if (!target || !DIFFS.includes(target.difficulty)) return null;
    const mode = target.gameMode === 'timeattack' ? 'timeattack' : 'standard';
    const diff = target.difficulty;
    const all = loadAll();
    const lad = ladder(all, mode);
    const s = lad.byDiff[diff];
    applyDecay(s);

    const base = BASE_POINTS * (RP_MULT[diff] || 1);
    const over = clamp(1 + (s.rating - 1600) / 1000, 0.6, 1.8);
    const delta = -Math.round(base * 0.6 * over);
    const before = s.rating;
    const beforeTier = tierOf(before);

    s.streak = 0;
    if (s.placement > 0) {
      s.placement--;
      if (!s.placement) s.boost = BOOST_GAMES;
    } else {
      if (s.boost > 0) s.boost--;
      if (s.series) {
        s.series = null;
      }
      if (s.protect > 0) s.protect--;
    }

    s.rating = Math.max(0, s.rating + delta);
    s.peak = Math.max(s.peak || 0, s.rating);
    s.games = (s.games || 0) + 1;
    s.seasonGames = (s.seasonGames || 0) + 1;
    s.lastActive = Date.now();
    s.lastDecay = 0;
    if (!s.placement) s.seasonBest = Math.max(s.seasonBest || 0, s.rating);
    s.history.unshift({ t: Date.now(), d: delta, bonus: 0, streak: 0, diff, mode, win: false, why: 'abandon' });
    s.history = s.history.slice(0, 30);
    lad.lastDiff = diff;
    all.lastMode = mode;
    saveAll(all);

    try {
      localStorage.removeItem('sumdoku_ongoing_game');
      app?.dom?.btnHomeContinue?.classList.add('hidden');
      if (app) {
        app._rankDiff = diff;
        app._rankMode = mode;
        if (app.stats) {
          app.stats.totalGames = (app.stats.totalGames || 0) + 1;
          app.stats.currentStreak = 0;
          if (app.stats.byDiff && app.stats.byDiff[diff]) {
            app.stats.byDiff[diff].trackedGames = (app.stats.byDiff[diff].trackedGames || 0) + 1;
            app.stats.byDiff[diff].currentStreak = 0;
          }
          app.saveStats?.();
        }
        if (app.currentView === 'game' && !app.isDaily && !app.isBattle) {
          app.resultReason = 'forfeit';
          app._ratedGameId = app._ratingToken;
          app.stopTimer?.();
        }
      }
    } catch (_) {}

    const after = s.rating;
    const afterTier = tierOf(after);
    try {
      app?.renderRatingCard?.();
      app?.updateHeaderRankBadge?.();
      syncQueueSelector(app);
    } catch (_) {}

    const label = `${diffName(diff)} (${modeName(mode)})`;
    const toastMsg = qt('abandonToast')
      .replace('{0}', label)
      .replace('{1}', String(delta))
      .replace('{2}', before.toLocaleString())
      .replace('{3}', after.toLocaleString());
    try {
      app?.sound?.play?.('error');
      app?.showToast?.(toastMsg, 3600);
    } catch (_) {}

    return { mode, diff, delta, before, after, beforeTier, afterTier };
  }

  function showAbandonWarningModal(app, st, onConfirm) {
    const info = previewAbandonPenalty(st);
    if (!info) {
      if (typeof onConfirm === 'function') onConfirm();
      return;
    }
    document.getElementById('modal-abandon-confirm')?.remove();
    const mins = String(Math.floor((info.timerSeconds || 0) / 60)).padStart(2, '0');
    const secs = String((info.timerSeconds || 0) % 60).padStart(2, '0');
    const modal = document.createElement('div');
    modal.id = 'modal-abandon-confirm';
    modal.className = 'modal-backdrop abandon-modal-backdrop';
    modal.style.setProperty('--tier', info.beforeTier.color || '#ef4444');
    const streakTag = info.streak >= 1 ? `<span class="am-streak-loss">🔥 ${info.streak} → 0 (${qt('abandonStreakReset')})</span>` : '';

    modal.innerHTML =
      `<div class="modal-card abandon-modal-card" role="dialog" aria-modal="true" aria-labelledby="abandon-modal-title">` +
      `  <div class="am-header">` +
      `    <h3 id="abandon-modal-title" class="am-title">${qt('abandonTitle')}</h3>` +
      `  </div>` +
      `  <div class="am-match-box">` +
      `    <div class="am-emblem">${tierSymbol(info.beforeTier.id, 46, info.beforeTier.division)}</div>` +
      `    <div class="am-match-info">` +
      `      <div class="am-match-title">${diffName(info.diff)} · ${modeName(info.mode)}</div>` +
      `      <div class="am-match-sub">${info.beforeTier.name} · ⏱️ ${mins}:${secs}</div>` +
      `    </div>` +
      `  </div>` +
      `  <div class="am-penalty-box">` +
      `    <div class="am-penalty-row">` +
      `      <span class="am-penalty-lbl">${qt('abandonPenaltyLbl')}</span>` +
      `      <strong class="am-penalty-val">${info.delta} RP</strong>` +
      `    </div>` +
      `    <div class="am-rp-flow">` +
      `      <span>${info.before.toLocaleString()} RP</span>` +
      `      <span class="am-arrow">➔</span>` +
      `      <strong class="am-rp-after">${info.after.toLocaleString()} RP (${info.afterTier.name})</strong>` +
      `    </div>` +
      `    ${streakTag}` +
      `  </div>` +
      `  <p class="am-desc">${qt('abandonDesc')}</p>` +
      `  <p class="am-daily-note">${qt('abandonDailyNote')}</p>` +
      `  <div class="am-actions">` +
      `    <button type="button" class="btn btn-primary am-btn-resume" data-abandon-resume>${qt('abandonBtnResume')}</button>` +
      `    <button type="button" class="btn am-btn-forfeit" data-abandon-confirm>${qt('abandonBtnConfirm').replace('{0}', String(info.delta))}</button>` +
      `    <button type="button" class="btn btn-secondary am-btn-cancel" data-abandon-cancel>${qt('abandonBtnCancel')}</button>` +
      `  </div>` +
      `</div>`;

    (document.getElementById('app') || document.body).append(modal);
    const close = () => modal.remove();

    modal.querySelector('[data-abandon-cancel]').addEventListener('click', () => {
      try { app?.sound?.play('click'); } catch (_) {}
      close();
    });
    modal.querySelector('[data-abandon-resume]').addEventListener('click', () => {
      try { app?.sound?.play('click'); } catch (_) {}
      close();
      app?.dom?.modalDiff?.classList.add('hidden');
      app?.dom?.modalSettings?.classList.add('hidden');
      app?.restoreOngoingGame?.();
    });
    modal.querySelector('[data-abandon-confirm]').addEventListener('click', () => {
      close();
      applyAbandonPenalty(app, st);
      if (typeof onConfirm === 'function') onConfirm();
    });
    modal.addEventListener('click', e => {
      if (e.target === modal) close();
    });
  }

  // v2.1.0: 싱글플레이는 순수 힐링 모드로 운영되므로 난이도 모달의 큐 선택기 및 미니 티어 배지를 제거합니다.
  function ensureQueueSelector(app) {
    try {
      document.getElementById('rank-queue-box')?.remove();
      document.querySelectorAll('#modal-difficulty .diff-tier-mini').forEach(el => el.remove());
      if (app) app.isRanked = false;
    } catch (_) {}
  }

  function syncQueueSelector(app) {
    try {
      document.getElementById('rank-queue-box')?.remove();
      document.querySelectorAll('#modal-difficulty .diff-tier-mini').forEach(el => el.remove());
      if (app) app.isRanked = false;
    } catch (_) {}
  }

  // 게임 상단 서브 헤더: 싱글플레이에서는 랭크 배지를 숨깁니다.
  p.updateHeaderRankBadge = function () {
    const badge = document.getElementById('game-rank-hud-badge');
    if (badge) badge.classList.add('hidden');
  };

  // recordGameEnd 에서 싱글플레이는 랭크 변화를 건너뜁니다.
  const rankedRecord = p.recordGameEnd;
  p.recordGameEnd = function (isWin, ...rest) {
    this.isRanked = false;
    this.lastRatingChange = null;
    const prevToken = this._ratingToken;
    this._ratingToken = null;
    try { return rankedRecord.call(this, isWin, ...rest); }
    finally { this._ratingToken = prevToken; }
  };

  // openDifficultyModal, startNewGame, saveOngoingGame, restoreOngoingGame, updateModeDisplay, handleBackKey 훅 연결
  const origBackKey = p.handleBackKey;
  if (origBackKey) {
    p.handleBackKey = function (...a) {
      const m = document.getElementById('modal-abandon-confirm');
      if (m) {
        m.remove();
        return 'handled';
      }
      return origBackKey.apply(this, a);
    };
  }
  const origOpenDiff = p.openDifficultyModal;
  if (origOpenDiff) {
    p.openDifficultyModal = function (...a) {
      const r = origOpenDiff.apply(this, a);
      try { ensureQueueSelector(this); } catch (_) {}
      return r;
    };
  }
  const origStartNew = p.startNewGame;
  if (origStartNew) {
    p.startNewGame = function (diff, customRng, mode, existingPuzzle, ...rest) {
      // 모달의 큐 선택 버튼이 있으면 그 상태를 우선 반영하고, 없으면 기존 isRanked(기본 true)를 유지
      const activeQ = document.querySelector('#rank-queue-box .rq-btn.active');
      if (this.isDaily) {
        this.isRanked = true;
      } else if (activeQ) {
        this.isRanked = activeQ.dataset.queue !== 'normal';
      } else if (this.isRanked === undefined) {
        this.isRanked = true;
      }
      const r = origStartNew.call(this, diff, customRng, mode, existingPuzzle, ...rest);
      Promise.resolve(r).then(() => {
        try {
          if (!this.isDaily && !this.isBattle && this.gameMode !== 'battle') this.saveOngoingGame?.();
          this.updateHeaderRankBadge?.();
        } catch (_) {}
      });
      try { this.updateHeaderRankBadge?.(); } catch (_) {}
      return r;
    };
  }
  const origUpdateMode = p.updateModeDisplay;
  if (origUpdateMode) {
    p.updateModeDisplay = function (...a) {
      const r = origUpdateMode.apply(this, a);
      try { this.updateHeaderRankBadge?.(); } catch (_) {}
      return r;
    };
  }
  const origSaveOngoing = p.saveOngoingGame;
  if (origSaveOngoing) {
    p.saveOngoingGame = function (...a) {
      const r = origSaveOngoing.apply(this, a);
      try {
        if (!this.isDaily && this.currentView === 'game' && !this.isBattle) {
          const raw = localStorage.getItem('sumdoku_ongoing_game');
          if (raw) {
            const st = JSON.parse(raw);
            st.isRanked = this.isRanked !== false;
            localStorage.setItem('sumdoku_ongoing_game', JSON.stringify(st));
          }
        }
      } catch (_) {}
      return r;
    };
  }
  const origRestoreOngoing = p.restoreOngoingGame;
  if (origRestoreOngoing) {
    p.restoreOngoingGame = function (savedState, ...rest) {
      let st = savedState;
      if (!st) { try { st = JSON.parse(localStorage.getItem('sumdoku_ongoing_game')); } catch (_) {} }
      if (st && st.isRanked !== undefined) this.isRanked = !!st.isRanked;
      else this.isRanked = true;
      const r = origRestoreOngoing.call(this, savedState, ...rest);
      try { this.updateHeaderRankBadge?.(); } catch (_) {}
      return r;
    };
  }

  function bindAbandonGuards() {
    const btnHomeNew = document.getElementById('btn-home-new');
    if (btnHomeNew && !btnHomeNew._abandonBound) {
      btnHomeNew._abandonBound = true;
      btnHomeNew.addEventListener('click', e => {
        const app = window.app;
        const st = getAbandonableOngoingGame(app);
        if (!st) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        try { app?.sound?.play('error'); } catch (_) {}
        showAbandonWarningModal(app, st, () => {
          app?.openDifficultyModal?.();
        });
      }, true);
    }

    const btnSettingsRestart = document.getElementById('btn-settings-restart');
    if (btnSettingsRestart && !btnSettingsRestart._abandonBound) {
      btnSettingsRestart._abandonBound = true;
      btnSettingsRestart.addEventListener('click', e => {
        const app = window.app;
        const st = getAbandonableOngoingGame(app);
        if (!st) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        try { app?.sound?.play('error'); } catch (_) {}
        app?.dom?.modalSettings?.classList.add('hidden');
        showAbandonWarningModal(app, st, () => {
          app?.openDifficultyModal?.();
        });
      }, true);
    }

    const btnDiffStart = document.getElementById('btn-diff-start');
    if (btnDiffStart && !btnDiffStart._abandonBound) {
      btnDiffStart._abandonBound = true;
      btnDiffStart.addEventListener('click', e => {
        const app = window.app;
        const st = getAbandonableOngoingGame(app);
        if (!st) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        try { app?.sound?.play('error'); } catch (_) {}
        showAbandonWarningModal(app, st, () => {
          btnDiffStart.click();
        });
      }, true);
    }
  }

  const initQueueUI = () => {
    try {
      ensureQueueSelector(window.app);
      bindAbandonGuards();
      window.app?.updateHeaderRankBadge?.();
    } catch (_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initQueueUI); else initQueueUI();

  // 언어가 바뀌면 다시 그립니다.
  new MutationObserver(() => {
    window.app?.renderRatingCard?.();
    syncQueueSelector(window.app);
    window.app?.updateHeaderRankBadge?.();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.SumdokuRating = {
    shownTier, bestTierIndex, rewardTierIndex, PLACEMENT, UNRANKED, tierSymbol, playPromotion, promoSound,
    load, loadAll, saveAll, ladder, tierOf, applyDecay, computeDelta, RP_MULT, streakBonus, taExpected, TA_WEIGHT,
    TIERS, KEY, DIFFS, MODES,
    getAbandonableOngoingGame, previewAbandonPenalty, applyAbandonPenalty, showAbandonWarningModal,
    computeBattleDelta, recordBattleEnd
  };
})();
