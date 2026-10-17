/* v2.1.6 · 티어 보상 개편 — "모으고 싶고, 보여 주고 싶은" 컬렉션
 *
 * 1. 컬렉션 화면(랭킹 탭 › 티어 보상)
 *    - 수집 현황(n / 6), 다음 보상까지 진행 바와 남은 RP
 *    - 보상 카드: 희귀도(희귀·영웅·전설·신화) 색, 3×3 미니 보드 미리보기(잠긴 보상도 미리 볼 수 있음),
 *      보상 구성 목록, '상대에게 보임' 표시, 잠김이면 해금 조건과 남은 RP
 * 2. 보상 구성(상위 티어일수록 남에게 보이는 보상이 붙습니다)
 *    실버       은빛 보드 테두리 · 칭호
 *    골드       금빛 테두리 · 정답 입력 금빛 반짝임 · 칭호
 *    플래티넘   청록 테두리 · 케이지 완성 파동 · 칭호
 *    다이아몬드 보석 숫자 · 다이아 승리 배너 · 매칭 카드 다이아 테두리 · 칭호
 *    마스터     보라 오라 테두리 · 마스터 승리 배너 · 매칭 카드 보라 오라 · 칭호
 *    그랜드마스터 GM 테마 · 전용 승리 배너 · 매칭 카드 불꽃 오라 · 칭호
 * 3. 해금 축하 연출: 새 보상을 얻으면 화면 전체 축하 카드
 * 4. 매칭 카드 오라·칭호는 온라인 프로필(cos)로 상대에게 전달됩니다(online-match.js).
 */
