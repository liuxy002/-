const STAGES = [
  { key: '待投递', short: '待投', order: 0, color: '#82b8df' },
  { key: '已投递', short: '已投', order: 1, color: '#6ea9dc' },
  { key: '测评/笔试', short: '测评', order: 2, color: '#a18bd6' },
  { key: '面试中', short: '面试', order: 3, color: '#ec7fac' },
  { key: 'Offer', short: 'Offer', order: 4, color: '#63b99b' },
  { key: '已结束', short: '结束', order: 5, color: '#9aa6b2' }
];

const OUTCOMES = ['等待中', '已Offer', '已拒绝', '主动放弃', '无回复'];

const DEFAULT_PREFERENCES = {
  cities: '',
  roles: '',
  industries: '',
  skills: '',
  excluded: '',
  weeklyTarget: 10,
  dailyTarget: 2,
  targetApplications: 60,
  targetOffers: 1,
  resumeProfile: ''
};

const FEISHU_URL = 'https://rcnkh8kislt5.feishu.cn/base/UicTbiSQwaRD42sntkac7EyVnOe?table=tbl2hyBCUwyLzVfn&view=vew4jjX7Fq';

const FIELD_ALIASES = {
  company: ['公司', '公司名称', '企业', '企业名称', '单位', '投递公司', '公司简称'],
  role: ['岗位', '职位', '岗位名称', '职位名称', '投递岗位', '投递职位', '应聘岗位', '方向', '职位方向'],
  city: ['城市', '地区', '工作地点', '地点', 'base', 'base地', '工作城市'],
  status: ['状态', '进度', '投递状态', '当前进度', '阶段', '当前阶段', '流程', '流程状态'],
  outcome: ['结果', '投递结果', '最终结果', 'offer情况', '录用结果', '是否offer'],
  appliedAt: ['投递时间', '投递日期', '申请时间', '申请日期', '提交时间', '投递日'],
  deadline: ['截止时间', '截止日期', '简历截止', '投递截止', '截止'],
  channel: ['渠道', '投递渠道', '来源', '平台', '招聘渠道', '信息来源'],
  resumeVersion: ['简历版本', '简历', '版本', '使用简历', '简历名称'],
  salary: ['薪资', '工资', '薪资范围', '薪酬', '待遇'],
  industry: ['行业', '所属行业', '行业方向'],
  companyType: ['公司类型', '企业类型', '公司性质', '单位性质'],
  jdText: ['jd', '岗位jd', '职位描述', '岗位描述', '工作职责', '任职要求', '招聘要求', '岗位要求', '职位详情'],
  jdUrl: ['链接', '岗位链接', '投递链接', '招聘链接', '原链接', '职位链接', 'url', '投递地址', '投递网址', '投递地址信息', '岗位地址', '职位网址', '网申地址', '申请链接', '申请网址', '投递入口'],
  contact: ['联系人', '内推人', 'hr', '招聘负责人', '联系人/内推人'],
  notes: ['备注', '笔记', '补充说明', '其他', '说明'],
  nextActionAt: ['下一步时间', '待办时间', '跟进时间', '下次跟进', '提醒时间'],
  nextAction: ['下一步', '待办', '跟进事项', '下一步行动', '行动项'],
  priority: ['优先级', '优先程度', '重要程度'],
  skills: ['技能', '关键词', '技能要求', '技能标签'],
  assessmentAt: ['测评时间', '测评日期', '笔试时间', '笔试日期', '在线测评时间', '考试时间', '考试日期', '测评截止时间', '笔试截止时间'],
  assessmentType: ['测评类型', '考试类型', '测评/笔试类型'],
  interviewAt: ['面试时间', '面试日期', '一面时间', '下一轮时间', '面试安排'],
  interviewer: ['面试官', '联系人'],
  interviewRound: ['面试轮次', '轮次', '面试阶段'],
  feedback: ['面试反馈', '反馈', '复盘', '面试复盘']
};

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function asText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join('、');
  if (typeof value === 'object') {
    if ('text' in value) return asText(value.text);
    if ('name' in value) return asText(value.name);
    if ('value' in value) return asText(value.value);
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value).trim();
}

