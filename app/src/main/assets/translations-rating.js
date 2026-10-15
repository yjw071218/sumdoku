/* v1.1.19 · 랭크·리더보드 문구 */
(() => {
 const langs=['en','ja','zh','zh-TW','es','fr','de'];
 const rows={
 '브론즈':['Bronze','ブロンズ','青铜','青銅','Bronce','Bronze','Bronze'],
 '실버':['Silver','シルバー','白银','白銀','Plata','Argent','Silber'],
 '골드':['Gold','ゴールド','黄金','黃金','Oro','Or','Gold'],
 '플래티넘':['Platinum','プラチナ','铂金','白金','Platino','Platine','Platin'],
 '다이아몬드':['Diamond','ダイヤモンド','钻石','鑽石','Diamante','Diamant','Diamant'],
 '마스터':['Master','マスター','大师','大師','Maestro','Maître','Meister'],
 '그랜드마스터':['Grandmaster','グランドマスター','宗师','宗師','Gran maestro','Grand maître','Großmeister'],
 '랭크':['Rank','ランク','段位','段位','Rango','Rang','Rang'],
 '다음 클리어 보너스':['Next clear bonus','次のクリアボーナス','下次通关奖励','下次通關獎勵','Próximo bonus','Prochain bonus','Nächster Bonus'],
 '이 난이도의 타임어택에서 기준보다 높은 점수를 내면 레이팅이 오릅니다.':['Score above the target in Time Attack at this difficulty to raise your rating.','この難易度のタイムアタックで基準を超えるスコアを出すとレーティングが上がります。','在该难度限时挑战中得分超过标准即可提升积分。','在該難度限時挑戰中得分超過標準即可提升積分。','Supera la puntuación objetivo en contrarreloj para subir tu rango.','Dépassez le score cible en contre-la-montre pour monter votre classement.','Übertriff im Zeitangriff die Zielpunktzahl, um deine Wertung zu erhöhen.'],
 '레이팅 유지':['Rating unchanged','レーティング維持','积分不变','積分不變','Rango sin cambios','Classement inchangé','Wertung unverändert'],
 '상승 기준':['Target','上昇基準','提升标准','提升標準','Objetivo','Objectif','Ziel'],
 '상승 기준 점수':['Target score to rank up','上昇に必要なスコア','提升所需分数','提升所需分數','Puntuación objetivo','Score cible','Zielpunktzahl'],
 '난이도별 랭크':['Rank by difficulty','難易度別ランク','各难度段位','各難度段位','Rango por dificultad','Rang par difficulté','Rang nach Schwierigkeit'],
 '이 난이도의 일반 게임이나 일일 도전을 클리어하면 레이팅이 쌓입니다.':['Clear normal games or daily challenges at this difficulty to earn rating.','この難易度の通常ゲームやデイリーチャレンジをクリアするとレーティングが貯まります。','通关该难度的普通游戏或每日挑战即可积累积分。','通關該難度的一般遊戲或每日挑戰即可累積積分。','Supera partidas normales o retos diarios en esta dificultad para ganar puntos.','Terminez des parties normales ou des défis du jour à cette difficulté pour gagner des points.','Löse normale Spiele oder Tagesrätsel in dieser Schwierigkeit, um Wertung zu sammeln.'],
 '최고':['Peak','最高','最高','最高','Máx.','Max','Bestwert'],
 '다음 단계까지':['To next division:','次の段階まで','距下一级','距下一級','Para la siguiente división:','Avant la division suivante :','Bis zur nächsten Stufe:'],
 '최고 티어입니다':['Top tier reached','最高ティアです','已达最高段位','已達最高段位','Nivel máximo alcanzado','Rang maximal atteint','Höchste Stufe erreicht'],
 '일반 게임이나 일일 도전을 클리어하면 레이팅이 쌓입니다.':['Clear normal games or daily challenges to earn rating.','通常ゲームやデイリーチャレンジをクリアするとレーティングが貯まります。','通关普通游戏或每日挑战即可积累积分。','通關一般遊戲或每日挑戰即可累積積分。','Supera partidas normales o retos diarios para ganar puntos.','Terminez des parties normales ou des défis du jour pour gagner des points.','Löse normale Spiele oder Tagesrätsel, um Wertung zu sammeln.'],
 '비활동 감소까지':['Inactivity decay in','非アクティブ減少まで','距离不活跃扣分','距離不活躍扣分','Pérdida por inactividad en','Baisse pour inactivité dans','Inaktivitätsabzug in'],
 '비활동으로 레이팅이 매일 감소하고 있습니다':['Rating is decaying daily due to inactivity','非アクティブのためレーティングが毎日減少しています','因不活跃，积分每天下降','因不活躍，積分每天下降','Tu puntuación baja cada día por inactividad','Votre classement baisse chaque jour (inactivité)','Wertung sinkt täglich wegen Inaktivität'],
 '비활동 감소':['Inactivity decay','非アクティブ減少','不活跃扣分','不活躍扣分','Pérdida por inactividad','Baisse pour inactivité','Inaktivitätsabzug'],
 '랭킹 보기':['View ranking','ランキングを見る','查看排行','查看排行','Ver clasificación','Voir le classement','Rangliste ansehen'],
 '전체 리더보드':['All leaderboards','全リーダーボード','全部排行榜','全部排行榜','Todas las clasificaciones','Tous les classements','Alle Bestenlisten'],
 '승급!':['promoted!','昇格！','晋级！','晉級！','¡ascenso!','promu !','Aufstieg!'],
 '강등':['demoted','降格','降级','降級','descenso','rétrogradé','Abstieg'],
 '리더보드가 아직 설정되지 않았습니다.':['Leaderboards are not set up yet.','リーダーボードはまだ設定されていません。','排行榜尚未设置。','排行榜尚未設定。','Las clasificaciones aún no están configuradas.','Les classements ne sont pas encore configurés.','Bestenlisten sind noch nicht eingerichtet.'],
 'Google Play 게임즈에 로그인하지 못했습니다.':['Could not sign in to Google Play Games.','Google Play ゲームにログインできませんでした。','无法登录 Google Play 游戏。','無法登入 Google Play 遊戲。','No se pudo iniciar sesión en Google Play Juegos.','Connexion à Google Play Jeux impossible.','Anmeldung bei Google Play Spiele fehlgeschlagen.'],
 '리더보드를 열지 못했습니다.':['Could not open the leaderboard.','リーダーボードを開けませんでした。','无法打开排行榜。','無法開啟排行榜。','No se pudo abrir la clasificación.','Impossible d’ouvrir le classement.','Bestenliste konnte nicht geöffnet werden.']
 };
 const t=window.UI_TRANSLATIONS=window.UI_TRANSLATIONS||{};
 for(const [k,v] of Object.entries(rows)) langs.forEach((l,i)=>{(t[l] ||= {})[k]=v[i];});
})();
