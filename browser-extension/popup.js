const form = document.getElementById('capture-form');
const statusBox = document.getElementById('status');
const openAppButton = document.getElementById('open-app');

function setStatus(text, type = '') {
  statusBox.textContent = text;
  statusBox.className = `status ${type}`.trim();
}

function fillForm(data) {
  ['company', 'role', 'city', 'salary', 'url', 'jdText'].forEach((key) => {
    const field = form.elements[key];
    if (field) field.value = data[key] || '';
  });
}

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('没有找到当前标签页');
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['capture.js'] });
  return results?.[0]?.result || {};
}

async function init() {
  try {
    const data = await captureCurrentTab();
    fillForm(data);
    const missing = [];
    if (!data.company) missing.push('公司名称');
    if (!data.role) missing.push('岗位名称');
    if (!data.jdText) missing.push('JD');
    setStatus(missing.length ? `已读取页面，请手动补充：${missing.join('、')}` : '读取成功，请确认后发送。', missing.length ? '' : 'success');
  } catch (error) {
    setStatus(`读取失败：${error.message}。可手动填写后发送。`, 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.source = '浏览器采集器';
  payload.capturedAt = new Date().toISOString();
  button.disabled = true;
  setStatus('正在发送到本地系统...');
  try {
    const response = await fetch('http://127.0.0.1:4173/api/capture-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '保存失败');
    setStatus(result.updated ? '岗位已更新到采集箱。' : '岗位已发送到采集箱。', 'success');
    setTimeout(() => window.close(), 900);
  } catch (error) {
    setStatus(`发送失败：${error.message}。请确认秋招作战台已经启动。`, 'error');
  } finally {
    button.disabled = false;
  }
});

openAppButton.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://127.0.0.1:4173/#capture' });
  window.close();
});

init();
