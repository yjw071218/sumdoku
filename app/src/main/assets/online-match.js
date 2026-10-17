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

  const FIXED_RULES = { mistakeLimit: true, maxLives: '3', livesExhaustedAction: 'game_over', initialHints: '3', hintExhaustedAction: 'allow_penalty', allowAutoNotes: false, turnSeconds: 30 };

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
    zone: ['매칭 구역', 'Match zone', 'マッチ地域', '匹配区域', '配對區域', 'Zona de partida', 'Zone de match', 'Match-Zone'],
    zoneAuto: ['매칭 구역은 기기 시간대로 자동 선택', 'Match zone auto-selected from your time zone', 'マッチ地域は端末のタイムゾーンで自動選択', '匹配区域按设备时区自动选择', '配對區域依裝置時區自動選擇', 'Zona elegida según tu zona horaria', 'Zone choisie selon votre fuseau horaire', 'Zone automatisch nach Zeitzone'],
    mode: ['배틀 모드', 'Battle mode', 'バトルモード', '对战模式', '對戰模式', 'Modo de batalla', 'Mode de duel', 'Kampfmodus'],
    diff: ['난이도', 'Difficulty', '難易度', '难度', '難度', 'Dificultad', 'Difficulté', 'Schwierigkeit'],
    name: ['내 닉네임', 'My nickname', 'ニックネーム', '我的昵称', '我的暱稱', 'Mi apodo', 'Mon pseudo', 'Mein Spitzname'],
    namePh: ['상대에게 보일 이름', 'Name shown to your opponent', '相手に表示される名前', '对手看到的名字', '對手看到的名稱', 'Nombre que verá tu rival', 'Nom vu par votre adversaire', 'Name, den dein Gegner sieht'],
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
    roomCreate: ['방 만들기', 'Create room', 'ルームを作成', '创建房间', '建立房間', 'Crear sala', 'Créer une salle', 'Raum erstellen'],
    roomJoin: ['번호로 참가', 'Join', '番号で参加', '输入房间号加入', '輸入號碼加入', 'Unirse', 'Rejoindre', 'Beitreten'],
    roomCodeLabel: ['방 번호', 'Room code', 'ルーム番号', '房间号', '房間號碼', 'Código', 'Code', 'Code'],
    roomCodePh: ['6자리 번호', '6-digit code', '6桁の番号', '6 位数字', '6 位數字', 'Código de 6 dígitos', 'Code à 6 chiffres', '6-stelliger Code'],
    roomWaiting: ['친구가 이 번호를 입력하면 바로 연결됩니다', 'Your friend can join with this code', '友達がこの番号を入力するとすぐにつながります', '好友输入此房间号即可立即连接', '好友輸入此號碼即可立即連線', 'Tu amigo puede unirse con este código', 'Votre ami peut rejoindre avec ce code', 'Dein Freund kann mit diesem Code beitreten'],
    roomJoining: ['방을 찾는 중…', 'Looking for the room…', 'ルームを探しています…', '正在寻找房间…', '正在尋找房間…', 'Buscando la sala…', 'Recherche de la salle…', 'Suche den Raum…'],
    roomNotFound: ['아직 방을 찾지 못했습니다. 번호를 확인하고 방장이 방을 열어 두었는지 확인해 주세요.', 'Room not found yet. Check the code and make sure the host keeps the room open.', 'まだルームが見つかりません。番号とホストがルームを開いているか確認してください。', '尚未找到房间。请确认房间号，并确保房主保持房间开启。', '尚未找到房間。請確認號碼，並確保房主保持房間開啟。', 'Aún no se encuentra la sala. Revisa el código y que el anfitrión la mantenga abierta.', 'Salle introuvable pour l’instant. Vérifiez le code et que l’hôte garde la salle ouverte.', 'Raum noch nicht gefunden. Code prüfen und sicherstellen, dass der Host den Raum offen hält.'],
    roomBad: ['6자리 숫자를 입력해 주세요.', 'Enter the 6-digit code.', '6桁の数字を入力してください。', '请输入 6 位数字。', '請輸入 6 位數字。', 'Introduce el código de 6 dígitos.', 'Saisissez le code à 6 chiffres.', 'Gib den 6-stelligen Code ein.'],
    copy: ['번호 복사', 'Copy code', '番号をコピー', '复制房间号', '複製號碼', 'Copiar código', 'Copier le code', 'Code kopieren'],
    copied: ['방 번호를 복사했습니다.', 'Room code copied.', 'ルーム番号をコピーしました。', '已复制房间号。', '已複製房間號碼。', 'Código copiado.', 'Code copié.', 'Code kopiert.'],
    nameHint: ['비워 두면 Google Play 게임즈 이름을 사용합니다', 'Leave empty to use your Google Play Games name', '空欄にすると Google Play ゲームズの名前を使います', '留空则使用 Google Play 游戏名称', '留空則使用 Google Play 遊戲名稱', 'Déjalo vacío para usar tu nombre de Google Play Juegos', 'Laissez vide pour utiliser votre nom Google Play Jeux', 'Leer lassen, um deinen Google Play Spiele-Namen zu verwenden'],
    loginNeed: ['배틀은 Google Play 게임즈에 로그인해야 이용할 수 있습니다.', 'Sign in to Google Play Games to play battles.', 'バトルを遊ぶには Google Play ゲームズへのログインが必要です。', '登录 Google Play 游戏后才能进行对战。', '登入 Google Play 遊戲後才能進行對戰。', 'Inicia sesión en Google Play Juegos para jugar batallas.', 'Connectez-vous à Google Play Jeux pour jouer en duel.', 'Melde dich bei Google Play Spiele an, um Kämpfe zu spielen.'],
    loginStoreOnly: ['배틀은 Google Play 스토어 버전에서 Google Play 게임즈에 로그인한 뒤 이용할 수 있습니다.', 'Battles are available in the Google Play Store version after signing in to Google Play Games.', 'バトルは Google Play ストア版で Google Play ゲームズにログインすると利用できます。', '对战需要在 Google Play 商店版中登录 Google Play 游戏后使用。', '對戰需在 Google Play 商店版登入 Google Play 遊戲後使用。', 'Las batallas están en la versión de Google Play Store tras iniciar sesión en Google Play Juegos.', 'Les duels sont disponibles dans la version Google Play Store après connexion à Google Play Jeux.', 'Kämpfe gibt es in der Google-Play-Store-Version nach Anmeldung bei Google Play Spiele.'],
    loginBusy: ['Google Play 게임즈에 로그인하는 중…', 'Signing in to Google Play Games…', 'Google Play ゲームズにログイン中…', '正在登录 Google Play 游戏…', '正在登入 Google Play 遊戲…', 'Iniciando sesión en Google Play Juegos…', 'Connexion à Google Play Jeux…', 'Anmeldung bei Google Play Spiele…'],
    // ---------------- v2.0.5 ----------------
    rcLivesInf: ['목숨 무제한', 'Unlimited lives', 'ライフ無制限', '生命无限', '生命無限', 'Vidas ilimitadas', 'Vies illimitées', 'Unbegrenzte Leben'],
    rcNoHints: ['힌트 없음', 'No hints', 'ヒントなし', '无提示', '無提示', 'Sin pistas', 'Sans indices', 'Keine Hinweise'],
    rcTime5: ['제한 시간 5분', '5-minute limit', '制限時間5分', '限时 5 分钟', '限時 5 分鐘', 'Límite de 5 min', 'Limite de 5 min', '5-Minuten-Limit'],
    matchFound: ['매칭 성공!', 'Match found!', 'マッチング成功！', '匹配成功！', '配對成功！', '¡Rival encontrado!', 'Adversaire trouvé !', 'Gegner gefunden!'],
    rulesChips: [
      ['목숨 3', '힌트 3', '자동 메모 끔', '턴 30초'],
      ['3 lives', '3 hints', 'No auto-notes', '30 s turns'],
      ['ライフ3', 'ヒント3', '自動メモなし', 'ターン30秒'],
      ['3 条命', '3 次提示', '禁用自动笔记', '每回合 30 秒'],
      ['3 條命', '3 次提示', '停用自動筆記', '每回合 30 秒'],
      ['3 vidas', '3 pistas', 'Sin notas auto', 'Turnos de 30 s'],
      ['3 vies', '3 indices', 'Sans notes auto', 'Tours de 30 s'],
      ['3 Leben', '3 Hinweise', 'Keine Auto-Notizen', '30-s-Züge']
    ],
    rulesTitle: ['공정 규칙', 'Fair rules', '公平ルール', '公平规则', '公平規則', 'Reglas justas', 'Règles équitables', 'Faire Regeln'],
    roomLead: ['6자리 번호로 친구와 1:1 대전합니다.', 'Play 1:1 with a friend using a 6-digit code.', '6桁の番号で友達と1対1で対戦します。', '用 6 位房间号与好友 1 对 1 对战。', '用 6 位號碼與好友 1 對 1 對戰。', 'Juega 1:1 con un amigo con un código de 6 dígitos.', 'Jouez en 1:1 avec un ami grâce à un code à 6 chiffres.', 'Spiele 1:1 mit einem Freund per 6-stelligem Code.'],
    or: ['또는', 'or', 'または', '或', '或', 'o', 'ou', 'oder'],
    roomTitle: ['배틀 방', 'Battle room', 'バトルルーム', '对战房间', '對戰房間', 'Sala de batalla', 'Salle de duel', 'Kampfraum'],
    leave: ['나가기', 'Leave', '退出', '退出', '離開', 'Salir', 'Quitter', 'Verlassen'],
    roomSettings: ['방 설정', 'Room settings', 'ルーム設定', '房间设置', '房間設定', 'Ajustes de sala', 'Réglages de la salle', 'Raumeinstellungen'],
    hostOnly: ['방장만 바꿀 수 있습니다', 'Only the host can change these', 'ホストのみ変更できます', '仅房主可以更改', '僅房主可以變更', 'Solo el anfitrión puede cambiarlos', 'Seul l’hôte peut les modifier', 'Nur der Host kann das ändern'],
    lives: ['목숨', 'Lives', 'ライフ', '生命', '生命', 'Vidas', 'Vies', 'Leben'],
    hints: ['힌트', 'Hints', 'ヒント', '提示', '提示', 'Pistas', 'Indices', 'Hinweise'],
    autoNotes: ['자동 메모', 'Auto-notes', '自動メモ', '自动笔记', '自動筆記', 'Notas auto', 'Notes auto', 'Auto-Notizen'],
    turnTime: ['턴 시간', 'Turn time', 'ターン時間', '回合时间', '回合時間', 'Tiempo de turno', 'Durée du tour', 'Zugzeit'],
    on: ['허용', 'On', '許可', '允许', '允許', 'Sí', 'Oui', 'An'],
    off: ['끔', 'Off', 'オフ', '关闭', '關閉', 'No', 'Non', 'Aus'],
    sec: ['초', 's', '秒', '秒', '秒', 's', 's', 's'],
    livesFree: ['레이스·타임어택은 목숨 무제한입니다', 'Race and Time attack have unlimited lives', 'レース・タイムアタックはライフ無制限です', '竞速赛和计时赛生命无限', '競速賽與計時賽生命無限', 'Carrera y Contrarreloj tienen vidas ilimitadas', 'Course et Contre-la-montre : vies illimitées', 'Rennen und Zeitangriff: unbegrenzte Leben'],
    startGame: ['게임 시작', 'Start game', 'ゲーム開始', '开始游戏', '開始遊戲', 'Empezar', 'Lancer la partie', 'Spiel starten'],
    waitGuest: ['상대가 들어오기를 기다리는 중…', 'Waiting for your opponent to join…', '相手の参加を待っています…', '正在等待对手加入…', '正在等待對手加入…', 'Esperando a que se una tu rival…', 'En attente de l’adversaire…', 'Warte auf den Gegner…'],
    guestIn: ['상대가 들어왔습니다. 설정을 확인하고 시작하세요', 'Opponent joined. Check the settings and start', '相手が参加しました。設定を確認して開始してください', '对手已加入。确认设置后开始', '對手已加入。確認設定後開始', 'Tu rival se unió. Revisa los ajustes y empieza', 'Adversaire arrivé. Vérifiez les réglages puis lancez', 'Gegner ist da. Einstellungen prüfen und starten'],
    readyBtn: ['✋ 준비 완료', '✋ Ready', '✋ 準備完了', '✋ 准备', '✋ 準備', '✋ Listo', '✋ Prêt', '✋ Bereit'],
    unreadyBtn: ['준비 취소', 'Cancel ready', '準備を取り消す', '取消准备', '取消準備', 'Cancelar listo', 'Annuler prêt', 'Nicht bereit'],
    readyTag: ['준비 완료', 'Ready', '準備完了', '已准备', '已準備', 'Listo', 'Prêt', 'Bereit'],
    notReadyTag: ['준비 중', 'Not ready', '準備中', '未准备', '未準備', 'No listo', 'Pas prêt', 'Nicht bereit'],
    waitReady: ['상대가 들어왔습니다. 상대가 준비를 누르면 시작할 수 있습니다', 'Opponent joined. You can start once they are ready', '相手が参加しました。相手が準備完了すると開始できます', '对手已加入。对手准备后即可开始', '對手已加入。對手準備後即可開始', 'Tu rival se unió. Podrás empezar cuando esté listo', 'Adversaire arrivé. Lancement possible dès qu’il est prêt', 'Gegner ist da. Start möglich, sobald er bereit ist'],
    guestReadyNow: ['상대가 준비했습니다! 게임을 시작하세요', 'Opponent is ready! Start the game', '相手が準備完了！ゲームを開始してください', '对手已准备！开始游戏吧', '對手已準備！開始遊戲吧', '¡Tu rival está listo! Empieza', 'L’adversaire est prêt ! Lancez la partie', 'Gegner ist bereit! Starte das Spiel'],
    pressReady: ['설정을 확인하고 준비를 눌러 주세요', 'Check the settings and tap Ready', '設定を確認して準備完了を押してください', '确认设置后点击准备', '確認設定後點選準備', 'Revisa los ajustes y pulsa Listo', 'Vérifiez les réglages et appuyez sur Prêt', 'Einstellungen prüfen und Bereit tippen'],
    notReadyYet: ['상대가 아직 준비하지 않았습니다.', 'Your opponent is not ready yet.', '相手はまだ準備できていません。', '对手尚未准备。', '對手尚未準備。', 'Tu rival aún no está listo.', 'L’adversaire n’est pas encore prêt.', 'Der Gegner ist noch nicht bereit.'],
    readyReset: ['방장이 설정을 바꿔 준비가 해제되었습니다', 'The host changed settings — ready was reset', 'ホストが設定を変更したため準備が解除されました', '房主更改了设置，准备已取消', '房主變更了設定，準備已取消', 'El anfitrión cambió los ajustes: listo se reinició', 'L’hôte a modifié les réglages : prêt annulé', 'Der Host hat Einstellungen geändert – Bereit zurückgesetzt'],
    waitHost: ['방장이 게임을 시작하기를 기다리는 중…', 'Waiting for the host to start…', 'ホストの開始を待っています…', '正在等待房主开始…', '正在等待房主開始…', 'Esperando a que el anfitrión empiece…', 'En attente du lancement par l’hôte…', 'Warte auf den Start durch den Host…'],
    roomNoGuest: ['상대가 아직 들어오지 않았습니다.', 'Your opponent hasn’t joined yet.', '相手がまだ参加していません。', '对手尚未加入。', '對手尚未加入。', 'Tu rival aún no se ha unido.', 'L’adversaire n’a pas encore rejoint.', 'Der Gegner ist noch nicht beigetreten.'],
    waitingSlot: ['대기 중', 'Waiting', '待機中', '等待中', '等待中', 'Esperando', 'En attente', 'Wartet'],
    host: ['방장', 'Host', 'ホスト', '房主', '房主', 'Anfitrión', 'Hôte', 'Host'],
    // 재대결
    rmSent: ['재도전을 신청했습니다. 상대의 응답을 기다리는 중…', 'Rematch requested. Waiting for your opponent…', '再戦を申し込みました。相手の返事を待っています…', '已申请重赛，正在等待对手回应…', '已申請重賽，正在等待對手回應…', 'Revancha solicitada. Esperando a tu rival…', 'Revanche demandée. En attente de l’adversaire…', 'Revanche angefragt. Warte auf den Gegner…'],
    rmIncoming: ['상대가 재도전을 신청했습니다', 'Your opponent wants a rematch', '相手が再戦を申し込みました', '对手申请重赛', '對手申請重賽', 'Tu rival quiere la revancha', 'L’adversaire demande une revanche', 'Der Gegner will eine Revanche'],
    rmAccept: ['수락', 'Accept', '受ける', '接受', '接受', 'Aceptar', 'Accepter', 'Annehmen'],
    rmReject: ['거절', 'Decline', '断る', '拒绝', '拒絕', 'Rechazar', 'Refuser', 'Ablehnen'],
    rmRejected: ['상대가 재도전을 거절했습니다.', 'Your opponent declined the rematch.', '相手が再戦を断りました。', '对手拒绝了重赛。', '對手拒絕了重賽。', 'Tu rival rechazó la revancha.', 'L’adversaire a refusé la revanche.', 'Der Gegner hat die Revanche abgelehnt.'],
    rmYouRejected: ['재도전 요청을 거절했습니다.', 'You declined the rematch.', '再戦を断りました。', '你拒绝了重赛。', '你拒絕了重賽。', 'Rechazaste la revancha.', 'Vous avez refusé la revanche.', 'Du hast die Revanche abgelehnt.'],
    rmLeft: ['상대가 나갔습니다. 재도전할 수 없습니다.', 'Your opponent left. Rematch unavailable.', '相手が退出しました。再戦できません。', '对手已离开，无法重赛。', '對手已離開，無法重賽。', 'Tu rival se fue. No hay revancha.', 'L’adversaire est parti. Revanche impossible.', 'Der Gegner ist gegangen. Keine Revanche möglich.'],
    rmAccepted: ['재도전 수락! 대기실로 이동합니다', 'Rematch accepted! Back to the room', '再戦成立！ルームへ戻ります', '重赛已接受！返回房间', '重賽已接受！返回房間', '¡Revancha aceptada! Volviendo a la sala', 'Revanche acceptée ! Retour à la salle', 'Revanche angenommen! Zurück zum Raum'],
    // 배틀 모드 설명
    descRace: ['같은 퍼즐을 각자 풉니다. 먼저 완성하면 경기가 끝나고, 완주 보너스를 포함해 점수가 높은 쪽이 이깁니다. 목숨은 무제한이지만 오답마다 크게 감점됩니다.', 'You both solve the same puzzle. The game ends when someone finishes; the higher score (with the finish bonus) wins. Unlimited lives, but each mistake costs a lot of points.', '同じパズルをそれぞれ解きます。誰かが完成すると終了し、完走ボーナスを含めて得点が高い方の勝ち。ライフは無制限ですが、ミスごとに大きく減点されます。', '双方解同一个谜题。有人完成即结束，含完赛奖励分数更高者获胜。生命无限，但每次出错都会大幅扣分。', '雙方解同一個謎題。有人完成即結束，含完賽獎勵分數較高者獲勝。生命無限，但每次出錯都會大幅扣分。', 'Ambos resolvéis el mismo puzle. Termina cuando alguien acaba; gana la mayor puntuación (con bonus). Vidas ilimitadas, pero cada error resta mucho.', 'Vous résolvez la même grille. La partie s’arrête dès qu’un joueur finit ; le meilleur score (bonus compris) gagne. Vies illimitées, mais chaque erreur coûte cher.', 'Ihr löst dasselbe Rätsel. Wer zuerst fertig ist, beendet das Spiel; die höhere Punktzahl (mit Bonus) gewinnt. Unbegrenzte Leben, aber Fehler kosten viele Punkte.'],
    descScore: ['제한 시간(5분) 안에 정답과 콤보로 점수를 쌓습니다. 시간이 끝났을 때 점수가 높은 쪽이 이깁니다.', 'Build points with correct entries and combos within 5 minutes. Highest score when time runs out wins.', '制限時間（5分）内に正解とコンボで得点を稼ぎます。時間切れ時に得点が高い方の勝ち。', '在 5 分钟内通过正确输入和连击累积分数，时间结束时分数高者获胜。', '在 5 分鐘內透過正確輸入與連擊累積分數，時間結束時分數高者獲勝。', 'Suma puntos con aciertos y combos en 5 minutos. Gana la puntuación más alta al acabar el tiempo.', 'Marquez des points avec bonnes réponses et combos en 5 minutes. Le meilleur score à la fin gagne.', 'Sammle in 5 Minuten Punkte mit richtigen Eingaben und Combos. Die höchste Punktzahl gewinnt.'],
    descSurvival: ['남은 생존 시간을 관리하며 풉니다. 상대가 진행할수록 내 시간이 줄고, 시간이 다 되면 목숨과 점수를 잃습니다. 먼저 완성하거나 상대가 탈락할 때까지 버티세요.', 'Manage your survival time. Your clock drains as your opponent progresses; when it runs out you lose a life and points. Finish first or outlast your opponent.', '残りの生存時間を管理しながら解きます。相手が進むほど時間が減り、尽きるとライフと得点を失います。先に完成するか、相手の脱落まで耐えましょう。', '管理剩余生存时间。对手进度越快你的时间减少越多，时间耗尽会失去生命和分数。先完成或坚持到对手淘汰。', '管理剩餘生存時間。對手進度越快你的時間減少越多，時間耗盡會失去生命與分數。先完成或撐到對手淘汰。', 'Gestiona tu tiempo de supervivencia. Se agota cuando tu rival avanza; si llega a cero pierdes una vida y puntos. Termina antes o aguanta más.', 'Gérez votre temps de survie. Il fond quand l’adversaire progresse ; à zéro, vous perdez une vie et des points. Finissez avant ou tenez plus longtemps.', 'Verwalte deine Überlebenszeit. Sie sinkt, wenn der Gegner vorankommt; bei null verlierst du Leben und Punkte. Sei schneller oder halte länger durch.'],
    descTurn: ['하나의 공용 판에 번갈아 숫자를 입력합니다. 오답이거나 턴 시간이 지나면 차례가 넘어가고, 판이 완성되면 점수를 비교합니다. 힌트·실행 취소는 쓸 수 없습니다.', 'Take turns placing numbers on one shared board. A mistake or timeout passes the turn; when the board is complete, scores are compared. No hints or undo.', '1つの共有盤に交互に数字を入れます。ミスか時間切れで手番が移り、盤が完成したら得点を比べます。ヒント・元に戻すは使えません。', '在同一个公用盘上轮流填数。出错或超时则换人，盘面完成后比较分数。不能使用提示和撤销。', '在同一個共用盤上輪流填數。出錯或逾時則換人，盤面完成後比較分數。不能使用提示與復原。', 'Por turnos en un tablero compartido. Un error o agotar el tiempo pasa el turno; al completarlo se comparan puntos. Sin pistas ni deshacer.', 'Chacun son tour sur une grille commune. Une erreur ou un temps écoulé passe la main ; à la fin, on compare les scores. Ni indices ni annulation.', 'Abwechselnd auf einem gemeinsamen Brett. Fehler oder Zeitablauf geben den Zug ab; am Ende zählen die Punkte. Keine Hinweise oder Rückgängig.'],
    unranked: ['배치 중', 'Placement', '配置中', '定级中', '定級中', 'Clasificación', 'Placement', 'Platzierung'],
    // v2.1.2 · 경쟁전 / 일반전 분리 및 랜덤 모드 룰렛
    queueLabel: ['매칭 방식', 'Match type', 'マッチ方式', '匹配方式', '配對方式', 'Tipo de partida', 'Type de match', 'Match-Typ'],
    queueRanked: ['🏆 경쟁전', '🏆 Competitive', '🏆 ランク戦', '🏆 排位赛', '🏆 排位賽', '🏆 Competitivo', '🏆 Compétitif', '🏆 Rangliste'],
    queueNormal: ['🎮 일반전', '🎮 Normal', '🎮 ノーマル戦', '🎮 普通赛', '🎮 一般賽', '🎮 Normal', '🎮 Normal', '🎮 Normal'],
    queueRankedDesc: ['경쟁전끼리 매칭 · 난이도별 랭크 RP 반영 · 매칭 성사 시 4가지 배틀 모드 중 랜덤 결정', 'Competitive queue · Rank RP by difficulty · Battle mode randomly picked on match', 'ランク戦同士でマッチ · 難易度別ランクRP反映 · マッチ成立時に4モードからランダム決定', '排位赛专属匹配 · 按难度计算段位RP · 匹配成功后4种模式随机决定', '排位賽專屬配對 · 依難度計算段位RP · 配對成功後4種模式隨機決定', 'Cola competitiva · RP por dificultad · Modo elegido al azar al emparejar', 'File compétitive · RP par difficulté · Mode tiré au sort au match', 'Ranglisten-Warteschlange · RP nach Schwierigkeit · Zufälliger Modus beim Match'],
    queueNormalDesc: ['일반전끼리 매칭 · 원하는 배틀 모드 직접 선택 · 랭크 점수 변동 없음', 'Normal queue · Choose your battle mode freely · No rank RP change', 'ノーマル戦同士でマッチ · 好きなバトルモードを選択 · ランクRP変動なし', '普通赛专属匹配 · 自由选择对战模式 · 段位分数不变', '一般賽專屬配對 · 自由選擇對戰模式 · 段位分數不變', 'Cola normal · Elige el modo libremente · Sin cambio de RP', 'File normale · Choisissez librement le mode · Aucun changement de RP', 'Normale Warteschlange · Modus frei wählbar · Keine RP-Änderung'],
    rankedModeBadge: ['🎲 매칭 완료 후 4가지 모드 중 랜덤 결정', '🎲 Mode randomly selected from 4 modes on match', '🎲 マッチ完了後に4つのモードからランダム決定', '🎲 匹配完成后从4种模式中随机决定', '🎲 配對完成後從4種模式中隨機決定', '🎲 Modo elegido al azar entre los 4 al emparejar', '🎲 Mode tiré au sort parmi les 4 au match', '🎲 Modus wird nach dem Match zufällig aus 4 Modi gewählt'],
    rouletteSpinning: ['🎲 배틀 모드 랜덤 추첨 중…', '🎲 Selecting random battle mode…', '🎲 バトルモード抽選中…', '🎲 正在随机抽取对战模式…', '🎲 正在隨機抽取對戰模式…', '🎲 Sorteando modo de batalla…', '🎲 Tirage au sort du mode…', '🎲 Zufälliger Kampfmodus wird ausgelost…'],
    rouletteLocked: ['✨ 배틀 모드 확정!', '✨ Battle mode locked!', '✨ バトルモード決定！', '✨ 对战模式已确定！', '✨ 對戰模式已確定！', '✨ ¡Modo confirmado!', '✨ Mode verrouillé !', '✨ Kampfmodus festgelegt!'],
    rulesRankedNote: ['공통 공정 규칙 (목숨 3 · 힌트 3 · 자동 메모 끔 · 턴 30초, 모드별 세부 적용)', 'Standard fair rules (3 lives · 3 hints · No auto-notes · 30 s turns, applied per mode)', '共通公平ルール（ライフ3・ヒント3・自動メモなし・ターン30秒、モード別適用）', '通用公平规则（3条命 · 3次提示 · 禁用自动笔记 · 30秒回合，按模式适用）', '通用公平規則（3條命 · 3次提示 · 停用自動筆記 · 30秒回合，依模式適用）', 'Reglas justas (3 vidas · 3 pistas · Sin notas auto · Turnos 30 s)', 'Règles équitables (3 vies · 3 indices · Sans notes auto · Tours 30 s)', 'Faire Regeln (3 Leben · 3 Hinweise · Keine Auto-Notizen · 30-s-Züge)'],
    countdownLabel: ['게임 시작까지', 'Match starts in', '試合開始まで', '距离对局开始', '距離對局開始', 'La partida empieza en', 'Début du match dans', 'Spielstart in'],
    searchTitle: ['매칭 상대 탐색 중', 'Searching for Opponent', '対戦相手を検索中', '正在匹配对手', '正在配對對手', 'Buscando rival', 'Recherche d’adversaire', 'Suche nach Gegner'],
    searchFoundTitle: ['상대 발견! 연결 확정 중', 'Opponent Found! Connecting', '相手発見！接続確定中', '找到对手！正在确认连接', '找到對手！正在確認連線', '¡Rival encontrado! Conectando', 'Adversaire trouvé ! Connexion', 'Gegner gefunden! Verbinde'],
    random4Modes: ['🎲 4가지 모드 랜덤', '🎲 Random (4 modes)', '🎲 4モードランダム', '🎲 4种模式随机', '🎲 4種模式隨機', '🎲 Aleatorio (4 modos)', '🎲 Aléatoire (4 modes)', '🎲 Zufällig (4 Modi)']
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
  function pickRandomMode() {
    const a = new Uint32Array(1);
    try { crypto.getRandomValues(a); } catch (_) { a[0] = Math.floor(Math.random() * 1e9); }
    return MODES[a[0] % MODES.length].id;
  }

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
      const s = R.ladder(R.loadAll(), 'battle').byDiff[diff];
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

  // v2.0.5 · 방 번호 배틀: 방장이 방 안에서 바꾸는 설정(모드·난이도·목숨·힌트·자동 메모·턴 시간)
  const LIVES_OPTS = [1, 2, 3], HINT_OPTS = [0, 1, 2, 3], TURN_OPTS = [15, 30, 60];
  function cleanCfg(c) {
    c = c && typeof c === 'object' ? c : {};
    return {
      mode: pick(MODES, c.mode, 'race'),
      diff: pick(DIFFS, c.diff, 'expert'),
      lives: LIVES_OPTS.includes(+c.lives) ? +c.lives : 3,
      hints: HINT_OPTS.includes(+c.hints) ? +c.hints : 3,
      autoNotes: c.autoNotes !== false,
      turn: TURN_OPTS.includes(+c.turn) ? +c.turn : 30
    };
  }
  function loadRoomCfg() { try { return cleanCfg(JSON.parse(store.get('sumdoku_room_cfg', '{}'))); } catch (_) { return cleanCfg(null); } }
  function roomRules(c) {
    return { mistakeLimit: true, maxLives: String(c.lives), livesExhaustedAction: 'game_over', initialHints: String(c.hints), hintExhaustedAction: 'allow_penalty', allowAutoNotes: !!c.autoNotes, turnSeconds: c.turn };
  }

  try { const old = localStorage.getItem('sumdoku_online_name'); if (old && !/^Player-[A-Z0-9]{4}$/.test(old) && !localStorage.getItem('sumdoku_online_nick')) localStorage.setItem('sumdoku_online_nick', old); localStorage.removeItem('sumdoku_online_name'); } catch (_) {}

  // ---------------------------------------------------------------------------
  // 매칭 엔진
  // ---------------------------------------------------------------------------
  const M = {
    kind: store.get('sumdoku_online_kind', 'random') === 'room' ? 'room' : 'random', // random | room
    queue: store.get('sumdoku_online_queue', 'ranked') === 'normal' ? 'normal' : 'ranked', // ranked | normal
    roomRole: '',             // room일 때 create | join
    roomCode: '',
    roomCfg: loadRoomCfg(),
    guestReady: false,        // v2.0.7 방 번호: 참가자 준비 상태(양쪽이 같은 값을 가짐)
    rematch: null,            // 재대결 상태: {out}|{in}|{rejected}|{youRejected}|{left}|{accepted}
    state: 'idle',            // idle | searching | proposing | matched
    role: 0,                  // 1 방장 / 2 참가자
    selfId: '',
    zone: guessZone(),        // v2.0.6: 구역은 고르지 않고 기기 시간대로 자동 결정합니다.
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
    matchedAt: 0,
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
      if (role === 'create-same' && /^\d{6}$/.test(code || '')) {
        this.kind = 'room'; this.roomRole = 'create'; this.roomCode = code;
        this.mode = this.roomCfg.mode; this.diff = this.roomCfg.diff;
        this.start();
        return;
      }
      if (role === 'create') {
        const a = new Uint32Array(1);
        try { crypto.getRandomValues(a); } catch (_) { a[0] = Math.floor(Math.random() * 1e9); }
        code = String(100000 + (a[0] % 900000));
      }
      if (!/^\d{6}$/.test(code || '')) { window.app?.showToast?.(T('roomBad'), 3000); return; }
      this.kind = 'room'; this.roomRole = role; this.roomCode = code;
      if (role === 'create') { this.roomCfg = loadRoomCfg(); this.mode = this.roomCfg.mode; this.diff = this.roomCfg.diff; }
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
      if (this.kind === 'random') this.zone = guessZone();
      this.selfId = randId(20);
      this.seen = new Set();
      this.dht = { nodes: 0, peers: 0, phase: '' };
      // 경쟁전(ranked): 구역×난이도 (모드는 매칭 후 랜덤 결정) / 일반전(normal): 구역×모드×난이도 / 방 번호: 번호마다 서로 다른 info_hash를 씁니다.
      const hb = this.kind === 'room'
        ? sha1Bytes(`sumdoku-room|${PROTO}|${this.roomCode}`)
        : (this.queue === 'ranked'
          ? sha1Bytes(`sumdoku-match|${PROTO}|ranked|${this.zone}|${this.diff}`)
          : sha1Bytes(`sumdoku-match|${PROTO}|normal|${this.zone}|${this.mode}|${this.diff}`));
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
      this.roomLaunching = false;
      this.lastGenProgress = null;
      if (!keepActive) {
        this.active = false;
        this.mode = pick(MODES, store.get('sumdoku_online_mode', ''), 'race');
        this.diff = pick(DIFFS, store.get('sumdoku_online_diff', ''), 'expert');
      }
      try { SearchFx.hide(); MatchFx.hide(); } catch (_) {}
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
        this.sendTo(peer, { t: 'hello', id: this.selfId, proto: PROTO, kind: this.kind, queue: this.queue, roomRole: this.roomRole, code: this.roomCode, zone: this.zone, mode: this.mode, diff: this.diff, free: this.state === 'searching', ver: window.AndroidBridge?.getVersion?.() || '', p: myProfile(this.diff) });
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
        this.rematch = { left: true }; // v2.0.9: 결과 화면에서 재도전 대신 '상대가 나갔습니다'
        return;
      }
      if (!this.active) return;
      if (app?.dom?.modalBattleResult && !app.dom.modalBattleResult.classList.contains('hidden')) {
        this.partner = null;
        this.rematch = { left: true };
        UI.renderRematch();
        return;
      }
      if (this.kind === 'room' && this.roomRole === 'create') {
        // 방장: 상대가 나가도 방은 그대로 두고 다시 기다립니다.
        app?.showToast?.(T('lost'), 3000);
        const code = this.roomCode;
        this.startRoom('create-same', code);
        return;
      }
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
        case 'propose': return this.onPropose(peer, msg);
        case 'accept': return this.onAccept(peer, msg);
        case 'reject': return this.onReject(peer);
        case 'room': return this.onRoomReady(peer);
        case 'req': return this.onTunnelRequest(peer, msg);
        case 'res': return this.onTunnelResponse(msg);
        case 'bye': return this.onPeerGone(peer);
        case 'cfg': return this.onCfg(peer, msg);
        case 'rdy': return this.onReady(peer, msg);
        case 'rq': return this.onRematchRequest(peer);
        case 'ra': return this.onRematchAccept(peer);
        case 'rn': return this.onRematchReject(peer);
        case 'rgo': return this.onRematchGo(peer, msg);
        case 'ping': return this.sendTo(peer, { t: 'pong', ts: msg.ts });
        case 'pong': return this.onPong(msg);
        case 'go': return this.onGo(peer, msg);
        case 'gen': return this.onGenMessage(peer, msg);
      }
    },

    countdownMs: 5000,
    lastGenProgress: null,
    roomLaunching: false,
    resetMiniBoard() {
      this.lastGenProgress = null;
      try { MatchFx.resetMiniBoard(); } catch (_) {}
    },
    onGenProgress(p) {
      if (!p) return;
      this.lastGenProgress = p;
      try { MatchFx.updateMiniBoard(p); } catch (_) {}
    },
    sendGenProgress(p) {
      const peer = this.partnerPeer && this.partnerPeer();
      if (peer && p) this.sendTo(peer, { t: 'gen', p });
    },
    onGenMessage(peer, msg) {
      if (peer.id !== this.partner || !msg?.p) return;
      this.onGenProgress(msg.p);
    },
    waitCountdownReady() {
      const dur = Number.isFinite(this.countdownMs) ? this.countdownMs : 5000;
      const targetAt = (this.matchedAt || Date.now()) + dur;
      const remain = targetAt - Date.now();
      if (remain <= 0) return Promise.resolve();
      return new Promise(resolve => setTimeout(resolve, remain));
    },

    onHello(peer, msg) {
      const peerQueue = msg.queue === 'normal' ? 'normal' : 'ranked';
      const okRandom = this.kind === 'random' && msg.kind !== 'room'
        && peerQueue === this.queue
        && msg.zone === this.zone
        && msg.diff === this.diff
        && (this.queue === 'ranked' || msg.mode === this.mode);
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
      if (this.kind === 'random' && this.queue === 'ranked') {
        this.mode = pickRandomMode();
      }
      this.sendTo(target, { t: 'propose', id: this.selfId, mode: this.mode, queue: this.queue });
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

    onPropose(peer, msg) {
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
        if (this.queue === 'ranked') {
          this.mode = MODES.some(x => x.id === msg?.mode) ? msg.mode : pickRandomMode();
        }
        this.sendTo(peer, { t: 'accept', mode: this.mode });
        this.confirmMatch(peer, 2);
      } else this.sendTo(peer, { t: 'reject' });
    },

    onAccept(peer, msg) {
      if (this.state !== 'proposing' || this.proposeTarget !== peer.id) { this.sendTo(peer, { t: 'bye' }); return; }
      clearTimeout(this.proposeTimer);
      if (this.kind === 'room') {
        // 참가자: 방장이 고른 모드·난이도를 따릅니다(내 저장된 선택은 바꾸지 않음).
        this.mode = pick(MODES, peer.hello?.mode, this.mode);
        this.diff = pick(DIFFS, peer.hello?.diff, this.diff);
        this.confirmMatch(peer, 2);
        return;
      }
      if (this.queue === 'ranked' && MODES.some(x => x.id === msg?.mode)) {
        this.mode = msg.mode;
      }
      this.confirmMatch(peer, 1);
    },

    onReject(peer) {
      peer.rejectedAt = Date.now();
      if (this.state === 'proposing' && this.proposeTarget === peer.id) this.backToSearching();
    },

    // ----- v2.0.8 판 동시 표시: 왕복 지연(RTT)을 재서 방장은 RTT/2만큼 늦게, 참가자는 받자마자 판을 엽니다.
    rtt: 0,
    measureRtt() {
      const peer = this.partnerPeer && this.partnerPeer();
      if (!peer) return;
      for (let i = 0; i < 3; i++) setTimeout(() => this.sendTo(peer, { t: 'ping', ts: performance.now() }), i * 250);
    },
    onPong(msg) {
      const r = performance.now() - Number(msg.ts);
      if (!(r >= 0 && r < 5000)) return;
      this.rtt = this.rtt ? Math.round(this.rtt * 0.6 + r * 0.4) : Math.round(r);
    },
    /** 참가자: 방장이 DataChannel로 보낸 퍼즐로 즉시 시작합니다(폴링 지연 없음). */
    onGo(peer, msg) {
      const app = window.app;
      if (peer.id !== this.partner || this.role !== 2 || !app || app.isBattle) return;
      const pz = msg.puzzle;
      if (!pz || typeof pz !== 'object' || !pz.solution) return;
      clearInterval(app.guestWaitTimer);
      try { app.hideGeneratingOverlay?.(); } catch (_) {}
      app.dom.modalBattleLobby.classList.add('hidden');
      app.battlePuzzleData = pz;
      app.startBattleMatch(2, pz, MODES.some(x => x.id === msg.mode) ? msg.mode : this.mode);
    },

    confirmMatch(peer, role) {
      setTimeout(() => this.measureRtt(), 300);
      this.guestReady = false;
      this.roomLaunching = false;
      this.lastGenProgress = null;
      this.state = 'matched';
      this.matchedAt = Date.now();
      this.role = role;
      this.partner = peer.id;
      this.partnerProfile = peer.profile || cleanProfile(null, peer.id);
      this.proposeTarget = null;
      this.stopDiscovery();
      for (const p of [...this.peers.values()]) if (p !== peer) { this.sendTo(p, { t: 'bye' }); this.closePeer(p); this.peers.delete(p.id); }
      try { SearchFx.hide(); } catch (_) {}
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
        if (this.kind === 'room') { this.mode = this.roomCfg.mode; this.diff = this.roomCfg.diff; app.battleMode = this.mode; app.battleDiff = this.diff; }
        const rulesSrc = this.kind === 'room' ? roomRules(this.roomCfg) : FIXED_RULES;
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
        if (this.kind === 'room') this.sendTo(peer, { t: 'cfg', cfg: this.roomCfg });
        this.sendTo(peer, { t: 'room' });
        this.hostStarted = false;
        clearInterval(this.hostPoll);
        // v2.1.3 / v2.1.4: 참가자 준비가 확인되거나 랜덤 매칭 성사 후 450ms가 지나면 즉시 백그라운드에서 맵 생성을 시작하고, 5..1 카운트다운 종료 시점에 맞춰 진입합니다.
        this.hostPoll = setInterval(async () => {
          if (epoch !== this.epoch || this.hostStarted) return;
          try {
            const st = await (await fetch('http://127.0.0.1:8888/api/status')).json();
            app.guestJoined = !!st.guestJoined;
            app.hostP1Ready = !!st.p1Ready;
            app.hostP2Ready = !!st.p2Ready;
            if (this.kind === 'room') { UI.render(); return; } // 방장이 '게임 시작'을 눌러야 시작합니다.
            const autoReady = this.kind === 'random' && (Date.now() - (this.matchedAt || 0)) >= 450;
            if (((st.guestJoined && st.p2Ready) || autoReady) && !this.hostStarted && !app.battleStarting) {
              this.hostStarted = true;
              app.guestJoined = true;
              app.hostP2Ready = true;
              clearInterval(this.hostPoll);
              app.startBattleAsHost();
            }
          } catch (_) {}
        }, 160);
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
        if (this.kind === 'room') { this.mode = this.roomCfg.mode; this.diff = this.roomCfg.diff; }
        app.battleMode = this.mode;
        app.battleDiff = this.diff;
        app.battleRole = 2;
        app.battleHostUrl = HOST;
        app.guestP1Ready = true;
        app.guestP2Ready = false;
        let joined = false;
        for (let i = 0; i < 3; i++) {
          try {
            const join = await this.tunnelFetch(`${HOST}/api/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const jr = await join.json().catch(() => ({}));
            if (join.ok && jr.ok) { joined = true; break; }
          } catch (_) {}
          await new Promise(r => setTimeout(r, 200));
        }
        if (!joined && this.kind === 'room') throw new Error('join');
        for (let i = 0; i < 3; i++) {
          try {
            const rdy = await this.tunnelFetch(`${HOST}/api/ready`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player: 2, ready: true }) });
            if (rdy.ok) break;
          } catch (_) {}
          await new Promise(r => setTimeout(r, 200));
        }
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

    // ----- v2.0.5 방 설정 -----
    setRoomCfg(patch) {
      if (!(this.kind === 'room' && this.roomRole === 'create')) return;
      this.roomCfg = cleanCfg({ ...this.roomCfg, ...patch });
      store.set('sumdoku_room_cfg', JSON.stringify(this.roomCfg));
      this.mode = this.roomCfg.mode; this.diff = this.roomCfg.diff;
      const app = window.app;
      const peer = this.partner && this.peers.get(this.partner);
      this.guestReady = false; // 설정이 바뀌면 참가자는 다시 확인하고 준비해야 합니다.
      if (peer) this.sendTo(peer, { t: 'cfg', cfg: this.roomCfg });
      if (this.role === 1 && app && !app.isBattle) {
        app.battleMode = this.mode; app.battleDiff = this.diff;
        try {
          const dummy = { difficulty: this.diff, rules: window.normalizedRules(roomRules(this.roomCfg), this.mode), online: true };
          window.AndroidBridge?.updateBattleServer?.(this.mode, this.diff, this.mode === 'score' ? 300 : 0, JSON.stringify(dummy));
        } catch (_) {}
      }
      UI.render();
    },

    onCfg(peer, msg) {
      if (peer.id !== this.partner || this.kind !== 'room' || this.roomRole !== 'join') return;
      const before = JSON.stringify(this.roomCfg);
      this.roomCfg = cleanCfg(msg.cfg);
      if (this.guestReady && !msg.start && before !== JSON.stringify(this.roomCfg)) { this.guestReady = false; window.app?.showToast?.(T('readyReset'), 2500); }
      this.mode = this.roomCfg.mode; this.diff = this.roomCfg.diff;
      const app = window.app;
      if (app && !app.isBattle) { app.battleMode = this.mode; app.battleDiff = this.diff; }
      if (msg.start) {
        this.state = 'matched';
        this.matchedAt = Date.now();
        this.lastGenProgress = null;
        this.roomLaunching = true;
      }
      UI.render();
    },

    /** 방장: 상대가 들어온 뒤 '게임 시작'을 눌렀을 때만 경기를 시작합니다. */
    async roomStart() {
      const app = window.app;
      if (this.kind !== 'room' || this.role !== 1 || this.state !== 'matched' || this.hostStarted || app.battleStarting) return;
      const peer = this.partner && this.peers.get(this.partner);
      if (!peer || !peer.open || !app.guestJoined) { app.showToast?.(T('roomNoGuest'), 2500); return; }
      if (!this.guestReady) { app.showToast?.(T('notReadyYet'), 2500); return; }
      const c = this.roomCfg;
      this.mode = c.mode; this.diff = c.diff;
      app.battleMode = c.mode; app.battleDiff = c.diff;
      try {
        const dummy = { difficulty: c.diff, rules: window.normalizedRules(roomRules(c), c.mode), online: true };
        window.AndroidBridge?.updateBattleServer?.(c.mode, c.diff, c.mode === 'score' ? 300 : 0, JSON.stringify(dummy));
      } catch (_) {}
      this.state = 'matched';
      this.matchedAt = Date.now();
      this.lastGenProgress = null;
      this.roomLaunching = true;
      this.sendTo(peer, { t: 'cfg', cfg: c, start: true });
      const post = body => fetch('http://127.0.0.1:8888/api/ready', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
      await post({ player: 1, ready: true });
      await post({ player: 2, ready: true });
      app.hostRoomCreated = true; app.guestJoined = true; app.hostP1Ready = true; app.hostP2Ready = true;
      this.hostStarted = true;
      clearInterval(this.hostPoll);
      UI.render();
      app.startBattleAsHost();
    },

    // ----- v2.0.5 재대결: 신청 → 상대 수락/거절 -----
    partnerPeer() { const p = this.partner && this.peers.get(this.partner); return p && p.open ? p : null; },
    requestRematch() {
      const peer = this.partnerPeer();
      if (!peer) { this.rematch = { left: true }; UI.renderRematch(); return; }
      if (this.rematch?.in) { this.acceptRematch(); return; }
      this.rematch = { out: true };
      this.sendTo(peer, { t: 'rq' });
      UI.renderRematch();
    },
    onRematchRequest(peer) {
      if (peer.id !== this.partner) return;
      if (this.rematch?.out) { this.acceptRematch(); return; } // 동시에 신청하면 바로 성사
      this.rematch = { in: true };
      window.app?.sound?.play?.('click');
      try { navigator.vibrate?.(40); } catch (_) {}
      UI.renderRematch();
    },
    acceptRematch() {
      const peer = this.partnerPeer();
      if (!peer) { this.rematch = { left: true }; UI.renderRematch(); return; }
      this.sendTo(peer, { t: 'ra' });
      this.doRematch();
    },
    rejectRematch() {
      const peer = this.partnerPeer();
      if (peer) this.sendTo(peer, { t: 'rn' });
      this.rematch = { youRejected: true };
      UI.renderRematch();
    },
    onRematchAccept(peer) {
      if (peer.id !== this.partner || !(this.rematch?.out || this.rematch?.in)) return;
      this.doRematch();
    },
    onRematchReject(peer) {
      if (peer.id !== this.partner) return;
      this.rematch = { rejected: true };
      window.app?.showToast?.(T('rmRejected'), 3000);
      UI.renderRematch();
    },
    /** 재대결 성사: 방장이 서버를 재대결 대기 상태로 바꾼 뒤 참가자에게 'rgo'를 보냅니다. */
    async doRematch() {
      const app = window.app;
      this.rematch = { accepted: true };
      UI.renderRematch();
      clearInterval(app.rematchCheckTimer);
      if (this.role !== 1) return; // 참가자는 방장의 'rgo'를 기다립니다.
      if (this.kind === 'random' && this.queue === 'ranked') {
        this.mode = pickRandomMode();
        if (app) app.battleMode = this.mode;
        try {
          const dummy = { difficulty: this.diff, rules: window.normalizedRules ? window.normalizedRules(FIXED_RULES, this.mode) : FIXED_RULES, online: true };
          window.AndroidBridge?.updateBattleServer?.(this.mode, this.diff, this.mode === 'score' ? 300 : 0, JSON.stringify(dummy));
        } catch (_) {}
      }
      try { await fetch('http://127.0.0.1:8888/api/rematch', { method: 'POST' }); } catch (_) {}
      const peer = this.partnerPeer();
      if (peer) this.sendTo(peer, { t: 'rgo', mode: this.mode });
      this.enterRematchLobby();
    },
    onRematchGo(peer, msg) {
      if (peer.id !== this.partner || this.role !== 2) return;
      if (this.kind === 'random' && this.queue === 'ranked' && MODES.some(x => x.id === msg?.mode)) {
        this.mode = msg.mode;
        if (window.app) window.app.battleMode = this.mode;
      }
      this.enterRematchLobby();
    },
    /** 참가자: 준비 완료/취소 */
    toggleReady() {
      if (this.kind !== 'room' || this.roomRole !== 'join' || this.state !== 'matched') return;
      const peer = this.partnerPeer();
      if (!peer) return;
      this.guestReady = !this.guestReady;
      this.sendTo(peer, { t: 'rdy', v: this.guestReady });
      try { navigator.vibrate?.(30); } catch (_) {}
      UI.render();
    },
    onReady(peer, msg) {
      if (peer.id !== this.partner || this.roomRole !== 'create') return;
      this.guestReady = msg.v === true;
      if (this.guestReady) { window.app?.sound?.play?.('click'); try { navigator.vibrate?.(40); } catch (_) {} }
      UI.render();
    },

    enterRematchLobby() {
      const app = window.app;
      if (!app) return;
      clearInterval(app.rematchCheckTimer);
      this.rematch = null;
      this.hostStarted = false;
      this.guestReady = false; // 재대결도 참가자가 다시 준비해야 시작합니다.
      this.roomLaunching = false;
      this.lastGenProgress = null;
      this.state = 'matched';
      this.matchedAt = Date.now();
      this.measureRtt();
      app.dom.modalBattleResult.classList.add('hidden');
      app.isRematchActive = true;
      app.returnToBattleLobby();
    },

    setQueue(q) {
      const nq = q === 'normal' ? 'normal' : 'ranked';
      if (this.queue !== nq) {
        this.queue = nq;
        store.set('sumdoku_online_queue', nq);
        this.restartIfSearching();
      }
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
      const inMatch = M.state === 'matched' || M.state === 'playing' || !!window.app?.isBattle;
      // 랜덤 매칭만 공정 고정 규칙. 방 번호 배틀은 같은 Wi-Fi 방처럼 방장 설정을 씁니다.
      if (M.active && M.kind === 'random' && inMatch) return baseRules(FIXED_RULES, battleMode);
      if (M.active && M.kind === 'room' && inMatch) return baseRules(roomRules(M.roomCfg), battleMode || M.roomCfg.mode);
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

      // 예전 탭 버튼(숨김). 테스트·다른 모듈 호환용으로 id만 유지합니다.
      const tab = document.createElement('button');
      tab.id = 'tab-battle-online';
      tab.className = 'battle-tab-btn online-tab';
      tab.type = 'button';
      tabs.append(tab);

      const view = document.createElement('div');
      view.id = 'battle-online-view';
      view.className = 'battle-view-section online-view';
      view.innerHTML = `
        <label class="om-label" data-k="name" for="om-name-input"></label>
        <div class="om-name-row"><span class="om-name-flag"></span><input id="om-name-input" class="om-name-input" type="text" maxlength="16" autocomplete="nickname" spellcheck="false" enterkeyhint="done"><span class="om-name-tier"></span></div>
        <div class="om-name-hint"></div>

        <div class="om-kinds" role="tablist">
          <button type="button" class="om-kind" data-kind="random" role="tab"></button>
          <button type="button" class="om-kind" data-kind="room" role="tab"></button>
        </div>

        <section class="om-only-random">
          <div class="om-zone-auto"></div>
          <div class="om-label" data-k="queueLabel"></div>
          <div class="om-queues" role="radiogroup">
            <button type="button" class="om-queue" data-queue="ranked" role="radio"></button>
            <button type="button" class="om-queue" data-queue="normal" role="radio"></button>
          </div>
          <p class="om-queue-desc"></p>
          <div class="om-label" data-k="mode"></div>
          <div class="om-mode-picker-wrap">
            <div class="om-modes om-grid2" role="radiogroup"></div>
            <p class="om-mode-desc"></p>
          </div>
          <div class="om-random-mode-box hidden">
            <div class="om-random-mode-head"></div>
            <div class="om-random-mode-pool"></div>
          </div>
          <div class="om-label" data-k="diff"></div>
          <div class="om-diffs om-grid5" role="radiogroup"></div>
          <div class="om-rules"><span class="om-rules-title"></span><span class="om-rules-chips"></span></div>
          <div class="om-status hidden" aria-live="polite">
            <div class="om-radar" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="om-status-text"></div>
            <div class="om-stats"></div>
          </div>
          <div class="om-matched hidden"></div>
          <p class="om-nat"></p>
          <div class="om-footer"><button type="button" class="btn btn-primary om-start"></button></div>
        </section>

        <section class="om-only-room">
          <p class="om-room-lead"></p>
          <button type="button" class="btn btn-primary om-room-create"></button>
          <div class="om-or"><span></span></div>
          <div class="om-room-join-row">
            <input class="om-room-input" type="text" inputmode="numeric" maxlength="7" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="room code">
            <button type="button" class="btn btn-secondary om-room-join"></button>
          </div>
          <p class="om-nat om-nat-room"></p>
        </section>`;
      joinView.after(view);

      // 방 화면: 로비 위에 전체 화면으로 뜹니다.
      const room = document.createElement('div');
      room.id = 'om-room-screen';
      room.className = 'om-room-screen hidden';
      room.setAttribute('role', 'dialog');
      room.setAttribute('aria-modal', 'true');
      room.innerHTML = `
        <div class="om-room-inner">
          <header class="om-room-head">
            <button type="button" class="om-room-leave"></button>
            <strong class="om-room-title"></strong>
            <span class="om-room-head-gap"></span>
          </header>
          <div class="om-code-card">
            <div class="om-code-label"></div>
            <button type="button" class="om-room-code"></button>
            <button type="button" class="btn btn-secondary om-room-copy"></button>
          </div>
          <div class="om-room-status" aria-live="polite"></div>
          <div class="om-room-players"></div>
          <section class="om-room-settings">
            <div class="om-room-settings-head"><strong data-k="roomSettings"></strong><span class="om-host-only"></span></div>
            <div class="om-set"><div class="om-set-label" data-k="mode"></div><div class="om-r-modes om-grid2"></div><p class="om-mode-desc om-r-desc"></p></div>
            <div class="om-set"><div class="om-set-label" data-k="diff"></div><div class="om-r-diffs om-grid5"></div></div>
            <div class="om-set"><div class="om-set-label" data-k="lives"></div><div class="om-r-lives om-seg"></div><p class="om-set-note om-lives-note"></p></div>
            <div class="om-set"><div class="om-set-label" data-k="hints"></div><div class="om-r-hints om-seg"></div></div>
            <div class="om-set"><div class="om-set-label" data-k="autoNotes"></div><div class="om-r-auto om-seg"></div></div>
            <div class="om-set om-set-turn"><div class="om-set-label" data-k="turnTime"></div><div class="om-r-turn om-seg"></div></div>
          </section>
          <footer class="om-room-foot">
            <button type="button" class="btn btn-primary om-room-start"></button>
            <button type="button" class="btn btn-primary om-room-ready" hidden></button>
            <div class="om-room-wait"></div>
          </footer>
        </div>`;
      (document.getElementById('app') || document.body).append(room);

      const q = sel => view.querySelector(sel), r = sel => room.querySelector(sel);
      this.el = {
        tab, view, room,
        nameInput: q('.om-name-input'), nameFlag: q('.om-name-flag'), nameTier: q('.om-name-tier'), nameHint: q('.om-name-hint'),
        kinds: view.querySelectorAll('.om-kind'),
        queues: view.querySelectorAll('.om-queue'), queueDesc: q('.om-queue-desc'),
        modePickerWrap: q('.om-mode-picker-wrap'), randomModeBox: q('.om-random-mode-box'),
        randomModeHead: q('.om-random-mode-head'), randomModePool: q('.om-random-mode-pool'),
        zoneAuto: q('.om-zone-auto'), modes: q('.om-modes'), modeDesc: q('.om-only-random .om-mode-desc'), diffs: q('.om-diffs'),
        rulesTitle: q('.om-rules-title'), rulesChips: q('.om-rules-chips'),
        status: q('.om-status'), statusText: q('.om-status-text'), stats: q('.om-stats'),
        matched: q('.om-matched'), nats: view.querySelectorAll('.om-nat'), start: q('.om-start'),
        roomLead: q('.om-room-lead'), roomCreate: q('.om-room-create'), or: q('.om-or span'), roomInput: q('.om-room-input'), roomJoin: q('.om-room-join'),
        rLeave: r('.om-room-leave'), rTitle: r('.om-room-title'), rCodeCard: r('.om-code-card'), rCodeLabel: r('.om-code-label'), rCode: r('.om-room-code'), rCopy: r('.om-room-copy'),
        rStatus: r('.om-room-status'), rPlayers: r('.om-room-players'), rHostOnly: r('.om-host-only'),
        rModes: r('.om-r-modes'), rDesc: r('.om-r-desc'), rDiffs: r('.om-r-diffs'), rLives: r('.om-r-lives'), rLivesNote: r('.om-lives-note'),
        rHints: r('.om-r-hints'), rAuto: r('.om-r-auto'), rTurn: r('.om-r-turn'), rTurnSet: r('.om-set-turn'),
        rStart: r('.om-room-start'), rReady: r('.om-room-ready'), rWait: r('.om-room-wait')
      };

      // ---------------- 이벤트 ----------------
      const click = () => app.sound?.play?.('click');
      this.el.start.addEventListener('click', () => {
        click();
        if (M.state === 'idle' || M.state === 'postgame') M.startRandom(); else { M.leave(); setTimeout(() => this.render(), 400); }
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
        if (M.state !== 'idle' && M.state !== 'postgame') return;
        click();
        M.kind = b.dataset.kind === 'room' ? 'room' : 'random';
        store.set('sumdoku_online_kind', M.kind);
        this.render();
      }));
      this.el.queues.forEach(b => b.addEventListener('click', () => {
        if (M.state === 'matched' || M.state === 'playing') return;
        click();
        M.setQueue(b.dataset.queue);
      }));
      this.el.roomCreate.addEventListener('click', () => { click(); M.startRoom('create'); });
      const join = () => {
        click();
        const code = String(this.el.roomInput.value || '').replace(/\D/g, '');
        if (code.length !== 6) { this.el.roomInput.setAttribute('aria-invalid', 'true'); app.showToast?.(T('roomBad'), 2500); return; }
        this.el.roomInput.removeAttribute('aria-invalid');
        this.el.roomInput.blur();
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
      this.el.rCode.addEventListener('click', copy);
      this.el.rCopy.addEventListener('click', copy);
      this.el.rLeave.addEventListener('click', () => { click(); M.leave(); setTimeout(() => this.render(), 400); });
      this.el.rStart.addEventListener('click', () => { click(); M.roomStart(); });
      this.el.rReady.addEventListener('click', () => { click(); M.toggleReady(); });
      // 안드로이드 뒤로 가기 등으로 로비가 닫히면 방 화면도 닫습니다.
      this.renderPickers();
      this.render();
      return true;
    },

    show() {
      if (!this.build()) return;
      const app = window.app;
      if (!M.active) {
        M.internalCancel = true;
        try { app.cancelRoomPreparation?.(); } finally { M.internalCancel = false; }
      }
      this.el.view.classList.remove('hidden');
      document.getElementById('battle-mobile-data-warning')?.remove();
      this.renderPickers();
      this.render();
    },

    // 칩 목록을 그립니다. disabled=true면 읽기 전용(참가자).
    chips(wrap, list, cur, onPick, labelFn, disabled) {
      const key = JSON.stringify([list.map(x => x.id), cur, disabled, langIdx()]);
      if (wrap.dataset.key === key) return;
      wrap.dataset.key = key;
      wrap.innerHTML = '';
      wrap.setAttribute('role', 'radiogroup');
      for (const it of list) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'om-chip' + (it.id === cur ? ' active' : '');
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', it.id === cur ? 'true' : 'false');
        b.disabled = !!disabled;
        b.textContent = labelFn(it);
        b.addEventListener('click', () => { window.app?.sound?.play?.('click'); onPick(it.id); });
        wrap.append(b);
      }
    },

    renderPickers() {
      if (!this.built) return;
      const locked = M.state === 'matched' || M.state === 'playing';
      const isRanked = M.queue === 'ranked';
      this.el.queues.forEach(b => {
        const on = b.dataset.queue === M.queue;
        b.textContent = T(b.dataset.queue === 'normal' ? 'queueNormal' : 'queueRanked');
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.disabled = locked;
      });
      this.el.queueDesc.textContent = T(isRanked ? 'queueRankedDesc' : 'queueNormalDesc');
      this.el.modePickerWrap.classList.toggle('hidden', isRanked);
      this.el.randomModeBox.classList.toggle('hidden', !isRanked);
      if (isRanked) {
        this.el.randomModeHead.textContent = T('rankedModeBadge');
        const pkey = String(langIdx());
        if (this.el.randomModePool.dataset.key !== pkey) {
          this.el.randomModePool.dataset.key = pkey;
          this.el.randomModePool.innerHTML = MODES.map(m => `<span class="om-random-pill" data-mode="${m.id}">${L(m)}</span>`).join('');
        }
      } else {
        this.chips(this.el.modes, MODES, M.mode, id => { M.setMode(id); this.renderPickers(); }, L, locked);
        this.el.modeDesc.textContent = modeDesc(M.mode);
      }
      this.chips(this.el.diffs, DIFFS, M.diff, id => { M.setDiff(id); this.renderPickers(); }, L, locked);
      M.zone = guessZone();
      const gz = ZONES.find(z => z.id === M.zone);
      this.el.zoneAuto.textContent = `${gz.flag} ${T('zoneAuto')} · ${L(gz)}`;
    },

    renderRoomSettings() {
      const c = M.roomCfg, ro = M.roomRole !== 'create';
      const set = patch => M.setRoomCfg(patch);
      this.chips(this.el.rModes, MODES, c.mode, id => set({ mode: id }), L, ro);
      this.chips(this.el.rDiffs, DIFFS, c.diff, id => set({ diff: id }), L, ro);
      const freeLives = c.mode === 'race' || c.mode === 'score';
      this.chips(this.el.rLives, LIVES_OPTS.map(n => ({ id: n })), c.lives, id => set({ lives: id }), x => String(x.id), ro || freeLives);
      this.el.rLives.classList.toggle('om-dim', freeLives);
      this.el.rLivesNote.textContent = freeLives ? T('livesFree') : '';
      const noHints = c.mode === 'turn'; // 턴제는 힌트를 쓸 수 없습니다.
      this.chips(this.el.rHints, HINT_OPTS.map(n => ({ id: n })), c.hints, id => set({ hints: id }), x => String(x.id), ro || noHints);
      this.el.rHints.classList.toggle('om-dim', noHints);
      this.chips(this.el.rAuto, [{ id: 'on' }, { id: 'off' }], c.autoNotes ? 'on' : 'off', id => set({ autoNotes: id === 'on' }), x => T(x.id), ro);
      this.chips(this.el.rTurn, TURN_OPTS.map(n => ({ id: n })), c.turn, id => set({ turn: id }), x => x.id + T('sec'), ro);
      this.el.rTurnSet.hidden = c.mode !== 'turn';
      this.el.rDesc.textContent = modeDesc(c.mode);
      this.el.rHostOnly.textContent = ro ? T('hostOnly') : '';
    },

    playerCard(who, prof, extraClass) {
      const c = document.createElement('div'); c.className = 'om-player ' + (extraClass || '');
      const wh = document.createElement('div'); wh.className = 'om-player-who'; wh.textContent = who;
      const em = document.createElement('div'); em.className = 'om-player-emblem';
      const nm = document.createElement('div'); nm.className = 'om-player-name';
      const tr = document.createElement('div'); tr.className = 'om-player-tier';
      if (prof) {
        em.innerHTML = tierSvg(prof.tier, 48);
        nm.textContent = `${flagOf(prof.cc)} ${prof.n}`;
        tr.textContent = tierLabel(prof.tier) + (prof.tier.rp ? ` · ${prof.tier.rp} RP` : '');
      } else {
        em.innerHTML = '<span class="om-slot-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
        nm.textContent = T('waitingSlot');
      }
      c.append(wh, em, nm, tr);
      return c;
    },

    renderRoom() {
      const e = this.el;
      const lobby = window.app?.dom?.modalBattleLobby;
      const inRoomLobbyState = M.state === 'searching' || M.state === 'proposing' || (M.state === 'matched' && !M.roomLaunching);
      const open = M.kind === 'room' && inRoomLobbyState && !(window.app && window.app.isBattle) && !!lobby && !lobby.classList.contains('hidden');
      e.room.classList.toggle('hidden', !open);
      document.documentElement.classList.toggle('om-room-open', open);
      if (!open) return;
      const host = M.roomRole === 'create';
      const matched = M.state === 'matched';
      const app = window.app;
      e.rLeave.textContent = '← ' + T('leave');
      e.rTitle.textContent = T('roomTitle');
      e.rCodeLabel.textContent = T('roomCodeLabel');
      e.rCode.textContent = M.roomCode.slice(0, 3) + ' ' + M.roomCode.slice(3);
      e.rCopy.textContent = '📋 ' + T('copy');
      e.rCopy.hidden = !host;
      e.room.querySelectorAll('[data-k]').forEach(l => { l.textContent = T(l.dataset.k); });

      // 플레이어 카드
      const players = document.createElement('div'); players.className = 'om-vs';
      const me = this.playerCard(host ? T('host') : T('me'), myProfile(M.roomCfg.diff), 'me');
      const opp = matched ? this.playerCard(host ? T('opp') : T('host'), M.partnerProfile || cleanProfile(null, M.partner), 'opp') : this.playerCard(T('opp'), null, 'empty');
      // 참가자 카드(방장 화면에서는 상대, 참가자 화면에서는 나)에 준비 상태 배지
      const guestCard = host ? opp : me;
      if (matched) {
        const tag = document.createElement('span');
        tag.className = 'om-ready-tag' + (M.guestReady ? ' on' : '');
        tag.textContent = M.guestReady ? '✔ ' + T('readyTag') : T('notReadyTag');
        guestCard.append(tag);
        guestCard.classList.toggle('is-ready', M.guestReady);
      }
      const x = document.createElement('span'); x.className = 'om-vs-x'; x.textContent = 'VS';
      players.append(host ? me : opp, x, host ? opp : me);
      const pkey = JSON.stringify([M.guestReady, host, matched, M.partner, M.partnerProfile, myName(), langIdx(), M.roomCfg.diff]);
      if (e.rPlayers.dataset.key !== pkey) { e.rPlayers.dataset.key = pkey; e.rPlayers.replaceChildren(players); }

      // 상태 문구
      let status;
      if (host) status = !matched ? T('waitGuest') : (app?.battleStarting || M.hostStarted ? T('matched') : (M.guestReady ? T('guestReadyNow') : T('waitReady')));
      else status = !matched ? (Date.now() - M.startedAt > 45000 ? T('roomNotFound') : T('roomJoining')) : (M.guestReady ? T('waitHost') : T('pressReady'));
      e.rStatus.textContent = status;
      e.rStatus.classList.toggle('om-ok', matched);

      this.renderRoomSettings();
      e.rStart.hidden = !host;
      e.rStart.textContent = '▶ ' + T('startGame');
      e.rStart.disabled = !(host && matched && app?.guestJoined && M.guestReady && !M.hostStarted && !app?.battleStarting);
      // 참가자: 준비 버튼(준비 후에는 '준비 취소'로 바뀜)
      e.rReady.hidden = host || !matched || M.hostStarted || !!app?.battleStarting;
      e.rReady.textContent = M.guestReady ? T('unreadyBtn') : T('readyBtn');
      e.rReady.className = `btn ${M.guestReady ? 'btn-secondary' : 'btn-primary'} om-room-ready`;
      e.rWait.hidden = host || (matched && !M.guestReady);
      e.rWait.textContent = matched ? T('waitHost') : T('roomJoining');
    },

    renderRematch() {
      const app = window.app;
      const modal = app?.dom?.modalBattleResult;
      if (!modal) return;
      let box = document.getElementById('om-rematch-box');
      const actions = modal.querySelector('.battle-result-actions');
      if (!M.active && !M.rematch) { if (box) box.hidden = true; return; }
      if (!box && actions) {
        box = document.createElement('div');
        box.id = 'om-rematch-box';
        box.className = 'om-rematch-box';
        box.setAttribute('aria-live', 'polite');
        actions.before(box);
      }
      if (!box) return;
      const st = M.rematch || {};
      const btn = app.dom.btnBattleRematch;
      box.replaceChildren();
      box.hidden = !M.rematch;
      box.className = 'om-rematch-box';
      if (st.out) { box.textContent = '⏳ ' + T('rmSent'); box.classList.add('wait'); }
      else if (st.in) {
        box.classList.add('incoming');
        const t = document.createElement('div'); t.className = 'om-rm-title'; t.textContent = '⚔️ ' + T('rmIncoming');
        const row = document.createElement('div'); row.className = 'om-rm-row';
        const no = document.createElement('button'); no.type = 'button'; no.className = 'btn btn-secondary'; no.textContent = T('rmReject');
        const yes = document.createElement('button'); yes.type = 'button'; yes.className = 'btn btn-primary'; yes.textContent = T('rmAccept');
        no.addEventListener('click', () => { app.sound?.play?.('click'); M.rejectRematch(); });
        yes.addEventListener('click', () => { app.sound?.play?.('click'); M.acceptRematch(); });
        row.append(no, yes);
        box.append(t, row);
      }
      else if (st.rejected) { box.textContent = '🙅 ' + T('rmRejected'); box.classList.add('bad'); }
      else if (st.youRejected) { box.textContent = T('rmYouRejected'); box.classList.add('muted'); }
      else if (st.left) { box.textContent = '🚪 ' + T('rmLeft'); box.classList.add('bad'); }
      else if (st.accepted) { box.textContent = '✅ ' + T('rmAccepted'); box.classList.add('ok'); }
      if (btn) {
        const blocked = !!(st.out || st.in || st.rejected || st.youRejected || st.left || st.accepted);
        btn.hidden = !!st.in || !!st.left;
        btn.disabled = blocked;
      }
    },

    render() {
      if (!this.built) return;
      const e = this.el;
      e.tab.textContent = T('tab');
      e.view.querySelectorAll('.om-label').forEach(l => { l.textContent = T(l.dataset.k); });
      // v2.1.2: 경쟁전은 매칭 전에 모드가 정해지지 않으므로 공통 공정 규칙을 표시하고, 일반전·매칭 완료 후에는 모드별 세부 규칙을 표시합니다.
      const base = T('rulesChips'); // [목숨 3, 힌트 3, 자동 메모 끔, 턴 30초]
      const showModeRules = M.queue === 'normal' || M.state === 'matched' || M.state === 'playing';
      const chips = showModeRules ? ({
        race: [T('rcLivesInf'), base[1], base[2]],
        score: [T('rcTime5'), T('rcLivesInf'), base[1], base[2]],
        survival: [base[0], base[1], base[2]],
        turn: [base[0], T('rcNoHints'), base[2], base[3]]
      }[M.mode] || base) : base;
      e.rulesTitle.textContent = '⚖️ ' + T('rulesTitle');
      const ckey = JSON.stringify(chips);
      if (e.rulesChips.dataset.key !== ckey) {
        e.rulesChips.dataset.key = ckey;
        e.rulesChips.replaceChildren(...chips.map(c => { const s = document.createElement('span'); s.className = 'om-rule-chip'; s.textContent = c; return s; }));
      }
      e.nameHint.textContent = T('nameHint');
      e.kinds.forEach(b => {
        const on = b.dataset.kind === M.kind;
        b.textContent = T(b.dataset.kind === 'room' ? 'kindRoom' : 'kindRandom');
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.disabled = (M.state !== 'idle' && M.state !== 'postgame') && !on;
      });
      e.view.classList.toggle('om-kind-room', M.kind === 'room');
      e.roomLead.textContent = T('roomLead');
      e.roomCreate.textContent = '🏠 ' + T('roomCreate');
      e.or.textContent = T('or');
      e.roomJoin.textContent = T('roomJoin');
      e.roomInput.placeholder = T('roomCodePh');
      e.nats.forEach(n => { n.textContent = T('nat'); });
      e.nameInput.placeholder = ID.name || T('namePh');
      if (document.activeElement !== e.nameInput) e.nameInput.value = customName();
      e.nameInput.disabled = M.state !== 'idle' && M.state !== 'postgame';
      e.nameFlag.textContent = flagOf(myCountry());
      const mt = myTier(M.diff);
      const tkey = JSON.stringify(mt);
      if (e.nameTier.dataset.key !== tkey) { e.nameTier.dataset.key = tkey; e.nameTier.innerHTML = tierSvg(mt, 30); }
      e.nameTier.title = tierLabel(mt);

      const isSearching = M.state === 'searching' || M.state === 'proposing';
      const isMatched = M.state === 'matched';
      const busy = (isSearching || isMatched) && M.kind === 'random';
      e.view.classList.toggle('om-busy', busy);
      e.view.classList.toggle('om-is-matched', isMatched);
      e.start.textContent = busy ? T('cancel') : T('start');
      e.start.className = `btn ${busy ? 'btn-secondary' : 'btn-primary'} om-start`;
      e.status.classList.toggle('hidden', !busy || isMatched);
      e.matched.classList.toggle('hidden', !(busy && isMatched));
      this.renderPickers();

      if (busy && isSearching) {
        const sec = Math.floor((Date.now() - M.startedAt) / 1000);
        const z = ZONES.find(x => x.id === M.zone);
        const qBadge = T(M.queue === 'normal' ? 'queueNormal' : 'queueRanked');
        e.statusText.textContent = `${qBadge} · ` + (M.state === 'proposing' ? T('found') : T('searching')) + ` ${z.flag}`;
        e.stats.innerHTML = `<div class="om-elapsed">${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</div>`;
      }
      if (busy && isMatched) {
        const z = ZONES.find(x => x.id === M.zone), mo = MODES.find(x => x.id === M.mode), di = DIFFS.find(x => x.id === M.diff);
        const qBadge = T(M.queue === 'normal' ? 'queueNormal' : 'queueRanked');
        e.matched.innerHTML = '';
        const h = document.createElement('div'); h.className = 'om-matched-title'; h.textContent = '⚔️ ' + T('matched');
        const vs = document.createElement('div'); vs.className = 'om-vs';
        const x = document.createElement('span'); x.className = 'om-vs-x'; x.textContent = 'VS';
        vs.append(this.playerCard(T('me'), myProfile(M.diff)), x, this.playerCard(T('opp'), M.partnerProfile || cleanProfile(null, M.partner)));
        const meta = document.createElement('div'); meta.className = 'om-matched-meta';
        meta.textContent = `${qBadge} · ${z.flag} ${L(z)} · ${L(mo)} · ${L(di)} · ${M.role === 1 ? T('youHost') : T('youGuest')}`;
        e.matched.append(h, vs, meta);
      }
      this.renderRoom();
      const showSearchFx = !(window.app && window.app.isBattle) && M.kind === 'random' && isSearching;
      if (showSearchFx) SearchFx.show(); else SearchFx.hide();
      const showMatchFx = !(window.app && window.app.isBattle) && isMatched && (M.kind === 'random' || M.roomLaunching);
      if (showMatchFx) MatchFx.show(); else MatchFx.hide();
    }
  };

  // v2.1.3 · 매칭 탐색 중 화면 전체에 크게 뜨는 전용 매칭 탐색 UI
  const SearchFx = {
    el: null, key: '', timer: null,
    show() {
      if (window.app?.isBattle || M.kind !== 'random' || (M.state !== 'searching' && M.state !== 'proposing')) {
        this.hide();
        return;
      }
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.id = 'om-search-fx';
        this.el.className = 'om-search-fx';
        this.el.setAttribute('role', 'dialog');
        this.el.setAttribute('aria-modal', 'true');
        (document.getElementById('app') || document.body).append(this.el);
      }
      const isRanked = M.queue === 'ranked';
      this.el.classList.toggle('is-ranked', isRanked);
      this.el.classList.toggle('is-proposing', M.state === 'proposing');

      const z = ZONES.find(x => x.id === M.zone) || ZONES[0];
      const mo = MODES.find(x => x.id === M.mode) || MODES[0];
      const di = DIFFS.find(x => x.id === M.diff) || DIFFS[0];
      const qBadge = T(isRanked ? 'queueRanked' : 'queueNormal');
      const modeLabel = isRanked ? T('random4Modes') : L(mo);
      const prof = myProfile(M.diff);

      const key = JSON.stringify([M.queue, M.zone, M.mode, M.diff, M.state, prof.n, prof.cc, prof.tier, langIdx()]);
      if (this.key !== key) {
        this.key = key;
        this.el.innerHTML = `
          <div class="om-sfx-inner">
            <div class="om-sfx-badges">
              <span class="om-sfx-pill om-sfx-queue">${qBadge}</span>
              <span class="om-sfx-pill om-sfx-zone">${z.flag} ${L(z)}</span>
            </div>
            <div class="om-sfx-radar-wrap" aria-hidden="true">
              <div class="om-sfx-radar">
                <span class="om-sfx-ring r1"></span>
                <span class="om-sfx-ring r2"></span>
                <span class="om-sfx-ring r3"></span>
                <div class="om-sfx-sweep"></div>
                <div class="om-sfx-center">${tierSvg(prof.tier, 64)}</div>
              </div>
            </div>
            <div class="om-sfx-title">${T(M.state === 'proposing' ? 'searchFoundTitle' : 'searchTitle')}</div>
            <div class="om-sfx-sub">${T(M.state === 'proposing' ? 'found' : 'searching')}</div>
            <div class="om-sfx-chips">
              <span class="om-sfx-chip">${modeLabel}</span>
              <span class="om-sfx-chip">${L(di)}</span>
            </div>
            <div class="om-sfx-timer">0:00</div>
            <div class="om-sfx-me-wrap"></div>
            <button type="button" class="btn btn-secondary om-sfx-cancel">${T('cancel')}</button>
          </div>`;
        const meWrap = this.el.querySelector('.om-sfx-me-wrap');
        if (meWrap) meWrap.append(UI.playerCard(T('me'), prof, 'om-sfx-player'));
        const cancelBtn = this.el.querySelector('.om-sfx-cancel');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            window.app?.sound?.play?.('click');
            M.leave();
            this.hide();
            setTimeout(() => UI.render(), 350);
          });
        }
      }
      this.updateTimer();
      if (!this.el.classList.contains('on')) {
        this.el.classList.add('on');
        clearInterval(this.timer);
        this.timer = setInterval(() => {
          if (window.app?.isBattle || M.kind !== 'random' || (M.state !== 'searching' && M.state !== 'proposing')) {
            this.hide();
            return;
          }
          this.updateTimer();
        }, 250);
      }
    },
    updateTimer() {
      if (!this.el) return;
      const tEl = this.el.querySelector('.om-sfx-timer');
      if (!tEl) return;
      const sec = Math.max(0, Math.floor((Date.now() - (M.startedAt || Date.now())) / 1000));
      tEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    },
    hide() {
      clearInterval(this.timer);
      this.timer = null;
      if (this.el) {
        this.el.classList.remove('on');
        this.key = '';
      }
    }
  };

  // v2.0.9 / v2.1.2 / v2.1.3 · 매칭 성사 시 전체 화면 VS 연출 + 경쟁전 랜덤 모드 룰렛 + 5,4,3,2,1 카운트다운 + 하단 소형 미니보드
  const MINI_PALETTE = [
    '#bfdbfe', '#bbf7d0', '#fef08a', '#fed7aa', '#fbcfe8',
    '#ddd6fe', '#c7d2fe', '#99f6e4', '#fed7d7', '#e9d5ff'
  ];
  const MatchFx = {
    el: null, key: '', watch: null, spinTimer: null, audioCtx: null, lastCountVal: 0, rouletteState: null,
    playTick(final, freqOverride) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        if (!this.audioCtx) this.audioCtx = new AC();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume().catch(() => {});
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = final ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freqOverride || (final ? 880 : 520), now);
        if (final) osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
        gain.gain.setValueAtTime(final ? 0.14 : 0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (final ? 0.24 : 0.055));
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + (final ? 0.25 : 0.06));
      } catch (_) {}
    },
    lockRoulette() {
      const st = this.rouletteState;
      if (!st || st.locked) return;
      st.locked = true;
      clearTimeout(this.spinTimer);
      this.spinTimer = null;
      const { wrap, cards, slotText, statusEl, targetIdx } = st;
      const targetMode = MODES[targetIdx] || MODES[0];
      cards.forEach((c, idx) => {
        c.classList.toggle('is-active', idx === targetIdx);
        c.classList.toggle('is-locked', idx === targetIdx);
      });
      if (slotText) {
        slotText.textContent = L(targetMode);
        slotText.classList.remove('om-fx-r-flip');
        void slotText.offsetWidth;
        slotText.classList.add('om-fx-r-flip');
      }
      if (wrap) wrap.classList.add('is-locked');
      if (statusEl) statusEl.textContent = T('rouletteLocked');
      const metaEl = this.el?.querySelector('.om-fx-meta');
      if (metaEl && M.kind === 'random' && M.queue === 'ranked') {
        const di = DIFFS.find(x => x.id === M.diff) || DIFFS[0];
        metaEl.textContent = `${T('queueRanked')} · ${L(targetMode)} · ${L(di)}`;
      }
      this.playTick(true);
      try { navigator.vibrate?.([30, 40, 90]); } catch (_) {}
    },
    spinRoulette(wrap, targetModeId) {
      clearTimeout(this.spinTimer);
      this.spinTimer = null;
      const cards = Array.from(wrap.querySelectorAll('.om-fx-r-card'));
      const slotText = wrap.querySelector('.om-fx-r-slot-text');
      const statusEl = wrap.querySelector('.om-fx-r-status');
      if (!cards.length) return;
      const targetIdx = Math.max(0, MODES.findIndex(m => m.id === targetModeId));
      const totalSteps = 16 + targetIdx;
      this.rouletteState = {
        wrap, cards, slotText, statusEl, targetIdx, totalSteps,
        step: 0, locked: false, startedAt: Date.now()
      };
      const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } })();
      if (reduced) {
        this.lockRoulette();
        return;
      }
      const tick = () => {
        const st = this.rouletteState;
        if (!st || st.locked || !this.el || !wrap.isConnected || window.app?.isBattle || M.state !== 'matched') return;
        const curIdx = st.step % MODES.length;
        const curMode = MODES[curIdx];
        cards.forEach((c, idx) => {
          c.classList.toggle('is-active', idx === curIdx);
          c.classList.remove('is-locked');
        });
        if (slotText) {
          slotText.textContent = L(curMode);
          slotText.classList.remove('om-fx-r-flip');
          void slotText.offsetWidth;
          slotText.classList.add('om-fx-r-flip');
        }
        if (st.step >= st.totalSteps) {
          this.lockRoulette();
          return;
        }
        this.playTick(false);
        st.step++;
        const progress = st.step / st.totalSteps;
        const delay = Math.round(45 + Math.pow(progress, 2.0) * 125);
        this.spinTimer = setTimeout(tick, delay);
      };
      tick();
    },
    buildMiniBoard() {
      const board = document.createElement('div');
      board.id = 'om-fx-miniboard';
      board.className = 'om-fx-miniboard';
      board.setAttribute('aria-hidden', 'true');
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const cell = document.createElement('div');
          cell.className = 'om-fx-minicell';
          cell.id = `om-fx-cell-${r}-${c}`;
          cell.dataset.r = String(r);
          cell.dataset.c = String(c);
          board.appendChild(cell);
        }
      }
      return board;
    },
    resetMiniBoard() {
      if (!this.el) return;
      const cells = this.el.querySelectorAll('.om-fx-minicell');
      cells.forEach(cell => {
        cell.style.backgroundColor = '';
        cell.className = 'om-fx-minicell';
        cell.textContent = '';
      });
    },
    updateMiniBoard(p) {
      if (!this.el || !p) return;
      const board = this.el.querySelector('#om-fx-miniboard');
      if (!board) return;
      if (Array.isArray(p.cages) && p.cages.length) {
        board.classList.add('has-cages');
        const glyphs = (typeof SumdokuApp !== 'undefined' && SumdokuApp.CIPHER_GLYPHS) || ['◈', '◇', '◆', '❖', '✦', '✧', '⬢', '⬡', '∆'];
        const cipher = () => glyphs[Math.floor(Math.random() * glyphs.length)];
        p.cages.forEach((cage, idx) => {
          const color = MINI_PALETTE[idx % MINI_PALETTE.length];
          const isSingleAnchor = Array.isArray(cage.cells) && cage.cells.length === 1;
          (cage.cells || []).forEach(([r, c]) => {
            const el = board.querySelector(`#om-fx-cell-${r}-${c}`);
            if (el) {
              el.style.backgroundColor = isSingleAnchor ? '#fbbf24' : color;
              el.classList.add('caged');
              if (isSingleAnchor) {
                el.classList.add('anchor', 'cipher');
                el.textContent = cipher();
              } else {
                el.classList.remove('anchor');
                el.textContent = '';
              }
            }
          });
        });
        if (Array.isArray(p.solvedCells)) {
          p.solvedCells.forEach(([r, c]) => {
            const el = board.querySelector(`#om-fx-cell-${r}-${c}`);
            if (el && !el.classList.contains('anchor')) {
              el.classList.add('solved', 'cipher');
              el.textContent = cipher();
            }
          });
        }
      }
    },
    updateCountdown() {
      if (!this.el) return;
      if (this.rouletteState && !this.rouletteState.locked && (Date.now() - this.rouletteState.startedAt) >= 2600) {
        this.lockRoulette();
      }
      const cdEl = this.el.querySelector('.om-fx-countdown');
      if (!cdEl) return;
      const dur = Number.isFinite(M.countdownMs) ? M.countdownMs : 5000;
      const elapsed = Math.max(0, Date.now() - (M.matchedAt || Date.now()));
      const remSec = Math.max(1, Math.min(5, Math.ceil((dur - elapsed) / 1000)));
      if (this.lastCountVal !== remSec) {
        this.lastCountVal = remSec;
        cdEl.textContent = String(remSec);
        cdEl.dataset.count = String(remSec);
        cdEl.classList.remove('om-fx-cd-pop');
        void cdEl.offsetWidth;
        cdEl.classList.add('om-fx-cd-pop');
        this.playTick(false, 640 + (5 - remSec) * 60);
      }
    },
    show() {
      if (window.app?.isBattle || M.state !== 'matched') { this.hide(); return; }
      if (!this.el) {
        this.el = document.createElement('div');
        this.el.id = 'om-match-fx';
        this.el.className = 'om-match-fx';
        this.el.setAttribute('role', 'status');
        (document.getElementById('app') || document.body).append(this.el);
      }
      if (!this.el.classList.contains('on')) {
        this.el.classList.add('on');
        try { navigator.vibrate?.([40, 60, 80]); } catch (_) {}
      }
      const key = JSON.stringify([M.partner, M.partnerProfile, M.kind, M.queue, M.mode, M.diff, M.matchedAt, langIdx()]);
      if (this.key !== key) {
        this.key = key;
        this.lastCountVal = 0;
        this.rouletteState = null;
        const mo = MODES.find(x => x.id === M.mode) || MODES[0], di = DIFFS.find(x => x.id === M.diff) || DIFFS[0];
        const qBadge = M.kind === 'room' ? T('roomTitle') : T(M.queue === 'normal' ? 'queueNormal' : 'queueRanked');
        const t = document.createElement('div'); t.className = 'om-fx-title'; t.textContent = T('matchFound');
        const row = document.createElement('div'); row.className = 'om-fx-row';
        const x = document.createElement('div'); x.className = 'om-fx-vs'; x.textContent = 'VS';
        row.append(UI.playerCard(T('me'), myProfile(M.diff), 'om-fx-me'), x, UI.playerCard(T('opp'), M.partnerProfile || cleanProfile(null, M.partner), 'om-fx-opp'));
        const meta = document.createElement('div'); meta.className = 'om-fx-meta';

        const cdBox = document.createElement('div');
        cdBox.className = 'om-fx-cd-box';
        cdBox.innerHTML = `<div class="om-fx-cd-label">${T('countdownLabel')}</div><div class="om-fx-countdown" data-count="5">5</div>`;

        const miniBoard = this.buildMiniBoard();

        if (M.kind === 'random' && M.queue === 'ranked') {
          meta.textContent = `${qBadge} · ${L(di)}`;
          const roulette = document.createElement('div');
          roulette.className = 'om-fx-roulette';
          roulette.innerHTML = `
            <div class="om-fx-r-status">${T('rouletteSpinning')}</div>
            <div class="om-fx-r-slot"><span class="om-fx-r-slot-text">${L(MODES[0])}</span></div>
            <div class="om-fx-r-grid">
              ${MODES.map(m => `<div class="om-fx-r-card" data-mode="${m.id}">${L(m)}</div>`).join('')}
            </div>`;
          this.el.replaceChildren(t, row, meta, roulette, cdBox, miniBoard);
          this.spinRoulette(roulette, M.mode);
        } else {
          meta.textContent = `${qBadge} · ${L(mo)} · ${L(di)}`;
          this.el.replaceChildren(t, row, meta, cdBox, miniBoard);
        }
        if (M.lastGenProgress) this.updateMiniBoard(M.lastGenProgress);
      }
      this.updateCountdown();
      if (!this.watch) {
        this.watch = setInterval(() => {
          if (window.app?.isBattle || M.state !== 'matched') { this.hide(); return; }
          this.updateCountdown();
        }, 100);
      }
    },
    hide() {
      clearInterval(this.watch);
      this.watch = null;
      clearTimeout(this.spinTimer);
      this.spinTimer = null;
      this.rouletteState = null;
      this.lastCountVal = 0;
      if (this.el) { this.el.classList.remove('on'); this.key = ''; }
    }
  };
  const modeDesc = m => T({ race: 'descRace', score: 'descScore', survival: 'descSurvival', turn: 'descTurn' }[m] || 'descRace');

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

    // v2.0.4 · 같은 Wi-Fi 방(로컬 브로드캐스트)은 삭제했습니다. 온라인 방식이 같은 Wi-Fi에서도 똑같이 동작하므로
    // 배틀 로비는 항상 온라인 화면(랜덤 매칭 · 방 번호)만 엽니다.
    P.openBattleLobby = function () {
      this.isRematchActive = false;
      if (M.state !== 'idle' && !M.partnerPeer()) M.stop(false);
      else if (M.state === 'postgame') M.stop(false);
      M.rematch = null;
      SearchFx.hide();
      MatchFx.hide();
      try { this.cancelRoomPreparation?.(); } catch (_) {}
      this.dom.modalBattleLobby.classList.remove('hidden');
      this.dom.modalBattleLobby.querySelectorAll('.quick-settings').forEach(p => { p.open = false; });
      UI.show(false);
    };

    // 재대결 로비: 온라인 경기라면 Wi-Fi 방 UI 대신 자동으로 다시 준비합니다.
    const baseReturn = P.returnToBattleLobby;
    if (baseReturn) P.returnToBattleLobby = function () {
      if (M.state !== 'idle' && !M.partnerPeer()) M.stop(false);
      const r = baseReturn.apply(this, arguments);
      if (!(M.active && M.partner)) { clearInterval(this.hostPollTimer); this.dom.modalBattleLobby.classList.remove('hidden'); UI.show(false); }
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
              if (M.kind === 'room') { UI.render(); return; }
              const autoReady = M.kind === 'random' && (Date.now() - (M.matchedAt || 0)) >= 450;
              if (((st.guestJoined && st.p2Ready) || autoReady) && !M.hostStarted && !this.battleStarting) {
                M.hostStarted = true;
                this.guestJoined = true;
                this.hostP2Ready = true;
                clearInterval(M.hostPoll);
                this.startBattleAsHost();
              }
            } catch (_) {}
          }, 160);
        }
      }
      return r;
    };

    // v2.0.5 · 재대결은 상대가 수락해야 성사됩니다.
    const baseRematch = P.requestBattleRematch;
    P.requestBattleRematch = function () {
      if (M.active || M.state !== 'idle' || M.rematch) { M.requestRematch(); return; }
      return baseRematch.apply(this, arguments);
    };
    // 기존 '상대가 재도전 신청 → 자동 복귀' 폴링을 끕니다(수락 절차로 대체).
    const baseEnd = P.handleBattleEnd;
    P.handleBattleEnd = function () {
      if (M.active || M.state !== 'idle') {
        M.state = 'postgame';
        M.roomLaunching = false;
        SearchFx.hide();
        MatchFx.hide();
      }
      const r = baseEnd.apply(this, arguments);
      if (M.active || M.state !== 'idle') {
        clearInterval(this.rematchCheckTimer); setTimeout(() => clearInterval(this.rematchCheckTimer), 0);
        if (!M.partnerPeer()) M.rematch = { left: true };
        // v2.1.2: 온라인 랜덤 매칭 중에서도 '경쟁전(ranked)'일 때만 랭크전 점수를 반영합니다. 일반전(normal)과 방 번호 배틀은 점수가 변동되지 않습니다.
        if (M.active && M.kind === 'random' && M.queue === 'ranked' && window.SumdokuRating?.recordBattleEnd) {
          const isVictory = this.isWin || this.battleResult === 'win';
          const reason = this.resultReason || '';
          const oppRp = M.partnerProfile?.tier?.rp || 1000;
          const ch = window.SumdokuRating.recordBattleEnd(this, isVictory, reason, oppRp);
          if (ch && !ch._shown) {
            ch._shown = true;
            window.SumdokuRating?.runBattleResult?.(this, ch);
          }
        } else {
          this.lastBattleRatingChange = null;
        }
        try {
          window.SumdokuSeason?.applyCosmetics?.();
          const isVictory = this.isWin || this.battleResult === 'win';
          if (isVictory) {
            window.SumdokuSeason?.applyVictoryBannerSkin?.(this, { status: 'win' }, document.getElementById('battle-result-banner'));
          }
        } catch (_) {}
        UI.renderRematch();
      }
      return r;
    };

    // 온라인 경기 HUD: '상대 (Host/Guest)' 대신 상대 국기와 닉네임을 표시합니다.
    const baseStartMatch = P.startBattleMatch;
    if (baseStartMatch) P.startBattleMatch = function () {
      M.rematch = null;
      if (M.active) {
        M.state = 'playing';
        M.roomLaunching = false;
      }
      SearchFx.hide();
      MatchFx.hide();
      // 방 번호 참가자는 방장에게 받은 방 설정의 모드로 시작합니다(서버 설정 반영이 늦어도 어긋나지 않게).
      if (M.active && M.kind === 'room' && arguments[0] === 2) arguments[2] = M.roomCfg.mode;
      const r = baseStartMatch.apply(this, arguments);
      try { UI.render(); } catch (_) {}
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

    // v2.0.8: 방장은 퍼즐을 참가자에게 직접 보내고, 전달 시간(RTT/2)만큼 기다렸다가 판을 엽니다(가장 바깥 래퍼).
    const baseStartSync = P.startBattleMatch;
    if (baseStartSync) P.startBattleMatch = function (role, puzzle, mode) {
      const peer = M.active && role === 1 && M.partnerPeer && M.partnerPeer();
      if (!peer || !puzzle || this.isBattle) return baseStartSync.apply(this, arguments);
      M.sendTo(peer, { t: 'go', puzzle, mode });
      const wait = Math.max(0, Math.min(400, Math.round((M.rtt || 120) / 2)));
      const args = arguments;
      setTimeout(() => { if (!this.isBattle) baseStartSync.apply(this, args); }, wait);
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
  M.searchFx = SearchFx;
  M.matchFx = MatchFx;
  window.OnlineMatch = M;
})();
