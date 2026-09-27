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