function normalizeHeader(value) {
  return asText(value).toLowerCase().replace(/[\s_\-—/（）()【】\[\]:：.。]/g, '');
}

function cleanText(value) {
  return asText(value).replace(/\u0000/g, '').trim();
}

function splitMulti(value) {
  return cleanText(value).split(/[，,、;；|\n]+/).map((item) => item.trim()).filter(Boolean);
}

function parseDate(value) {
  const text = asText(value);
  if (!text) return '';
  if (/^\d{13,}$/.test(text)) return new Date(Number(text)).toISOString().slice(0, 10);
  if (/^\d{10}$/.test(text)) return new Date(Number(text) * 1000).toISOString().slice(0, 10);
  const normalized = text
    .replace(/[年/.]/g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\s+\d{1,2}:\d{2}.*$/, '')
    .trim();
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return normalized;
}

function normalizeStage(value) {
  const text = cleanText(value);
  if (!text) return '待投递';
  if (/offer|录用|已发offer/i.test(text)) return 'Offer';
  if (/面试|初面|复面|终面|一面|二面|三面|群面|面谈|hr沟通|人力|薪酬沟通/i.test(text)) return '面试中';
  if (/测评|笔试|在线考试|机试|性格测试|能力测试|ai面/i.test(text)) return '测评/笔试';
  if (/筛选|简历评估|已查看|初筛|复筛|已投|投递成功|申请成功|已申请/i.test(text)) return '已投递';
  if (/待投|准备投|未投|计划投|待评估/i.test(text)) return '待投递';
  if (/结束|拒绝|挂了|未通过|淘汰|offer拒绝|放弃|无回复|感谢信/i.test(text)) return '已结束';
  return STAGES.some((stage) => stage.key === text) ? text : '待投递';
}
function normalizeOutcome(value, status = '') {
  const text = cleanText(value);
  const combined = `${text} ${status}`;
  if (/主动放弃|放弃|撤回|不去了|拒绝offer|已拒offer/.test(combined)) return '主动放弃';
  if (/offer|录用/.test(combined) && !/拒绝|挂/.test(combined)) return '已Offer';
  if (/无回复|未回复|石沉大海|无消息/.test(combined)) return '无回复';
  if (/拒绝|挂了|未通过|淘汰|感谢信|不合适/.test(combined)) return '已拒绝';
  return OUTCOMES.includes(text) ? text : '等待中';
}

function mapHeaderKey(header) {
  const normalized = normalizeHeader(header);
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    if (normalizeHeader(key) === normalized) return key;
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) return key;
  }
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
    if (normalizeHeader(key) === normalized) return key;
    if (aliases.some((alias) => normalized.includes(normalizeHeader(alias)) || normalizeHeader(alias).includes(normalized))) return key;
  }
  return null;
}

function parseCSV(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => cleanText(value))) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => cleanText(value))) rows.push(row);

  if (!rows.length) return { headers: [], records: [] };

  const headers = rows[0].map((header, index) => cleanText(header) || `列${index + 1}`);
  const records = rows.slice(1).map((values) => {
    const raw = {};
    headers.forEach((header, index) => { raw[header] = cleanText(values[index]); });
    return raw;
  });
  return { headers, records };
}

function recordsFromJSON(data) {
  const list = Array.isArray(data) ? data : (Array.isArray(data?.records) ? data.records : (Array.isArray(data?.applications) ? data.applications : []));
  if (!list.length) return { headers: [], records: [] };
  const headers = [...new Set(list.flatMap((item) => Object.keys(item || {})))];
  return { headers, records: list };
}

function detectMapping(headers) {
  const mapping = {};
  headers.forEach((header) => {
    const key = mapHeaderKey(header);
    if (key && !mapping[key]) mapping[key] = header;
  });
  return mapping;
}

function valueFromMappedRecord(record, mapping, key) {
  return mapping[key] ? asText(record[mapping[key]]) : '';
}

