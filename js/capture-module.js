(function () {
  let store;
  let ui;
  let helpers;
  let navigate;
  let toast;
  let render;
  let apiOnline = true;
  const LOCAL_MODE = ['127.0.0.1', 'localhost'].includes(window.location.hostname);

  async function api(path = '', options = {}) {
    const response = await fetch(`/api/captured-jobs${path}`, {
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || '采集服务请求失败');
    return payload;
  }

  async function load() {
    ui.capturedLoading = true;
    try {
      const payload = await api();
      ui.capturedJobs = payload.jobs || [];
      apiOnline = true;
    } catch (error) {
      apiOnline = false;
      toast(`采集箱读取失败：${error.message}`, 'error');
    } finally {
      ui.capturedLoading = false;
      if (ui.page === 'capture') render();
    }
  }

  async function update(id, patch) {
    const payload = await api(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    ui.capturedJobs = ui.capturedJobs.map((item) => item.id === id ? payload.job : item);
    return payload.job;
  }

  async function remove(id) {
    await api(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
    ui.capturedJobs = ui.capturedJobs.filter((item) => item.id !== id);
  }

  function statusTag(status) {
    if (status === 'saved') return '<span class="tag tag-teal">已加入系统</span>';
    if (status === 'dismissed') return '<span class="tag">已忽略</span>';
    return '<span class="tag tag-amber">待处理</span>';
  }

  function card(job) {
    const { escapeHTML, attr, linkAttr, fmtDateTime } = helpers;
    return `<article class="capture-card">
      <div class="capture-card-head">
        <div><h3>${escapeHTML(job.company)} · ${escapeHTML(job.role)}</h3><p>${escapeHTML([job.city, job.salary, job.source].filter(Boolean).join(' · ') || '信息待补充')}</p></div>
        <div class="capture-meta">${statusTag(job.status)}<span class="tiny muted">${fmtDateTime(job.capturedAt)}</span></div>
      </div>
      ${job.url ? `<a class="capture-url" href="${linkAttr(job.url)}" target="_blank" rel="noreferrer">${escapeHTML(job.url)}</a>` : '<span class="tiny muted">未抓取到投递地址</span>'}
      <div class="capture-jd">${job.jdText ? escapeHTML(job.jdText.slice(0, 1500)) : '<span class="muted">未抓取到 JD，建议在原页面手动复制后补充。</span>'}</div>
      <div class="recommendation-actions">
        <span class="tiny muted">${job.jdText ? `JD ${job.jdText.length} 字` : '缺少 JD'}</span>
        <div class="capture-actions">
          <button class="btn btn-ghost btn-sm" data-action="capture-dismiss" data-id="${attr(job.id)}">忽略</button>
          <button class="btn btn-secondary btn-sm" data-action="capture-to-candidate" data-id="${attr(job.id)}">加入候选池</button>
          <button class="btn btn-primary btn-sm" data-action="capture-to-application" data-id="${attr(job.id)}">加入投递</button>
          <button class="btn btn-danger btn-sm" data-action="capture-delete" data-id="${attr(job.id)}">删除</button>
        </div>
      </div>
    </article>`;
  }

  function renderPage() {
    if (!LOCAL_MODE) {
      return `<div class="card"><div class="card-header"><div><h3>公网体验模式</h3><p>岗位采集器只在本地运行时可用</p></div></div><div class="card-body stack"><p class="muted small">当前页面运行在公网，每位访问者的投递数据只保存在自己的浏览器中。浏览器采集器需要本地服务配合，因此公网体验版暂不接收采集数据。</p><div class="notice notice-info">你仍然可以使用投递管理、搜索排序、每日统计、提醒和面试复盘。需要采集岗位时，请在电脑本地启动秋招作战台。</div></div></div>`;
    }
    const { escapeHTML } = helpers;
    const all = ui.capturedJobs || [];
    const counts = {
      new: all.filter((item) => item.status === 'new').length,
      saved: all.filter((item) => item.status === 'saved').length
    };
    const jobs = ui.capturedFilter === 'all' ? all : all.filter((item) => item.status === ui.capturedFilter);
    return `<div class="stack">
      <section class="grid grid-3">
        <div class="card stat-card" style="--stat-color:#d99528;--stat-soft:#fcf0d8"><div class="card-body"><div class="stat-top"><span>待处理</span><span class="stat-icon">⇩</span></div><div class="stat-value">${counts.new}</div><div class="stat-meta">等待确认的抓取记录</div></div></div>
        <div class="card stat-card" style="--stat-color:#2f8f77;--stat-soft:#e0f2ec"><div class="card-body"><div class="stat-top"><span>已加入系统</span><span class="stat-icon">✓</span></div><div class="stat-value">${counts.saved}</div><div class="stat-meta">已转为候选岗位或投递记录</div></div></div>
        <div class="card stat-card" style="--stat-color:#4777d9;--stat-soft:#e7edfc"><div class="card-body"><div class="stat-top"><span>浏览器采集器</span><span class="stat-icon">◎</span></div><div class="stat-value">${apiOnline ? '在线' : '离线'}</div><div class="stat-meta">${apiOnline ? '本地接收接口正常' : '请确认本地服务已启动'}</div></div></div>
      </section>
      <section class="card">
        <div class="card-header"><div><h3>如何使用岗位采集器</h3><p>采集器只读取你当前打开的岗位页面，不做批量爬取</p></div><button class="btn btn-secondary btn-sm" data-action="refresh-captures">刷新采集箱</button></div>
        <div class="card-body grid grid-3 capture-steps">
          <div><span class="tag tag-blue">1</span><strong>安装扩展</strong><p>Chrome/Edge 打开扩展管理页，开启开发者模式，选择“加载已解压的扩展程序”，选中项目里的 browser-extension 文件夹。</p></div>
          <div><span class="tag tag-blue">2</span><strong>打开岗位页面</strong><p>进入公司校招官网或招聘平台职位详情页，点击浏览器工具栏里的“秋招作战台岗位采集器”。</p></div>
          <div><span class="tag tag-blue">3</span><strong>确认并发送</strong><p>检查公司、岗位、城市、投递地址和 JD，缺失字段可手动补全，然后发送到本页面。</p></div>
        </div>
      </section>
      <div class="section-title"><div><h2>采集记录</h2><p>共 ${jobs.length} 条当前筛选记录</p></div><div class="filters"><select data-field="capture-filter"><option value="new" ${ui.capturedFilter === 'new' ? 'selected' : ''}>待处理</option><option value="saved" ${ui.capturedFilter === 'saved' ? 'selected' : ''}>已加入系统</option><option value="dismissed" ${ui.capturedFilter === 'dismissed' ? 'selected' : ''}>已忽略</option><option value="all" ${ui.capturedFilter === 'all' ? 'selected' : ''}>全部</option></select></div></div>
      ${jobs.length ? jobs.map(card).join('') : `<div class="card"><div class="empty-state"><div><div class="empty-icon">⇩</div><h3>${ui.capturedLoading ? '正在读取采集箱...' : '采集箱还是空的'}</h3><p>安装浏览器采集器后，从任意岗位详情页点一下扩展，信息就会出现在这里。</p><p class="tiny muted" style="margin-top:8px">扩展目录：browser-extension</p></div></div></div>`}
    </div>`;
  }

  async function handleAction(action, id) {
    const job = ui.capturedJobs.find((item) => item.id === id);
    if (!job) return false;
    if (action === 'refresh-captures') { load(); return true; }
    if (action === 'capture-dismiss') {
      await update(id, { status: 'dismissed' });
      render();
      toast('已忽略该采集记录');
      return true;
    }
    if (action === 'capture-delete') {
      if (!confirm(`确定删除采集记录「${job.company} · ${job.role}」吗？`)) return true;
      await remove(id);
      render();
      toast('采集记录已删除');
      return true;
    }
    if (action === 'capture-to-candidate') {
      store.addCandidate({
        company: job.company, role: job.role, city: job.city, salary: job.salary,
        jdText: job.jdText, jdUrl: job.url, channel: '网页采集'
      });
      await update(id, { status: 'saved' });
      toast('已加入推荐候选池', 'success');
      navigate('opportunities');
      return true;
    }
    if (action === 'capture-to-application') {
      helpers.openApplicationFromCapture(job);
      return true;
    }
    return false;
  }

  window.QiuzhaoCapture = {
    init(context) {
      store = context.store;
      ui = context.ui;
      helpers = context.helpers;
      navigate = context.navigate;
      toast = context.toast;
      render = context.render;
    },
    load,
    render: renderPage,
    handleAction,
    update,
    counts() {
      return {
        new: (ui.capturedJobs || []).filter((item) => item.status === 'new').length,
        total: (ui.capturedJobs || []).length
      };
    }
  };
})();


