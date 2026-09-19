// ConcenMate · tutor-panel.js
// ------------------------------------------------------------
// 導師後台（Phase B／C：科目、課題、PDF 筆記管理）。同 admin-panel.js
// 一樣唔係 ES module，同其他 <script> 區塊共用全域 scope，喺
// index.html 尾段用 <script src="tutor-panel.js"> 載入，一定要喺
// app-core.js／app-features.js 之後，因為要用到佢哋已經定義好嘅
// window.db／window.fs／window.storage／window.storageApi／
// window.callCloudFunction／window.currentUser 等物件。
//
// 呢個檔案負責兩件事：
//   1. applyRoleBasedSidebar() —— 揀咗導師呢條路嘅帳戶（無論已經批核
//      定審批緊）登入之後，將側邊欄由學生嗰一套（視訊溫習室／學科溫
//      習卡…）完全換做淨係「主頁」＋「管理教材」兩項，同學生／Admin
//      介面徹底分開——⚠️ 呢度特登用 accountType==='tutor'（喺註冊或者
//      事後申請導師嗰刻就已經寫低，唔使等批核）嚟判斷，唔係用
//      role==='tutor'（要批核之後先會有）：如果淨係睇 role，審批中嘅
//      導師申請人喺批核之前會不斷見到一整套學生功能，同「揀咗導師就
//      應該見到導師介面」呢個預期唔一致。真正嘅操作權限（新增科目、
//      上傳教材）依然由 role／tutors.status 把關，同呢度嘅介面判斷
//      完全分開。
//   2. 「管理教材」分頁本身：role==='tutor'（已批核）先顯示真正嘅
//      科目 → 課題 → 教材管理介面；accountType==='tutor' 但仲未批核
//      （或者被拒）就顯示審批狀態畫面。教材支援上傳、揀預覽頁、定
//      價、刪除，實際嘅 PDF 檔案處理（讀頁數、抽頁產生預覽版）全部
//      喺 functions/index.js 嘅 beginTutorNoteUpload／
//      registerTutorNoteUpload／selectTutorNotePreviewPages／
//      deleteTutorNote 度做，呢度淨係負責前端顯示同觸發呼叫。

// ===================== 側邊欄按帳戶類型切換 =====================
window.applyRoleBasedSidebar = function() {
  // ⚠️ 兩個條件用 OR：accountType==='tutor' 涵蓋「揀咗導師呢條路但仲
  // 未批核」，role==='tutor' 額外兜住 Phase A 剛推出嗰陣（accountType
  // 呢個欄位出現之前）已經批核咗嘅舊帳戶——嗰批帳戶嘅 users 文件冇
  // accountType 呢個欄位，淨係靠 role 先識別得到，唔加呢個 OR 佢哋登
  // 入會變返見到成套學生側邊欄。
  const isTutorPath = !!(window.currentUser && (window.currentUser.accountType === 'tutor' || window.currentUser.role === 'tutor'));
  document.querySelectorAll('.student-only-nav').forEach((btn) => {
    btn.style.display = isTutorPath ? 'none' : '';
  });
  const tutorBtn = document.getElementById('nav-btn-tutor-materials');
  if (tutorBtn) tutorBtn.style.display = isTutorPath ? '' : 'none';
};