function extractUrlValue(value) {
  const text = asText(value);
  if (!text) return '';
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (match) return match[0].replace(/[),;，；。]+$/, '');
  if (/^www\./i.test(text)) return `https://${text}`;
  return '';
}
function makeEvent(title, at = new Date().toISOString().slice(0, 16), note = '', type = 'update') {
  return { id: uid('evt'), type, title, at, note };
}

function inferAssessmentDate(statusText, appliedAt = '') {
  const text = asText(statusText);
  const match = text.match(/(测评|笔试|考试)[^\d]{0,6}(\d{1,2})[./月-](\d{1,2})/);
  if (!match) return '';
  const base = parseDate(appliedAt);
  const baseYear = base && /^\d{4}/.test(base) ? Number(base.slice(0, 4)) : new Date().getFullYear();
  const month = String(Number(match[2])).padStart(2, '0');
  const day = String(Number(match[3])).padStart(2, '0');
  return `${baseYear}-${month}-${day}`;
}

function makeApplication(seed = {}) {
  const now = new Date().toISOString();
  const status = normalizeStage(seed.status);
  const outcome = normalizeOutcome(seed.outcome, status);
  const application = {
    id: seed.id || uid('app'),
    company: cleanText(seed.company) || '未命名公司',
    role: cleanText(seed.role) || '未命名岗位',
    city: cleanText(seed.city),
    status,
    outcome,
    appliedAt: parseDate(seed.appliedAt),
    deadline: parseDate(seed.deadline),
    channel: cleanText(seed.channel),
    resumeVersion: cleanText(seed.resumeVersion),
    salary: cleanText(seed.salary),
    industry: cleanText(seed.industry),
    companyType: cleanText(seed.companyType),
    jdText: cleanText(seed.jdText),
    jdUrl: extractUrlValue(seed.jdUrl),
    notes: cleanText(seed.notes),
    contact: cleanText(seed.contact),
    nextActionAt: parseDate(seed.nextActionAt),
    nextAction: cleanText(seed.nextAction),
    priority: cleanText(seed.priority) || '中',
    skills: cleanText(seed.skills),
    assessmentAt: parseDate(seed.assessmentAt) || inferAssessmentDate(seed.status, seed.appliedAt),
    assessmentType: cleanText(seed.assessmentType),
    interviewAt: parseDate(seed.interviewAt),
    interviewer: cleanText(seed.interviewer),
    interviewRound: cleanText(seed.interviewRound),
    feedback: cleanText(seed.feedback),
    raw: seed.raw || null,
    events: Array.isArray(seed.events) ? seed.events : [],
    createdAt: seed.createdAt || now,
    updatedAt: seed.updatedAt || now
  };
  if (!application.events.length) {
    application.events.push(makeEvent(application.appliedAt ? '完成投递记录' : '创建岗位记录', application.appliedAt ? `${application.appliedAt}T10:00` : now.slice(0, 16)));
  }
  return application;
}

function makeCandidate(seed = {}) {
  const now = new Date().toISOString();
  return {
    id: seed.id || uid('candidate'),
    company: cleanText(seed.company) || '未命名公司',
    role: cleanText(seed.role) || '未命名岗位',
    city: cleanText(seed.city),
    industry: cleanText(seed.industry),
    companyType: cleanText(seed.companyType),
    channel: cleanText(seed.channel),
    salary: cleanText(seed.salary),
    jdText: cleanText(seed.jdText),
    jdUrl: extractUrlValue(seed.jdUrl),
    candidateStatus: seed.candidateStatus || 'new',
    createdAt: seed.createdAt || now,
    updatedAt: seed.updatedAt || now
  };
}

function recordsToApplications(records, mapping) {
  return records.map((record) => {
    const seeded = {};
    Object.keys(mapping).forEach((key) => { seeded[key] = valueFromMappedRecord(record, mapping, key); });
    seeded.raw = record;
    return makeApplication(seeded);
  });
}

