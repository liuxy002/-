(function () {
  let store;
  let ui;
  let helpers;
  let toast;
  let render;
  let showModal;
  let closeModal;

  const ROUNDS = ['AI面', '一面', '二面', '三面', '终面', 'HR面', '群面', '其他'];
  const FORMATS = ['线上视频', '电话', '现场', 'AI面试', '其他'];
  const RESULTS = ['等待中', '进入下一轮', '已通过', '未通过', '主动放弃'];

  function applicationOptions(selectedId = '') {
    const { escapeHTML, attr } = helpers;
    return `<option value="">请选择关联投递</option>${store.state.applications.map((item) => `<option value="${attr(item.id)}" ${selectedId === item.id ? 'selected' : ''}>${escapeHTML(item.company)} · ${escapeHTML(item.role)}</option>`).join('')}`;
  }

  function reviewForm(review = {}) {
    const { escapeHTML, attr, dateInputValue } = helpers;
    return `<form data-form="review-save">
      <input type="hidden" name="id" value="${attr(review.id || '')}">
      <div class="form-grid cols-3">
        <div class="field span-2"><label>关联投递记录</label><select name="applicationId">${applicationOptions(review.applicationId)}</select></div>
        <div class="field"><label>面试轮次</label><select name="round">${ROUNDS.map((item) => `<option value="${item}" ${review.round === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
        <div class="field"><label>面试日期</label><input type="date" name="date" value="${attr(dateInputValue(review.date || new Date().toISOString().slice(0, 10)))}"></div>
        <div class="field"><label>面试形式</label><select name="format">${FORMATS.map((item) => `<option value="${item}" ${review.format === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
        <div class="field"><label>面试官</label><input name="interviewer" value="${attr(review.interviewer)}" placeholder="姓名 / 部门 / 职位"></div>
        <div class="field"><label>自评分数</label><select name="rating">${[1,2,3,4,5].map((value) => `<option value="${value}" ${Number(review.rating || 3) === value ? 'selected' : ''}>${value} 分</option>`).join('')}</select></div>
        <div class="field span-2"><label>当前结果</label><select name="result">${RESULTS.map((item) => `<option value="${item}" ${review.result === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
        <div class="field span-3"><label>被问到的问题</label><textarea name="questions" class="tall" placeholder="每行一个问题；如果有追问，可以写在问题下面">${escapeHTML(review.questions)}</textarea></div>
        <div class="field span-3"><label>我的回答</label><textarea name="answers" class="tall" placeholder="记录当时怎么回答的，以及是否答到重点">${escapeHTML(review.answers)}</textarea></div>
        <div class="field"><label>表现较好的地方</label><textarea name="strengths" placeholder="哪些回答、案例或表达比较有效">${escapeHTML(review.strengths)}</textarea></div>
        <div class="field"><label>需要改进的地方</label><textarea name="improvements" placeholder="卡住了什么 / 哪些知识点不熟 / 怎么回答更好">${escapeHTML(review.improvements)}</textarea></div>
        <div class="field span-3"><label>下一步准备</label><input name="nextAction" value="${attr(review.nextAction)}" placeholder="补 SQL 窗口函数 / 重写项目案例 / 准备反问问题"></div>
        <div class="field span-3"><label>其他备注</label><textarea name="notes" placeholder="面试氛围、岗位信息、后续安排等">${escapeHTML(review.notes)}</textarea></div>
      </div>
      <div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存复盘</button></div>
    </form>`;
  }

  function ratingStars(rating) {
    const value = Math.max(1, Math.min(5, Number(rating) || 0));
    return `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
  }

  function reviewCard(review) {
    const { escapeHTML, attr, fmtDate } = helpers;
    return `<article class="review-card">
      <div class="review-card-head">
        <div>
          <div class="review-tags"><span class="tag tag-violet">${escapeHTML(review.round)}</span><span class="tag">${escapeHTML(review.format)}</span><span class="tag ${review.result === '未通过' ? 'tag-danger' : review.result === '已通过' || review.result === '进入下一轮' ? 'tag-teal' : 'tag-blue'}">${escapeHTML(review.result)}</span></div>
          <h3>${escapeHTML(review.company)} · ${escapeHTML(review.role)}</h3>
          <p>${fmtDate(review.date)} · ${escapeHTML(review.interviewer || '面试官未记录')}</p>
        </div>
        <div class="review-rating"><strong>${ratingStars(review.rating)}</strong><span>${Number(review.rating) || 3} / 5</span></div>
      </div>
      <div class="review-sections">
        <section><span>高频问题</span><p>${escapeHTML((review.questions || '暂未记录').slice(0, 500))}</p></section>
        <section><span>回答与反思</span><p>${escapeHTML((review.answers || '暂未记录').slice(0, 500))}</p></section>
        <section><span>需要改进</span><p>${escapeHTML((review.improvements || '暂未记录').slice(0, 500))}</p></section>
      </div>
      <div class="recommendation-actions">
        <span class="tiny muted">${escapeHTML(review.nextAction || '未设置下一步准备')}</span>
        <div class="capture-actions">
          <button class="btn btn-secondary btn-sm" data-action="edit-review" data-id="${attr(review.id)}">编辑复盘</button>
          <button class="btn btn-danger btn-sm" data-action="delete-review" data-id="${attr(review.id)}">删除</button>
        </div>
      </div>
    </article>`;
  }

  function renderPage() {
    const { escapeHTML } = helpers;
    const reviews = [...store.state.reviews].sort((a, b) => String(b.date || b.updatedAt).localeCompare(String(a.date || a.updatedAt)));
    const filtered = ui.reviewFilter === 'all' ? reviews : reviews.filter((item) => item.result === ui.reviewFilter);
    const avg = reviews.length ? (reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / reviews.length).toFixed(1) : '0.0';
    const questionLines = reviews.flatMap((item) => String(item.questions || '').split(/\n|；|;/).map((text) => text.trim()).filter((text) => text.length >= 4)).slice(0, 12);
    const uniqueApplications = new Set(reviews.map((item) => item.applicationId).filter(Boolean)).size;
    return `<div class="stack">
      <section class="grid grid-4">
        <div class="card stat-card" style="--stat-color:#ef6548;--stat-soft:#fde8e1"><div class="card-body"><div class="stat-top"><span>复盘轮次</span><span class="stat-icon">◉</span></div><div class="stat-value">${reviews.length}</div><div class="stat-meta">已记录面试轮次</div></div></div>
        <div class="card stat-card" style="--stat-color:#7658bd;--stat-soft:#eee8fb"><div class="card-body"><div class="stat-top"><span>关联流程</span><span class="stat-icon">⌁</span></div><div class="stat-value">${uniqueApplications}</div><div class="stat-meta">有复盘记录的岗位</div></div></div>
        <div class="card stat-card" style="--stat-color:#2f8f77;--stat-soft:#e0f2ec"><div class="card-body"><div class="stat-top"><span>平均自评</span><span class="stat-icon">★</span></div><div class="stat-value">${avg}</div><div class="stat-meta">满分 5 分</div></div></div>
        <div class="card stat-card" style="--stat-color:#4777d9;--stat-soft:#e7edfc"><div class="card-body"><div class="stat-top"><span>题目积累</span><span class="stat-icon">≡</span></div><div class="stat-value">${questionLines.length}</div><div class="stat-meta">最近可复习问题</div></div></div>
      </section>
      <section class="grid grid-sidebar">
        <div class="stack">
          <div class="section-title"><div><h2>逐轮复盘</h2><p>记录真实回答和改进方法，比只记“面试结果”更有用</p></div><div class="capture-actions"><select class="input" data-field="review-filter"><option value="all" ${ui.reviewFilter === 'all' ? 'selected' : ''}>全部结果</option>${RESULTS.map((item) => `<option value="${item}" ${ui.reviewFilter === item ? 'selected' : ''}>${item}</option>`).join('')}</select><button class="btn btn-primary" data-action="add-review">＋ 新增复盘</button></div></div>
          ${filtered.length ? filtered.map(reviewCard).join('') : `<div class="card"><div class="empty-state"><div><div class="empty-icon">◉</div><h3>还没有面试复盘</h3><p>面试结束后就记录，不需要一次写得很完整。先记问题和卡住的地方，再补充更好的回答。</p><div class="empty-actions"><button class="btn btn-primary" data-action="add-review">记录第一次面试复盘</button></div></div></div></div>`}
        </div>
        <div class="stack">
          <div class="card"><div class="card-header"><div><h3>面试题库</h3><p>从已记录复盘中自动汇总</p></div></div><div class="card-body">${questionLines.length ? `<div class="question-bank">${questionLines.map((question, index) => `<div><span>${index + 1}</span><p>${escapeHTML(question)}</p></div>`).join('')}</div>` : '<p class="muted small">记录问题后，这里会自动形成你的面试题库。</p>'}</div></div>
          <div class="card"><div class="card-body"><h3>复盘建议</h3><p class="small muted" style="margin-top:8px">重点记录三类内容：面试官原问题、你当时的回答、下一次会怎么改。这样复习时不会只看到“表现不好”，而能找到具体可改进的动作。</p></div></div>
        </div>
      </section>
    </div>`;
  }

  function openModal(reviewId = '', applicationId = '') {
    const existing = reviewId ? store.state.reviews.find((item) => item.id === reviewId) : null;
    const application = applicationId ? store.getApplication(applicationId) : null;
    const base = existing || {};
    if (!existing && application) {
      base.applicationId = application.id;
      base.company = application.company;
      base.role = application.role;
      base.round = application.interviewRound || '一面';
    }
    const html = `<div class="modal-header"><div><h2>${existing ? '编辑面试复盘' : '新增面试复盘'}</h2><p>建议在面试当天先记问题，再补充更好的回答</p></div><button class="btn btn-ghost btn-icon" data-action="close-modal">×</button></div><div class="modal-body">${reviewForm(base)}</div>`;
    showModal(html, 'wide');
  }

  function save(data) {
    const application = data.applicationId ? store.getApplication(data.applicationId) : null;
    const review = {
      ...data,
      rating: Number(data.rating) || 3,
      company: application?.company || '未关联公司',
      role: application?.role || '未关联岗位'
    };
    if (data.id) store.updateReview(data.id, review);
    else store.addReview(review);
    closeModal();
    render();
    toast('面试复盘已保存', 'success');
  }

  async function handleAction(action, id) {
    if (action === 'add-review') { openModal('', id || ''); return true; }
    if (action === 'edit-review') { openModal(id); return true; }
    if (action === 'delete-review') {
      const review = store.state.reviews.find((item) => item.id === id);
      if (review && confirm(`确定删除「${review.company} · ${review.role} · ${review.round}」的复盘吗？`)) {
        store.removeReview(id);
        render();
        toast('复盘记录已删除');
      }
      return true;
    }
    return false;
  }

  window.QiuzhaoReviews = {
    init(context) {
      store = context.store;
      ui = context.ui;
      helpers = context.helpers;
      toast = context.toast;
      render = context.render;
      showModal = context.showModal;
      closeModal = context.closeModal;
    },
    render: renderPage,
    openModal,
    save,
    handleAction,
    results: RESULTS
  };
})();

