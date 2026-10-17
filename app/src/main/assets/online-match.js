// =============================================================================
// v2.0.1 · 온라인 랜덤 매칭 (서버 없음)
// -----------------------------------------------------------------------------
// 전 세계 플레이어를 중앙 서버 없이 찾고 연결합니다.
//
//  [상대 찾기 · 시그널링 경로 2가지를 동시에 사용]
//   1) BitTorrent 트래커 (WebTorrent WebSocket 트래커 프로토콜)
//      - 매칭 구역마다 info_hash = SHA-1("sumdoku-match|프로토콜|구역|모드|난이도")
//      - announce에 WebRTC offer를 실어 보내면, 트래커가 같은 info_hash의 다른 기기에게 전달하고
//        그 기기의 answer를 돌려줍니다. 트래커는 공개 인프라이며 게임 데이터는 거치지 않습니다.
//   2) Mainline DHT (BitTorrent BEP 5, 네이티브 MainlineDht.java)
//      - 같은 info_hash로 get_peers / announce_peer → 상대 IP:포트 발견 → UDP 홀펀칭
//      - 뚫린 UDP 경로로 WebRTC offer/answer를 주고받습니다(트래커가 막힌 망에서도 매칭).
//
//  [연결 이후]
//   - WebRTC DataChannel(공개 STUN으로 NAT 통과) 하나로 상대와 직접 연결합니다.
//   - 작은 ID 쪽이 '제안(propose)' → 상대가 '수락(accept)'하면 1:1 매칭 확정(동시에 여러 명과 엮이지 않음).
//   - 제안한 쪽이 방장: 루프백(127.0.0.1) 전용 BattleServer를 엽니다.
//   - 참가자의 기존 배틀 코드는 battleHostUrl = 'p2p://host' 로 요청하고, fetch 터널이
//     DataChannel을 통해 방장 기기의 BattleServer로 전달합니다. → 기존 4가지 배틀 모드를 그대로 사용.
//
//  [매칭 구역 분리]
//   - 지역(아시아·태평양 / 유럽·아프리카 / 아메리카 / 전 세계 통합) × 배틀 모드 × 난이도
//     조합마다 info_hash가 달라 서로 다른 구역의 플레이어는 절대 섞이지 않습니다.
//   - 온라인 랜덤 매칭은 공정성을 위해 고정 규칙(목숨 3 · 힌트 3 · 자동 메모 허용 · 턴 30초)을 씁니다.
// =============================================================================
(function () {
  'use strict';

  const PROTO = 'sd-online-2';
  const TRACKERS = [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.webtorrent.dev',
    'wss://tracker.btorrent.xyz',
    'wss://tracker.files.fm:7073/announce'
  ];
  const ICE_SERVERS = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ];
  const OFFER_POOL = 5;            // announce 한 번에 실어 보내는 offer 수
  const ANNOUNCE_MIN_SEC = 25;     // 트래커 재등록 최소 간격
  const OFFER_TTL_MS = 55000;      // 응답 없는 offer 정리
  const ICE_WAIT_MS = 2500;        // 트래커는 trickle ICE를 지원하지 않으므로 후보 수집을 기다립니다.
  const PROPOSE_TIMEOUT_MS = 6000;
  const TUNNEL_TIMEOUT_MS = 9000;
  const HOST = 'p2p://host';

  const FIXED_RULES = { mistakeLimit: true, maxLives: '3', livesExhaustedAction: 'game_over', initialHints: '3', hintExhaustedAction: 'allow_penalty', allowAutoNotes: true, turnSeconds: 30 };

  // ---------------------------------------------------------------------------
  // 다국어: 앱이 지원하는 8개 언어 [ko, en, ja, zh, zh-TW, es, fr, de]
  // ---------------------------------------------------------------------------
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const langIdx = () => { const l = (window.I18N && I18N.currentLang) || 'ko'; const i = LANGS.indexOf(l); return i < 0 ? 1 : i; };
  const pickLang = arr => (Array.isArray(arr) ? (arr[langIdx()] ?? arr[1] ?? arr[0]) : arr);

  const ZONES = [
    { id: 'asia', flag: '🌏', names: ['아시아 · 태평양', 'Asia · Pacific', 'アジア・太平洋', '亚太地区', '亞太地區', 'Asia · Pacífico', 'Asie · Pacifique', 'Asien · Pazifik'] },
    { id: 'europe', flag: '🌍', names: ['유럽 · 아프리카', 'Europe · Africa', 'ヨーロッパ・アフリカ', '欧洲 · 非洲', '歐洲 · 非洲', 'Europa · África', 'Europe · Afrique', 'Europa · Afrika'] },
    { id: 'americas', flag: '🌎', names: ['아메리카', 'Americas', '南北アメリカ', '美洲', '美洲', 'América', 'Amériques', 'Amerika'] },
    { id: 'global', flag: '🌐', names: ['전 세계 통합', 'Worldwide', '全世界', '全球', '全球', 'Todo el mundo', 'Monde entier', 'Weltweit'] }
  ];
  const MODES = [
    { id: 'race', names: ['⚡ 스피드 레이스', '⚡ Speed race', '⚡ スピードレース', '⚡ 竞速赛', '⚡ 競速賽', '⚡ Carrera', '⚡ Course', '⚡ Wettrennen'] },
    { id: 'score', names: ['⏱️ 타임어택', '⏱️ Time attack', '⏱️ タイムアタック', '⏱️ 计时赛', '⏱️ 計時賽', '⏱️ Contrarreloj', '⏱️ Contre-la-montre', '⏱️ Zeitangriff'] },
    { id: 'survival', names: ['🛡️ 서바이벌', '🛡️ Survival', '🛡️ サバイバル', '🛡️ 生存赛', '🛡️ 生存賽', '🛡️ Supervivencia', '🛡️ Survie', '🛡️ Überleben'] },
    { id: 'turn', names: ['♟️ 턴제', '♟️ Turn-based', '♟️ ターン制', '♟️ 回合制', '♟️ 回合制', '♟️ Por turnos', '♟️ Tour par tour', '♟️ Rundenbasiert'] }
  ];
  const DIFFS = [
    { id: 'easy', names: ['초급', 'Easy', '初級', '初级', '初級', 'Fácil', 'Facile', 'Leicht'] },
    { id: 'medium', names: ['중급', 'Medium', '中級', '中级', '中級', 'Medio', 'Moyen', 'Mittel'] },
    { id: 'hard', names: ['고급', 'Hard', '上級', '高级', '高級', 'Difícil', 'Difficile', 'Schwer'] },
    { id: 'expert', names: ['전문가', 'Expert', 'エキスパート', '专家', '專家', 'Experto', 'Expert', 'Experte'] },
    { id: 'lunatic', names: ['루나틱', 'Lunatic', 'ルナティック', '疯狂', '瘋狂', 'Lunático', 'Lunatique', 'Wahnsinnig'] }
  ];

  const STR = {
    tab: ['🌐 온라인', '🌐 Online', '🌐 オンライン', '🌐 在线', '🌐 線上', '🌐 En línea', '🌐 En ligne', '🌐 Online'],
    title: ['전 세계 랜덤 매칭', 'Worldwide random match', '世界ランダムマッチ', '全球随机匹配', '全球隨機配對', 'Partida aleatoria mundial', 'Match aléatoire mondial', 'Weltweites Zufallsmatch'],
    intro: [
      '서버 없이 BitTorrent 트래커와 Mainline DHT로 같은 구역의 플레이어를 찾아 1:1로 직접 연결합니다.',
      'Finds players in the same zone through BitTorrent trackers and the Mainline DHT, then connects you directly — no game server.',
      'サーバーなしで BitTorrent トラッカーと Mainline DHT を使い、同じ地域のプレイヤーを見つけて 1対1 で直接つなぎます。',
      '无需服务器，通过 BitTorrent Tracker 和 Mainline DHT 寻找同一区域的玩家，并直接 1 对 1 连接。',
      '無需伺服器，透過 BitTorrent Tracker 與 Mainline DHT 尋找同一區域的玩家，並直接 1 對 1 連線。',
      'Sin servidor: encuentra jugadores de tu zona mediante trackers BitTorrent y la DHT Mainline y te conecta directamente 1 contra 1.',
      'Sans serveur : trouve des joueurs de votre zone via les trackers BitTorrent et la DHT Mainline, puis vous connecte en direct en 1 contre 1.',
      'Ohne Server: findet Spieler in deiner Zone über BitTorrent-Tracker und die Mainline-DHT und verbindet euch direkt 1 gegen 1.'
    ],
    zone: ['매칭 구역', 'Match zone', 'マッチ地域', '匹配区域', '配對區域', 'Zona de partida', 'Zone de match', 'Match-Zone'],
    zoneAuto: ['기기 시간대 기준 추천', 'Suggested from your time zone', '端末のタイムゾーンからのおすすめ', '根据设备时区推荐', '依裝置時區推薦', 'Sugerida según tu zona horaria', 'Suggérée selon votre fuseau horaire', 'Empfohlen nach deiner Zeitzone'],
    mode: ['배틀 모드', 'Battle mode', 'バトルモード', '对战模式', '對戰模式', 'Modo de batalla', 'Mode de duel', 'Kampfmodus'],
    diff: ['난이도', 'Difficulty', '難易度', '难度', '難度', 'Dificultad', 'Difficulté', 'Schwierigkeit'],
    name: ['내 닉네임', 'My nickname', 'ニックネーム', '我的昵称', '我的暱稱', 'Mi apodo', 'Mon pseudo', 'Mein Spitzname'],
    namePh: ['상대에게 보일 이름', 'Name shown to your opponent', '相手に表示される名前', '对手看到的名字', '對手看到的名稱', 'Nombre que verá tu rival', 'Nom vu par votre adversaire', 'Name, den dein Gegner sieht'],
    rules: [
      '온라인 공정 규칙 · 목숨 3 · 힌트 3 · 자동 메모 허용 · 턴 30초',
      'Fair online rules · 3 lives · 3 hints · auto-notes on · 30 s turns',
      'オンライン公平ルール · ライフ3 · ヒント3 · 自動メモ可 · ターン30秒',
      '在线公平规则 · 3 条命 · 3 次提示 · 允许自动笔记 · 每回合 30 秒',
      '線上公平規則 · 3 條命 · 3 次提示 · 允許自動筆記 · 每回合 30 秒',
      'Reglas justas en línea · 3 vidas · 3 pistas · notas automáticas · turnos de 30 s',
      'Règles équitables en ligne · 3 vies · 3 indices · notes auto · tours de 30 s',
      'Faire Online-Regeln · 3 Leben · 3 Hinweise · Auto-Notizen an · 30-s-Züge'
    ],
    start: ['랜덤 매칭 시작', 'Find a match', 'マッチング開始', '开始随机匹配', '開始隨機配對', 'Buscar partida', 'Trouver un match', 'Match suchen'],
    cancel: ['매칭 취소', 'Cancel', 'キャンセル', '取消匹配', '取消配對', 'Cancelar', 'Annuler', 'Abbrechen'],
    searching: ['같은 구역의 상대를 찾는 중…', 'Looking for an opponent in this zone…', '同じ地域の対戦相手を探しています…', '正在寻找同一区域的对手…', '正在尋找同一區域的對手…', 'Buscando rival en esta zona…', 'Recherche d’un adversaire dans cette zone…', 'Suche Gegner in dieser Zone…'],
    found: ['상대를 찾았습니다! 연결을 확정하는 중…', 'Opponent found! Confirming…', '相手が見つかりました！確定中…', '找到对手！正在确认…', '找到對手！正在確認…', '¡Rival encontrado! Confirmando…', 'Adversaire trouvé ! Confirmation…', 'Gegner gefunden! Bestätige…'],
    matched: ['매칭 완료! 퍼즐을 준비하는 중…', 'Matched! Preparing the puzzle…', 'マッチ成立！パズルを準備中…', '匹配成功！正在准备谜题…', '配對成功！正在準備謎題…', '¡Emparejado! Preparando el puzle…', 'Match trouvé ! Préparation de la grille…', 'Match gefunden! Rätsel wird vorbereitet…'],
    trackers: ['트래커', 'Trackers', 'トラッカー', 'Tracker', 'Tracker', 'Trackers', 'Trackers', 'Tracker'],
    dht: ['DHT', 'DHT', 'DHT', 'DHT', 'DHT', 'DHT', 'DHT', 'DHT'],
    peers: ['발견', 'Seen', '発見', '发现', '發現', 'Vistos', 'Vus', 'Gesehen'],
    waiting: ['대기', 'Waiting', '待機', '等待', '等待', 'En espera', 'En attente', 'Wartend'],
    elapsed: ['경과', 'Elapsed', '経過', '已用', '已用', 'Tiempo', 'Écoulé', 'Vergangen'],
    slow: [
      '상대가 잘 안 보이나요? 전 세계 통합 구역은 사람이 더 많습니다.',
      'Taking a while? The Worldwide zone usually has more players.',
      'なかなか見つかりませんか？全世界の地域はプレイヤーが多めです。',
      '迟迟找不到对手？全球区域通常玩家更多。',
      '遲遲找不到對手？全球區域通常玩家更多。',
      '¿Tarda mucho? La zona mundial suele tener más jugadores.',
      'Ça prend du temps ? La zone Monde entier compte souvent plus de joueurs.',
      'Dauert es? In der weltweiten Zone sind meist mehr Spieler.'
    ],
    toGlobal: ['전 세계 통합으로 바꾸기', 'Switch to Worldwide', '全世界に切り替える', '切换到全球', '切換到全球', 'Cambiar a todo el mundo', 'Passer à Monde entier', 'Zu weltweit wechseln'],
    nat: [
      '일부 통신사·회사망(대칭형 NAT)에서는 직접 연결이 막힐 수 있습니다. 그럴 때는 다른 Wi-Fi나 모바일 데이터로 시도해 주세요.',
      'Some carrier or office networks (symmetric NAT) block direct connections. If matching keeps failing, try another Wi-Fi or mobile data.',
      '一部の通信会社や社内ネットワーク（対称型NAT）では直接接続できない場合があります。その場合は別のWi-Fiかモバイルデータでお試しください。',
      '部分运营商或公司网络（对称型 NAT）可能会阻止直连。若一直失败，请换用其他 Wi-Fi 或移动数据。',
      '部分電信業者或公司網路（對稱型 NAT）可能會阻擋直連。若一直失敗，請改用其他 Wi-Fi 或行動數據。',
      'Algunas redes de operadoras u oficinas (NAT simétrico) bloquean la conexión directa. Si falla, prueba con otra Wi-Fi o datos móviles.',
      'Certains réseaux d’opérateurs ou d’entreprise (NAT symétrique) bloquent la connexion directe. En cas d’échec, essayez un autre Wi-Fi ou les données mobiles.',
      'Manche Mobilfunk- oder Firmennetze (symmetrisches NAT) blockieren Direktverbindungen. Versuche es dann mit anderem WLAN oder mobilen Daten.'
    ],
    lost: ['상대와의 연결이 끊어졌습니다. 다시 찾는 중…', 'Connection lost. Searching again…', '接続が切れました。再検索中…', '连接已断开，正在重新寻找…', '連線已中斷，正在重新尋找…', 'Conexión perdida. Buscando de nuevo…', 'Connexion perdue. Nouvelle recherche…', 'Verbindung verloren. Suche erneut…'],
    lostInGame: ['상대와의 P2P 연결이 끊어졌습니다.', 'The P2P connection to your opponent was lost.', '相手とのP2P接続が切れました。', '与对手的 P2P 连接已断开。', '與對手的 P2P 連線已中斷。', 'Se perdió la conexión P2P con tu rival.', 'La connexion P2P avec votre adversaire a été perdue.', 'Die P2P-Verbindung zum Gegner wurde getrennt.'],
    noBridge: ['온라인 매칭은 Android 앱에서 이용할 수 있습니다.', 'Online matching is available in the Android app.', 'オンラインマッチは Android アプリで利用できます。', '在线匹配仅在 Android 应用中可用。', '線上配對僅在 Android 應用程式中可用。', 'La partida en línea está disponible en la app de Android.', 'Le match en ligne est disponible dans l’app Android.', 'Online-Matches gibt es in der Android-App.'],
    noRtc: [
      '이 기기의 WebView가 WebRTC를 지원하지 않아 온라인 매칭을 할 수 없습니다. Android System WebView를 업데이트해 주세요.',
      'This WebView does not support WebRTC. Please update Android System WebView.',
      'この端末の WebView は WebRTC に対応していません。Android System WebView を更新してください。',
      '此设备的 WebView 不支持 WebRTC，请更新 Android System WebView。',
      '此裝置的 WebView 不支援 WebRTC，請更新 Android System WebView。',
      'Este WebView no admite WebRTC. Actualiza Android System WebView.',
      'Ce WebView ne prend pas en charge WebRTC. Mettez à jour Android System WebView.',
      'Dieses WebView unterstützt kein WebRTC. Bitte Android System WebView aktualisieren.'
    ],
    noNet: ['인터넷에 연결되어 있지 않습니다.', 'You are offline.', 'インターネットに接続されていません。', '未连接到互联网。', '未連線至網際網路。', 'No hay conexión a Internet.', 'Vous êtes hors ligne.', 'Du bist offline.'],
    hostFail: ['방을 열지 못했습니다. 다시 찾는 중…', 'Could not open the room. Searching again…', 'ルームを開けませんでした。再検索中…', '无法创建房间，正在重新寻找…', '無法建立房間，正在重新尋找…', 'No se pudo abrir la sala. Buscando de nuevo…', 'Impossible d’ouvrir la salle. Nouvelle recherche…', 'Raum konnte nicht geöffnet werden. Suche erneut…'],
    opp: ['상대', 'Opponent', '相手', '对手', '對手', 'Rival', 'Adversaire', 'Gegner'],
    me: ['나', 'You', '自分', '我', '我', 'Tú', 'Vous', 'Du'],
    youHost: ['내가 방장 · 퍼즐을 생성합니다', 'You host · generating the puzzle', 'あなたがホスト · パズル生成中', '你是房主 · 正在生成谜题', '你是房主 · 正在生成謎題', 'Eres el anfitrión · generando el puzle', 'Vous hébergez · génération de la grille', 'Du hostest · Rätsel wird erstellt'],
    youGuest: ['상대가 방장 · 퍼즐을 받는 중', 'Opponent hosts · receiving the puzzle', '相手がホスト · パズル受信中', '对手是房主 · 正在接收谜题', '對手是房主 · 正在接收謎題', 'El rival es anfitrión · recibiendo el puzle', 'L’adversaire héberge · réception de la grille', 'Gegner hostet · Rätsel wird empfangen'],
    wifiOff: ['Wi-Fi가 꺼져 있어 온라인 매칭만 사용할 수 있습니다.', 'Wi-Fi is off — only online matching is available.', 'Wi-Fi がオフのため、オンラインマッチのみ利用できます。', 'Wi-Fi 已关闭，只能使用在线匹配。', 'Wi-Fi 已關閉，只能使用線上配對。', 'El Wi-Fi está apagado: solo hay partidas en línea.', 'Wi-Fi désactivé : seul le match en ligne est disponible.', 'WLAN ist aus – nur Online-Matches verfügbar.'],
    titleRoom: ['원격 방 배틀', 'Remote room battle', 'リモートルーム対戦', '远程房间对战', '遠端房間對戰', 'Batalla en sala remota', 'Duel en salle à distance', 'Remote-Raumkampf'],
    roomClose: ['방 닫기', 'Close room', 'ルームを閉じる', '关闭房间', '關閉房間', 'Cerrar sala', 'Fermer la salle', 'Raum schließen'],
    kindRandom: ['🎲 랜덤 매칭', '🎲 Random', '🎲 ランダム', '🎲 随机匹配', '🎲 隨機配對', '🎲 Aleatoria', '🎲 Aléatoire', '🎲 Zufällig'],
    kindRoom: ['🔢 방 번호', '🔢 Room code', '🔢 ルーム番号', '🔢 房间号', '🔢 房間號碼', '🔢 Código de sala', '🔢 Code de salle', '🔢 Raumcode'],
    roomIntro: [
      '내부망이 아니어도 됩니다. 방을 만들고 6자리 번호를 친구에게 알려 주면, 전 세계 어디서든 번호로 접속해 배틀할 수 있습니다.',
      'No shared Wi-Fi needed. Create a room and share the 6-digit code — your friend can join from anywhere in the world.',
      '同じネットワークでなくても大丈夫。ルームを作って6桁の番号を伝えれば、世界中どこからでも参加できます。',
      '无需同一网络。创建房间并把 6 位房间号告诉好友，好友在世界任何地方都能加入。',
      '不必在同一網路。建立房間並把 6 位號碼告訴好友，好友在世界任何地方都能加入。',
      'No hace falta la misma Wi-Fi. Crea una sala y comparte el código de 6 dígitos: tu amigo puede unirse desde cualquier lugar.',
      'Pas besoin du même Wi-Fi. Créez une salle et partagez le code à 6 chiffres : votre ami peut rejoindre depuis n’importe où.',
      'Kein gemeinsames WLAN nötig. Raum erstellen, 6-stelligen Code teilen – dein Freund kann von überall beitreten.'
    ],
    roomCreate: ['방 만들기', 'Create room', 'ルームを作成', '创建房间', '建立房間', 'Crear sala', 'Créer une salle', 'Raum erstellen'],
    roomJoin: ['번호로 참가', 'Join', '番号で参加', '输入房间号加入', '輸入號碼加入', 'Unirse', 'Rejoindre', 'Beitreten'],
    roomCodeLabel: ['방 번호', 'Room code', 'ルーム番号', '房间号', '房間號碼', 'Código', 'Code', 'Code'],
    roomCodePh: ['6자리 번호', '6-digit code', '6桁の番号', '6 位数字', '6 位數字', 'Código de 6 dígitos', 'Code à 6 chiffres', '6-stelliger Code'],
    roomWaiting: ['친구가 이 번호를 입력하면 바로 연결됩니다', 'Your friend can join with this code', '友達がこの番号を入力するとすぐにつながります', '好友输入此房间号即可立即连接', '好友輸入此號碼即可立即連線', 'Tu amigo puede unirse con este código', 'Votre ami peut rejoindre avec ce code', 'Dein Freund kann mit diesem Code beitreten'],
    roomJoining: ['방을 찾는 중…', 'Looking for the room…', 'ルームを探しています…', '正在寻找房间…', '正在尋找房間…', 'Buscando la sala…', 'Recherche de la salle…', 'Suche den Raum…'],
    roomNotFound: ['아직 방을 찾지 못했습니다. 번호를 확인하고 방장이 방을 열어 두었는지 확인해 주세요.', 'Room not found yet. Check the code and make sure the host keeps the room open.', 'まだルームが見つかりません。番号とホストがルームを開いているか確認してください。', '尚未找到房间。请确认房间号，并确保房主保持房间开启。', '尚未找到房間。請確認號碼，並確保房主保持房間開啟。', 'Aún no se encuentra la sala. Revisa el código y que el anfitrión la mantenga abierta.', 'Salle introuvable pour l’instant. Vérifiez le code et que l’hôte garde la salle ouverte.', 'Raum noch nicht gefunden. Code prüfen und sicherstellen, dass der Host den Raum offen hält.'],
    roomBad: ['6자리 숫자를 입력해 주세요.', 'Enter the 6-digit code.', '6桁の数字を入力してください。', '请输入 6 位数字。', '請輸入 6 位數字。', 'Introduce el código de 6 dígitos.', 'Saisissez le code à 6 chiffres.', 'Gib den 6-stelligen Code ein.'],
    roomRules: ['방장의 모드·난이도·규칙으로 진행합니다', 'Plays with the host’s mode, difficulty and rules', 'ホストのモード・難易度・ルームで対戦します', '使用房主的模式、难度和规则', '使用房主的模式、難度與規則', 'Se juega con el modo, la dificultad y las reglas del anfitrión', 'Se joue avec le mode, la difficulté et les règles de l’hôte', 'Gespielt wird mit Modus, Schwierigkeit und Regeln des Hosts'],
    copy: ['번호 복사', 'Copy code', '番号をコピー', '复制房间号', '複製號碼', 'Copiar código', 'Copier le code', 'Code kopieren'],
    copied: ['방 번호를 복사했습니다.', 'Room code copied.', 'ルーム番号をコピーしました。', '已复制房间号。', '已複製房間號碼。', 'Código copiado.', 'Code copié.', 'Code kopiert.'],
    nameHint: ['비워 두면 Google Play 게임즈 이름을 사용합니다', 'Leave empty to use your Google Play Games name', '空欄にすると Google Play ゲームズの名前を使います', '留空则使用 Google Play 游戏名称', '留空則使用 Google Play 遊戲名稱', 'Déjalo vacío para usar tu nombre de Google Play Juegos', 'Laissez vide pour utiliser votre nom Google Play Jeux', 'Leer lassen, um deinen Google Play Spiele-Namen zu verwenden'],
    loginNeed: ['배틀은 Google Play 게임즈에 로그인해야 이용할 수 있습니다.', 'Sign in to Google Play Games to play battles.', 'バトルを遊ぶには Google Play ゲームズへのログインが必要です。', '登录 Google Play 游戏后才能进行对战。', '登入 Google Play 遊戲後才能進行對戰。', 'Inicia sesión en Google Play Juegos para jugar batallas.', 'Connectez-vous à Google Play Jeux pour jouer en duel.', 'Melde dich bei Google Play Spiele an, um Kämpfe zu spielen.'],
    loginStoreOnly: ['배틀은 Google Play 스토어 버전에서 Google Play 게임즈에 로그인한 뒤 이용할 수 있습니다.', 'Battles are available in the Google Play Store version after signing in to Google Play Games.', 'バトルは Google Play ストア版で Google Play ゲームズにログインすると利用できます。', '对战需要在 Google Play 商店版中登录 Google Play 游戏后使用。', '對戰需在 Google Play 商店版登入 Google Play 遊戲後使用。', 'Las batallas están en la versión de Google Play Store tras iniciar sesión en Google Play Juegos.', 'Les duels sont disponibles dans la version Google Play Store après connexion à Google Play Jeux.', 'Kämpfe gibt es in der Google-Play-Store-Version nach Anmeldung bei Google Play Spiele.'],
    loginBusy: ['Google Play 게임즈에 로그인하는 중…', 'Signing in to Google Play Games…', 'Google Play ゲームズにログイン中…', '正在登录 Google Play 游戏…', '正在登入 Google Play 遊戲…', 'Iniciando sesión en Google Play Juegos…', 'Connexion à Google Play Jeux…', 'Anmeldung bei Google Play Spiele…'],
    unranked: ['배치 중', 'Placement', '配置中', '定级中', '定級中', 'Clasificación', 'Placement', 'Platzierung']
  };
  const T = k => (STR[k] ? pickLang(STR[k]) : k);
  const L = o => pickLang(o.names);

  // ---------------------------------------------------------------------------
  // 유틸: 난수 ID, SHA-1, 문자열 변환
  // ---------------------------------------------------------------------------
  const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  function randId(n) {
    const a = new Uint8Array(n);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.random() * 256; });
    let s = '';
    for (let i = 0; i < n; i++) s += ALNUM[a[i] % ALNUM.length];
    return s;
  }

  // 의존성 없는 SHA-1 (file:// 환경에서 crypto.subtle을 못 쓰는 기기 대비)
  function sha1Bytes(str) {
    const msg = new TextEncoder().encode(str);
    const ml = msg.length;
    const withPad = ((ml + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(withPad);
    buf.set(msg);
    buf[ml] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(withPad - 4, (ml * 8) >>> 0);
    dv.setUint32(withPad - 8, Math.floor(ml / 0x20000000));
    let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
    const w = new Uint32Array(80);
    for (let off = 0; off < withPad; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 80; i++) { const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6; }
        const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
        e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
    }
    const out = new Uint8Array(20);
    const ov = new DataView(out.buffer);
    [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
    return out;
  }
  const toHex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const toBinStr = b => String.fromCharCode.apply(null, Array.from(b));

  function guessZone() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) {}
    if (/^(Asia|Australia|Pacific|Indian)\//.test(tz)) return 'asia';
    if (/^(Europe|Africa|Atlantic\/(Reykjavik|Canary|Madeira|Faroe))/.test(tz)) return 'europe';
    if (/^America\//.test(tz)) return 'americas';
    return 'global';
  }

  const store = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  };

  const pick = (list, v, d) => (list.some(x => x.id === v) ? v : d);

  // ---------------------------------------------------------------------------
  // 내 프로필(닉네임 · 국가 · 랭크 티어) — 매칭 상대에게 hello로 보여 줍니다.
  // 상대가 보낸 값은 모두 검증·정리한 뒤 textContent로만 표시합니다.
  // ---------------------------------------------------------------------------
  const LANG_CC = { ko: 'KR', en: 'US', ja: 'JP', zh: 'CN', 'zh-TW': 'TW', es: 'ES', fr: 'FR', de: 'DE' };
  const ROMAN_OK = ['', 'V', 'IV', 'III', 'II', 'I'];
  function cleanName(v) {
    const s = String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069<>]/g, '')
      .replace(/\s+/g, ' ').trim();
    return Array.from(s).slice(0, 16).join('');
  }
  // v2.0.2 · Google Play 게임즈 신원: 닉네임 기본값은 Play 게임즈 표시 이름, 국가는 Google Play 계정 국가.
  const ID = { checked: false, signedIn: false, name: '', id: '', cc: '', reason: '', waiters: [] };
  window.onPlayerProfile = function (p) {
    p = p && typeof p === 'object' ? p : {};
    ID.checked = true;
    ID.signedIn = !!p.signedIn;
    ID.name = cleanName(p.name || '');
    ID.id = typeof p.id === 'string' ? p.id.slice(0, 64) : '';
    ID.cc = /^[A-Z]{2}$/.test(p.cc || '') ? p.cc : (ID.signedIn ? ID.cc : '');
    ID.reason = String(p.reason || '');
    const w = ID.waiters.splice(0);
    w.forEach(fn => { try { fn(ID.signedIn); } catch (_) {} });
    try { UI.render(); } catch (_) {}
  };
  // GitHub판(테스트·사이드로드)은 Play 게임즈가 없으므로 로그인 없이 배틀을 허용합니다. Play판만 로그인 필수.
  const isPlayBuild = () => { try { return window.AndroidBridge?.getDistribution?.() === 'play'; } catch (_) { return false; } };
  const loginGateOn = () => isPlayBuild() && !!window.AndroidBridge?.requestPlayerProfile;
  // GitHub판에서도 Play 이름 대신 쓸 수 있도록 프로필 조회는 시도합니다(없으면 기기 지역·직접 입력 이름 사용).
  /** Play 게임즈 로그인을 확인합니다. interactive=true면 필요할 때 로그인 창을 띄웁니다. */
  function ensurePlayLogin(interactive) {
    if (!loginGateOn()) return Promise.resolve(true);
    if (ID.signedIn) return Promise.resolve(true);
    return new Promise(resolve => {
      let done = false;
      const fin = v => { if (!done) { done = true; resolve(v); } };
      ID.waiters.push(fin);
      setTimeout(() => fin(false), interactive ? 60000 : 8000);
      try { window.AndroidBridge.requestPlayerProfile(!!interactive); } catch (_) { fin(false); }
    });
  }
  function customName() { return cleanName(store.get('sumdoku_online_nick', '')); }
  function myName() {
    return customName() || ID.name || ('Player-' + (ID.id || M.selfId || 'XXXX').slice(-4).toUpperCase());
  }
  function myCountry() {
    if (ID.cc) return ID.cc;
    const langs = [].concat(navigator.languages || [], navigator.language || []);
    for (const l of langs) { const m = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(l || ''); if (m) return m[1].toUpperCase(); }
    return LANG_CC[(window.I18N && I18N.currentLang) || 'ko'] || '';
  }
  const flagOf = cc => (/^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳️');
  function myTier(diff) {
    try {
      const R = window.SumdokuRating;
      const s = R.ladder(R.loadAll(), 'standard').byDiff[diff];
      const t = R.shownTier(s);
      return { id: t.id, div: t.division || '', rp: s && !(s.placement > 0) ? Math.round(s.rating) : 0 };
    } catch (_) { return { id: 'unranked', div: '', rp: 0 }; }
  }
  function cleanTier(t) {
    const ids = ((window.SumdokuRating && SumdokuRating.TIERS) || []).map(x => x.id).concat('unranked');
    if (!t || !ids.includes(t.id)) return { id: 'unranked', div: '', rp: 0 };
    return { id: t.id, div: ROMAN_OK.includes(t.div) ? t.div : '', rp: Math.max(0, Math.min(99999, t.rp | 0)) };
  }
  function tierLabel(t) {
    if (!t || t.id === 'unranked') return T('unranked');
    const def = ((window.SumdokuRating && SumdokuRating.TIERS) || []).find(x => x.id === t.id);
    const tr = window.I18N && typeof I18N.text === 'function' ? I18N.text : (x => x);
    return (def ? tr(def.ko) : t.id) + (t.div ? ' ' + t.div : '');
  }
  // 티어 id·단계는 cleanTier로 허용 목록만 통과하므로 앱 자체 SVG 생성기에 안전하게 넘길 수 있습니다.
  function tierSvg(t, size) {
    try { return window.SumdokuRating.tierSymbol(t.id, size, t.div); } catch (_) { return ''; }
  }
  function myProfile(diff) { return { n: myName(), cc: myCountry(), tier: myTier(diff) }; }
  function cleanProfile(p, fallbackId) {
    const n = cleanName(p && p.n) || ('Player-' + String(fallbackId || '').slice(0, 4).toUpperCase());
    const cc = p && /^[A-Z]{2}$/.test(p.cc || '') ? p.cc : '';
    return { n, cc, tier: cleanTier(p && p.tier) };
  }

  try { const old = localStorage.getItem('sumdoku_online_name'); if (old && !/^Player-[A-Z0-9]{4}$/.test(old) && !localStorage.getItem('sumdoku_online_nick')) localStorage.setItem('sumdoku_online_nick', old); localStorage.removeItem('sumdoku_online_name'); } catch (_) {}

  // ---------------------------------------------------------------------------
  // 매칭 엔진
  // ---------------------------------------------------------------------------
  const M = {
    kind: store.get('sumdoku_online_kind', 'random') === 'room' ? 'room' : 'random', // random | room
    roomRole: '',             // room일 때 create | join
    roomCode: '',
    state: 'idle',            // idle | searching | proposing | matched
    role: 0,                  // 1 방장 / 2 참가자
    selfId: '',
    zone: pick(ZONES, store.get('sumdoku_online_zone', ''), guessZone()),
    mode: pick(MODES, store.get('sumdoku_online_mode', ''), 'race'),
    diff: pick(DIFFS, store.get('sumdoku_online_diff', ''), 'expert'),
    hashBin: '', hashHex: '',
    trackers: [],             // { url, ws, open, timer, interval, waiting }
    offers: new Map(),        // offer_id → { pc, dc, at }
    peers: new Map(),         // remoteId → { pc, dc, via, weOffered, open, hello, rejectedAt }
    partner: null,            // 매칭 확정된 상대 remoteId
    proposeTimer: null,
    statusTimer: null,
    startedAt: 0,
    dht: { nodes: 0, peers: 0, phase: '' },
    seen: new Set(),
    epoch: 0,
    active: false,            // 온라인 세션(매칭~경기~재대결)이 진행 중인지
    tunnelSeq: 0,
    tunnelWait: new Map(),
    chunks: new Map(),
    hostPoll: null,
    hostStarted: false,
    internalCancel: false,

    // ----- 시작 / 정지 -----
    canRun() {
      if (!window.AndroidBridge?.startOnlineBattleServer) return T('noBridge');
      if (typeof RTCPeerConnection === 'undefined') return T('noRtc');
      if (navigator.onLine === false) return T('noNet');
      return '';
    },

    startRandom() {
      this.kind = 'random'; this.roomRole = ''; this.roomCode = '';
      this.start();
    },

    /** 원격 방: role='create'면 새 6자리 번호를 만들고, 'join'이면 받은 번호로 방장을 찾습니다. */
    startRoom(role, code) {
      if (role === 'create') {
        const a = new Uint32Array(1);
        try { crypto.getRandomValues(a); } catch (_) { a[0] = Math.floor(Math.random() * 1e9); }
        code = String(100000 + (a[0] % 900000));
      }
      if (!/^\d{6}$/.test(code || '')) { window.app?.showToast?.(T('roomBad'), 3000); return; }
      this.kind = 'room'; this.roomRole = role; this.roomCode = code;
      this.start();
    },

    start() {
      const err = this.canRun();
      if (err) { window.app?.showToast?.(err, 4500); return; }
      if (loginGateOn() && !ID.signedIn) {
        ensurePlayLogin(true).then(ok => { if (ok) this.start(); else window.app?.showToast?.(ID.reason === 'unavailable' ? T('loginStoreOnly') : T('loginNeed'), 4500); });
        return;
      }
      this.stop(true);
      const app = window.app;
      // 기존 Wi-Fi 방/참가 상태를 정리합니다(내부 호출이므로 온라인 세션은 유지).
      this.internalCancel = true;
      try { app?.cancelRoomPreparation?.(); } finally { this.internalCancel = false; }
      try { window.AndroidBridge?.setBattleNetwork?.(false); } catch (_) {}
      this.active = true;
      this.epoch++;
      this.state = 'searching';
      this.role = 0;
      this.partner = null;
      this.hostStarted = false;
      this.selfId = randId(20);
      this.seen = new Set();
      this.dht = { nodes: 0, peers: 0, phase: '' };
      // 랜덤: 구역×모드×난이도마다 / 방 번호: 번호마다 서로 다른 info_hash를 씁니다.
      const hb = this.kind === 'room'
        ? sha1Bytes(`sumdoku-room|${PROTO}|${this.roomCode}`)
        : sha1Bytes(`sumdoku-match|${PROTO}|${this.zone}|${this.mode}|${this.diff}`);
      this.hashBin = toBinStr(hb);
      this.hashHex = toHex(hb);
      this.startedAt = Date.now();
      TRACKERS.forEach(url => this.openTracker(url));
      try { window.AndroidBridge?.dhtStart?.(this.hashHex, this.selfId); } catch (_) {}
      clearInterval(this.statusTimer);
      this.statusTimer = setInterval(() => { this.gcOffers(); UI.render(); }, 1000);
      UI.render();
    },

    /** 탐색만 멈춥니다(매칭 확정 후). 상대 연결은 유지합니다. */
    stopDiscovery() {
      for (const t of this.trackers) {
        clearTimeout(t.timer);
        try { if (t.ws && t.ws.readyState === 1) t.ws.send(JSON.stringify({ action: 'announce', event: 'stopped', info_hash: this.hashBin, peer_id: this.selfId, numwant: 0, uploaded: 0, downloaded: 0, left: 0 })); } catch (_) {}
        try { t.ws && t.ws.close(); } catch (_) {}
      }
      this.trackers = [];
      for (const o of this.offers.values()) { try { o.pc.close(); } catch (_) {} }
      this.offers.clear();
      try { window.AndroidBridge?.dhtStop?.(); } catch (_) {}
    },

    /** 전부 정리합니다. keepActive=true면 다시 시작하기 직전의 정리입니다. */
    stop(keepActive) {
      this.stopDiscovery();
      clearInterval(this.statusTimer); this.statusTimer = null;
      clearTimeout(this.proposeTimer); this.proposeTimer = null;
      clearInterval(this.hostPoll); this.hostPoll = null;
      for (const p of this.peers.values()) this.closePeer(p);
      this.peers.clear();
      for (const w of this.tunnelWait.values()) { clearTimeout(w.timer); w.reject(new Error('P2P 연결이 종료되었습니다.')); }
      this.tunnelWait.clear();
      this.chunks.clear();
      this.partner = null;
      this.state = 'idle';
      this.role = 0;
      if (!keepActive) {
        this.active = false;
        this.mode = pick(MODES, store.get('sumdoku_online_mode', ''), 'race');
        this.diff = pick(DIFFS, store.get('sumdoku_online_diff', ''), 'expert');
      }
      UI.render();
    },

    leave() {
      if (!this.active && this.state === 'idle') return;
      const wasHost = this.role === 1;
      // 참가자의 /api/leave 같은 마지막 메시지가 나갈 시간을 잠깐 줍니다.
      setTimeout(() => {
        this.stop(false);
        if (wasHost) try { window.AndroidBridge?.stopBattleServer?.(); } catch (_) {}
      }, 350);
      this.active = false;
    },

    // ----- WebRTC -----
    newPC() {
      return new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 0 });
    },

    waitIce(pc) {
      if (pc.iceGatheringState === 'complete') return Promise.resolve();
      return new Promise(resolve => {
        const done = () => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', check); resolve(); };
        const check = () => { if (pc.iceGatheringState === 'complete') done(); };
        const timer = setTimeout(done, ICE_WAIT_MS);
        pc.addEventListener('icegatheringstatechange', check);
      });
    },

    async makeOffer() {
      const pc = this.newPC();
      const dc = pc.createDataChannel('sumdoku', { ordered: true });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.waitIce(pc);
      return { pc, dc, sdp: pc.localDescription.sdp };
    },

    async makeAnswer(sdp) {
      const pc = this.newPC();
      const dcPromise = new Promise(resolve => { pc.ondatachannel = e => resolve(e.channel); });
      await pc.setRemoteDescription({ type: 'offer', sdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.waitIce(pc);
      return { pc, dcPromise, sdp: pc.localDescription.sdp };
    },

    /** 같은 상대와 연결이 두 개 생기면 작은 ID가 offer한 연결만 남깁니다(양쪽이 같은 결론). */
    shouldKeepIncoming(remoteId) {
      const ex = this.peers.get(remoteId);
      if (!ex) return true;
      if (ex.open) return false;
      // 기존 연결이 내가 offer한 것이면, 내 ID가 더 작을 때 내 것을 유지합니다.
      if (ex.weOffered) {
        if (this.selfId < remoteId) return false;
        this.closePeer(ex); this.peers.delete(remoteId);
        return true;
      }
      return false;
    },

    registerPeer(remoteId, pc, via, weOffered) {
      const peer = { id: remoteId, pc, dc: null, via, weOffered, open: false, hello: null, rejectedAt: 0, epoch: this.epoch };
      this.peers.set(remoteId, peer);
      this.seen.add(remoteId);
      pc.addEventListener('connectionstatechange', () => {
        if (['failed', 'closed'].includes(pc.connectionState)) this.onPeerGone(peer);
        else if (pc.connectionState === 'disconnected') {
          clearTimeout(peer.discTimer);
          peer.discTimer = setTimeout(() => { if (pc.connectionState === 'disconnected') this.onPeerGone(peer); }, 6000);
        }
      });
      // 열리지 않는 연결은 20초 뒤 정리합니다.
      setTimeout(() => { if (!peer.open && this.peers.get(remoteId) === peer) { this.closePeer(peer); this.peers.delete(remoteId); } }, 20000);
      return peer;
    },

    attachChannel(peer, dc) {
      peer.dc = dc;
      dc.onopen = () => {
        peer.open = true;
        this.sendTo(peer, { t: 'hello', id: this.selfId, proto: PROTO, kind: this.kind, roomRole: this.roomRole, code: this.roomCode, zone: this.zone, mode: this.mode, diff: this.diff, free: this.state === 'searching', ver: window.AndroidBridge?.getVersion?.() || '', p: myProfile(this.diff) });
        UI.render();
      };
      dc.onmessage = e => this.onData(peer, e.data);
      dc.onclose = () => this.onPeerGone(peer);
      if (dc.readyState === 'open') dc.onopen();
    },

    closePeer(peer) {
      if (!peer) return;
      peer.closed = true;
      clearTimeout(peer.discTimer);
      try { peer.dc && peer.dc.close(); } catch (_) {}
      try { peer.pc && peer.pc.close(); } catch (_) {}
    },

    onPeerGone(peer) {
      if (peer.gone) return;
      peer.gone = true;
      if (this.peers.get(peer.id) === peer) this.peers.delete(peer.id);
      this.closePeer(peer);
      if (peer.id !== this.partner) {
        if (this.state === 'proposing' && this.proposeTarget === peer.id) this.backToSearching();
        return;
      }
      // 매칭된 상대가 끊겼습니다.
      for (const w of this.tunnelWait.values()) { clearTimeout(w.timer); w.reject(new Error('P2P 연결이 끊어졌습니다.')); }
      this.tunnelWait.clear();
      const app = window.app;
      if (app?.isBattle) {
        app.showToast?.(T('lostInGame'), 4000);
        // 방장: 참가자 이탈로 처리(기권승). 참가자: 기존 배틀 로직이 방장 응답 없음을 처리합니다.
        if (this.role === 1) fetch('http://127.0.0.1:8888/api/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: 2 }) }).catch(() => {});
        this.partner = null;
        return;
      }
      if (!this.active) return;
      app?.showToast?.(T('lost'), 3500);
      this.start();
    },

    // ----- 메시지 -----
    sendTo(peer, obj) {
      if (!peer?.dc || peer.dc.readyState !== 'open') return false;
      const s = JSON.stringify(obj);
      const LIM = 60000;
      try {
        if (s.length <= LIM) peer.dc.send(s);
        else {
          const id = randId(8), n = Math.ceil(s.length / LIM);
          for (let i = 0; i < n; i++) peer.dc.send(JSON.stringify({ t: 'chunk', id, i, n, d: s.slice(i * LIM, (i + 1) * LIM) }));
        }
        return true;
      } catch (_) { return false; }
    },

    onData(peer, raw) {
      let msg;
      try { msg = JSON.parse(raw); } catch (_) { return; }
      if (!msg || typeof msg.t !== 'string') return;
      if (msg.t === 'chunk') {
        if (typeof msg.id !== 'string' || !(msg.n > 0 && msg.n < 200) || !(msg.i >= 0 && msg.i < msg.n)) return;
        let c = this.chunks.get(msg.id);
        if (!c) { c = { parts: new Array(msg.n), got: 0 }; this.chunks.set(msg.id, c); }
        if (c.parts[msg.i] === undefined) { c.parts[msg.i] = String(msg.d || ''); c.got++; }
        if (c.got === msg.n) { this.chunks.delete(msg.id); this.onData(peer, c.parts.join('')); }
        return;
      }
      switch (msg.t) {
        case 'hello': return this.onHello(peer, msg);
        case 'propose': return this.onPropose(peer);
        case 'accept': return this.onAccept(peer);
        case 'reject': return this.onReject(peer);
        case 'room': return this.onRoomReady(peer);
        case 'req': return this.onTunnelRequest(peer, msg);
        case 'res': return this.onTunnelResponse(msg);
        case 'bye': return this.onPeerGone(peer);
      }
    },

    onHello(peer, msg) {
      const okRandom = this.kind === 'random' && msg.kind !== 'room' && msg.zone === this.zone && msg.mode === this.mode && msg.diff === this.diff;
      // 방 번호: 같은 번호이고, 한쪽은 방장(create)·한쪽은 참가자(join)여야 합니다.
      const okRoom = this.kind === 'room' && msg.kind === 'room' && msg.code === this.roomCode && ['create', 'join'].includes(msg.roomRole) && msg.roomRole !== this.roomRole
        && MODES.some(x => x.id === msg.mode) && DIFFS.some(x => x.id === msg.diff);
      if (msg.id !== peer.id || msg.proto !== PROTO || !(okRandom || okRoom)) {
        this.closePeer(peer); this.peers.delete(peer.id); return;
      }
      peer.hello = msg;
      peer.profile = cleanProfile(msg.p, peer.id);
      UI.render();
      this.tryPropose();
    },

    tryPropose() {
      if (this.state !== 'searching') return;
      const now = Date.now();
      // 랜덤: 작은 ID가 제안 / 방 번호: 참가자가 방장에게 제안합니다.
      if (this.kind === 'room' && this.roomRole !== 'join') return;
      const candidates = [...this.peers.values()].filter(p => p.open && p.hello && p.hello.free && now - p.rejectedAt > 8000
        && (this.kind === 'room' ? p.hello.roomRole === 'create' : this.selfId < p.id));
      if (!candidates.length) return;
      const target = candidates[0];
      this.state = 'proposing';
      this.proposeTarget = target.id;
      this.sendTo(target, { t: 'propose', id: this.selfId });
      clearTimeout(this.proposeTimer);
      this.proposeTimer = setTimeout(() => {
        if (this.state === 'proposing' && this.proposeTarget === target.id) { target.rejectedAt = Date.now(); this.backToSearching(); }
      }, PROPOSE_TIMEOUT_MS);
      UI.render();
    },

    backToSearching() {
      if (this.state !== 'proposing') return;
      clearTimeout(this.proposeTimer);
      this.state = 'searching';
      this.proposeTarget = null;
      UI.render();
      setTimeout(() => this.tryPropose(), 300);
    },

    onPropose(peer) {
      // 제안은 항상 작은 ID 쪽이 보냅니다. 나는 찾는 중일 때만 수락합니다.
      if (this.kind === 'room') {
        // 방장만 수락합니다. 먼저 온 참가자 한 명과 연결되고, 방장이 경기 호스트가 됩니다.
        if (this.state === 'searching' && this.roomRole === 'create' && peer.hello?.roomRole === 'join') {
          this.sendTo(peer, { t: 'accept' });
          this.confirmMatch(peer, 1);
        } else this.sendTo(peer, { t: 'reject' });
        return;
      }
      if (this.state === 'searching' && peer.id < this.selfId && peer.hello) {
        this.sendTo(peer, { t: 'accept' });
        this.confirmMatch(peer, 2);
      } else this.sendTo(peer, { t: 'reject' });
    },

    onAccept(peer) {
      if (this.state !== 'proposing' || this.proposeTarget !== peer.id) { this.sendTo(peer, { t: 'bye' }); return; }
      clearTimeout(this.proposeTimer);
      if (this.kind === 'room') {
        // 참가자: 방장이 고른 모드·난이도를 따릅니다(내 저장된 선택은 바꾸지 않음).
        this.mode = pick(MODES, peer.hello?.mode, this.mode);
        this.diff = pick(DIFFS, peer.hello?.diff, this.diff);
        this.confirmMatch(peer, 2);
        return;
      }
      this.confirmMatch(peer, 1);
    },

    onReject(peer) {
      peer.rejectedAt = Date.now();
      if (this.state === 'proposing' && this.proposeTarget === peer.id) this.backToSearching();
    },

    confirmMatch(peer, role) {
      this.state = 'matched';
      this.role = role;
      this.partner = peer.id;
      this.partnerProfile = peer.profile || cleanProfile(null, peer.id);
      this.proposeTarget = null;
      this.stopDiscovery();
      for (const p of [...this.peers.values()]) if (p !== peer) { this.sendTo(p, { t: 'bye' }); this.closePeer(p); this.peers.delete(p.id); }
      window.app?.sound?.play?.('click');
      try { navigator.vibrate?.(60); } catch (_) {}
      UI.render();
      if (role === 1) this.setupHost(peer);
    },

    // ----- 방장 / 참가자 연결 -----
    async setupHost(peer) {
      const app = window.app;
      const epoch = this.epoch;
      try {
        this.internalCancel = true;
        try { app.cancelRoomPreparation?.(); } finally { this.internalCancel = false; }
        app.battleMode = this.mode;
        app.battleDiff = this.diff;
        const rulesSrc = this.kind === 'room' ? (app.settings || FIXED_RULES) : FIXED_RULES;
        const dummy = { difficulty: this.diff, rules: window.normalizedRules ? window.normalizedRules(rulesSrc, this.mode) : FIXED_RULES, online: true };
        const res = JSON.parse(window.AndroidBridge.startOnlineBattleServer(this.mode, this.diff, this.mode === 'score' ? 300 : 0, JSON.stringify(dummy)));
        if (!res.ok) throw new Error('server');
        app.battleRole = 1;
        app.battleHostIp = '127.0.0.1';
        app.battleRoomCode = '';
        app.hostRoomCreated = true;
        app.hostP1Ready = true;
        app.hostP2Ready = false;
        app.guestJoined = false;
        app.battlePuzzleData = null;
        await fetch('http://127.0.0.1:8888/api/ready', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: 1, ready: true }) });
        if (epoch !== this.epoch) return;
        this.sendTo(peer, { t: 'room' });
        this.hostStarted = false;
        clearInterval(this.hostPoll);
        this.hostPoll = setInterval(async () => {
          if (epoch !== this.epoch || this.hostStarted) return;
          try {
            const st = await (await fetch('http://127.0.0.1:8888/api/status')).json();
            app.guestJoined = !!st.guestJoined;
            app.hostP1Ready = !!st.p1Ready;
            app.hostP2Ready = !!st.p2Ready;
            if (st.guestJoined && st.p2Ready && !this.hostStarted && !app.battleStarting) {
              this.hostStarted = true;
              clearInterval(this.hostPoll);
              app.startBattleAsHost();
            }
          } catch (_) {}
        }, 500);
      } catch (e) {
        app.showToast?.(T('hostFail'), 3500);
        this.sendTo(peer, { t: 'bye' });
        this.start();
      }
    },

    async onRoomReady(peer) {
      if (this.role !== 2 || peer.id !== this.partner) return;
      const app = window.app;
      try {
        this.internalCancel = true;
        try { app.cancelRoomPreparation?.(); } finally { this.internalCancel = false; }
        app.battleMode = this.mode;
        app.battleDiff = this.diff;
        app.battleRole = 2;
        app.battleHostUrl = HOST;
        app.guestP1Ready = true;
        app.guestP2Ready = false;
        const join = await this.tunnelFetch(`${HOST}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const jr = await join.json().catch(() => ({}));
        if (!join.ok || !jr.ok) throw new Error('join');
        await this.tunnelFetch(`${HOST}/api/ready`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: 2, ready: true }) });
        app.guestP2Ready = true;
        // 기존 참가자 폴링이 퍼즐 생성 진행·경기 시작을 그대로 처리합니다.
        app.startGuestPolling();
      } catch (_) {
        app.showToast?.(T('lost'), 3500);
        this.sendTo(peer, { t: 'bye' });
        this.start();
      }
    },

    // ----- fetch 터널 -----
    tunnelFetch(url, options = {}) {
      return new Promise((resolve, reject) => {
        const peer = this.partner && this.peers.get(this.partner);
        if (!peer || !peer.open) { reject(new TypeError('Failed to fetch (P2P)')); return; }
        const path = String(url).slice(HOST.length) || '/';
        const id = ++this.tunnelSeq;
        const signal = options.signal;
        if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
        const timer = setTimeout(() => { this.tunnelWait.delete(id); reject(new TypeError('P2P timeout')); }, TUNNEL_TIMEOUT_MS);
        const entry = { resolve, reject, timer };
        this.tunnelWait.set(id, entry);
        if (signal) signal.addEventListener('abort', () => { if (this.tunnelWait.delete(id)) { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); } }, { once: true });
        let body = options.body;
        if (body != null && typeof body !== 'string') { try { body = String(body); } catch (_) { body = ''; } }
        const ok = this.sendTo(peer, { t: 'req', id, m: String(options.method || 'GET').toUpperCase(), p: path, b: body == null ? null : body });
        if (!ok) { this.tunnelWait.delete(id); clearTimeout(timer); reject(new TypeError('Failed to fetch (P2P)')); }
      });
    },

    onTunnelResponse(msg) {
      const w = this.tunnelWait.get(msg.id);
      if (!w) return;
      this.tunnelWait.delete(msg.id);
      clearTimeout(w.timer);
      const status = Number.isInteger(msg.s) && msg.s >= 200 && msg.s <= 599 ? msg.s : 502;
      w.resolve(new Response(typeof msg.b === 'string' ? msg.b : '', { status, headers: { 'Content-Type': 'application/json' } }));
    },

    /** 방장 기기: 상대의 요청을 검사한 뒤 내 루프백 BattleServer로 전달합니다. */
    async onTunnelRequest(peer, msg) {
      const reply = (s, b) => this.sendTo(peer, { t: 'res', id: msg.id, s, b });
      if (this.role !== 1 || peer.id !== this.partner) return reply(403, '{"ok":false}');
      const path = typeof msg.p === 'string' ? msg.p : '';
      const method = msg.m === 'POST' ? 'POST' : 'GET';
      // 참가자가 방장 권한 API를 부르거나 1P를 사칭하지 못하게 막습니다.
      if (!/^\/api\/[a-z]+(\?[A-Za-z0-9=&_-]*)?$/.test(path)) return reply(400, '{"ok":false}');
      const endpoint = path.split('?')[0];
      if (['/api/close', '/api/start'].includes(endpoint) || (endpoint === '/api/generating' && method === 'POST')) return reply(403, '{"ok":false,"error":"forbidden"}');
      const body = typeof msg.b === 'string' ? msg.b : null;
      if (body && body.length > 200000) return reply(413, '{"ok":false}');
      if (body && /"player"\s*:\s*"?1"?\s*[,}]/.test(body)) return reply(403, '{"ok":false,"error":"forbidden"}');
      try {
        const res = await fetch('http://127.0.0.1:8888' + path, method === 'POST' ? { method, headers: { 'Content-Type': 'application/json' }, body: body || '' } : { method });
        reply(res.status, await res.text());
      } catch (_) { reply(502, '{"ok":false}'); }
    },

    // ----- BitTorrent 트래커 (WebTorrent WebSocket 프로토콜) -----
    openTracker(url) {
      const t = { url, ws: null, open: false, timer: null, interval: ANNOUNCE_MIN_SEC, waiting: 0, fails: 0, epoch: this.epoch };
      this.trackers.push(t);
      const connect = () => {
        if (t.epoch !== this.epoch || this.state === 'matched' || this.state === 'idle') return;
        let ws;
        try { ws = new WebSocket(url); } catch (_) { return; }
        t.ws = ws;
        ws.onopen = () => { t.open = true; t.fails = 0; this.announce(t, true); UI.render(); };
        ws.onmessage = e => this.onTrackerMessage(t, e.data);
        ws.onerror = () => {};
        ws.onclose = () => {
          t.open = false;
          clearTimeout(t.timer);
          UI.render();
          if (t.epoch !== this.epoch || this.state === 'matched' || this.state === 'idle') return;
          t.fails++;
          t.timer = setTimeout(connect, Math.min(30000, 2000 * Math.pow(2, t.fails)));
        };
      };
      connect();
    },

    async announce(t, first) {
      if (!t.open || t.epoch !== this.epoch || (this.state !== 'searching' && this.state !== 'proposing')) return;
      clearTimeout(t.timer);
      // offer 풀은 모든 트래커가 함께 씁니다(같은 offer에 먼저 도착한 answer만 사용).
      const offers = await this.offerPool();
      if (!t.open || t.epoch !== this.epoch) return;
      const msg = { action: 'announce', info_hash: this.hashBin, peer_id: this.selfId, numwant: OFFER_POOL, uploaded: 0, downloaded: 0, left: 1, offers: offers.map(o => ({ offer_id: o.id, offer: { type: 'offer', sdp: o.sdp } })) };
      if (first) msg.event = 'started';
      try { t.ws.send(JSON.stringify(msg)); } catch (_) {}
      t.timer = setTimeout(() => this.announce(t, false), t.interval * 1000);
    },

    async offerPool() {
      const now = Date.now();
      if (this._pool && now - this._poolAt < (ANNOUNCE_MIN_SEC - 3) * 1000) return this._pool;
      if (this._poolBusy) return this._poolBusy;
      this._poolBusy = (async () => {
        const list = [];
        const made = await Promise.all(Array.from({ length: OFFER_POOL }, () => this.makeOffer().catch(() => null)));
        for (const o of made) {
          if (!o) continue;
          const id = randId(20);
          this.offers.set(id, { pc: o.pc, dc: o.dc, at: Date.now() });
          list.push({ id, sdp: o.sdp });
        }
        this._pool = list; this._poolAt = Date.now(); this._poolBusy = null;
        return list;
      })();
      return this._poolBusy;
    },

    gcOffers() {
      const now = Date.now();
      for (const [id, o] of this.offers) if (now - o.at > OFFER_TTL_MS) { try { o.pc.close(); } catch (_) {} this.offers.delete(id); }
    },

    async onTrackerMessage(t, raw) {
      let msg;
      try { msg = JSON.parse(raw); } catch (_) { return; }
      if (!msg || msg.info_hash !== this.hashBin) return;
      if (msg['failure reason']) return;
      if (msg.interval) t.interval = Math.max(ANNOUNCE_MIN_SEC, Math.min(120, +msg.interval || ANNOUNCE_MIN_SEC));
      if (typeof msg.complete === 'number' || typeof msg.incomplete === 'number') { t.waiting = (+msg.complete || 0) + (+msg.incomplete || 0); UI.render(); }
      const remote = msg.peer_id;
      if (!remote || remote === this.selfId || !/^[\x20-\x7e]{20}$/.test(remote)) return;
      if (this.state !== 'searching' && this.state !== 'proposing') return;

      if (msg.offer && msg.offer_id) {
        if (!this.shouldKeepIncoming(remote)) return;
        try {
          const a = await this.makeAnswer(msg.offer.sdp);
          if (!t.open || this.state === 'matched' || this.state === 'idle') { a.pc.close(); return; }
          if (this.peers.has(remote)) { a.pc.close(); return; }
          const peer = this.registerPeer(remote, a.pc, 'tracker', false);
          a.dcPromise.then(dc => this.attachChannel(peer, dc));
          t.ws.send(JSON.stringify({ action: 'announce', info_hash: this.hashBin, peer_id: this.selfId, to_peer_id: remote, answer: { type: 'answer', sdp: a.sdp }, offer_id: msg.offer_id }));
          UI.render();
        } catch (_) {}
      } else if (msg.answer && msg.offer_id) {
        const o = this.offers.get(msg.offer_id);
        if (!o) return;
        const ex = this.peers.get(remote);
        if (ex && (ex.open || this.selfId > remote)) return; // 상대가 offer한 연결을 유지
        if (ex) { this.closePeer(ex); this.peers.delete(remote); }
        this.offers.delete(msg.offer_id);
        if (this._pool) this._pool = this._pool.filter(x => x.id !== msg.offer_id);
        try {
          await o.pc.setRemoteDescription({ type: 'answer', sdp: msg.answer.sdp });
          const peer = this.registerPeer(remote, o.pc, 'tracker', true);
          this.attachChannel(peer, o.dc);
          UI.render();
        } catch (_) { try { o.pc.close(); } catch (__) {} }
      }
    },

    // ----- Mainline DHT 시그널링 (네이티브 콜백) -----
    async onDhtPeer(addr, remote) {
      if (this.state !== 'searching' && this.state !== 'proposing') return;
      if (!/^[A-Za-z0-9]{20}$/.test(remote) || remote === this.selfId) return;
      this.seen.add(remote);
      UI.render();
      // 작은 ID가 offer를 만듭니다(트래커와 같은 규칙). 이미 연결이 있으면 생략합니다.
      if (this.peers.has(remote) || this.selfId > remote) return;
      try {
        const o = await this.makeOffer();
        if (this.peers.has(remote) || this.state === 'matched' || this.state === 'idle') { o.pc.close(); return; }
        const peer = this.registerPeer(remote, o.pc, 'dht', true);
        peer.dhtAddr = addr;
        peer.pendingDc = o.dc;
        window.AndroidBridge?.dhtSend?.(addr, JSON.stringify({ t: 'offer', from: this.selfId, to: remote, h: this.hashHex, sdp: o.sdp }));
      } catch (_) {}
    },

    async onDhtMessage(addr, text) {
      let msg;
      try { msg = JSON.parse(text); } catch (_) { return; }
      if (!msg || msg.h !== this.hashHex || msg.to !== this.selfId || !/^[A-Za-z0-9]{20}$/.test(msg.from || '')) return;
      if (this.state !== 'searching' && this.state !== 'proposing') return;
      const remote = msg.from;
      if (msg.t === 'offer' && typeof msg.sdp === 'string') {
        if (!this.shouldKeepIncoming(remote)) return;
        try {
          const a = await this.makeAnswer(msg.sdp);
          if (this.peers.has(remote) || this.state === 'matched' || this.state === 'idle') { a.pc.close(); return; }
          const peer = this.registerPeer(remote, a.pc, 'dht', false);
          a.dcPromise.then(dc => this.attachChannel(peer, dc));
          window.AndroidBridge?.dhtSend?.(addr, JSON.stringify({ t: 'answer', from: this.selfId, to: remote, h: this.hashHex, sdp: a.sdp }));
        } catch (_) {}
      } else if (msg.t === 'answer' && typeof msg.sdp === 'string') {
        const peer = this.peers.get(remote);
        if (!peer || peer.via !== 'dht' || !peer.weOffered || !peer.pendingDc) return;
        const dc = peer.pendingDc; peer.pendingDc = null;
        try { await peer.pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp }); this.attachChannel(peer, dc); } catch (_) {}
      }
    },

    onDhtStatus(s) {
      if (s && typeof s === 'object') { this.dht = { nodes: s.nodes | 0, peers: s.peers | 0, phase: String(s.phase || '') }; UI.render(); }
    },

    setZone(z) { if (ZONES.some(x => x.id === z)) { this.zone = z; store.set('sumdoku_online_zone', z); this.restartIfSearching(); } },
    setMode(m) { if (MODES.some(x => x.id === m)) { this.mode = m; store.set('sumdoku_online_mode', m); this.restartIfSearching(); } },
    setDiff(d) { if (DIFFS.some(x => x.id === d)) { this.diff = d; store.set('sumdoku_online_diff', d); this.restartIfSearching(); } },
    restartIfSearching() { if (this.state === 'searching' || this.state === 'proposing') this.start(); else UI.render(); }
  };

  window.onDhtPeer = (addr, id) => M.onDhtPeer(addr, id);
  window.onDhtMessage = (addr, text) => M.onDhtMessage(addr, text);
  window.onDhtStatus = s => M.onDhtStatus(s);

  // ---------------------------------------------------------------------------
  // fetch 터널: 'p2p://host/...' 요청을 DataChannel로 보냅니다.
  // ---------------------------------------------------------------------------
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.startsWith(HOST)) return M.tunnelFetch(url, init || {});
    return nativeFetch(input, init);
  };

  // 온라인 경기 중에는 개인 설정 대신 공정 고정 규칙을 사용합니다.
  if (typeof window.normalizedRules === 'function') {
    const baseRules = window.normalizedRules;
    window.normalizedRules = function (settings, battleMode) {
      // 랜덤 매칭만 공정 고정 규칙. 방 번호 배틀은 같은 Wi-Fi 방처럼 방장 설정을 씁니다.
      if (M.active && M.kind === 'random' && (M.state === 'matched' || window.app?.isBattle)) return baseRules(FIXED_RULES, battleMode);
      return baseRules(settings, battleMode);
    };
  }

  // ---------------------------------------------------------------------------
  // UI: 배틀 로비에 '🌐 온라인' 탭 추가
  // ---------------------------------------------------------------------------
  const UI = {
    built: false,
    el: {},

    build() {
      if (this.built) return true;
      const app = window.app;
      const tabs = document.querySelector('#modal-battle-lobby .battle-lobby-tabs');
      const joinView = document.getElementById('battle-join-view');
      // 주의: 앱 객체가 생기기 전 window.app은 <div id="app"> 요소를 가리킵니다(named access). dom으로 구분합니다.
      if (!app || !app.dom || !app.dom.tabBattleHost || !tabs || !joinView) return false;
      this.built = true;

      const tab = document.createElement('button');
      tab.id = 'tab-battle-online';
      tab.className = 'battle-tab-btn online-tab';
      tab.type = 'button';
      tabs.append(tab);

      const view = document.createElement('div');
      view.id = 'battle-online-view';
      view.className = 'battle-view-section online-view hidden';
      view.innerHTML = `
        <div class="om-hero">
          <div class="om-globe" aria-hidden="true"><span class="om-orbit"></span><span class="om-orbit o2"></span><span class="om-core">🌐</span></div>
          <div class="om-hero-text"><strong class="om-title"></strong><p class="om-intro"></p></div>
        </div>
        <label class="om-label" data-k="name" for="om-name-input"></label>
        <div class="om-name-row"><span class="om-name-flag"></span><input id="om-name-input" class="om-name-input" type="text" maxlength="16" autocomplete="nickname" spellcheck="false" enterkeyhint="done"><span class="om-name-tier"></span></div>
        <div class="om-name-hint"></div>
        <div class="om-kinds" role="tablist">
          <button type="button" class="om-kind" data-kind="random" role="tab"></button>
          <button type="button" class="om-kind" data-kind="room" role="tab"></button>
        </div>
        <div class="om-only-room om-room-intro"></div>
        <div class="om-only-random">
          <div class="om-label" data-k="zone"></div>
          <div class="om-zones" role="radiogroup"></div>
          <div class="om-zone-hint"></div>
        </div>
        <div class="om-label" data-k="mode"></div>
        <div class="om-chips om-modes" role="radiogroup"></div>
        <div class="om-label" data-k="diff"></div>
        <div class="om-chips om-diffs" role="radiogroup"></div>
        <div class="om-rules"></div>
        <div class="om-only-room om-room-box">
          <div class="om-room-live hidden">
            <div class="om-label" data-k="roomCodeLabel"></div>
            <button type="button" class="om-room-code" title=""></button>
            <button type="button" class="btn btn-secondary om-room-copy"></button>
          </div>
          <div class="om-room-actions">
            <button type="button" class="btn btn-primary om-room-create"></button>
            <div class="om-room-join-row">
              <input class="om-room-input" type="text" inputmode="numeric" maxlength="7" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="room code">
              <button type="button" class="btn btn-secondary om-room-join"></button>
            </div>
          </div>
        </div>
        <div class="om-status hidden" aria-live="polite">
          <div class="om-radar" aria-hidden="true"><span></span><span></span><span></span></div>
          <div class="om-status-text"></div>
          <div class="om-stats"></div>
          <div class="om-slow hidden"><span></span><button type="button" class="btn btn-secondary om-to-global"></button></div>
        </div>
        <div class="om-matched hidden"></div>
        <p class="om-nat"></p>
        <div class="modal-footer"><button type="button" class="btn btn-primary om-start"></button></div>`;
      joinView.after(view);

      this.el = {
        tab, view,
        nameInput: view.querySelector('.om-name-input'), nameFlag: view.querySelector('.om-name-flag'), nameTier: view.querySelector('.om-name-tier'),
        title: view.querySelector('.om-title'), intro: view.querySelector('.om-intro'),
        zones: view.querySelector('.om-zones'), zoneHint: view.querySelector('.om-zone-hint'),
        modes: view.querySelector('.om-modes'), diffs: view.querySelector('.om-diffs'),
        rules: view.querySelector('.om-rules'), status: view.querySelector('.om-status'),
        statusText: view.querySelector('.om-status-text'), stats: view.querySelector('.om-stats'),
        slow: view.querySelector('.om-slow'), toGlobal: view.querySelector('.om-to-global'),
        matched: view.querySelector('.om-matched'), nat: view.querySelector('.om-nat'),
        start: view.querySelector('.om-start'),
        nameHint: view.querySelector('.om-name-hint'),
        kinds: view.querySelectorAll('.om-kind'), roomIntro: view.querySelector('.om-room-intro'),
        roomLive: view.querySelector('.om-room-live'), roomCode: view.querySelector('.om-room-code'), roomCopy: view.querySelector('.om-room-copy'),
        roomActions: view.querySelector('.om-room-actions'), roomCreate: view.querySelector('.om-room-create'),
        roomInput: view.querySelector('.om-room-input'), roomJoin: view.querySelector('.om-room-join')
      };

      tab.addEventListener('click', () => { app.sound?.play?.('click'); this.show(); });
      // 기존 탭을 누르면 온라인 화면을 숨기고 매칭을 끝냅니다.
      [app.dom.tabBattleHost, app.dom.tabBattleJoin].forEach(b => b && b.addEventListener('click', () => {
        if (M.active) M.leave();
        tab.classList.remove('active');
        view.classList.add('hidden');
        store.set('sumdoku_last_battle_tab', b === app.dom.tabBattleHost ? 'host' : 'join');
      }, true));

      this.el.start.addEventListener('click', () => {
        app.sound?.play?.('click');
        if (M.state === 'idle') M.startRandom(); else { M.leave(); setTimeout(() => this.render(), 400); }
      });
      // 닉네임: 비워 두거나 Play 이름과 같으면 Google Play 게임즈 이름을 계속 따라갑니다.
      this.el.nameInput.value = customName();
      this.el.nameInput.addEventListener('change', () => {
        const v = cleanName(this.el.nameInput.value);
        if (!v || v === ID.name) { try { localStorage.removeItem('sumdoku_online_nick'); } catch (_) {} }
        else store.set('sumdoku_online_nick', v);
        this.el.nameInput.value = customName();
        this.render();
      });
      this.el.kinds.forEach(b => b.addEventListener('click', () => {
        if (M.state !== 'idle') return;
        app.sound?.play?.('click');
        M.kind = b.dataset.kind === 'room' ? 'room' : 'random';
        store.set('sumdoku_online_kind', M.kind);
        this.render();
      }));
      this.el.roomCreate.addEventListener('click', () => { app.sound?.play?.('click'); M.startRoom('create'); });
      const join = () => {
        app.sound?.play?.('click');
        const code = String(this.el.roomInput.value || '').replace(/\D/g, '');
        if (code.length !== 6) { this.el.roomInput.setAttribute('aria-invalid', 'true'); app.showToast?.(T('roomBad'), 2500); return; }
        this.el.roomInput.removeAttribute('aria-invalid');
        M.startRoom('join', code);
      };
      this.el.roomJoin.addEventListener('click', join);
      this.el.roomInput.addEventListener('keydown', ev => { if (ev.key === 'Enter') join(); });
      this.el.roomInput.addEventListener('input', () => {
        const d = this.el.roomInput.value.replace(/\D/g, '').slice(0, 6);
        this.el.roomInput.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d;
      });
      const copy = async () => {
        if (!M.roomCode) return;
        let ok = false;
        try { if (window.AndroidBridge?.copyToClipboard) { AndroidBridge.copyToClipboard(M.roomCode); ok = true; } else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(M.roomCode); ok = true; } } catch (_) {}
        if (ok) app.showToast?.(T('copied') + ` (${M.roomCode})`, 2500);
      };
      this.el.roomCode.addEventListener('click', copy);
      this.el.roomCopy.addEventListener('click', copy);
      this.el.toGlobal.addEventListener('click', () => { app.sound?.play?.('click'); M.setZone('global'); this.renderPickers(); });
      this.renderPickers();
      this.render();
      return true;
    },

    /** remember=false: Wi-Fi가 없어 자동으로 연 경우처럼 사용자가 고르지 않은 전환은 기억하지 않습니다. */
    show(remember = true) {
      if (!this.build()) return;
      const app = window.app;
      const host = app.dom.battleHostView, join = app.dom.battleJoinView;
      if (!M.active) {
        // 열려 있던 Wi-Fi 방은 닫습니다.
        M.internalCancel = true;
        try { app.cancelRoomPreparation?.(); } finally { M.internalCancel = false; }
      }
      app.dom.tabBattleHost.classList.remove('active');
      app.dom.tabBattleJoin.classList.remove('active');
      this.el.tab.classList.add('active');
      host.classList.add('hidden');
      join.classList.add('hidden');
      this.el.view.classList.remove('hidden');
      document.getElementById('battle-mobile-data-warning')?.remove();
      if (remember) store.set('sumdoku_last_battle_tab', 'online');
      this.renderPickers();
      this.render();
    },

    renderPickers() {
      if (!this.built) return;
      const mk = (wrap, list, cur, cls, onPick, labelFn) => {
        wrap.innerHTML = '';
        for (const it of list) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = cls + (it.id === cur ? ' active' : '');
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', it.id === cur ? 'true' : 'false');
          b.innerHTML = labelFn(it);
          b.addEventListener('click', () => { window.app?.sound?.play?.('click'); onPick(it.id); this.renderPickers(); });
          wrap.append(b);
        }
      };
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      mk(this.el.zones, ZONES, M.zone, 'om-zone', z => M.setZone(z), z => `<span class="om-zone-flag">${z.flag}</span><span class="om-zone-name">${esc(L(z))}</span>`);
      mk(this.el.modes, MODES, M.mode, 'om-chip', m => M.setMode(m), m => esc(L(m)));
      mk(this.el.diffs, DIFFS, M.diff, 'om-chip', d => M.setDiff(d), d => esc(L(d)));
      const g = guessZone();
      const gz = ZONES.find(z => z.id === g);
      this.el.zoneHint.textContent = `${T('zoneAuto')}: ${gz.flag} ${L(gz)}`;
    },

    render() {
      if (!this.built) return;
      const e = this.el;
      e.tab.textContent = T('tab');
      e.title.textContent = M.kind === 'room' ? T('titleRoom') : T('title');
      e.intro.textContent = T('intro');
      e.view.querySelectorAll('.om-label').forEach(l => { l.textContent = T(l.dataset.k); });
      e.rules.textContent = M.kind === 'room' ? T('roomRules') : T('rules');
      e.nameHint.textContent = T('nameHint');
      e.kinds.forEach(b => {
        const on = b.dataset.kind === M.kind;
        b.textContent = T(b.dataset.kind === 'room' ? 'kindRoom' : 'kindRandom');
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.disabled = M.state !== 'idle' && !on;
      });
      e.view.classList.toggle('om-kind-room', M.kind === 'room');
      e.roomIntro.textContent = T('roomIntro');
      e.roomCreate.textContent = '🏠 ' + T('roomCreate');
      e.roomJoin.textContent = T('roomJoin');
      e.roomInput.placeholder = T('roomCodePh');
      e.roomCopy.textContent = '📋 ' + T('copy');
      const live = M.kind === 'room' && M.roomRole === 'create' && M.state !== 'idle';
      e.roomLive.classList.toggle('hidden', !live);
      e.roomActions.classList.toggle('hidden', M.state !== 'idle');
      if (live) e.roomCode.textContent = M.roomCode.slice(0, 3) + ' ' + M.roomCode.slice(3);
      // 참가자: 방장의 모드·난이도를 따르므로 선택 칩을 잠급니다.
      e.view.classList.toggle('om-joiner', M.kind === 'room' && M.roomRole === 'join' && M.state !== 'idle');
      // Play 게임즈 이름을 기본값(placeholder)으로 보여 줍니다.
      e.nameInput.placeholder = ID.name || T('namePh');
      if (document.activeElement !== e.nameInput) e.nameInput.value = customName();
      e.nameInput.disabled = M.state !== 'idle';
      e.nameFlag.textContent = flagOf(myCountry());
      const mt = myTier(M.diff);
      e.nameTier.innerHTML = tierSvg(mt, 30);
      e.nameTier.title = tierLabel(mt);
      e.nat.textContent = T('nat');
      e.toGlobal.textContent = T('toGlobal');
      e.slow.querySelector('span').textContent = T('slow');

      const busy = M.state !== 'idle';
      e.view.classList.toggle('om-busy', busy);
      e.view.classList.toggle('om-is-matched', M.state === 'matched');
      e.start.textContent = busy ? T('cancel') : T('start');
      e.start.className = `btn ${busy ? 'btn-secondary' : 'btn-primary'} om-start`;
      // 방 번호 화면에서는 대기 전엔 '방 만들기/참가' 버튼을 쓰고, 진행 중일 때만 취소 버튼을 보입니다.
      e.start.hidden = M.kind === 'room' && !busy;
      if (busy && M.kind === 'room' && M.roomRole === 'create' && M.state !== 'matched') e.start.textContent = T('roomClose');
      e.status.classList.toggle('hidden', !busy || M.state === 'matched');
      e.matched.classList.toggle('hidden', M.state !== 'matched');
      [e.zones, e.modes, e.diffs].forEach(w => w.querySelectorAll('button').forEach(b => { b.disabled = M.state === 'matched'; }));

      if (busy && M.state !== 'matched') {
        const sec = Math.floor((Date.now() - M.startedAt) / 1000);
        const openTrackers = M.trackers.filter(t => t.open).length;
        const waiting = Math.max(0, ...M.trackers.map(t => t.waiting || 0));
        const z = ZONES.find(x => x.id === M.zone);
        if (M.kind === 'room') e.statusText.textContent = M.state === 'proposing' ? T('found') : (M.roomRole === 'create' ? T('roomWaiting') : T('roomJoining'));
        else e.statusText.textContent = (M.state === 'proposing' ? T('found') : T('searching')) + ` ${z.flag}`;
        const stat = (k, v) => `<div class="om-stat"><span class="om-stat-v">${v}</span><span class="om-stat-k">${T(k)}</span></div>`;
        e.stats.innerHTML =
          stat('elapsed', `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`) +
          stat('trackers', `${openTrackers}/${TRACKERS.length}`) +
          stat('dht', M.dht.nodes ? `${M.dht.nodes}` : '…') +
          stat('waiting', waiting ? String(waiting) : '–') +
          stat('peers', String(M.seen.size));
        e.slow.classList.toggle('hidden', !(M.kind === 'random' && sec >= 60 && M.zone !== 'global'));
        if (M.kind === 'room' && M.roomRole === 'join' && sec >= 45) e.statusText.textContent = T('roomNotFound');
      }
      if (M.state === 'matched') {
        const z = ZONES.find(x => x.id === M.zone), mo = MODES.find(x => x.id === M.mode), di = DIFFS.find(x => x.id === M.diff);
        e.matched.innerHTML = '';
        const h = document.createElement('div'); h.className = 'om-matched-title'; h.textContent = '⚔️ ' + T('matched');
        const vs = document.createElement('div'); vs.className = 'om-vs';
        const card = (who, prof) => {
          const c = document.createElement('div'); c.className = 'om-player';
          const wh = document.createElement('div'); wh.className = 'om-player-who'; wh.textContent = who;
          const em = document.createElement('div'); em.className = 'om-player-emblem'; em.innerHTML = tierSvg(prof.tier, 54);
          const nm = document.createElement('div'); nm.className = 'om-player-name'; nm.textContent = `${flagOf(prof.cc)} ${prof.n}`;
          const tr = document.createElement('div'); tr.className = 'om-player-tier'; tr.textContent = tierLabel(prof.tier) + (prof.tier.rp ? ` · ${prof.tier.rp} RP` : '');
          c.append(wh, em, nm, tr);
          return c;
        };
        const x = document.createElement('span'); x.className = 'om-vs-x'; x.textContent = 'VS';
        vs.append(card(T('me'), myProfile(M.diff)), x, card(T('opp'), M.partnerProfile || cleanProfile(null, M.partner)));
        const meta = document.createElement('div'); meta.className = 'om-matched-meta';
        const where = M.kind === 'room' ? `🔢 ${M.roomCode}` : `${z.flag} ${L(z)}`;
        meta.textContent = `${where} · ${L(mo)} · ${L(di)} · ${M.role === 1 ? T('youHost') : T('youGuest')}`;
        e.matched.append(h, vs, meta);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 기존 배틀 흐름과 연결
  // ---------------------------------------------------------------------------
  function install() {
    if (typeof SumdokuApp === 'undefined') return;
    const P = SumdokuApp.prototype;

    // 로비 닫기 등으로 방 준비를 취소하면 온라인 세션도 끝냅니다(내부 정리 호출은 제외).
    const baseCancel = P.cancelRoomPreparation;
    if (baseCancel) P.cancelRoomPreparation = function () {
      const r = baseCancel.apply(this, arguments);
      if (!M.internalCancel && M.active) M.leave();
      return r;
    };

    // Wi-Fi가 없어도 로비를 열고 온라인 탭을 보여 줍니다. 마지막으로 쓴 탭을 기억합니다.
    const baseOpen = P.openBattleLobby;
    P.openBattleLobby = function () {
      let wifi;
      try {
        const b = window.AndroidBridge;
        if (b?.isWifiConnected) wifi = b.isWifiConnected();
        else if (b?.getDeviceStatus) wifi = JSON.parse(b.getDeviceStatus()).wifi;
      } catch (_) {}
      if (wifi === false) {
        this.isRematchActive = false;
        this.dom.modalBattleLobby.classList.remove('hidden');
        this.dom.modalBattleLobby.querySelectorAll('.quick-settings').forEach(p => { p.open = false; });
        const tabs = this.dom.battleLobbyTabs || document.querySelector('.battle-lobby-tabs');
        if (tabs) tabs.classList.remove('hidden');
        UI.show(false);
        this.showToast?.(T('wifiOff'), 3500);
        return;
      }
      const r = baseOpen.apply(this, arguments);
      if (store.get('sumdoku_last_battle_tab', '') === 'online') UI.show(false);
      else if (UI.built) { UI.el.tab.classList.remove('active'); UI.el.view.classList.add('hidden'); }
      return r;
    };

    // 재대결 로비: 온라인 경기라면 Wi-Fi 방 UI 대신 자동으로 다시 준비합니다.
    const baseReturn = P.returnToBattleLobby;
    if (baseReturn) P.returnToBattleLobby = function () {
      const r = baseReturn.apply(this, arguments);
      if (M.active && M.partner) {
        UI.show(false);
        UI.render();
        if (M.role === 2) {
          this.battleRequest(`${HOST}/api/ready`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: 2, ready: true }) }).catch(() => {});
        } else if (M.role === 1) {
          const epoch = M.epoch;
          M.hostStarted = false;
          clearInterval(this.hostPollTimer);
          clearInterval(M.hostPoll);
          M.hostPoll = setInterval(async () => {
            if (epoch !== M.epoch || M.hostStarted) return;
            try {
              const st = await (await fetch('http://127.0.0.1:8888/api/status')).json();
              this.guestJoined = !!st.guestJoined; this.hostP2Ready = !!st.p2Ready;
              if (st.guestJoined && st.p2Ready && !this.battleStarting) { M.hostStarted = true; clearInterval(M.hostPoll); this.startBattleAsHost(); }
            } catch (_) {}
          }, 600);
        }
      }
      return r;
    };

    // 온라인 경기 HUD: '상대 (Host/Guest)' 대신 상대 국기와 닉네임을 표시합니다.
    const baseStartMatch = P.startBattleMatch;
    if (baseStartMatch) P.startBattleMatch = function () {
      const r = baseStartMatch.apply(this, arguments);
      try {
        if (M.active && M.partnerProfile && this.dom.battleP2Name) {
          this.dom.battleP2Name.textContent = `${flagOf(M.partnerProfile.cc)} ${M.partnerProfile.n}`;
          this.dom.battleP2Name.title = tierLabel(M.partnerProfile.tier);
        }
        if (M.active && this.dom.battleP1Name) this.dom.battleP1Name.textContent = `${flagOf(myCountry())} ${myName()}`;
      } catch (_) {}
      return r;
    };

    // v2.0.2 · 배틀(같은 Wi-Fi 방 포함)은 Google Play 게임즈에 로그인한 사람만 이용할 수 있습니다.
    const gatedOpen = P.openBattleLobby;
    P.openBattleLobby = function () {
      if (!loginGateOn() || ID.signedIn) return gatedOpen.apply(this, arguments);
      const args = arguments;
      if (ID.checked && ID.reason === 'unavailable') { this.showToast?.(T('loginStoreOnly'), 4500); return; }
      // 이미 로그인된 기기는 금방 끝나므로, 0.7초 넘게 걸릴 때만 '로그인 중' 안내를 띄웁니다.
      let settled = false;
      setTimeout(() => { if (!settled) this.showToast?.(T('loginBusy'), 2500); }, 700);
      ensurePlayLogin(true).then(ok => {
        settled = true;
        if (ok) gatedOpen.apply(this, args);
        else this.showToast?.(ID.reason === 'unavailable' ? T('loginStoreOnly') : T('loginNeed'), 4500);
      });
    };

    // 결과 화면을 닫고 홈으로 가면 온라인 연결을 끝냅니다.
    const baseSwitch = P.switchView;
    P.switchView = function (name) {
      const r = baseSwitch.apply(this, arguments);
      if (name === 'home' && !this.isBattle && M.active && this.dom.modalBattleLobby?.classList.contains('hidden')) M.leave();
      return r;
    };

    // 언어가 바뀌면 온라인 탭 문구도 갱신합니다.
    if (window.I18N?.setLanguage) {
      const baseLang = I18N.setLanguage;
      I18N.setLanguage = function () { const r = baseLang.apply(this, arguments); try { UI.renderPickers(); UI.render(); } catch (_) {} return r; };
    }

    // 앱 종료/백그라운드에서 완전히 닫힐 때 상대에게 알립니다.
    window.addEventListener('pagehide', () => { const p = M.partner && M.peers.get(M.partner); if (p) M.sendTo(p, { t: 'bye' }); });
  }

  install();
  setTimeout(() => { if (loginGateOn()) ensurePlayLogin(false); }, 1200);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => UI.build());
  else UI.build();
  // window.app은 app.js의 DOMContentLoaded에서 만들어지므로, 아직 없으면 잠시 후 다시 시도합니다.
  let tries = 0;
  const retry = setInterval(() => { if (UI.build() || ++tries > 40) clearInterval(retry); }, 100);

  M.ui = UI;
  window.OnlineMatch = M;
})();
