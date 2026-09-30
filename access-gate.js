(function () {
  const host = window.location.hostname;
  if (host === '127.0.0.1' || host === 'localhost' || window.location.protocol === 'file:') return;

  const ACCESS_VERSION = 'qz-2026-001';
  const ACCESS_HASH = '116c9f425d86e2f7dfb0629727126101c38872e61faa4f35fd195ef2d345e8b7';
  const STORAGE_KEY = 'qiuzhao_access_grant';

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.version === ACCESS_VERSION) return;
  } catch {}

  document.documentElement.style.visibility = 'hidden';

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function showGate() {
    const overlay = document.createElement('div');
    overlay.id = 'qiuzhao-access-gate';
    overlay.style.cssText = ['position:fixed', 'inset:0', 'z-index:99999', 'display:grid', 'place-items:center', 'padding:24px', 'background:linear-gradient(135deg,#eaf7ff,#fff0f7)', 'font-family:"Microsoft YaHei UI","PingFang SC",sans-serif'].join(';');
    overlay.innerHTML = `
      <section style="width:min(430px,100%);padding:28px;border:1px solid #dfeaf6;border-radius:24px;background:rgba(255,255,255,.96);box-shadow:0 24px 60px rgba(105,139,181,.18)">
        <div style="width:48px;height:48px;border-radius:16px 16px 16px 7px;display:grid;place-items:center;background:linear-gradient(135deg,#72b5e7,#ed7fae);color:#fff;font-size:22px;font-weight:800">秋</div>
        <h1 style="margin:18px 0 0;color:#26344b;font-size:22px">秋招作战台需要授权</h1>
        <p style="margin:8px 0 18px;color:#708098;font-size:13px;line-height:1.6">这是私人工作台。请输入系统所有者提供的访问码后继续。</p>
        <label style="display:flex;flex-direction:column;gap:7px;color:#4f5a65;font-size:12px;font-weight:700">访问码
          <input id="qiuzhao-access-code" type="password" autocomplete="off" placeholder="请输入访问码" style="width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #dce7f3;border-radius:12px;font:inherit">
        </label>
        <p id="qiuzhao-access-error" style="min-height:18px;margin:9px 0;color:#c55e7c;font-size:12px"></p>
        <button id="qiuzhao-access-submit" type="button" style="width:100%;padding:11px 14px;border:0;border-radius:12px;background:linear-gradient(135deg,#72b5e7,#ed7fae);color:#fff;font:inherit;font-weight:800;cursor:pointer">进入秋招作战台</button>
      </section>`;
    document.body.appendChild(overlay);
    document.documentElement.style.visibility = 'visible';
    const input = document.getElementById('qiuzhao-access-code');
    const button = document.getElementById('qiuzhao-access-submit');
    const error = document.getElementById('qiuzhao-access-error');
    async function verify() {
      const value = input.value.trim();
      if (!value) { error.textContent = '请输入访问码。'; return; }
      button.disabled = true;
      const hash = await sha256(value);
      if (hash === ACCESS_HASH) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: ACCESS_VERSION, grantedAt: new Date().toISOString() }));
        overlay.remove();
      } else {
        error.textContent = '访问码不正确。';
        button.disabled = false;
        input.select();
      }
    }
    button.addEventListener('click', verify);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') verify(); });
    input.focus();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showGate, { once: true });
  else showGate();
})();