function findRawFieldValue(raw, aliases) {
  if (!raw || typeof raw !== 'object') return '';
  const keys = Object.keys(raw);
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const key = keys.find((item) => normalizeHeader(item) === normalizedAlias);
    if (key) return asText(raw[key]);
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const key = keys.find((item) => normalizeHeader(item).includes(normalizedAlias));
    if (key) return asText(raw[key]);
  }
  return '';
}

function repairApplicationFromRaw(application) {
  if (!application) return application;
  application.jdUrl = extractUrlValue(application.jdUrl);
  if (application.jdUrl) return application;
  const aliasKeys = FIELD_ALIASES.jdUrl || [];
  const recovered = extractUrlValue(findRawFieldValue(application.raw, aliasKeys));
  if (recovered && /^(https?:\/\/|www\.)/i.test(recovered)) application.jdUrl = recovered;
  return application;
}

function makePrepChecklist(seed = []) {
  const defaults = [
    '准备 1 分钟自我介绍',
    '准备 2 个重点项目案例',
    '准备为什么选择这个岗位',
    '准备为什么选择这家公司',
    '复习 JD 中提到的核心技能',
    '准备 3 个反问面试官的问题',
    '检查面试设备、网络和环境'
  ];
  const source = Array.isArray(seed) && seed.length ? seed : defaults.map((text) => ({ id: uid('check'), text, done: false }));
  return source.map((item) => ({ id: item.id || uid('check'), text: cleanText(item.text), done: Boolean(item.done) }));
}

function makePrepPlan(seed = {}) {
  const now = new Date().toISOString();
  return {
    id: seed.id || uid('prep'),
    applicationId: cleanText(seed.applicationId),
    company: cleanText(seed.company),
    role: cleanText(seed.role),
    status: cleanText(seed.status) || '准备中',
    readiness: Math.max(1, Math.min(5, Number(seed.readiness) || 1)),
    selfIntro: cleanText(seed.selfIntro),
    motivation: cleanText(seed.motivation),
    projectOne: cleanText(seed.projectOne),
    projectTwo: cleanText(seed.projectTwo),
    jdKeywords: cleanText(seed.jdKeywords),
    companyResearch: cleanText(seed.companyResearch),
    questionsToAsk: cleanText(seed.questionsToAsk),
    checklist: makePrepChecklist(seed.checklist),
    notes: cleanText(seed.notes),
    createdAt: seed.createdAt || now,
    updatedAt: seed.updatedAt || now
  };
}

function makeReview(seed = {}) {
  const now = new Date().toISOString();
  return {
    id: seed.id || uid('review'),
    applicationId: cleanText(seed.applicationId),
    company: cleanText(seed.company) || '未关联公司',
    role: cleanText(seed.role) || '未关联岗位',
    round: cleanText(seed.round) || '一面',
    date: parseDate(seed.date),
    format: cleanText(seed.format) || '线上',
    interviewer: cleanText(seed.interviewer),
    questions: cleanText(seed.questions),
    answers: cleanText(seed.answers),
    strengths: cleanText(seed.strengths),
    improvements: cleanText(seed.improvements),
    result: cleanText(seed.result) || '等待中',
    rating: Math.max(1, Math.min(5, Number(seed.rating) || 3)),
    nextAction: cleanText(seed.nextAction),
    notes: cleanText(seed.notes),
    createdAt: seed.createdAt || now,
    updatedAt: seed.updatedAt || now
  };
}

function makeReminder(seed = {}) {
  const now = new Date().toISOString();
  return {
    id: seed.id || uid('reminder'),
    title: cleanText(seed.title) || '新提醒',
    type: cleanText(seed.type) || '自定义',
    at: cleanText(seed.at).replace(' ', 'T').slice(0, 16),
    note: cleanText(seed.note),
    applicationId: cleanText(seed.applicationId),
    completed: Boolean(seed.completed),
    createdAt: seed.createdAt || now,
    updatedAt: seed.updatedAt || now
  };
}

function createDefaultState() {
  return {
    version: 1,
    applications: [],
    candidates: [],
    reviews: [],
    reminders: [],
    prepPlans: [],
    taskCompletions: [],
    preferences: { ...DEFAULT_PREFERENCES },
    meta: {
      feishuUrl: FEISHU_URL,
      importedAt: '',
      lastUpdatedAt: new Date().toISOString()
    }
  };
}

