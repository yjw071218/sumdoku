/* Hint and replay controls; loaded before localize-ui builds its dictionary. */
(() => {
 const langs=['en','ja','zh','zh-TW','es','fr','de'];
 const rows={
 '게임 시작 상태입니다. [':['Initial game state. [','ゲーム開始時の状態です。[','这是游戏初始状态。[','這是遊戲初始狀態。[','Estado inicial. [','État initial. [','Anfangszustand. ['],
 '] 버튼을 누르거나 슬라이더로 수순을 확인하세요.':['] or use the slider to review moves.','] を押すかスライダーで手順を確認してください。','] 按钮或使用滑块查看步骤。','] 按鈕或使用滑桿查看步驟。','] o usa el deslizador para revisar las jugadas.','] ou utilisez le curseur pour revoir les coups.','] drücken oder Züge mit dem Regler ansehen.'],
 '언어 선택 · Choose your language':['Choose your language','言語を選択','选择语言','選擇語言','Elige tu idioma','Choisissez votre langue','Sprache wählen'],
 '자세히':['Details','詳しく','详细','詳細','Detalles','Détails','Details'],
 '접기':['Collapse','折りたたむ','收起','收合','Contraer','Réduire','Zuklappen'],
 '✎ 메모 확인':['✎ Check notes','✎ メモ確認','✎ 检查笔记','✎ 檢查筆記','✎ Revisar notas','✎ Vérifier les notes','✎ Notizen prüfen'],
 '메모 확인':['Check notes','メモ確認','检查笔记','檢查筆記','Revisar notas','Vérifier les notes','Notizen prüfen'],
 '✓ 메모 있음':['✓ Noted','✓ メモあり','✓ 已有笔记','✓ 已有筆記','✓ Anotado','✓ Noté','✓ Notiert'],
 '메모 있음':['Noted','メモあり','已有笔记','已有筆記','Anotado','Noté','Notiert'],
 '메모 없음 — 적어 두세요':['Missing note — add it','メモなし — 記入しましょう','没有笔记 — 请记下','沒有筆記 — 請記下','Falta la nota — añádela','Note absente — ajoutez-la','Notiz fehlt — ergänzen'],
 '메모에서 지우기':['Remove from notes','メモから削除','从笔记中删除','從筆記中刪除','Quitar de las notas','Retirer des notes','Aus Notizen entfernen'],
 '숫자 바로잡기':['Correct a digit','数字の修正','纠正数字','修正數字','Corregir un dígito','Corriger un chiffre','Ziffer korrigieren'],
 '후보 좁히기':['Narrow candidates','候補を絞る','缩小候选范围','縮小候選範圍','Reducir candidatos','Réduire les candidats','Kandidaten eingrenzen'],
 '원인 보기':['Show reason','原因を見る','查看原因','查看原因','Ver motivo','Voir la cause','Grund anzeigen'],
 '틀린 원인':['Reason for the mistake','間違いの原因','错误原因','錯誤原因','Motivo del error','Cause de l’erreur','Fehlerursache'],
 '이어서 할 게임이 없습니다.':['No game to resume.','再開できるゲームはありません。','没有可继续的游戏。','沒有可繼續的遊戲。','No hay partida para continuar.','Aucune partie à reprendre.','Kein Spiel zum Fortsetzen.'],
 '지금 판에서는 몇 단계의 추론만으로 바로 확정되는 칸을 찾지 못했습니다.':['No cell could be resolved with a short deduction.','短い推論で確定できるマスが見つかりませんでした。','未找到通过简短推理就能确定的格子。','未找到透過簡短推理就能確定的格子。','No se encontró una celda resoluble con una deducción breve.','Aucune case résolue par une courte déduction.','Keine Zelle durch eine kurze Schlussfolgerung auflösbar.'],
 '이미 놓인 숫자를 같은 행·열·박스·케이지의 다른 칸 후보에서 지웁니다.':['Eliminate placed digits from other cells in the same row, column, box and cage.','配置済みの数字を同じ行・列・ボックス・ケージの他のマスの候補から除きます。','从同行、列、宫和笼子的其他格候选数中排除已填数字。','從同行、列、宮和籠子的其他格候選數中排除已填數字。','Descarta los dígitos colocados de las otras celdas de la misma fila, columna, caja y jaula.','Éliminez les chiffres placés des autres cases de la même ligne, colonne, bloc et cage.','Gesetzte Ziffern aus anderen Zellen derselben Zeile, Spalte, desselben Blocks und Käfigs streichen.'],
 '킬러 스도쿠의 정답은 하나뿐입니다. 이 칸에 다른 숫자를 넣어야만 모든 행·열·박스·케이지 조건을 동시에 만족할 수 있습니다.':['This puzzle has one solution. A different digit is needed here to satisfy all row, column, box and cage constraints.','このパズルの解は一つです。行・列・ボックス・ケージの条件をすべて満たすには、このマスに別の数字が必要です。','此题只有一个解。此格需填其他数字才能满足所有行、列、宫和笼子的条件。','此題只有一個解。此格需填其他數字才能滿足所有行、列、宮和籠子的條件。','Este puzle tiene una solución. Hace falta otro dígito aquí para cumplir todas las restricciones.','Cette grille a une seule solution. Un autre chiffre est nécessaire ici pour respecter toutes les contraintes.','Dieses Rätsel hat eine Lösung. Hier ist eine andere Ziffer nötig, um alle Bedingungen zu erfüllen.'],
 'Previous step':['Previous step','前の手順','上一步','上一步','Paso anterior','Étape précédente','Vorheriger Schritt'],
 'Next step':['Next step','次の手順','下一步','下一步','Paso siguiente','Étape suivante','Nächster Schritt'],
 '힌트 다시 보기':['Reopen hint','ヒントを再表示','重新查看提示','重新查看提示','Reabrir pista','Rouvrir l’indice','Tipp erneut anzeigen']
 };
 const t=window.UI_TRANSLATIONS=window.UI_TRANSLATIONS||{};
 for(const [key,values] of Object.entries(rows)) langs.forEach((lang,i)=>{(t[lang] ||= {})[key]=values[i];});
})();
