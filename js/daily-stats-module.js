(function () {
  let store;
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function dailySeries(days = 7) {
    const counts = new Map();
    store.state.applications.forEach((application) => { if (application.appliedAt) counts.set(application.appliedAt, (counts.get(application.appliedAt) || 0) + 1); });
    const result = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(); date.setHours(0,0,0,0); date.setDate(date.getDate() - offset);
      const key = dateKey(date); result.push({ key, date, count: counts.get(key) || 0, label: `${date.getMonth()+1}/${date.getDate()}` });
    }
    return result;
  }
  function renderCard() {
    const series = dailySeries(7);
    const today = series[series.length - 1]?.count || 0;
    const yesterday = series[series.length - 2]?.count || 0;
    const total = series.reduce((sum, item) => sum + item.count, 0);
    const average = (total / series.length).toFixed(1);
    const target = Math.max(1, Number(store.state.preferences.dailyTarget) || 2);
    const progress = Math.min(100, Math.round(today / target * 100));
    const max = Math.max(target, ...series.map((item) => item.count), 1);
    const todayDate = new Intl.DateTimeFormat('zh-CN', { month:'long', day:'numeric', weekday:'short' }).format(new Date());
    return `<div class="card daily-card"><div class="card-header"><div><h3>每日投递统计</h3><p>${todayDate} · 每日目标 ${target} 个</p></div><button class="btn btn-ghost btn-sm" data-action="go-settings">调整目标</button></div><div class="card-body"><div class="daily-summary"><div><span>今日投递</span><strong>${today}</strong><small>${progress >= 100 ? '今日目标已完成' : `还差 ${Math.max(0, target-today)} 个`}</small></div><div><span>昨日投递</span><strong>${yesterday}</strong><small>对比昨天节奏</small></div><div><span>近 7 天</span><strong>${total}</strong><small>日均 ${average} 个</small></div></div><div class="daily-chart">${series.map((item,index)=>`<div class="daily-bar-item ${index===series.length-1?'today':''}"><span class="daily-count">${item.count}</span><div class="daily-bar-track"><span style="height:${Math.max(item.count?8:2,item.count/max*100)}%"></span></div><small>${item.label}</small></div>`).join('')}</div><div class="daily-progress"><div><span>今日目标进度</span><strong>${today}/${target}</strong></div><div class="progress"><span style="width:${progress}%"></span></div></div></div></div>`;
  }
  window.QiuzhaoDailyStats = { init(context) { store = context.store; }, renderCard, dailySeries };
})();
