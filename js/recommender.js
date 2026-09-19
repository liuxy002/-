(function () {
  const STOP_WORDS = new Set([
    '岗位', '工作', '负责', '要求', '具备', '经验', '能力', '相关', '优先', '进行', '参与', '完成',
    '熟悉', '了解', '掌握', '良好', '以上', '以及', '能够', '可以', '我们', '公司', '团队', '职位',
    'and', 'the', 'with', 'for', 'you', 'are', 'will', 'from', 'that', 'this', 'your', 'have', 'job'
  ]);

  const SKILLS = [
    'sql', 'python', 'excel', 'tableau', 'powerbi', 'power bi', 'r语言', 'spass', 'sas', 'java',
    'javascript', 'typescript', 'c++', 'c#', 'go', 'react', 'vue', 'node.js', 'git', 'linux',
    'docker', 'kubernetes', 'aws', 'azure', '数据分析', '数据挖掘', '机器学习', '深度学习',
    '数据治理', '统计学', '概率论', '数据可视化', '产品设计', 'axure', 'figma', '项目管理',
    '沟通能力', '业务分析', 'ab测试', 'a/b测试', '用户研究', '用户增长', '运营', '商业分析',
    '需求分析', '竞品分析', 'prd', '交互设计', '报表', '数据库', '爬虫', 'etl', 'bi', '财务分析',
    '行业研究', '市场分析', '供应链', '风控', '算法', '大模型', 'nlp', '推荐系统'
  ];

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[^\p{L}\p{N}+#./-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(text) {
    const normalized = normalize(text);
    const tokens = [];
    const latin = normalized.match(/[a-z][a-z0-9+#./-]{1,}/g) || [];
    latin.forEach((token) => {
      if (!STOP_WORDS.has(token)) tokens.push(token);
    });

    const cjkRuns = normalized.match(/[\p{Script=Han}]{2,}/gu) || [];
    cjkRuns.forEach((run) => {
      if (run.length <= 4) {
        if (!STOP_WORDS.has(run)) tokens.push(run);
        return;
      }
      for (let i = 0; i < run.length - 1; i += 1) {
        const gram = run.slice(i, i + 2);
        if (!STOP_WORDS.has(gram)) tokens.push(gram);
      }
    });
    return tokens;
  }

  function termVector(text) {
    const vector = new Map();
    tokenize(text).forEach((token) => vector.set(token, (vector.get(token) || 0) + 1));
    return vector;
  }

  function cosine(a, b) {
    if (!a.size || !b.size) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    a.forEach((value, key) => {
      normA += value * value;
      if (b.has(key)) dot += value * b.get(key);
    });
    b.forEach((value) => { normB += value * value; });
    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  function listFrom(value) {
    return window.Qiuzhao.splitMulti(value).map((item) => normalize(item)).filter(Boolean);
  }

  function applicationText(application) {
    return [
      application.role, application.company, application.industry, application.companyType,
      application.skills, application.jdText, application.notes
    ].filter(Boolean).join(' ');
  }

  function candidateText(candidate) {
    return [
      candidate.role, candidate.company, candidate.industry, candidate.companyType,
      candidate.city, candidate.jdText
    ].filter(Boolean).join(' ');
  }

  function positiveWeight(application) {
    if (application.outcome === '已Offer' || application.status === 'Offer') return 4;
    if (application.status === '面试中' || application.status === 'HR沟通') return 3.2;
    if (application.status === '测评' || application.status === '笔试') return 2.2;
    if (application.status === '筛选中') return 1.5;
    if (application.status === '已投递') return 0.65;
    if (application.outcome === '已拒绝') return 0.3;
    if (application.outcome === '无回复') return 0.45;
    if (application.outcome === '主动放弃') return 0;
    return 0.3;
  }

  function negativeWeight(application) {
    if (application.outcome === '已拒绝') return 1;
    if (application.outcome === '无回复') return 0.65;
    if (application.outcome === '主动放弃') return 0.25;
    return 0;
  }

  function historySignal(candidate, applications) {
    const candidateVector = termVector(candidateText(candidate));
    if (!candidateVector.size || !applications.length) {
      return { score: 0.5, positiveScore: 0, negativeScore: 0, similar: null, samples: 0 };
    }
    let positiveWeighted = 0;
    let positiveTotal = 0;
    let negativeWeighted = 0;
    let negativeTotal = 0;
    let best = null;

    applications.forEach((application) => {
      const vector = termVector(applicationText(application));
      const similarity = cosine(candidateVector, vector);
      const positive = positiveWeight(application);
      const negative = negativeWeight(application);
      if (positive > 0) {
        positiveWeighted += similarity * positive;
        positiveTotal += positive;
      }
      if (negative > 0) {
        negativeWeighted += similarity * negative;
        negativeTotal += negative;
      }
      if (!best || similarity > best.similarity) best = { application, similarity };
    });

    const positiveScore = positiveTotal ? positiveWeighted / positiveTotal : 0;
    const negativeScore = negativeTotal ? negativeWeighted / negativeTotal : 0;
    const adjusted = Math.max(0, Math.min(1, positiveScore * 1.25 - negativeScore * 0.22));
    return {
      score: adjusted,
      positiveScore,
      negativeScore,
      similar: best && best.similarity > 0.03 ? best : null,
      samples: applications.length
    };
  }

  function includesAny(text, values) {
    const normalized = normalize(text);
    return values.filter((value) => value && normalized.includes(value));
  }

  function preferenceSignal(candidate, preferences) {
    const cities = listFrom(preferences.cities);
    const roles = listFrom(preferences.roles);
    const industries = listFrom(preferences.industries);
    const skills = listFrom(preferences.skills);
    const excluded = listFrom(preferences.excluded);
    const candidateCity = normalize(candidate.city);
    const candidateRole = normalize(candidate.role);
    const candidateIndustry = normalize(candidate.industry);
    const candidateBody = normalize(candidateText(candidate));

    const cityHits = cities.filter((value) => candidateCity.includes(value) || value.includes(candidateCity)).filter(Boolean);
    const roleHits = roles.filter((value) => candidateRole.includes(value) || value.includes(candidateRole) || candidateBody.includes(value));
    const industryHits = industries.filter((value) => candidateIndustry.includes(value) || value.includes(candidateIndustry) || candidateBody.includes(value));
    const skillHits = skills.filter((value) => candidateBody.includes(value));
    const excludedHits = excluded.filter((value) => candidateBody.includes(value));

    const components = [];
    if (cities.length) components.push(cityHits.length ? 1 : 0);
    if (roles.length) components.push(roleHits.length ? 1 : 0);
    if (industries.length) components.push(industryHits.length ? 1 : 0);
    if (skills.length) components.push(Math.min(1, skillHits.length / Math.max(1, Math.min(skills.length, 4))));

    let score = components.length ? components.reduce((sum, item) => sum + item, 0) / components.length : 0.58;
    if (excludedHits.length) score = Math.max(0, score - 0.65);
    return { score, cityHits, roleHits, industryHits, skillHits, excludedHits };
  }

  function freshnessSignal(candidate) {
    const created = new Date(candidate.createdAt || Date.now()).getTime();
    const days = Math.max(0, (Date.now() - created) / 86400000);
    return Math.max(0.25, Math.exp(-days / 45));
  }

  function extractedSkills(candidate) {
    const text = normalize(candidateText(candidate));
    return SKILLS.filter((skill) => text.includes(skill));
  }

  function evaluate(candidate, state) {
    const applications = state.applications || [];
    const preferences = state.preferences || {};
    const preference = preferenceSignal(candidate, preferences);
    const history = historySignal(candidate, applications);
    const skills = extractedSkills(candidate);
    const freshness = freshnessSignal(candidate);
    const hasHistory = applications.length >= 3;
    const completeness = [candidate.company, candidate.role, candidate.city, candidate.jdText].filter(Boolean).length / 4;

    let score = hasHistory
      ? history.score * 0.43 + preference.score * 0.27 + freshness * 0.08 + completeness * 0.22
      : preference.score * 0.5 + freshness * 0.1 + completeness * 0.4;

    if (!candidate.jdText) score -= 0.07;
    if (preference.excludedHits.length) score -= 0.18;
    score = Math.max(0, Math.min(1, score));

    const reasons = [];
    const warnings = [];

    if (history.score >= 0.58 && history.similar) {
      reasons.push(`与你拿到过推进的「${history.similar.application.role}」较相似`);
    } else if (history.similar && history.similar.similarity >= 0.18) {
      reasons.push(`技能画像接近历史岗位「${history.similar.application.role}」`);
    }
    if (preference.cityHits.length) reasons.push(`命中目标城市：${preference.cityHits.join('、')}`);
    if (preference.roleHits.length) reasons.push(`岗位方向符合偏好：${preference.roleHits.join('、')}`);
    if (preference.industryHits.length) reasons.push(`行业偏好命中：${preference.industryHits.join('、')}`);
    if (preference.skillHits.length) reasons.push(`JD 覆盖目标技能：${preference.skillHits.slice(0, 4).join('、')}`);
    if (skills.length) reasons.push(`识别到技能：${skills.slice(0, 5).join('、')}`);
    if (freshness > 0.85) reasons.push('近期新增，建议尽快判断');

    if (preference.excludedHits.length) warnings.push(`命中排除词：${preference.excludedHits.join('、')}`);
    if (!candidate.jdText) warnings.push('缺少 JD 原文，推荐依据有限');
    if (history.negativeScore > history.positiveScore + 0.08 && history.negativeScore > 0.12) {
      warnings.push('相似历史岗位中出现较多拒绝或无回复');
    }
    if (applications.length < 8) warnings.push('历史样本较少，建议把结果当作排序参考');
    if (!candidate.city) warnings.push('岗位城市未填写');

    let category = '探索型';
    if (score >= 0.76) category = '高匹配';
    else if (history.score >= 0.62 && hasHistory) category = '高成功率';
    else if (score >= 0.58) category = '成长型';

    return {
      score: Math.round(score * 100),
      category,
      reasons: reasons.length ? reasons : ['基础信息与偏好画像未出现明显冲突'],
      warnings,
      skills,
      components: {
        preference: Math.round(preference.score * 100),
        history: Math.round(history.score * 100),
        freshness: Math.round(freshness * 100),
        completeness: Math.round(completeness * 100)
      },
      similar: history.similar,
      sampleSize: history.samples
    };
  }

  function rankCandidates(state) {
    return (state.candidates || [])
      .filter((candidate) => candidate.candidateStatus !== 'dismissed')
      .map((candidate) => ({ candidate, recommendation: evaluate(candidate, state) }))
      .sort((a, b) => b.recommendation.score - a.recommendation.score);
  }

  window.QiuzhaoRecommender = { evaluate, rankCandidates, tokenize, normalize, extractedSkills };
})();
