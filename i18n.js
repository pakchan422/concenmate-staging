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
    'common.close': { 'zh-Hant': '關閉', 'en': 'Close', 'yue': '閂返' },
    'common.loginFirst': { 'zh-Hant': '請先登入', 'en': 'Please log in first', 'yue': '要登入先得㗎' },
    'common.deleteFailed': { 'zh-Hant': '刪除失敗', 'en': 'Delete failed', 'yue': '刪除唔到' },
    'common.saveFailed': { 'zh-Hant': '儲存失敗', 'en': 'Save failed', 'yue': '儲存唔到' },
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

    // ── 視訊溫習室（第三階段：English 由 Claude 翻譯、廣東話口語由
    //    Claude 起草，兩者都仲要 Alvis 過目先算數，未過目之前先當
    //    草稿睇待）。呢個分頁淨係轉咗頁面本身嘅固定文字／狀態標籤，
    //    邀請朋友／建立房間／舉報等彈出視窗仲未轉，留返下一階段。 ──
    'room.lobbyTitle': { 'zh-Hant': '公開溫習大廳', 'en': 'Public Study Lobby', 'yue': '公開溫習大廳' },
    'room.togglePool': { 'zh-Hant': '轉換溫習室', 'en': 'Switch Room Pool', 'yue': '轉換溫習室' },
    'room.createRoom': { 'zh-Hant': '+ 建立新溫習房', 'en': '+ Create New Room', 'yue': '+ 開間新溫習房' },
    'room.filterAll': { 'zh-Hant': '全部', 'en': 'All', 'yue': '全部' },
    'room.filterCore': { 'zh-Hant': '必修科目', 'en': 'Core Subjects', 'yue': '必修科目' },
    'room.filterElective': { 'zh-Hant': '選修科目', 'en': 'Elective Subjects', 'yue': '選修科目' },
    'room.filterOther': { 'zh-Hant': '其他', 'en': 'Other', 'yue': '其他' },
    'room.loadingRooms': { 'zh-Hant': '正在透過 Firebase 加載公開溫習房列表...', 'en': 'Loading public study rooms via Firebase...', 'yue': '正在透過 Firebase Load緊公開溫習房資料...' },
    'room.cameraOn': { 'zh-Hant': '開啟鏡頭', 'en': 'Turn On Camera', 'yue': '開鏡頭' },
    'room.cameraOff': { 'zh-Hant': '關閉鏡頭', 'en': 'Turn Off Camera', 'yue': '閂鏡頭' },
    'room.cameraStarting': { 'zh-Hant': '⏳ 鏡頭啟動中...', 'en': '⏳ Starting Camera...', 'yue': '⏳ 開緊鏡頭...' },
    'room.micMuted': { 'zh-Hant': '已靜音', 'en': 'Muted', 'yue': '已靜音' },
    'room.bgNoise': { 'zh-Hant': '背景音', 'en': 'Ambient Sound', 'yue': '背景音' },
    'room.bgNoiseOff': { 'zh-Hant': '背景音：關閉', 'en': 'Ambient Sound: Off', 'yue': '背景音：關閉' },
    'room.whiteNoise': { 'zh-Hant': '白噪音', 'en': 'White Noise', 'yue': '白噪音' },
    'room.rain1': { 'zh-Hant': '雨聲 1', 'en': 'Rain 1', 'yue': '落雨聲 1' },
    'room.rain2': { 'zh-Hant': '雨聲 2', 'en': 'Rain 2', 'yue': '落雨聲 2' },
    'room.cafe1': { 'zh-Hant': '咖啡室環境聲 1', 'en': 'Cafe Ambience 1', 'yue': '咖啡室環境聲 1' },
    'room.cafe2': { 'zh-Hant': '咖啡室環境聲 2', 'en': 'Cafe Ambience 2', 'yue': '咖啡室環境聲 2' },
    'room.train1': { 'zh-Hant': '火車聲 1', 'en': 'Train 1', 'yue': '火車聲 1' },
    'room.train2': { 'zh-Hant': '火車聲 2', 'en': 'Train 2', 'yue': '火車聲 2' },
    'room.fullscreen': { 'zh-Hant': '全螢幕', 'en': 'Fullscreen', 'yue': '全螢幕' },
    'room.exitFullscreen': { 'zh-Hant': '退出全螢幕', 'en': 'Exit Fullscreen', 'yue': '退出全螢幕' },
    'room.leaveRoom': { 'zh-Hant': '退出房間', 'en': 'Leave Room', 'yue': '離開房間' },
    'room.studiedTime': { 'zh-Hant': '已溫習', 'en': 'Studied', 'yue': '溫咗' },
    'room.readyMsg': { 'zh-Hant': '溫習房已就緒！', 'en': 'Study room ready!', 'yue': '房間準備好喇！' },
    'room.clickToJoin': { 'zh-Hant': '請點擊上方「開啟鏡頭」加入 P2P 視訊互聯', 'en': 'Click "Turn On Camera" above to join the video call', 'yue': '撳返上面個「開鏡頭」，就可以加入視訊喇' },
    'room.hostFocusing': { 'zh-Hant': '房主專注中', 'en': 'Host Focusing', 'yue': '房主專注中' },
    'room.youAreHost': { 'zh-Hant': '你是房主', 'en': "You're the Host", 'yue': '你係房主' },
    'room.cameraLive': { 'zh-Hant': '鏡頭即時串流中', 'en': 'Camera Streaming Live', 'yue': '鏡頭直播緊' },
    'room.micOn': { 'zh-Hant': '已開啟麥克風', 'en': 'Microphone On', 'yue': '咪開咗' },
    'room.emojiReaction': { 'zh-Hant': '表情反應', 'en': 'Reactions', 'yue': '表情反應' },
    'room.waitingUser': { 'zh-Hant': '等待用家加入...', 'en': 'Waiting for someone to join...', 'yue': '等緊人加入...' },
    'room.inviteFriend': { 'zh-Hant': '邀請朋友', 'en': 'Invite Friend', 'yue': '叫朋友嚟' },
    'room.remoteWaitStream': { 'zh-Hant': '連線中...', 'en': 'Connecting...', 'yue': '連緊線...' },
    'room.remoteLiveStream': { 'zh-Hant': '即時串流', 'en': 'Live', 'yue': '直播緊' },
    'room.remoteCameraOff': { 'zh-Hant': '對方鏡頭已關閉', 'en': "Their camera is off", 'yue': '對方閂咗鏡頭' },
    'room.otherUser': { 'zh-Hant': '其他用家', 'en': 'Other User', 'yue': '其他用家' },
    'room.hostBadge': { 'zh-Hant': '房主', 'en': 'Host', 'yue': '房主' },
    'room.viewProfile': { 'zh-Hant': '點擊查看資料／加好友', 'en': 'Click to view profile / add friend', 'yue': '撳吓睇資料／加好友' },
    'room.moreOptions': { 'zh-Hant': '更多選項', 'en': 'More Options', 'yue': '更多選項' },
    'room.transferHost': { 'zh-Hant': '轉移房主給他', 'en': 'Transfer Host To Them', 'yue': '轉個房主俾佢' },
    'room.kickUser': { 'zh-Hant': '踢走呢位同學', 'en': 'Remove This Student', 'yue': '踢走呢位同學' },
    'room.reportUser': { 'zh-Hant': '舉報呢位同學', 'en': 'Report This Student', 'yue': '舉報呢位同學' },
    // 咪掣／咪標籤嘅倒數狀態：{n} 係佔位符，實際倒數數字由
    // updateMicButtonUI()（room-video.js）用 String.replace('{n}', ...) 塞入去。
    'room.micCooldownBtn': { 'zh-Hant': '冷卻中 {n}', 'en': 'Cooling Down {n}', 'yue': '冷卻緊 {n}' },
    'room.micCooldownTag': { 'zh-Hant': '咪冷卻中 {n}', 'en': 'Mic Cooling Down {n}', 'yue': 'Mic 冷卻緊 {n}' },
    'room.micOnBtn': { 'zh-Hant': '已開咪{n}', 'en': 'Mic On{n}', 'yue': '開咗Mic{n}' },
    'room.micOnTag': { 'zh-Hant': '已開啟麥克風{n}', 'en': 'Microphone On{n}', 'yue': '開咗Mic{n}' },

    // ── 疑難解答區（第四階段：English 由 Claude 翻譯、廣東話口語由
    //    Claude 起草，兩者都仲要 Alvis 過目先算數，未過目之前先當
    //    草稿睇待）。分類 Tab（全部／必修科目／選修科目／其他）重用
    //    咗上面視訊溫習室嗰批 room.filter* key，因為兩邊文字一樣。 ──
    'qa.askQuestion': { 'zh-Hant': '發起提問', 'en': 'Ask a Question', 'yue': '問問題' },
    'qa.loading': { 'zh-Hant': '載入中…', 'en': 'Loading…', 'yue': 'Load緊…' },
    'qa.loadingComments': { 'zh-Hant': '載入留言中…', 'en': 'Loading comments…', 'yue': 'Load緊啲留言…' },
    'qa.subjectLabel': { 'zh-Hant': '學科 *', 'en': 'Subject *', 'yue': '科目 *' },
    'qa.titleLabel': { 'zh-Hant': '問題標題', 'en': 'Question Title', 'yue': '問題標題' },
    'qa.titlePlaceholder': { 'zh-Hant': '例：DSE 數學 2024 Paper 1 Q18 為什麼？', 'en': 'e.g. DSE Maths 2024 Paper 1 Q18, why?', 'yue': '例：DSE 數學 2024 Paper 1 Q18 唔識？' },
    'qa.descLabel': { 'zh-Hant': '詳細描述', 'en': 'Details', 'yue': '詳細講吓' },
    'qa.descPlaceholder': { 'zh-Hant': '描述你的問題，或補充更多資料…', 'en': 'Describe your question, or add more details…', 'yue': '講吓你嘅問題，或者補充多啲資料…' },
    'qa.uploadPhotoLabel': { 'zh-Hant': '上傳圖片（最多 3 張）', 'en': 'Upload Photos (up to 3)', 'yue': '上傳相片（最多3張）' },
    'qa.submitPost': { 'zh-Hant': '發布提問', 'en': 'Post Question', 'yue': '發布問題' },
    'qa.commentLabel': { 'zh-Hant': '留言回答', 'en': 'Your Answer', 'yue': '留言答佢' },
    'qa.commentPlaceholder': { 'zh-Hant': '分享你的解題方法…', 'en': 'Share how you would solve it…', 'yue': 'Share吓你點樣解…' },
    'qa.commentPhotoLabel': { 'zh-Hant': '附上圖片（最多 3 張）', 'en': 'Attach Photos (up to 3)', 'yue': '上傳啲相（最多3張）' },
    'qa.submitComment': { 'zh-Hant': '送出回答', 'en': 'Submit Answer', 'yue': '交低個答案' },
    'qa.noPosts': { 'zh-Hant': '這個學科暫時未有提問，你先來發起第一題！', 'en': 'No questions in this subject yet — be the first to ask!', 'yue': '呢科暫時未有人問，你嚟開頭一條啦！' },
    'qa.delete': { 'zh-Hant': '刪除', 'en': 'Delete', 'yue': '刪除' },
    'qa.edit': { 'zh-Hant': '編輯', 'en': 'Edit', 'yue': '編輯' },
    'qa.anonymous': { 'zh-Hant': '匿名', 'en': 'Anonymous', 'yue': '匿名' },
    'qa.anonymousStudent': { 'zh-Hant': '匿名同學', 'en': 'Anonymous Student', 'yue': '匿名同學' },
    // {n} 係佔位符，實際數字由 renderQAPostsList()（app-features.js）
    // 用 String.replace('{n}', ...) 塞入去。
    'qa.answersCountTemplate': { 'zh-Hant': '{n} 個回答', 'en': '{n} answers', 'yue': '{n} 個回答' },
    // {time} 係佔位符，實際時間字串由 formatTime() 塞入去。
    'qa.editedAtTemplate': { 'zh-Hant': '已編輯 {time}', 'en': 'Edited {time}', 'yue': '改過 {time}' },
    'qa.publishing': { 'zh-Hant': '⏳ 發布中…', 'en': '⏳ Posting…', 'yue': '⏳ 發布緊…' },
    'qa.sending': { 'zh-Hant': '⏳ 送出中…', 'en': '⏳ Sending…', 'yue': '⏳ 送緊出去…' },
    'qa.selectSubject': { 'zh-Hant': '請選擇學科', 'en': 'Please select a subject', 'yue': '要揀返學科先得㗎' },
    'qa.fillTitle': { 'zh-Hant': '請填寫問題標題', 'en': 'Please fill in the question title', 'yue': '要填返問題標題先得㗎' },
    'qa.postPublished': { 'zh-Hant': '提問已發布！', 'en': 'Question posted!', 'yue': '條問題發布左喇！' },
    // {msg} 係佔位符，塞入 e.message（攞唔到就用 qa.tryAgainLater 頂住）。
    'qa.publishFailedTemplate': { 'zh-Hant': '發布失敗：{msg}', 'en': 'Failed to post: {msg}', 'yue': '發布唔到：{msg}' },
    'qa.tryAgainLater': { 'zh-Hant': '請稍後再試', 'en': 'Please try again later', 'yue': '遲啲再試多次' },
    'qa.confirmDeletePost': { 'zh-Hant': '確定刪除這個提問嗎？', 'en': 'Delete this question?', 'yue': '真係要刪除呢條問題？' },
    'qa.postDeleted': { 'zh-Hant': '提問已刪除', 'en': 'Question deleted', 'yue': '條問題刪咗喇' },
    'qa.noAnswersYet': { 'zh-Hant': '未有回答，你是第一個！', 'en': 'No answers yet — be the first!', 'yue': '未有人答，你係第一個！' },
    'qa.fillAnswer': { 'zh-Hant': '請填寫回答內容', 'en': 'Please write your answer', 'yue': '要打返啲內容先得㗎' },
    'qa.answerSent': { 'zh-Hant': '回答已送出！', 'en': 'Answer submitted!', 'yue': '個答案送咗出去喇！' },
    'qa.sendFailed': { 'zh-Hant': '送出失敗，請稍後再試', 'en': 'Failed to send, please try again later', 'yue': '送唔到，遲啲再試多次' },
    'qa.confirmDeleteComment': { 'zh-Hant': '確定刪除這個留言？', 'en': 'Delete this comment?', 'yue': '真係要刪除呢個留言？' },
    'qa.commentDeleted': { 'zh-Hant': '留言已刪除', 'en': 'Comment deleted', 'yue': '留言刪咗喇' },
    'qa.emptyContent': { 'zh-Hant': '內容不可以是空白', 'en': 'Content cannot be empty', 'yue': '唔可以留空㗎' },
    'qa.commentUpdated': { 'zh-Hant': '留言已更新', 'en': 'Comment updated', 'yue': '留言改好喇' },
    // {cat} 係佔位符，塞入已經譯好嘅分類名（必修科目／選修科目）。
    'qa.allOfCategoryTemplate': { 'zh-Hant': '全部{cat}', 'en': 'All {cat}', 'yue': '全部{cat}' },

    // ── 溫習資源（第五階段：English 由 Claude 翻譯、廣東話口語由
    //    Claude 起草，兩者都仲要 Alvis 過目先算數，未過目之前先當
    //    草稿睇待）。包括導師名錄（tab-vip）同導師專頁（tab-tutor-view）
    //    呢兩個分頁——淨係學生瀏覽導師嘅呢一邊，導師自己嘅「管理教材」
    //    後台（tab-tutor-materials）未轉，留返下一階段。 ──
    'vip.heading': { 'zh-Hant': '溫習資源', 'en': 'Study Resources', 'yue': '溫習資源' },
    'vip.subheading': { 'zh-Hant': '瀏覽已上架的導師，點擊卡片可以查看資料並追蹤，接收最新消息', 'en': 'Browse listed tutors — tap a card to view their profile, follow them, and get updates', 'yue': '睇吓有邊啲導師，撳張卡可以睇資料同追蹤，第一時間收到最新消息' },
    'vip.loadingDirectory': { 'zh-Hant': '載入導師名錄中…', 'en': 'Loading tutor directory…', 'yue': 'Load緊導師名單…' },
    // {msg} 係佔位符，塞入錯誤訊息本身。
    'vip.loadDirectoryFailedTemplate': { 'zh-Hant': '載入導師名錄失敗：{msg}', 'en': 'Failed to load tutor directory: {msg}', 'yue': 'Load唔到導師名單：{msg}' },
    'vip.noTutorsForSubjectTemplate': { 'zh-Hant': '暫時未有教授「{subject}」的已上架導師', 'en': 'No listed tutors teaching "{subject}" yet', 'yue': '暫時未有導師教緊「{subject}」' },
    'vip.noTutorsYet': { 'zh-Hant': '目前尚未有已上架的導師', 'en': 'No listed tutors yet', 'yue': '而家仲未有已上架嘅導師' },
    'vip.viewLabel': { 'zh-Hant': '查看 ›', 'en': 'View ›', 'yue': '睇吓 ›' },
    'tutorview.backButton': { 'zh-Hant': '← 返回溫習資源', 'en': '← Back to Study Resources', 'yue': '← 返去溫習資源' },
    'tutorview.followers': { 'zh-Hant': '粉絲', 'en': 'Followers', 'yue': '粉絲' },
    'tutorview.materialsHeading': { 'zh-Hant': '已上架教材', 'en': 'Published Materials', 'yue': '已上架教材' },
    'tutorview.defaultName': { 'zh-Hant': '導師', 'en': 'Tutor', 'yue': '導師' },
    'tutorview.notFound': { 'zh-Hant': '找不到這位導師', 'en': 'Tutor not found', 'yue': '搵唔到呢位導師' },
    'tutorview.loadFailed': { 'zh-Hant': '載入失敗', 'en': 'Failed to load', 'yue': 'Load 唔到' },
    'tutorview.avatarAlt': { 'zh-Hant': '導師頭像', 'en': "Tutor's avatar", 'yue': '導師頭像' },
    'tutorview.noMaterialsYet': { 'zh-Hant': '這位導師暫時未有已上架的教材', 'en': 'This tutor has no published materials yet', 'yue': '呢位導師暫時未上架教材' },
    'tutorview.preview': { 'zh-Hant': '預覽', 'en': 'Preview', 'yue': '預覽' },
    'tutorview.buy': { 'zh-Hant': '購買', 'en': 'Buy', 'yue': '購買' },
    'tutorview.buyComingSoon': { 'zh-Hant': '購買功能仍在開發中，敬請期待', 'en': 'Purchasing is still in development, stay tuned', 'yue': '購買功能仲開發緊，敬請期待' },
    // {msg} 係佔位符，塞入錯誤訊息本身。
    'tutorview.loadMaterialsFailedTemplate': { 'zh-Hant': '載入教材失敗：{msg}', 'en': 'Failed to load materials: {msg}', 'yue': 'Load唔到教材：{msg}' },
    'tutorview.noteNotFound': { 'zh-Hant': '找不到這份教材', 'en': 'Material not found', 'yue': '搵唔到呢份教材' },
    'tutorview.noPreviewSet': { 'zh-Hant': '這份教材尚未設定預覽頁', 'en': 'No preview page set for this material yet', 'yue': '呢份教材未設定預覽頁' },
    'tutorview.previewTitlePrefix': { 'zh-Hant': '預覽：', 'en': 'Preview: ', 'yue': '預覽：' },
    // {msg} 係佔位符，塞入錯誤訊息本身。
    'tutorview.openFileFailedTemplate': { 'zh-Hant': '開啟檔案失敗：{msg}', 'en': 'Failed to open file: {msg}', 'yue': '開唔到個檔案：{msg}' },

    // ── 時數扭蛋機（第六階段：English 由 Claude 翻譯、廣東話口語由
    //    Claude 起草，交 Alvis 覆核／修正）──
    'gacha.pageTitle': { 'zh-Hant': 'Ottiee 時數幸運扭蛋機', 'en': "Ottiee's Lucky Gacha Machine", 'yue': 'Ottiee 幸運扭蛋機' },
    'gacha.yourPoints': { 'zh-Hant': '你的積分：', 'en': 'Your points: ', 'yue': '你嘅積分：' },
    'gacha.batchResultTitle': { 'zh-Hant': '連續抽十次結果', 'en': '10x Draw Results', 'yue': '十連抽結果' },
    'gacha.drawNormalBtn': { 'zh-Hant': '抽一次', 'en': 'Draw Once', 'yue': '抽一次' },
    'gacha.drawLuckyBtn': { 'zh-Hant': '連續抽十次', 'en': 'Draw 10x', 'yue': '十連抽' },
    'gacha.stickerBookTitle': { 'zh-Hant': 'Ottiee 貼紙圖鑑', 'en': "Ottiee's Sticker Album", 'yue': 'Ottiee 貼紙圖鑑' },
    'gacha.stickerBookDesc': { 'zh-Hant': '扭蛋抽到的都是 Ottiee 貼紙，集齊一套為目標！', 'en': 'Every capsule contains an Ottiee sticker — try to collect the full set!', 'yue': '扭蛋抽到嘅全部都係 Ottiee 貼紙，儲齊一套為目標！' },
    'gacha.collectedLabel': { 'zh-Hant': '已收集', 'en': 'Collected', 'yue': '已儲齊' },
    'gacha.openStickerBookBtn': { 'zh-Hant': '開啟我的貼紙圖鑑', 'en': 'Open My Sticker Album', 'yue': '打開我嘅貼紙圖鑑' },
    'gacha.historyTitle': { 'zh-Hant': '最近抽獎記錄', 'en': 'Recent Draw History', 'yue': '最近扭蛋記錄' },
    'gacha.showMoreBtn': { 'zh-Hant': '顯示更多', 'en': 'Show More', 'yue': '顯示多啲' },
    'gacha.myStickerBookTitle': { 'zh-Hant': '我的貼紙圖鑑', 'en': 'My Sticker Album', 'yue': '我嘅貼紙圖鑑' },
    'gacha.notCollected': { 'zh-Hant': '未收集', 'en': 'Not Collected', 'yue': '未儲到' },
    'gacha.profileHistoryEmpty': { 'zh-Hant': '你尚未扭過蛋，請到「時數扭蛋機」試試手氣！', 'en': 'You haven’t drawn yet — try your luck at the Gacha Machine!', 'yue': '你仲未扭過蛋，去「時數扭蛋機」度試吓手氣啦！' },
    // {name} 係佔位符，塞入貼紙名稱。
    'gacha.clickToEnlargeTemplate': { 'zh-Hant': '點擊放大查看：{name}', 'en': 'Click to enlarge: {name}', 'yue': '撳大啲睇：{name}' },
    // {n} 係佔位符，塞入擁有數量。
    'gacha.collectedCountTemplate': { 'zh-Hant': '已收集 ×{n}', 'en': 'Collected ×{n}', 'yue': '已儲 ×{n}' },
    // {a}/{b} 係佔位符，分別塞入已收集款數／總款數。
    'gacha.collectionProgressTemplate': { 'zh-Hant': '貼紙圖鑑收集進度：{a}/{b}', 'en': 'Sticker album progress: {a}/{b}', 'yue': '貼紙圖鑑儲齊進度：{a}/{b}' },
    'gacha.drawingInProgress': { 'zh-Hant': '⏳ 扭蛋中…', 'en': '⏳ Drawing…', 'yue': '⏳ 扭蛋中…' },
    // {msg} 係佔位符，塞入錯誤訊息本身。
    'gacha.deductFailedTemplate': { 'zh-Hant': '扣分失敗：{msg}', 'en': 'Failed to deduct points: {msg}', 'yue': '扣分失敗：{msg}' },
    'gacha.newStickerLabel': { 'zh-Hant': '新貼紙！', 'en': 'New Sticker!', 'yue': '新貼紙呀！' },
    // {n} 係佔位符，塞入擁有數量。
    'gacha.alreadyOwnedTemplate': { 'zh-Hant': '已擁有 ×{n}', 'en': 'Already owned ×{n}', 'yue': '已經有 ×{n}' },
    // {name} 係佔位符，塞入貼紙名稱。
    'gacha.newStickerToastTemplate': { 'zh-Hant': '恭喜！抽到新貼紙「{name}」！', 'en': 'Congrats! You got a new sticker: "{name}"!', 'yue': '恭喜！抽到新貼紙「{name}」！' },
    'gacha.newStickerShort': { 'zh-Hant': '新貼紙', 'en': 'New', 'yue': '新貼紙' },
    'gacha.duplicateShort': { 'zh-Hant': '重複', 'en': 'Duplicate', 'yue': '重複' },
    // {n} 係佔位符，塞入呢次十連抽入面攞到嘅新貼紙張數。
    'gacha.batchNewStickersToastTemplate': { 'zh-Hant': '十連抽入面攞到 {n} 張新貼紙！', 'en': 'You got {n} new stickers from this 10x draw!', 'yue': '十連抽攞到 {n} 張新貼紙！' },
    'gacha.batchAllDuplicateToast': { 'zh-Hant': '十連抽完成，這次全部都是已擁有的貼紙～', 'en': 'Draw complete — all stickers this time were ones you already have.', 'yue': '十連抽完成，今次全部都係儲咗嘅貼紙～' },
    'gacha.loadingHistory': { 'zh-Hant': '載入中獎記錄...', 'en': 'Loading draw history...', 'yue': 'Load 緊中獎記錄...' },
    'gacha.loadHistoryFailed': { 'zh-Hant': '載入中獎記錄失敗，請稍後再試', 'en': 'Failed to load draw history, please try again later', 'yue': 'Load 唔到中獎記錄，遲啲再試吓' },
    'gacha.batchTypeShort': { 'zh-Hant': '十連抽', 'en': '10x Draw', 'yue': '十連抽' },
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
    if (typeof window.updateMicButtonUI === 'function') window.updateMicButtonUI();
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
    // data-i18n-title：用喺 title="..." 呢類 hover 提示文字（同樣唔算
    // textContent，要獨立處理先換得到）。
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      el.setAttribute('title', window.t(key, el.getAttribute('title')));
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
