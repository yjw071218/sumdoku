/* 배포판별 동작: Google Play판의 광고·광고 제거 구매, 자체 업데이트 비활성화
 * - GitHub판 / 브라우저: 아무것도 바꾸지 않습니다(AndroidBridge.getDistribution 이 없거나 'github').
 * - Play판: 업데이트 확인·APK 설치 UI 숨김, 결과 화면 전면 광고(네이티브에서 빈도 제한),
 *           설정에 '광고 제거' 구매·구매 복원·개인정보 설정 항목 추가.
 */
(() => {
  // ---------------- 번역(localize-ui.js 보다 먼저 등록) ----------------
  const T = window.UI_TRANSLATIONS = window.UI_TRANSLATIONS || {};
  const rows = {
    '다시 시도': ['Retry','再試行','重试','重試','Reintentar','Réessayer','Erneut versuchen'],
    '구매 불가': ['Unavailable','購入不可','无法购买','無法購買','No disponible','Indisponible','Nicht verfügbar'],
    '🚫 광고 제거': ['🚫 Remove ads','🚫 広告を削除','🚫 移除广告','🚫 移除廣告','🚫 Quitar anuncios','🚫 Supprimer les pubs','🚫 Werbung entfernen'],
    '한 번 구매하면 다시 결제할 필요 없이 같은 Google 계정의 모든 기기에서 유지됩니다.': ['A one-time purchase stays on every device with the same Google account.','一度購入すると同じGoogleアカウントのすべての端末で維持されます。','一次购买后，同一Google账号的所有设备均可保留。','一次購買後，同一Google帳號的所有裝置皆可保留。','Una compra única se mantiene en todos tus dispositivos con la misma cuenta de Google.','Un achat unique reste actif sur tous vos appareils avec le même compte Google.','Ein einmaliger Kauf gilt auf allen Geräten mit demselben Google-Konto.'],
    '부분 제거는 배너·전면 광고만, 전체 제거는 보상형 광고(부활·힌트)까지 광고 없이 받습니다.': ['Basic removes banners and interstitials; Full also gives revives and hints without ads.','一部削除はバナー・全画面のみ、完全削除は復活・ヒントも広告なしで受け取れます。','部分移除仅去除横幅和插屏；全部移除还可免广告获得复活与提示。','部分移除僅去除橫幅與插頁；全部移除還可免廣告獲得復活與提示。','Básico quita banners e intersticiales; Total también da revivir y pistas sin anuncios.','Partielle retire bannières et interstitiels ; Totale donne aussi résurrections et indices sans pub.','Teilweise entfernt Banner und Interstitials; Vollständig gibt auch Wiederbelebungen und Hinweise ohne Werbung.'],
    '상품 정보를 찾지 못했습니다. Play Console에서 인앱 상품을 활성화했는지 확인해 주세요.': ['Products not found. Check that in-app products are active in Play Console.','商品情報が見つかりません。Play Consoleでアプリ内商品が有効か確認してください。','未找到商品信息，请确认 Play 管理中心已启用应用内商品。','找不到商品資訊，請確認 Play 管理中心已啟用應用程式內商品。','No se encontraron productos. Verifica que estén activos en Play Console.','Produits introuvables. Vérifiez qu’ils sont actifs dans la Play Console.','Produkte nicht gefunden. Prüfe, ob sie in der Play Console aktiv sind.'],
    '이 기기에서는 Play 결제를 사용할 수 없습니다. Play 스토어에서 설치했는지, 테스터 계정으로 로그인했는지 확인해 주세요.': ['Play Billing is unavailable on this device. Install from the Play Store and sign in with a tester account.','この端末ではPlay決済を利用できません。Playストアからのインストールとテスターアカウントを確認してください。','此设备无法使用 Play 结算。请确认从 Play 商店安装并使用测试账号登录。','此裝置無法使用 Play 帳款服務。請確認從 Play 商店安裝並以測試帳號登入。','Play Billing no está disponible. Instala desde Play Store con una cuenta de prueba.','Play Billing indisponible. Installez depuis le Play Store avec un compte testeur.','Play Billing nicht verfügbar. Aus dem Play Store installieren und mit Testkonto anmelden.'],
    '결제 서비스에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.': ['Could not reach the billing service. Check your connection and retry.','決済サービスに接続できません。接続を確認して再試行してください。','无法连接结算服务，请检查网络后重试。','無法連線帳款服務，請檢查網路後重試。','No se pudo conectar con el servicio de pago. Revisa la conexión.','Service de paiement injoignable. Vérifiez la connexion.','Zahlungsdienst nicht erreichbar. Verbindung prüfen.'],
    '📋 개인 정보 보호': ['📋 Privacy','📋 プライバシー','📋 隐私保护','📋 隱私保護','📋 Privacidad','📋 Confidentialité','📋 Datenschutz'],
    '게임 기록·리플레이·설정은 기기에 저장되며, Google Play 게임즈 저장을 직접 실행한 경우에만 내 Google 계정에 백업됩니다.': ['Records, replays and settings stay on this device and are backed up to your Google account only when you use Play Games save.','記録・リプレイ・設定は端末に保存され、Playゲームズ保存を実行した場合のみGoogleアカウントにバックアップされます。','记录、回放和设置保存在设备上，仅在你使用 Play 游戏保存时备份到 Google 账号。','紀錄、重播和設定儲存在裝置上，僅在你使用 Play 遊戲儲存時備份到 Google 帳號。','Registros, repeticiones y ajustes quedan en el dispositivo; solo se respaldan en Google al usar el guardado de Play Juegos.','Les données restent sur l’appareil et ne sont sauvegardées sur Google que via Play Jeux.','Daten bleiben auf dem Gerät und werden nur per Play Spiele-Speicherung im Google-Konto gesichert.'],
    '광고(Google AdMob)는 광고 표시와 빈도 제한을 위해 기기 식별자 등을 처리할 수 있으며, 동의 여부는 아래에서 언제든 바꿀 수 있습니다.': ['Ads (Google AdMob) may process device identifiers for serving and frequency capping. You can change consent below at any time.','広告（Google AdMob）は表示や頻度制限のため端末識別子などを処理する場合があります。同意は下でいつでも変更できます。','广告（Google AdMob）可能为投放与频次控制处理设备标识符，可随时在下方更改同意。','廣告（Google AdMob）可能為投放與頻次控制處理裝置識別碼，可隨時在下方變更同意。','Los anuncios (Google AdMob) pueden procesar identificadores del dispositivo. Puedes cambiar el consentimiento abajo.','Les pubs (Google AdMob) peuvent traiter des identifiants d’appareil. Vous pouvez modifier le consentement ci-dessous.','Werbung (Google AdMob) kann Gerätekennungen verarbeiten. Einwilligung unten jederzeit änderbar.'],
    '결제는 Google Play가 처리하며 앱은 카드 정보를 받지 않습니다.': ['Payments are handled by Google Play; the app never receives card details.','決済はGoogle Playが処理し、アプリはカード情報を受け取りません。','付款由 Google Play 处理，应用不会获取卡片信息。','付款由 Google Play 處理，應用程式不會取得卡片資訊。','Los pagos los gestiona Google Play; la app no recibe datos de tarjeta.','Les paiements sont gérés par Google Play ; l’app ne reçoit aucune donnée de carte.','Zahlungen laufen über Google Play; die App erhält keine Kartendaten.'],
    '👤 개인정보 판매 및 공유 거부': ['👤 Do not sell or share my info','👤 個人情報の販売・共有の拒否','👤 拒绝出售或共享个人信息','👤 拒絕出售或共享個人資訊','👤 No vender ni compartir mis datos','👤 Ne pas vendre ni partager','👤 Daten nicht verkaufen/teilen'],
    '썸도쿠는 개인정보를 판매하지 않습니다.': ['Sumdoku does not sell personal information.','サムドクは個人情報を販売しません。','Sumdoku 不出售个人信息。','Sumdoku 不出售個人資訊。','Sumdoku no vende datos personales.','Sumdoku ne vend pas de données personnelles.','Sumdoku verkauft keine personenbezogenen Daten.'],
    '맞춤 광고에 쓰이는 정보 공유를 원하지 않으면 아래에서 광고 동의를 변경해 주세요.': ['To opt out of sharing for personalized ads, change your ad consent below.','パーソナライズ広告への情報共有を望まない場合は、下で広告の同意を変更してください。','如不希望为个性化广告共享信息，请在下方更改广告同意。','如不希望為個人化廣告共享資訊，請在下方變更廣告同意。','Para no compartir datos para anuncios personalizados, cambia el consentimiento abajo.','Pour refuser le partage pour la pub personnalisée, modifiez le consentement ci-dessous.','Um die Weitergabe für personalisierte Werbung abzulehnen, ändere unten die Einwilligung.'],
"부분 광고 제거": ["Basic ad removal","一部の広告を削除","部分广告移除","部分廣告移除","Eliminar anuncios básicos","Suppression partielle","Teilweise werbefrei"],
"전체 광고 제거": ["Full ad removal","すべての広告を削除","移除全部广告","移除全部廣告","Eliminar todos los anuncios","Suppression totale","Vollständig werbefrei"],
"출시 특가": ["Launch Special","記念特価","首发特惠","首發特惠","Oferta de lanzamiento","Offre de lancement","Einführungsangebot"],
"출시 기념 특가 (정가 5,900원 상당). 모든 광고 제거. 게임당 부활 2회·추가 힌트 3회를 광고 없이 받습니다. 배틀 제외.": ["Launch special (reg. 5,900 KRW value). Remove all ads. Get up to 2 revives and 3 extra hints per game without ads. No battle rewards.","リリース記念特価（通常5,900ウォン相当）。すべての広告を削除。1ゲーム復活2回・追加ヒント3回を広告なしで獲得。対戦対象外。","首发特惠（原价5,900韩元）。移除全部广告。每局无需广告可复活2次、获额外提示3次。对战除外。","首發特惠（原價5,900韓元）。移除全部廣告。每局免廣告復活2次、額外提示3次。對戰除外。","Oferta de lanzamiento (valor reg. 5.900 KRW). Sin anuncios. Hasta 2 revidas y 3 pistas extra por partida. No en duelos.","Offre de lancement (valeur rég. 5 900 KRW). Sans pubs. 2 résurrections et 3 indices supplémentaires par partie. Hors duels.","Einführungsangebot (Regulär 5.900 KRW Wert). Werbefrei: bis zu 2 Wiederbelebungen und 3 Extra-Hinweise pro Spiel. Nicht im Duell."],
"배너·전면 광고 제거. 부활·힌트 보상은 광고 시청 후 받습니다.": ["Remove banners and interstitials. Watch ads for revive and hint rewards.","バナー・全画面広告を削除。復活・ヒントは広告視聴で獲得。","移除横幅和插屏广告。复活和提示仍需观看广告。","移除橫幅與插頁廣告。復活與提示仍需觀看廣告。","Sin banners ni intersticiales. Mira anuncios para revivir y obtener pistas.","Sans bannières ni interstitiels. Les récompenses nécessitent une pub.","Keine Banner oder Interstitials. Werbung für Wiederbelebung und Hinweise."],
"모든 광고 제거. 게임당 부활 2회·추가 힌트 3회를 광고 없이 받습니다. 배틀 제외.": ["Remove all ads. Get up to 2 revives and 3 extra hints per game without ads. No battle rewards.","すべての広告を削除。1ゲーム復活2回・追加ヒント3回を広告なしで獲得。対戦対象外。","移除全部广告。每局无需广告可复活2次、获额外提示3次。对战除外。","移除全部廣告。每局免廣告復活2次、額外提示3次。對戰除外。","Sin anuncios. Hasta 2 revidas y 3 pistas extra por partida. No en duelos.","Sans pubs. 2 résurrections et 3 indices supplémentaires par partie. Hors duels.","Werbefrei: bis zu 2 Wiederbelebungen und 3 Extra-Hinweise pro Spiel. Nicht im Duell."],

"전체 제거로 업그레이드": ["Upgrade to full removal","完全削除にアップグレード","升级为全部移除","升級為全部移除","Mejorar a eliminación total","Passer à la suppression totale","Auf vollständig werbefrei upgraden"],
"부분 제거 구매 완료": ["Basic purchased","一部削除を購入済み","已购买部分移除","已購買部分移除","Básico comprado","Partielle achetée","Teilweise gekauft"],
"전체 제거 구매 완료": ["Full purchased","完全削除を購入済み","已购买全部移除","已購買全部移除","Total comprado","Totale achetée","Vollständig gekauft"],
"가격 확인 중": ["Checking price","価格を確認中","正在获取价格","正在取得價格","Consultando precio","Vérification du prix","Preis wird geladen"],
"구매 혜택을 적용했습니다.": ["Purchase benefits applied.","購入特典を適用しました。","已应用购买权益。","已套用購買權益。","Ventajas de compra aplicadas.","Avantages appliqués.","Kaufvorteile angewendet."],
"구매한 광고 제거 단계를 복원했습니다.": ["Ad removal tier restored.","購入した広告削除を復元しました。","已恢复广告移除等级。","已恢復廣告移除等級。","Nivel de eliminación restaurado.","Niveau de suppression restauré.","Werbefrei-Stufe wiederhergestellt."],
    '광고 제거': ['Remove ads','広告を削除','移除广告','移除廣告','Quitar anuncios','Supprimer les pubs','Werbung entfernen'],
    '한 번 구매하면 배너와 전면 광고가 영구히 사라집니다': ['One-time purchase removes banner and full-screen ads forever','一度の購入でバナー広告と全画面広告が永久に消えます','一次购买即可永久移除横幅和全屏广告','一次購買即可永久移除橫幅和全螢幕廣告','Una compra elimina para siempre los anuncios de banner y pantalla completa','Un achat unique supprime définitivement les bannières et pubs plein écran','Einmal kaufen – Banner- und Vollbildwerbung verschwinden dauerhaft'],
    '구매': ['Buy','購入','购买','購買','Comprar','Acheter','Kaufen'],
    '구매 ({0})': ['Buy ({0})','購入（{0}）','购买（{0}）','購買（{0}）','Comprar ({0})','Acheter ({0})','Kaufen ({0})'],
    '구매 완료 · 광고 없음': ['Purchased · No ads','購入済み・広告なし','已购买 · 无广告','已購買 · 無廣告','Comprado · Sin anuncios','Acheté · Sans pub','Gekauft · Werbefrei'],
    '구매 복원': ['Restore purchase','購入を復元','恢复购买','恢復購買','Restaurar compra','Restaurer l’achat','Kauf wiederherstellen'],
    '다른 기기나 재설치 후 이전 구매를 다시 적용합니다': ['Reapply a previous purchase on a new device or after reinstalling','別の端末や再インストール後に以前の購入を再適用します','在其他设备或重新安装后重新应用之前的购买','在其他裝置或重新安裝後重新套用先前的購買','Vuelve a aplicar una compra anterior en otro dispositivo o tras reinstalar','Réappliquer un achat précédent sur un autre appareil ou après réinstallation','Früheren Kauf auf neuem Gerät oder nach Neuinstallation wiederherstellen'],
    '복원': ['Restore','復元','恢复','恢復','Restaurar','Restaurer','Wiederherstellen'],
    '개인정보 및 광고 설정': ['Privacy & ad settings','プライバシーと広告の設定','隐私与广告设置','隱私與廣告設定','Privacidad y anuncios','Confidentialité et pubs','Datenschutz & Werbung'],
    '광고 개인정보 동의를 다시 선택합니다': ['Change your ad privacy consent','広告のプライバシー同意を変更します','重新选择广告隐私同意','重新選擇廣告隱私同意','Cambia tu consentimiento de privacidad publicitaria','Modifier votre consentement publicitaire','Werbe-Einwilligung ändern'],
    '열기': ['Open','開く','打开','開啟','Abrir','Ouvrir','Öffnen'],
    '개인정보처리방침': ['Privacy policy','プライバシーポリシー','隐私政策','隱私權政策','Política de privacidad','Politique de confidentialité','Datenschutzerklärung'],
    '광고와 결제에서 처리하는 정보를 확인합니다': ['See what information ads and payments process','広告と決済で扱う情報を確認します','查看广告和支付处理的信息','查看廣告與付款處理的資訊','Consulta qué datos procesan los anuncios y pagos','Voir les données traitées par les pubs et paiements','Welche Daten Werbung und Zahlungen verarbeiten'],
    '보기': ['View','表示','查看','檢視','Ver','Voir','Ansehen'],
    '광고가 제거되었습니다. 구매해 주셔서 감사합니다!': ['Ads removed. Thank you for your purchase!','広告を削除しました。ご購入ありがとうございます！','广告已移除，感谢购买！','廣告已移除，感謝購買！','Anuncios eliminados. ¡Gracias por tu compra!','Publicités supprimées. Merci pour votre achat !','Werbung entfernt. Danke für deinen Kauf!'],
    '이전 구매를 복원했습니다. 광고가 제거되었습니다.': ['Purchase restored. Ads removed.','以前の購入を復元しました。広告を削除しました。','已恢复之前的购买，广告已移除。','已恢復先前的購買，廣告已移除。','Compra restaurada. Anuncios eliminados.','Achat restauré. Publicités supprimées.','Kauf wiederhergestellt. Werbung entfernt.'],
    '복원할 구매 내역이 없습니다.': ['No purchase to restore.','復元できる購入履歴がありません。','没有可恢复的购买记录。','沒有可恢復的購買紀錄。','No hay compras para restaurar.','Aucun achat à restaurer.','Kein Kauf zum Wiederherstellen.'],
    '결제가 대기 중입니다. 완료되면 광고가 자동으로 제거됩니다.': ['Payment pending. Ads will be removed automatically once it completes.','決済が保留中です。完了すると広告は自動で削除されます。','付款处理中，完成后将自动移除广告。','付款處理中，完成後將自動移除廣告。','Pago pendiente. Los anuncios se quitarán al completarse.','Paiement en attente. Les pubs seront supprimées une fois terminé.','Zahlung ausstehend. Werbung wird nach Abschluss entfernt.'],
    '결제를 취소했습니다.': ['Purchase canceled.','購入をキャンセルしました。','已取消购买。','已取消購買。','Compra cancelada.','Achat annulé.','Kauf abgebrochen.'],
    '지금은 결제를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.': ['Payments are unavailable right now. Please try again later.','現在決済を利用できません。しばらくしてから再度お試しください。','目前无法付款，请稍后再试。','目前無法付款，請稍後再試。','Los pagos no están disponibles ahora. Inténtalo más tarde.','Paiement indisponible pour le moment. Réessayez plus tard.','Zahlungen sind gerade nicht verfügbar. Bitte später erneut versuchen.'],
    '결제 중 문제가 발생했습니다. 다시 시도해 주세요.': ['Something went wrong with the payment. Please try again.','決済中に問題が発生しました。もう一度お試しください。','付款时出现问题，请重试。','付款時發生問題，請再試一次。','Hubo un problema con el pago. Inténtalo de nuevo.','Un problème est survenu lors du paiement. Réessayez.','Bei der Zahlung ist ein Fehler aufgetreten. Bitte erneut versuchen.'],
    '이미 광고 제거를 구매했습니다.': ['You already own Remove ads.','広告削除は購入済みです。','你已购买移除广告。','你已購買移除廣告。','Ya compraste Quitar anuncios.','Vous possédez déjà Supprimer les pubs.','Du hast „Werbung entfernen“ bereits gekauft.'],
    '업데이트는 Google Play 스토어에서 받을 수 있습니다.': ['Updates are available from the Google Play Store.','アップデートはGoogle Playストアから入手できます。','可在 Google Play 商店获取更新。','可在 Google Play 商店取得更新。','Las actualizaciones están en Google Play Store.','Les mises à jour sont disponibles sur le Google Play Store.','Updates gibt es im Google Play Store.']
  };
  const langs = ['en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de'];
  for (const [ko, list] of Object.entries(rows)) langs.forEach((l, i) => { (T[l] = T[l] || {})[ko] = list[i]; });

  const PRIVACY_URL = 'https://yjw071218.github.io/sumdoku/privacy.html';
  const bridge = () => window.AndroidBridge;
  const distribution = () => { try { return bridge()?.getDistribution?.() || 'web'; } catch (_) { return 'web'; } };
  const isPlay = () => distribution() === 'play';
  if (typeof SumdokuApp === 'undefined') return;
  const P = SumdokuApp.prototype;

  // ---------------- Play판: 자체 업데이트 UI 비활성화 ----------------
  const baseCheck = P.checkForUpdates;
  P.checkForUpdates = function (manual) {
    if (isPlay()) { if (manual) this.showToast('업데이트는 Google Play 스토어에서 받을 수 있습니다.'); return Promise.resolve(); }
    return baseCheck.apply(this, arguments);
  };

  // ---------------- 결과 화면 전면 광고 ----------------
  // 표시 여부·빈도(결과 2회마다, 최소 3분 간격)는 네이티브가 결정합니다. 결과창이 뜬 뒤 잠시 후 요청합니다.
  const requestInterstitial = () => {
    if (!isPlay()) return;
    setTimeout(() => { try { bridge()?.showInterstitial?.(); } catch (_) {} }, 1200);
  };
  const baseResult = P.showGameResultModal;
  P.showGameResultModal = function () { const r = baseResult.apply(this, arguments); requestInterstitial(); return r; };
  const baseBattleEnd = P.handleBattleEnd;
  P.handleBattleEnd = function () {
    const was = this.isBattle;
    const r = baseBattleEnd.apply(this, arguments);
    if (was && !this.isBattle) requestInterstitial();
    return r;
  };

  // ---------------- 설정: 광고 제거 · 복원 · 개인정보 ----------------
  const state = { tier: 0, basicPrice: '', fullPrice: '', upgradePrice: '', privacy: false };
  // 출시 기념 특가: 2026년 12월 31일 23:59:59까지 유효, 2027년이 되는 순간 자동 종료
  const isLaunchSale = () => new Date().getFullYear() < 2027;
  const getFullAdDesc = () => isLaunchSale()
    ? '출시 기념 특가 (정가 5,900원 상당). 모든 광고 제거. 게임당 부활 2회·추가 힌트 3회를 광고 없이 받습니다. 배틀 제외.'
    : '모든 광고 제거. 게임당 부활 2회·추가 힌트 3회를 광고 없이 받습니다. 배틀 제외.';
  const item = (id, title, desc, button, badge) => {
    const row = document.createElement('div');
    row.className = 'settings-item'; row.id = id;
    row.innerHTML = '<div class="settings-info"><span class="s-title"></span><span class="s-desc"></span></div><button type="button" class="btn btn-secondary monetize-btn"></button>';
    const titleEl = row.querySelector('.s-title');
    titleEl.textContent = title;
    if (badge) {
      const bEl = document.createElement('span');
      bEl.className = 'launch-badge';
      bEl.textContent = badge;
      titleEl.appendChild(bEl);
    }
    row.querySelector('.s-desc').textContent = desc;
    row.querySelector('button').textContent = button;
    return row;
  };
  // v1.1.30: 광고 제거·구매 복원은 [광고 제거] 탭으로, 개인정보 동의·처리방침은 [개인 정보] 탭으로 옮겼습니다.
  //          (게임 설정 목록에는 더 이상 넣지 않습니다.) Play판에서는 '무광고 오픈소스' 안내 문구도 실제 내용으로 바꿉니다.
  const tr = t => (window.I18N && typeof I18N.text === 'function') ? I18N.text(t) : t;
  const infoCard = (title, lines) => {
    const c = document.createElement('div'); c.className = 'info-card';
    const h = document.createElement('h3'); h.textContent = tr(title); c.append(h);
    lines.forEach(l => { const p = document.createElement('p'); p.textContent = tr(l); c.append(p); });
    return c;
  };
  const listBox = (...rows) => { const box = document.createElement('div'); box.className = 'settings-list-card monetize-list'; box.append(...rows); return box; };
  // 가격이 비어 있을 때의 원인 (BillingResponseCode)
  function priceProblem() {
    if (state.billingCode === undefined) return '';
    const code = Number(state.billingCode);
    if (code === -100) return '';
    if (code === 0 && state.missing && !state.fullPrice && !state.basicPrice) return '상품 정보를 찾지 못했습니다. Play Console에서 인앱 상품을 활성화했는지 확인해 주세요.';
    if (code === 3) return '이 기기에서는 Play 결제를 사용할 수 없습니다. Play 스토어에서 설치했는지, 테스터 계정으로 로그인했는지 확인해 주세요.';
    if (code === 2 || code === 12 || code === -1 || code === 6) return '결제 서비스에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
    if (code !== 0) return '상품 정보를 불러오지 못했습니다 (코드 ' + code + ').';
    return '';
  }
  function mountNoAds() {
    let group = document.getElementById('settings-monetization');
    if (group) return group;
    const panel = document.getElementById('panel-noads');
    if (!panel) return null;
    panel.innerHTML = '';
    panel.append(infoCard('🚫 광고 제거', ['한 번 구매하면 다시 결제할 필요 없이 같은 Google 계정의 모든 기기에서 유지됩니다.', '부분 제거는 배너·전면 광고만, 전체 제거는 보상형 광고(부활·힌트)까지 광고 없이 받습니다.']));
    group = listBox(
      item('setting-basic-ads', '부분 광고 제거', '배너·전면 광고 제거. 부활·힌트 보상은 광고 시청 후 받습니다.', '구매'),
      item('setting-remove-ads', '전체 광고 제거', getFullAdDesc(), '구매', isLaunchSale() ? '출시 특가' : null),
      item('setting-restore-purchase', '구매 복원', '다른 기기나 재설치 후 이전 구매를 다시 적용합니다', '복원'));
    group.id = 'settings-monetization';
    const note = document.createElement('p'); note.id = 'monetize-problem'; note.className = 'monetize-problem'; note.hidden = true;
    const retry = document.createElement('button'); retry.type = 'button'; retry.id = 'monetize-retry'; retry.className = 'btn btn-secondary monetize-retry'; retry.hidden = true;
    retry.addEventListener('click', () => { window.app?.sound?.play?.('click'); state.billingCode = -100; render(); bridge()?.refreshProducts?.(); });
    panel.append(group, note, retry);
    group.querySelector('#setting-basic-ads button').addEventListener('click', () => bridge()?.purchaseAdProduct?.('remove_ads_basic'));
    group.querySelector('#setting-remove-ads button').addEventListener('click', () => {
      if (bridge()?.purchaseAdProduct) bridge().purchaseAdProduct(state.tier === 1 ? 'remove_ads_upgrade' : 'remove_ads');
      else bridge()?.purchaseRemoveAds?.();
    });
    group.querySelector('#setting-restore-purchase button').addEventListener('click', () => { window.app?.sound?.play?.('click'); bridge()?.restorePurchases?.(); });
    return group;
  }
  function mountPrivacy() {
    if (document.getElementById('settings-privacy-group')) return;
    const panel = document.getElementById('panel-privacy');
    if (!panel) return;
    panel.innerHTML = '';
    panel.append(infoCard('📋 개인 정보 보호', [
      '게임 기록·리플레이·설정은 기기에 저장되며, Google Play 게임즈 저장을 직접 실행한 경우에만 내 Google 계정에 백업됩니다.',
      '광고(Google AdMob)는 광고 표시와 빈도 제한을 위해 기기 식별자 등을 처리할 수 있으며, 동의 여부는 아래에서 언제든 바꿀 수 있습니다.',
      '결제는 Google Play가 처리하며 앱은 카드 정보를 받지 않습니다.']));
    const g = listBox(
      item('setting-privacy-options', '개인정보 및 광고 설정', '광고 개인정보 동의를 다시 선택합니다', '열기'),
      item('setting-privacy-policy', '개인정보처리방침', '광고와 결제에서 처리하는 정보를 확인합니다', '보기'));
    g.id = 'settings-privacy-group';
    panel.append(g);
    g.querySelector('#setting-privacy-options button').addEventListener('click', () => bridge()?.showPrivacyOptions?.());
    g.querySelector('#setting-privacy-policy button').addEventListener('click', () => {
      if (bridge()?.openExternalUrl) bridge().openExternalUrl(PRIVACY_URL); else window.open(PRIVACY_URL, '_blank');
    });
    const opt = document.getElementById('panel-privacy-opt');
    if (opt) {
      opt.innerHTML = '';
      opt.append(infoCard('👤 개인정보 판매 및 공유 거부', ['썸도쿠는 개인정보를 판매하지 않습니다.', '맞춤 광고에 쓰이는 정보 공유를 원하지 않으면 아래에서 광고 동의를 변경해 주세요.']));
      const b = item('setting-privacy-optout', '개인정보 및 광고 설정', '광고 개인정보 동의를 다시 선택합니다', '열기');
      b.querySelector('button').addEventListener('click', () => bridge()?.showPrivacyOptions?.());
      opt.append(listBox(b));
    }
  }
  function render() {
    if (!isPlay()) return;
    const group = mountNoAds();
    mountPrivacy();
    if (!group) return;
    const basic = group.querySelector('#setting-basic-ads button'), buy = group.querySelector('#setting-remove-ads button');
    const owned = state.tier >= 1, full = state.tier === 2, price = state.tier === 1 ? state.upgradePrice : state.fullPrice;
    const problem = priceProblem();
    const waiting = problem ? tr('구매 불가') : tr('가격 확인 중');
    basic.textContent = owned ? tr('부분 제거 구매 완료') : state.basicPrice ? tr('구매') + ' (' + state.basicPrice + ')' : waiting;
    basic.disabled = owned || !state.basicPrice;
    const label = state.tier === 1 ? '전체 제거로 업그레이드' : '구매';
    buy.textContent = full ? tr('전체 제거 구매 완료') : price ? tr(label) + ' (' + price + ')' : waiting;
    buy.disabled = full || !price;
    const badge = group.querySelector('#setting-remove-ads .launch-badge');
    if (badge) badge.hidden = full || !isLaunchSale();
    const descEl = group.querySelector('#setting-remove-ads .s-desc');
    if (descEl) descEl.textContent = tr(getFullAdDesc());
    const note = document.getElementById('monetize-problem'), retry = document.getElementById('monetize-retry');
    const showProblem = !!problem && !full;
    if (note) { note.hidden = !showProblem; note.textContent = showProblem ? tr(problem) : ''; }
    if (retry) { retry.hidden = !showProblem; retry.textContent = tr('다시 시도'); }
    const opt = document.getElementById('setting-privacy-options');
    if (opt) opt.hidden = !state.privacy;
  }
  // 언어를 바꾸면 가격 버튼 문구를 다시 조합합니다.
  window.addEventListener('DOMContentLoaded', () => { const base = window.I18N?.setLanguage; if (base) I18N.setLanguage = function () { const r = base.apply(this, arguments); render(); return r; }; });
  window.onMonetizationChanged = (adFree, price, privacy) => {
    if(adFree && typeof adFree==='object') Object.assign(state,adFree);
    else Object.assign(state,{tier:adFree?2:0,fullPrice:price||'',privacy:!!privacy});
    render();
  };
  const MESSAGES = {
    purchased: '구매 혜택을 적용했습니다.',
    restored: '구매한 광고 제거 단계를 복원했습니다.',
    owned: '이미 광고 제거를 구매했습니다.',
    none: '복원할 구매 내역이 없습니다.',
    pending: '결제가 대기 중입니다. 완료되면 광고가 자동으로 제거됩니다.',
    canceled: '결제를 취소했습니다.',
    unavailable: '지금은 결제를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    error: '결제 중 문제가 발생했습니다. 다시 시도해 주세요.'
  };
  window.onPurchaseResult = status => { const m = MESSAGES[status]; if (m) window.app?.showToast?.(m); };

  window.addEventListener('DOMContentLoaded', () => {
    if (!isPlay()) return;
    document.body.classList.add('dist-play');
    try {
      if(bridge().getMonetizationState) Object.assign(state,JSON.parse(bridge().getMonetizationState()));
      else {state.tier=bridge().isAdFree?.()?2:0;state.fullPrice=bridge().getRemoveAdsPrice?.()||'';state.privacy=!!bridge().isPrivacyOptionsRequired?.();}
    } catch (_) {}
    render();
  });
})();
