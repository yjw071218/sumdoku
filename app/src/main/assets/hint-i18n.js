/* v1.1.18 · 힌트·리플레이·생성 과정처럼 실행 중에 만들어지는 문장의 번역
 *
 * 왜 따로 만들었나:
 *   기존 번역은 "{0} … {1}" 형태의 사전 패턴으로 글자 덩어리를 바꿉니다. 힌트 문장은 칸 위치·숫자·
 *   한국어 조사(이/가, 을/를 …)가 문장 곳곳에 섞여 있어서, 느슨한 패턴이 문장을 엉뚱한 곳에서 잘라
 *   "There is already 3, 6열에 4·6이 to 9행 like Row 9 Column 6." 같은 반쪽 번역이 나왔습니다.
 *
 * 방식:
 *   문장 구조마다 규칙 하나(정규식 + 7개 언어 출력)를 둡니다. 문장 안의 부품은 종류별로 번역합니다.
 *     P  칸 위치 "3행 5열"      → R3C5 (모든 언어 공통 표기)
 *     U  영역 "3행/5열/2번 박스/합 15 케이지/45의 법칙(…)" → 언어별 이름
 *     N·L·E·T 숫자·숫자 목록·계산식·시간 → 그대로
 *     X  다른 문장 → 이 번역기로 다시(재귀), 실패하면 기존 사전
 *     UL·PL·PV·PC·PO·XS 목록 → 항목별 번역 후 언어별 구분자로 연결
 *   localize-ui.js 가 사전보다 먼저 이 함수를 부르고, 맞는 규칙이 없으면 기존 사전 번역을 씁니다.
 *   위치는 스도쿠 표기 관례인 RnCm 을 써서 어느 언어에서나 짧고 같은 의미로 읽히게 했습니다.
 */