(() => {
  const R = window.SumdokuRating;
  if (!R || typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const L = () => Math.max(0, LANGS.indexOf((window.I18N && I18N.currentLang) || 'ko'));
  const tr = s => (window.I18N && typeof I18N.text === 'function' ? I18N.text(s) : s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const tierById = id => R.TIERS.find(x => x.id === id);
  const I = window.SumdokuIcon || { el: () => document.createTextNode('') };

  const REWARDS = ['silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster'];
  const RARITY = { silver: 'rare', gold: 'rare', platinum: 'epic', diamond: 'epic', master: 'legendary', grandmaster: 'mythic' };
  const ITEMS = {
    // v2.1.7: 칭호 제거 → 닉네임 플레이트, 플래티넘부터 앱 전체 테마
    silver: ['i_frame_silver', 'i_plate_silver'],
    gold: ['i_frame_gold', 'i_spark', 'i_plate_gold'],
    platinum: ['i_frame_platinum', 'i_wave', 'i_plate_platinum', 'i_apptheme_platinum'],
    diamond: ['i_gem', 'i_banner_diamond', 'i_card_diamond', 'i_plate_diamond', 'i_apptheme_diamond'],
    master: ['i_frame_master', 'i_banner_master', 'i_card_master', 'i_plate_master', 'i_apptheme_master'],
    grandmaster: ['i_theme_gm', 'i_banner_gm', 'i_card_gm', 'i_plate_grandmaster', 'i_apptheme_grandmaster']
  };
  const THEMES = ['platinum', 'diamond', 'master', 'grandmaster'];
  const THEME_KEY = 'sumdoku_tier_theme';
  const THEME_PREV_KEY = 'sumdoku_tier_theme_prev';
  const CKEY = 'sumdoku_rank_cosmetics';
  const SEEN_KEY = 'sumdoku_rank_cos_seen';
  const loadC = () => { try { return JSON.parse(localStorage.getItem(CKEY)) || {}; } catch (_) { return {}; } };
  // v2.1.9: 보상 = 직전 시즌 배틀 최종 티어(매 시즌 초기화)
  const unlockedIdx = () => (R.rewardTierIndex ? R.rewardTierIndex(R.loadAll()) : R.bestTierIndex(R.loadAll()));
  const seasonLabel = n => (n ? t('sLabel', n) : t('sPre'));

  const T = {
    rewards: ['티어 보상', 'Tier rewards', 'ティア報酬', '段位奖励', '段位獎勵', 'Recompensas', 'Récompenses', 'Belohnungen'],
    rar_rare: ['희귀', 'Rare', 'レア', '稀有', '稀有', 'Raro', 'Rare', 'Selten'],
    rar_epic: ['영웅', 'Epic', 'エピック', '史诗', '史詩', 'Épico', 'Épique', 'Episch'],
    rar_legendary: ['전설', 'Legendary', 'レジェンド', '传说', '傳說', 'Legendario', 'Légendaire', 'Legendär'],
    rar_mythic: ['신화', 'Mythic', 'ミシック', '神话', '神話', 'Mítico', 'Mythique', 'Mythisch'],
    owned: ['보유 중', 'Owned', '所持', '已拥有', '已擁有', 'Obtenido', 'Obtenu', 'Im Besitz'],
    unlockAt: ['{0} 달성 시 해금', 'Unlocks at {0}', '{0}到達で解放', '达到{0}解锁', '達到{0}解鎖', 'Se desbloquea en {0}', 'Débloqué au rang {0}', 'Ab {0} freigeschaltet'],
    rpLeft: ['{0} RP 남음', '{0} RP to go', 'あと{0} RP', '还差 {0} RP', '還差 {0} RP', 'Faltan {0} RP', 'Encore {0} RP', 'Noch {0} RP'],
    collected: ['수집 {0} / {1}', 'Collected {0} / {1}', '収集 {0} / {1}', '已收集 {0} / {1}', '已收集 {0} / {1}', 'Obtenidas {0} / {1}', 'Obtenues {0} / {1}', 'Gesammelt {0} / {1}'],
    nextReward: ['다음 보상 · {0}', 'Next reward · {0}', '次の報酬・{0}', '下一个奖励 · {0}', '下一個獎勵 · {0}', 'Siguiente · {0}', 'Prochaine · {0}', 'Nächste · {0}'],
    allDone: ['모든 티어 보상 획득', 'All tier rewards collected', 'すべてのティア報酬を獲得', '已获得全部段位奖励', '已獲得全部段位獎勵', 'Todas las recompensas obtenidas', 'Toutes les récompenses obtenues', 'Alle Rangbelohnungen erhalten'],
    newUnlock: ['티어 보상 해금', 'Tier reward unlocked', 'ティア報酬を解放', '段位奖励已解锁', '段位獎勵已解鎖', 'Recompensa desbloqueada', 'Récompense débloquée', 'Belohnung freigeschaltet'],
    newUnlockSub: ['랭킹 탭 › 티어 보상에서 켜고 끌 수 있습니다.', 'Toggle it in Ranking › Tier rewards.', 'ランキング › ティア報酬で切り替えられます。', '可在排名 › 段位奖励中开关。', '可在排名 › 段位獎勵中開關。', 'Actívala en Clasificación › Recompensas.', 'Activez-la dans Classement › Récompenses.', 'Unter Rangliste › Belohnungen umschaltbar.'],
    great: ['확인', 'OK', 'OK', '确定', '確定', 'Aceptar', 'OK', 'OK'],
    visible: ['상대에게 보임', 'Seen by rivals', '相手に表示', '对手可见', '對手可見', 'Lo ven rivales', 'Vu par l’adversaire', 'Für Gegner sichtbar'],
    sNow: ['시즌 {0} 보상', 'Season {0} rewards', 'シーズン{0}報酬', '赛季{0}奖励', '賽季{0}獎勵', 'Recompensas T{0}', 'Récompenses S{0}', 'Belohnungen S{0}'],
    sLabel: ['시즌 {0}', 'Season {0}', 'シーズン{0}', '赛季{0}', '賽季{0}', 'Temporada {0}', 'Saison {0}', 'Saison {0}'],
    sPre: ['프리시즌', 'Preseason', 'プレシーズン', '季前赛', '季前賽', 'Pretemporada', 'Présaison', 'Vorsaison'],
    sFrom: ['{0} 최종 {1}', '{0} final: {1}', '{0}最終 {1}', '{0}最终 {1}', '{0}最終 {1}', 'Final {0}: {1}', 'Final {0} : {1}', '{0} final: {1}'],
    sNone: ['지난 시즌 배틀 기록이 없어 이번 시즌 보상이 없습니다.', 'No ranked battle record last season, so no rewards this season.', '前シーズンのバトル記録がないため、今シーズンの報酬はありません。', '上赛季无对战记录，本赛季没有奖励。', '上賽季無對戰紀錄，本賽季沒有獎勵。', 'Sin batallas la temporada pasada: sin recompensas esta temporada.', 'Aucun duel classé la saison passée : pas de récompense cette saison.', 'Keine Ranglisten-Kämpfe in der Vorsaison, daher keine Belohnungen.'],
    sPreNote: ['시즌 1이 시작되면 프리시즌 배틀 최종 티어로 첫 보상을 받습니다.', 'When Season 1 starts, you receive rewards based on your final preseason battle tier.', 'シーズン1開始時、プレシーズンのバトル最終ティアで最初の報酬を受け取ります。', '赛季1开始时，将按季前赛对战最终段位发放首次奖励。', '賽季1開始時，將依季前賽對戰最終段位發放首次獎勵。', 'Al empezar la temporada 1 recibirás recompensas según tu rango final de pretemporada.', 'Au début de la saison 1, vous recevrez des récompenses selon votre rang final de présaison.', 'Zu Saison 1 erhältst du Belohnungen nach deinem finalen Vorsaison-Rang.'],
    projTitle: ['다음 시즌 예상 보상 · {0}', 'Next season reward · {0}', '来シーズンの予定報酬・{0}', '下赛季预计奖励 · {0}', '下賽季預計獎勵 · {0}', 'Próxima temporada · {0}', 'Saison prochaine · {0}', 'Nächste Saison · {0}'],
    projNone: ['배치 경기를 마치면 다음 시즌 보상이 정해집니다', 'Finish placements to set next season’s reward', '配置試合を終えると来シーズンの報酬が決まります', '完成定级赛后确定下赛季奖励', '完成定級賽後確定下賽季獎勵', 'Termina la clasificación para fijar la recompensa', 'Terminez le placement pour fixer la récompense', 'Schließe die Platzierung ab, um die Belohnung festzulegen'],
    projNote: ['시즌 종료 시점의 티어로 정해집니다 · {0}일 남음', 'Set by your tier when the season ends · {0} days left', 'シーズン終了時のティアで決まります・残り{0}日', '按赛季结束时段位确定 · 剩余{0}天', '依賽季結束時段位決定 · 剩餘{0}天', 'Según tu rango al final · quedan {0} días', 'Selon votre rang en fin de saison · {0} j restants', 'Nach deinem Rang zum Saisonende · noch {0} Tage'],
    projNext: ['{0}까지 {1} RP', '{1} RP to {0}', '{0}まであと{1} RP', '距{0}还差 {1} RP', '距{0}還差 {1} RP', '{1} RP para {0}', '{1} RP avant {0}', 'Noch {1} RP bis {0}'],
    lockSeason: ['지난 시즌 {0} 이상 필요', 'Needs {0}+ last season', '前シーズン{0}以上が必要', '需上赛季达到{0}以上', '需上賽季達到{0}以上', 'Requiere {0}+ la temporada pasada', 'Requiert {0}+ la saison passée', 'Benötigt {0}+ in der Vorsaison'],
    lockNext: ['다음 시즌 획득 예정', 'Coming next season', '来シーズン獲得予定', '下赛季将获得', '下賽季將獲得', 'Llega la próxima temporada', 'Obtenu la saison prochaine', 'Kommt nächste Saison'],
    claimTitle: ['시즌 {0} 보상 수령', 'Season {0} rewards claimed', 'シーズン{0}報酬を受け取りました', '已领取赛季{0}奖励', '已領取賽季{0}獎勵', 'Recompensas de la temporada {0}', 'Récompenses de la saison {0}', 'Belohnungen Saison {0}'],
    claimSub: ['{0} 최종 티어 보상입니다. 이번 시즌이 끝나면 초기화됩니다.', 'Rewards for your {0} final tier. They reset when this season ends.', '{0}最終ティアの報酬です。今シーズン終了時にリセットされます。', '这是{0}最终段位的奖励，本赛季结束时重置。', '這是{0}最終段位的獎勵，本賽季結束時重設。', 'Recompensas por tu rango final de {0}. Se reinician al terminar esta temporada.', 'Récompenses de votre rang final ({0}). Réinitialisées en fin de saison.', 'Belohnungen für deinen finalen Rang ({0}). Werden zum Saisonende zurückgesetzt.'],
    i_plate_silver: ['닉네임 플레이트 · 실버 메탈', 'Nameplate · Silver metal', 'ネームプレート・シルバー', '昵称铭牌 · 银色金属', '暱稱銘牌 · 銀色金屬', 'Placa de nombre · plata', 'Plaque de pseudo · argent', 'Namensschild · Silber'],
    i_plate_gold: ['닉네임 플레이트 · 황금 각인', 'Nameplate · Engraved gold', 'ネームプレート・黄金刻印', '昵称铭牌 · 黄金刻印', '暱稱銘牌 · 黃金刻印', 'Placa de nombre · oro grabado', 'Plaque de pseudo · or gravé', 'Namensschild · Gravurgold'],
    i_plate_platinum: ['닉네임 플레이트 · 오로라 틸', 'Nameplate · Aurora teal', 'ネームプレート・オーロラ', '昵称铭牌 · 极光青', '暱稱銘牌 · 極光青', 'Placa de nombre · aurora', 'Plaque de pseudo · aurore', 'Namensschild · Aurora'],
    i_plate_diamond: ['닉네임 플레이트 · 크리스탈 프리즘', 'Nameplate · Crystal prism', 'ネームプレート・クリスタル', '昵称铭牌 · 水晶棱镜', '暱稱銘牌 · 水晶稜鏡', 'Placa de nombre · prisma', 'Plaque de pseudo · prisme', 'Namensschild · Kristall'],
    i_plate_master: ['닉네임 플레이트 · 아케인 오라', 'Nameplate · Arcane aura', 'ネームプレート・アルカナ', '昵称铭牌 · 奥术光环', '暱稱銘牌 · 奧術光環', 'Placa de nombre · arcana', 'Plaque de pseudo · arcane', 'Namensschild · Arkan'],
    i_plate_grandmaster: ['닉네임 플레이트 · 황제의 불꽃', 'Nameplate · Imperial flame', 'ネームプレート・皇帝の炎', '昵称铭牌 · 帝王之焰', '暱稱銘牌 · 帝王之焰', 'Placa de nombre · llama imperial', 'Plaque de pseudo · flamme impériale', 'Namensschild · Kaiserflamme'],
    i_apptheme_platinum: ['앱 테마 「오로라 틸」', 'App theme “Aurora Teal”', 'アプリテーマ「オーロラティール」', '应用主题「极光青」', '應用主題「極光青」', 'Tema «Aurora turquesa»', 'Thème « Aurore sarcelle »', 'App-Theme „Aurora-Türkis“'],
    i_apptheme_diamond: ['앱 테마 「크리스탈 블루」', 'App theme “Crystal Blue”', 'アプリテーマ「クリスタルブルー」', '应用主题「水晶蓝」', '應用主題「水晶藍」', 'Tema «Azul cristal»', 'Thème « Bleu cristal »', 'App-Theme „Kristallblau“'],
    i_apptheme_master: ['앱 테마 「아케인 바이올렛」', 'App theme “Arcane Violet”', 'アプリテーマ「アルカナバイオレット」', '应用主题「奥术紫」', '應用主題「奧術紫」', 'Tema «Violeta arcano»', 'Thème « Violet arcane »', 'App-Theme „Arkanviolett“'],
    i_apptheme_grandmaster: ['앱 테마 「황제의 진홍」', 'App theme “Imperial Crimson”', 'アプリテーマ「皇帝の真紅」', '应用主题「帝王深红」', '應用主題「帝王深紅」', 'Tema «Carmesí imperial»', 'Thème « Pourpre impérial »', 'App-Theme „Kaiserkarmesin“'],
    th_platinum: ['오로라 틸', 'Aurora Teal', 'オーロラティール', '极光青', '極光青', 'Aurora turquesa', 'Aurore sarcelle', 'Aurora-Türkis'],
    th_diamond: ['크리스탈 블루', 'Crystal Blue', 'クリスタルブルー', '水晶蓝', '水晶藍', 'Azul cristal', 'Bleu cristal', 'Kristallblau'],
    th_master: ['아케인 바이올렛', 'Arcane Violet', 'アルカナバイオレット', '奥术紫', '奧術紫', 'Violeta arcano', 'Violet arcane', 'Arkanviolett'],
    th_grandmaster: ['황제의 진홍', 'Imperial Crimson', '皇帝の真紅', '帝王深红', '帝王深紅', 'Carmesí imperial', 'Pourpre impérial', 'Kaiserkarmesin'],
    th_none: ['기본', 'Default', 'デフォルト', '默认', '預設', 'Predeterminado', 'Par défaut', 'Standard'],
    themeTitle: ['티어 테마', 'Tier themes', 'ティアテーマ', '段位主题', '段位主題', 'Temas de rango', 'Thèmes de rang', 'Rang-Themes'],
    themeNote: ['플래티넘부터 티어마다 앱 전체 테마가 열립니다.', 'From Platinum, each tier unlocks an app-wide theme.', 'プラチナから各ティアでアプリ全体のテーマが解放されます。', '从铂金开始，每个段位解锁一套全应用主题。', '從白金開始，每個段位解鎖一套全應用主題。', 'Desde Platino, cada rango desbloquea un tema.', 'Dès Platine, chaque rang débloque un thème.', 'Ab Platin schaltet jeder Rang ein App-Theme frei.'],
    themeOn: ['테마 적용: {0}', 'Theme applied: {0}', 'テーマ適用：{0}', '已应用主题：{0}', '已套用主題：{0}', 'Tema aplicado: {0}', 'Thème appliqué : {0}', 'Theme angewendet: {0}'],
    themeOff: ['기본 테마로 돌아갔습니다.', 'Back to the default theme.', 'デフォルトテーマに戻しました。', '已恢复默认主题。', '已恢復預設主題。', 'Tema predeterminado.', 'Thème par défaut rétabli.', 'Standard-Theme wiederhergestellt.'],
    i_frame_silver: ['은빛 보드 테두리', 'Silver board frame', '銀の盤面枠', '银色棋盘边框', '銀色棋盤邊框', 'Marco plateado', 'Cadre argenté', 'Silberner Rahmen'],
    i_frame_gold: ['금빛 보드 테두리', 'Gold board frame', '金の盤面枠', '金色棋盘边框', '金色棋盤邊框', 'Marco dorado', 'Cadre doré', 'Goldrahmen'],
    i_frame_platinum: ['청록 보드 테두리', 'Platinum board frame', 'プラチナ盤面枠', '铂金棋盘边框', '白金棋盤邊框', 'Marco platino', 'Cadre platine', 'Platinrahmen'],
    i_frame_master: ['보라 빛 오라 테두리', 'Violet aura frame', '紫のオーラ枠', '紫色光环边框', '紫色光環邊框', 'Marco de aura violeta', 'Cadre aura violette', 'Violetter Aura-Rahmen'],
    i_spark: ['정답 입력 시 금빛 반짝임', 'Golden sparkle on correct entries', '正解入力で金のきらめき', '答对时金色闪光', '答對時金色閃光', 'Destello dorado al acertar', 'Éclat doré sur bonne réponse', 'Goldfunkeln bei richtigen Zahlen'],
    i_wave: ['케이지 완성 파동 효과', 'Cage-complete shockwave', 'ケージ完成の波動', '笼子完成冲击波', '籠子完成衝擊波', 'Onda al completar jaula', 'Onde de cage complétée', 'Käfig-Schockwelle'],
    i_gem: ['보석 색 입력 숫자', 'Gem-colored digits', '宝石色の数字', '宝石色数字', '寶石色數字', 'Dígitos de gema', 'Chiffres gemme', 'Edelstein-Ziffern'],
    i_banner_diamond: ['다이아 승리 배너', 'Diamond victory banner', 'ダイヤ勝利バナー', '钻石胜利横幅', '鑽石勝利橫幅', 'Banner de victoria diamante', 'Bannière diamant', 'Diamant-Siegesbanner'],
    i_banner_master: ['마스터 승리 배너', 'Master victory banner', 'マスター勝利バナー', '大师胜利横幅', '大師勝利橫幅', 'Banner de victoria maestro', 'Bannière maître', 'Meister-Siegesbanner'],
    i_banner_gm: ['그랜드마스터 전용 승리 배너', 'Grandmaster victory banner', 'GM専用勝利バナー', '宗师专属胜利横幅', '宗師專屬勝利橫幅', 'Banner de Gran Maestro', 'Bannière grand maître', 'Großmeister-Siegesbanner'],
    i_theme_gm: ['그랜드마스터 테마 (붉은·금색 보드)', 'Grandmaster theme (crimson & gold)', 'GMテーマ（紅・金）', '宗师主题（红金棋盘）', '宗師主題（紅金棋盤）', 'Tema Gran Maestro (carmesí y oro)', 'Thème grand maître (pourpre et or)', 'Großmeister-Theme (Karmesin & Gold)'],
    i_card_diamond: ['매칭 카드 다이아 테두리', 'Diamond match card', 'マッチカードのダイヤ枠', '匹配卡钻石边框', '配對卡鑽石邊框', 'Tarjeta de rival diamante', 'Carte de match diamant', 'Diamant-Matchkarte'],
    i_card_master: ['매칭 카드 보라 오라', 'Violet aura match card', 'マッチカードの紫オーラ', '匹配卡紫色光环', '配對卡紫色光環', 'Tarjeta con aura violeta', 'Carte aura violette', 'Matchkarte mit violetter Aura'],
    i_card_gm: ['매칭 카드 불꽃 오라', 'Blazing match card', 'マッチカードの炎オーラ', '匹配卡火焰光环', '配對卡火焰光環', 'Tarjeta en llamas', 'Carte enflammée', 'Flammende Matchkarte'],
  };
  const t = (k, ...a) => { let s = (T[k] && (T[k][L()] || T[k][1])) || k; a.forEach((v, i) => { s = s.split('{' + i + '}').join(String(v)); }); return s; };

  /* ---------- 장착 상태(남에게 보이는 보상) ---------- */
  function equipped() {
    const k = unlockedIdx(), c = loadC();
    let card = '', plate = '';
    for (let i = REWARDS.length - 1; i >= 0; i--) {
      const id = REWARDS[i], idx = R.TIERS.findIndex(x => x.id === id);
      if (k < idx || c[id] === false) continue;
      if (c[id] !== true) continue;
      plate = id;
      if (['diamond', 'master', 'grandmaster'].includes(id)) card = id;
      break;
    }
    return { card, plate };
  }

  /* ---------- 티어 테마(플래티넘~그랜드마스터) ----------
   * 다크 테마를 바탕으로 색 변수와 주요 요소를 덮어씁니다(.tt-<id>).
   * 사용자가 설정에서 라이트/다크/세피아를 직접 바꾸면 티어 테마는 꺼집니다. */
  const isOpen = id => unlockedIdx() >= R.TIERS.findIndex(x => x.id === id);
  const currentTheme = () => {
    try {
      const v = localStorage.getItem(THEME_KEY) || '';
      if (v && localStorage.getItem(THEME_KEY + '_season') !== String(R.seasonOf())) { localStorage.setItem(THEME_KEY, ''); return ''; }
      return THEMES.includes(v) && isOpen(v) ? v : '';
    } catch (_) { return ''; }
  };
  let applyingTier = false, ttReady = false, userReady = false;
  // 부팅 중 테마 복원이 모두 끝난 뒤(로드 + 1초)부터의 applyTheme 호출만 사용자 조작으로 봅니다.
  const markReady = () => setTimeout(() => { userReady = true; try { paintTheme(); } catch (_) {} }, 1000);
  if (document.readyState === 'complete') markReady(); else window.addEventListener('load', markReady, { once: true });
  function withTier(fn) { applyingTier = true; try { fn(); } finally { applyingTier = false; } }
  function paintTheme() {
    const root = document.getElementById('app'), id = currentTheme();
    THEMES.forEach(x => { root?.classList.remove('tt-' + x); document.documentElement.classList.remove('tt-' + x); });
    if (!id || !root) return;
    if (!root.classList.contains('theme-dark')) {
      // 다크 바탕으로 칠하되, 사용자가 고른 기본 테마 값은 보존합니다(티어 테마를 끄면 그대로 돌아감).
      let keep = null; try { keep = localStorage.getItem('sumdoku_theme'); } catch (_) {}
      try { localStorage.setItem(THEME_PREV_KEY, keep || 'theme-light'); } catch (_) {}
      withTier(() => window.app?.applyTheme?.('theme-dark'));
      try { if (keep) localStorage.setItem('sumdoku_theme', keep); } catch (_) {}
    }
    root.classList.add('tt-' + id); document.documentElement.classList.add('tt-' + id);
    try { window.AndroidBridge?.setBootBackground?.({ platinum: '#03211f', diamond: '#050a24', master: '#10041d', grandmaster: '#160404' }[id]); } catch (_) {}
  }
  function setTheme(id) {
    const app = window.app;
    if (id && (!THEMES.includes(id) || !isOpen(id))) return;
    const was = currentTheme();
    try { localStorage.setItem(THEME_KEY, id || ''); localStorage.setItem(THEME_KEY + '_season', String(R.seasonOf())); } catch (_) {}
    if (!id) {
      paintTheme();
      if (was) {
        let prev = 'theme-light'; try { prev = localStorage.getItem('sumdoku_theme') || localStorage.getItem(THEME_PREV_KEY) || 'theme-light'; } catch (_) {}
        withTier(() => app?.applyTheme?.(app?.settings?.darkTheme ? 'theme-dark' : prev));
        app?.showToast?.(t('themeOff'), 2000);
      }
    } else {
      paintTheme();
      app?.showToast?.(t('themeOn', t('th_' + id)), 2000);
    }
    try { app?.sound?.play?.('click'); } catch (_) {}
    document.querySelectorAll('.tt-picker').forEach(fillPicker);
  }
  const baseApply = P.applyTheme;
  P.applyTheme = function () {
    const r = baseApply.apply(this, arguments);
    // v2.1.9: 앱 시작(생성자·부팅 복원) 중의 호출은 저장된 기본 테마를 되살리는 것이므로 티어 테마를 유지하고 다시 칠합니다.
    //   사용자가 설정에서 테마를 바꾼 경우(앱이 준비된 뒤 window.app 에서 호출)만 티어 테마를 끕니다.
    const booting = !window.app || this !== window.app || !userReady;
    if (!applyingTier && currentTheme() && (booting || !ttReady)) { paintTheme(); return r; }
    if (!applyingTier && ttReady && currentTheme()) {
      try { localStorage.setItem(THEME_KEY, ''); } catch (_) {}
      paintTheme();
      document.querySelectorAll('.tt-picker').forEach(fillPicker);
    }
    return r;
  };
  if (baseApply && baseApply.__bootSync) P.applyTheme.__bootSync = true;

  function fillPicker(box) {
    box.replaceChildren();
    const cur = currentTheme();
    ['', ...THEMES].forEach(id => {
      const open = !id || isOpen(id);
      const b = mk('button', 'tt-chip' + (cur === id ? ' on' : '') + (open ? '' : ' locked'));
      b.type = 'button'; b.disabled = !open;
      b.setAttribute('aria-pressed', cur === id ? 'true' : 'false');
      b.append(mk('span', 'tt-swatch tt-sw-' + (id || 'none')), (() => { const n = mk('span', 'tt-chip-name'); if (!open) n.append(I.el('lock', 11), document.createTextNode(' ')); n.append(document.createTextNode(t(id ? 'th_' + id : 'th_none'))); return n; })());
      b.onclick = () => setTheme(id);
      box.append(b);
    });
  }
  function themePicker() {
    const sec = mk('div', 'tt-section');
    sec.dataset.userContent = '';
    sec.append(mk('b', 'tt-title', t('themeTitle')), mk('p', 'tt-note', t('themeNote')));
    const box = mk('div', 'tt-picker'); fillPicker(box); sec.append(box);
    return sec;
  }
  // 설정 패널(다크 테마 스위치 아래)에도 같은 선택기를 둡니다.
  function mountSettingsPicker() {
    const item = document.getElementById('setting-dark-theme')?.closest('.settings-item');
    if (!item) return;
    document.getElementById('tt-settings')?.remove();
    const sec = themePicker(); sec.id = 'tt-settings'; sec.classList.add('tt-in-settings');
    item.after(sec);
  }

  // 배틀 랭크(배치 완료한 난이도) 중 최고 RP — 다음 보상까지 남은 RP 계산용
  function bestBattleRp() {
    const all = R.loadAll(); let best = 0;
    R.DIFFS.forEach(d => {
      const s = R.ladder(all, 'battle').byDiff[d];
      if (s && !(s.placement > 0) && (s.games || 0) > 0) best = Math.max(best, s.rating || 0);
    });
    return best;
  }

  // 3×3 미니 보드 미리보기
  function previewBoard(id) {
    const pv = mk('div', 'cos-prev pv-' + id); pv.setAttribute('aria-hidden', 'true');
    [5, '', 3, '', 9, '', 1, '', 7].forEach(n => pv.append(mk('i', n ? 'f' : '', n ? String(n) : '')));
    return pv;
  }

  /* ---------- 컬렉션 화면 ---------- */
  function render(cos, ctx) {
    const k = unlockedIdx(), c = ctx.loadC();
    const got = REWARDS.filter(id => k >= R.TIERS.findIndex(x => x.id === id)).length;
    const head = mk('div', 'cos-head');
    const sn = R.seasonOf(), fin = R.lastSeasonFinal ? R.lastSeasonFinal(R.loadAll()) : null;
    const ttl = mk('h3', 'section-title cos-season-title'); ttl.innerHTML = R.seasonSymbol ? R.seasonSymbol(sn, 20) : ''; ttl.append(' ' + (sn ? t('sNow', sn) : (ctx.title || t('rewards'))));
    head.append(ttl, mk('span', 'cos-count', t('collected', got, REWARDS.length)));
    cos.append(head, mk('p', 'ranking-hint', ctx.note || ''));
    const src = mk('div', 'cos-source');
    if (fin) { const ft = tierById(fin.tier); src.style.setProperty('--tier', ft.color); const e1 = mk('span', 'cos-src-em'); e1.innerHTML = R.tierSymbol(fin.tier, 26); const e2 = mk('span', 'cos-src-sym'); e2.innerHTML = R.seasonSymbol(fin.season, 20); src.append(e1, e2, mk('b', null, t('sFrom', seasonLabel(fin.season), tr(ft.ko)))); }
    else src.append(mk('span', null, sn ? t('sNone') : t('sPreNote')));
    cos.append(src);

    // v2.1.9: 이번 시즌 종료 시 최종 티어 = 다음 시즌 보상
    const proj = R.currentSeasonFinal ? R.currentSeasonFinal(R.loadAll()) : null;
    const nx = mk('div', 'cos-next');
    const daysLeft = sn ? Math.max(0, Math.ceil((R.seasonEnd(sn) - Date.now()) / 86400000)) : Math.max(0, Math.ceil((R.seasonEnd(0) - Date.now()) / 86400000));
    if (proj) {
      const pt = tierById(proj.tier) || R.TIERS[0];
      const nextT = R.TIERS.find((x, i) => i > proj.index && REWARDS.includes(x.id));
      nx.style.setProperty('--tier', pt.color);
      const em = mk('span', 'cos-next-em'); em.innerHTML = R.tierSymbol(pt.id, 44);
      const tx = mk('div', 'cos-next-tx');
      tx.append(mk('b', null, t('projTitle', tr(pt.ko))));
      const owned = REWARDS.filter(id => R.TIERS.findIndex(x => x.id === id) <= proj.index);
      if (owned.length) tx.append(mk('span', 'cos-next-items', owned.map(id => tr(tierById(id).ko)).join(' · ')));
      if (nextT) {
        const from = pt.min, pct = Math.max(0, Math.min(100, (proj.rp - from) / Math.max(1, nextT.min - from) * 100));
        const bar = mk('div', 'cos-next-bar'); const fill = mk('i'); fill.style.width = pct.toFixed(1) + '%'; bar.append(fill); tx.append(bar);
        tx.append(mk('small', null, `${t('projNext', tr(nextT.ko), Math.max(0, nextT.min - proj.rp).toLocaleString())} · ${t('projNote', daysLeft)}`));
      } else tx.append(mk('small', null, t('projNote', daysLeft)));
      nx.append(em, tx);
    } else { nx.append(mk('b', null, t('projNone'))); }
    cos.append(nx, themePicker());

    const grid = mk('div', 'cos-grid');
    const best = bestBattleRp();
    REWARDS.forEach(id => {
      const tier = tierById(id), idx = R.TIERS.indexOf(tier), open = k >= idx, rar = RARITY[id];
      const card = mk('div', 'cos-card rar-' + rar + (open ? ' open' : ' locked')); card.style.setProperty('--tier', tier.color);
      card.dataset.reward = id;
      const top = mk('div', 'cos-top');
      const em = mk('span', 'cos-em'); em.innerHTML = R.tierSymbol(id, 46);
      const nm = mk('div', 'cos-nm'); nm.append(mk('span', 'cos-rar rar-' + rar, t('rar_' + rar)), mk('b', null, tr(tier.ko)));
      top.append(em, nm, previewBoard(id));
      const ul = mk('ul', 'cos-items');
      ITEMS[id].forEach(it => { const li = mk('li', null, t(it)); if (/^i_card_|^i_plate_/.test(it)) { const v = mk('em', 'cos-vis'); v.append(I.el('eye', 11), document.createTextNode(' ' + t('visible'))); li.append(v); }; ul.append(li); });
      const foot = mk('div', 'cos-foot');
      if (open) {
        const row = mk('label', 'cos-toggle');
        const sw = mk('span', 'toggle-switch');
        const cb = mk('input'); cb.type = 'checkbox'; cb.checked = c[id] !== false;
        cb.onchange = () => { const cc = ctx.loadC(); REWARDS.forEach(x => { if (cc[x] !== undefined) cc[x] = false; }); cc[id] = cb.checked; ctx.saveC(cc); ctx.applyCosmetics(); cos.closest('#season-cos') ? (cos.innerHTML = '', render(cos, ctx)) : cos.querySelectorAll('.cos-card').forEach(el => { const i2 = el.querySelector('.cos-toggle input'); if (i2) i2.checked = el.dataset.reward === id && cb.checked; }); };
        sw.append(cb, mk('span', 'slider'));
        { const o = mk('span', 'cos-owned'); o.append(I.el('check', 13), document.createTextNode(' ' + t('owned'))); row.append(o, sw); }
        foot.append(row);
      } else {
        foot.append((() => { const l = mk('span', 'cos-lock'); const coming = proj && proj.index >= idx; l.append(I.el('lock', 12), document.createTextNode(' ' + t('lockSeason', tr(tier.ko)) + ' · ' + (coming ? t('lockNext') : t('rpLeft', Math.max(0, tier.min - (proj ? proj.rp : best)).toLocaleString())))); if (coming) l.classList.add('coming'); return l; })());
      }
      // 닉네임 플레이트 미리보기(내 닉네임으로)
      const plate = mk('div', 'cos-plate-prev');
      { const pl = mk('span', 'nm-plate nm-plate-' + id, (window.SumdokuMyName?.() || 'Player')); const bd = window.SumdokuNameBadge?.mine?.(); if (bd) pl.prepend(bd); plate.append(pl); }
      card.append(top, plate, ul, foot);
      grid.append(card);
    });
    cos.append(grid);
  }

  /* ---------- 해금 축하 ---------- */
  // v2.1.9: 새 시즌이 시작되면 지난 시즌 최종 티어 보상을 '수령'하는 연출을 시즌마다 한 번 보여 줍니다.
  const CLAIM_KEY = 'sumdoku_rank_reward_claimed';
  function celebrate() {
    const app = window.app;
    if (!app || app.isBattle || app.currentView === 'game' || document.getElementById('rkc-unlock')) return;
    const all = R.loadAll(), fin = R.lastSeasonFinal ? R.lastSeasonFinal(all) : null, sn = R.seasonOf();
    if (!fin) return;
    const tag = sn + ':' + fin.tier;
    try { if (localStorage.getItem(CLAIM_KEY) === tag) return; localStorage.setItem(CLAIM_KEY, tag); } catch (_) { return; }
    const k = fin.index;
    const fresh = REWARDS.filter(id => R.TIERS.findIndex(x => x.id === id) <= k);
    if (!fresh.length) return;
    const top = tierById(fresh[fresh.length - 1]), rar = RARITY[top.id];
    const ov = mk('div', 'rkc-unlock rar-' + rar); ov.id = 'rkc-unlock';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.style.setProperty('--tier', top.color);
    const card = mk('div', 'rkc-unlock-card');
    const rays = mk('div', 'rkc-unlock-rays'); rays.setAttribute('aria-hidden', 'true');
    const em = mk('div', 'rkc-unlock-em'); em.innerHTML = R.tierSymbol(fin.tier, 120);
    const sym = mk('div', 'rkc-unlock-sym'); sym.innerHTML = R.seasonSymbol(fin.season, 30);
    const list = mk('ul', 'rkc-unlock-list');
    fresh.forEach(id => ITEMS[id].forEach(it => list.append(mk('li', null, t(it)))));
    const ok = mk('button', 'btn btn-primary', t('great')); ok.type = 'button';
    ok.onclick = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 260); };
    card.append(rays, mk('span', 'cos-rar rar-' + rar, t('rar_' + rar)), em, sym, mk('h3', null, t('claimTitle', sn)), mk('b', 'rkc-unlock-tier', tr(tierById(fin.tier).ko)), list, mk('p', null, t('claimSub', seasonLabel(fin.season))), ok);
    ov.append(card);
    document.body.append(ov);
    try { app.sound?.play?.('badge'); } catch (_) {}
  }
  let celebrateTimer = 0;
  function onCosmeticsApplied() { clearTimeout(celebrateTimer); celebrateTimer = setTimeout(() => { try { celebrate(); } catch (_) {} }, 900); }
  // 경기 결과 화면을 닫고 다른 화면으로 가면 다시 확인합니다.
  const baseSwitch = P.switchView;
  if (baseSwitch) P.switchView = function () { const r = baseSwitch.apply(this, arguments); onCosmeticsApplied(); return r; };

  /* ---------- 골드: 정답 반짝임 · 플래티넘: 케이지 완성 파동 ---------- */
  const baseDelta = P.showScoreDelta;
  if (baseDelta) P.showScoreDelta = function (delta, r, c, extra) {
    const out = baseDelta.apply(this, arguments);
    try {
      if (delta > 0 && this.currentView === 'game') {
        const b = document.body, cage = /케이지/.test(extra || '');
        const cellAt = (rr, cc) => document.querySelector(`#view-game .cell[data-r="${rr}"][data-c="${cc}"]`);
        const pulse = (el, cls, ms) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); };
        if (!cage && b.classList.contains('rkc-gold')) { const el = cellAt(r, c); if (el) pulse(el, 'rkc-spark', 700); }
        if (cage && b.classList.contains('rkc-platinum')) {
          const g = this.cages?.[this.cellCageMap?.[`${r},${c}`]];
          (g?.cells || []).forEach(([cr, cc], i) => setTimeout(() => { const el = cellAt(cr, cc); if (el) pulse(el, 'rkc-wave', 800); }, i * 60));
        }
      }
    } catch (_) {}
    return out;
  };

  const initTheme = () => {
    try { ttReady = true; paintTheme(); mountSettingsPicker(); } catch (e) { console.warn('tier-theme', e); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTheme); else initTheme();
  const baseHub = P.openHubPanel;
  if (baseHub) P.openHubPanel = function (id) { const r = baseHub.apply(this, arguments); if (id === 'panel-settings') try { mountSettingsPicker(); } catch (_) {} return r; };
  // 언어가 바뀌면 선택기 문구를 다시 그립니다.
  new MutationObserver(() => { try { mountSettingsPicker(); } catch (_) {} }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.SumdokuTierRewards = { REWARDS, RARITY, ITEMS, THEMES, render, equipped, celebrate, onCosmeticsApplied, bestBattleRp, setTheme, currentTheme, paintTheme };

})();
