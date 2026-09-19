const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const pidFile = path.join(root, '.qiuzhao-server.pid');
const dataDir = path.join(root, 'data');
const captureFile = path.join(dataDir, 'captured-jobs.json');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function ensureDataFile() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(captureFile)) fs.writeFileSync(captureFile, '[]', 'utf8');
}

function readCapturedJobs() {
  ensureDataFile();
  try {
    const jobs = JSON.parse(fs.readFileSync(captureFile, 'utf8'));
    return Array.isArray(jobs) ? jobs : [];
  } catch {
    return [];
  }
}

function writeCapturedJobs(jobs) {
  ensureDataFile();
  const tempFile = `${captureFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(jobs, null, 2), 'utf8');
  fs.renameSync(tempFile, captureFile);
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error('请求内容过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON 格式错误')); }
    });
    req.on('error', reject);
  });
}

function clean(value, max = 50000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

function normalizeCapture(input) {
  const now = new Date().toISOString();
  return {
    id: clean(input.id, 100) || `capture_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    company: clean(input.company, 300) || '未识别公司',
    role: clean(input.role, 500) || '未识别岗位',
    city: clean(input.city, 200),
    salary: clean(input.salary, 200),
    url: clean(input.url, 4000),
    source: clean(input.source, 300) || '浏览器采集器',
    jdText: clean(input.jdText),
    capturedAt: clean(input.capturedAt, 100) || now,
    updatedAt: now,
    status: ['new', 'saved', 'dismissed'].includes(input.status) ? input.status : 'new'
  };
}

function findExistingJob(jobs, capture) {
  if (capture.url) return jobs.find((item) => item.url && item.url === capture.url);
  return jobs.find((item) => item.company === capture.company && item.role === capture.role);
}

async function handleApi(req, res, pathname) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }

  if (pathname === '/api/captured-jobs' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, jobs: readCapturedJobs() });
    return true;
  }

  if (pathname === '/api/capture-job' && req.method === 'POST') {
    try {
      const capture = normalizeCapture(await readJsonBody(req));
      if (!capture.url && !capture.company && !capture.role && !capture.jdText) {
        sendJson(res, 400, { ok: false, error: '没有可保存的岗位信息' });
        return true;
      }
      const jobs = readCapturedJobs();
      const existing = findExistingJob(jobs, capture);
      if (existing) {
        Object.assign(existing, capture, { id: existing.id, status: existing.status || 'new', capturedAt: existing.capturedAt || capture.capturedAt });
        writeCapturedJobs(jobs);
        sendJson(res, 200, { ok: true, job: existing, updated: true });
      } else {
        jobs.unshift(capture);
        writeCapturedJobs(jobs);
        sendJson(res, 201, { ok: true, job: capture, updated: false });
      }
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return true;
  }

  const match = pathname.match(/^\/api\/captured-jobs\/([^/]+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    const jobs = readCapturedJobs();
    const index = jobs.findIndex((item) => item.id === id);
    if (index < 0) {
      sendJson(res, 404, { ok: false, error: '采集记录不存在' });
      return true;
    }
    if (req.method === 'PATCH') {
      try {
        const patch = await readJsonBody(req);
        jobs[index] = normalizeCapture({ ...jobs[index], ...patch, id });
        jobs[index].capturedAt = jobs[index].capturedAt || new Date().toISOString();
        writeCapturedJobs(jobs);
        sendJson(res, 200, { ok: true, job: jobs[index] });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error.message });
      }
      return true;
    }
    if (req.method === 'DELETE') {
      jobs.splice(index, 1);
      writeCapturedJobs(jobs);
      sendJson(res, 200, { ok: true });
      return true;
    }
  }

  sendJson(res, 404, { ok: false, error: '接口不存在' });
  return true;
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  if (requested.includes('/data/') || requested.includes('/.chrome-') || path.basename(requested).startsWith('.')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const filePath = path.resolve(root, `.${requested}`);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }
  serveStatic(req, res, pathname);
});

function removePidFile() {
  try {
    if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').trim() === String(process.pid)) fs.unlinkSync(pidFile);
  } catch {}
}

server.on('error', (error) => {
  removePidFile();
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  ensureDataFile();
  try { fs.writeFileSync(pidFile, String(process.pid), 'utf8'); } catch {}
  console.log(`秋招作战台已启动：http://127.0.0.1:${port}`);
});

process.on('exit', removePidFile);
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
