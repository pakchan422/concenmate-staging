// ========================================================================
// 🌐 多語言切換（i18n）—— 第一階段：底層架構
// ========================================================================
// 呢份 Alvis 想要嘅功能分咗三個階段做（已經同 Alvis 傾好）：
//   第一階段（呢份檔案）：起好成套切換機制——字典、語言掣、記憶設定，
//                          淨係將側邊選單／header 呢類常用、少字嘅位
//                          示範性咁轉咗做用字典查字，其餘成個網站絕
//                          大部分文字暫時都仲係寫死喺 index.html／
//                          app-core.js／app-features.js／
//                          admin-panel.js／room-video.js／
//                          tutor-panel.js 入面，跟返而家嘅做法一律顯示
//                          繁體中文書面語——呢個係預期之內，日後每次
//                          有空就逐段搬多啲入嚟呢個字典，個網站識講嘅
//                          語言就會逐步變多，唔使一次過搬晒先可以用。
//   第二階段：English——會譯，交返 Alvis 睇一次啱唔啱用詞。
//   第三階段：廣東話口語（唔係現時嘅書面語）——由 Claude 起草，交 Alvis
//             把關先出街，因為呢個涉及語氣同用字判斷，唔淨係翻譯咁簡單。
//
// 用法（日後想將某段文字都納入呢一套切換機制，跟住做）：
//   1. 喺低下 I18N_DICT 度加一組新 key，例如：
//        'home.welcome': { 'zh-Hant': '你好，同學！', 'en': 'Hello!', 'yue': '' }
//      （'yue' 未有內容嘅話留空字串就得，t() 會自動退返用 'zh-Hant'。）
//   2. 兩種寫法揀一種：
//        a) 靜態文字（HTML 入面寫死嘅一句）：加 data-i18n="home.welcome"
//           屬性落個元素度，例如 <h2 data-i18n="home.welcome">你好，同學！</h2>
//           —— 屬性入面照舊留返現有嘅中文，等字典入面漏咗個 key 都唔會
//           開天窗，套語言切換嗰陣 applyAppLanguage() 會自動幫呢啲元素
//           換返啱嘅語言。
//        b) JS 入面組出嚟嘅文字（例如 template literal）：改用
//           window.t('home.welcome', '你好，同學！') 嚟攞，第二個參數
//           係「字典漏咗呢個 key 都好、都唔會開天窗」嘅保底文字。
//        c) <input placeholder="..."> 呢類位置（唔算 textContent）：
//           改加 data-i18n-placeholder="xxx" 屬性（唔係 data-i18n）。
//
// 呢個檔案要喺 app-features.js／app-core.js 之前載入（見 index.html
// 嘅 <script> 次序），等呢兩個檔案入面用到 window.t／
// window.applyAppLanguage 嗰陣，呢啲 function 已經存在。
(function () {
  window.SUPPORTED_LANGUAGES = ['zh-Hant', 'en', 'yue'];
  window.LANGUAGE_LABELS = { 'zh-Hant': '繁體中文', 'en': 'English', 'yue': '廣東話' };

  // ── 翻譯字典（第一階段：淨係示範性咁做咗側邊選單／語言掣本身呢
  //    幾組，其餘留返第二／三階段陸續加）──
  window.I18N_DICT = {
    'nav.home': { 'zh-Hant': '主頁', 'en': 'Home', 'yue': '' },
    'nav.room': { 'zh-Hant': '視訊溫習室', 'en': 'Video Study Room', 'yue': '' },
    'nav.qa': { 'zh-Hant': '疑難解答區', 'en': 'Q&A', 'yue': '' },
    'nav.vip': { 'zh-Hant': '溫習資源', 'en': 'Study Resources', 'yue': '' },
    'nav.store': { 'zh-Hant': '時數扭蛋機', 'en': 'Gashapon', 'yue': '' },
    'nav.leaderboard': { 'zh-Hant': '溫習排行榜', 'en': 'Leaderboard', 'yue': '' },
    'nav.social': { 'zh-Hant': '書伴廣場', 'en': 'Study Buddy Plaza', 'yue': '' },
    'nav.diary': { 'zh-Hant': '溫習日記', 'en': 'Study Diary', 'yue': '' },
    'nav.verification': { 'zh-Hant': '學生身份驗證', 'en': 'Student Verification', 'yue': '' },
    'nav.tutorMaterials': { 'zh-Hant': '管理教材', 'en': 'Manage Materials', 'yue': '' },
    'lang.switcher.title': { 'zh-Hant': '選擇語言', 'en': 'Choose Language', 'yue': '' },

    // ── 通用字眼（好多分頁都會用到，一次搬好，之後其他分頁轉換嗰陣
    //    可以直接重用返呢批 key，唔使逐頁重複做） ──
    'common.cancel': { 'zh-Hant': '取消', 'en': 'Cancel', 'yue': '取消' },
    'common.save': { 'zh-Hant': '儲存', 'en': 'Save', 'yue': '儲存' },
    'unit.minutes': { 'zh-Hant': '分鐘', 'en': ' min', 'yue': '分鐘' },
    'unit.hours': { 'zh-Hant': '小時', 'en': 'h ', 'yue': '小時' },
    'unit.goalDone': { 'zh-Hant': '（已完成）', 'en': ' (Done)', 'yue': '（已完成）' },

    // ── 主頁（第二／三階段：English 由 Claude 翻譯、廣東話口語由
    //    Claude 起草，兩者都仲要 Alvis 過目先算數，未過目之前先當
    //    草稿睇待） ──
    'home.greeting': { 'zh-Hant': '你好，', 'en': 'Hi, ', 'yue': '你好啊，' },
    'home.readyToStudy': { 'zh-Hant': '今日準備好溫習了嗎？', 'en': 'Ready to study today?', 'yue': '今日準備好未？可以開始溫書喇！' },
    'home.statHours': { 'zh-Hant': '本日時數', 'en': "Today's Time", 'yue': '今日溫咗幾耐' },
    'home.statPoints': { 'zh-Hant': '積分', 'en': 'Points', 'yue': '積分' },
    'home.statMaterials': { 'zh-Hant': '已上架教材', 'en': 'Materials Published', 'yue': '已上架教材' },
    'home.statStreak': { 'zh-Hant': '連續天', 'en': 'Day Streak', 'yue': '連續天數' },
    'home.statFollowers': { 'zh-Hant': '粉絲', 'en': 'Followers', 'yue': '粉絲' },
    'home.statFollowing': { 'zh-Hant': '追蹤中', 'en': 'Following', 'yue': '追蹤中' },
    'home.otterRenameTitle': { 'zh-Hant': '自訂我的水獺', 'en': 'Customize My Otter', 'yue': '自己整靚隻水獺' },
    'home.otterRenamePlaceholder': { 'zh-Hant': '輸入新名稱（最多 12 個字）', 'en': 'Enter a new name (up to 12 characters)', 'yue': '打個新名（最多12個字）' },
    'home.otterAvatarLabel': { 'zh-Hant': '頭像（可選擇已收集的貼紙）', 'en': 'Avatar (choose from collected stickers)', 'yue': '頭像（可以揀已經儲到嘅貼紙）' },
    'otter.stat.level': { 'zh-Hant': '等級', 'en': 'Level', 'yue': '等級' },
    'otter.stat.expRemaining': { 'zh-Hant': '升級所需 EXP', 'en': 'EXP to Level Up', 'yue': '升級所需 EXP' },
    'otter.stat.hours': { 'zh-Hant': '已累計時數', 'en': 'Total Hours', 'yue': '已累計時數' },
    'otter.stat.streak': { 'zh-Hant': '連續天數', 'en': 'Day Streak', 'yue': '連續天數' },
    'otter.stat.stickers': { 'zh-Hant': '圖鑑完成度', 'en': 'Sticker Collection', 'yue': '貼紙完成度' },
    'home.primaryDesc': { 'zh-Hant': '與同學一起開鏡頭專注溫習賺積分', 'en': 'Study together on camera with classmates and earn points', 'yue': '同同學一齊開鏡頭專心溫書賺積分' },
    'home.joinNow': { 'zh-Hant': '立即加入', 'en': 'Join Now', 'yue': '即刻加入' },
    'home.todayGoal': { 'zh-Hant': '今日目標', 'en': "Today's Goal", 'yue': '今日目標' },
    'home.studyCalendar': { 'zh-Hant': '溫習日曆', 'en': 'Study Calendar', 'yue': '溫書日曆' },
    // {n} 係佔位符，實際數字由 renderStudyCalendar()（app-features.js）
    // 用 String.replace('{n}', ...) 塞入去；廣東話「總共」要擺喺數字
    // 前面（同繁體中文／English 慣常擺後面唔同），所以呢兩句改用完整
    // 樣板，唔再淨係換一個固定字尾。
    'home.streakTemplate': { 'zh-Hant': '{n} 連續', 'en': '{n} day streak', 'yue': '{n} 日連續' },
    'home.totalDaysTemplate': { 'zh-Hant': '{n} 總日數', 'en': '{n} total days', 'yue': '總共 {n} 日' },
  };

  // 目前語言：已登入用戶存喺 users/{uid} 文件嘅 language 欄位（跨裝置
  // 都記得，Alvis 揀咗呢個做法）；未登入（或者仲未讀到 currentUser）
  // 就暫時退而求其次用返 localStorage，等未登入嗰陣個介面都有得跟返
  // 個人揀開嗰種語言，登入之後就會覆蓋做帳戶入面存嗰個設定。
  window.getAppLanguage = function () {
    if (window.currentUser && window.currentUser.language && window.SUPPORTED_LANGUAGES.indexOf(window.currentUser.language) !== -1) {
      return window.currentUser.language;
    }
    try {
      const saved = localStorage.getItem('concenmate_lang');
      if (saved && window.SUPPORTED_LANGUAGES.indexOf(saved) !== -1) return saved;
    } catch (e) { /* 私隱模式等場合讀唔到 localStorage，忽略 */ }
    return 'zh-Hant';
  };

  // key 查字典；查唔到（呢個階段絕大部分字都仲未搬入字典）就用返
  // fallbackText（通常即係嗰句原本寫死嘅中文），保證未轉換嘅文字唔會
  // 開天窗、都仲係見到返正常嘅中文，唔會因為切換語言而destroy咗成個
  // 介面。
  window.t = function (key, fallbackText) {
    const lang = window.getAppLanguage();
    const entry = window.I18N_DICT[key];
    if (entry && entry[lang]) return entry[lang];
    if (entry && entry['zh-Hant']) return entry['zh-Hant'];
    return fallbackText !== undefined ? fallbackText : key;
  };

  // 切換語言：存落 localStorage（即時、唔使等網絡）＋（已登入嘅話）
  // 寫返落 Firestore 用戶文件，等第日換裝置/換瀏覽器登入都跟返。
  window.setAppLanguage = async function (lang) {
    if (window.SUPPORTED_LANGUAGES.indexOf(lang) === -1) return;
    try { localStorage.setItem('concenmate_lang', lang); } catch (e) { /* 忽略 */ }
    if (window.currentUser && window.db && window.fs) {
      try {
        await window.fs.updateDoc(window.fs.doc(window.db, 'users', window.currentUser.uid), { language: lang });
        window.currentUser.language = lang;
      } catch (e) {
        console.error('儲存語言設定失敗:', e);
      }
    }
    window.applyAppLanguage();
    // applyAppLanguage() 淨係換得到帶 data-i18n 屬性嘅靜態文字；「本日
    // 時數」「今日目標」「水獺數據卡」呢幾個位嘅單位／文字係由 JS
    // 組出嚟先塞落去（formatHoursMinutes／updateGoalBarDisplay 等），
    // 要主動叫返呢幾個 function 重新畫一次，換完語言先即刻見到返呢
    // 幾個位一齊跟住變，唔使等到下次有數據變動先自然更新。
    if (typeof window.updateUserAuthUI === 'function') window.updateUserAuthUI();
    if (typeof window.updateGoalBarDisplay === 'function') window.updateGoalBarDisplay();
    if (typeof window.updateOtterStatsCard === 'function') window.updateOtterStatsCard();
    if (typeof window.renderStudyCalendar === 'function') window.renderStudyCalendar();
    if (typeof window.closeModal === 'function') {
      window.closeModal('modal-language-switcher');
    } else {
      const modalEl = document.getElementById('modal-language-switcher');
      if (modalEl) modalEl.style.display = 'none';
    }
  };

  // 將目前語言套用去所有帶 data-i18n 屬性嘅元素度（見上面用法 a）），
  // 喺登入狀態改變／揀完新語言之後都要叫一次。
  window.applyAppLanguage = function () {
    const lang = window.getAppLanguage();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = window.t(key, el.textContent);
    });
    // data-i18n-placeholder：用喺 <input placeholder="...">呢類位置——
    // placeholder 唔算 textContent，要獨立處理先換得到。
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', window.t(key, el.getAttribute('placeholder')));
    });
    document.querySelectorAll('.lang-option-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    const currentLabelEl = document.getElementById('current-lang-label');
    if (currentLabelEl) currentLabelEl.textContent = window.LANGUAGE_LABELS[lang] || '繁體中文';
  };

  // 一開波（未必已登入）都套用一次，等未登入嗰陣如果之前揀過語言，
  // 都即刻見到返（現時得返側邊選單呢批做咗，所以效果暫時有限，日後
  // 字典加多字，呢句已經寫定好，唔使再改）。
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.applyAppLanguage === 'function') window.applyAppLanguage();
  });
})();
