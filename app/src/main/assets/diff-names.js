/* v1.1.19 · 난이도 이름 단일 기준표
 * i18n.js(Easy)와 translations-extra.js(Beginner (Easy), Advanced (Hard))가 서로 다르게 번역해
 * 화면마다 난이도 이름이 달라지던 문제를 없앱니다. 모든 언어에서 괄호 없이 같은 이름을 씁니다. */
(() => {
  const langs = ['ko','en','ja','zh','zh-TW','es','fr','de'];
  const N = {
    easy:    ['초급','Easy','初級','初级','初級','Fácil','Facile','Leicht'],
    medium:  ['중급','Medium','中級','中级','中級','Medio','Moyen','Mittel'],
    hard:    ['고급','Hard','上級','高级','高級','Difícil','Difficile','Schwer'],
    expert:  ['전문가','Expert','エキスパート','专家','專家','Experto','Expert','Experte'],
    lunatic: ['루나틱','Lunatic','ルナティック','疯狂','瘋狂','Lunático','Lunatique','Wahnsinnig']
  };
  const H = {
    easy:    ['8개 확정 앵커','8 fixed anchors','確定アンカー8個','8个确定锚点','8個確定錨點','8 anclas fijas','8 ancres fixes','8 feste Anker'],
    medium:  ['6개 확정 앵커','6 fixed anchors','確定アンカー6個','6个确定锚点','6個確定錨點','6 anclas fijas','6 ancres fixes','6 feste Anker'],
    hard:    ['4~5개 확정 앵커','4–5 fixed anchors','確定アンカー4〜5個','4~5个确定锚点','4~5個確定錨點','4–5 anclas fijas','4–5 ancres fixes','4–5 feste Anker'],
    expert:  ['★ 0~2개 확정','★ 0–2 fixed','★ 確定0〜2個','★ 0~2个确定','★ 0~2個確定','★ 0–2 fijas','★ 0–2 fixes','★ 0–2 feste'],
    lunatic: ['★ 0개 앵커 + 합계 비공개','★ 0 anchors + hidden sums','★ アンカー0 + 合計非公開','★ 0锚点 + 隐藏和','★ 0錨點 + 隱藏和','★ 0 anclas + sumas ocultas','★ 0 ancre + sommes cachées','★ 0 Anker + verdeckte Summen']
  };
  const LD = ['0개 앵커 + 일부 케이지 합계 생략 · 극상의 100% 순수 연역 논리','No anchors and some cage sums hidden · still 100% pure deduction','アンカーなし・一部ケージの合計を非公開 · それでも100%論理で解けます','无锚点且部分笼子隐藏和 · 仍可100%纯逻辑解出','無錨點且部分籠子隱藏和 · 仍可100%純邏輯解出','Sin anclas y con algunas sumas ocultas · 100% deducción pura','Sans ancre, certaines sommes cachées · 100 % déduction pure','Ohne Anker, einige Summen verdeckt · 100 % reine Logik'];
  const STAT = ['난이도별 최단 기록 (5단계)','Best times by difficulty (5 levels)','難易度別ベスト記録（5段階）','各难度最佳记录（5级）','各難度最佳紀錄（5級）','Mejores tiempos por dificultad (5 niveles)','Meilleurs temps par difficulté (5 niveaux)','Bestzeiten nach Schwierigkeit (5 Stufen)'];
  const D = window.I18N && I18N.dictionaries, T = window.UI_TRANSLATIONS = window.UI_TRANSLATIONS || {};
  langs.forEach((l, i) => {
    const d = D && (D[l] ||= {});
    for (const k in N) {
      const ko = N[k][0], name = N[k][i];
      if (d) { d['diff_' + k] = name; d['diff_' + k + '_title'] = name; d['diff_' + k + '_hint'] = H[k][i]; }
      if (l !== 'ko') { const t = (T[l] ||= {}); t[ko] = name; t[`${ko} (${N[k][1]})`] = name; t[H[k][0]] = H[k][i]; }
    }
    if (d) { d.diff_lunatic_desc = LD[i]; d.stats_diff_records_title = STAT[i]; }
    if (l !== 'ko') { T[l][LD[0]] = LD[i]; T[l][STAT[0]] = STAT[i]; T[l]['루나틱 정복자'] = ['','Lunatic Conqueror','ルナティック制覇','疯狂征服者','瘋狂征服者','Conquistador lunático','Conquérant lunatique','Wahnsinns-Bezwinger'][i]; T[l]['합계 비공개 케이지'] = ['','Hidden-sum cage','合計非公開ケージ','隐藏和笼子','隱藏和籠子','Jaula sin suma','Cage sans somme','Käfig ohne Summe'][i]; }
  });
  window.SumdokuDiffNames = N;
})();
