// v1.0.50 서바이벌 압박 타이머 · 턴제 · 자동 메모 규칙 번역 (en, ja, zh, zh-TW, es, fr, de)
(() => {
  const T = window.UI_TRANSLATIONS = window.UI_TRANSLATIONS || {};
  const rows = {
    '배틀을 하려면 Wi-Fi를 켜고 같은 Wi-Fi에 연결해 주세요.': ['To battle, turn on Wi-Fi and connect to the same Wi-Fi network.','対戦するにはWi-Fiをオンにして、同じWi-Fiに接続してください。','要对战，请开启Wi-Fi并连接到同一个Wi-Fi网络。','若要對戰，請開啟Wi-Fi並連線到同一個Wi-Fi網路。','Para jugar, activa el Wi-Fi y conecta ambos dispositivos a la misma red.','Pour jouer, activez le Wi-Fi et connectez les appareils au même réseau.','Aktiviere für ein Duell WLAN und verbinde beide Geräte mit demselben WLAN.'],
    '90초로 시작하며 새 정답마다 90초가 상한 없이 쌓입니다. 90초마다 바의 배수와 색상이 바뀝니다. 시간 소진 시 목숨 -1, 상대 정답 시 시간 감소. 먼저 완성하거나 끝까지 살아남으면 승리': [
      'Start with 90 seconds. Each newly solved cell adds 90 seconds with no cap. Every 90 seconds changes the bar multiplier and color. Lose a life when time runs out; opponent answers reduce your time. Finish first or outlast them to win.',
      '90秒で開始し、新しく正解したマスごとに90秒が上限なく加算されます。90秒ごとにバーの倍率と色が変わります。時間切れでライフ−1、相手の正解で残り時間が減少。先に完成するか最後まで生き残れば勝利。',
      '从90秒开始，每新答对一格增加90秒，无上限。每90秒改变进度条倍数和颜色。时间耗尽失去一条命，对手答对会减少你的时间。先完成或坚持到最后获胜。',
      '從90秒開始，每新答對一格增加90秒，無上限。每90秒改變進度條倍數和顏色。時間耗盡失去一條命，對手答對會減少你的時間。先完成或堅持到最後獲勝。',
      'Empiezas con 90 segundos. Cada nueva casilla correcta añade 90 segundos sin límite. El multiplicador y el color cambian cada 90 segundos. Pierdes una vida al agotarse el tiempo; los aciertos del rival lo reducen. Termina primero o sobrevive para ganar.',
      'Départ à 90 secondes. Chaque nouvelle case juste ajoute 90 secondes sans plafond. Le multiplicateur et la couleur changent tous les 90 secondes. Une vie perdue à zéro ; les réponses adverses réduisent votre temps. Finissez en premier ou survivez pour gagner.',
      'Start mit 90 Sekunden. Jedes neu gelöste Feld bringt 90 Sekunden ohne Obergrenze. Multiplikator und Farbe wechseln alle 90 Sekunden. Bei Zeitablauf verlierst du ein Leben; richtige Antworten des Gegners verkürzen deine Zeit. Zuerst fertig werden oder überleben gewinnt.'],
    '자동 메모 기능': ['Auto notes','自動メモ','自动笔记','自動筆記','Notas automáticas','Notes automatiques','Auto-Notizen'],
    '자동 메모': ['Auto notes','自動メモ','自动笔记','自動筆記','Notas automáticas','Notes automatiques','Auto-Notizen'],
    '허용': ['Allowed','許可','允许','允許','Permitido','Autorisé','Erlaubt'],
    '금지': ['Disabled','禁止','禁止','禁止','Prohibido','Interdit','Verboten'],
    '턴제 · 한 턴 제한 시간': ['Turn mode · time per turn','ターン制 · 1ターンの制限時間','回合制 · 每回合限时','回合制 · 每回合限時','Por turnos · tiempo por turno','Tour par tour · temps par tour','Rundenmodus · Zeit pro Zug'],
    '{0}초': ['{0}s','{0}秒','{0}秒','{0}秒','{0} s','{0} s','{0} s'],
    '🛡️ 서바이벌 (압박 타이머)': ['🛡️ Survival (pressure timer)','🛡️ サバイバル（プレッシャータイマー）','🛡️ 生存（压力计时）','🛡️ 生存（壓力計時）','🛡️ Supervivencia (reloj de presión)','🛡️ Survie (chrono de pression)','🛡️ Überleben (Druck-Timer)'],
    '서바이벌 (압박 타이머)': ['Survival (pressure timer)','サバイバル（プレッシャータイマー）','生存（压力计时）','生存（壓力計時）','Supervivencia (reloj de presión)','Survie (chrono de pression)','Überleben (Druck-Timer)'],
    '제한 시간 안에 정답을 넣지 못하면 목숨이 깎이고, 상대가 맞힐 때마다 내 시간이 줄어듭니다. 먼저 완성하거나 끝까지 살아남으면 승리': [
      'Miss the timer without a correct entry and you lose a life; every correct cell by your opponent shortens your time. Finish first or outlast them to win.',
      '制限時間内に正解を入れないとライフが減り、相手が正解するたびに自分の時間が減ります。先に完成させるか最後まで生き残れば勝利。',
      '限时内未填入正确数字会失去一条命，对手每答对一格你的时间就会减少。先完成或坚持到最后即获胜。',
      '限時內未填入正確數字會失去一條命，對手每答對一格你的時間就會減少。先完成或堅持到最後即獲勝。',
      'Si no aciertas antes de que acabe el tiempo pierdes una vida; cada acierto del rival reduce tu tiempo. Termina primero o sobrevive para ganar.',
      'Sans bonne réponse avant la fin du chrono, vous perdez une vie ; chaque case juste de l’adversaire réduit votre temps. Finissez en premier ou tenez jusqu’au bout.',
      'Ohne richtige Eingabe vor Ablauf des Timers verlierst du ein Leben; jeder Treffer des Gegners verkürzt deine Zeit. Zuerst fertig werden oder überleben gewinnt.'],
    '♟️ 턴제 대결': ['♟️ Turn battle','♟️ ターン制対戦','♟️ 回合制对战','♟️ 回合制對戰','♟️ Duelo por turnos','♟️ Duel au tour par tour','♟️ Rundenduell'],
    '턴제 대결': ['Turn battle','ターン制対戦','回合制对战','回合制對戰','Duelo por turnos','Duel au tour par tour','Rundenduell'],
    '한 판을 함께 채우며 번갈아 한 칸씩 둡니다. 턴마다 제한 시간이 있고, 상대 턴에도 메모는 할 수 있습니다. 판이 완성되면 점수가 높은 쪽 승리': [
      'Share one board and take turns placing one cell. Each turn is timed, and you can take notes during your opponent’s turn. Highest score when the board is full wins.',
      '1つの盤面を交互に1マスずつ埋めます。各ターンに制限時間があり、相手のターン中もメモできます。盤面が完成したら得点の高い方が勝利。',
      '共用一个棋盘，轮流各填一格。每回合有时间限制，对手回合也可以做笔记。棋盘填满时分数高者获胜。',
      '共用一個盤面，輪流各填一格。每回合有時間限制，對手回合也可以做筆記。盤面填滿時分數高者獲勝。',
      'Compartís un tablero y colocáis una casilla por turno. Cada turno tiene tiempo límite y puedes tomar notas en el turno rival. Gana la mayor puntuación al completar el tablero.',
      'Une seule grille, une case chacun à tour de rôle. Chaque tour est chronométré et vous pouvez annoter pendant le tour adverse. Le meilleur score gagne quand la grille est pleine.',
      'Ein gemeinsames Brett, abwechselnd je ein Feld. Jeder Zug ist zeitlich begrenzt, Notizen gehen auch im gegnerischen Zug. Bei vollem Brett gewinnt die höhere Punktzahl.'],
    '🛡️ 생존 시간': ['🛡️ Survival time','🛡️ 生存時間','🛡️ 生存时间','🛡️ 生存時間','🛡️ Tiempo de vida','🛡️ Temps de survie','🛡️ Überlebenszeit'],
    '♟️ 내 턴': ['♟️ Your turn','♟️ 自分のターン','♟️ 我的回合','♟️ 我的回合','♟️ Tu turno','♟️ Votre tour','♟️ Dein Zug'],
    '⏳ 상대 턴 · 메모 가능': ['⏳ Opponent’s turn · notes allowed','⏳ 相手のターン · メモ可','⏳ 对手回合 · 可做笔记','⏳ 對手回合 · 可做筆記','⏳ Turno rival · notas permitidas','⏳ Tour adverse · notes possibles','⏳ Gegnerzug · Notizen erlaubt'],
    '♟️ 턴제 대결 · 내가 먼저 둡니다': ['♟️ Turn battle · you go first','♟️ ターン制 · 先手です','♟️ 回合制 · 你先手','♟️ 回合制 · 你先手','♟️ Por turnos · empiezas tú','♟️ Tour par tour · vous commencez','♟️ Rundenduell · du beginnst'],
    '♟️ 턴제 대결 · 상대가 먼저 둡니다 · 그동안 메모해 두세요': ['♟️ Turn battle · opponent goes first · take notes meanwhile','♟️ ターン制 · 相手が先手 · その間にメモしましょう','♟️ 回合制 · 对手先手 · 先做笔记吧','♟️ 回合制 · 對手先手 · 先做筆記吧','♟️ Por turnos · empieza el rival · toma notas mientras','♟️ Tour par tour · l’adversaire commence · annotez en attendant','♟️ Rundenduell · Gegner beginnt · mach dir Notizen'],
    '상대 턴입니다 · 메모(연필)는 자유롭게 할 수 있어요': ['Opponent’s turn · pencil notes are still allowed','相手のターンです · メモ（鉛筆）は自由にできます','对手回合 · 仍可使用铅笔笔记','對手回合 · 仍可使用鉛筆筆記','Turno del rival · puedes usar notas a lápiz','Tour adverse · les notes au crayon restent possibles','Gegnerzug · Bleistiftnotizen sind erlaubt'],
    '상대가 시간을 넘겨 내 턴입니다!': ['Opponent ran out of time · your turn!','相手が時間切れ · あなたのターン！','对手超时 · 轮到你了！','對手超時 · 輪到你了！','El rival agotó su tiempo · ¡tu turno!','Temps écoulé pour l’adversaire · à vous !','Gegner hat die Zeit überschritten · du bist dran!'],
    '상대가 오답을 두었습니다 · 내 턴!': ['Opponent played a wrong number · your turn!','相手が誤答 · あなたのターン！','对手填错了 · 轮到你了！','對手填錯了 · 輪到你了！','El rival falló · ¡tu turno!','L’adversaire s’est trompé · à vous !','Gegner lag falsch · du bist dran!'],
    '턴제 대결에서는 힌트를 쓸 수 없습니다': ['Hints are disabled in turn battles','ターン制ではヒントを使えません','回合制对战中无法使用提示','回合制對戰中無法使用提示','Las pistas no están disponibles por turnos','Indices désactivés en tour par tour','Hinweise sind im Rundenduell gesperrt'],
    '턴제 대결에서는 실행 취소를 쓸 수 없습니다': ['Undo is disabled in turn battles','ターン制では元に戻せません','回合制对战中无法撤消','回合制對戰中無法復原','No se puede deshacer por turnos','Annulation désactivée en tour par tour','Rückgängig ist im Rundenduell gesperrt'],
    '🔒 이번 게임은 자동 메모가 금지되어 있습니다': ['🔒 Auto notes are disabled for this game','🔒 このゲームでは自動メモが禁止されています','🔒 本局禁止自动笔记','🔒 本局禁止自動筆記','🔒 Notas automáticas desactivadas en esta partida','🔒 Notes automatiques interdites pour cette partie','🔒 Auto-Notizen sind in diesem Spiel gesperrt'],
    '이번 게임은 자동 메모가 금지되어 있습니다': ['Auto notes are disabled for this game','このゲームでは自動メモが禁止されています','本局禁止自动笔记','本局禁止自動筆記','Notas automáticas desactivadas en esta partida','Notes automatiques interdites pour cette partie','Auto-Notizen sind in diesem Spiel gesperrt'],
    '⏰ 압박 시간 초과! 목숨 -1 (-50점)': ['⏰ Pressure timer expired! Life -1 (-50 pts)','⏰ 時間切れ！ライフ -1（-50点）','⏰ 压力计时结束！生命 -1（-50分）','⏰ 壓力計時結束！生命 -1（-50分）','⏰ ¡Tiempo agotado! Vida -1 (-50 pts)','⏰ Chrono écoulé ! Vie -1 (-50 pts)','⏰ Zeit abgelaufen! Leben -1 (-50 Pkt.)'],
    '⏰ 시간 초과! 턴이 넘어갑니다 (-{0}점)': ['⏰ Time’s up! Turn passes (-{0} pts)','⏰ 時間切れ！ターン交代（-{0}点）','⏰ 超时！回合转移（-{0}分）','⏰ 超時！回合轉移（-{0}分）','⏰ ¡Tiempo! Pasa el turno (-{0} pts)','⏰ Temps écoulé ! Tour suivant (-{0} pts)','⏰ Zeit um! Zug geht weiter (-{0} Pkt.)'],
    '목숨 {0}개를 모두 잃어 탈락했습니다!': ['You lost all {0} lives and are eliminated!','ライフ{0}個をすべて失い脱落しました！','{0}条命全部用完，被淘汰了！','{0}條命全部用完，被淘汰了！','¡Perdiste tus {0} vidas y quedas eliminado!','Vous avez perdu vos {0} vies : éliminé !','Alle {0} Leben verloren – ausgeschieden!'],
    '상대방이 목숨을 모두 잃어 탈락했습니다! 당신의 승리! 🏆': ['Your opponent lost all lives! You win! 🏆','相手がライフをすべて失い脱落！あなたの勝利！🏆','对手生命耗尽被淘汰！你赢了！🏆','對手生命耗盡被淘汰！你贏了！🏆','¡El rival perdió todas sus vidas! ¡Ganas! 🏆','L’adversaire a perdu toutes ses vies ! Victoire ! 🏆','Gegner hat alle Leben verloren! Du gewinnst! 🏆'],
    '판 완성! 점수 대결 승리 ({0} vs {1}) 🏆': ['Board complete! You win on points ({0} vs {1}) 🏆','盤面完成！得点で勝利（{0} vs {1}）🏆','棋盘完成！分数获胜（{0} vs {1}）🏆','盤面完成！分數獲勝（{0} vs {1}）🏆','¡Tablero completo! Ganas por puntos ({0} vs {1}) 🏆','Grille complète ! Victoire aux points ({0} vs {1}) 🏆','Brett voll! Punktsieg ({0} vs {1}) 🏆'],
    '판 완성! 점수 대결 패배 ({0} vs {1})': ['Board complete! You lose on points ({0} vs {1})','盤面完成！得点で敗北（{0} vs {1}）','棋盘完成！分数落败（{0} vs {1}）','盤面完成！分數落敗（{0} vs {1}）','¡Tablero completo! Pierdes por puntos ({0} vs {1})','Grille complète ! Défaite aux points ({0} vs {1})','Brett voll! Punktniederlage ({0} vs {1})'],
    '판 완성! 무승부입니다 ({0}점 동점)': ['Board complete! Draw ({0} pts each)','盤面完成！引き分け（{0}点で同点）','棋盘完成！平局（同为{0}分）','盤面完成！平手（同為{0}分）','¡Tablero completo! Empate ({0} pts)','Grille complète ! Égalité ({0} pts)','Brett voll! Unentschieden ({0} Pkt.)']
  };
  const langs = ['en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  for (const [ko, list] of Object.entries(rows)) langs.forEach((l, i) => { (T[l] = T[l] || {})[ko] = list[i]; });
})();