class RecruitmentStore {
  constructor(storageKey = 'qiuzhao_workbench_v1') {
    this.storageKey = storageKey;
    this.backupKey = storageKey + '_daily_backups';
    this.lastImportSnapshot = null;
    this.state = this.load();
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (!saved || !Array.isArray(saved.applications)) return createDefaultState();
      const state = {
        ...createDefaultState(),
        ...saved,
        reviews: Array.isArray(saved.reviews) ? saved.reviews : [],
        reminders: Array.isArray(saved.reminders) ? saved.reminders : [],
        prepPlans: Array.isArray(saved.prepPlans) ? saved.prepPlans : [],
        taskCompletions: Array.isArray(saved.taskCompletions) ? saved.taskCompletions : [],
        preferences: { ...DEFAULT_PREFERENCES, ...(saved.preferences || {}) },
        meta: { ...createDefaultState().meta, ...(saved.meta || {}) }
      };
      state.applications = state.applications.map(repairApplicationFromRaw).map((application) => ({ ...application, status: normalizeStage(application.status) }));
      return state;
    } catch {
      return createDefaultState();
    }
  }

  save() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const current = localStorage.getItem(this.storageKey);
    if (current) {
      try {
        const backups = JSON.parse(localStorage.getItem(this.backupKey) || '[]');
        if (!Array.isArray(backups) || backups[0]?.date !== today) {
          const previous = JSON.parse(current);
          backups.unshift({ date: today, at: now.toISOString(), data: previous });
          localStorage.setItem(this.backupKey, JSON.stringify(backups.slice(0, 7)));
        }
      } catch {}
    }
    this.state.meta.lastUpdatedAt = now.toISOString();
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  getBackups() {
    try {
      const backups = JSON.parse(localStorage.getItem(this.backupKey) || '[]');
      return Array.isArray(backups) ? backups : [];
    } catch {
      return [];
    }
  }

  restoreBackup(index = 0) {
    const backup = this.getBackups()[index];
    if (!backup?.data) return false;
    this.state = {
      ...createDefaultState(),
      ...backup.data,
      reviews: Array.isArray(backup.data.reviews) ? backup.data.reviews : [],
      reminders: Array.isArray(backup.data.reminders) ? backup.data.reminders : [],
      taskCompletions: Array.isArray(backup.data.taskCompletions) ? backup.data.taskCompletions : [],
      preferences: { ...DEFAULT_PREFERENCES, ...(backup.data.preferences || {}) },
      meta: { ...createDefaultState().meta, ...(backup.data.meta || {}) }
    };
    this.state.applications = this.state.applications.map(repairApplicationFromRaw).map((application) => ({ ...application, status: normalizeStage(application.status) }));
    this.save();
    return true;
  }

  reset() {
    this.state = createDefaultState();
    this.save();
  }

  normalizeJobUrl(value) {
    const text = cleanText(value).split('#')[0].replace(/\/$/, '');
    return /^https?:\/\//i.test(text) ? text : '';
  }

  findDuplicateApplication(seed, excludeId = '') {
    const url = this.normalizeJobUrl(seed.jdUrl);
    return this.state.applications.find((item) => {
      if (item.id === excludeId) return false;
      const existingUrl = this.normalizeJobUrl(item.jdUrl);
      if (url && existingUrl) return url === existingUrl;
      return item.company === cleanText(seed.company) && item.role === cleanText(seed.role) && (!item.appliedAt || !seed.appliedAt || item.appliedAt === parseDate(seed.appliedAt));
    });
  }

  getApplication(id) {
    return this.state.applications.find((item) => item.id === id);
  }

  completeTask(taskId, label = '') {
    if (!taskId) return false;
    if (!this.state.taskCompletions.some((item) => item.taskId === taskId)) {
      this.state.taskCompletions.unshift({ taskId, label, completedAt: new Date().toISOString() });
      this.save();
    }
    return true;
  }

  reopenTask(taskId) {
    this.state.taskCompletions = this.state.taskCompletions.filter((item) => item.taskId !== taskId);
    this.save();
  }

  addApplication(seed) {
    const application = makeApplication(seed);
    const duplicate = this.findDuplicateApplication(application);
    if (duplicate) {
      const merged = makeApplication({ ...duplicate, ...application, id: duplicate.id, createdAt: duplicate.createdAt, events: duplicate.events });
      merged.updatedAt = new Date().toISOString();
      this.state.applications = this.state.applications.map((item) => item.id === duplicate.id ? merged : item);
      this.save();
      return { ...merged, __duplicate: true };
    }
    this.state.applications.unshift(application);
    this.save();
    return application;
  }
  updateApplication(id, patch, event) {
    const index = this.state.applications.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const previous = this.state.applications[index];
    const next = makeApplication({ ...previous, ...patch, id, events: previous.events, raw: previous.raw });
    next.createdAt = previous.createdAt;
    next.updatedAt = new Date().toISOString();
    if (event) next.events.unshift(makeEvent(event.title, event.at, event.note, event.type));
    this.state.applications[index] = next;
    this.save();
    return next;
  }

  removeApplication(id) {
    this.state.applications = this.state.applications.filter((item) => item.id !== id);
    this.save();
  }

  addEvent(id, seed) {
    const application = this.getApplication(id);
    if (!application) return;
    application.events.unshift(makeEvent(seed.title || '更新记录', seed.at, seed.note, seed.type || 'update'));
    application.updatedAt = new Date().toISOString();
    this.save();
  }

  addCandidate(seed) {
    const candidate = makeCandidate(seed);
    this.state.candidates.unshift(candidate);
    this.save();
    return candidate;
  }

  updateCandidate(id, patch) {
    this.state.candidates = this.state.candidates.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item);
    this.save();
  }

  removeCandidate(id) {
    this.state.candidates = this.state.candidates.filter((item) => item.id !== id);
    this.save();
  }

  importApplications(records, mapping, mode = 'merge') {
    const incoming = recordsToApplications(records, mapping);
    this.lastImportSnapshot = JSON.parse(JSON.stringify(this.state.applications));
    if (mode === 'replace') this.state.applications = [];
    let added = 0;
    let updated = 0;
    incoming.forEach((application) => {
      const duplicate = this.findDuplicateApplication(application);
      if (duplicate) {
        const merged = makeApplication({ ...duplicate, ...application, id: duplicate.id, createdAt: duplicate.createdAt, events: duplicate.events, raw: { ...(duplicate.raw || {}), ...(application.raw || {}) } });
        this.state.applications = this.state.applications.map((item) => item.id === duplicate.id ? merged : item);
        updated += 1;
      } else {
        this.state.applications.push(application);
        added += 1;
      }
    });
    this.state.applications.sort((a, b) => String(b.appliedAt || b.updatedAt).localeCompare(String(a.appliedAt || a.updatedAt)));
    this.state.meta.importedAt = new Date().toISOString();
    this.save();
    return { added, updated, total: incoming.length, canUndo: true };
  }

  undoLastImport() {
    if (!this.lastImportSnapshot) return false;
    this.state.applications = JSON.parse(JSON.stringify(this.lastImportSnapshot));
    this.lastImportSnapshot = null;
    this.save();
    return true;
  }
  addReminder(seed) {
    const reminder = makeReminder(seed);
    this.state.reminders.unshift(reminder);
    this.save();
    return reminder;
  }

  updateReminder(id, patch) {
    const index = this.state.reminders.findIndex((item) => item.id === id);
    if (index < 0) return null;
    this.state.reminders[index] = makeReminder({ ...this.state.reminders[index], ...patch, id, createdAt: this.state.reminders[index].createdAt });
    this.state.reminders[index].updatedAt = new Date().toISOString();
    this.save();
    return this.state.reminders[index];
  }

  removeReminder(id) {
    this.state.reminders = this.state.reminders.filter((item) => item.id !== id);
    this.save();
  }

  addPrepPlan(seed) {
    const plan = makePrepPlan(seed);
    this.state.prepPlans.unshift(plan);
    this.save();
    return plan;
  }

  updatePrepPlan(id, patch) {
    const index = this.state.prepPlans.findIndex((item) => item.id === id);
    if (index < 0) return null;
    this.state.prepPlans[index] = makePrepPlan({ ...this.state.prepPlans[index], ...patch, id, createdAt: this.state.prepPlans[index].createdAt });
    this.state.prepPlans[index].updatedAt = new Date().toISOString();
    this.save();
    return this.state.prepPlans[index];
  }

  removePrepPlan(id) {
    this.state.prepPlans = this.state.prepPlans.filter((item) => item.id !== id);
    this.save();
  }

  addReview(seed) {
    const review = makeReview(seed);
    this.state.reviews.unshift(review);
    this.save();
    return review;
  }

  updateReview(id, patch) {
    const index = this.state.reviews.findIndex((item) => item.id === id);
    if (index < 0) return null;
    this.state.reviews[index] = makeReview({ ...this.state.reviews[index], ...patch, id, createdAt: this.state.reviews[index].createdAt });
    this.state.reviews[index].updatedAt = new Date().toISOString();
    this.save();
    return this.state.reviews[index];
  }

  removeReview(id) {
    this.state.reviews = this.state.reviews.filter((item) => item.id !== id);
    this.save();
  }

  updatePreferences(patch) {
    this.state.preferences = { ...this.state.preferences, ...patch };
    this.save();
  }

  exportReviewsCSV() {
    const columns = [
      ['公司', 'company'], ['岗位', 'role'], ['轮次', 'round'], ['日期', 'date'], ['形式', 'format'],
      ['面试官', 'interviewer'], ['问题', 'questions'], ['回答', 'answers'], ['表现较好', 'strengths'],
      ['需要改进', 'improvements'], ['结果', 'result'], ['自评', 'rating'], ['下一步', 'nextAction'], ['备注', 'notes']
    ];
    const escapeCell = (value) => `"${asText(value).replace(/"/g, '""')}"`;
    const lines = [columns.map(([label]) => escapeCell(label)).join(',')];
    this.state.reviews.forEach((review) => {
      lines.push(columns.map(([, key]) => escapeCell(review[key])).join(','));
    });
    return lines.join('\n');
  }

  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  exportCSV() {
    const columns = [
      ['公司', 'company'], ['岗位', 'role'], ['城市', 'city'], ['阶段', 'status'], ['结果', 'outcome'],
      ['投递时间', 'appliedAt'], ['截止时间', 'deadline'], ['测评类型', 'assessmentType'], ['测评/笔试时间', 'assessmentAt'], ['渠道', 'channel'], ['简历版本', 'resumeVersion'],
      ['薪资', 'salary'], ['行业', 'industry'], ['公司类型', 'companyType'], ['岗位JD', 'jdText'],
      ['投递地址', 'jdUrl'], ['联系人', 'contact'], ['下一步', 'nextAction'], ['下一步时间', 'nextActionAt'],
      ['优先级', 'priority'], ['备注', 'notes']
    ];
    const escapeCell = (value) => `"${asText(value).replace(/"/g, '""')}"`;
    const lines = [columns.map(([label]) => escapeCell(label)).join(',')];
    this.state.applications.forEach((application) => {
      lines.push(columns.map(([, key]) => escapeCell(application[key])).join(','));
    });
    return lines.join('\n');
  }
}

window.Qiuzhao = {
  STAGES,
  OUTCOMES,
  DEFAULT_PREFERENCES,
  FEISHU_URL,
  RecruitmentStore,
  uid,
  asText,
  cleanText,
  splitMulti,
  parseDate,
  normalizeStage,
  normalizeOutcome,
  parseCSV,
  recordsFromJSON,
  detectMapping,
  recordsToApplications,
  makeApplication,
  makeCandidate,
  makeReview,
  makePrepPlan,
  makeReminder
};





















