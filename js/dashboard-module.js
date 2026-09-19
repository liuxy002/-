(function () {
  let store;
  let helpers;
  let R;

  function render() {
    const applications = store.state.applications;
    if (!applications.length && !store.state.reminders.length) return helpers.renderOnboarding();
    const stats = helpers.getStats();
    const tasks = helpers.buildTasks();
    const todayCount = applications.filter((item) => item.appliedAt === helpers.today()).length;
    const recommendations = R.rankCandidates(store.state).slice(0, 4);
    const schedule = window.QiuzhaoReminders.buildItems().slice(0, 6);
    const targetProgress = Math.min(100, Math.round(stats.submitted / Math.max(1, Number(store.state.preferences.targetApplications || 60)) * 100));
    const offerProgress = Math.min(100, Math.round(stats.offers / Math.max(1, Number(store.state.preferences.targetOffers || 1)) * 100));
    const notificationAllowed = 'Notification' in window && Notification.permission === 'granted';
    const { renderStatCard, renderRecommendationMini, escapeHTML, attr } = helpers;

    return `<div class="stack">
      <section class="hero hero-v2"><div class="hero-content"><div><div class="hero-kicker">今日作战台</div><h2>${tasks.length ? `今天优先处理 ${tasks.length} 件事。` : '今天没有紧急事项。'}</h2><p>${todayCount ? `今天已投递 ${todayCount} 个岗位，` : '今天还没有投递，'}当前有 ${stats.active} 个活跃流程。</p></div><div class="hero-targets"><div class="hero-target"><strong>${todayCount}/${store.state.preferences.dailyTarget || 2}</strong><span>今日投递</span></div><div class="hero-target"><strong>${stats.active}</strong><span>活跃流程</span></div><div class="hero-target"><strong>${stats.offers}</strong><span>Offer</span></div></div></div></section>
      <section class="grid grid-4">
        ${renderStatCard('累计投递', stats.submitted, `总记录 ${stats.total} 个岗位`, '↗', '#6ea9dc', '#e5f3ff')}
        ${renderStatCard('今日投递', todayCount, `每日目标 ${store.state.preferences.dailyTarget || 2} 个`, '＋', '#ed7fae', '#ffe5f0')}
        ${renderStatCard('进入面试', stats.interviewed, `面试率 ${stats.interviewRate}%`, '◉', '#ef7ba8', '#ffe5f0')}
        ${renderStatCard('Offer', stats.offers, `Offer 率 ${stats.offerRate}%`, '✓', '#63b99b', '#e2f4ec')}
      </section>
      <section class="grid grid-sidebar">
        <div class="stack">
          <div class="card action-center">
            <div class="card-header"><div><h3>今日行动中心</h3><p>提醒、测评、面试和跟进集中在这里</p></div><div class="reminder-head-actions"><button class="btn btn-primary btn-sm" data-action="add-reminder">＋ 新增提醒</button></div></div>
            <div class="card-body action-center-body">
              <section class="action-section"><div class="action-section-title"><span class="action-dot urgent"></span><strong>今天需要处理</strong><small>${tasks.length} 项</small></div>${tasks.length ? `<div class="task-list">${tasks.slice(0, 3).map((task) => `<div class="task-item"><button class="task-check" data-action="quick-complete-task" data-id="${attr(task.applicationId)}" data-task-id="${attr(task.id)}" data-task-label="${attr(task.title)}">✓</button><div class="task-main"><strong>${task.icon} ${escapeHTML(task.title)}</strong><p>${escapeHTML(task.detail)}</p></div><div class="task-side"><button class="btn btn-secondary btn-sm" data-action="open-application" data-id="${attr(task.applicationId)}">打开</button></div></div>`).join('')}</div>` : '<p class="muted small">今天没有紧急事项，可以继续筛选机会或补充面试复盘。</p>'}</section>
              <div style="margin-bottom:12px"><button class="btn btn-ghost btn-sm" data-action="open-completed-tasks">查看已完成任务</button></div><section class="action-section"><div class="action-section-title"><span class="action-dot upcoming"></span><strong>即将到来</strong><small>${schedule.length} 项</small></div>${schedule.length ? `<div class="schedule-list compact-list">${schedule.map((item) => `<div class="schedule-item ${item.custom ? 'custom-reminder' : ''}" ${item.custom ? `data-action="edit-reminder" data-id="${attr(item.reminderId)}"` : `data-action="open-application" data-id="${attr(item.applicationId)}"`}><span class="schedule-icon" style="--schedule-color:${item.color}">${item.icon}</span><div class="schedule-main"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.role)} · ${escapeHTML(item.type)}</p></div><div class="schedule-time"><strong>${new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(item.timestamp))}</strong><span>${new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit'}).format(new Date(item.timestamp))}</span></div></div>`).join('')}</div>` : '<p class="muted small">未来几天没有额外安排。</p>'}</section>
              <div class="schedule-notice"><span>${notificationAllowed ? '系统通知已开启' : '系统通知未开启，仍可在首页查看提醒'}</span>${notificationAllowed ? '' : '<button class="btn btn-ghost btn-sm" data-action="enable-reminders">开启通知</button>'}</div>
            </div>
          </div>
          ${window.QiuzhaoDailyStats.renderCard()}
        </div>
        <div class="stack">
          <div class="card"><div class="card-header"><div><h3>目标进度</h3><p>只看最关键的投递和 Offer 目标</p></div></div><div class="card-body stack"><div><div class="metric-row" style="padding-top:0"><div class="metric-row-label"><strong>投递目标</strong><span>${stats.submitted} / ${store.state.preferences.targetApplications || 60}</span></div><strong>${targetProgress}%</strong></div><div class="progress"><span style="width:${targetProgress}%"></span></div></div><div><div class="metric-row" style="padding-top:0"><div class="metric-row-label"><strong>Offer 目标</strong><span>${stats.offers} / ${store.state.preferences.targetOffers || 1}</span></div><strong>${offerProgress}%</strong></div><div class="progress teal"><span style="width:${offerProgress}%"></span></div></div></div></div>
          <div class="card"><div class="card-header"><div><h3>值得看的岗位</h3><p>从候选池中选出优先判断的岗位</p></div><button class="btn btn-ghost btn-sm" data-action="go-recommendations">机会中心</button></div><div class="card-body">${recommendations.length ? recommendations.map(renderRecommendationMini).join('') : '<div class="empty-state compact"><p class="muted small">还没有候选岗位。去机会中心粘贴一个 JD 开始判断。</p></div>'}</div></div>
        </div>
      </section>
    </div>`;
  }

  window.QiuzhaoDashboard = {
    init(context) { store = context.store; helpers = context.helpers; R = context.R; },
    render
  };
})();




