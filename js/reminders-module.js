(function () {
  let store;
  let render;
  let toast;
  let showModal;
  let closeModal;
  let helpers;
  const timers = [];
  const sentKey = 'qiuzhao_reminder_sent_v1';

  function parseEventTime(value) {
    if (!value) return 0;
    const text = String(value);
    const normalized = text.includes('T') ? text : `${text}T09:00`;
    const time = new Date(normalized).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  function buildItems() {
    const items = [];
    store.state.applications.filter((application) => !['已结束', 'Offer'].includes(application.status)).forEach((application) => {
      if (application.assessmentAt) {
        items.push({ id: `assessment-${application.id}`, applicationId: application.id, type: '测评 / 笔试', title: `${application.company} · ${application.assessmentType || '测评或笔试'}`, company: application.company, role: application.role, at: application.assessmentAt, timestamp: parseEventTime(application.assessmentAt), icon: '◎', color: '#d99528' });
      }
      if (application.interviewAt) {
        items.push({ id: `interview-${application.id}`, applicationId: application.id, type: application.interviewRound || '面试', title: `${application.company} · ${application.interviewRound || '面试'}`, company: application.company, role: application.role, at: application.interviewAt, timestamp: parseEventTime(application.interviewAt), icon: '◉', color: '#ef6548' });
      }
    });
    (store.state.reminders || []).filter((reminder) => !reminder.completed).forEach((reminder) => {
      items.push({
        id: reminder.id,
        reminderId: reminder.id,
        applicationId: reminder.applicationId,
        type: reminder.type || '自定义',
        title: reminder.title,
        company: '',
        role: reminder.note || '个人提醒',
        at: reminder.at,
        timestamp: parseEventTime(reminder.at),
        icon: '✦',
        color: '#8bb8e8',
        custom: true
      });
    });
    const now = Date.now();
    return items.filter((item) => item.timestamp && item.timestamp >= now - 6 * 60 * 60 * 1000).sort((a, b) => a.timestamp - b.timestamp);
  }

  function dayDiff(timestamp) {
    const event = new Date(timestamp); const today = new Date();
    event.setHours(0,0,0,0); today.setHours(0,0,0,0);
    return Math.round((event.getTime() - today.getTime()) / 86400000);
  }

  function relativeTime(timestamp) {
    const days = dayDiff(timestamp);
    const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
    if (days === 0) return `今天 ${time}`;
    if (days === 1) return `明天 ${time}`;
    if (days > 1) return `${days} 天后 ${time}`;
    return `已到时间 ${time}`;
  }

  function dateLine(timestamp) {
    return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(timestamp));
  }

  function notificationState() {
    if (!('Notification' in window)) return { text: '浏览器不支持系统通知', button: '' };
    if (Notification.permission === 'granted') return { text: '系统提醒已开启', button: '' };
    if (Notification.permission === 'denied') return { text: '浏览器通知已被阻止', button: '' };
    return { text: '开启系统提醒后，可提前 1 天和 2 小时通知', button: '<button class="btn btn-secondary btn-sm" data-action="enable-reminders">开启系统提醒</button>' };
  }

  function renderCard() {
    const items = buildItems().slice(0, 8);
    const { escapeHTML, attr } = helpers;
    const state = notificationState();
    return `<div class="card reminder-card">
      <div class="card-header"><div><h3>我的提醒与日程</h3><p>可新增自己的待办，也会自动汇总测评和面试</p></div><div class="reminder-head-actions"><span class="tag tag-amber">${items.length} 项</span><button class="btn btn-primary btn-sm" data-action="add-reminder">＋ 新增提醒</button></div></div>
      <div class="card-body">
        ${items.length ? `<div class="schedule-list">${items.map((item) => `<div class="schedule-item ${item.custom ? 'custom-reminder' : ''}">
          <span class="schedule-icon" style="--schedule-color:${item.color}">${item.icon}</span>
          <div class="schedule-main" ${item.custom ? '' : `data-action="open-application" data-id="${attr(item.applicationId)}"`}><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.role)} · ${escapeHTML(item.type)}</p></div>
          <div class="schedule-time"><strong>${relativeTime(item.timestamp)}</strong><span>${dateLine(item.timestamp)}</span></div>
          ${item.custom ? `<div class="schedule-actions"><button class="btn btn-ghost btn-sm" data-action="complete-reminder" data-id="${attr(item.reminderId)}" title="标记完成">✓</button><button class="btn btn-ghost btn-sm" data-action="edit-reminder" data-id="${attr(item.reminderId)}" title="编辑">✎</button></div>` : '<span></span>'}
        </div>`).join('')}</div>` : '<div class="empty-state compact"><div><div class="empty-icon">✦</div><p class="muted small">暂无提醒。点击“新增提醒”记录自己的待办，或编辑投递记录补充测评和面试时间。</p></div></div>'}
        <div class="schedule-notice"><span>${state.text}</span>${state.button}</div>
      </div>
    </div>`;
  }
  function reminderForm(reminder = {}) {
    const { escapeHTML, attr } = helpers;
    const at = reminder.at ? String(reminder.at).replace(' ', 'T').slice(0, 16) : `${new Date().toISOString().slice(0, 10)}T09:00`;
    const selectedApplication = reminder.applicationId ? store.getApplication(reminder.applicationId) : null;
    return `<form data-form="reminder-save">
      <input type="hidden" name="id" value="${attr(reminder.id || '')}">
      <div class="form-grid">
        <div class="field span-2"><label>提醒内容 *</label><input name="title" required value="${attr(reminder.title)}" placeholder="例如：跟进 HR / 准备一面 / 完成测评"></div>
        <div class="field"><label>提醒类型</label><select name="type">${['自定义','投递','跟进','测评','笔试','面试','材料','其他'].map((item) => `<option value="${item}" ${reminder.type === item ? 'selected' : ''}>${item}</option>`).join('')}</select></div>
        <div class="field"><label>提醒时间 *</label><input type="datetime-local" name="at" required value="${attr(at)}"></div>
        <div class="field span-3"><label>关联投递记录（可选）</label><input name="applicationId" list="reminder-application-options" value="${attr(selectedApplication ? selectedApplication.company + ' · ' + selectedApplication.role : '')}" placeholder="输入公司或岗位名称搜索" autocomplete="off"><datalist id="reminder-application-options">${store.state.applications.map((item) => `<option value="${attr(item.company + ' · ' + item.role)}"></option>`).join(String())}</datalist></div>
        <div class="field span-3"><label>备注</label><textarea name="note" placeholder="需要准备什么、联系谁、注意什么">${escapeHTML(reminder.note)}</textarea></div>
      </div>
      <div class="form-actions"><button class="btn btn-secondary" type="button" data-action="close-modal">取消</button><button class="btn btn-primary" type="submit">保存提醒</button></div>
    </form>`;
  }

  function openModal(id = '') {
    const reminder = id ? (store.state.reminders || []).find((item) => item.id === id) : null;
    const html = `<div class="modal-header"><div><h2>${reminder ? '编辑提醒' : '新增提醒'}</h2><p>提醒会显示在首页日程中，也可以在系统中设置浏览器通知</p></div><button class="btn btn-ghost btn-icon" data-action="close-modal">×</button></div><div class="modal-body">${reminderForm(reminder || {})}</div>`;
    showModal(html, 'narrow');
  }

  function save(data) {
    if (data.id) store.updateReminder(data.id, data);
    else store.addReminder(data);
    closeModal();
    render();
    toast(data.id ? '提醒已更新' : '提醒已添加', 'success');
  }

  function sentSet() {
    try { return new Set(JSON.parse(localStorage.getItem(sentKey) || '[]')); } catch { return new Set(); }
  }

  function saveSent(set) {
    try { localStorage.setItem(sentKey, JSON.stringify([...set])); } catch {}
  }

  function schedule() {
    timers.splice(0).forEach((timer) => clearTimeout(timer));
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const sent = sentSet();
    (store.state.reminders || []).filter((reminder) => !reminder.completed).forEach((reminder) => {
      items.push({
        id: reminder.id,
        reminderId: reminder.id,
        applicationId: reminder.applicationId,
        type: reminder.type || '自定义',
        title: reminder.title,
        company: '',
        role: reminder.note || '个人提醒',
        at: reminder.at,
        timestamp: parseEventTime(reminder.at),
        icon: '✦',
        color: '#8bb8e8',
        custom: true
      });
    });
    const now = Date.now();
    buildItems().forEach((item) => {
      [24 * 60 * 60 * 1000, 2 * 60 * 60 * 1000].forEach((offset) => {
        const target = item.timestamp - offset;
        const key = `${item.id}-${offset}`;
        if (sent.has(key) || target <= now || target - now > 7 * 86400000) return;
        const timer = setTimeout(() => {
          if (!('Notification' in window) || Notification.permission !== 'granted') return;
          new Notification(offset >= 24 * 60 * 60 * 1000 ? '明天有秋招日程' : '秋招日程即将开始', {
            body: `${item.title} · ${relativeTime(item.timestamp)}`,
            tag: key
          });
          sent.add(key);
          saveSent(sent);
        }, target - now);
        timers.push(timer);
      });
    });
  }

  async function requestPermission() {
    if (!('Notification' in window)) {
      toast('当前浏览器不支持系统通知', 'error');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      toast('系统提醒已开启，请保持系统页面打开', 'success');
      schedule();
      render();
    } else {
      toast('没有获得通知权限，仍可在首页查看日程提醒');
    }
  }

  async function handleAction(action, id) {
    if (action === 'enable-reminders') { await requestPermission(); return true; }
    if (action === 'add-reminder') { openModal(); return true; }
    if (action === 'edit-reminder') { openModal(id); return true; }
    if (action === 'complete-reminder') {
      store.updateReminder(id, { completed: true });
      render();
      schedule();
      toast('提醒已完成', 'success');
      return true;
    }
    if (action === 'delete-reminder') {
      store.removeReminder(id);
      closeModal();
      render();
      schedule();
      toast('提醒已删除');
      return true;
    }
    return false;
  }
  window.QiuzhaoReminders = {
    init(context) {
      store = context.store;
      render = context.render;
      toast = context.toast;
      showModal = context.showModal;
      closeModal = context.closeModal;
      helpers = context.helpers;
    },
    buildItems,
    openModal,
    save,
    renderCard,
    schedule,
    handleAction
  };
})();











