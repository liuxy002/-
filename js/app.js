(function () {
  const Q = window.Qiuzhao;
  const R = window.QiuzhaoRecommender;
  const store = new Q.RecruitmentStore();
  const main = document.getElementById('app-main');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');

  const PAGE_META = {
    dashboard: { kicker: 'Command center', title: '秋招总览', subtitle: '管理投递、面试和下一步行动' },
    applications: { kicker: 'Pipeline', title: '投递管理', subtitle: '按阶段整理所有岗位，并保持下一步清晰可见' },
    recommendations: { kicker: 'Recommendation', title: '推荐中心', subtitle: '根据历史岗位、明确偏好和 JD 技能画像排序' },
    opportunities: { kicker: 'Opportunity center', title: '机会中心', subtitle: '采集岗位、判断优先级，再决定是否加入投递' },
    capture: { kicker: 'Job capture', title: '岗位采集箱', subtitle: '接收浏览器采集器抓取的公司、岗位、JD 和投递地址' },
    reviews: { kicker: 'Interview review', title: '面试复盘', subtitle: '逐轮记录问题、回答、表现和改进，形成自己的面试题库' },
    analytics: { kicker: 'Review', title: '分析复盘', subtitle: '看转化、找瓶颈，决定下一阶段把时间投向哪里' },
    import: { kicker: 'Data import', title: '数据导入', subtitle: '从飞书 CSV 导入现有记录，或备份和迁移本地数据' },
    settings: { kicker: 'Preference', title: '偏好设置', subtitle: '告诉系统你的目标地区、岗位方向、技能和秋招目标' }
  };

  const ui = {
    page: location.hash.replace('#', '') || 'dashboard',
    applicationView: 'list',
    applicationFilter: 'active',
    applicationSort: 'applied_desc',
    search: '',
    stage: '',
    city: '',
    candidateFormOpen: false,
    importPreview: null,
    importMode: 'merge',
    capturedJobs: [],
    capturedLoading: false,
    capturedFilter: 'new',
    reviewFilter: 'all'
  };

  if (!PAGE_META[ui.page]) ui.page = 'dashboard';

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function attr(value) {
    return escapeHTML(value).replace(/\n/g, '&#10;');
  }

  function safeUrl(value) {
    try {
      const text = String(value || '').trim(); if (!text) return '#'; const candidate = /^www\./i.test(text) ? 'https://' + text : text; if (!/^https?:\/\//i.test(candidate)) return '#'; const url = new URL(candidate);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch {
      return '#';
    }
  }

  function linkAttr(value) {
    return attr(safeUrl(value));
  }

  function hasValidUrl(value) {
    return safeUrl(value) !== '#';
  }

  function urlLabel(value) {
    try {
      const url = new URL(String(value || ''));
      return url.hostname.replace(/^www\./, '');
    } catch {
      return String(value || '投递地址');
    }
  }

  function fmtDate(value, fallback = '未填写') {
    if (!value) return fallback;
    const date = new Date(`${value}`.length <= 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(date);
  }

  function fmtDateTime(value, fallback = '未填写') {
    if (!value) return fallback;
    const normalized = `${value}`.replace(' ', 'T');
    const date = new Date(normalized.length <= 10 ? `${normalized}T00:00:00` : normalized);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function dateInputValue(value) {
    if (!value) return '';
    return `${value}`.slice(0, 10);
  }

  function today() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function daysUntil(value) {
    if (!value) return Infinity;
    const text = String(value);
    const target = new Date(text.includes('T') ? text : text + 'T00:00:00').getTime();
    const start = new Date(`${today()}T00:00:00`).getTime();
    return Math.round((target - start) / 86400000);
  }

  function stageInfo(key) {
    return Q.STAGES.find((stage) => stage.key === key) || Q.STAGES[0];
  }

  function statusTag(status) {
    const stage = stageInfo(status);
    const style = stage.order >= 4 ? 'tag-teal' : stage.order >= 3 ? 'tag-accent' : stage.order >= 2 ? 'tag-violet' : 'tag-blue';
    return `<span class="tag ${style}"><span class="status-dot"></span>${escapeHTML(status)}</span>`;
  }

  function outcomeTag(outcome) {
    const cls = outcome === '已Offer' ? 'tag-teal' : outcome === '已拒绝' ? 'tag-danger' : outcome === '主动放弃' ? 'tag-amber' : outcome === '无回复' ? 'tag-danger' : 'tag-blue';
    return `<span class="tag ${cls}">${escapeHTML(outcome || '等待中')}</span>`;
  }

  function priorityTag(priority) {
    const value = priority || '中';
    const cls = /高/.test(value) ? 'priority-high' : /低/.test(value) ? 'priority-low' : 'priority-mid';
    return `<span class="tag ${cls}">${escapeHTML(value)}优先级</span>`;
  }

  function isSubmitted(application) {
    return stageInfo(application.status).order >= 1 || Boolean(application.appliedAt);
  }

  function isClosed(application) {
    return application.status === '已结束' || ['已Offer', '已拒绝', '主动放弃'].includes(application.outcome);
  }

  function isActive(application) {
    return !isClosed(application);
  }

  function isResponded(application) {
    return stageInfo(application.status).order >= 2 || ['已Offer', '已拒绝'].includes(application.outcome);
  }

  function isInterviewed(application) {
    return stageInfo(application.status).order >= 3 || ['已Offer', '已拒绝'].includes(application.outcome) && /面试/.test(application.notes || '');
  }

  function isOffer(application) {
    return application.status === 'Offer' || application.outcome === '已Offer';
  }

  function getStats(applications = store.state.applications) {
    const submitted = applications.filter(isSubmitted).length;
    const responded = applications.filter(isResponded).length;
    const interviewed = applications.filter(isInterviewed).length;
    const offers = applications.filter(isOffer).length;
    const active = applications.filter(isActive).length;
    return {
      total: applications.length,
      submitted,
      responded,
      interviewed,
      offers,
      active,
      responseRate: submitted ? Math.round(responded / submitted * 100) : 0,
      interviewRate: submitted ? Math.round(interviewed / submitted * 100) : 0,
      offerRate: submitted ? Math.round(offers / submitted * 100) : 0
    };
  }

  function groupCount(applications, getter) {
    const groups = new Map();
    applications.forEach((application) => {
      const raw = getter(application);
      const values = Array.isArray(raw) ? raw : [raw];
      values.filter(Boolean).forEach((value) => {
        const key = String(value).trim();
        if (!key) return;
        if (!groups.has(key)) groups.set(key, { key, total: 0, responded: 0, interviewed: 0, offers: 0 });
        const group = groups.get(key);
        group.total += 1;
        if (isResponded(application)) group.responded += 1;
        if (isInterviewed(application)) group.interviewed += 1;
        if (isOffer(application)) group.offers += 1;
      });
    });
    return [...groups.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, 'zh-CN'));
  }

  function buildTasks() {
    const tasks = [];
    store.state.applications.filter(isActive).forEach((application) => {
      const label = `${application.company} · ${application.role}`;
      if (application.deadline && stageInfo(application.status).order < 1) {
        const days = daysUntil(application.deadline);
        if (days <= 7) tasks.push({ id: `deadline-${application.id}-${application.deadline}`, applicationId: application.id, type: 'deadline', title: days < 0 ? `已过截止：${label}` : `投递截止：${label}`, detail: application.deadline, due: application.deadline, priority: days <= 2 ? 100 : 80, icon: '⏱' });
      }
      if (application.nextActionAt) {
        const days = daysUntil(application.nextActionAt);
        if (days <= 3) tasks.push({ id: `next-${application.id}-${application.nextActionAt}`, applicationId: application.id, type: 'next', title: application.nextAction || `跟进：${label}`, detail: `${label} · ${fmtDate(application.nextActionAt)}`, due: application.nextActionAt, priority: days < 0 ? 110 : 75, icon: '→' });
      }
      if (application.assessmentAt) {
        const days = daysUntil(application.assessmentAt);
        if (days >= 0 && days <= 14) tasks.push({ id: `assessment-${application.id}-${application.assessmentAt}`, applicationId: application.id, type: 'assessment', title: `${application.assessmentType || '测评/笔试'}提醒：${label}`, detail: `${fmtDateTime(application.assessmentAt)} · 建议提前准备设备与材料`, due: application.assessmentAt, priority: days <= 2 ? 115 : 85, icon: '◎' });
      }
      if (application.interviewAt) {
        const days = daysUntil(application.interviewAt);
        if (days >= 0 && days <= 14) tasks.push({ id: `interview-${application.id}-${application.interviewAt}`, applicationId: application.id, type: 'interview', title: `面试准备：${label}`, detail: `${fmtDateTime(application.interviewAt)} · ${application.interviewRound || '面试'}`, due: application.interviewAt, priority: days <= 2 ? 120 : 90, icon: '◉' });
      }
      if (stageInfo(application.status).order >= 3 && !store.state.reviews.some((review) => review.applicationId === application.id)) {
        tasks.push({ id: `review-${application.id}-${application.interviewAt || application.updatedAt}`, applicationId: application.id, type: 'review', title: `补充面试复盘：${application.company} · ${application.role}`, detail: '记录本轮问题、回答和改进方向', due: today(), priority: 70, icon: '◉' });
      }
      if (application.appliedAt && stageInfo(application.status).order === 1 && application.outcome === '等待中') {
        const elapsed = -daysUntil(application.appliedAt);
        if (elapsed >= 10) tasks.push({ id: `follow-${application.id}-${application.appliedAt}`, applicationId: application.id, type: 'follow', title: `建议跟进：${label}`, detail: `已投递 ${elapsed} 天，仍显示等待中`, due: today(), priority: 55, icon: '↗' });
      }
    });
    return tasks.filter((task) => !store.state.taskCompletions.some((item) => item.taskId === task.id)).sort((a, b) => b.priority - a.priority || String(a.due).localeCompare(String(b.due))).slice(0, 8);
  }

  function renderStatCard(label, value, meta, icon, color, soft) {
    return `<section class="card stat-card" style="--stat-color:${color};--stat-soft:${soft}">
      <div class="card-body">
        <div class="stat-top"><span>${escapeHTML(label)}</span><span class="stat-icon">${icon}</span></div>
        <div class="stat-value">${escapeHTML(value)}</div>
        <div class="stat-meta">${meta}</div>
      </div>
    </section>`;
  }

  function renderOnboarding() {
    const feishu = linkAttr(Q.FEISHU_URL);
    return `<div class="stack">
      <section class="hero">
        <div class="hero-content">
          <div>
            <div class="hero-kicker">2026 秋招 · 个人作战系统</div>
            <h2>先导入真实投递数据，<br>再从历史里找下一批机会。</h2>
            <p>当前浏览器还没有投递记录。飞书链接需要登录，无法由网页直接读取；从飞书导出 CSV 后，在这里导入即可。</p>
            <div class="empty-actions" style="justify-content:flex-start;margin-top:20px">
              <button class="btn btn-primary" data-action="go-import">⇧ 去导入飞书 CSV</button>
              <a class="btn btn-secondary" href="${feishu}" target="_blank" rel="noreferrer">打开飞书原表</a><button class="btn btn-secondary" data-action="add-reminder">＋ 新增提醒</button>
            </div>
          </div>
          <div class="hero-targets">
            <div class="hero-target"><strong>01</strong><span>导出 CSV</span></div>
            <div class="hero-target"><strong>02</strong><span>确认字段映射</span></div>
            <div class="hero-target"><strong>03</strong><span>开始分析推荐</span></div>
          </div>
        </div>
      </section>
      <section class="grid grid-3">
        <div class="card"><div class="card-body"><span class="tag tag-blue">记录</span><h3 style="margin-top:13px">投递与面试管理</h3><p class="muted small" style="margin-top:7px">看板、列表、时间线和下一步提醒集中在一个工作台。</p></div></div>
        <div class="card"><div class="card-body"><span class="tag tag-violet">分析</span><h3 style="margin-top:13px">找到真正瓶颈</h3><p class="muted small" style="margin-top:7px">按城市、岗位、渠道和简历版本查看响应与面试转化。</p></div></div>
        <div class="card"><div class="card-body"><span class="tag tag-teal">推荐</span><h3 style="margin-top:13px">历史结果驱动排序</h3><p class="muted small" style="margin-top:7px">不是简单关键词匹配，而是结合历史推进结果和明确偏好。</p></div></div>
      </section>
      <section class="card">
        <div class="card-header"><div><h3>从飞书拿到数据</h3><p>多维表格右上角选择导出，下载 CSV 或 Excel 后转换 CSV。</p></div></div>
        <div class="card-body grid grid-3">
          <div><span class="tag tag-blue">1</span><p class="small strong" style="margin-top:8px">导出表格</p><p class="tiny muted">飞书多维表格 → 右上角更多 → 导出为 CSV。</p></div>
          <div><span class="tag tag-blue">2</span><p class="small strong" style="margin-top:8px">上传文件</p><p class="tiny muted">系统自动识别公司、岗位、地区、状态、时间、渠道和 JD。</p></div>
          <div><span class="tag tag-blue">3</span><p class="small strong" style="margin-top:8px">检查预览</p><p class="tiny muted">确认字段映射后再写入本地数据库。</p></div>
        </div>
      </section>
    </div>`;
  }

  function renderRecommendationMini(item, index) {
    const { candidate, recommendation } = item;
    return `<div class="metric-row">
      <div class="metric-row-label">
        <strong>${index + 1}. ${escapeHTML(candidate.company)} · ${escapeHTML(candidate.role)}</strong>
        <span>${escapeHTML(candidate.city || '城市未填')} · ${escapeHTML(recommendation.category)} · ${escapeHTML(recommendation.reasons[0] || '等待补充 JD')}</span>
      </div>
      <div class="metric-row-value" style="color:var(--teal)">${recommendation.score}</div>
    </div>`;
  }

  function renderDashboard() {
    return window.QiuzhaoDashboard.render();
  }

  function applicationMatches(application) {
    if (ui.applicationFilter === 'active' && !isActive(application)) return false;
    if (ui.applicationFilter === 'closed' && !isClosed(application)) return false;
    if (ui.stage && application.status !== ui.stage) return false;
    if (ui.city && application.city !== ui.city) return false;
    if (ui.search) {
      const haystack = [application.company, application.role, application.city, application.channel, application.industry, application.jdUrl, application.jdText, application.notes].join(' ').toLowerCase();
      if (!haystack.includes(ui.search.toLowerCase())) return false;
    }
    return true;
  }

  function getFilteredApplications() {
    const applications = [...store.state.applications].filter(applicationMatches);
    const priorityScore = (value) => ({ 高: 3, 中: 2, 低: 1 }[value] || 0);
    const sorters = {
      applied_desc: (a, b) => String(b.appliedAt || b.updatedAt).localeCompare(String(a.appliedAt || a.updatedAt)),
      applied_asc: (a, b) => String(a.appliedAt || a.updatedAt).localeCompare(String(b.appliedAt || b.updatedAt)),
      updated_desc: (a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)),
      deadline_asc: (a, b) => String(a.deadline || '9999-12-31').localeCompare(String(b.deadline || '9999-12-31')),
      company_asc: (a, b) => a.company.localeCompare(b.company, 'zh-CN'),
      priority_desc: (a, b) => priorityScore(b.priority) - priorityScore(a.priority) || String(b.updatedAt).localeCompare(String(a.updatedAt)),
      stage_desc: (a, b) => stageInfo(b.status).order - stageInfo(a.status).order || String(b.updatedAt).localeCompare(String(a.updatedAt))
    };
    return applications.sort(sorters[ui.applicationSort] || sorters.applied_desc);
  }
  function renderApplicationTable(applications) {
    if (!applications.length) return `<div class="empty-state"><div><div class="empty-icon">⌕</div><h3>没有符合筛选条件的记录</h3><p>换一个筛选条件，或者新增一条投递记录。</p></div></div>`;
    return `<div class="table-wrap"><table class="data-table">
      <thead><tr><th>公司与岗位</th><th>地区</th><th>阶段</th><th>结果</th><th>投递日期</th><th>投递地址</th><th>渠道 / 简历</th><th>下一步</th><th></th></tr></thead>
      <tbody>${applications.map((application) => `<tr data-application-id="${attr(application.id)}" ondblclick="window.QiuzhaoApp.openApplicationModal(this.dataset.applicationId)" title="双击快速编辑">
        <td><div class="company-cell"><div class="company-avatar">${escapeHTML(application.company.slice(0, 1))}</div><div><strong>${escapeHTML(application.company)}</strong><span>${escapeHTML(application.role)}</span></div></div></td>
        <td>${escapeHTML(application.city || '未填写')}</td>
        <td>${statusTag(application.status)}</td>
        <td>${outcomeTag(application.outcome)}</td>
        <td>${fmtDate(application.appliedAt, '未投递')}</td>
        <td>${hasValidUrl(application.jdUrl) ? `<div class="url-cell"><a class="text-link" href="${linkAttr(application.jdUrl)}" target="_blank" rel="noreferrer" title="${attr(application.jdUrl)}">${escapeHTML(application.jdUrl)}</a><span>${escapeHTML(urlLabel(application.jdUrl))}</span></div>` : '<span class="tiny muted">未记录</span>'}</td>
        <td><strong>${escapeHTML(application.channel || '未填写')}</strong><br><span class="tiny muted">${escapeHTML(application.resumeVersion || '未记录简历版本')}</span></td>
        <td><span class="small">${escapeHTML(application.nextAction || '暂无行动')}</span><br><span class="tiny muted">${fmtDate(application.nextActionAt, '')}</span></td>
        <td><div class="row-actions"><button class="btn btn-secondary btn-sm" data-action="open-application" data-id="${attr(application.id)}">详情</button></div></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function renderKanban() {
    const applications = getFilteredApplications();
    return `<div class="kanban">${Q.STAGES.map((stage) => {
      const cards = applications.filter((application) => application.status === stage.key);
      return `<section class="kanban-col">
        <div class="kanban-head"><strong><span class="status-dot" style="color:${stage.color}"></span>${escapeHTML(stage.key)}</strong><span class="tag">${cards.length}</span></div>
        <div class="kanban-cards">${cards.map((application) => `<article class="kanban-card" data-action="open-application" data-id="${attr(application.id)}">
          <strong>${escapeHTML(application.company)}</strong><p>${escapeHTML(application.role)}</p>
          <div class="card-meta"><span class="tiny muted">${escapeHTML(application.city || '城市未填')} · ${fmtDate(application.appliedAt, '未投递')}</span>${application.priority === '高' ? '<span class="tag priority-high">高</span>' : ''}</div>
          ${hasValidUrl(application.jdUrl) ? `<a class="kanban-link" href="${linkAttr(application.jdUrl)}" target="_blank" rel="noreferrer" data-action="ignore-card" title="${attr(application.jdUrl)}">↗ 投递地址 · ${escapeHTML(urlLabel(application.jdUrl))}</a>` : '<span class="kanban-link missing">投递地址未记录</span>'}
        </article>`).join('') || '<p class="tiny muted" style="padding:9px">暂无记录</p>'}</div>
      </section>`;
    }).join('')}</div>`;
  }

  function renderApplications() {
    const applications = getFilteredApplications();
    const cities = [...new Set(store.state.applications.map((item) => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const stages = Q.STAGES;
    return `<div class="stack">
      <div class="card">
        <div class="card-body toolbar">
          <div class="filters">
            <div class="search-box"><span>⌕</span><input class="input" data-field="application-search" placeholder="搜索公司、岗位、城市或 JD" value="${attr(ui.search)}"></div>
            <select data-field="application-filter" aria-label="记录范围">
              <option value="active" ${ui.applicationFilter === 'active' ? 'selected' : ''}>进行中</option>
              <option value="all" ${ui.applicationFilter === 'all' ? 'selected' : ''}>全部记录</option>
              <option value="closed" ${ui.applicationFilter === 'closed' ? 'selected' : ''}>已结束</option>
            </select>
            <select data-field="application-stage" aria-label="筛选阶段">
              <option value="">全部阶段</option>${stages.map((stage) => `<option value="${attr(stage.key)}" ${ui.stage === stage.key ? 'selected' : ''}>${escapeHTML(stage.key)}</option>`).join('')}
            </select>
            <select data-field="application-city" aria-label="筛选城市">
              <option value="">全部城市</option>${cities.map((city) => `<option value="${attr(city)}" ${ui.city === city ? 'selected' : ''}>${escapeHTML(city)}</option>`).join('')}
            </select>
            <select data-field="application-sort" aria-label="排序方式">
              <option value="applied_desc" ${ui.applicationSort === 'applied_desc' ? 'selected' : ''}>投递时间：最新</option>
              <option value="applied_asc" ${ui.applicationSort === 'applied_asc' ? 'selected' : ''}>投递时间：最早</option>
              <option value="updated_desc" ${ui.applicationSort === 'updated_desc' ? 'selected' : ''}>最近更新</option>
              <option value="deadline_asc" ${ui.applicationSort === 'deadline_asc' ? 'selected' : ''}>截止时间：最近</option>
              <option value="company_asc" ${ui.applicationSort === 'company_asc' ? 'selected' : ''}>公司名称</option>
              <option value="priority_desc" ${ui.applicationSort === 'priority_desc' ? 'selected' : ''}>优先级：高到低</option>
              <option value="stage_desc" ${ui.applicationSort === 'stage_desc' ? 'selected' : ''}>流程阶段：由后到前</option>
            </select>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <div style="display:flex;border:1px solid var(--line);border-radius:11px;overflow:hidden">
              <button class="btn btn-sm ${ui.applicationView === 'list' ? 'btn-dark' : 'btn-ghost'}" style="border-radius:0" data-action="view-list">列表</button>
              <button class="btn btn-sm ${ui.applicationView === 'kanban' ? 'btn-dark' : 'btn-ghost'}" style="border-radius:0" data-action="view-kanban">看板</button>
            </div>
            <button class="btn btn-primary btn-sm" data-action="add-application">＋ 新增</button>
          </div>
        </div>
      </div>

      <div class="section-title"><div><h2>${ui.applicationView === 'list' ? '投递列表' : '阶段看板'}</h2><p>共 ${applications.length} 条符合当前筛选条件</p></div><span class="tiny muted">双击任意记录快速填写编辑</span></div>
      <section class="card">${ui.applicationView === 'list' ? renderApplicationTable(applications) : `<div class="card-body">${renderKanban()}</div>`}</section>
    </div>`;
  }

  function renderRecommendationCard(item, index) {
    const { candidate, recommendation } = item;
    const scoreColor = recommendation.score >= 76 ? '#2f8f77' : recommendation.score >= 60 ? '#4777d9' : '#d99528';
    const saved = candidate.candidateStatus === 'saved';
    return `<article class="recommendation-card">
      <div class="recommendation-top">
        <div class="recommendation-title"><h3>${index + 1}. ${escapeHTML(candidate.company)} · ${escapeHTML(candidate.role)}</h3><p>${escapeHTML([candidate.city, candidate.industry, candidate.channel].filter(Boolean).join(' · ') || '信息待补充')}</p></div>
        <div class="score-ring" style="--score:${recommendation.score};--score-color:${scoreColor}"><div><strong>${recommendation.score}</strong><span>匹配</span></div></div>
      </div>
      <div class="recommendation-reasons"><span class="tag ${recommendation.category === '高匹配' ? 'tag-teal' : recommendation.category === '高成功率' ? 'tag-blue' : 'tag-violet'}">${escapeHTML(recommendation.category)}</span>${recommendation.reasons.slice(0, 4).map((reason) => `<span class="tag">${escapeHTML(reason)}</span>`).join('')}</div>
      ${recommendation.warnings.length ? `<p class="recommendation-warnings">注意：${recommendation.warnings.map(escapeHTML).join('；')}</p>` : ''}
      <div class="component-bars">
        <div class="component"><span>偏好匹配</span><strong>${recommendation.components.preference}</strong></div>
        <div class="component"><span>历史信号</span><strong>${recommendation.components.history}</strong></div>
        <div class="component"><span>信息完整</span><strong>${recommendation.components.completeness}</strong></div>
        <div class="component"><span>推荐样本</span><strong>${recommendation.sampleSize}</strong></div>
      </div>
      <div class="recommendation-actions">
        <span class="tiny muted">${candidate.jdText ? `JD ${candidate.jdText.length} 字` : '缺少 JD 原文'}</span>
        <div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">
          ${hasValidUrl(candidate.jdUrl) ? `<a class="btn btn-ghost btn-sm" href="${linkAttr(candidate.jdUrl)}" target="_blank" rel="noreferrer">原链接</a>` : ''}
          <button class="btn btn-secondary btn-sm" data-action="dismiss-candidate" data-id="${attr(candidate.id)}">不感兴趣</button>
          <button class="btn ${saved ? 'btn-dark' : 'btn-secondary'} btn-sm" data-action="save-candidate" data-id="${attr(candidate.id)}">${saved ? '已收藏' : '收藏'}</button>
          <button class="btn btn-primary btn-sm" data-action="candidate-to-application" data-id="${attr(candidate.id)}">加入投递</button>
        </div>
      </div>
    </article>`;
  }

  function renderRecommendations() {
    const ranked = R.rankCandidates(store.state);
    const activeCount = store.state.candidates.filter((item) => item.candidateStatus !== 'dismissed').length;
    const applications = store.state.applications;
    const prefs = store.state.preferences;
    return `<div class="stack">
      <section class="grid grid-3">
        <div class="card stat-card" style="--stat-color:#2f8f77;--stat-soft:#e0f2ec"><div class="card-body"><div class="stat-top"><span>候选岗位</span><span class="stat-icon">✦</span></div><div class="stat-value">${activeCount}</div><div class="stat-meta">可参与排序</div></div></div>
        <div class="card stat-card" style="--stat-color:#4777d9;--stat-soft:#e7edfc"><div class="card-body"><div class="stat-top"><span>历史样本</span><span class="stat-icon">⌁</span></div><div class="stat-value">${applications.length}</div><div class="stat-meta">用于学习岗位和结果特征</div></div></div>
        <div class="card stat-card" style="--stat-color:#7658bd;--stat-soft:#eee8fb"><div class="card-body"><div class="stat-top"><span>偏好维度</span><span class="stat-icon">◎</span></div><div class="stat-value">${[prefs.cities,prefs.roles,prefs.industries,prefs.skills].filter(Boolean).length}/4</div><div class="stat-meta">地区、岗位、行业、技能</div></div></div>
      </section>

      <section class="grid grid-sidebar">
        <div class="stack">
          <div class="card">
            <div class="card-header"><div><h3>添加候选岗位</h3><p>粘贴完整 JD，排序和推荐理由会更准确</p></div></div>
            <div class="card-body">
              <form data-form="candidate-create">
                <div class="form-grid cols-3">
                  <div class="field"><label>公司</label><input name="company" required placeholder="例如：某科技公司"></div>
                  <div class="field"><label>岗位</label><input name="role" required placeholder="例如：商业分析"></div>
                  <div class="field"><label>城市</label><input name="city" placeholder="例如：上海"></div>
                  <div class="field"><label>行业</label><input name="industry" placeholder="例如：互联网"></div>
                  <div class="field"><label>招聘渠道</label><input name="channel" placeholder="官网 / 牛客 / 内推"></div>
                  <div class="field"><label>投递地址 / 岗位链接</label><input name="jdUrl" type="url" placeholder="https://"></div>
                  <div class="field span-3"><label>岗位 JD</label><textarea name="jdText" class="tall" placeholder="粘贴职位职责、任职要求、技能关键词等完整内容"></textarea></div>
                </div>
                <div class="form-actions"><button class="btn btn-primary" type="submit">分析并加入候选池</button></div>
              </form>
            </div>
          </div>

          <div class="section-title"><div><h2>推荐排序</h2><p>得分不是绝对成功率，而是当前信息下的机会优先级</p></div><span class="tiny muted">历史数据越多，排序越贴近你的实际结果</span></div>
          ${ranked.length ? ranked.map(renderRecommendationCard).join('') : `<div class="card"><div class="empty-state"><div><div class="empty-icon">✦</div><h3>候选池还是空的</h3><p>从招聘网站复制一个完整 JD 到上方表单，系统会结合你的投递历史和偏好开始排序。</p></div></div></div>`}
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-header"><div><h3>当前推荐依据</h3><p>你可以随时调整这些偏好</p></div><button class="btn btn-ghost btn-sm" data-action="go-settings">修改</button></div>
            <div class="card-body">
              <div class="metric-row"><div class="metric-row-label"><strong>目标城市</strong><span>${escapeHTML(prefs.cities || '未设置')}</span></div></div>
              <div class="metric-row"><div class="metric-row-label"><strong>岗位方向</strong><span>${escapeHTML(prefs.roles || '未设置')}</span></div></div>
              <div class="metric-row"><div class="metric-row-label"><strong>目标技能</strong><span>${escapeHTML(prefs.skills || '未设置')}</span></div></div>
              <div class="metric-row"><div class="metric-row-label"><strong>排除关键词</strong><span>${escapeHTML(prefs.excluded || '未设置')}</span></div></div>
            </div>
          </div>
          <div class="card"><div class="card-body">
            <h3>排序逻辑</h3>
            <p class="small muted" style="margin-top:8px">V1 会综合历史 JD 相似度、投递结果、岗位方向、城市、技能和资料完整度。Offer、面试、测评和响应会获得不同的正向权重；拒绝、无回复和主动不感兴趣会降低相近岗位的优先级。</p>
            <div class="notice notice-warning" style="margin-top:13px">历史样本少于 8 条时，结果以偏好匹配为主，不要把它当成确定性的成功率预测。</div>
          </div></div>
        </div>
      </section>
    </div>`;
  }

  function renderSettings() {
    const p = store.state.preferences;
    const stats = getStats();
    return `<div class="stack">
      <section class="card">
        <div class="card-header"><div><h3>求职偏好</h3><p>多个选项用逗号、顿号或换行分隔</p></div></div>
        <div class="card-body">
          <form data-form="settings">
            <div class="form-grid">
              <div class="field"><label>目标城市</label><textarea name="cities" placeholder="上海、北京、杭州">${escapeHTML(p.cities)}</textarea><span class="field-help">用于判断岗位地区是否符合目标</span></div>
              <div class="field"><label>岗位方向</label><textarea name="roles" placeholder="数据分析、商业分析、产品运营">${escapeHTML(p.roles)}</textarea><span class="field-help">推荐排序的核心偏好之一</span></div>
              <div class="field"><label>目标行业</label><textarea name="industries" placeholder="互联网、消费、金融">${escapeHTML(p.industries)}</textarea></div>
              <div class="field"><label>希望岗位重点出现的技能</label><textarea name="skills" placeholder="SQL、Python、Excel、Tableau">${escapeHTML(p.skills)}</textarea></div>
              <div class="field"><label>排除关键词</label><textarea name="excluded" placeholder="销售、电话客服、外包">${escapeHTML(p.excluded)}</textarea><span class="field-help">命中后会在推荐理由中标出并降低分数</span></div>
              <div class="field"><label>简历能力画像</label><textarea name="resumeProfile" placeholder="可粘贴简历的技能、项目、实习经历摘要，供后续版本做匹配分析">${escapeHTML(p.resumeProfile)}</textarea></div>
              <div class="field"><label>投递目标数</label><input name="targetApplications" type="number" min="1" value="${attr(p.targetApplications || 60)}"></div>
              <div class="field"><label>每周投递目标</label><input name="weeklyTarget" type="number" min="1" value="${attr(p.weeklyTarget || 10)}"></div>
              <div class="field"><label>每日投递目标</label><input name="dailyTarget" type="number" min="1" value="${attr(p.dailyTarget || 2)}"></div>
              <div class="field"><label>Offer 目标数</label><input name="targetOffers" type="number" min="1" value="${attr(p.targetOffers || 1)}"></div>
            </div>
            <div class="form-actions"><button class="btn btn-primary" type="submit">保存偏好</button></div>
          </form>
        </div>
      </section>
      <section class="grid grid-3">
        ${renderStatCard('总记录', stats.total, '当前本地数据库中的岗位', '▦', '#4777d9', '#e7edfc')}
        ${renderStatCard('有效投递', stats.submitted, `响应率 ${stats.responseRate}%`, '↗', '#7658bd', '#eee8fb')}
        ${renderStatCard('本地备份', 'JSON', `最后更新 ${fmtDateTime(store.state.meta.lastUpdatedAt)}`, '⇩', '#2f8f77', '#e0f2ec')}
      </section>
    </div>`;
  }

  function renderBarList(groups, emptyText = '暂无数据', rateMode = false) {
    if (!groups.length) return `<p class="muted small">${escapeHTML(emptyText)}</p>`;
    const max = Math.max(...groups.map((item) => rateMode ? item.responded : item.total), 1);
    return `<div class="bar-list">${groups.slice(0, 8).map((item, index) => {
      const value = rateMode ? item.responded : item.total;
      const rate = item.total ? Math.round(item.responded / item.total * 100) : 0;
      return `<div class="bar-item"><div class="bar-item-label"><strong>${escapeHTML(item.key)}</strong><span>${item.total} 个投递${rateMode ? ` · 响应率 ${rate}%` : ` · ${item.responded} 个响应`}</span></div><div class="bar-track"><span style="width:${value / max * 100}%;--bar-color:${['#4777d9','#7658bd','#ef6548','#2f8f77','#d99528','#5d63c9'][index % 6]}"></span></div><div class="bar-value">${value}</div></div>`;
    }).join('')}</div>`;
  }

  function weeklyTrend(applications, weeks = 10) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((weeks - 1) * 7));
    const buckets = Array.from({ length: weeks }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index * 7);
      return { start: date, end: new Date(date.getTime() + 6 * 86400000), count: 0, responses: 0 };
    });
    applications.filter(isSubmitted).forEach((application) => {
      const date = new Date(`${application.appliedAt || application.createdAt.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;
      const bucket = buckets.find((item) => date >= item.start && date <= item.end);
      if (bucket) {
        bucket.count += 1;
        if (isResponded(application)) bucket.responses += 1;
      }
    });
    return buckets;
  }

  function renderTrendChart(applications) {
    const buckets = weeklyTrend(applications);
    const width = 720;
    const height = 130;
    const padding = 18;
    const max = Math.max(1, ...buckets.map((item) => item.count));
    const points = buckets.map((item, index) => {
      const x = padding + index * ((width - padding * 2) / Math.max(1, buckets.length - 1));
      const y = height - padding - (item.count / max) * (height - padding * 2);
      return { x, y, ...item };
    });
    const line = points.map((point) => `${point.x},${point.y}`).join(' ');
    const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="每周投递趋势">
      ${[0.25,0.5,0.75].map((ratio) => `<line class="grid-line" x1="${padding}" x2="${width - padding}" y1="${padding + ratio * (height - padding * 2)}" y2="${padding + ratio * (height - padding * 2)}"></line>`).join('')}
      <polygon class="area" points="${area}"></polygon><polyline class="line" points="${line}"></polyline>
      ${points.map((point) => `<circle class="point" cx="${point.x}" cy="${point.y}" r="3.5"><title>${point.start.getMonth() + 1}/${point.start.getDate()} 当周：${point.count} 个投递</title></circle>`).join('')}
    </svg><div class="chart-caption"><span>${buckets[0].start.getMonth() + 1}/${buckets[0].start.getDate()}</span><span>每周投递趋势</span><span>${buckets[buckets.length - 1].start.getMonth() + 1}/${buckets[buckets.length - 1].start.getDate()}</span></div>`;
  }

  function renderAnalytics() {
    const applications = store.state.applications;
    if (!applications.length) {
      return `<div class="card"><div class="empty-state"><div><div class="empty-icon">◒</div><h3>还没有可分析的数据</h3><p>导入飞书投递记录后，这里会自动生成地区、岗位、渠道、流程转化和趋势分析。</p><div class="empty-actions"><button class="btn btn-primary" data-action="go-import">导入投递数据</button></div></div></div></div>`;
    }
    const stats = getStats();
    const cityGroups = groupCount(applications, (item) => item.city);
    const roleGroups = groupCount(applications, (item) => item.role);
    const channelGroups = groupCount(applications, (item) => item.channel || '未记录');
    const resumeGroups = groupCount(applications, (item) => item.resumeVersion || '未记录');
    const assessed = applications.filter((item) => stageInfo(item.status).order >= 2 || isInterviewed(item) || isOffer(item)).length;
    const funnel = [
      { label: '已投递', value: stats.submitted, color: '#4777d9' },
      { label: '收到响应', value: stats.responded, color: '#7658bd' },
      { label: '测评分发', value: assessed, color: '#d99528' },
      { label: '进入面试', value: stats.interviewed, color: '#ef6548' },
      { label: 'Offer', value: stats.offers, color: '#2f8f77' }
    ];
    const outcomes = [
      { key: '等待中', count: applications.filter((item) => item.outcome === '等待中').length, color: '#4777d9' },
      { key: '已Offer', count: applications.filter((item) => item.outcome === '已Offer').length, color: '#2f8f77' },
      { key: '已拒绝', count: applications.filter((item) => item.outcome === '已拒绝').length, color: '#ef6548' },
      { key: '无回复', count: applications.filter((item) => item.outcome === '无回复').length, color: '#a7adb4' },
      { key: '主动放弃', count: applications.filter((item) => item.outcome === '主动放弃').length, color: '#d99528' }
    ];
    const outcomeTotal = Math.max(1, outcomes.reduce((sum, item) => sum + item.count, 0));
    let angle = 0;
    const gradient = outcomes.map((item) => {
      const start = angle;
      angle += item.count / outcomeTotal * 100;
      return `${item.color} ${start}% ${angle}%`;
    }).join(', ');
    const qualifiedCities = cityGroups.filter((item) => item.total >= 3).sort((a, b) => (b.responded / b.total) - (a.responded / a.total));
    const qualifiedRoles = roleGroups.filter((item) => item.total >= 3).sort((a, b) => (b.interviewed / b.total) - (a.interviewed / a.total));
    const qualifiedChannels = channelGroups.filter((item) => item.total >= 3).sort((a, b) => (b.responded / b.total) - (a.responded / a.total));
    const insights = [
      qualifiedCities[0] ? `目标地区里，${qualifiedCities[0].key} 目前响应率最高（${Math.round(qualifiedCities[0].responded / qualifiedCities[0].total * 100)}%）。` : '地区样本还少，暂不判断城市效果。',
      qualifiedRoles[0] ? `${qualifiedRoles[0].key} 的面试转化相对领先（${Math.round(qualifiedRoles[0].interviewed / qualifiedRoles[0].total * 100)}%）。` : '岗位样本还少，建议继续累积记录。',
      qualifiedChannels[0] ? `${qualifiedChannels[0].key} 是当前响应表现较好的渠道（${Math.round(qualifiedChannels[0].responded / qualifiedChannels[0].total * 100)}%）。` : '渠道样本还少，暂不判断渠道效果。'
    ];
    return `<div class="stack">
      <section class="grid grid-4">
        ${renderStatCard('响应率', `${stats.responseRate}%`, `${stats.responded}/${stats.submitted} 个岗位`, '◎', '#4777d9', '#e7edfc')}
        ${renderStatCard('面试率', `${stats.interviewRate}%`, `${stats.interviewed} 个岗位进入面试`, '◉', '#ef6548', '#fde8e1')}
        ${renderStatCard('Offer 率', `${stats.offerRate}%`, `${stats.offers} 个 Offer`, '✓', '#2f8f77', '#e0f2ec')}
        ${renderStatCard('进行中', stats.active, `总记录 ${stats.total} 个岗位`, '⌁', '#7658bd', '#eee8fb')}
      </section>
      <section class="grid grid-sidebar">
        <div class="stack">
          <div class="card"><div class="card-header"><div><h3>投递与响应趋势</h3><p>最近 10 周的投递节奏</p></div></div><div class="card-body">${renderTrendChart(applications)}</div></div>
          <div class="card"><div class="card-header"><div><h3>流程转化</h3><p>每一层的数量会逐级减少，用于定位主要瓶颈</p></div></div><div class="card-body"><div class="funnel">${funnel.map((item, index) => {
            const previous = index ? funnel[index - 1].value : item.value;
            const width = stats.submitted ? Math.max(3, item.value / stats.submitted * 100) : 0;
            const conversion = previous ? Math.round(item.value / previous * 100) : 0;
            return `<div class="funnel-row"><span>${item.label}</span><div class="funnel-track"><span style="width:${width}%;--funnel-color:${item.color}"></span></div><strong>${item.value}<small class="muted" style="font-size:9px"> · ${conversion}%</small></strong></div>`;
          }).join('')}</div></div></div>
          <div class="card"><div class="card-header"><div><h3>渠道表现</h3><p>按已有样本的响应率排序</p></div></div><div class="card-body">${renderBarList(qualifiedChannels.length ? qualifiedChannels : channelGroups, '渠道信息不足', qualifiedChannels.length > 0)}</div></div>
        </div>
        <div class="stack">
          <div class="card"><div class="card-header"><div><h3>当前判断</h3><p>基于现有样本生成的复盘提示</p></div></div><div class="card-body stack">${insights.map((text, index) => `<div class="metric-row"><div class="metric-row-label"><strong>${index + 1}</strong><span>${escapeHTML(text)}</span></div></div>`).join('')}<div class="notice notice-warning">样本少于 3 个的组合暂不参与“最佳渠道/地区”判断，避免小样本误导。</div></div></div>
          <div class="card"><div class="card-header"><div><h3>结果分布</h3><p>所有投递的最终状态</p></div></div><div class="card-body"><div class="donut-wrap"><div class="donut" style="background:conic-gradient(${gradient})"><div class="donut-center"><div><strong>${applications.length}</strong><span>总记录</span></div></div></div><div class="legend">${outcomes.map((item) => `<div class="legend-item"><span class="legend-dot" style="background:${item.color}"></span><span>${item.key} · ${item.count}</span></div>`).join('')}</div></div></div></div>
        </div>
      </section>
      <section class="grid grid-3">
        <div class="card"><div class="card-header"><div><h3>地区分布</h3></div></div><div class="card-body">${renderBarList(cityGroups)}</div></div>
        <div class="card"><div class="card-header"><div><h3>岗位方向</h3></div></div><div class="card-body">${renderBarList(roleGroups)}</div></div>
        <div class="card"><div class="card-header"><div><h3>简历版本</h3><p>后续可继续判断版本效果</p></div></div><div class="card-body">${renderBarList(resumeGroups)}</div></div>
      </section>
    </div>`;
  }

  function demoApplications() {
    const rows = [
      ['启明科技', '商业分析', '上海', '面试中', '等待中', '2026-08-03', '官网', '商业分析V2', 'SQL、Python、Tableau', '负责业务数据分析和指标体系搭建，要求熟悉SQL、Python、Tableau，有互联网商业分析实习经验。'],
      ['澄海数据', '数据分析', '杭州', '测评', '等待中', '2026-08-09', '内推', '数据分析V3', 'SQL、Excel、A/B测试', '负责用户增长分析、A/B测试和经营报表，要求SQL熟练，有用户研究或数据运营经验。'],
      ['远山金融', '风控分析', '北京', '已拒绝', '已拒绝', '2026-07-21', '官网', '金融分析V1', 'SQL、Python、风控', '参与信贷风险策略分析，要求掌握SQL、Python和统计模型，具有风险管理意识。'],
      ['云帆科技', '产品运营', '深圳', '笔试', '等待中', '2026-08-17', '招聘平台', '运营V2', 'Excel、用户增长、竞品分析', '负责产品运营、用户增长和活动复盘，要求有数据分析能力，熟悉Excel和竞品分析。'],
      ['北辰零售', '商业分析', '上海', '已投递', '等待中', '2026-09-01', '官网', '商业分析V2', 'SQL、BI、行业研究', '支持零售业务经营分析，搭建BI看板，完成行业研究和专题分析。'],
      ['青木网络', '数据产品', '北京', 'Offer', '已Offer', '2026-07-12', '内推', '数据产品V1', 'SQL、需求分析、PRD', '负责数据产品需求分析、PRD撰写和指标体系设计，要求有数据分析基础。'],
      ['星河智能', '机器学习', '上海', '筛选中', '等待中', '2026-09-04', '官网', '算法V2', 'Python、机器学习、NLP', '参与大模型和NLP算法应用，要求熟悉Python、机器学习和深度学习框架。'],
      ['松林消费', '数据运营', '广州', '已投递', '无回复', '2026-07-18', '招聘平台', '运营V1', 'Excel、SQL、报表', '负责数据运营、日报周报和用户分层，要求Excel熟练，掌握SQL优先。'],
      ['海岳制造', '供应链分析', '苏州', '已投递', '等待中', '2026-09-08', '校园招聘', '供应链V1', 'Excel、供应链、项目管理', '支持供应链计划分析和流程优化，要求Excel和项目管理能力。'],
      ['微光传媒', '用户研究', '上海', '已结束', '主动放弃', '2026-08-12', '招聘平台', '研究V1', '用户研究、问卷、访谈', '负责用户访谈、问卷设计和研究报告，要求用户研究相关实习经验。']
    ];
    return rows.map((row) => Q.makeApplication({
      company: row[0], role: row[1], city: row[2], status: row[3], outcome: row[4], appliedAt: row[5],
      channel: row[6], resumeVersion: row[7], skills: row[8], jdText: row[9]
    }));
  }

  function renderImportPreview() {
    const preview = ui.importPreview;
    if (!preview) return '';
    const mappedKeys = Object.keys(preview.mapping);
    return `<section class="card">
      <div class="card-header"><div><h3>导入预览</h3><p>${preview.records.length} 行记录，已识别 ${mappedKeys.length} 个字段</p></div><button class="btn btn-ghost btn-sm" data-action="cancel-import">取消</button></div>
      <div class="card-body stack">
        <div class="notice ${mappedKeys.length >= 4 ? 'notice-success' : 'notice-warning'}">${mappedKeys.length >= 4 ? '字段识别完成。请确认下方映射是否符合你的飞书列名。' : '识别到的字段较少。仍可导入，原列会被保留在记录中，但分析和推荐可能不完整。'}</div>
        <div class="mapping-list"><span class="mapping-chip"><strong>公司</strong> ← ${escapeHTML(preview.mapping.company || '未识别')}</span><span class="mapping-chip"><strong>岗位</strong> ← ${escapeHTML(preview.mapping.role || '未识别')}</span><span class="mapping-chip"><strong>城市</strong> ← ${escapeHTML(preview.mapping.city || '未识别')}</span><span class="mapping-chip"><strong>状态</strong> ← ${escapeHTML(preview.mapping.status || '未识别')}</span><span class="mapping-chip"><strong>结果</strong> ← ${escapeHTML(preview.mapping.outcome || '未识别')}</span><span class="mapping-chip"><strong>投递时间</strong> ← ${escapeHTML(preview.mapping.appliedAt || '未识别')}</span><span class="mapping-chip"><strong>渠道</strong> ← ${escapeHTML(preview.mapping.channel || '未识别')}</span><span class="mapping-chip"><strong>投递地址</strong> ← ${escapeHTML(preview.mapping.jdUrl || '未识别')}</span><span class="mapping-chip"><strong>JD</strong> ← ${escapeHTML(preview.mapping.jdText || '未识别')}</span></div>
        <div class="preview-table table-wrap"><table class="data-table"><thead><tr>${preview.headers.slice(0, 8).map((header) => `<th>${escapeHTML(header)}</th>`).join('')}</tr></thead><tbody>${preview.records.slice(0, 6).map((record) => `<tr>${preview.headers.slice(0, 8).map((header) => `<td>${escapeHTML(String(record[header] ?? '').slice(0, 80))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div class="filters"><label class="checkline"><input type="radio" name="import-mode" data-field="import-mode" value="merge" ${ui.importMode === 'merge' ? 'checked' : ''}> 合并导入</label><label class="checkline"><input type="radio" name="import-mode" data-field="import-mode" value="replace" ${ui.importMode === 'replace' ? 'checked' : ''}> 替换现有记录</label></div>
          ${ui.importMode === 'replace' ? '<span class="tag tag-danger">会清空当前所有投递记录</span>' : '<span class="tag tag-blue">同公司、岗位和投递日期会更新原记录</span>'}
        </div>
        <div class="form-actions"><button class="btn btn-secondary" data-action="cancel-import">取消</button><button class="btn btn-primary" data-action="confirm-import">确认导入 ${preview.records.length} 条</button></div>
      </div>
    </section>`;
  }

  function renderImport() {
    const apps = store.state.applications;
    const imported = store.state.meta.importedAt;
    const backups = store.getBackups();
    return `<div class="stack">
      <section class="grid grid-sidebar">
        <div class="stack">
          <div class="card">
            <div class="card-header"><div><h3>飞书表格导入</h3><p>网页无法直接读取需要登录的飞书表格，请先导出 CSV 再上传</p></div></div>
            <div class="card-body stack">
              <div class="import-source">
                <div class="import-source-icon">▤</div>
                <div style="flex:1;min-width:0"><strong>你的飞书多维表格</strong><p class="small muted" style="margin-top:4px">系统已记录原表链接。建议先查看当前视图，确认没有筛选掉需要导入的记录。</p><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-secondary btn-sm" href="${linkAttr(Q.FEISHU_URL)}" target="_blank" rel="noreferrer">打开飞书原表</a><span class="tag ${imported ? 'tag-teal' : 'tag-amber'}">${imported ? `上次导入 ${fmtDateTime(imported)}` : '尚未导入'}</span></div></div>
              </div>
              <div class="notice notice-info">如果 Excel 提示“不支持包含多份工作表”，先选中「投递进度总表」，再另存为「CSV UTF-8（逗号分隔）」，点击“确定”即可只导出当前工作表。其他工作表会保留在原来的 Excel 文件中。</div>
              <div class="drop-zone" id="drop-zone">
                <div style="font-size:28px;margin-bottom:6px">⇧</div><strong>拖入 CSV / JSON 文件，或点击选择</strong><p>CSV 支持逗号分隔、引号换行和常见中文列名</p>
                <input id="import-file" type="file" accept=".csv,.json,text/csv,application/json" hidden>
                <button class="btn btn-primary btn-sm" style="margin-top:13px" data-action="choose-import-file">选择文件</button>
              </div>
              <details><summary class="small strong" style="cursor:pointer">也可以直接粘贴 CSV 内容</summary><div class="field" style="margin-top:11px"><textarea id="import-text" class="tall" placeholder="公司,岗位,地区,状态,投递时间..."></textarea></div><div class="form-actions" style="margin-top:11px"><button class="btn btn-secondary" data-action="parse-import-text">解析粘贴内容</button></div></details>
            </div>
          </div>
          ${renderImportPreview()}
        </div>

        <div class="stack">
          <div class="card"><div class="card-header"><div><h3>数据概览</h3><p>导入后可在各模块继续编辑</p></div></div><div class="card-body">
            <div class="metric-row"><div class="metric-row-label"><strong>投递记录</strong><span>当前本地数据库</span></div><strong>${apps.length}</strong></div>
            <div class="metric-row"><div class="metric-row-label"><strong>候选岗位</strong><span>推荐中心候选池</span></div><strong>${store.state.candidates.length}</strong></div>
            <div class="metric-row"><div class="metric-row-label"><strong>有 JD 原文</strong><span>用于历史相似度推荐</span></div><strong>${apps.filter((item) => item.jdText).length}</strong></div>
            <div class="metric-row"><div class="metric-row-label"><strong>有投递时间</strong><span>用于趋势和响应速度分析</span></div><strong>${apps.filter((item) => item.appliedAt).length}</strong></div>
          </div></div>
          <div class="card"><div class="card-header"><div><h3>备份与迁移</h3><p>浏览器数据容易被清理，建议定期下载 JSON 备份</p></div></div><div class="card-body stack">
            <button class="btn btn-primary" data-action="export-json">⇩ 导出全量 JSON 备份</button>
            <button class="btn btn-secondary" data-action="export-csv">⇩ 导出投递记录 CSV</button>
            <button class="btn btn-secondary" data-action="export-reviews-csv">⇩ 导出面试复盘 CSV</button>
            <div class="notice notice-warning">清理浏览器缓存可能会删除本地数据。正式投入秋招管理前，请至少导出一份备份。</div>
          </div></div>
          <div class="card"><div class="card-header"><div><h3>自动备份</h3><p>系统已启用本地自动备份</p></div></div><div class="card-body"><p class="muted small">完成数据修改后，系统会保留每日快照。</p></div></div>
            <button class="btn btn-secondary" data-action="load-demo">载入 10 条演示数据</button>
            <button class="btn btn-danger" data-action="clear-data">清空本地数据</button>
            <p class="tiny muted">演示数据均为虚构内容，载入时会替换当前投递记录。</p>
          </div></div>
        </div>
      </section>
    </div>`;
  }

  function openCompletedTasksModal() {
    const items = store.state.taskCompletions || [];
    const { escapeHTML, attr } = { escapeHTML, attr };
    const html = `<div class="modal-header"><div><h2>已完成任务</h2><p>误操作可以撤销，任务会重新回到首页</p></div><button class="btn btn-ghost btn-icon" data-action="close-modal">×</button></div><div class="modal-body">${items.length ? `<div class="task-list">${items.map((item) => `<div class="task-item"><div class="task-main"><strong>${escapeHTML(item.label || '已完成任务')}</strong><p>${fmtDateTime(item.completedAt)}</p></div><button class="btn btn-secondary btn-sm" data-action="reopen-task" data-task-id="${attr(item.taskId)}">撤销完成</button></div>`).join('')}</div>` : '<div class="empty-state compact"><p class="muted small">还没有已完成任务。</p></div>'}</div>`;
    showModal(html, 'narrow');
  }

  function showModal(html, className = '') {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal ${className}" role="dialog" aria-modal="true">${html}</section></div>`;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalRoot.innerHTML = '';
    document.body.style.overflow = '';
  }

  function toast(message, type = '') {
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    toastRoot.appendChild(item);
    setTimeout(() => item.remove(), 3200);
  }

  function applicationFormHTML(application = {}) {
    const item = Q.makeApplication(application);
    return `<form data-form="application-save">
      <input type="hidden" name="id" value="${attr(application.id || '')}">
      <input type="hidden" name="captureId" value="${attr(application.captureId || '')}">
      <div class="form-grid cols-3">
        <div class="field"><label>公司 *</label><input name="company" required value="${attr(item.company === '未命名公司' ? '' : item.company)}" placeholder="公司名称"></div>
        <div class="field"><label>岗位 *</label><input name="role" required value="${attr(item.role === '未命名岗位' ? '' : item.role)}" placeholder="岗位名称"></div>
        <div class="field"><label>城市</label><input name="city" value="${attr(item.city)}" placeholder="上海"></div>
        <div class="field"><label>当前阶段</label><select name="status">${Q.STAGES.map((stage) => `<option value="${attr(stage.key)}" ${item.status === stage.key ? 'selected' : ''}>${escapeHTML(stage.key)}</option>`).join('')}</select></div>
        <div class="field"><label>最终结果</label><select name="outcome">${Q.OUTCOMES.map((outcome) => `<option value="${attr(outcome)}" ${item.outcome === outcome ? 'selected' : ''}>${escapeHTML(outcome)}</option>`).join('')}</select></div>
        <div class="field"><label>优先级</label><select name="priority">${['高','中','低'].map((priority) => `<option value="${priority}" ${item.priority === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select></div>
        <div class="field"><label>投递日期</label><input type="date" name="appliedAt" value="${attr(dateInputValue(item.appliedAt))}"></div>
        <div class="field"><label>投递截止</label><input type="date" name="deadline" value="${attr(dateInputValue(item.deadline))}"></div>
        <div class="field"><label>招聘渠道</label><input name="channel" value="${attr(item.channel)}" placeholder="官网 / 内推 / 招聘平台"></div>
        <div class="field"><label>简历版本</label><input name="resumeVersion" value="${attr(item.resumeVersion)}" placeholder="数据分析V2"></div>
        <div class="field"><label>行业</label><input name="industry" value="${attr(item.industry)}" placeholder="互联网"></div>
        <div class="field"><label>公司类型</label><input name="companyType" value="${attr(item.companyType)}" placeholder="大厂 / 国企 / 外企"></div>
        <div class="field"><label>薪资</label><input name="salary" value="${attr(item.salary)}" placeholder="面议 / 15-20k"></div>
        <div class="field"><label>联系人 / 内推人</label><input name="contact" value="${attr(item.contact)}"></div>
        <div class="field"><label>投递地址 / 岗位链接</label><input name="jdUrl" type="url" value="${attr(item.jdUrl)}" placeholder="https://"></div>
        <div class="field"><label>测评 / 笔试类型</label><input name="assessmentType" value="${attr(item.assessmentType)}" placeholder="在线测评 / 专业笔试 / AI面"></div>
        <div class="field"><label>测评 / 笔试时间</label><input type="datetime-local" name="assessmentAt" value="${attr(item.assessmentAt ? item.assessmentAt.slice(0,16) : '')}"></div>
        <div class="field"><label>面试时间</label><input type="datetime-local" name="interviewAt" value="${attr(item.interviewAt ? item.interviewAt.slice(0,16) : '')}"></div>
        <div class="field"><label>面试轮次</label><input name="interviewRound" value="${attr(item.interviewRound)}" placeholder="一面 / 二面 / HR面"></div>
        <div class="field"><label>面试官</label><input name="interviewer" value="${attr(item.interviewer)}"></div>
        <div class="field span-2"><label>下一步行动</label><input name="nextAction" value="${attr(item.nextAction)}" placeholder="补充作品集 / 准备面试 / 跟进 HR"></div>
        <div class="field"><label>下一步日期</label><input type="date" name="nextActionAt" value="${attr(dateInputValue(item.nextActionAt))}"></div>
        <div class="field span-3"><label>技能关键词</label><input name="skills" value="${attr(item.skills)}" placeholder="SQL、Python、数据分析、Tableau"></div>
        <div class="field span-3"><label>岗位 JD / 要求</label><textarea name="jdText" class="tall" placeholder="粘贴完整 JD">${escapeHTML(item.jdText)}</textarea></div>
        <div class="field span-3"><label>备注与复盘</label><textarea name="notes" placeholder="投递原因、面试感受、待补充内容">${escapeHTML(item.notes)}</textarea></div>
      </div>
      <div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存记录</button></div>
    </form>`;
  }

  function openApplicationModal(id) {
    const application = id ? store.getApplication(id) : null;
    const html = `<div class="modal-header"><div><h2>${application ? '编辑投递记录' : '新增投递记录'}</h2><p>阶段、结果、时间和面试信息分开记录，后续分析更准确</p></div><button class="btn btn-ghost btn-icon" data-action="close-modal">×</button></div><div class="modal-body">${applicationFormHTML(application || {})}</div>`;
    showModal(html, 'wide');
  }

  function openApplicationDetail(id) {
    const application = store.getApplication(id);
    if (!application) return;
    const nextIndex = Math.min(Q.STAGES.length - 1, stageInfo(application.status).order + 1);
    const nextStage = Q.STAGES[nextIndex].key;
    const relatedReviews = store.state.reviews.filter((item) => item.applicationId === application.id);
    const html = `<div class="modal-header"><div><h2>${escapeHTML(application.company)}</h2><p>${escapeHTML(application.role)}${application.city ? ` · ${escapeHTML(application.city)}` : ''}</p></div><button class="btn btn-ghost btn-icon" data-action="close-modal">×</button></div>
      <div class="detail-hero"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px"><div>${statusTag(application.status)} ${outcomeTag(application.outcome)} ${priorityTag(application.priority)}<h2 style="margin-top:11px">${escapeHTML(application.role)}</h2><p>${escapeHTML(application.industry || '行业未填')} · ${escapeHTML(application.companyType || '公司类型未填')} · ${escapeHTML(application.channel || '渠道未填')}</p></div><div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary btn-sm" data-action="edit-application" data-id="${attr(application.id)}">编辑</button><button class="btn btn-danger btn-sm" data-action="delete-application" data-id="${attr(application.id)}">删除</button></div></div></div>
      <div class="modal-body stack">
        <div style="display:flex;gap:7px;flex-wrap:wrap"><button class="btn btn-primary btn-sm" data-action="advance-application" data-id="${attr(application.id)}" data-stage="${attr(nextStage)}">推进到：${escapeHTML(nextStage)}</button>${hasValidUrl(application.jdUrl) ? `<a class="btn btn-secondary btn-sm" href="${linkAttr(application.jdUrl)}" target="_blank" rel="noreferrer">打开投递地址</a>` : ''}</div>
        <div class="detail-grid">
          <div class="detail-field"><span>投递日期</span><strong>${fmtDate(application.appliedAt, '未填写')}</strong></div>
          <div class="detail-field"><span>投递截止</span><strong>${fmtDate(application.deadline, '未填写')}</strong></div>
          <div class="detail-field"><span>简历版本</span><strong>${escapeHTML(application.resumeVersion || '未填写')}</strong></div>
          <div class="detail-field"><span>薪资</span><strong>${escapeHTML(application.salary || '未填写')}</strong></div>
          <div class="detail-field"><span>下一步</span><strong>${escapeHTML(application.nextAction || '暂无')}</strong></div>
          <div class="detail-field"><span>下一步时间</span><strong>${fmtDate(application.nextActionAt, '未填写')}</strong></div>
          <div class="detail-field"><span>测评 / 笔试</span><strong>${escapeHTML(application.assessmentType || '未填写')} · ${fmtDateTime(application.assessmentAt)}</strong></div>
          <div class="detail-field"><span>面试时间</span><strong>${fmtDateTime(application.interviewAt)}</strong></div>
          <div class="detail-field"><span>面试轮次</span><strong>${escapeHTML(application.interviewRound || '未填写')}</strong></div>
          <div class="detail-field"><span>联系人</span><strong>${escapeHTML(application.contact || '未填写')}</strong></div>
          <div class="detail-field"><span>技能关键词</span><strong>${escapeHTML(application.skills || '未填写')}</strong></div>
        </div>
        <div class="card"><div class="card-header"><div><h3>添加进展记录</h3><p>每次状态变化、沟通或面试都记录一次</p></div></div><div class="card-body"><form data-form="event-create"><input type="hidden" name="applicationId" value="${attr(application.id)}"><div class="form-grid cols-3"><div class="field span-2"><label>标题</label><input name="title" required placeholder="收到一面通知 / 完成测评 / HR 沟通"></div><div class="field"><label>时间</label><input type="datetime-local" name="at" value="${attr(new Date().toISOString().slice(0,16))}"></div><div class="field span-3"><label>备注</label><textarea name="note" placeholder="记录问题、反馈和下一步"></textarea></div></div><div class="form-actions"><button class="btn btn-secondary btn-sm" type="submit">保存进展</button></div></form></div></div>
        <div class="card"><div class="card-header"><div><h3>岗位 JD</h3><p>用于后续历史相似岗位推荐</p></div></div><div class="card-body">${application.jdText ? `<div class="detail-jd">${escapeHTML(application.jdText)}</div>` : '<p class="muted small">尚未记录 JD 原文。编辑记录并补充后，推荐会更准确。</p>'}</div></div>
        <div class="card"><div class="card-header"><div><h3>时间线</h3><p>共 ${application.events.length} 条进展</p></div></div><div class="card-body"><div class="timeline">${application.events.length ? application.events.map((event) => `<div class="timeline-item"><strong>${escapeHTML(event.title)}</strong><span>${fmtDateTime(event.at)}</span>${event.note ? `<p>${escapeHTML(event.note)}</p>` : ''}</div>`).join('') : '<p class="muted small">暂无进展记录</p>'}</div></div></div>
        <div class="card"><div class="card-header"><div><h3>面试复盘</h3><p>${relatedReviews.length ? `已记录 ${relatedReviews.length} 轮` : '还没有记录本轮面试'}</p></div><button class="btn btn-secondary btn-sm" data-action="add-review" data-id="${attr(application.id)}">＋ 新增复盘</button></div><div class="card-body">${relatedReviews.length ? relatedReviews.map((review) => `<div class="metric-row"><div class="metric-row-label"><strong>${escapeHTML(review.round)} · ${review.rating} 分</strong><span>${fmtDate(review.date)} · ${escapeHTML(review.result)}</span></div><button class="btn btn-ghost btn-sm" data-action="edit-review" data-id="${attr(review.id)}">查看</button></div>`).join('') : '<p class="muted small">面试后记录问题、回答和改进点，系统会自动汇总到面试题库。</p>'}</div></div>
      </div>`;
    showModal(html, 'wide');
  }

  function render() {
    const meta = PAGE_META[ui.page] || PAGE_META.dashboard;
    document.getElementById('page-kicker').textContent = meta.kicker;
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-subtitle').textContent = meta.subtitle;
    document.title = `${meta.title} · 秋招作战台`;
    document.querySelectorAll('.nav-btn').forEach((button) => button.classList.toggle('active', button.dataset.page === ui.page));
    document.getElementById('nav-app-count').textContent = store.state.applications.length;
    document.getElementById('nav-opportunity-count').textContent = store.state.candidates.filter((item) => item.candidateStatus !== 'dismissed').length + ui.capturedJobs.filter((item) => item.status === 'new').length;

    document.getElementById('nav-review-count').textContent = store.state.reviews.length;
    const renderers = {
      dashboard: renderDashboard,
      applications: renderApplications,
      recommendations: renderRecommendations,
      opportunities: renderOpportunities,
      capture: renderCapture,
      reviews: renderReviews,
      analytics: renderAnalytics,
      import: renderImport,
      settings: renderSettings
    };
    main.innerHTML = (renderers[ui.page] || renderDashboard)();
    main.focus({ preventScroll: true });
  }

  function navigate(page, options = {}) {
    if (!PAGE_META[page]) page = 'dashboard';
    ui.page = page;
    if (location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
    render();
    if (page === 'capture' || page === 'opportunities') loadCapturedJobs().catch(() => {});
    if (!options.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function prepareImport(text, sourceName = '粘贴内容') {
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      toast('没有可解析的内容', 'error');
      return;
    }
    try {
      let parsed;
      if (/\.json$/i.test(sourceName) || /^[\[{]/.test(trimmed)) {
        parsed = Q.recordsFromJSON(JSON.parse(trimmed));
      } else {
        parsed = Q.parseCSV(trimmed);
      }
      if (!parsed.records.length) throw new Error('没有找到数据行');
      const mapping = Q.detectMapping(parsed.headers);
      ui.importPreview = { ...parsed, mapping, sourceName };
      ui.page = 'import';
      render();
      toast(`已解析 ${parsed.records.length} 行，识别 ${Object.keys(mapping).length} 个字段`, 'success');
      setTimeout(() => document.getElementById('drop-zone')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    } catch (error) {
      toast(`解析失败：${error.message}`, 'error');
    }
  }

  function exportJSON() {
    downloadFile(`秋招作战台备份_${today()}.json`, store.exportJSON(), 'application/json;charset=utf-8');
    toast('JSON 备份已导出', 'success');
  }

  function exportReviewsCSV() {
    downloadFile(`秋招面试复盘_${today()}.csv`, `\uFEFF${store.exportReviewsCSV()}`, 'text/csv;charset=utf-8');
    toast('面试复盘 CSV 已导出', 'success');
  }

  function exportCSV() {
    downloadFile(`秋招投递记录_${today()}.csv`, `\uFEFF${store.exportCSV()}`, 'text/csv;charset=utf-8');
    toast('投递记录 CSV 已导出', 'success');
  }

  function openCandidateApplication(candidateId) {
    const candidate = store.state.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const seed = {
      company: candidate.company,
      role: candidate.role,
      city: candidate.city,
      industry: candidate.industry,
      companyType: candidate.companyType,
      channel: candidate.channel,
      salary: candidate.salary,
      jdText: candidate.jdText,
      jdUrl: candidate.jdUrl,
      status: '待投递',
      outcome: '等待中',
      nextAction: '完成投递'
    };
    const html = `<div class="modal-header"><div><h2>加入投递</h2><p>${escapeHTML(candidate.company)} · ${escapeHTML(candidate.role)}</p></div><button class="btn btn-ghost btn-icon" data-action="close-modal">×</button></div><div class="modal-body">${applicationFormHTML(seed)}</div>`;
    showModal(html, 'wide');
  }

  function handleMainClick(event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    const id = trigger.dataset.id;
    if (action.startsWith('capture-') || action === 'refresh-captures') {
      window.QiuzhaoCapture.handleAction(action, id).catch((error) => toast(`采集箱操作失败：${error.message}`, 'error'));
      return;
    }
    if (['enable-reminders', 'add-reminder', 'edit-reminder', 'complete-reminder', 'delete-reminder'].includes(action)) {
      window.QiuzhaoReminders.handleAction(action, id).catch((error) => toast('提醒操作失败：' + error.message, 'error'));
      return;
    }
    if (['add-review', 'edit-review', 'delete-review'].includes(action)) {
      window.QiuzhaoReviews.handleAction(action, id).catch((error) => toast(`复盘操作失败：${error.message}`, 'error'));
      return;
    }
    if (action === 'go-import') navigate('import');
    else if (action === 'go-applications') navigate('applications');
    else if (action === 'go-recommendations') navigate('opportunities');
    else if (action === 'go-settings') navigate('settings');
    else if (action === 'add-application') openApplicationModal();
    else if (action === 'open-application') openApplicationDetail(id);
    else if (action === 'edit-application') { closeModal(); openApplicationModal(id); }
    else if (action === 'delete-application') {
      const application = store.getApplication(id);
      if (application && confirm(`确定删除「${application.company} · ${application.role}」吗？`)) {
        store.removeApplication(id);
        closeModal();
        render();
        toast('记录已删除');
      }
    } else if (action === 'advance-application') {
      const application = store.getApplication(id);
      if (!application) return;
      const stage = trigger.dataset.stage;
      store.updateApplication(id, { status: stage }, { title: `阶段推进到 ${stage}`, at: new Date().toISOString().slice(0, 16), note: '' });
      openApplicationDetail(id);
      render();
      toast(`已推进到 ${stage}`, 'success');
    } else if (action === 'quick-complete-task') { store.completeTask(trigger.dataset.taskId, trigger.dataset.taskLabel || ''); render(); toast('已标记完成，可在已完成任务中撤销', 'success'); }
    else if (action === 'open-completed-tasks') openCompletedTasksModal();
    else if (action === 'reopen-task') { store.reopenTask(trigger.dataset.taskId); closeModal(); render(); toast('任务已恢复', 'success'); }
    else if (action === 'view-list') { ui.applicationView = 'list'; render(); }
    else if (action === 'view-kanban') { ui.applicationView = 'kanban'; render(); }
    else if (action === 'new-candidate') { navigate('opportunities'); setTimeout(() => main.querySelector('input[name="company"]')?.focus(), 80); }
    else if (action === 'save-candidate') { store.updateCandidate(id, { candidateStatus: 'saved' }); render(); toast('已收藏', 'success'); }
    else if (action === 'dismiss-candidate') { store.updateCandidate(id, { candidateStatus: 'dismissed' }); render(); toast('已移出推荐列表'); }
    else if (action === 'candidate-to-application') openCandidateApplication(id);
    else if (action === 'choose-import-file') document.getElementById('import-file')?.click();
    else if (action === 'parse-import-text') prepareImport(document.getElementById('import-text')?.value, '粘贴内容');
    else if (action === 'cancel-import') { ui.importPreview = null; render(); }
    else if (action === 'confirm-import') {
      const preview = ui.importPreview;
      if (!preview) return;
      const result = store.importApplications(preview.records, preview.mapping, ui.importMode);
      ui.importPreview = null;
      render();
      toast(`导入完成：新增 ${result.added} 条，更新 ${result.updated} 条`, 'success');
      setTimeout(() => navigate('dashboard'), 500);
    } else if (action === 'export-json') exportJSON();
    else if (action === 'export-csv') exportCSV();
    else if (action === 'export-reviews-csv') exportReviewsCSV();
    else if (action === 'load-demo') {
      if (store.state.applications.length && !confirm('载入演示数据会替换当前投递记录，确定继续吗？')) return;
      store.state.applications = demoApplications();
      store.state.candidates = [
        Q.makeCandidate({ company: '云岸科技', role: '商业分析师', city: '上海', industry: '互联网', channel: '官网', jdText: '负责经营分析、指标体系、SQL、Python、Tableau，支持业务决策。' }),
        Q.makeCandidate({ company: '朗盛消费', role: '数据分析师', city: '杭州', industry: '消费', channel: '内推', jdText: '负责用户增长、A/B测试、SQL、Excel和数据可视化。' }),
        Q.makeCandidate({ company: '北辰证券', role: '数据分析', city: '北京', industry: '金融', channel: '校招', jdText: '参与金融数据分析和风险策略，要求SQL、Python、统计和业务分析能力。' })
      ];
      store.save();
      render();
      toast('已载入虚构演示数据', 'success');
    } else if (action === 'clear-data') {
      if (confirm('确定清空所有本地投递、候选和偏好数据吗？此操作无法撤销。')) {
        store.reset();
        ui.importPreview = null;
        render();
        toast('本地数据已清空');
      }
    }
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function handleSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const data = formObject(form);
    if (form.dataset.form === 'application-save') {
      const id = data.id;
      const captureId = data.captureId;
      delete data.id;
      delete data.captureId;
      if (id) {
        const previous = store.getApplication(id);
        const eventTitle = previous && previous.status !== data.status ? `阶段更新为 ${data.status}` : '更新投递记录';
        store.updateApplication(id, data, { title: eventTitle, at: new Date().toISOString().slice(0, 16), note: data.nextAction || '' });
        closeModal();
        render();
        toast('记录已更新', 'success');
      } else {
        store.addApplication(data);
        closeModal();
        render();
        toast('投递记录已创建', 'success');
      }
      if (captureId) window.QiuzhaoCapture.update(captureId, { status: 'saved' }).catch(() => {});
    } else if (form.dataset.form === 'event-create') {
      const applicationId = data.applicationId;
      delete data.applicationId;
      store.addEvent(applicationId, data);
      openApplicationDetail(applicationId);
      render();
      toast('进展已记录', 'success');
    } else if (form.dataset.form === 'reminder-save') {
      window.QiuzhaoReminders.save(data);
    } else if (form.dataset.form === 'review-save') {
      window.QiuzhaoReviews.save(data);
    } else if (form.dataset.form === 'candidate-create') {
      const candidate = store.addCandidate(data);
      render();
      toast('候选岗位已加入推荐池', 'success');
      setTimeout(() => main.querySelector(`[data-id="${candidate.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    } else if (form.dataset.form === 'settings') {
      store.updatePreferences({
        cities: data.cities || '',
        roles: data.roles || '',
        industries: data.industries || '',
        skills: data.skills || '',
        excluded: data.excluded || '',
        resumeProfile: data.resumeProfile || '',
        targetApplications: Number(data.targetApplications) || 60,
        weeklyTarget: Number(data.weeklyTarget) || 10,
        dailyTarget: Number(data.dailyTarget) || 2,
        targetOffers: Number(data.targetOffers) || 1
      });
      render();
      toast('偏好已保存', 'success');
    }
  }

  function decodeTextFile(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes);
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('gb18030').decode(bytes);
    }
  }

  function fileToPreview(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        prepareImport(decodeTextFile(reader.result), file.name);
      } catch (error) {
        toast(`文件读取失败：${error.message}`, 'error');
      }
    };
    reader.onerror = () => toast('文件读取失败', 'error');
    reader.readAsArrayBuffer(file);
  }

  function handleChange(event) {
    const field = event.target.dataset.field;
    if (field === 'application-filter') { ui.applicationFilter = event.target.value; render(); }
    else if (field === 'application-stage') { ui.stage = event.target.value; render(); }
    else if (field === 'application-city') { ui.city = event.target.value; render(); }
    else if (field === 'application-sort') { ui.applicationSort = event.target.value; render(); }
    else if (field === 'import-mode') { ui.importMode = event.target.value; render(); }
    else if (field === 'capture-filter') { ui.capturedFilter = event.target.value; render(); }
    else if (field === 'review-filter') { ui.reviewFilter = event.target.value; render(); }
    else if (event.target.id === 'import-file') fileToPreview(event.target.files?.[0]);
  }

  let searchTimer = null;
  let searchComposing = false;

  function scheduleSearchRender() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (searchComposing) return;
      render();
      const input = main.querySelector('[data-field="application-search"]');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 260);
  }

  function handleInput(event) {
    if (event.target.dataset.field !== 'application-search') return;
    ui.search = event.target.value;
    if (event.isComposing || searchComposing) return;
    scheduleSearchRender();
  }

  function handleCompositionStart(event) {
    if (event.target.dataset.field !== 'application-search') return;
    searchComposing = true;
    clearTimeout(searchTimer);
  }

  function handleCompositionEnd(event) {
    if (event.target.dataset.field !== 'application-search') return;
    searchComposing = false;
    ui.search = event.target.value;
    scheduleSearchRender();
  }
  function bindDropZone() {
    const zone = document.getElementById('drop-zone');
    if (!zone) return;
    ['dragenter', 'dragover'].forEach((type) => zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, (event) => {
      event.preventDefault();
      zone.classList.remove('dragging');
    }));
    zone.addEventListener('drop', (event) => fileToPreview(event.dataTransfer?.files?.[0]));
  }

  document.getElementById('main-nav').addEventListener('click', (event) => {
    const button = event.target.closest('.nav-btn');
    if (button) navigate(button.dataset.page);
  });

  document.addEventListener('click', (event) => {
    const close = event.target.closest('[data-action="close-modal"]');
    const backdrop = event.target.matches('[data-action="modal-backdrop"]');
    if (close || backdrop) {
      closeModal();
      return;
    }
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    if (trigger.closest('#app-main') || trigger.closest('.topbar')) handleMainClick(event);
    else if (trigger.closest('#modal-root') && ['edit-application','delete-application','advance-application','add-review','edit-review','delete-review','add-reminder','edit-reminder','complete-reminder','delete-reminder'].includes(trigger.dataset.action)) handleMainClick(event);
  });

  document.addEventListener('submit', handleSubmit);
  document.addEventListener('change', handleChange);
  main.addEventListener('input', handleInput);
  main.addEventListener('compositionstart', handleCompositionStart);
  main.addEventListener('compositionend', handleCompositionEnd);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
  window.addEventListener('hashchange', () => {
    const page = location.hash.replace('#', '') || 'dashboard';
    if (PAGE_META[page] && page !== ui.page) navigate(page, { keepScroll: true });
  });

  function renderOpportunities() {
    return `<div class="stack"><section><div class="section-title"><div><h2>岗位采集箱</h2><p>先把你看到的岗位收进来，再决定是否值得投</p></div></div></section>${window.QiuzhaoCapture.render()}<section class="opportunity-divider"><div class="section-title"><div><h2>推荐判断</h2><p>结合历史投递结果、偏好和 JD 画像排序</p></div></div></section>${renderRecommendations()}</div>`;
  }

  function renderCapture() { return window.QiuzhaoCapture.render(); }
  function renderReviews() { return window.QiuzhaoReviews.render(); }
  function loadCapturedJobs() { return window.QiuzhaoCapture.load(); }
  function openApplicationFromCapture(job) {
    const seed = {
      captureId: job.id,
      company: job.company,
      role: job.role,
      city: job.city,
      salary: job.salary,
      jdText: job.jdText,
      jdUrl: job.url,
      channel: '网页采集',
      status: '待投递',
      outcome: '等待中',
      nextAction: '完成投递'
    };
    const html = `<div class="modal-header"><div><h2>加入投递</h2><p>${escapeHTML(job.company)} · ${escapeHTML(job.role)}</p></div><button class="btn btn-ghost btn-icon" data-action="close-modal">×</button></div><div class="modal-body">${applicationFormHTML(seed)}</div>`;
    showModal(html, 'wide');
  }

  const moduleHelpers = { escapeHTML, attr, linkAttr, fmtDate, fmtDateTime, dateInputValue, openApplicationFromCapture };
  window.QiuzhaoCapture.init({ store, ui, helpers: moduleHelpers, navigate, toast, render });
  window.QiuzhaoReviews.init({ store, ui, helpers: moduleHelpers, toast, render, showModal, closeModal });
  window.QiuzhaoReminders.init({ store, render, toast, showModal, closeModal, helpers: moduleHelpers });
  window.QiuzhaoDailyStats.init({ store });
  window.QiuzhaoDashboard.init({ store, R, helpers: { renderOnboarding, getStats, buildTasks, today, renderStatCard, renderRecommendationMini, escapeHTML, attr } });
  window.QiuzhaoDashboard.init({ store, R, helpers: { renderOnboarding, getStats, buildTasks, today, renderStatCard, renderRecommendationMini, escapeHTML, attr } });
  window.QiuzhaoReminders.schedule();
  window.QiuzhaoCapture.load().then(() => { if (ui.page !== 'capture') render(); }).catch(() => {});

  const originalRender = render;
  render = function renderWithBindings() {
    originalRender();
    bindDropZone();
  };

  render();
  window.QiuzhaoApp = { openApplicationModal };
})();




















































































