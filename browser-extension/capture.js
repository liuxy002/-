(() => {
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const textFromHtml = (html) => {
    try {
      const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      doc.querySelectorAll('script,style,noscript,svg').forEach((node) => node.remove());
      return clean(doc.body?.innerText || doc.body?.textContent || '');
    } catch {
      return clean(String(html || '').replace(/<[^>]+>/g, ' '));
    }
  };
  const meta = (...selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = clean(node?.content || node?.getAttribute?.('content') || node?.textContent || '');
      if (value) return value;
    }
    return '';
  };
  const firstText = (selectors) => {
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        const value = clean(node.innerText || node.textContent || '');
        if (value && value.length <= 500) return value;
      }
    }
    return '';
  };
  const longestText = (selectors, min = 120) => {
    let best = '';
    const seen = new Set();
    for (const selector of selectors) {
      for (const node of document.querySelectorAll(selector)) {
        if (seen.has(node)) continue;
        seen.add(node);
        const value = clean(node.innerText || node.textContent || '');
        if (value.length > best.length && value.length <= 50000) best = value;
      }
    }
    return best.length >= min ? best : '';
  };
  const jsonLdJobs = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || 'null');
      const list = Array.isArray(data) ? data : [data];
      list.forEach((item) => {
        if (!item) return;
        const graph = Array.isArray(item['@graph']) ? item['@graph'] : [];
        const candidates = [item, ...graph];
        candidates.forEach((candidate) => {
          const type = Array.isArray(candidate?.['@type']) ? candidate['@type'].join(' ') : String(candidate?.['@type'] || '');
          if (/JobPosting/i.test(type)) jsonLdJobs.push(candidate);
        });
      });
    } catch {}
  });
  const job = jsonLdJobs[0] || {};
  const locationAddress = Array.isArray(job.jobLocation) ? job.jobLocation[0] : job.jobLocation;
  const address = locationAddress?.address || locationAddress || {};
  const jsonCity = clean([address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(' '));
  const salary = job.baseSalary?.value || job.baseSalary || {};
  const salaryText = clean(typeof salary === 'string' ? salary : [salary.minValue, salary.maxValue, salary.unitText, salary.currency].filter(Boolean).join(' '));
  const jsonDescription = textFromHtml(job.description || '');
  const role = clean(job.title || meta('meta[property="og:title"]', 'meta[name="twitter:title"]') || firstText(['h1', '[class*="job-title"]', '[class*="position-title"]', '[class*="jobName"]', '[class*="job-name"]']) || document.title);
  const company = clean(job.hiringOrganization?.name || job.hiringOrganization || meta('meta[property="og:site_name"]', 'meta[name="application-name"]') || firstText(['[class*="company-name"]', '[class*="companyName"]', '[class*="corp-name"]', '.company', '.company-title']));
  const city = jsonCity || firstText(['[class*="job-city"]', '[class*="job-location"]', '[class*="location"]', '[class*="workplace"]', '[class*="address"]']);
  const jdText = jsonDescription || longestText([
    '[class*="job-description"]', '[class*="job-detail"]', '[class*="position-detail"]', '[class*="jobDetail"]',
    '[class*="job-desc"]', '[class*="position-desc"]', '[class*="recruit-detail"]', '.job-detail', '.job-description',
    '#job-detail', '#jobDescription', 'article', 'main'
  ]);
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  return {
    company,
    role,
    city,
    salary: salaryText,
    url: canonical || location.href,
    jdText,
    source: location.hostname,
    capturedAt: new Date().toISOString()
  };
})();