(() => {
  const LANGS = ['en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const L7 = (en, ja, zh, tw, es, fr, de) => ({ en, ja, zh, 'zh-TW': tw, es, fr, de });

  /* ---------- 부품 번역 ---------- */
  const pos = (s, lang) => {
    const m = /^(\d)행 (\d)열$/.exec(s.trim());
    if (!m) return null;
    const r = m[1], c = m[2];
    if (lang === 'ja') return `${r}行${c}列`;
    if (lang === 'zh' || lang === 'zh-TW') return `第${r}行第${c}列`;
    return `R${r}C${c}`;
  };
  const DIFF = { '초급': L7('Easy', '初級', '初级', '初級', 'Fácil', 'Facile', 'Leicht'), '중급': L7('Medium', '中級', '中级', '中級', 'Medio', 'Moyen', 'Mittel'),
    '고급': L7('Hard', '上級', '高级', '高級', 'Difícil', 'Difficile', 'Schwer'), '전문가': L7('Expert', 'エキスパート', '专家', '專家', 'Experto', 'Expert', 'Experte'),
    '루나틱': L7('Lunatic', 'ルナティック', '狂乱', '狂亂', 'Lunático', 'Lunatique', 'Wahnsinn') };
  const unit = (s, lang) => {
    s = s.trim(); let m;
    if ((m = /^(\d)행$/.exec(s))) return L7(`row ${m[1]}`, `${m[1]}行`, `第${m[1]}行`, `第${m[1]}行`, `la fila ${m[1]}`, `la ligne ${m[1]}`, `Zeile ${m[1]}`)[lang];
    if ((m = /^(\d)열$/.exec(s))) return L7(`column ${m[1]}`, `${m[1]}列`, `第${m[1]}列`, `第${m[1]}欄`, `la columna ${m[1]}`, `la colonne ${m[1]}`, `Spalte ${m[1]}`)[lang];
    if ((m = /^(\d)번 박스$/.exec(s))) return L7(`box ${m[1]}`, `ボックス${m[1]}`, `第${m[1]}宫`, `第${m[1]}宮`, `la caja ${m[1]}`, `le bloc ${m[1]}`, `Block ${m[1]}`)[lang];
    if ((m = /^합 (\d+) 케이지$/.exec(s))) return L7(`the ${m[1]}-cage`, `合計${m[1]}のケージ`, `和为${m[1]}的笼子`, `和為${m[1]}的籠子`, `la jaula de ${m[1]}`, `la cage de ${m[1]}`, `Käfig (Summe ${m[1]})`)[lang];
    if ((m = /^45의 법칙\((.+?)( 바깥)?\)$/.exec(s))) {
      const inner = m[1].split('+').map(x => unit(x, lang) || x).join(' + ');
      const out = m[2] ? L7(`outside ${inner}`, `${inner}の外`, `${inner}之外`, `${inner}之外`, `fuera de ${inner}`, `hors de ${inner}`, `außerhalb ${inner}`)[lang] : inner;
      return L7(`Rule of 45 (${out})`, `45の法則（${out}）`, `45法则（${out}）`, `45法則（${out}）`, `regla del 45 (${out})`, `règle du 45 (${out})`, `45er-Regel (${out})`)[lang];
    }
    if ((m = /^(.+?) \(합 (\d+)\)$/.exec(s)) && m[1].includes(' + ')) {
      const inner = m[1].split(' + ').map(x => unit(x, lang) || x).join(' + ');
      return L7(`${inner} (sum ${m[2]})`, `${inner}（合計${m[2]}）`, `${inner}（和${m[2]}）`, `${inner}（和${m[2]}）`, `${inner} (suma ${m[2]})`, `${inner} (somme ${m[2]})`, `${inner} (Summe ${m[2]})`)[lang];
    }
    return null;
  };
  const SEP = L7(', ', '、', '，', '，', ', ', ', ', ', ');
  const list = (s, sep, f) => { const parts = s.split(sep).map(f); return parts.some(x => x == null) ? null : parts; };

  const TYPES = {
    P: { re: String.raw`\d행 \d열`, tr: (s, l) => pos(s, l) },
    PS: { re: String.raw`\d행 \d열(?:, \d행 \d열)*`, tr: (s, l) => (list(s, ', ', x => pos(x, l)) || []).join(SEP[l]) },
    PP: { re: String.raw`\d행 \d열(?: \+ \d행 \d열)*`, tr: (s, l) => (list(s, ' + ', x => pos(x, l)) || []).join(' + ') },
    U: { re: String.raw`(?:45의 법칙\([^)]*\)|합 \d+ 케이지|\d+번 박스|(?:\d행|\d열|\d+번 박스)(?: \+ (?:\d행|\d열|\d+번 박스))+ \(합 \d+\)|\d행|\d열)`, tr: (s, l) => unit(s, l) },
    N: { re: String.raw`-?\d[\d,]*`, tr: s => s },
    L: { re: String.raw`\d+(?:[·+]\d+)*`, tr: s => s },
    LS: { re: String.raw`\d+(?:\+\d+)*(?:, \d+(?:\+\d+)*)*(?: 등)?`, tr: s => s.replace(/ 등$/, ' …') },
    E: { re: String.raw`-?\d+(?: [+−\-] \d+)*(?: = -?\d+)?`, tr: s => s },
    T: { re: String.raw`\d+:\d\d`, tr: s => s },
    D: { re: String.raw`초급|중급|고급|전문가|루나틱`, tr: (s, l) => DIFF[s]?.[l] || s },
    X: { re: String.raw`.+?`, tr: (s, l) => sub(s, l) },
    XS: { re: String.raw`.+?`, tr: (s, l) => s.split(' / ').map(x => sub(x, l)).join(' / ') },
    // "3행에 1·2, 2번 박스에 5" → 항목별
    UL: { re: String.raw`.+?`, tr: (s, l) => {
      const items = list(s, ', ', it => { const m = /^(.+)에 (\d+(?:·\d+)*)$/.exec(it); const u = m && unit(m[1], l); return u ? [u, m[2]] : null; });
      if (!items) return null;
      return items.map(([u, d]) => L7(`${d} in ${u}`, `${u}に${d}`, `${u}已有${d}`, `${u}已有${d}`, `${d} en ${u}`, `${d} dans ${u}`, `${d} in ${u}`)[l]).join(SEP[l]);
    } },
    // "3행 1열의 4, 7행 6열의 6"
    PL: { re: String.raw`.+?`, tr: (s, l) => {
      const items = list(s, ', ', it => { const m = /^(\d행 \d열)의 (\d+)$/.exec(it); return m ? [pos(m[1], l), m[2]] : null; });
      if (!items) return null;
      return items.map(([p, d]) => L7(`${d} at ${p}`, `${p}の${d}`, `${p}的${d}`, `${p}的${d}`, `${d} en ${p}`, `${d} en ${p}`, `${d} in ${p}`)[l]).join(SEP[l]);
    } },
    // "3행 1열=4, 7행 6열=6"
    PV: { re: String.raw`.+?`, tr: (s, l) => { const items = list(s, ', ', it => { const m = /^(\d행 \d열)=(\d+)$/.exec(it); return m ? `${pos(m[1], l)}=${m[2]}` : null; }); return items ? items.join(SEP[l]) : null; } },
    // "1행 3열: 1·2·3, 1행 4열: 3·5"
    PC: { re: String.raw`.+?`, tr: (s, l) => { const items = list(s, ', ', it => { const m = /^(\d행 \d열): ([\d·]+)$/.exec(it); return m ? `${pos(m[1], l)}: ${m[2]}` : null; }); return items ? items.join(SEP[l]) : null; } },
    // "1행 3열, 1행 4열(밖)"
    PO: { re: String.raw`\d행 \d열(?:\(밖\))?(?:, \d행 \d열(?:\(밖\))?)*`, tr: (s, l) => s.split(', ').map(it => {
      const out = /\(밖\)$/.test(it); const p = pos(it.replace(/\(밖\)$/, ''), l);
      return out ? p + L7(' (outside)', '（外）', '（外）', '（外）', ' (fuera)', ' (hors)', ' (außen)')[l] : p;
    }).join(SEP[l]) },
    // 리플레이 결과 꼬리 "✓ 정답 확정)" 등
    RT: { re: String.raw`.*`, tr: (s, l) => {
      if (!s) return '';
      if (/^❌ 오답 \(실수\)\)$/.test(s)) return L7('❌ wrong (mistake))', '❌ 不正解（ミス）)', '❌ 错误（失误）)', '❌ 錯誤（失誤）)', '❌ incorrecto (error))', '❌ faux (erreur))', '❌ falsch (Fehler))')[l];
      if (/^✓ 정답 확정\)$/.test(s)) return L7('✓ correct)', '✓ 正解)', '✓ 正确)', '✓ 正確)', '✓ correcto)', '✓ correct)', '✓ richtig)')[l];
      return null;
    } }
  };

  TYPES.LV = { re: String.raw`기본 추론|쌍·교차 후보|45의 법칙 조합|45의 법칙|케이지 조합`, tr: (s, l) => dict(s, l) };
  TYPES.UP = { re: String.raw`[A-Z]+`, tr: s => s };
  TYPES.VER = { re: String.raw`[\d.]+`, tr: s => s };
  // 콜론 앞이 위치 목록이나 영역 이름인 일반 "X: 설명"
  TYPES.UX = { re: String.raw`(?:\d행 \d열(?:, \d행 \d열)*|45의 법칙\([^)]*\)|합 \d+ 케이지|\d+번 박스|\d행|\d열)`, tr: (s, l) => (/행 \d열/.test(s) ? TYPES.PS.tr(s, l) : unit(s, l)) };

  const ALREADY = L7('[[(already has $1) ]]', '[[（すでに$1あり）]]', '[[（已有$1）]]', '[[（已有$1）]]', '[[(ya tiene $1) ]]', '[[(contient déjà $1) ]]', '[[(enthält bereits $1) ]]');
  const withAlready = (fmt) => Object.fromEntries(LANGS.map(l => [l, fmt[l].replace('{A}', ALREADY[l])]));

  /* ---------- 규칙 ---------- */
  const rules = [];
  // pattern: 토큰 {P} 등을 넣은 정규식 문자열(^$ 자동). out: 7개 언어 템플릿($1… 은 토큰 순서). [[…]] 는 안의 $n 이 모두 비어 있지 않을 때만 출력.
  const R = (pattern, out) => {
    const types = [];
    const re = pattern.replace(/\{([A-Z]+)\}/g, (_, t) => { types.push(t); return `(${TYPES[t].re})`; });
    rules.push({ re: new RegExp(`^${re}$`), types, out });
  };

  // 가상 케이지 설명 뒤에 붙는 소거 이유도 각각 번역합니다.
  R(String.raw`45의 법칙: {U}에서 케이지 밖 빈칸 {PP} = {E}: {X}`, L7('Rule of 45: in $1, $2 = $3: $4','45の法則：$1で$2 = $3：$4','45法则：$1中$2 = $3：$4','45法則：$1中$2 = $3：$4','Regla del 45: en $1, $2 = $3: $4','Règle du 45 : dans $1, $2 = $3 : $4','45er-Regel: In $1 gilt $2 = $3: $4'));
  // 결론·기본
  R(String.raw`→ {P}[은는] {N}입니다\.`, L7('→ $1 is $2.', '→ $1は$2です。', '→ $1是$2。', '→ $1是$2。', '→ $1 es $2.', '→ $1 vaut $2.', '→ $1 ist $2.'));
  R(String.raw`{P}[은는] {N}입니다\.`, L7('$1 is $2.', '$1は$2です。', '$1是$2。', '$1是$2。', '$1 es $2.', '$1 vaut $2.', '$1 ist $2.'));
  R(String.raw`{P}`, L7('$1', '$1', '$1', '$1', '$1', '$1', '$1'));
  R(String.raw`남는 숫자는 {N}뿐입니다\.`, L7('The only digit left is $1.', '残る数字は$1だけです。', '只剩下数字$1。', '只剩下數字$1。', 'Solo queda el $1.', 'Il ne reste que le $1.', 'Übrig bleibt nur die $1.'));
  R(String.raw`{P}과 같은 {UL}[이가] 이미 있습니다\.`, L7('$1 already sees $2.', '$1と同じ$2がすでにあります。', '$1所在的$2。', '$1所在的$2。', '$1 ya ve $2.', '$1 voit déjà $2.', '$1 sieht bereits $2.'));
  R(String.raw`케이지 합 {N}`, L7('Cage sum $1', 'ケージ合計 $1', '笼子和 $1', '籠子和 $1', 'Suma de jaula $1', 'Somme de cage $1', 'Käfigsumme $1'));

  // 케이지 조합
  R(String.raw`{U}의 가능한 조합에 없는 숫자 {L} 제외`, L7('Eliminate $2: not in any possible combination of $1', '$1の可能な組み合わせにない数字$2を除外', '排除$2：不在$1的任何可能组合中', '排除$2：不在$1的任何可能組合中', 'Se descarta $2: no está en ninguna combinación posible de $1', 'On élimine $2 : absent de toutes les combinaisons possibles de $1', '$2 entfällt: in keiner möglichen Kombination von $1'));
  R(String.raw`{U}이므로 가능한 조합은 {LS}뿐 → {L} 제외`, L7('In $1 the only possible combinations are now $2 → eliminate $3', '$1なので可能な組み合わせは$2だけ → $3を除外', '$1因此可能组合仅为$2 → 排除$3', '$1因此可能組合僅為$2 → 排除$3', 'En $1 las únicas combinaciones posibles son $2 → se descarta $3', 'Dans $1, les seules combinaisons possibles sont $2 → on élimine $3', 'In $1 sind nur noch die Kombinationen $2 möglich → $3 entfällt'));
  R(String.raw`{U}의 가능한 조합은 이제 {LS}뿐이므로 {L} 제외`, L7('$1 can now only be $2, so eliminate $3', '$1の可能な組み合わせは$2だけになったので$3を除外', '$1现在只能是$2，因此排除$3', '$1現在只能是$2，因此排除$3', '$1 ahora solo puede ser $2, así que se descarta $3', '$1 ne peut plus être que $2, on élimine donc $3', '$1 kann nur noch $2 sein, daher entfällt $3'));
  R(String.raw`45의 법칙: {U}에서 케이지 밖 빈칸 {PP} = {E}이므로 가능한 조합은 {LS}뿐 → {L} 제외`, L7('Rule of 45: in $1 the empty cells outside cages $2 = $3, so only $4 is possible → eliminate $5', '45の法則：$1でケージ外の空きマス$2 = $3なので、可能な組み合わせは$4だけ → $5を除外', '45法则：$1中笼外空格$2 = $3，因此只可能是$4 → 排除$5', '45法則：$1中籠外空格$2 = $3，因此只可能是$4 → 排除$5', 'Regla del 45: en $1 las celdas vacías fuera de jaulas $2 = $3, así que solo cabe $4 → se descarta $5', 'Règle du 45 : dans $1, les cases vides hors cages $2 = $3, donc seul $4 est possible → on élimine $5', '45er-Regel: In $1 gilt für die leeren Zellen außerhalb der Käfige $2 = $3, also nur $4 möglich → $5 entfällt'));
  R(String.raw`45의 법칙: {U}에서 케이지 밖 빈칸 {PP} = {E}`, L7('Rule of 45: in $1 the empty cells outside cages $2 = $3', '45の法則：$1でケージ外の空きマス$2 = $3', '45法则：$1中笼外空格$2 = $3', '45法則：$1中籠外空格$2 = $3', 'Regla del 45: en $1 las celdas vacías fuera de jaulas $2 = $3', 'Règle du 45 : dans $1, les cases vides hors cages $2 = $3', '45er-Regel: In $1 gilt für die leeren Zellen außerhalb der Käfige $2 = $3'));
  R(String.raw`{N}[을를] 넣으면 {P}이 {N}(?:이어야|여야) 하는데 그 칸에 {N}[은는] 올 수 없음`, L7('with $1 here, $2 would have to be $3, but $4 can\'t go there', '$1を入れると$2が$3でなければならないが、そのマスに$4は入らない', '若填$1，$2必须是$3，但该格不能填$4', '若填$1，$2必須是$3，但該格不能填$4', 'con $1 aquí, $2 tendría que ser $3, pero ahí no cabe $4', 'avec $1 ici, $2 devrait valoir $3, mais $4 n\'y est pas possible', 'mit $1 hier müsste $2 eine $3 sein, die dort nicht stehen kann'));
  R(String.raw`{N}[을를] 넣으면 나머지 칸을 합 {N}(?:으로|로) 채울 수 없음`, L7('with $1 here, the remaining cells can\'t sum to $2', '$1を入れると残りのマスで合計$2を作れない', '若填$1，其余格无法凑出和$2', '若填$1，其餘格無法湊出和$2', 'con $1 aquí, el resto no puede sumar $2', 'avec $1 ici, le reste ne peut pas faire $2', 'mit $1 hier kann der Rest nicht $2 ergeben'));
  R(String.raw`{N}[을를] 넣으면 {U}의 나머지 칸을 합 {N}(?:으로|로) 채울 수 없음`, L7('with $1 here, the rest of $2 can\'t add up to $3', '$1を入れると$2の残りのマスで合計$3を作れない', '若填$1，$2其余格无法凑出和$3', '若填$1，$2其餘格無法湊出和$3', 'con $1 aquí, el resto de $2 no puede sumar $3', 'avec $1 ici, le reste de $2 ne peut pas faire $3', 'mit $1 hier kann der Rest von $2 nicht $3 ergeben'));
  R(String.raw`{U}의 가능한 조합에는 모두 {N}[이가] 들어갑니다\.`, L7('Every possible combination of $1 contains $2.', '$1の可能な組み合わせにはすべて$2が入ります。', '$1的所有可能组合都包含$2。', '$1的所有可能組合都包含$2。', 'Todas las combinaciones posibles de $1 contienen el $2.', 'Toutes les combinaisons possibles de $1 contiennent le $2.', 'Alle möglichen Kombinationen von $1 enthalten die $2.'));
  R(String.raw`{U}\(이미 {L} 있음\): 빈 {N}칸의 합 {N}, 가능한 조합 {LS}`, L7('$1 (already has $2): $3 empty cells sum to $4, possible combinations $5', '$1（すでに$2あり）：空き$3マスの合計$4、可能な組み合わせ$5', '$1（已有$2）：$3个空格之和为$4，可能组合$5', '$1（已有$2）：$3個空格之和為$4，可能組合$5', '$1 (ya tiene $2): $3 celdas vacías suman $4, combinaciones posibles $5', '$1 (contient déjà $2) : $3 cases vides font $4, combinaisons possibles $5', '$1 (enthält bereits $2): $3 leere Zellen ergeben $4, mögliche Kombinationen $5'));
  R(String.raw`{U}: 빈 {N}칸의 합 {N}, 가능한 조합 {LS}`, L7('$1: $2 empty cells sum to $3, possible combinations $4', '$1：空き$2マスの合計$3、可能な組み合わせ$4', '$1：$2个空格之和为$3，可能组合$4', '$1：$2個空格之和為$3，可能組合$4', '$1: $2 celdas vacías suman $3, combinaciones posibles $4', '$1 : $2 cases vides font $3, combinaisons possibles $4', '$1: $2 leere Zellen ergeben $3, mögliche Kombinationen $4'));

  // 숨은 싱글
  R(String.raw`{PS}: 같은 {U}에 이미 {N}[이가] 있음`, L7('$1: $2 already has $3', '$1：同じ$2にすでに$3がある', '$1：同一$2中已有$3', '$1：同一$2中已有$3', '$1: ya hay un $3 en $2', '$1 : il y a déjà un $3 dans $2', '$1: $2 enthält bereits eine $3'));
  R(String.raw`{PS}: {N}번 이유로 {N} 제외`, L7('$1: eliminate $3 (reason $2)', '$1：理由$2により$3を除外', '$1：根据第$2条理由排除$3', '$1：根據第$2條理由排除$3', '$1: se descarta $3 (motivo $2)', '$1 : on élimine $3 (raison $2)', '$1: $3 entfällt (Grund $2)'));
  R(String.raw`{U}에서 {N}[이가] 들어갈 수 있는 곳은 {P}뿐입니다\.`, L7('In $1, $2 can only go in $3.', '$1で$2が入れるのは$3だけです。', '$1中$2只能填在$3。', '$1中$2只能填在$3。', 'En $1, el $2 solo puede ir en $3.', 'Dans $1, le $2 ne peut aller qu\'en $3.', 'In $1 kann die $2 nur in $3 stehen.'));
  R(String.raw`{U}에서 {N}[이가] 남는 자리는 {P}뿐입니다\.`, L7('In $1, the only spot left for $2 is $3.', '$1で$2が残る場所は$3だけです。', '$1中$2唯一剩下的位置是$3。', '$1中$2唯一剩下的位置是$3。', 'En $1, el único sitio que queda para el $2 es $3.', 'Dans $1, la seule place restante pour le $2 est $3.', 'In $1 bleibt für die $2 nur $3.'));

  // 1단계 · 45의 법칙
  R(String.raw`{U}에서 비어 있는 칸은 {P} 하나뿐입니다\.`, L7('The only empty cell in $1 is $2.', '$1の空きマスは$2だけです。', '$1中唯一的空格是$2。', '$1中唯一的空格是$2。', 'La única celda vacía de $1 es $2.', 'La seule case vide de $1 est $2.', 'Die einzige leere Zelle in $1 ist $2.'));
  R(String.raw`합 {N}에서 이미 놓인 {E}[을를] 빼면 {N}입니다\.`, L7('Subtract the placed $2 from $1 to get $3.', '合計$1からすでに置かれた$2を引くと$3です。', '从和$1中减去已填的$2，得$3。', '從和$1中減去已填的$2，得$3。', 'Restando a $1 lo ya colocado ($2) queda $3.', 'En retirant de $1 ce qui est déjà placé ($2), il reste $3.', 'Zieht man die gesetzten $2 von $1 ab, bleibt $3.'));
  R(String.raw`한 칸짜리 케이지이므로 그 칸의 숫자는 합과 같은 {N}입니다\.`, L7('It\'s a one-cell cage, so the cell equals its sum: $1.', '1マスのケージなので、そのマスは合計と同じ$1です。', '这是单格笼子，该格等于其和：$1。', '這是單格籠子，該格等於其和：$1。', 'Es una jaula de una celda, así que vale su suma: $1.', 'C\'est une cage d\'une case : elle vaut sa somme, $1.', 'Es ist ein Käfig aus einer Zelle, also gleich seiner Summe: $1.'));
  R(String.raw`{U}의 숫자 합은 1부터 9까지 더한 45입니다\.`, L7('The digits in $1 add up to 1+…+9 = 45.', '$1の数字の合計は1から9までを足した45です。', '$1的数字之和为1到9相加的45。', '$1的數字之和為1到9相加的45。', 'Los dígitos de $1 suman 1+…+9 = 45.', 'Les chiffres de $1 font 1+…+9 = 45.', 'Die Ziffern in $1 ergeben 1+…+9 = 45.'));
  R(String.raw`{U}의 숫자 합은 45입니다\.`, L7('The digits in $1 add up to 45.', '$1の数字の合計は45です。', '$1的数字之和为45。', '$1的數字之和為45。', 'Los dígitos de $1 suman 45.', 'Les chiffres de $1 font 45.', 'Die Ziffern in $1 ergeben 45.'));
  R(String.raw`{U} 안에 완전히 들어 있는 케이지의 합: {E}`, L7('Sum of the cages fully inside $1: $2', '$1に完全に含まれるケージの合計：$2', '完全位于$1内的笼子之和：$2', '完全位於$1內的籠子之和：$2', 'Suma de las jaulas totalmente dentro de $1: $2', 'Somme des cages entièrement dans $1 : $2', 'Summe der Käfige ganz in $1: $2'));
  R(String.raw`케이지 밖의 나머지 칸 중 {PV}은 이미 놓여 있고, 빈칸은 {P} 하나입니다\.`, L7('Outside the cages, $1 are already placed and the only empty cell is $2.', 'ケージ外の残りのマスのうち$1はすでに置かれていて、空きマスは$2だけです。', '笼外其余格中$1已填，唯一的空格是$2。', '籠外其餘格中$1已填，唯一的空格是$2。', 'Fuera de las jaulas, $1 ya están colocados y la única celda vacía es $2.', 'Hors des cages, $1 sont déjà placés et la seule case vide est $2.', 'Außerhalb der Käfige stehen schon $1, die einzige leere Zelle ist $2.'));
  R(String.raw`케이지 밖에 남는 칸은 {P} 하나입니다\.`, L7('The only cell left outside the cages is $1.', 'ケージ外に残るマスは$1だけです。', '笼外唯一剩下的格是$1。', '籠外唯一剩下的格是$1。', 'La única celda fuera de las jaulas es $1.', 'La seule case hors des cages est $1.', 'Die einzige Zelle außerhalb der Käfige ist $1.'));
  R(String.raw`{U}에 걸친 케이지를 모두 더하면 {E}, 케이지 밖 숫자 {L}까지 더하면 {N}입니다\.`, L7('All cages touching $1 add up to $2; with the digits outside cages ($3) it is $4.', '$1にかかるケージをすべて足すと$2、ケージ外の数字$3も足すと$4です。', '与$1相交的所有笼子之和为$2，加上笼外数字$3为$4。', '與$1相交的所有籠子之和為$2，加上籠外數字$3為$4。', 'Todas las jaulas que tocan $1 suman $2; con los dígitos fuera de jaulas ($3) es $4.', 'Toutes les cages touchant $1 font $2 ; avec les chiffres hors cages ($3), $4.', 'Alle Käfige, die $1 berühren, ergeben $2; mit den Ziffern außerhalb ($3) sind es $4.'));
  R(String.raw`{U}에 걸친 케이지를 모두 더하면 {E}입니다\.`, L7('All cages touching $1 add up to $2.', '$1にかかるケージをすべて足すと$2です。', '与$1相交的所有笼子之和为$2。', '與$1相交的所有籠子之和為$2。', 'Todas las jaulas que tocan $1 suman $2.', 'Toutes les cages touchant $1 font $2.', 'Alle Käfige, die $1 berühren, ergeben $2.'));
  R(String.raw`45를 넘는 {N}[은는] {U} 밖으로 튀어나온 칸의 합이고, 그중 빈칸은 {P} 하나입니다\.`, L7('The excess $1 over 45 is the sum of the cells sticking out of $2, and the only empty one is $3.', '45を超える$1は$2の外にはみ出たマスの合計で、そのうち空きマスは$3だけです。', '超出45的$1是伸出$2之外的格之和，其中唯一的空格是$3。', '超出45的$1是伸出$2之外的格之和，其中唯一的空格是$3。', 'El exceso de $1 sobre 45 es la suma de las celdas que sobresalen de $2, y la única vacía es $3.', 'L\'excédent de $1 au-delà de 45 est la somme des cases qui dépassent de $2, et la seule vide est $3.', 'Der Überschuss $1 über 45 ist die Summe der Zellen, die aus $2 herausragen; die einzige leere ist $3.'));
  R(String.raw`따라서 {P} = (.+)`.replace('(.+)', '{X}'), L7('So $1 = $2', 'したがって$1 = $2', '因此$1 = $2', '因此$1 = $2', 'Por tanto, $1 = $2', 'Donc $1 = $2', 'Also $1 = $2'));
  R(String.raw`{P} = {X}`, L7('$1 = $2', '$1 = $2', '$1 = $2', '$1 = $2', '$1 = $2', '$1 = $2', '$1 = $2'));

  // 쌍 · 교차
  R(String.raw`{U} 조합과 주변 숫자를 보면 {P}·{P}에는 {L}만 올 수 있으므로 {U}의 다른 칸에서 {L} 제외`, L7('From the combinations of $1 and nearby digits, $2·$3 can only hold $4, so eliminate $6 from the other cells of $5', '$1の組み合わせと周りの数字から、$2·$3には$4しか入らないので、$5の他のマスから$6を除外', '根据$1的组合和周围数字，$2·$3只能是$4，因此从$5的其他格排除$6', '根據$1的組合和周圍數字，$2·$3只能是$4，因此從$5的其他格排除$6', 'Por las combinaciones de $1 y los dígitos cercanos, $2·$3 solo pueden ser $4, así que se descarta $6 del resto de $5', 'D\'après les combinaisons de $1 et les chiffres voisins, $2·$3 ne peuvent être que $4 : on élimine $6 du reste de $5', 'Aus den Kombinationen von $1 und den Nachbarziffern können $2·$3 nur $4 sein, daher entfällt $6 im Rest von $5'));
  R(String.raw`{P}·{P}에는 {L}만 올 수 있으므로 {U}의 다른 칸에서 {L} 제외`, L7('$1·$2 can only hold $3, so eliminate $5 from the other cells of $4', '$1·$2には$3しか入らないので、$4の他のマスから$5を除外', '$1·$2只能是$3，因此从$4的其他格排除$5', '$1·$2只能是$3，因此從$4的其他格排除$5', '$1·$2 solo pueden ser $3, así que se descarta $5 del resto de $4', '$1·$2 ne peuvent être que $3 : on élimine $5 du reste de $4', '$1·$2 können nur $3 sein, daher entfällt $5 im Rest von $4'));
  R(String.raw`{U}의 {N}[이가] {U} 위의 칸\({PS}\)에만 올 수 있으므로 {U}의 나머지 칸에서 {N} 제외`, L7('The $2 of $1 can only be in cells on $3 ($4), so eliminate $6 from the rest of $5', '$1の$2は$3上のマス（$4）にしか入らないので、$5の残りのマスから$6を除外', '$1的$2只能在$3上的格（$4），因此从$5其余格排除$6', '$1的$2只能在$3上的格（$4），因此從$5其餘格排除$6', 'El $2 de $1 solo puede estar en celdas de $3 ($4), así que se descarta $6 del resto de $5', 'Le $2 de $1 ne peut être que sur $3 ($4) : on élimine $6 du reste de $5', 'Die $2 von $1 kann nur auf $3 stehen ($4), daher entfällt $6 im Rest von $5'));

  // "자세히"
  R(String.raw`{N}: {P}에 있음 \(같은 {U}\)`, L7('$1: at $2 (in $3)', '$1：$2にある（同じ$3）', '$1：在$2（同一$3）', '$1：在$2（同一$3）', '$1: en $2 (en $3)', '$1 : en $2 (dans $3)', '$1: in $2 (in $3)'));
  R(String.raw`{P}: {L} 제외 — 같은 {U}에 이미 있음 \({PL}\)`, L7('$1: eliminate $2 — already in $3 ($4)', '$1：$2を除外 — 同じ$3にすでにある（$4）', '$1：排除$2 — 同一$3中已有（$4）', '$1：排除$2 — 同一$3中已有（$4）', '$1: se descarta $2 — ya está en $3 ($4)', '$1 : on élimine $2 — déjà dans $3 ($4)', '$1: $2 entfällt — schon in $3 ($4)'));
  R(String.raw`{P}: {L} 제외 — {X}`, L7('$1: eliminate $2 — $3', '$1：$2を除外 — $3', '$1：排除$2 — $3', '$1：排除$2 — $3', '$1: se descarta $2 — $3', '$1 : on élimine $2 — $3', '$1: $2 entfällt — $3'));
  R(String.raw`{P}에 남는 후보는 {N} 하나입니다\.`, L7('The only candidate left in $1 is $2.', '$1に残る候補は$2だけです。', '$1唯一剩下的候选数是$2。', '$1唯一剩下的候選數是$2。', 'El único candidato que queda en $1 es $2.', 'Le seul candidat restant en $1 est $2.', 'In $1 bleibt nur der Kandidat $2.'));
  R(String.raw`{X}: 빈 {N}칸의 합 {N} \(이미 {L} 있음\), 서로 다른 숫자 조합 {N}가지`, L7('$1: $2 empty cells summing to $3 (already has $4), $5 combinations of distinct digits', '$1：空き$2マスの合計$3（すでに$4あり）、異なる数字の組み合わせ$5通り', '$1：$2个空格之和为$3（已有$4），不同数字的组合共$5种', '$1：$2個空格之和為$3（已有$4），不同數字的組合共$5種', '$1: $2 celdas vacías que suman $3 (ya tiene $4), $5 combinaciones de dígitos distintos', '$1 : $2 cases vides faisant $3 (contient déjà $4), $5 combinaisons de chiffres distincts', '$1: $2 leere Zellen mit Summe $3 (enthält bereits $4), $5 Kombinationen verschiedener Ziffern'));
  R(String.raw`{X}: 빈 {N}칸의 합 {N}, 서로 다른 숫자 조합 {N}가지`, L7('$1: $2 empty cells summing to $3, $4 combinations of distinct digits', '$1：空き$2マスの合計$3、異なる数字の組み合わせ$4通り', '$1：$2个空格之和为$3，不同数字的组合共$4种', '$1：$2個空格之和為$3，不同數字的組合共$4種', '$1: $2 celdas vacías que suman $3, $4 combinaciones de dígitos distintos', '$1 : $2 cases vides faisant $3, $4 combinaisons de chiffres distincts', '$1: $2 leere Zellen mit Summe $3, $4 Kombinationen verschiedener Ziffern'));
  R(String.raw`✗ {L} — {N}[이가] 들어갈 빈칸이 없음 \({XS}\)`, L7('✗ $1 — no empty cell can take $2 ($3)', '✗ $1 — $2が入る空きマスがない（$3）', '✗ $1 — 没有空格能填$2（$3）', '✗ $1 — 沒有空格能填$2（$3）', '✗ $1 — ninguna celda vacía admite el $2 ($3)', '✗ $1 — aucune case vide ne peut recevoir le $2 ($3)', '✗ $1 — keine leere Zelle kann die $2 aufnehmen ($3)'));
  R(String.raw`✗ {L} — {N}[이가] 들어갈 빈칸이 없음`, L7('✗ $1 — no empty cell can take $2', '✗ $1 — $2が入る空きマスがない', '✗ $1 — 没有空格能填$2', '✗ $1 — 沒有空格能填$2', '✗ $1 — ninguna celda vacía admite el $2', '✗ $1 — aucune case vide ne peut recevoir le $2', '✗ $1 — keine leere Zelle kann die $2 aufnehmen'));
  R(String.raw`✗ {L} — 각 칸의 남은 후보로는 한 칸에 하나씩 배치할 수 없음 \({PC}\)`, L7('✗ $1 — can\'t place one digit per cell with the remaining candidates ($2)', '✗ $1 — 各マスの残りの候補では1マスに1つずつ配置できない（$2）', '✗ $1 — 用各格剩余候选数无法一格一个地放下（$2）', '✗ $1 — 用各格剩餘候選數無法一格一個地放下（$2）', '✗ $1 — con los candidatos restantes no se puede poner un dígito por celda ($2)', '✗ $1 — impossible de placer un chiffre par case avec les candidats restants ($2)', '✗ $1 — mit den übrigen Kandidaten nicht eine Ziffer pro Zelle verteilbar ($2)'));
  R(String.raw`… 외 {N}가지`, L7('… and $1 more', '… ほか$1通り', '… 另有$1种', '… 另有$1種', '… y $1 más', '… et $1 de plus', '… und $1 weitere'));
  R(String.raw`{P}: 이미 {N}`, L7('$1: already $2', '$1：すでに$2', '$1：已是$2', '$1：已是$2', '$1: ya es $2', '$1 : déjà $2', '$1: bereits $2'));
  R(String.raw`{P}: {N} 불가`, L7('$1: $2 not possible', '$1：$2は不可', '$1：不能是$2', '$1：不能是$2', '$1: $2 imposible', '$1 : $2 impossible', '$1: $2 unmöglich'));
  R(String.raw`{N}번 단계: {X}`, L7('Step $1: $2', '手順$1：$2', '第$1步：$2', '第$1步：$2', 'Paso $1: $2', 'Étape $1 : $2', 'Schritt $1: $2'));
  R(String.raw`두 칸이 {L}[을를] 나눠 가지므로 {U}의 다른 칸에는 {L}[이가] 올 수 없습니다\.`, L7('The two cells share $1, so $3 can\'t go anywhere else in $2.', '2つのマスが$1を分け合うので、$2の他のマスには$3が入りません。', '两格分占$1，所以$2的其他格不能填$3。', '兩格分占$1，所以$2的其他格不能填$3。', 'Las dos celdas se reparten $1, así que $3 no cabe en el resto de $2.', 'Les deux cases se partagent $1 : $3 ne peut aller ailleurs dans $2.', 'Die zwei Zellen teilen sich $1, daher kann $3 sonst nirgends in $2 stehen.'));
  R(String.raw`그래서 {U}의 {N}[이가] {PS} 중 하나에 들어가고, 이 칸들은 모두 {U}에 있습니다\.`, L7('So the $2 of $1 goes in one of $3, and all of these cells are in $4.', 'そのため$1の$2は$3のどれかに入り、これらのマスはすべて$4にあります。', '因此$1的$2位于$3之一，而这些格都在$4中。', '因此$1的$2位於$3之一，而這些格都在$4中。', 'Así que el $2 de $1 va en una de $3, y todas esas celdas están en $4.', 'Le $2 de $1 va donc dans l\'une de $3, toutes situées dans $4.', 'Die $2 von $1 steht also in einer von $3, und alle diese Zellen liegen in $4.'));
  R(String.raw`위의 가능한 조합에 모두 {N}[이가] 있으므로 이 케이지 어딘가에 {N}[이가] 반드시 들어갑니다\.`, L7('Every combination above contains $1, so $2 must go somewhere in this cage.', '上の可能な組み合わせすべてに$1があるので、このケージのどこかに必ず$2が入ります。', '上面所有可能组合都含$1，所以这个笼子里一定有$2。', '上面所有可能組合都含$1，所以這個籠子裡一定有$2。', 'Todas las combinaciones de arriba contienen el $1, así que el $2 va en algún lugar de esta jaula.', 'Toutes les combinaisons ci-dessus contiennent le $1 : le $2 est forcément dans cette cage.', 'Alle Kombinationen oben enthalten die $1, also steht die $2 sicher irgendwo in diesem Käfig.'));
  R(String.raw`{U}: {PO}`, L7('$1: $2', '$1：$2', '$1：$2', '$1：$2', '$1: $2', '$1 : $2', '$1: $2'));
  R(String.raw`합계 {E}`, L7('Total $1', '合計 $1', '合计 $1', '合計 $1', 'Total $1', 'Total $1', 'Summe $1'));
  R(String.raw`{P} = {N} \(케이지 밖, 이미 놓임\)`, L7('$1 = $2 (outside cages, already placed)', '$1 = $2（ケージ外、配置済み）', '$1 = $2（笼外，已填）', '$1 = $2（籠外，已填）', '$1 = $2 (fuera de jaulas, ya colocado)', '$1 = $2 (hors cages, déjà placé)', '$1 = $2 (außerhalb, bereits gesetzt)'));
  R(String.raw`{P}: 케이지 밖 빈칸`, L7('$1: empty cell outside cages', '$1：ケージ外の空きマス', '$1：笼外空格', '$1：籠外空格', '$1: celda vacía fuera de jaulas', '$1 : case vide hors cages', '$1: leere Zelle außerhalb der Käfige'));
  R(String.raw`{L} 메모 추가 필요`, L7('add memo $1', 'メモ$1を追加', '需补充笔记$1', '需補充筆記$1', 'añade la nota $1', 'ajoutez la note $1', 'Notiz $1 ergänzen'));
  R(String.raw`같은 {U}의 {P}에 이미 {N}[이가] 있음`, L7('$2 in $1 already has $3', '同じ$1の$2にすでに$3がある', '同一$1的$2已有$3', '同一$1的$2已有$3', '$2 en $1 ya tiene un $3', '$2 dans $1 contient déjà un $3', '$2 in $1 enthält bereits eine $3'));
  R(String.raw`같은 {U}에 이미 {N}[이가] 있음`, L7('$1 already has $2', '同じ$1にすでに$2がある', '同一$1中已有$2', '同一$1中已有$2', 'ya hay un $2 en $1', 'il y a déjà un $2 dans $1', '$1 enthält bereits eine $2'));

  // 힌트가 항상 나오도록 한 경로(hint-fallback.js)
  R(String.raw`{P}의 {N}[은는] 같은 {U}의 {PS}에 있는 {N}[과와] 겹칩니다\.`, L7('The $2 at $1 clashes with the $5 at $4 in $3.', '$1の$2は同じ$3の$4にある$5と重なります。', '$1的$2与同一$3中$4的$5重复。', '$1的$2與同一$3中$4的$5重複。', 'El $2 de $1 choca con el $5 de $4 en $3.', 'Le $2 en $1 entre en conflit avec le $5 en $4 dans $3.', 'Die $2 in $1 kollidiert mit der $5 in $4 in $3.'));
  R(String.raw`{U}에 놓인 숫자의 합이 {E}로 이미 {N}[을를] 넘습니다\.`, L7('The digits placed in $1 add up to $2, already over $3.', '$1に置かれた数字の合計が$2で、すでに$3を超えています。', '$1中已填数字之和为$2，已超过$3。', '$1中已填數字之和為$2，已超過$3。', 'Los dígitos de $1 suman $2 y ya superan $3.', 'Les chiffres placés dans $1 font $2, déjà plus que $3.', 'Die Ziffern in $1 ergeben $2 und liegen schon über $3.'));
  R(String.raw`{U}에 놓인 숫자의 합이 {E}로 {N}[과와] 다릅니다\.`, L7('The digits placed in $1 add up to $2, which is not $3.', '$1に置かれた数字の合計が$2で、$3と異なります。', '$1中已填数字之和为$2，与$3不符。', '$1中已填數字之和為$2，與$3不符。', 'Los dígitos de $1 suman $2, que no es $3.', 'Les chiffres placés dans $1 font $2, et non $3.', 'Die Ziffern in $1 ergeben $2 statt $3.'));
  R(String.raw`{P}의 {N}[은는] 지금 당장 겹치는 숫자는 없지만, 이 숫자로는 판을 끝까지 채울 수 없습니다\(뒤에서 모순이 생깁니다\)\.`, L7('The $2 at $1 doesn\'t clash with anything yet, but the grid can\'t be completed with it (a contradiction appears later).', '$1の$2は今は重なる数字がありませんが、この数字では盤面を最後まで埋められません（後で矛盾が生じます）。', '$1的$2目前没有重复，但用它无法填完整个盘面（之后会出现矛盾）。', '$1的$2目前沒有重複，但用它無法填完整個盤面（之後會出現矛盾）。', 'El $2 de $1 aún no choca con nada, pero con él no se puede completar el tablero (más adelante aparece una contradicción).', 'Le $2 en $1 n\'entre encore en conflit avec rien, mais la grille ne peut pas être terminée avec lui (une contradiction apparaît ensuite).', 'Die $2 in $1 kollidiert noch mit nichts, aber damit lässt sich das Gitter nicht lösen (später entsteht ein Widerspruch).'));
  R(String.raw`{P}의 {N}[을를] 지우고 다시 생각해 봅니다\.`, L7('Remove the $2 at $1 and think again.', '$1の$2を消して考え直します。', '擦掉$1的$2，重新思考。', '擦掉$1的$2，重新思考。', 'Quita el $2 de $1 y vuelve a pensar.', 'Effacez le $2 en $1 et réfléchissez à nouveau.', 'Entferne die $2 in $1 und überlege neu.'));
  R(String.raw`이 칸의 올바른 숫자는 {N}입니다\.`, L7('The correct digit for this cell is $1.', 'このマスの正しい数字は$1です。', '该格的正确数字是$1。', '該格的正確數字是$1。', 'El dígito correcto de esta celda es $1.', 'Le bon chiffre pour cette case est $1.', 'Die richtige Ziffer für diese Zelle ist $1.'));
  R(String.raw`앞선 {N}단계의 후보 소거 \(자세히에서 모두 볼 수 있습니다\)`, L7('$1 earlier candidate eliminations (see all under Details)', '前の$1手順の候補消去（「詳しく」ですべて見られます）', '前面$1步的候选数排除（可在“详细”中查看全部）', '前面$1步的候選數排除（可在「詳細」中查看全部）', '$1 descartes de candidatos anteriores (verlos todos en Detalles)', '$1 éliminations de candidats précédentes (toutes visibles dans Détails)', '$1 frühere Kandidaten-Streichungen (alle unter Details)'));
  R(String.raw`{N}\) {X}`, L7('$1) $2', '$1) $2', '$1) $2', '$1) $2', '$1) $2', '$1) $2', '$1) $2'));
  R(String.raw`후보가 가장 적은 {P}의 후보는 {L}입니다\.`, L7('$1 has the fewest candidates: $2.', '候補が最も少ない$1の候補は$2です。', '候选数最少的$1的候选数是$2。', '候選數最少的$1的候選數是$2。', '$1 es la celda con menos candidatos: $2.', '$1 a le moins de candidats : $2.', '$1 hat die wenigsten Kandidaten: $2.'));
  R(String.raw`{P}의 정답은 {N}입니다\. 이 숫자를 넣으면 다른 칸의 추론이 이어집니다\.`, L7('The answer for $1 is $2. Placing it lets the deductions continue elsewhere.', '$1の正解は$2です。この数字を入れると他のマスの推論が続けられます。', '$1的答案是$2。填入后其他格的推理就能继续。', '$1的答案是$2。填入後其他格的推理就能繼續。', 'La respuesta de $1 es $2. Al colocarla, las deducciones continúan en otras celdas.', 'La réponse en $1 est $2. En la plaçant, les déductions reprennent ailleurs.', 'Die Lösung für $1 ist $2. Damit lassen sich andere Zellen weiter folgern.'));
  R(String.raw`{P}의 후보는 {L}입니다\.`, L7('Candidates of $1: $2.', '$1の候補は$2です。', '$1的候选数是$2。', '$1的候選數是$2。', 'Candidatos de $1: $2.', 'Candidats de $1 : $2.', 'Kandidaten von $1: $2.'));

  // 기존 전체 연역 엔진(deduction.js)의 이유 문장
  R(String.raw`{P} = {N} → {U}의 다른 칸에서 {N} 제외`, L7('$1 = $2 → eliminate $4 from the other cells of $3', '$1 = $2 → $3の他のマスから$4を除外', '$1 = $2 → 从$3的其他格排除$4', '$1 = $2 → 從$3的其他格排除$4', '$1 = $2 → se descarta $4 del resto de $3', '$1 = $2 → on élimine $4 du reste de $3', '$1 = $2 → $4 entfällt im Rest von $3'));
  R(String.raw`{PS}이 {L}를 나눠 가짐 → {U}의 다른 칸에서 제외`, L7('$1 share $2 → eliminate them from the other cells of $3', '$1が$2を分け合う → $3の他のマスから除外', '$1分占$2 → 从$3的其他格排除', '$1分占$2 → 從$3的其他格排除', '$1 se reparten $2 → se descartan del resto de $3', '$1 se partagent $2 → éliminés du reste de $3', '$1 teilen sich $2 → im Rest von $3 entfernt'));
  R(String.raw`{U}\({N}칸\): 들어갈 수 있는 숫자는 {L}뿐`, L7('$1 ($2 cells): only $3 can go in', '$1（$2マス）：入れられる数字は$3だけ', '$1（$2格）：只能填$3', '$1（$2格）：只能填$3', '$1 ($2 celdas): solo caben $3', '$1 ($2 cases) : seuls $3 sont possibles', '$1 ($2 Zellen): nur $3 möglich'));
  R(String.raw`{U}: {PS}의 합은 {N} → 범위를 벗어나는 후보 제외`, L7('$1: $2 sum to $3 → eliminate out-of-range candidates', '$1：$2の合計は$3 → 範囲外の候補を除外', '$1：$2之和为$3 → 排除超出范围的候选数', '$1：$2之和為$3 → 排除超出範圍的候選數', '$1: $2 suman $3 → se descartan los candidatos fuera de rango', '$1 : $2 font $3 → on élimine les candidats hors limites', '$1: $2 ergeben $3 → Kandidaten außerhalb des Bereichs entfallen'));
  R(String.raw`{U}: {PS}의 합이 {N}이 되는 배치만 남김`, L7('$1: keep only placements where $2 sum to $3', '$1：$2の合計が$3になる配置だけを残す', '$1：只保留$2之和为$3的排列', '$1：只保留$2之和為$3的排列', '$1: solo quedan las disposiciones en que $2 suman $3', '$1 : on ne garde que les placements où $2 font $3', '$1: nur Anordnungen behalten, in denen $2 $3 ergeben'));
  R(String.raw`{U}에서 {N}[이가] 갈 수 있는 곳은 {P}뿐`, L7('In $1, $2 can only go in $3', '$1で$2が入れるのは$3だけ', '$1中$2只能在$3', '$1中$2只能在$3', 'En $1, el $2 solo puede ir en $3', 'Dans $1, le $2 ne peut aller qu\'en $3', 'In $1 kann die $2 nur in $3 stehen'));
  R(String.raw`{U}의 {N}[은는] {U}과 겹치는 칸에만 있음 → {U} 나머지에서 {N} 제외`, L7('The $2 of $1 lies only where it overlaps $3 → eliminate $5 from the rest of $4', '$1の$2は$3と重なるマスにしかない → $4の残りから$5を除外', '$1的$2只在与$3重叠的格中 → 从$4其余格排除$5', '$1的$2只在與$3重疊的格中 → 從$4其餘格排除$5', 'El $2 de $1 solo está donde coincide con $3 → se descarta $5 del resto de $4', 'Le $2 de $1 n\'est que là où il croise $3 → on élimine $5 du reste de $4', 'Die $2 von $1 liegt nur in der Überschneidung mit $3 → $5 entfällt im Rest von $4'));
  R(String.raw`{U}의 {L}[은는] {PS}에만 들어감 → 이 칸들의 다른 후보 제외`, L7('$2 of $1 only go in $3 → eliminate the other candidates there', '$1の$2は$3にしか入らない → これらのマスの他の候補を除外', '$1的$2只能填在$3 → 排除这些格的其他候选数', '$1的$2只能填在$3 → 排除這些格的其他候選數', '$2 de $1 solo van en $3 → se descartan los demás candidatos allí', '$2 de $1 ne vont qu\'en $3 → on élimine leurs autres candidats', '$2 von $1 passen nur in $3 → übrige Kandidaten dort entfallen'));
  R(String.raw`\(앞선 {N}단계 생략\)`, L7('($1 earlier steps omitted)', '（前の$1手順は省略）', '（省略前面$1步）', '（省略前面$1步）', '($1 pasos anteriores omitidos)', '($1 étapes précédentes omises)', '($1 frühere Schritte ausgelassen)'));
  R(String.raw`이미 놓인 숫자\({X}\)를 같은 행·열·박스·케이지에서 지웁니다\.`, L7('Remove the placed digits ($1) from their rows, columns, boxes and cages.', '置かれた数字（$1）を同じ行・列・ボックス・ケージから消します。', '把已填数字（$1）从同行、列、宫、笼中排除。', '把已填數字（$1）從同行、列、宮、籠中排除。', 'Se quitan los dígitos colocados ($1) de sus filas, columnas, cajas y jaulas.', 'On retire les chiffres placés ($1) de leurs lignes, colonnes, blocs et cages.', 'Gesetzte Ziffern ($1) aus Zeilen, Spalten, Blöcken und Käfigen streichen.'));
  R(String.raw`(기본 추론|쌍·교차 후보|45의 법칙|45의 법칙 조합|케이지 조합) · {N}단계`.replace(/^\(([^)]*)\)/, '{LV}'), L7('$1 · $2 steps', '$1 · $2手順', '$1 · $2步', '$1 · $2步', '$1 · $2 pasos', '$1 · $2 étapes', '$1 · $2 Schritte'));

  // 리플레이
  R(String.raw`\[{T}\] \({N}행, {N}열\) 칸에 숫자 {N} 입력 \({RT}`, L7('[$1] (R$2C$3) entered $4 ($5', '[$1] ($2行$3列) $4を入力 ($5', '[$1] (第$2行第$3列) 填入$4 ($5', '[$1] (第$2行第$3列) 填入$4 ($5', '[$1] (R$2C$3) se introdujo $4 ($5', '[$1] (R$2C$3) saisie de $4 ($5', '[$1] (R$2C$3) $4 eingegeben ($5'));
  R(String.raw`\[{T}\] \({N}행, {N}열\) 칸에 메모 {N} 조작`, L7('[$1] (R$2C$3) toggled memo $4', '[$1] ($2行$3列) メモ$4を操作', '[$1] (第$2行第$3列) 切换笔记$4', '[$1] (第$2行第$3列) 切換筆記$4', '[$1] (R$2C$3) nota $4 cambiada', '[$1] (R$2C$3) note $4 modifiée', '[$1] (R$2C$3) Notiz $4 geändert'));
  R(String.raw`\[{T}\] \({N}행, {N}열\) 칸 숫자 지움`, L7('[$1] (R$2C$3) erased', '[$1] ($2行$3列) 数字を消去', '[$1] (第$2行第$3列) 擦除数字', '[$1] (第$2行第$3列) 擦除數字', '[$1] (R$2C$3) borrado', '[$1] (R$2C$3) effacé', '[$1] (R$2C$3) gelöscht'));
  R(String.raw`\[{T}\] \({N}행, {N}열\) \[힌트\]로 {N} 확정`, L7('[$1] (R$2C$3) $4 confirmed by [hint]', '[$1] ($2行$3列) [ヒント]で$4を確定', '[$1] (第$2行第$3列) 通过[提示]确定$4', '[$1] (第$2行第$3列) 透過[提示]確定$4', '[$1] (R$2C$3) $4 confirmado con [pista]', '[$1] (R$2C$3) $4 confirmé par [indice]', '[$1] (R$2C$3) $4 per [Tipp] bestätigt'));
  R(String.raw`정답 확정\)`, L7('correct)', '正解)', '正确)', '正確)', 'correcto)', 'correct)', 'richtig)'));
  R(String.raw`{N} / {N} 수`, L7('$1 / $2 moves', '$1 / $2 手', '$1 / $2 步', '$1 / $2 步', '$1 / $2 jugadas', '$1 / $2 coups', '$1 / $2 Züge'));
  R(String.raw`틀린 원인 · {P}에 {N}`, L7('Why it was wrong · $2 at $1', 'ミスの原因 · $1に$2', '错误原因 · $1填$2', '錯誤原因 · $1填$2', 'Por qué fue un error · $2 en $1', 'Pourquoi c\'était faux · $2 en $1', 'Warum es falsch war · $2 in $1'));
  R(String.raw`같은 {U}에 이미 {N}[이가] 있습니다 \({PS}\)\. \(그 {N}도 사실은 틀린 숫자였습니다\.\)`, L7('$1 already has a $2 ($3). (That $4 was itself a wrong digit.)', '同じ$1にすでに$2があります（$3）。（その$4も実は間違った数字でした。）', '同一$1中已有$2（$3）。（那个$4其实也是错的。）', '同一$1中已有$2（$3）。（那個$4其實也是錯的。）', 'Ya hay un $2 en $1 ($3). (Ese $4 también era incorrecto.)', 'Il y a déjà un $2 dans $1 ($3). (Ce $4 était lui-même faux.)', '$1 enthält bereits eine $2 ($3). (Diese $4 war selbst falsch.)'));
  R(String.raw`같은 {U}에 이미 {N}[이가] 있습니다 \({PS}\)\.`, L7('$1 already has a $2 ($3).', '同じ$1にすでに$2があります（$3）。', '同一$1中已有$2（$3）。', '同一$1中已有$2（$3）。', 'Ya hay un $2 en $1 ($3).', 'Il y a déjà un $2 dans $1 ($3).', '$1 enthält bereits eine $2 ($3).'));
  R(String.raw`(?:이미 {E}이 있는 )?합 {N} 케이지에 {N}[을를] 넣으면 {N}이 되어 합을 넘습니다\.`, withAlready(L7('Putting $3 in the $2-cage {A}makes $4, over the sum.', '合計$2のケージ{A}に$3を入れると$4になり、合計を超えます。', '在和为$2的笼子{A}里填$3会得到$4，超过总和。', '在和為$2的籠子{A}裡填$3會得到$4，超過總和。', 'Poner $3 en la jaula de $2 {A}da $4, más que la suma.', 'Mettre $3 dans la cage de $2 {A}donne $4, au-delà de la somme.', '$3 im Käfig (Summe $2) {A}ergibt $4 und überschreitet die Summe.')));
  R(String.raw`합 {N} 케이지의 마지막 칸인데, {N}[을를] 넣으면 합이 {N}이 되어 {N}과 맞지 않습니다\.`, L7('It\'s the last cell of the $1-cage, and $2 makes the total $3, not $4.', '合計$1のケージの最後のマスで、$2を入れると合計が$3になり$4と合いません。', '这是和为$1的笼子的最后一格，填$2后和为$3，不等于$4。', '這是和為$1的籠子的最後一格，填$2後和為$3，不等於$4。', 'Es la última celda de la jaula de $1, y con $2 el total es $3, no $4.', 'C\'est la dernière case de la cage de $1 : avec $2 le total fait $3, pas $4.', 'Das ist die letzte Zelle des Käfigs (Summe $1); mit $2 wird die Summe $3 statt $4.'));
  R(String.raw`(?:이미 {E}이 있는 )?합 {N} 케이지에 {N}[을를] 넣으면 합이 벌써 {N}이 되어, 남은 빈칸 {N}개에 넣을 숫자가 없습니다\.`, withAlready(L7('Putting $3 in the $2-cage {A}already makes $4, leaving nothing for the $5 empty cells.', '合計$2のケージ{A}に$3を入れると合計がもう$4になり、残り$5マスに入れる数字がありません。', '在和为$2的笼子{A}里填$3后和已是$4，剩下$5个空格无数可填。', '在和為$2的籠子{A}裡填$3後和已是$4，剩下$5個空格無數可填。', 'Poner $3 en la jaula de $2 {A}ya da $4, y no queda nada para las $5 celdas vacías.', 'Mettre $3 dans la cage de $2 {A}fait déjà $4 : il ne reste rien pour les $5 cases vides.', '$3 im Käfig (Summe $2) {A}ergibt schon $4, für die $5 leeren Zellen bleibt nichts.')));
  R(String.raw`(?:이미 {E}이 있는 )?합 {N} 케이지에 {N}[을를] 넣으면 남은 한 칸에 {N}[이가] 들어가야 하는데, 한 칸에는 1~9만 들어갑니다\.`, withAlready(L7('Putting $3 in the $2-cage {A}would need $4 in the last cell, but a cell only holds 1–9.', '合計$2のケージ{A}に$3を入れると残りの1マスに$4が必要ですが、1マスには1〜9しか入りません。', '在和为$2的笼子{A}里填$3，最后一格需填$4，但一格只能填1~9。', '在和為$2的籠子{A}裡填$3，最後一格需填$4，但一格只能填1~9。', 'Poner $3 en la jaula de $2 {A}exigiría $4 en la última celda, pero una celda solo admite 1–9.', 'Mettre $3 dans la cage de $2 {A}exigerait $4 dans la dernière case, or une case ne contient que 1 à 9.', '$3 im Käfig (Summe $2) {A}erfordert $4 in der letzten Zelle, eine Zelle fasst aber nur 1–9.')));
  R(String.raw`(?:이미 {E}이 있는 )?합 {N} 케이지에 {N}[을를] 넣으면 남은 한 칸에 {N}[이가] 들어가야 하는데, {N}[은는] 이미 이 케이지에 있습니다\.`, withAlready(L7('Putting $3 in the $2-cage {A}would need $4 in the last cell, but $5 is already in this cage.', '合計$2のケージ{A}に$3を入れると残りの1マスに$4が必要ですが、$5はすでにこのケージにあります。', '在和为$2的笼子{A}里填$3，最后一格需填$4，但$5已在这个笼子里。', '在和為$2的籠子{A}裡填$3，最後一格需填$4，但$5已在這個籠子裡。', 'Poner $3 en la jaula de $2 {A}exigiría $4 en la última celda, pero el $5 ya está en esta jaula.', 'Mettre $3 dans la cage de $2 {A}exigerait $4 dans la dernière case, mais $5 est déjà dans cette cage.', '$3 im Käfig (Summe $2) {A}erfordert $4 in der letzten Zelle, aber die $5 ist schon im Käfig.')));
  R(String.raw`(?:이미 {E}이 있는 )?합 {N} 케이지에 {N}[을를] 넣으면 남은 빈칸 {N}개의 합이 {N}이어야 하는데, 서로 다른 숫자로는 만들 수 없습니다(?: \(가능한 합 {N}~{N}\))?\.`, withAlready(L7('Putting $3 in the $2-cage {A}means the $4 empty cells must sum to $5, which distinct digits can\'t make[[ (possible: $6–$7)]].', '合計$2のケージ{A}に$3を入れると残り$4マスの合計が$5でなければなりませんが、異なる数字では作れません[[（可能な合計 $6〜$7）]]。', '在和为$2的笼子{A}里填$3，剩下$4个空格之和须为$5，但不同数字凑不出[[（可能的和 $6~$7）]]。', '在和為$2的籠子{A}裡填$3，剩下$4個空格之和須為$5，但不同數字湊不出[[（可能的和 $6~$7）]]。', 'Poner $3 en la jaula de $2 {A}obliga a que las $4 celdas vacías sumen $5, imposible con dígitos distintos[[ (posible: $6–$7)]].', 'Mettre $3 dans la cage de $2 {A}impose que les $4 cases vides fassent $5, impossible avec des chiffres distincts[[ (possible : $6–$7)]].', '$3 im Käfig (Summe $2) {A}verlangt, dass $4 leere Zellen $5 ergeben – mit verschiedenen Ziffern unmöglich[[ (möglich: $6–$7)]].')));
  R(String.raw`그때 판의 숫자와 케이지 조합으로 따지면 {P}에 올 수 있는 숫자는 {L}뿐이라 {N}[은는] 들어갈 수 없습니다\.`, L7('From the grid and cage combinations at that moment, $1 could only be $2, so $3 can\'t go there.', 'その時の盤面とケージの組み合わせから考えると、$1に入れられるのは$2だけなので$3は入りません。', '根据当时盘面和笼子组合，$1只能是$2，所以不能填$3。', '根據當時盤面和籠子組合，$1只能是$2，所以不能填$3。', 'Según el tablero y las combinaciones de jaulas de ese momento, $1 solo podía ser $2, así que $3 no cabe.', 'D\'après la grille et les combinaisons de cages à ce moment, $1 ne pouvait être que $2 : $3 n\'y va pas.', 'Nach Gitter und Käfigkombinationen zu diesem Zeitpunkt konnte $1 nur $2 sein, daher passt $3 nicht.'));
  R(String.raw`그 순간에는 같은 줄·박스·케이지에 겹치는 숫자가 없었지만, {N}[은는] 이 칸에 들어갈 수 없는 숫자였습니다\. 아래 풀이처럼 다른 칸을 채워 가면 이 칸은 {N}로 정해집니다\.`, L7('Nothing clashed in the same line, box or cage at that moment, but $1 can\'t go in this cell. Filling other cells as shown below fixes this cell as $2.', 'その時点では同じ列・ボックス・ケージに重なる数字はありませんでしたが、$1はこのマスに入らない数字でした。下の解き方のように他のマスを埋めていくと、このマスは$2に決まります。', '当时同一行列、宫、笼中没有重复，但$1不能填入此格。按下面的解法填其他格，此格会确定为$2。', '當時同一行列、宮、籠中沒有重複，但$1不能填入此格。按下面的解法填其他格，此格會確定為$2。', 'En ese momento nada chocaba en la misma línea, caja o jaula, pero el $1 no puede ir en esta celda. Rellenando otras celdas como se muestra abajo, esta celda queda en $2.', 'Rien n\'entrait en conflit à ce moment, mais $1 ne peut pas aller dans cette case. En remplissant d\'autres cases comme ci-dessous, elle vaut $2.', 'Zu diesem Zeitpunkt kollidierte nichts, aber die $1 passt nicht in diese Zelle. Füllt man andere Zellen wie unten, ergibt sich hier $2.'));
  R(String.raw`이 칸의 정답은 {N}입니다\. \(그때 남아 있던 후보: {L}\)`, L7('The answer for this cell is $1. (Candidates left then: $2)', 'このマスの正解は$1です。（その時残っていた候補：$2）', '该格的答案是$1。（当时剩余的候选数：$2）', '該格的答案是$1。（當時剩餘的候選數：$2）', 'La respuesta de esta celda es $1. (Candidatos que quedaban: $2)', 'La réponse pour cette case est $1. (Candidats restants alors : $2)', 'Die Lösung dieser Zelle ist $1. (Damals übrige Kandidaten: $2)'));
  R(String.raw`이 칸의 정답은 {N}입니다\.`, L7('The answer for this cell is $1.', 'このマスの正解は$1です。', '该格的答案是$1。', '該格的答案是$1。', 'La respuesta de esta celda es $1.', 'La réponse pour cette case est $1.', 'Die Lösung dieser Zelle ist $1.'));
  R(String.raw`정답 {N}[이가] 나오는 풀이 \(다른 {N}칸을 먼저 채운 뒤\)`, L7('How $1 is found (after filling $2 other cells first)', '正解$1が出る解き方（先に他の$2マスを埋めた後）', '得出答案$1的解法（先填好另外$2格后）', '得出答案$1的解法（先填好另外$2格後）', 'Cómo se llega al $1 (tras rellenar antes otras $2 celdas)', 'Comment trouver le $1 (après avoir rempli $2 autres cases)', 'So findet man die $1 (nachdem $2 andere Zellen gefüllt sind)'));
  R(String.raw`정답 {N}[이가] 나오는 풀이`, L7('How $1 is found', '正解$1が出る解き方', '得出答案$1的解法', '得出答案$1的解法', 'Cómo se llega al $1', 'Comment trouver le $1', 'So findet man die $1'));
  R(String.raw`\[{D}\] {X}`, L7('[$1] $2', '[$1] $2', '[$1] $2', '[$1] $2', '[$1] $2', '[$1] $2', '[$1] $2'));
  R(String.raw`{N}월 {N}일 {T} · 최종 {N}점 · 소요 {T} · 실수 {N}회`, L7('$1/$2 $3 · final $4 pts · time $5 · $6 mistake(s)', '$1月$2日 $3 · 最終 $4点 · 所要 $5 · ミス $6回', '$1月$2日 $3 · 最终 $4分 · 用时 $5 · 失误 $6次', '$1月$2日 $3 · 最終 $4分 · 用時 $5 · 失誤 $6次', '$2/$1 $3 · final $4 pts · tiempo $5 · $6 error(es)', '$2/$1 $3 · final $4 pts · durée $5 · $6 erreur(s)', '$2.$1. $3 · Endstand $4 Pkt. · Zeit $5 · $6 Fehler'));
  R(String.raw`{N}월 {N}일 퍼즐`, L7('Puzzle of $1/$2', '$1月$2日のパズル', '$1月$2日的谜题', '$1月$2日的謎題', 'Puzle del $2/$1', 'Grille du $2/$1', 'Rätsel vom $2.$1.'));

  // 생성 과정·도우미 등 앱 문장
  R(String.raw`남은 합계 {N}을\(를\) {N}개의 빈 칸에 채워야 합니다\.`, L7('The remaining sum $1 must fill $2 empty cells.', '残りの合計$1を$2個の空きマスで埋める必要があります。', '剩余和$1需要填入$2个空格。', '剩餘和$1需要填入$2個空格。', 'La suma restante $1 debe repartirse en $2 celdas vacías.', 'La somme restante $1 doit remplir $2 cases vides.', 'Die Restsumme $1 muss auf $2 leere Zellen verteilt werden.'));
  R(String.raw`{N}칸`, L7('$1 cells', '$1マス', '$1格', '$1格', '$1 celdas', '$1 cases', '$1 Zellen'));
  R(String.raw`{N}초`, L7('$1 s', '$1秒', '$1秒', '$1秒', '$1 s', '$1 s', '$1 s'));
  R(String.raw`{N}칸 \({N}개 영역\)`, L7('$1 cells ($2 areas)', '$1マス（$2領域）', '$1格（$2个区域）', '$1格（$2個區域）', '$1 celdas ($2 áreas)', '$1 cases ($2 zones)', '$1 Zellen ($2 Bereiche)'));
  R(String.raw`합계: {N} \({N}칸 · {N}영역\)`, L7('Total: $1 ($2 cells · $3 areas)', '合計：$1（$2マス · $3領域）', '合计：$1（$2格 · $3个区域）', '合計：$1（$2格 · $3個區域）', 'Total: $1 ($2 celdas · $3 áreas)', 'Total : $1 ($2 cases · $3 zones)', 'Summe: $1 ($2 Zellen · $3 Bereiche)'));
  R(String.raw`{N}칸 확정 앵커: 이 칸은 확정 {N}입니다\. 추론의 출발점으로 활용하세요!`, L7('$1-cell anchor: this cell is fixed at $2. Use it as a starting point!', '$1マス確定アンカー：このマスは$2で確定です。推論の出発点にしましょう！', '$1格确定锚点：此格确定为$2。可作为推理的起点！', '$1格確定錨點：此格確定為$2。可作為推理的起點！', 'Ancla de $1 celda: esta celda es $2. ¡Úsala como punto de partida!', 'Ancre d\'$1 case : cette case vaut $2. Servez-vous-en comme point de départ !', 'Anker mit $1 Zelle: Diese Zelle ist sicher $2. Nutze sie als Startpunkt!'));
  R(String.raw`케이지 {N}개 · 확정 {N}/{N}칸 · 컷트 {N}회`, L7('$1 cages · $2/$3 cells confirmed · $4 cuts', 'ケージ$1個 · 確定 $2/$3マス · カット$4回', '笼子$1个 · 已确定$2/$3格 · 剪枝$4次', '籠子$1個 · 已確定$2/$3格 · 剪枝$4次', '$1 jaulas · $2/$3 celdas confirmadas · $4 cortes', '$1 cages · $2/$3 cases confirmées · $4 coupes', '$1 Käfige · $2/$3 Zellen bestätigt · $4 Schnitte'));
  R(String.raw`케이지 {N}개 · 확정 {N}/{N}칸`, L7('$1 cages · $2/$3 cells confirmed', 'ケージ$1個 · 確定 $2/$3マス', '笼子$1个 · 已确定$2/$3格', '籠子$1個 · 已確定$2/$3格', '$1 jaulas · $2/$3 celdas confirmadas', '$1 cages · $2/$3 cases confirmées', '$1 Käfige · $2/$3 Zellen bestätigt'));
  R(String.raw`{N}단계: 인간 연역 추론 검증 완료! \({N}/{N}칸 확정\)`, L7('Step $1: human-style deduction check passed! ($2/$3 cells confirmed)', '手順$1：人間の演繹推論の検証完了！（$2/$3マス確定）', '第$1步：人类演绎推理验证完成！（已确定$2/$3格）', '第$1步：人類演繹推理驗證完成！（已確定$2/$3格）', 'Paso $1: ¡verificación por deducción humana completada! ($2/$3 celdas)', 'Étape $1 : vérification par déduction humaine réussie ! ($2/$3 cases)', 'Schritt $1: Prüfung per menschlicher Logik bestanden! ($2/$3 Zellen)'));
  R(String.raw`{N}\.{N} ➔ {N}단계 파이프라인으로 순수 연역 퍼즐을 생성합니다`, L7('$1.$2 ➔ Generating a pure-deduction puzzle with a $3-step pipeline', '$1.$2 ➔ $3段階のパイプラインで純粋な演繹パズルを生成します', '$1.$2 ➔ 用$3步流程生成纯演绎谜题', '$1.$2 ➔ 用$3步流程生成純演繹謎題', '$1.$2 ➔ Generando un puzle de deducción pura en $3 pasos', '$1.$2 ➔ Génération d\'une grille de pure déduction en $3 étapes', '$1.$2 ➔ Erzeuge ein reines Logikrätsel in $3 Schritten'));
  R(String.raw`{D} 연역 추론 맵 생성 중`, L7('Generating $1 deduction map', '$1の演繹推論マップを生成中', '正在生成$1演绎推理地图', '正在生成$1演繹推理地圖', 'Generando mapa de deducción $1', 'Génération de la carte de déduction $1', 'Erzeuge $1-Logikkarte'));
  R(String.raw`([A-Z]+) · 점수: {N} · {T}`.replace('([A-Z]+)', '{UP}'), L7('$1 · Score: $2 · $3', '$1 · スコア：$2 · $3', '$1 · 分数：$2 · $3', '$1 · 分數：$2 · $3', '$1 · Puntos: $2 · $3', '$1 · Score : $2 · $3', '$1 · Punkte: $2 · $3'));
  R(String.raw`현재 버전\(v{VER}\)이 최신입니다`, L7('Current version (v$1) is the latest', '現在のバージョン（v$1）が最新です', '当前版本（v$1）已是最新', '目前版本（v$1）已是最新', 'La versión actual (v$1) es la más reciente', 'La version actuelle (v$1) est la plus récente', 'Aktuelle Version (v$1) ist die neueste'));
  R(String.raw`목숨 \(최대 {N}\)`, L7('Lives (max $1)', 'ライフ（最大$1）', '生命（最多$1）', '生命（最多$1）', 'Vidas (máx. $1)', 'Vies (max $1)', 'Leben (max. $1)'));
  R(String.raw`힌트 \(최대 {N}\)`, L7('Hints (max $1)', 'ヒント（最大$1）', '提示（最多$1）', '提示（最多$1）', 'Pistas (máx. $1)', 'Indices (max $1)', 'Tipps (max. $1)'));
  R(String.raw`게임에서 허용할 목숨 개수를 직접 입력합니다 \(일반/배틀 공통, {N}~{N}회\)`, L7('Set how many lives a game allows (normal and battle, $1–$2)', 'ゲームで許すライフの数を入力します（通常/対戦共通、$1〜$2回）', '直接输入游戏允许的生命数（普通/对战通用，$1~$2次）', '直接輸入遊戲允許的生命數（一般/對戰通用，$1~$2次）', 'Indica cuántas vidas permite una partida (normal y duelo, $1–$2)', 'Nombre de vies autorisées par partie (normal et duel, $1–$2)', 'Anzahl der Leben pro Spiel festlegen (normal und Duell, $1–$2)'));
  R(String.raw`게임 시작 시 주어지는 힌트 개수를 직접 입력합니다 \(일반/배틀 공통, {N}~{N}개\)`, L7('Set how many hints a game starts with (normal and battle, $1–$2)', 'ゲーム開始時のヒント数を入力します（通常/対戦共通、$1〜$2個）', '直接输入开局提供的提示数（普通/对战通用，$1~$2个）', '直接輸入開局提供的提示數（一般/對戰通用，$1~$2個）', 'Indica cuántas pistas da la partida al empezar (normal y duelo, $1–$2)', 'Nombre d\'indices au début de la partie (normal et duel, $1–$2)', 'Anzahl der Tipps zu Spielbeginn festlegen (normal und Duell, $1–$2)'));
  R(String.raw`점수 감점 후 추가 사용 허용 \(-{N}점\)`, L7('Allow extra use with a penalty (-$1 pts)', '減点して追加使用を許可（-$1点）', '扣分后允许额外使用（-$1分）', '扣分後允許額外使用（-$1分）', 'Permitir uso extra con penalización (-$1 pts)', 'Autoriser un usage en plus avec pénalité (-$1 pts)', 'Zusätzliche Nutzung mit Abzug erlauben (-$1 Pkt.)'));
  R(String.raw`추가 사용 · 최대 {N}점 감점`, L7('Extra use · up to -$1 pts', '追加使用 · 最大$1点減点', '额外使用 · 最多扣$1分', '額外使用 · 最多扣$1分', 'Uso extra · hasta -$1 pts', 'Usage en plus · jusqu\'à -$1 pts', 'Zusätzlich · bis -$1 Pkt.'));
  R(String.raw`먼저 완성하면 \+{N}점 완주 보너스, 점수가 높은 플레이어 승리`, L7('Finish first for a +$1 bonus; the higher score wins', '先に完成すると+$1点の完走ボーナス、得点の高いプレイヤーの勝ち', '先完成获得+$1分完成奖励，得分高者获胜', '先完成獲得+$1分完成獎勵，得分高者獲勝', 'Termina primero para un bonus de +$1; gana la puntuación más alta', 'Finir en premier donne +$1 ; le meilleur score gagne', 'Wer zuerst fertig ist, erhält +$1; die höhere Punktzahl gewinnt'));
  R(String.raw`{X} ▾`, L7('$1 ▾', '$1 ▾', '$1 ▾', '$1 ▾', '$1 ▾', '$1 ▾', '$1 ▾'));
  R(String.raw`{UX}: {X}`, L7('$1: $2', '$1：$2', '$1：$2', '$1：$2', '$1: $2', '$1 : $2', '$1: $2'));

  for (const r of rules) if (r.types.some(t => !TYPES[t])) throw new Error('unknown token');

  /* ---------- 실행 ---------- */
  let depth = 0;
  const dict = (s, l) => (window.I18N && I18N.text && depth < 6 ? I18N.text(s, l) : s);
  const sub = (s, l) => {
    if (!/[가-힣]/.test(s)) return s;
    const t = translate(s, l);
    return t == null ? dict(s, l) : t;
  };
  const fill = (tpl, vals) => tpl
    .replace(/\[\[([\s\S]*?)\]\]/g, (_, inner) => { const ids = [...inner.matchAll(/\$(\d)/g)].map(m => +m[1]); return ids.every(i => vals[i - 1]) ? inner : ''; })
    .replace(/\$(\d)/g, (_, i) => vals[+i - 1] ?? '');
  const cap = (s, l) => (['en', 'es', 'fr', 'de'].includes(l) ? s.replace(/^(\s*(?:→\s*)?)(\p{Ll})/u, (_, a, b) => a + b.toUpperCase()) : s);

  function translate(s, lang) {
    if (!LANGS.includes(lang) || !/[가-힣]/.test(s)) return null;
    if (depth > 8) return null;
    depth++;
    try {
      for (const r of rules) {
        const m = r.re.exec(s);
        if (!m) continue;
        const vals = [];
        let ok = true;
        for (let i = 0; i < r.types.length; i++) {
          const v = m[i + 1];
          if (v === undefined) { vals.push(''); continue; }
          const out = TYPES[r.types[i]].tr(v, lang);
          if (out == null) { ok = false; break; }
          vals.push(out);
        }
        if (!ok) continue;
        const res = cap(fill(r.out[lang], vals), lang);
        if (/[가-힣]/.test(res)) continue; // 반쪽 번역은 내보내지 않음
        return res;
      }
      return null;
    } finally { depth--; }
  }

  window.SumdokuDynI18n = (s, lang) => translate(String(s).replace(/\s+/g, ' ').trim(), lang);
  window.SumdokuDynI18n.rules = rules.length;
})();
