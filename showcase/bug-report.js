/* v2.7.1 · 버그·오류 신고 + 자동 오류 보고 + 개발자용 앱 내 신고함
 *
 * 사용자
 *   - 설정(언어 항목 아래 '번역 오류 신고' 옆)과 게임 중 설정 창 하단에 [버그·오류 신고] 버튼
 *   - 종류(게임 오류 · 화면 깨짐 · 멈춤/강제 종료 · 번역 · 제안), 내용, 연락처(선택), 진단 정보 포함 여부
 *   - 진단 정보: 앱 버전·배포판·언어·화면 크기·기기·현재 화면·난이도/모드·최근 JS 오류(최대 8개)
 *   - '오류 자동 보고'(기본 켜짐): 처리되지 않은 JS 오류를 익명으로 보냅니다(같은 오류는 세션당 1번, 세션당 최대 5건).
 *
 * 개발자: 신고 확인·관리는 앱 밖의 웹 대시보드에서만 합니다(앱에는 관리 기능·관리자 키가 없습니다).
 */
(() => {
  const BASE = 'https://sumdoku-match.match-server.workers.dev';
  const AUTO_KEY = 'sumdoku_bug_auto';
  const ERR_KEY = 'sumdoku_recent_errors';
  const bridge = () => window.AndroidBridge;
  const lang = () => { try { return (window.I18N && I18N.currentLang) || localStorage.getItem('sumdoku_language') || 'ko'; } catch (_) { return 'ko'; } };
  const ver = () => { try { return bridge()?.getVersion?.() || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : ''); } catch (_) { return ''; } };
  const dist = () => { try { return bridge()?.getDistribution?.() || 'web'; } catch (_) { return 'web'; } };

  /* ---------------- 문구 (17개 언어) ---------------- */
  const LANGS = ['ko', 'en', 'ja', 'zh', 'zh-TW', 'es', 'fr', 'de', 'pt', 'ru', 'id', 'tr', 'vi', 'th', 'it', 'ar', 'he'];
  const S = {
    btn: ['버그·오류 신고', 'Report a bug', '不具合を報告', '报告问题', '回報問題', 'Informar de un error', 'Signaler un bug', 'Fehler melden', 'Relatar um erro', 'Сообщить об ошибке', 'Laporkan bug', 'Hata bildir', 'Báo lỗi', 'รายงานข้อผิดพลาด', 'Segnala un bug', 'الإبلاغ عن خطأ', 'דיווח על באג'],
    desc: ['어떤 상황에서 문제가 생겼는지 알려 주세요. 앱 버전과 화면 정보가 익명으로 함께 전달됩니다.', 'Tell us what happened. The app version and screen info are sent anonymously.', 'どんな状況で問題が起きたか教えてください。アプリのバージョンと画面情報が匿名で送信されます。', '请告诉我们发生了什么。应用版本和屏幕信息会匿名发送。', '請告訴我們發生了什麼。應用程式版本與畫面資訊會匿名傳送。', 'Cuéntanos qué pasó. La versión y la información de pantalla se envían de forma anónima.', 'Dites-nous ce qui s’est passé. La version et les infos d’écran sont envoyées anonymement.', 'Beschreibe, was passiert ist. App-Version und Bildschirminfos werden anonym gesendet.', 'Conte o que aconteceu. A versão do app e as informações da tela são enviadas anonimamente.', 'Опишите, что произошло. Версия приложения и данные экрана отправляются анонимно.', 'Ceritakan apa yang terjadi. Versi aplikasi dan info layar dikirim secara anonim.', 'Ne olduğunu anlatın. Uygulama sürümü ve ekran bilgisi anonim olarak gönderilir.', 'Hãy cho chúng tôi biết chuyện gì đã xảy ra. Phiên bản ứng dụng và thông tin màn hình được gửi ẩn danh.', 'บอกเราว่าเกิดอะไรขึ้น เวอร์ชันแอปและข้อมูลหน้าจอจะถูกส่งแบบไม่ระบุตัวตน', 'Raccontaci cosa è successo. Versione dell’app e informazioni sullo schermo vengono inviate in forma anonima.', 'أخبرنا بما حدث. يتم إرسال إصدار التطبيق ومعلومات الشاشة دون الكشف عن هويتك.', 'ספרו לנו מה קרה. גרסת האפליקציה ופרטי המסך נשלחים באופן אנונימי.'],
    kind: ['종류', 'Type', '種類', '类型', '類型', 'Tipo', 'Type', 'Art', 'Tipo', 'Тип', 'Jenis', 'Tür', 'Loại', 'ประเภท', 'Tipo', 'النوع', 'סוג'],
    k_bug: ['게임 오류', 'Game bug', 'ゲームの不具合', '游戏错误', '遊戲錯誤', 'Error del juego', 'Bug de jeu', 'Spielfehler', 'Erro no jogo', 'Ошибка в игре', 'Bug permainan', 'Oyun hatası', 'Lỗi trò chơi', 'ข้อผิดพลาดในเกม', 'Bug di gioco', 'خطأ في اللعبة', 'באג במשחק'],
    k_ui: ['화면·레이아웃 깨짐', 'Broken layout', '画面・レイアウト崩れ', '界面显示异常', '畫面顯示異常', 'Diseño roto', 'Affichage cassé', 'Layout-Fehler', 'Layout quebrado', 'Сломан интерфейс', 'Tampilan rusak', 'Bozuk görünüm', 'Lỗi giao diện', 'หน้าจอแสดงผลผิดปกติ', 'Layout rotto', 'خلل في الواجهة', 'תצוגה שבורה'],
    k_crash: ['멈춤·강제 종료', 'Freeze or crash', 'フリーズ・強制終了', '卡住或闪退', '卡住或閃退', 'Bloqueo o cierre', 'Blocage ou plantage', 'Hänger oder Absturz', 'Travamento ou fechamento', 'Зависание или вылет', 'Macet atau keluar sendiri', 'Donma veya çökme', 'Treo hoặc thoát đột ngột', 'ค้างหรือเด้งออก', 'Blocco o arresto', 'تجمّد أو إغلاق مفاجئ', 'קיפאון או קריסה'],
    k_translation: ['번역 오류', 'Translation', '翻訳ミス', '翻译错误', '翻譯錯誤', 'Traducción', 'Traduction', 'Übersetzung', 'Tradução', 'Перевод', 'Terjemahan', 'Çeviri', 'Bản dịch', 'คำแปล', 'Traduzione', 'الترجمة', 'תרגום'],
    k_idea: ['제안', 'Suggestion', '提案', '建议', '建議', 'Sugerencia', 'Suggestion', 'Vorschlag', 'Sugestão', 'Предложение', 'Saran', 'Öneri', 'Góp ý', 'ข้อเสนอแนะ', 'Suggerimento', 'اقتراح', 'הצעה'],
    what: ['무슨 일이 있었나요?', 'What happened?', '何が起きましたか？', '发生了什么？', '發生了什麼？', '¿Qué pasó?', 'Que s’est-il passé ?', 'Was ist passiert?', 'O que aconteceu?', 'Что случилось?', 'Apa yang terjadi?', 'Ne oldu?', 'Đã xảy ra chuyện gì?', 'เกิดอะไรขึ้น?', 'Cosa è successo?', 'ماذا حدث؟', 'מה קרה?'],
    ph: ['예) 루나틱에서 힌트를 누르면 화면이 멈춰요', 'e.g. The screen freezes when I tap Hint in Lunatic', '例）ルナティックでヒントを押すと画面が止まる', '例如：在疯狂难度点提示后画面卡住', '例如：在瘋狂難度點提示後畫面卡住', 'p. ej., la pantalla se congela al tocar Pista en Lunático', 'ex. : l’écran se fige quand je touche Indice en Lunatique', 'z. B. Bildschirm friert ein, wenn ich in „Wahnsinnig“ auf Tipp tippe', 'ex.: a tela trava ao tocar em Dica no Lunático', 'например: экран зависает при нажатии «Подсказка» в режиме Безумие', 'mis. layar macet saat menekan Petunjuk di Lunatic', 'örn. Çılgın modda İpucu’na basınca ekran donuyor', 'VD: màn hình bị treo khi bấm Gợi ý ở chế độ Lunatic', 'เช่น หน้าจอค้างเมื่อกดคำใบ้ในระดับ Lunatic', 'es. lo schermo si blocca quando tocco Suggerimento in Folle', 'مثال: تتجمد الشاشة عند الضغط على تلميح في وضع الجنون', 'לדוגמה: המסך קופא כשלוחצים על רמז ברמת מטורף'],
    contact: ['답변 받을 이메일 (선택)', 'Email for a reply (optional)', '返信用メール（任意）', '回复邮箱（可选）', '回覆用電子郵件（選填）', 'Correo para responderte (opcional)', 'E-mail pour une réponse (facultatif)', 'E-Mail für Antwort (optional)', 'E-mail para resposta (opcional)', 'Email для ответа (необязательно)', 'Email untuk balasan (opsional)', 'Yanıt için e-posta (isteğe bağlı)', 'Email để nhận phản hồi (không bắt buộc)', 'อีเมลสำหรับตอบกลับ (ไม่บังคับ)', 'Email per una risposta (facoltativa)', 'البريد الإلكتروني للرد (اختياري)', 'אימייל לתשובה (רשות)'],
    diag: ['진단 정보 함께 보내기 (버전·기기·최근 오류)', 'Include diagnostics (version, device, recent errors)', '診断情報を送信（バージョン・端末・最近のエラー）', '附带诊断信息（版本、设备、最近错误）', '附帶診斷資訊（版本、裝置、最近錯誤）', 'Incluir diagnóstico (versión, dispositivo, errores recientes)', 'Joindre le diagnostic (version, appareil, erreurs récentes)', 'Diagnosedaten anhängen (Version, Gerät, letzte Fehler)', 'Incluir diagnóstico (versão, aparelho, erros recentes)', 'Приложить диагностику (версия, устройство, последние ошибки)', 'Sertakan diagnostik (versi, perangkat, error terbaru)', 'Tanılama ekle (sürüm, cihaz, son hatalar)', 'Kèm thông tin chẩn đoán (phiên bản, thiết bị, lỗi gần đây)', 'แนบข้อมูลวินิจฉัย (เวอร์ชัน อุปกรณ์ ข้อผิดพลาดล่าสุด)', 'Includi diagnostica (versione, dispositivo, errori recenti)', 'إرفاق معلومات التشخيص (الإصدار، الجهاز، الأخطاء الأخيرة)', 'צירוף מידע אבחון (גרסה, מכשיר, שגיאות אחרונות)'],
    auto: ['앱 오류를 자동으로 익명 보고', 'Automatically report app errors anonymously', 'アプリのエラーを匿名で自動報告', '自动匿名报告应用错误', '自動匿名回報應用程式錯誤', 'Informar errores de la app automáticamente y de forma anónima', 'Signaler automatiquement et anonymement les erreurs', 'App-Fehler automatisch anonym melden', 'Relatar erros do app automaticamente e anonimamente', 'Автоматически и анонимно сообщать об ошибках', 'Laporkan error aplikasi secara otomatis dan anonim', 'Uygulama hatalarını otomatik ve anonim bildir', 'Tự động báo lỗi ứng dụng ẩn danh', 'รายงานข้อผิดพลาดของแอปโดยอัตโนมัติแบบไม่ระบุตัวตน', 'Segnala automaticamente gli errori in forma anonima', 'الإبلاغ تلقائيًا عن أخطاء التطبيق دون الكشف عن الهوية', 'דיווח אוטומטי ואנונימי על שגיאות'],
    cancel: ['취소', 'Cancel', 'キャンセル', '取消', '取消', 'Cancelar', 'Annuler', 'Abbrechen', 'Cancelar', 'Отмена', 'Batal', 'İptal', 'Hủy', 'ยกเลิก', 'Annulla', 'إلغاء', 'ביטול'],
    send: ['보내기', 'Send', '送信', '发送', '傳送', 'Enviar', 'Envoyer', 'Senden', 'Enviar', 'Отправить', 'Kirim', 'Gönder', 'Gửi', 'ส่ง', 'Invia', 'إرسال', 'שליחה'],
    empty: ['내용을 입력해 주세요.', 'Please describe the problem.', '内容を入力してください。', '请填写内容。', '請填寫內容。', 'Describe el problema.', 'Décrivez le problème.', 'Bitte beschreibe das Problem.', 'Descreva o problema.', 'Опишите проблему.', 'Jelaskan masalahnya.', 'Lütfen sorunu açıklayın.', 'Vui lòng mô tả vấn đề.', 'โปรดอธิบายปัญหา', 'Descrivi il problema.', 'يرجى وصف المشكلة.', 'נא לתאר את הבעיה.'],
    thanks: ['신고해 주셔서 감사합니다. 확인 후 고칠게요.', 'Thanks for the report! We’ll look into it.', '報告ありがとうございます。確認して修正します。', '感谢反馈！我们会尽快处理。', '感謝回報！我們會盡快處理。', '¡Gracias por el aviso! Lo revisaremos.', 'Merci pour le signalement ! Nous allons regarder.', 'Danke für die Meldung! Wir sehen uns das an.', 'Obrigado pelo relato! Vamos verificar.', 'Спасибо за сообщение! Мы разберёмся.', 'Terima kasih atas laporannya! Kami akan memeriksanya.', 'Bildiriminiz için teşekkürler! İnceleyeceğiz.', 'Cảm ơn bạn đã báo lỗi! Chúng tôi sẽ kiểm tra.', 'ขอบคุณสำหรับการรายงาน! เราจะตรวจสอบ', 'Grazie per la segnalazione! La esamineremo.', 'شكرًا على البلاغ! سنتحقق منه.', 'תודה על הדיווח! נבדוק את זה.'],
    fail: ['보내지 못했습니다. 인터넷 연결을 확인해 주세요.', 'Could not send. Check your internet connection.', '送信できませんでした。インターネット接続を確認してください。', '发送失败，请检查网络连接。', '傳送失敗，請檢查網路連線。', 'No se pudo enviar. Revisa tu conexión.', 'Envoi impossible. Vérifiez votre connexion.', 'Senden fehlgeschlagen. Prüfe deine Verbindung.', 'Não foi possível enviar. Verifique sua conexão.', 'Не удалось отправить. Проверьте подключение.', 'Gagal mengirim. Periksa koneksi internet.', 'Gönderilemedi. İnternet bağlantınızı kontrol edin.', 'Không gửi được. Hãy kiểm tra kết nối mạng.', 'ส่งไม่สำเร็จ โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', 'Invio non riuscito. Controlla la connessione.', 'تعذّر الإرسال. تحقق من اتصال الإنترنت.', 'השליחה נכשלה. בדקו את החיבור לאינטרנט.'],
    rate: ['오늘은 더 보낼 수 없습니다. 내일 다시 시도해 주세요.', 'Daily limit reached. Please try again tomorrow.', '本日の上限に達しました。明日もう一度お試しください。', '今日已达上限，请明天再试。', '今日已達上限，請明天再試。', 'Límite diario alcanzado. Inténtalo mañana.', 'Limite quotidienne atteinte. Réessayez demain.', 'Tageslimit erreicht. Bitte morgen erneut versuchen.', 'Limite diário atingido. Tente amanhã.', 'Дневной лимит исчерпан. Попробуйте завтра.', 'Batas harian tercapai. Coba lagi besok.', 'Günlük sınıra ulaşıldı. Yarın tekrar deneyin.', 'Đã đạt giới hạn hôm nay. Hãy thử lại vào ngày mai.', 'ถึงขีดจำกัดรายวันแล้ว โปรดลองใหม่พรุ่งนี้', 'Limite giornaliero raggiunto. Riprova domani.', 'تم بلوغ الحد اليومي. حاول مرة أخرى غدًا.', 'הגעתם למגבלה היומית. נסו שוב מחר.']
  };
  const t = k => { const row = S[k]; if (!row) return k; const i = LANGS.indexOf(lang()); return row[i >= 0 ? i : 1] || row[1]; };

  /* ---------------- 최근 오류 수집 ---------------- */
  const recent = (() => { try { return JSON.parse(localStorage.getItem(ERR_KEY)) || []; } catch (_) { return []; } })();
  const sentSigs = new Set(); let sentCount = 0;
  const autoOn = () => { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch (_) { return true; } };
  function remember(msg, stack, src) {
    const e = { at: Date.now(), msg: String(msg || '').slice(0, 300), stack: String(stack || '').slice(0, 900), src: String(src || '').slice(0, 120), view: window.app?.currentView || '', ver: ver() };
    recent.push(e); while (recent.length > 8) recent.shift();
    try { localStorage.setItem(ERR_KEY, JSON.stringify(recent)); } catch (_) {}
    autoSend(e);
  }
  function autoSend(e) {
    if (!autoOn() || sentCount >= 5 || !navigator.onLine) return;
    // 확장 프로그램·광고 SDK 등 앱 밖의 스크립트에서 난 오류, 의미 없는 'Script error.' 는 보내지 않습니다.
    if (/^Script error\.?$/i.test(e.msg) || (e.src && !/^(file|https?:\/\/appassets|https?:\/\/localhost)|\.js/.test(e.src))) return;
    const sig = (e.msg + '|' + (e.stack.split('\n')[1] || e.src)).replace(/\d+:\d+/g, '').slice(0, 200);
    if (sentSigs.has(sig)) return; sentSigs.add(sig); sentCount++;
    post({ kind: 'error', sig, text: e.msg, diag: diagnostics(true, e), where: e.view }).catch(() => {});
  }
  window.addEventListener('error', ev => { if (ev && ev.message) remember(ev.message, ev.error && ev.error.stack, (ev.filename || '') + ':' + (ev.lineno || 0)); });
  window.addEventListener('unhandledrejection', ev => { const r = ev && ev.reason; remember('Unhandled: ' + (r && (r.message || r)) , r && r.stack, ''); });
  window.SumdokuBugLog = (msg, stack) => remember(msg, stack, 'manual');

  /* ---------------- 진단 정보 ---------------- */
  function diagnostics(full, only) {
    const a = window.app || {};
    const d = {
      ver: ver(), dist: dist(), lang: lang(), ua: navigator.userAgent.slice(0, 200),
      screen: `${innerWidth}x${innerHeight}@${devicePixelRatio}`, dir: document.documentElement.dir || 'ltr',
      view: a.currentView || '', diff: a.difficulty || '', mode: a.gameMode || '', battle: !!a.isBattle,
      paused: !!a.isPaused, time: a.timerSeconds, mistakes: a.mistakes, online: navigator.onLine,
      theme: (document.getElementById('app') || {}).className || ''
    };
    if (full) d.errors = only ? [only] : recent.slice(-8);
    try { return JSON.stringify(d, null, 1); } catch (_) { return ''; }
  }
  const device = () => { try { return bridge()?.getDeviceModel?.() || (navigator.userAgentData?.platform || '') + ' ' + ((navigator.userAgent.match(/Android [\d.]+; ([^;)]+)/) || [])[1] || ''); } catch (_) { return ''; } };
  async function post(body) {
    const r = await fetch(BASE + '/bug/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: lang(), ver: ver(), dist: dist(), device: device().trim(), ...body }) });
    return r.json();
  }

  /* ---------------- 신고 창 ---------------- */
  function open(preset) {
    document.getElementById('sd-bug-report')?.remove();
    const m = document.createElement('div'); m.id = 'sd-bug-report'; m.className = 'modal-backdrop sd-bug-backdrop';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.dataset.userContent = '';
    m.innerHTML = `<div class="modal-card sd-bug-card">
      <h3 class="sd-bug-title"></h3><p class="sd-bug-desc"></p>
      <label class="sd-bug-l sd-bug-lk"></label>
      <div class="sd-bug-kinds" role="radiogroup"></div>
      <label class="sd-bug-l sd-bug-lt" for="sd-bug-text"></label>
      <textarea id="sd-bug-text" class="sd-bug-text" rows="4" maxlength="2000"></textarea>
      <input id="sd-bug-contact" class="sd-bug-contact" type="email" maxlength="120" autocomplete="email">
      <label class="sd-bug-check"><input type="checkbox" class="sd-bug-diag" checked><span></span></label>
      <label class="sd-bug-check"><input type="checkbox" class="sd-bug-auto"><span></span></label>
      <div class="sd-bug-actions"><button type="button" class="btn btn-secondary sd-bug-cancel"></button><button type="button" class="btn btn-primary sd-bug-send"></button></div>
    </div>`;
    (document.getElementById('app') || document.body).append(m);
    const q = s => m.querySelector(s);
    let kind = preset || (window.app?.currentView === 'game' ? 'bug' : 'bug');
    q('.sd-bug-title').textContent = '🐞 ' + t('btn');
    q('.sd-bug-desc').textContent = t('desc');
    q('.sd-bug-lk').textContent = t('kind');
    q('.sd-bug-lt').textContent = t('what');
    q('.sd-bug-text').placeholder = t('ph');
    q('.sd-bug-contact').placeholder = t('contact');
    q('.sd-bug-diag + span').textContent = t('diag');
    q('.sd-bug-auto + span').textContent = t('auto');
    q('.sd-bug-auto').checked = autoOn();
    q('.sd-bug-auto').onchange = e => { try { localStorage.setItem(AUTO_KEY, e.target.checked ? '1' : '0'); } catch (_) {} };
    q('.sd-bug-cancel').textContent = t('cancel');
    q('.sd-bug-send').textContent = t('send');
    const kinds = q('.sd-bug-kinds');
    ['bug', 'ui', 'crash', 'translation', 'idea'].forEach(k => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sd-bug-kind'; b.dataset.k = k;
      b.setAttribute('role', 'radio'); b.textContent = t('k_' + k);
      b.onclick = () => { kind = k; sync(); };
      kinds.append(b);
    });
    const sync = () => kinds.querySelectorAll('.sd-bug-kind').forEach(b => { const on = b.dataset.k === kind; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    sync();
    const close = () => { m.remove(); };
    m.addEventListener('click', e => { if (e.target === m) close(); });
    q('.sd-bug-cancel').onclick = close;
    q('.sd-bug-send').onclick = async () => {
      const text = q('.sd-bug-text').value.trim();
      if (!text) { window.app?.showToast?.(t('empty')); q('.sd-bug-text').focus(); return; }
      const btn = q('.sd-bug-send'); btn.disabled = true;
      let res = null;
      try { res = await post({ kind, text, contact: q('.sd-bug-contact').value.trim(), where: window.app?.currentView || '', diag: q('.sd-bug-diag').checked ? diagnostics(true) : diagnostics(false) }); } catch (_) {}
      btn.disabled = false;
      if (res && res.ok) { window.app?.showToast?.(t('thanks')); close(); }
      else window.app?.showToast?.(res && res.error === 'rate' ? t('rate') : t('fail'));
    };
    m.classList.remove('hidden'); m.style.display = 'flex';
    setTimeout(() => q('.sd-bug-text').focus(), 60);
  }

  /* ---------------- 버튼 배치 ---------------- */
  function makeBtn(id, cls) {
    const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'btn btn-secondary sd-bug-open ' + (cls || '');
    const label = document.createElement('span'); label.className = 'sd-bug-open-label'; label.textContent = '🐞 ' + t('btn'); b.append(label);
    b.dataset.userContent = '';
    b.onclick = () => { try { window.app?.sound?.play?.('click'); } catch (_) {} open(); };
    return b;
  }
  function mount() {
    // 1) 설정 › 언어 아래: [번역 오류 신고] 와 나란히
    if (!document.getElementById('btn-bug-report')) {
      const tr = document.getElementById('btn-tr-report');
      const sel = document.getElementById('setting-language');
      const anchor = tr || (sel && (sel.closest('.settings-item') || sel.parentElement));
      if (anchor) {
        const wrap = document.createElement('div'); wrap.className = 'sd-report-row';
        anchor.insertAdjacentElement('afterend', wrap);
        if (tr) wrap.append(tr);
        wrap.append(makeBtn('btn-bug-report'));
      }
    }
    // 2) 게임 중 설정 창: 하단 버튼 위
    if (!document.getElementById('btn-bug-report-game')) {
      const foot = document.querySelector('#modal-settings .modal-footer');
      if (foot) { const b = makeBtn('btn-bug-report-game', 'sd-bug-open-game'); foot.parentElement.insertBefore(b, foot); }
    }
    // 언어가 바뀌면 버튼 문구 갱신
    document.querySelectorAll('.sd-bug-open-label').forEach(l => { l.textContent = '🐞 ' + t('btn'); });
  }
  function boot() {
    mount();
    // 설정 화면이 다시 그려지거나 개발자 패널이 나중에 생겨도 버튼을 유지합니다.
    let pend = false;
    new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; if (!document.getElementById('btn-bug-report') || !document.getElementById('btn-bug-report-game')) mount(); }); })
      .observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    new MutationObserver(mount).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  // Android 뒤로 가기: 신고 창·신고함이 열려 있으면 먼저 닫습니다.
  if (typeof SumdokuApp !== 'undefined') {
    const P = SumdokuApp.prototype, back = P.handleBackKey;
    P.handleBackKey = function () {
      const m = document.getElementById('sd-bug-report');
      if (m) { m.remove(); return 'handled'; }
      return back ? back.apply(this, arguments) : false;
    };
  }
  window.SumdokuBugReport = { open };
})();
