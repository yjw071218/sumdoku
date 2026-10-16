/* v1.1.30 · 추가 번역 (localize-ui.js 보다 먼저 로드되어야 {0} 템플릿이 인식됩니다)
 * 순서: en, ja, zh, zh-TW, es, fr, de
 */
(() => {
  const T = window.UI_TRANSLATIONS = window.UI_TRANSLATIONS || {};
  const langs = ['en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  const rows = {
    // ---- 배경 음악 설정 (초기 렌더 시 한국어로 남던 문구)
    '배경 음악': ['Background music', 'BGM', '背景音乐', '背景音樂', 'Música de fondo', 'Musique de fond', 'Hintergrundmusik'],
    '음악 음량': ['Music volume', 'BGM音量', '音乐音量', '音樂音量', 'Volumen de música', 'Volume de la musique', 'Musiklautstärke'],

    // ---- 배틀: 방 생성 후 방장 설정 변경
    '⚙️ 방 설정 변경 (모드 · 난이도 · 규칙)': ['⚙️ Room settings (mode · difficulty · rules)', '⚙️ ルーム設定（モード・難易度・ルール）', '⚙️ 房间设置（模式 · 难度 · 规则）', '⚙️ 房間設定（模式 · 難度 · 規則）', '⚙️ Ajustes de sala (modo · dificultad · reglas)', '⚙️ Réglages du salon (mode · difficulté · règles)', '⚙️ Raumeinstellungen (Modus · Schwierigkeit · Regeln)'],
    '▲ 방 설정 접기': ['▲ Hide room settings', '▲ ルーム設定を閉じる', '▲ 收起房间设置', '▲ 收起房間設定', '▲ Ocultar ajustes', '▲ Masquer les réglages', '▲ Einstellungen ausblenden'],
    '방을 만든 뒤에도 방장은 규칙을 바꿀 수 있습니다. 변경하면 참가자는 다시 준비해야 합니다. 기본 힌트는 최대 300점 감점됩니다.': ['The host can change rules even after creating the room. The guest must ready up again after a change. Basic hints cost up to 300 points.', 'ルーム作成後もホストはルールを変更できます。変更すると参加者は再度準備が必要です。基本ヒントは最大300点減点です。', '创建房间后房主仍可修改规则。修改后参与者需重新准备。基础提示最多扣300分。', '建立房間後房主仍可修改規則。修改後參加者需重新準備。基礎提示最多扣300分。', 'El anfitrión puede cambiar las reglas tras crear la sala. El invitado debe volver a estar listo. Las pistas básicas restan hasta 300 puntos.', 'L’hôte peut modifier les règles après la création du salon. L’invité doit se remettre prêt. Les indices de base coûtent jusqu’à 300 points.', 'Der Host kann die Regeln auch nach dem Erstellen ändern. Der Gast muss danach erneut bereit sein. Basis-Hinweise kosten bis zu 300 Punkte.'],
    '방 설정을 변경했습니다. 참가자가 다시 준비해야 합니다.': ['Room settings changed. The guest needs to ready up again.', 'ルーム設定を変更しました。参加者は再度準備が必要です。', '房间设置已更改，参与者需重新准备。', '房間設定已變更，參加者需重新準備。', 'Ajustes cambiados. El invitado debe volver a estar listo.', 'Réglages modifiés. L’invité doit se remettre prêt.', 'Einstellungen geändert. Der Gast muss erneut bereit sein.'],
    '방 설정을 변경했습니다.': ['Room settings changed.', 'ルーム設定を変更しました。', '房间设置已更改。', '房間設定已變更。', 'Ajustes de sala cambiados.', 'Réglages du salon modifiés.', 'Raumeinstellungen geändert.'],
    '지금은 방 설정을 바꿀 수 없습니다.': ['Room settings can’t be changed right now.', '現在ルーム設定を変更できません。', '当前无法更改房间设置。', '目前無法變更房間設定。', 'No se pueden cambiar los ajustes ahora.', 'Impossible de modifier les réglages pour le moment.', 'Einstellungen können gerade nicht geändert werden.'],
    '방장이 방 설정을 변경했습니다 · {0} · {1}': ['The host changed the room · {0} · {1}', 'ホストがルーム設定を変更しました · {0} · {1}', '房主更改了房间设置 · {0} · {1}', '房主變更了房間設定 · {0} · {1}', 'El anfitrión cambió la sala · {0} · {1}', 'L’hôte a modifié le salon · {0} · {1}', 'Der Host hat den Raum geändert · {0} · {1}'],
    '⚡ 스피드 레이스': ['⚡ Speed Race', '⚡ スピードレース', '⚡ 竞速赛', '⚡ 競速賽', '⚡ Carrera rápida', '⚡ Course de vitesse', '⚡ Wettrennen'],
    '⏱️ 타임어택 점수전': ['⏱️ Time Attack Score', '⏱️ タイムアタック得点戦', '⏱️ 计时积分赛', '⏱️ 計時積分賽', '⏱️ Contrarreloj por puntos', '⏱️ Contre-la-montre aux points', '⏱️ Zeitangriff nach Punkten'],
    '🛡️ 서바이벌': ['🛡️ Survival', '🛡️ サバイバル', '🛡️ 生存赛', '🛡️ 生存賽', '🛡️ Supervivencia', '🛡️ Survie', '🛡️ Überleben'],
    '♟️ 턴제 대결': ['♟️ Turn Battle', '♟️ ターン制対決', '♟️ 回合对决', '♟️ 回合對決', '♟️ Duelo por turnos', '♟️ Duel au tour par tour', '♟️ Rundenduell'],

    // ---- Google Play 게임즈 클라우드 저장 (기존엔 한국어/영어만 있었음)
    'Google Play 게임즈 · 저장 데이터': ['Google Play Games · Saved data', 'Google Play ゲーム · セーブデータ', 'Google Play 游戏 · 存档', 'Google Play 遊戲 · 存檔', 'Google Play Juegos · Datos guardados', 'Google Play Jeux · Données', 'Google Play Spiele · Spielstände'],
    '같은 Google Play 게임즈 계정으로 다른 기기에서 불러올 수 있습니다. 저장 버튼으로 새 저장본을 만듭니다.': ['Use the same Google Play Games account on another device. Save creates a new backup.', '同じGoogle Play ゲームアカウントなら別の端末で読み込めます。保存すると新しいバックアップを作成します。', '使用同一 Google Play 游戏账号即可在其他设备读取。保存会创建新的存档。', '使用同一 Google Play 遊戲帳號即可在其他裝置讀取。儲存會建立新的存檔。', 'Usa la misma cuenta de Google Play Juegos en otro dispositivo. Guardar crea una copia nueva.', 'Utilisez le même compte Google Play Jeux sur un autre appareil. Enregistrer crée une nouvelle sauvegarde.', 'Nutze dasselbe Google Play Spiele-Konto auf einem anderen Gerät. Speichern erstellt ein neues Backup.'],
    '로그인': ['Sign in', 'ログイン', '登录', '登入', 'Iniciar sesión', 'Se connecter', 'Anmelden'],
    '지금 저장': ['Save now', '今すぐ保存', '立即保存', '立即儲存', 'Guardar ahora', 'Enregistrer', 'Jetzt speichern'],
    '불러오기': ['Load', '読み込む', '读取', '讀取', 'Cargar', 'Charger', 'Laden'],
    '게임 데이터 불러오기': ['Load game data', 'ゲームデータを読み込む', '读取游戏数据', '讀取遊戲資料', 'Cargar datos', 'Charger les données', 'Spieldaten laden'],
    '현재 기록을 선택한 저장본으로 교체합니다. 기존 기록은 기기에 백업합니다.': ['Replace local progress with this save? A local backup will be kept.', '現在の記録を選択したセーブで置き換えます。既存の記録は端末にバックアップされます。', '将用所选存档替换当前记录，原记录会备份到设备。', '將以所選存檔取代目前紀錄，原紀錄會備份到裝置。', 'Se reemplazará el progreso por este guardado. Se conserva una copia local.', 'La progression sera remplacée par cette sauvegarde. Une copie locale est conservée.', 'Lokaler Fortschritt wird ersetzt. Eine lokale Sicherung bleibt erhalten.'],
    'Google Play 게임즈에 로그인했습니다.': ['Signed in to Google Play Games.', 'Google Play ゲームにログインしました。', '已登录 Google Play 游戏。', '已登入 Google Play 遊戲。', 'Sesión iniciada en Google Play Juegos.', 'Connecté à Google Play Jeux.', 'Bei Google Play Spiele angemeldet.'],
    '저장했습니다. 인터넷 연결 후 다른 기기에서 불러올 수 있습니다.': ['Saved. Connect to the internet to sync to other devices.', '保存しました。インターネット接続後、別の端末で読み込めます。', '已保存。联网后可在其他设备读取。', '已儲存。連網後可在其他裝置讀取。', 'Guardado. Conéctate a internet para sincronizar.', 'Enregistré. Connectez-vous à Internet pour synchroniser.', 'Gespeichert. Mit dem Internet verbinden zum Synchronisieren.'],
    'Google Play 게임즈 연결 설정이 아직 완료되지 않았습니다.': ['Google Play Games is not configured yet.', 'Google Play ゲームの設定がまだ完了していません。', 'Google Play 游戏尚未配置完成。', 'Google Play 遊戲尚未設定完成。', 'Google Play Juegos aún no está configurado.', 'Google Play Jeux n’est pas encore configuré.', 'Google Play Spiele ist noch nicht eingerichtet.'],
    '연결하지 못했습니다. 계정과 인터넷 연결을 확인해 주세요.': ['Unable to connect. Check your account and internet connection.', '接続できませんでした。アカウントと接続を確認してください。', '无法连接，请检查账号和网络。', '無法連線，請檢查帳號與網路。', 'No se pudo conectar. Revisa tu cuenta y conexión.', 'Connexion impossible. Vérifiez votre compte et la connexion.', 'Verbindung fehlgeschlagen. Konto und Internet prüfen.'],
    '연결하지 못했습니다 (코드 {0}). 계정과 인터넷 연결을 확인해 주세요.': ['Unable to connect (code {0}). Check your account and connection.', '接続できませんでした（コード {0}）。アカウントと接続を確認してください。', '无法连接（代码 {0}），请检查账号和网络。', '無法連線（代碼 {0}），請檢查帳號與網路。', 'No se pudo conectar (código {0}). Revisa tu cuenta y conexión.', 'Connexion impossible (code {0}). Vérifiez compte et connexion.', 'Verbindung fehlgeschlagen (Code {0}). Konto und Verbindung prüfen.'],
    'Play 게임즈 설정 오류(코드 10): Play Console의 OAuth 클라이언트 SHA-1이 앱 서명 키와 다르거나 테스터로 등록되지 않았습니다.': ['Play Games config error (code 10): OAuth client SHA-1 does not match the app signing key, or this account is not a tester.', 'Playゲーム設定エラー（コード10）：OAuthクライアントのSHA-1がアプリ署名鍵と異なるか、テスター未登録です。', 'Play 游戏配置错误（代码10）：OAuth 客户端 SHA-1 与应用签名密钥不符，或账号未登记为测试者。', 'Play 遊戲設定錯誤（代碼10）：OAuth 用戶端 SHA-1 與應用程式簽署金鑰不符，或帳號未登記為測試人員。', 'Error de Play Juegos (código 10): el SHA-1 del cliente OAuth no coincide con la clave de firma o la cuenta no es tester.', 'Erreur Play Jeux (code 10) : le SHA-1 du client OAuth ne correspond pas à la clé de signature ou le compte n’est pas testeur.', 'Play Spiele-Fehler (Code 10): OAuth-SHA-1 passt nicht zum App-Signaturschlüssel oder Konto ist kein Tester.'],
    '로그인이 필요합니다(코드 4). Play 게임즈 앱에 로그인했는지 확인해 주세요.': ['Sign-in required (code 4). Make sure you are signed in to Play Games.', 'ログインが必要です（コード4）。Playゲームにログインしているか確認してください。', '需要登录（代码4），请确认已登录 Play 游戏。', '需要登入（代碼4），請確認已登入 Play 遊戲。', 'Inicio de sesión requerido (código 4). Inicia sesión en Play Juegos.', 'Connexion requise (code 4). Connectez-vous à Play Jeux.', 'Anmeldung nötig (Code 4). Bei Play Spiele anmelden.'],
    '네트워크 오류(코드 7). 인터넷 연결을 확인해 주세요.': ['Network error (code 7). Check your connection.', 'ネットワークエラー（コード7）。接続を確認してください。', '网络错误（代码7），请检查网络。', '網路錯誤（代碼7），請檢查網路。', 'Error de red (código 7). Revisa la conexión.', 'Erreur réseau (code 7). Vérifiez la connexion.', 'Netzwerkfehler (Code 7). Verbindung prüfen.'],
    '로그인을 취소했습니다.': ['Sign-in canceled.', 'ログインをキャンセルしました。', '已取消登录。', '已取消登入。', 'Inicio de sesión cancelado.', 'Connexion annulée.', 'Anmeldung abgebrochen.'],
    '게임을 나간 뒤 이용해 주세요.': ['Return to the home screen first.', 'ゲームを終了してから利用してください。', '请先退出游戏再使用。', '請先離開遊戲再使用。', 'Vuelve primero a la pantalla de inicio.', 'Revenez d’abord à l’accueil.', 'Bitte zuerst zum Startbildschirm.'],
    '저장 공간이 부족해 복원하지 못했습니다.': ['Not enough storage to restore.', '保存容量が不足して復元できませんでした。', '存储空间不足，无法恢复。', '儲存空間不足，無法還原。', 'Espacio insuficiente para restaurar.', 'Espace insuffisant pour restaurer.', 'Nicht genug Speicher zum Wiederherstellen.'],
    '호환되지 않거나 손상된 저장본입니다.': ['This save is incompatible or damaged.', '互換性がないか破損したセーブです。', '存档不兼容或已损坏。', '存檔不相容或已損毀。', 'Guardado incompatible o dañado.', 'Sauvegarde incompatible ou endommagée.', 'Spielstand inkompatibel oder beschädigt.'],
    '저장 용량을 초과했습니다. 리플레이를 정리해 주세요.': ['Save too large. Remove older replays.', '保存容量を超えました。リプレイを整理してください。', '存档过大，请清理回放。', '存檔過大，請清理重播。', 'Guardado demasiado grande. Elimina repeticiones.', 'Sauvegarde trop volumineuse. Supprimez des replays.', 'Spielstand zu groß. Alte Replays löschen.'],


    // ---- 기존 번역 파일(translations-extra.js)에서 앞뒤 문장이 섞여 손상된 항목 교정
    '칸 수': ['Cells', 'マス数', '格数', '格數', 'Casillas', 'Cases', 'Zellen'],
    '칸에 표시되는 후보수 메모 숫자의 크기를 조절합니다': ['Adjusts the size of candidate note digits shown in cells', 'マスに表示される候補メモ数字の大きさを調整します', '调整格子中候选笔记数字的大小', '調整格子中候選筆記數字的大小', 'Ajusta el tamaño de los números de notas en las casillas', 'Ajuste la taille des chiffres de notes dans les cases', 'Passt die Größe der Notizziffern in den Zellen an'],
    '{0} 업적 달성 · {1}': ['{0} Achievement unlocked · {1}', '{0} 実績達成 · {1}', '{0} 达成成就 · {1}', '{0} 達成成就 · {1}', '{0} Logro desbloqueado · {1}', '{0} Succès débloqué · {1}', '{0} Erfolg freigeschaltet · {1}'],
    '같은 Wi-Fi에서 친구와 1:1 대전': ['1:1 battle with a friend on the same Wi-Fi', '同じWi-Fiで友達と1対1対戦', '与同一 Wi-Fi 的好友 1:1 对战', '與同一 Wi-Fi 的好友 1:1 對戰', 'Duelo 1:1 con un amigo en la misma Wi-Fi', 'Duel 1:1 avec un ami sur le même Wi-Fi', '1:1-Duell mit Freunden im selben WLAN'],
    '누적 5회 완성': ['Completed 5 times in total', '累計5回クリア', '累计完成5次', '累計完成5次', '5 veces completado en total', '5 grilles terminées au total', 'Insgesamt 5-mal gelöst'],
    '이미 맞춘 숫자는 지울 수 없습니다.': ['Correct numbers can’t be erased.', '正解した数字は消せません。', '已填对的数字无法擦除。', '已填對的數字無法擦除。', 'Los números correctos no se pueden borrar.', 'Les chiffres corrects ne peuvent pas être effacés.', 'Richtige Zahlen können nicht gelöscht werden.'],
    '타임어택 제한 시간이 모두 소진되었습니다. 다음엔 더 빠르게 풀어보세요!': ['Time Attack time is up. Try to solve it faster next time!', 'タイムアタックの制限時間が終了しました。次はもっと速く解いてみよう！', '计时赛时间已用完，下次试着更快解开吧！', '計時賽時間已用完，下次試著更快解開吧！', 'Se acabó el tiempo de contrarreloj. ¡La próxima vez, más rápido!', 'Le temps du contre-la-montre est écoulé. Plus vite la prochaine fois !', 'Die Zeit im Zeitangriff ist abgelaufen. Nächstes Mal schneller!'],
    '탭하여 바로 최신 버전으로 업데이트하세요': ['Tap to update to the latest version', 'タップして最新版にアップデート', '点按即可更新到最新版本', '點按即可更新到最新版本', 'Toca para actualizar a la última versión', 'Touchez pour passer à la dernière version', 'Tippen, um auf die neueste Version zu aktualisieren'],
    // ---- 힌트 확인 (광고 힌트는 50점)
    '추가 힌트': ['Extra hint', '追加ヒント', '额外提示', '額外提示', 'Pista extra', 'Indice bonus', 'Extra-Hinweis']
  };
  for (const [ko, list] of Object.entries(rows)) langs.forEach((l, i) => { (T[l] = T[l] || {})[ko] = list[i]; });
})();