(function() {
  // ===================== 內部狀態 =====================
  let tutorSubjects = [];
  let tutorTopics = [];
  let tutorNotes = [];
  let selectedSubjectId = null;
  let selectedTopicId = null;
  let subjectsUnsub = null;
  let topicsUnsub = null;
  let notesUnsub = null;
  let lastRegisteredNoteId = null; // 上傳完成、等緊揀預覽頁嗰份教材

  function escapeHtmlLocal(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function centsToDollarStr(cents) {
    return 'HK$' + ((cents || 0) / 100).toFixed(2);
  }

  // ===================== 分頁入口 =====================
  window.renderTutorMaterialsTab = async function() {
    const onTutorPath = !!(window.currentUser && (window.currentUser.accountType === 'tutor' || window.currentUser.role === 'tutor'));
    if (!onTutorPath || !window.db || !window.fs) return;

    const pendingPanel = document.getElementById('tutor-materials-pending-panel');
    const approvedPanel = document.getElementById('tutor-materials-approved-panel');

    if (window.currentUser.role === 'tutor') {
      // 已經批核：顯示返正常嘅科目／課題／教材管理介面
      if (pendingPanel) pendingPanel.style.display = 'none';
      if (approvedPanel) approvedPanel.style.display = 'block';
      loadTutorSubjects();
      return;
    }

    // 未批核（或者已被拒）：唔顯示管理介面，改為顯示審批狀態
    if (approvedPanel) approvedPanel.style.display = 'none';
    if (!pendingPanel) return;
    pendingPanel.style.display = 'block';
    pendingPanel.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">正在查詢申請狀態…</p>';
    try {
      const snap = await window.fs.getDoc(window.fs.doc(window.db, 'tutorApplications', window.currentUser.uid));
      if (!snap.exists()) {
        pendingPanel.innerHTML = `
          <div style="text-align:center; padding:20px;">
            <div style="font-size:40px; margin-bottom:8px;">🎓</div>
            <p style="font-size:14px; color:#666;">找不到導師申請紀錄，請重新提交申請。</p>
            <button class="btn btn-primary" type="button" style="margin-top:10px;" onclick="window.openTutorApplyModal()">重新申請</button>
          </div>
        `;
        return;
      }
      const app = snap.data();
      if (app.status === 'pending') {
        pendingPanel.innerHTML = `
          <div style="text-align:center; padding:30px 16px;">
            <div style="font-size:44px; margin-bottom:10px;">⏳</div>
            <h3 style="font-size:17px; font-weight:bold; color:var(--brand-800); margin-bottom:6px;">導師申請審批中</h3>
            <p style="font-size:14px; color:#666; max-width:360px; margin:0 auto;">您的導師申請已經收到，請耐心等候管理員審批。批核之後這裡就會變成完整的教材管理後台。</p>
          </div>
        `;
      } else if (app.status === 'rejected') {
        pendingPanel.innerHTML = `
          <div style="text-align:center; padding:30px 16px;">
            <div style="font-size:44px; margin-bottom:10px;">❌</div>
            <h3 style="font-size:17px; font-weight:bold; color:var(--brand-800); margin-bottom:6px;">導師申請未獲批准</h3>
            ${app.rejectionReason ? `<p style="font-size:14px; color:#8a2f2f; background:#FBEAEA; border-radius:8px; padding:8px 10px; max-width:360px; margin:0 auto 10px;">原因：${escapeHtmlLocal(app.rejectionReason)}</p>` : ''}
            <button class="btn btn-primary" type="button" onclick="window.openTutorApplyModal()">🔁 重新申請</button>
          </div>
        `;
      } else {
        pendingPanel.innerHTML = `
          <div style="text-align:center; padding:30px 16px;">
            <div style="font-size:44px; margin-bottom:10px;">🎓</div>
            <p style="font-size:14px; color:#666;">您的導師申請已經批核，請重新登入以更新帳戶狀態。</p>
          </div>
        `;
      }
    } catch (err) {
      pendingPanel.innerHTML = `<p style="text-align:center; color:#c0392b; font-size:13px;">查詢申請狀態失敗：${escapeHtmlLocal(err.message || err)}</p>`;
    }
  };

  // ===================== 科目 =====================
  function loadTutorSubjects() {
    if (subjectsUnsub) subjectsUnsub();
    const q = window.fs.query(
      window.fs.collection(window.db, 'tutorSubjects'),
      window.fs.where('tutorUid', '==', window.currentUser.uid),
      window.fs.orderBy('createdAt', 'asc')
    );
    subjectsUnsub = window.fs.onSnapshot(q, (snapshot) => {
      tutorSubjects = snapshot.docs;
      if (selectedSubjectId && !tutorSubjects.some((d) => d.id === selectedSubjectId)) {
        selectedSubjectId = null;
        selectedTopicId = null;
      }
      renderTutorSubjectTabsUI();
      if (!selectedSubjectId && tutorSubjects.length > 0) {
        window.selectTutorSubject(tutorSubjects[0].id);
      } else if (!selectedSubjectId) {
        document.getElementById('tutor-topics-card').style.display = 'none';
        document.getElementById('tutor-notes-card').style.display = 'none';
      }
    }, (err) => {
      const el = document.getElementById('tutor-subject-tabs');
      if (el) el.innerHTML = `<p style="color:#c0392b; font-size:13px;">載入科目失敗：${escapeHtmlLocal(err.message || err)}</p>`;
    });
  }

  function renderTutorSubjectTabsUI() {
    const container = document.getElementById('tutor-subject-tabs');
    if (!container) return;
    if (tutorSubjects.length === 0) {
      container.innerHTML = '<p style="font-size:13px; color:#999;">還未有任何科目，點擊「＋ 新增科目」開始。</p>';
      return;
    }
    container.innerHTML = tutorSubjects.map((d) => {
      const s = d.data();
      const active = d.id === selectedSubjectId;
      return `<button class="btn ${active ? 'btn-primary' : 'btn-outline'}" style="font-size:13px; padding:5px 12px;" onclick="window.selectTutorSubject('${d.id}')">${escapeHtmlLocal(s.name)}</button>`;
    }).join('');
  }

  window.selectTutorSubject = function(subjectId) {
    selectedSubjectId = subjectId;
    selectedTopicId = null;
    renderTutorSubjectTabsUI();
    document.getElementById('tutor-topics-card').style.display = 'block';
    document.getElementById('tutor-notes-card').style.display = 'none';
    loadTutorTopics(subjectId);
  };

  // HKDSE 常見科目清單（核心＋選修），揀「其他」先出現自訂文字輸入
  // 格——用固定清單嚟揀，避免各導師自己隨意打字令同一科出現唔同名
  // 稱（例如「Maths」「數學」「Math」混雜），方便日後學生瀏覽篩選。
  const TUTOR_DSE_SUBJECTS = [
    '中國語文', '英國語文', '數學（必修部分）', '數學延伸部分單元一（M1）', '數學延伸部分單元二（M2）',
    '公民與社會發展',
    '中國歷史', '歷史', '地理', '經濟', '企業、會計與財務概論（BAFS）', '倫理與宗教',
    '中國文學', '英語文學',
    '物理', '化學', '生物',
    '資訊及通訊科技', '健康管理與社會關懷', '科技與生活', '設計與應用科技', '旅遊與款待',
    '視覺藝術', '音樂', '體育',
    '其他（自行輸入）',
  ];

  window.openTutorAddSubjectModal = function() {
    const select = document.getElementById('tutor-add-subject-select');
    if (select) {
      select.innerHTML = TUTOR_DSE_SUBJECTS.map((s) => `<option value="${escapeHtmlLocal(s)}">${escapeHtmlLocal(s)}</option>`).join('');
      select.value = TUTOR_DSE_SUBJECTS[0];
    }
    const customInput = document.getElementById('tutor-add-subject-custom');
    if (customInput) customInput.value = '';
    window.onTutorAddSubjectSelectChange();
    window.openModal('modal-tutor-add-subject');
  };

  window.onTutorAddSubjectSelectChange = function() {
    const select = document.getElementById('tutor-add-subject-select');
    const wrap = document.getElementById('tutor-add-subject-custom-wrap');
    if (!select || !wrap) return;
    wrap.style.display = select.value === '其他（自行輸入）' ? 'block' : 'none';
  };

  window.confirmTutorAddSubject = async function() {
    const select = document.getElementById('tutor-add-subject-select');
    let name = select ? select.value : '';
    if (name === '其他（自行輸入）') {
      name = (document.getElementById('tutor-add-subject-custom').value || '').trim();
    }
    if (!name) { window.showToast('請填寫科目名稱', '⚠️'); return; }
    try {
      const ref = await window.fs.addDoc(window.fs.collection(window.db, 'tutorSubjects'), {
        tutorUid: window.currentUser.uid,
        name: name.slice(0, 30),
        createdAt: Date.now(),
      });
      window.closeModal('modal-tutor-add-subject');
      window.selectTutorSubject(ref.id);
      window.showToast('已新增科目', '✅');
    } catch (err) {
      window.showToast('新增科目失敗：' + (err.message || err), '❌');
    }
  };

  window.getSelectedTutorSubjectId = function() { return selectedSubjectId; };
  window.getSelectedTutorTopicId = function() { return selectedTopicId; };

  window.deleteTutorSubject = async function(subjectId) {
    if (!subjectId) { window.showToast('請先選擇一個科目', '⚠️'); return; }
    const topicsSnap = await window.fs.getDocs(window.fs.query(
      window.fs.collection(window.db, 'tutorTopics'),
      window.fs.where('subjectId', '==', subjectId)
    ));
    if (!topicsSnap.empty) {
      window.showToast('這個科目底下還有課題，請先刪除全部課題', '⚠️');
      return;
    }
    if (!confirm('確定刪除這個科目？')) return;
    try {
      await window.fs.deleteDoc(window.fs.doc(window.db, 'tutorSubjects', subjectId));
      window.showToast('已刪除科目', '✅');
    } catch (err) {
      window.showToast('刪除失敗：' + (err.message || err), '❌');
    }
  };

  // ===================== 課題 =====================
  function loadTutorTopics(subjectId) {
    if (topicsUnsub) topicsUnsub();
    const q = window.fs.query(
      window.fs.collection(window.db, 'tutorTopics'),
      window.fs.where('subjectId', '==', subjectId),
      window.fs.orderBy('createdAt', 'asc')
    );
    topicsUnsub = window.fs.onSnapshot(q, (snapshot) => {
      tutorTopics = snapshot.docs;
      if (selectedTopicId && !tutorTopics.some((d) => d.id === selectedTopicId)) {
        selectedTopicId = null;
      }
      renderTutorTopicTabsUI();
      if (!selectedTopicId && tutorTopics.length > 0) {
        window.selectTutorTopic(tutorTopics[0].id);
      } else if (!selectedTopicId) {
        document.getElementById('tutor-notes-card').style.display = 'none';
      }
    }, (err) => {
      const el = document.getElementById('tutor-topic-tabs');
      if (el) el.innerHTML = `<p style="color:#c0392b; font-size:13px;">載入課題失敗：${escapeHtmlLocal(err.message || err)}</p>`;
    });
  }

  function renderTutorTopicTabsUI() {
    const container = document.getElementById('tutor-topic-tabs');
    if (!container) return;
    if (tutorTopics.length === 0) {
      container.innerHTML = '<p style="font-size:13px; color:#999;">這個科目還未有任何課題，點擊「＋ 新增課題」開始。</p>';
      return;
    }
    container.innerHTML = tutorTopics.map((d) => {
      const t = d.data();
      const active = d.id === selectedTopicId;
      return `<button class="btn ${active ? 'btn-primary' : 'btn-outline'}" style="font-size:13px; padding:5px 12px;" onclick="window.selectTutorTopic('${d.id}')">${escapeHtmlLocal(t.name)}</button>`;
    }).join('');
  }

  window.selectTutorTopic = function(topicId) {
    selectedTopicId = topicId;
    renderTutorTopicTabsUI();
    document.getElementById('tutor-notes-card').style.display = 'block';
    document.getElementById('tutor-note-upload-panel').style.display = 'none';
    loadTutorNotes(topicId);
  };

  window.promptCreateTutorTopic = async function() {
    if (!selectedSubjectId) { window.showToast('請先選擇一個科目', '⚠️'); return; }
    const name = (prompt('新課題名稱（例如：三角函數）：', '') || '').trim();
    if (!name) return;
    try {
      const ref = await window.fs.addDoc(window.fs.collection(window.db, 'tutorTopics'), {
        tutorUid: window.currentUser.uid,
        subjectId: selectedSubjectId,
        name: name.slice(0, 30),
        createdAt: Date.now(),
      });
      window.selectTutorTopic(ref.id);
      window.showToast('已新增課題', '✅');
    } catch (err) {
      window.showToast('新增課題失敗：' + (err.message || err), '❌');
    }
  };

  window.deleteTutorTopic = async function(topicId) {
    if (!topicId) { window.showToast('請先選擇一個課題', '⚠️'); return; }
    const notesSnap = await window.fs.getDocs(window.fs.query(
      window.fs.collection(window.db, 'tutorNotes'),
      window.fs.where('topicId', '==', topicId),
      window.fs.where('tutorUid', '==', window.currentUser.uid)
    ));
    if (!notesSnap.empty) {
      window.showToast('這個課題底下還有教材，請先刪除全部教材', '⚠️');
      return;
    }
    if (!confirm('確定刪除這個課題？')) return;
    try {
      await window.fs.deleteDoc(window.fs.doc(window.db, 'tutorTopics', topicId));
      window.showToast('已刪除課題', '✅');
    } catch (err) {
      window.showToast('刪除失敗：' + (err.message || err), '❌');
    }
  };

  // ===================== 教材（PDF 筆記） =====================
  function loadTutorNotes(topicId) {
    if (notesUnsub) notesUnsub();
    // ⚠️ 一定要連 tutorUid 都一齊帶落 query（唔淨係 topicId），因為
    // firestore.rules 嘅 tutorNotes 讀取規則係按每份文件嘅內容判斷
    // （status=='published' 或者 tutorUid== 自己），對於「列表」查詢，
    // Firestore 要求規則嘅條件一定要由 query 本身嘅篩選條件保證到，
    // 唔會逐份文件咁check——冇帶埋 tutorUid 呢個條件嘅話，Firestore
    // 會直接拒絕成個 query（Missing or insufficient permissions），
    // 唔理個 collection 入面實際上有冇文件都一樣。呢度「管理教材」
    // 本身就淨係應該顯示自己嘅教材，所以帶埋呢個篩選條件完全合理。
    const q = window.fs.query(
      window.fs.collection(window.db, 'tutorNotes'),
      window.fs.where('topicId', '==', topicId),
      window.fs.where('tutorUid', '==', window.currentUser.uid),
      window.fs.orderBy('createdAt', 'asc')
    );
    notesUnsub = window.fs.onSnapshot(q, (snapshot) => {
      // 排序：Firestore query 本身跟 createdAt 排（唔使加新 composite index），
      // 但如果導師用「拖曳排序」自訂過順序，文件會有 order 呢個欄位，
      // 呢度就喺前端用 order（有嘅話）覆蓋返 createdAt 嚟排，兩者並存。
      tutorNotes = snapshot.docs.slice().sort((a, b) => {
        const da = a.data(), db_ = b.data();
        const oa = typeof da.order === 'number' ? da.order : da.createdAt;
        const ob = typeof db_.order === 'number' ? db_.order : db_.createdAt;
        return oa - ob;
      });
      renderTutorNotesGridUI();
    }, (err) => {
      const el = document.getElementById('tutor-notes-grid');
      if (el) el.innerHTML = `<p style="color:#c0392b; font-size:13px;">載入教材失敗：${escapeHtmlLocal(err.message || err)}</p>`;
    });
  }

  const NOTE_STATUS_LABEL = {
    draft: '⏳ 上傳中',
    awaiting_preview_selection: '📑 待選擇預覽頁',
    published: '✅ 已上架',
    delisted: '🚫 已下架（導師停權）',
    removed: '🗑️ 已下架',
  };

  function buildTutorNoteCardHtml(docSnap, dragEnabled) {
    const n = docSnap.data();
    const id = docSnap.id;
    const statusLabel = NOTE_STATUS_LABEL[n.status] || n.status;
    const dragAttrs = dragEnabled
      ? `draggable="true" data-note-id="${id}" ondragstart="window.handleTutorNoteDragStart(event)" ondragover="window.handleTutorNoteDragOver(event)" ondrop="window.handleTutorNoteDrop(event)" ondragend="window.handleTutorNoteDragEnd(event)"`
      : `data-note-id="${id}"`;
    return `
      <div class="admin-card" style="margin-bottom:0; ${dragEnabled ? 'cursor:grab;' : ''}" ${dragAttrs}>
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
          ${dragEnabled ? '<span style="color:#bbb; font-size:14px;" title="拖曳可調整排序">⠿</span>' : ''}
          <div style="font-size:12px; color:#999;">${escapeHtmlLocal(statusLabel)}</div>
        </div>
        <div style="font-weight:700; font-size:14px; color:var(--brand-800); margin-bottom:2px;">${escapeHtmlLocal(n.title)}</div>
        <div style="font-size:12px; color:#888; margin-bottom:6px; min-height:16px;">${escapeHtmlLocal(n.description || '')}</div>
        <div style="font-size:13px; color:#3E7A8A; font-weight:700;">${centsToDollarStr(n.priceCents)}</div>
        <div style="font-size:12px; color:#aaa; margin:4px 0;">${n.pageCount ? (n.pageCount + ' 頁') : '頁數計算中…'}${n.previewPages && n.previewPages.length ? '　預覽頁：' + n.previewPages.join(', ') : ''}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
          ${n.fullStoragePath
            ? `<button class="btn btn-outline" style="font-size:12px; padding:4px 8px;" onclick="window.previewTutorNoteFull('${id}')">📄 預覽整份文件</button>`
            : ''}
          ${n.status === 'published' && n.previewStoragePath
            ? `<button class="btn btn-outline" style="font-size:12px; padding:4px 8px;" onclick="window.previewTutorNoteStudentView('${id}')">👁️ 預覽（學生視角）</button>`
            : ''}
          ${n.status === 'awaiting_preview_selection' || n.status === 'published'
            ? `<button class="btn btn-outline" style="font-size:12px; padding:4px 8px;" onclick="window.openTutorPreviewPicker('${id}', ${n.pageCount || 0})">📑 選擇預覽頁</button>`
            : ''}
          <button class="btn btn-outline" style="font-size:12px; padding:4px 8px;" onclick="window.promptEditTutorNote('${id}')">✏️ 編輯</button>
          <button class="btn btn-red" style="font-size:12px; padding:4px 8px;" onclick="window.deleteTutorNoteConfirm('${id}')">🗑️ 刪除</button>
        </div>
      </div>
    `;
  }

  // ---------- 拖曳排序（多過一份教材先啟用） ----------
  // 做法：拖曳完成之後，將目前排列順序寫返做每份教材嘅 order 欄位
  // （用 10 為單位隔開，方便將來插入），寫入 Firestore 之後 onSnapshot
  // 會自動重新排序、重新 render，唔使自己手動搬 DOM。
  let dragNoteId = null;

  window.handleTutorNoteDragStart = function(ev) {
    dragNoteId = ev.currentTarget.getAttribute('data-note-id');
    ev.currentTarget.style.opacity = '0.5';
    ev.dataTransfer.effectAllowed = 'move';
  };

  window.handleTutorNoteDragOver = function(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  };

  window.handleTutorNoteDragEnd = function(ev) {
    ev.currentTarget.style.opacity = '';
  };

  window.handleTutorNoteDrop = async function(ev) {
    ev.preventDefault();
    const targetId = ev.currentTarget.getAttribute('data-note-id');
    if (!dragNoteId || dragNoteId === targetId) return;

    const ids = tutorNotes.map((d) => d.id);
    const fromIdx = ids.indexOf(dragNoteId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);

    // 先喺前端即時重排一次（樂觀更新，畫面即時反映），寫入 Firestore
    // 成功之後 onSnapshot 會再確認返一次順序
    tutorNotes.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    renderTutorNotesGridUI();

    try {
      await Promise.all(ids.map((id, idx) =>
        window.fs.updateDoc(window.fs.doc(window.db, 'tutorNotes', id), { order: (idx + 1) * 10 })
      ));
    } catch (err) {
      window.showToast('儲存排序失敗：' + (err.message || err), '❌');
    }
  };

  // 導師預覽：分兩個掣，一個開「整份PDF」（fullStoragePath，只有導師本人／admin睇到），
  // 一個開「學生視角」（previewStoragePath，即係公開嗰幾頁預覽PDF，同學生實際見到嘅一樣）。
  // 兩個都係用 Firebase Storage 嘅 getDownloadURL 攞返個網址，然後開新分頁顯示 PDF。
  function findTutorNoteDocById(noteId) {
    return tutorNotes.find((d) => d.id === noteId) || null;
  }

  window.previewTutorNoteFull = async function(noteId) {
    const docSnap = findTutorNoteDocById(noteId);
    const n = docSnap && docSnap.data();
    if (!n || !n.fullStoragePath) { window.showToast('找不到這份教材的檔案', '⚠️'); return; }
    try {
      const url = await window.storageApi.getDownloadURL(window.storageApi.ref(window.storage, n.fullStoragePath));
      window.open(url, '_blank');
    } catch (err) {
      window.showToast('開啟檔案失敗：' + (err.message || err), '❌');
    }
  };

  window.previewTutorNoteStudentView = async function(noteId) {
    const docSnap = findTutorNoteDocById(noteId);
    const n = docSnap && docSnap.data();
    if (!n || !n.previewStoragePath) { window.showToast('這份教材尚未設定預覽頁', '⚠️'); return; }
    try {
      const url = await window.storageApi.getDownloadURL(window.storageApi.ref(window.storage, n.previewStoragePath));
      window.open(url, '_blank');
    } catch (err) {
      window.showToast('開啟檔案失敗：' + (err.message || err), '❌');
    }
  };

  function renderTutorNotesGridUI() {
    const container = document.getElementById('tutor-notes-grid');
    if (!container) return;
    if (tutorNotes.length === 0) {
      container.innerHTML = '<p style="font-size:13px; color:#999; grid-column:1/-1;">這個課題還未有任何教材，點擊「⬆️ 上傳教材」開始。</p>';
      return;
    }
    const dragEnabled = tutorNotes.length > 1;
    container.innerHTML = tutorNotes.map((d) => buildTutorNoteCardHtml(d, dragEnabled)).join('');
  }

  // ---------- 上傳流程 ----------
  window.openTutorNoteUploadForm = function() {
    if (!selectedTopicId) { window.showToast('請先選擇一個課題', '⚠️'); return; }
    const panel = document.getElementById('tutor-note-upload-panel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML = `
      <h4 style="font-size:14px; font-weight:bold; color:var(--brand-800); margin-bottom:8px;">⬆️ 上傳新教材</h4>
      <label style="font-size:13px; font-weight:bold; color:#555;">標題 *</label>
      <input id="tutor-note-title" class="input-field" type="text" maxlength="80" style="width:100%; margin-bottom:8px;" placeholder="例如：三角函數重點筆記">
      <label style="font-size:13px; font-weight:bold; color:#555;">簡介</label>
      <textarea id="tutor-note-desc" class="input-field" rows="2" maxlength="1000" style="width:100%; margin-bottom:8px; resize:vertical;" placeholder="簡單講吓呢份筆記有咩內容"></textarea>
      <label style="font-size:13px; font-weight:bold; color:#555;">定價（HKD）*</label>
      <input id="tutor-note-price" class="input-field" type="number" min="0" step="1" style="width:100%; margin-bottom:8px;" placeholder="例如：30">
      <label style="font-size:13px; font-weight:bold; color:#555;">PDF 檔案 *（上限 50MB）</label>
      <input id="tutor-note-file" type="file" accept="application/pdf" style="width:100%; margin-bottom:10px;">
      <p id="tutor-note-upload-progress" style="font-size:13px; color:#888; margin-bottom:8px;"></p>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline" type="button" onclick="document.getElementById('tutor-note-upload-panel').style.display='none';">取消</button>
        <button class="btn btn-primary" type="button" id="tutor-note-upload-btn" onclick="window.submitTutorNoteUpload()">送出</button>
      </div>
    `;
  };

  window.submitTutorNoteUpload = async function() {
    const title = (document.getElementById('tutor-note-title').value || '').trim();
    const description = (document.getElementById('tutor-note-desc').value || '').trim();
    const priceDollar = parseFloat(document.getElementById('tutor-note-price').value);
    const fileInput = document.getElementById('tutor-note-file');
    const file = fileInput.files && fileInput.files[0];
    const progressEl = document.getElementById('tutor-note-upload-progress');
    const btn = document.getElementById('tutor-note-upload-btn');

    if (!title) { window.showToast('請填寫標題', '⚠️'); return; }
    if (Number.isNaN(priceDollar) || priceDollar < 0) { window.showToast('請填寫正確的定價', '⚠️'); return; }
    if (!file) { window.showToast('請選擇 PDF 檔案', '⚠️'); return; }
    if (file.type !== 'application/pdf') { window.showToast('只可以上傳 PDF 檔案', '⚠️'); return; }
    if (file.size > 50 * 1024 * 1024) { window.showToast('檔案不可以超過 50MB', '⚠️'); return; }

    const priceCents = Math.round(priceDollar * 100);
    if (btn) { btn.disabled = true; btn.innerText = '處理中…'; }

    try {
      if (progressEl) progressEl.innerText = '正在建立教材紀錄…';
      const beginResult = await window.callCloudFunction('beginTutorNoteUpload', {
        subjectId: selectedSubjectId,
        topicId: selectedTopicId,
        title,
        description,
        priceCents,
      });
      const noteId = beginResult.noteId;

      if (progressEl) progressEl.innerText = '正在上傳 PDF 檔案…';
      const storagePath = `tutor_notes/${window.currentUser.uid}/${noteId}/full.pdf`;
      const fileRef = window.storageApi.ref(window.storage, storagePath);
      await window.storageApi.uploadBytes(fileRef, file, { contentType: 'application/pdf' });

      if (progressEl) progressEl.innerText = '正在讀取頁數…';
      const registerResult = await window.callCloudFunction('registerTutorNoteUpload', { noteId });

      document.getElementById('tutor-note-upload-panel').style.display = 'none';
      window.showToast('教材上傳成功！請選擇預覽頁', '✅');
      window.openTutorPreviewPicker(noteId, registerResult.pageCount);
    } catch (err) {
      window.showToast('上傳失敗：' + (err.message || err), '❌');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = '送出'; }
    }
  };

  // ---------- 揀預覽頁 ----------
  window.openTutorPreviewPicker = function(noteId, pageCount) {
    if (!pageCount || pageCount < 1) { window.showToast('呢份教材仲未完成頁數讀取，請稍後再試', '⚠️'); return; }
    lastRegisteredNoteId = noteId;
    const panel = document.getElementById('tutor-note-upload-panel');
    if (!panel) return;

    const checkboxes = Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => `
      <label style="display:inline-flex; align-items:center; gap:4px; font-size:13px; border:1px solid #E5EEF0; border-radius:6px; padding:4px 8px; margin:2px;">
        <input type="checkbox" value="${p}" class="tutor-preview-page-checkbox" onchange="window.enforceTutorPreviewPageLimit()"> 第 ${p} 頁
      </label>
    `).join('');

    panel.style.display = 'block';
    panel.innerHTML = `
      <h4 style="font-size:14px; font-weight:bold; color:var(--brand-800); margin-bottom:6px;">📑 選擇預覽頁（最多 3 頁，共 ${pageCount} 頁）</h4>
      <p style="font-size:12px; color:#888; margin-bottom:8px;">學生在購買前可以看到這幾頁的內容，請選擇最能夠展示筆記質素的頁數。</p>
      <div id="tutor-preview-page-list" style="max-height:220px; overflow-y:auto; margin-bottom:10px;">${checkboxes}</div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-outline" type="button" onclick="document.getElementById('tutor-note-upload-panel').style.display='none';">稍後再選</button>
        <button class="btn btn-primary" type="button" id="tutor-preview-confirm-btn" onclick="window.confirmTutorPreviewPages()">確認並發佈</button>
      </div>
    `;
  };

  window.enforceTutorPreviewPageLimit = function() {
    const boxes = Array.from(document.querySelectorAll('.tutor-preview-page-checkbox'));
    const checked = boxes.filter((b) => b.checked);
    if (checked.length > 3) {
      checked[checked.length - 1].checked = false;
      window.showToast('預覽頁最多只能選擇 3 頁', '⚠️');
    }
  };

  window.confirmTutorPreviewPages = async function() {
    const pages = Array.from(document.querySelectorAll('.tutor-preview-page-checkbox'))
      .filter((b) => b.checked)
      .map((b) => parseInt(b.value, 10));
    if (pages.length === 0) { window.showToast('請至少選擇一頁作為預覽', '⚠️'); return; }

    const btn = document.getElementById('tutor-preview-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerText = '處理中…'; }
    try {
      await window.callCloudFunction('selectTutorNotePreviewPages', { noteId: lastRegisteredNoteId, pages });
      document.getElementById('tutor-note-upload-panel').style.display = 'none';
      window.showToast('教材已經發佈！', '🎉');
    } catch (err) {
      window.showToast('設定預覽頁失敗：' + (err.message || err), '❌');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = '確認並發佈'; }
    }
  };

  // ---------- 編輯／刪除 ----------
  // 改用 modal-tutor-edit-note 表格式編輯（標題／簡介／定價），取代舊版
  // 一個接一個彈出嘅 prompt()，editingNoteId 記住而家編緊邊份教材。
  let editingNoteId = null;

  window.promptEditTutorNote = function(noteId) {
    const docSnap = tutorNotes.find((d) => d.id === noteId);
    if (!docSnap) return;
    const n = docSnap.data();
    editingNoteId = noteId;

    const titleEl = document.getElementById('tutor-edit-note-title');
    const descEl = document.getElementById('tutor-edit-note-desc');
    const priceEl = document.getElementById('tutor-edit-note-price');
    if (titleEl) titleEl.value = n.title || '';
    if (descEl) descEl.value = n.description || '';
    if (priceEl) priceEl.value = ((n.priceCents || 0) / 100).toFixed(2);

    if (typeof window.openModal === 'function') window.openModal('modal-tutor-edit-note');
  };

  window.confirmTutorEditNote = async function() {
    if (!editingNoteId) return;
    const titleEl = document.getElementById('tutor-edit-note-title');
    const descEl = document.getElementById('tutor-edit-note-desc');
    const priceEl = document.getElementById('tutor-edit-note-price');

    const newTitle = (titleEl && titleEl.value || '').trim();
    if (!newTitle) { window.showToast('請輸入標題', '⚠️'); return; }
    const newPriceDollar = parseFloat(priceEl && priceEl.value);
    if (Number.isNaN(newPriceDollar) || newPriceDollar < 0) {
      window.showToast('定價格式不正確', '⚠️');
      return;
    }

    try {
      await window.fs.updateDoc(window.fs.doc(window.db, 'tutorNotes', editingNoteId), {
        title: newTitle.slice(0, 80),
        description: ((descEl && descEl.value) || '').trim().slice(0, 1000),
        priceCents: Math.round(newPriceDollar * 100),
        updatedAt: Date.now(),
      });
      window.showToast('已更新教材資料', '✅');
      if (typeof window.closeModal === 'function') window.closeModal('modal-tutor-edit-note');
      editingNoteId = null;
    } catch (err) {
      window.showToast('更新失敗：' + (err.message || err), '❌');
    }
  };

  window.deleteTutorNoteConfirm = async function(noteId) {
    if (!confirm('確定刪除這份教材？已上傳的 PDF 檔案會一併刪除，這個操作無法復原。')) return;
    try {
      await window.callCloudFunction('deleteTutorNote', { noteId });
      window.showToast('已刪除教材', '🗑️');
    } catch (err) {
      window.showToast('刪除失敗：' + (err.message || err), '❌');
    }
  };
})();
