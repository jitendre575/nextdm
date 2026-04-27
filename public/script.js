// DOMAIN & SSL CHECKER — Frontend Logic
// ═══════════════════════════════════════════════════════

// ─── Animations Removed for Performance ──────────────────────────

// ─── Enter key support ────────────────────────────────
document.getElementById('domainInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkDomain();
});

// ─── Quick check buttons ──────────────────────────────
function quickCheck(domain) {
  document.getElementById('domainInput').value = domain;
  checkDomain();
}

// ─── Main Check Function ──────────────────────────────
async function checkDomain() {
  const input = document.getElementById('domainInput');
  const btn = document.getElementById('checkBtn');
  const errorContainer = document.getElementById('errorContainer');
  const resultsSection = document.getElementById('resultsSection');
  let domain = input.value.trim();

  // Hide previous results and errors
  errorContainer.classList.remove('show');
  resultsSection.classList.remove('show');

  if (!domain) {
    showError('Please enter a domain name.');
    input.focus();
    return;
  }

  // Clean domain
  domain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');

  if (domain.length < 3 || !domain.includes('.')) {
    showError('Invalid domain name. Please enter a valid domain like google.com');
    return;
  }

  // Show loading state
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    displayResults(data);
  } catch (err) {
    showError('Could not connect to server. Make sure the server is running.');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ─── Show Error ───────────────────────────────────────
function showError(message) {
  const container = document.getElementById('errorContainer');
  const text = document.getElementById('errorText');
  text.textContent = message;
  container.classList.add('show');
}

// ─── Display Results ──────────────────────────────────
function displayResults(data) {
  const section = document.getElementById('resultsSection');

  // Header
  document.getElementById('resultDomain').textContent = data.domain;
  document.getElementById('checkedTime').textContent = `Checked: ${new Date().toLocaleString()}`;

  // SSL Card
  renderSSLCard(data);

  // Domain Card
  renderDomainCard(data);

  // SSL Details
  renderSSLDetails(data);

  // Domain Details
  renderDomainDetails(data);

  // Hide broken links card in single mode
  document.getElementById('linksStatusCard').style.display = 'none';
  document.getElementById('linksDetailCard').style.display = 'none';
  document.getElementById('sslStatusCard').style.display = '';
  document.getElementById('domainStatusCard').style.display = '';
  document.getElementById('sslDetailCard').style.display = '';
  document.getElementById('domainDetailCard').style.display = '';

  // Show results with animation
  section.classList.add('show');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── SSL Status Card ──────────────────────────────────
function renderSSLCard(data) {
  const card = document.getElementById('sslStatusCard');
  const badge = document.getElementById('sslBadge');
  const days = document.getElementById('sslDays');
  const expiryDate = document.getElementById('sslExpiryDate');
  const progress = document.getElementById('sslProgress');

  // Remove old status classes
  card.className = 'status-card ssl-card';

  if (data.sslError) {
    card.classList.add('status-error');
    badge.textContent = 'Error';
    days.textContent = '—';
    expiryDate.textContent = data.sslError;
    progress.style.width = '0%';
    return;
  }

  const ssl = data.ssl;
  const daysLeft = ssl.daysLeft;

  if (daysLeft > 30) {
    card.classList.add('status-good');
    badge.textContent = 'Valid';
  } else if (daysLeft > 7) {
    card.classList.add('status-warning');
    badge.textContent = 'Expiring Soon';
  } else if (daysLeft > 0) {
    card.classList.add('status-danger');
    badge.textContent = 'Critical';
  } else {
    card.classList.add('status-danger');
    badge.textContent = 'Expired';
  }

  days.textContent = daysLeft;
  expiryDate.textContent = `Expires: ${formatDate(ssl.validTo)}`;

  // Progress bar (assume max 365 days)
  const pct = Math.max(0, Math.min(100, (daysLeft / 365) * 100));
  setTimeout(() => { progress.style.width = `${pct}%`; }, 100);
}

// ─── Domain Status Card ──────────────────────────────
function renderDomainCard(data) {
  const card = document.getElementById('domainStatusCard');
  const badge = document.getElementById('domainBadge');
  const days = document.getElementById('domainDays');
  const expiryDate = document.getElementById('domainExpiryDate');
  const progress = document.getElementById('domainProgress');

  card.className = 'status-card domain-card';

  if (data.whoisError) {
    card.classList.add('status-error');
    badge.textContent = 'Error';
    days.textContent = '—';
    expiryDate.textContent = data.whoisError;
    progress.style.width = '0%';
    return;
  }

  const whois = data.whois;

  if (!whois.expiryDate) {
    card.classList.add('status-warning');
    badge.textContent = 'Unknown';
    days.textContent = '?';
    expiryDate.textContent = 'Expiry date not found in WHOIS records';
    progress.style.width = '50%';
    return;
  }

  const daysLeft = whois.daysLeft;

  if (daysLeft > 90) {
    card.classList.add('status-good');
    badge.textContent = 'Active';
  } else if (daysLeft > 30) {
    card.classList.add('status-warning');
    badge.textContent = 'Expiring Soon';
  } else if (daysLeft > 0) {
    card.classList.add('status-danger');
    badge.textContent = 'Critical';
  } else {
    card.classList.add('status-danger');
    badge.textContent = 'Expired';
  }

  days.textContent = daysLeft;
  expiryDate.textContent = `Expires: ${formatDate(whois.expiryDate)}`;

  const pct = Math.max(0, Math.min(100, (daysLeft / 365) * 100));
  setTimeout(() => { progress.style.width = `${pct}%`; }, 100);
}



// ─── Broken Links Rendering ──────────────────────────────
function displayBrokenLinksResult(data) {
  const card = document.getElementById('linksStatusCard');
  const badge = document.getElementById('linksBadge');
  const text = document.getElementById('brokenLinksText');
  const count = document.getElementById('linksCount');
  const countdownBox = document.getElementById('linksCountdown');
  const container = document.getElementById('linksDetails');

  if (data.error) {
    card.className = 'status-card broken-links-card status-error';
    badge.textContent = 'Error';
    text.textContent = data.error;
    countdownBox.style.display = 'none';
    container.innerHTML = `<div class="detail-row"><span class="detail-key">Error</span><span class="detail-value">${escapeHtml(data.error)}</span></div>`;
    return;
  }

  const { totalFound, totalChecked, brokenLinks } = data;
  countdownBox.style.display = 'block';
  count.textContent = totalChecked;
  
  const label = countdownBox.querySelector('.countdown-label');
  if (label) label.textContent = `links checked (of ${totalFound} found)`;

  if (brokenLinks.length === 0) {
    card.className = 'status-card broken-links-card status-good';
    badge.textContent = 'All Good';
    text.textContent = `No broken links found among ${totalChecked} sample links.`;
    document.getElementById('linksProgress').style.width = '100%';
    document.getElementById('linksProgress').style.background = 'var(--accent-green)';
    container.innerHTML = `<div class="detail-row"><span class="detail-key">Status</span><span class="detail-value">Checked ${totalChecked} links, 0 are broken.</span></div>`;
  } else {
    card.className = 'status-card broken-links-card status-danger';
    badge.textContent = `${brokenLinks.length} Broken`;
    text.textContent = `Found ${brokenLinks.length} broken links!`;
    document.getElementById('linksProgress').style.width = '100%';
    document.getElementById('linksProgress').style.background = 'var(--accent-red)';
    
    let html = `
      <div style="overflow-x: auto; width: 100%; padding-bottom: 8px;">
        <table style="width: 100%; min-width: 800px; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
          <thead>
            <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 2px solid var(--border-color);">
              <th style="padding: 14px 20px; font-weight: 600; color: #fff; width: 50px;">#</th>
              <th style="padding: 14px 20px; font-weight: 600; color: #fff;">Broken link</th>
              <th style="padding: 14px 20px; font-weight: 600; color: #fff;">Link Text</th>
              <th style="padding: 14px 20px; font-weight: 600; color: #fff;">Page where found</th>
              <th style="padding: 14px 20px; font-weight: 600; color: #fff;">Server response</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    brokenLinks.forEach((bl, index) => {
      html += `
            <tr style="border-bottom: 1px solid var(--border-color); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
              <td style="padding: 16px 20px; color: var(--accent-blue-light); font-weight: bold;">${index + 1}</td>
              <td style="padding: 16px 20px; max-width: 350px;">
                <div style="word-break: break-all; padding-bottom: 4px;">
                  <a href="${escapeHtml(bl.url)}" target="_blank" style="color: #cbd5e1; text-decoration: none; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem;">${escapeHtml(bl.url)}</a>
                </div>
              </td>
              <td style="padding: 16px 20px; color: #94a3b8; max-width: 250px; word-break: break-word;">${escapeHtml(bl.text)}</td>
              <td style="padding: 16px 20px;">
                <a href="${escapeHtml(bl.source)}" target="_blank" style="color: var(--accent-blue-light); text-decoration: none;">url</a>
              </td>
              <td style="padding: 16px 20px; color: var(--accent-red); font-weight: bold; white-space: nowrap;">${escapeHtml(bl.status)}</td>
            </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;
  }
}

// ─── SSL Details Table ────────────────────────────────
function renderSSLDetails(data) {
  const container = document.getElementById('sslDetails');

  if (data.sslError) {
    container.innerHTML = `
      <div class="detail-row">
        <span class="detail-key">Error</span>
        <span class="detail-value">${escapeHtml(data.sslError)}</span>
      </div>`;
    return;
  }

  const ssl = data.ssl;
  container.innerHTML = `
    <div class="detail-row">
      <span class="detail-key">Issuer</span>
      <span class="detail-value">${escapeHtml(ssl.issuer)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Subject</span>
      <span class="detail-value">${escapeHtml(ssl.subject)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Valid From</span>
      <span class="detail-value">${formatDate(ssl.validFrom)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Valid Until</span>
      <span class="detail-value">${formatDate(ssl.validTo)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Days Remaining</span>
      <span class="detail-value">${ssl.daysLeft} days</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Protocol</span>
      <span class="detail-value">${escapeHtml(ssl.protocol)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Serial Number</span>
      <span class="detail-value mono">${escapeHtml(ssl.serialNumber)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Certificate Valid</span>
      <span class="detail-value">${ssl.isValid ? '✅ Yes' : '❌ No'}</span>
    </div>`;
}

// ─── Domain Details Table ─────────────────────────────
function renderDomainDetails(data) {
  const container = document.getElementById('domainDetails');

  if (data.whoisError) {
    container.innerHTML = `
      <div class="detail-row">
        <span class="detail-key">Error</span>
        <span class="detail-value">${escapeHtml(data.whoisError)}</span>
      </div>`;
    return;
  }

  const w = data.whois;
  container.innerHTML = `
    <div class="detail-row">
      <span class="detail-key">Domain Name</span>
      <span class="detail-value">${escapeHtml(w.domainName)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Registrar</span>
      <span class="detail-value">${escapeHtml(w.registrar)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Created</span>
      <span class="detail-value">${w.creationDate ? formatDate(w.creationDate) : 'N/A'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Last Updated</span>
      <span class="detail-value">${w.updatedDate ? formatDate(w.updatedDate) : 'N/A'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Expiry Date</span>
      <span class="detail-value">${w.expiryDate ? formatDate(w.expiryDate) : 'N/A'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Days Remaining</span>
      <span class="detail-value">${w.daysLeft !== null ? w.daysLeft + ' days' : 'N/A'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-key">Name Servers</span>
      <span class="detail-value mono">${escapeHtml(w.nameServers)}</span>
    </div>`;
}

// ─── Helpers ──────────────────────────────────────────
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return 'N/A';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════
// BULK CHECK — Logic
// ═══════════════════════════════════════════════════════

let bulkResultsData = []; // store for CSV export

// ─── Mode Switch ──────────────────────────────────────
function switchMode(mode) {
  const single = document.getElementById('singleModeBox');
  const bulk   = document.getElementById('bulkModeBox');
  const image  = document.getElementById('imageModeBox');
  const broken = document.getElementById('brokenModeBox');
  const tabS   = document.getElementById('tabSingle');
  const tabB   = document.getElementById('tabBulk');
  const tabI   = document.getElementById('tabImage');
  const tabBr  = document.getElementById('tabBroken');
  const bulkSec = document.getElementById('bulkResultsSection');
  const singleSec = document.getElementById('resultsSection');

  // Reset all
  single.style.display = 'none';
  bulk.style.display = 'none';
  if(image) image.style.display = 'none';
  if(broken) broken.style.display = 'none';
  tabS.classList.remove('active');
  tabB.classList.remove('active');
  if(tabI) tabI.classList.remove('active');
  if(tabBr) tabBr.classList.remove('active');
  
  if (mode === 'single') {
    single.style.display = '';
    tabS.classList.add('active');
    bulkSec.style.display = 'none';
  } else if (mode === 'bulk') {
    bulk.style.display = '';
    tabB.classList.add('active');
    singleSec.classList.remove('show');
    document.getElementById('errorContainer').classList.remove('show');
  } else if (mode === 'image') {
    if(image) image.style.display = '';
    if(tabI) tabI.classList.add('active');
    bulkSec.style.display = 'none';
    singleSec.classList.remove('show');
    document.getElementById('errorContainer').classList.remove('show');
  } else if (mode === 'broken') {
    if(broken) broken.style.display = '';
    if(tabBr) tabBr.classList.add('active');
    bulkSec.style.display = 'none';
    singleSec.classList.remove('show');
    document.getElementById('errorContainer').classList.remove('show');
  }
}

async function checkBrokenLinks() {
  const input = document.getElementById('brokenInput');
  const btn = document.getElementById('checkBrokenBtn');
  const errorContainer = document.getElementById('errorContainer');
  const resultsSection = document.getElementById('resultsSection');
  let url = input.value.trim();

  errorContainer.classList.remove('show');
  resultsSection.classList.remove('show');

  if (!url) {
    showError('Please enter a website URL.');
    input.focus();
    return;
  }

  // Hide SSL/Domain cards, Show Links card
  document.getElementById('sslStatusCard').style.display = 'none';
  document.getElementById('domainStatusCard').style.display = 'none';
  document.getElementById('sslDetailCard').style.display = 'none';
  document.getElementById('domainDetailCard').style.display = 'none';
  
  document.getElementById('linksStatusCard').style.display = '';
  document.getElementById('linksDetailCard').style.display = '';

  document.getElementById('resultDomain').textContent = url;
  document.getElementById('checkedTime').textContent = `Checked: ${new Date().toLocaleString()}`;

  btn.classList.add('loading');
  btn.disabled = true;

  document.getElementById('linksStatusCard').className = 'status-card broken-links-card';
  document.getElementById('linksBadge').textContent = 'Scanning...';
  document.getElementById('linksDetails').innerHTML = '<div class="detail-row"><span class="detail-key">Analyzing links on page...</span></div>';
  document.getElementById('brokenLinksText').textContent = 'Please wait, scanning links...';
  document.getElementById('linksCountdown').style.display = 'none';
  document.getElementById('linksProgress').style.width = '50%';
  document.getElementById('linksProgress').style.background = 'var(--gradient-purple)';
  
  resultsSection.classList.add('show');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const res = await fetch('/api/broken-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: url })
    });
    
    const data = await res.json();
    displayBrokenLinksResult(data);
  } catch (err) {
    displayBrokenLinksResult({ error: 'Failed to complete scan or connect to server.' });
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ─── Live Counter ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const bulkInput = document.getElementById('bulkInput');
  if (!bulkInput) return;

  bulkInput.addEventListener('input', () => {
    const lines = bulkInput.value
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    const count = Math.min(lines.length, 50);
    const counter = document.getElementById('bulkCounter');
    counter.textContent = `${lines.length} / 50`;
    counter.classList.toggle('at-limit', lines.length >= 50);
  });
});

// ─── Clear & Sample ───────────────────────────────────
function clearBulk() {
  document.getElementById('bulkInput').value = '';
  document.getElementById('bulkCounter').textContent = '0 / 50';
  document.getElementById('bulkCounter').classList.remove('at-limit');
  document.getElementById('bulkResultsSection').style.display = 'none';
}

function pasteSample() {
  const samples = [
    'google.com', 'github.com', 'amazon.com', 'microsoft.com',
    'apple.com', 'netflix.com', 'cloudflare.com', 'vercel.app',
    'shopify.com', 'stripe.com'
  ];
  document.getElementById('bulkInput').value = samples.join('\n');
  document.getElementById('bulkCounter').textContent = `${samples.length} / 50`;
}

// ─── Bulk Check ───────────────────────────────────────
async function checkBulk() {
  const input = document.getElementById('bulkInput');
  const btn   = document.getElementById('bulkCheckBtn');
  const raw   = input.value.trim();

  if (!raw) {
    alert('Please enter at least one domain name.');
    return;
  }

  // Parse domains — one per line, max 50
  const domains = raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .slice(0, 50);

  if (domains.length === 0) {
    alert('No valid domains found. Enter one domain per line.');
    return;
  }

  // Loading state
  btn.classList.add('loading');
  btn.disabled = true;
  bulkResultsData = [];

  // Show results section and progress bar
  const section  = document.getElementById('bulkResultsSection');
  const progress = document.getElementById('bulkProgressWrap');
  const progBar  = document.getElementById('bulkProgressBar');
  const progLbl  = document.getElementById('bulkProgressLabel');
  const tbody    = document.getElementById('bulkTableBody');
  const pills    = document.getElementById('bulkSummaryPills');
  const meta     = document.getElementById('bulkResultsMeta');
  const exportBtn = document.getElementById('exportCsvBtn');

  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  progress.style.display = 'block';
  progBar.style.width = '0%';
  progLbl.textContent = `Checking 0 / ${domains.length}...`;
  pills.innerHTML = '';
  meta.textContent = '';
  exportBtn.style.display = 'none';
  tbody.innerHTML = '';

  // Placeholder skeleton rows
  domains.forEach((d, i) => {
    tbody.innerHTML += skeletonRow(i + 1, d);
  });

  try {
    const res  = await fetch('/api/bulk-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains })
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      alert(data.error || 'Bulk check failed. Please try again.');
      return;
    }

    const results = data.results;
    bulkResultsData = results;

    // Animate rows in
    results.forEach((r, i) => {
      const tr = document.getElementById(`bulk-row-${i}`);
      if (tr) {
        const rowClass = getDomainRowClass(r);
        tr.className = rowClass;
        tr.innerHTML = buildRow(i + 1, r);
      }

      // Update progress
      const pct = Math.round(((i + 1) / results.length) * 100);
      progBar.style.width = `${pct}%`;
      progLbl.textContent = `Checking ${i + 1} / ${results.length}...`;
    });

    // Summary pills
    renderBulkSummary(results);
    meta.textContent = `Checked ${results.length} domain${results.length !== 1 ? 's' : ''} • ${new Date().toLocaleTimeString()}`;
    exportBtn.style.display = '';

  } catch (err) {
    alert('Could not connect to server. Make sure the server is running.');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    progress.style.display = 'none';
  }
}

// ─── Skeleton row while loading ───────────────────────
function skeletonRow(num, domain) {
  return `<tr id="bulk-row-${num - 1}" class="bulk-row-loading">
    <td>${num}</td>
    <td class="bulk-domain-cell">${escapeHtmlStr(domain)}</td>
    <td><span class="bulk-badge loading">Checking…</span></td>
    <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
  </tr>`;
}

// ─── Build filled table row ───────────────────────────
function buildRow(num, r) {
  const ssl  = r.ssl;
  const w    = r.whois;

  // SSL columns
  let sslBadge = '', sslExpiry = '—', sslDays = '<span class="days-na">—</span>';

  if (r.sslError) {
    sslBadge = `<span class="bulk-badge error">No SSL</span>`;
  } else if (ssl) {
    const sc = sslClass(ssl.daysLeft);
    sslBadge  = `<span class="bulk-badge ${sc.cls}">${sc.label}</span>`;
    sslExpiry = fmtShortDate(ssl.validTo);
    sslDays   = `<span class="days-number days-${sc.cls}">${ssl.daysLeft}</span>`;
  }

  // Domain columns
  let domExpiry = '—', domDays = '<span class="days-na">—</span>', registrar = '—';

  if (r.whoisError) {
    domExpiry = '<span style="color:var(--text-muted);font-size:0.78rem">N/A</span>';
  } else if (w) {
    const dc = domClass(w.daysLeft);
    domExpiry  = w.expiryDate  ? fmtShortDate(w.expiryDate) : '—';
    domDays    = w.daysLeft !== null
      ? `<span class="days-number days-${dc.cls}">${w.daysLeft}</span>`
      : '<span class="days-na">—</span>';
    registrar  = escapeHtmlStr(w.registrar || '—');
  }

  return `
    <td>${num}</td>
    <td class="bulk-domain-cell">${escapeHtmlStr(r.domain)}</td>
    <td>${sslBadge}</td>
    <td>${sslExpiry}</td>
    <td>${sslDays}</td>
    <td>${domExpiry}</td>
    <td>${domDays}</td>
    <td style="color:var(--text-secondary);font-size:0.8rem;">${registrar}</td>
  `;
}

// ─── Row class based on worst status ─────────────────
function getDomainRowClass(r) {
  const sslD = r.ssl ? r.ssl.daysLeft : null;
  const domD = r.whois ? r.whois.daysLeft : null;
  const minD = [sslD, domD].filter(d => d !== null);

  if (minD.length === 0) return 'bulk-row-error';
  const m = Math.min(...minD);
  if (m <= 7)  return 'bulk-row-danger';
  if (m <= 30) return 'bulk-row-warn';
  return 'bulk-row-good';
}

// ─── Summary Pills ────────────────────────────────────
function renderBulkSummary(results) {
  let good = 0, warn = 0, danger = 0, errors = 0;
  results.forEach(r => {
    const cls = getDomainRowClass(r);
    if (cls === 'bulk-row-good')   good++;
    else if (cls === 'bulk-row-warn')   warn++;
    else if (cls === 'bulk-row-danger') danger++;
    else errors++;
  });

  document.getElementById('bulkSummaryPills').innerHTML = `
    <span class="summary-pill pill-total">🔍 Total: ${results.length}</span>
    ${good   ? `<span class="summary-pill pill-good">✅ Healthy: ${good}</span>` : ''}
    ${warn   ? `<span class="summary-pill pill-warn">⚠️ Expiring Soon: ${warn}</span>` : ''}
    ${danger ? `<span class="summary-pill pill-danger">🔴 Critical: ${danger}</span>` : ''}
    ${errors ? `<span class="summary-pill pill-error">❌ Errors: ${errors}</span>` : ''}
  `;
}

// ─── CSV Export ───────────────────────────────────────
function exportCSV() {
  if (!bulkResultsData.length) return;

  const headers = ['Domain','SSL Status','SSL Expiry','SSL Days Left','Domain Expiry','Domain Days Left','Registrar'];
  const rows = bulkResultsData.map(r => {
    const ssl = r.ssl;
    const w   = r.whois;
    const sslStatus  = r.sslError  ? 'Error' : ssl ? sslClass(ssl.daysLeft).label : 'N/A';
    const sslExpiry  = ssl ? fmtShortDate(ssl.validTo) : 'N/A';
    const sslDays    = ssl ? ssl.daysLeft : 'N/A';
    const domExpiry  = w && w.expiryDate ? fmtShortDate(w.expiryDate) : 'N/A';
    const domDays    = w && w.daysLeft !== null ? w.daysLeft : 'N/A';
    const reg        = w ? (w.registrar || 'N/A') : 'N/A';
    return [r.domain, sslStatus, sslExpiry, sslDays, domExpiry, domDays, reg]
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `domain-bulk-check-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Helpers ──────────────────────────────────────────
function sslClass(days) {
  if (days === null || days === undefined) return { cls: 'error', label: 'Unknown' };
  if (days > 30)  return { cls: 'good',   label: 'Valid' };
  if (days > 7)   return { cls: 'warn',   label: 'Expiring Soon' };
  if (days > 0)   return { cls: 'danger', label: 'Critical' };
  return { cls: 'danger', label: 'Expired' };
}

function domClass(days) {
  if (days === null || days === undefined) return { cls: 'na', label: 'Unknown' };
  if (days > 90)  return { cls: 'good',   label: 'Active' };
  if (days > 30)  return { cls: 'warn',   label: 'Expiring Soon' };
  if (days > 0)   return { cls: 'danger', label: 'Critical' };
  return { cls: 'danger', label: 'Expired' };
}

function fmtShortDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function escapeHtmlStr(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════════
// IMAGE CONVERTER — Logic
// ═══════════════════════════════════════════════════════

let uploadedImages = [];

function renderImagePreviews() {
  const container = document.getElementById('imagePreviewContainer');
  if (!container) return;
  container.innerHTML = '';
  
  if (uploadedImages.length === 0) {
    resetImageConverter();
    return;
  }
  
  uploadedImages.forEach((item, index) => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    
    const imgEl = document.createElement('img');
    imgEl.src = item.img.src;
    imgEl.style.maxWidth = '200px';
    imgEl.style.maxHeight = '150px';
    imgEl.style.borderRadius = '8px';
    imgEl.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
    imgEl.style.border = '1px solid var(--border-color)';
    imgEl.style.objectFit = 'cover';
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.position = 'absolute';
    removeBtn.style.top = '-8px';
    removeBtn.style.right = '-8px';
    removeBtn.style.width = '24px';
    removeBtn.style.height = '24px';
    removeBtn.style.borderRadius = '50%';
    removeBtn.style.background = 'var(--accent-red)';
    removeBtn.style.color = 'white';
    removeBtn.style.border = 'none';
    removeBtn.style.fontWeight = 'bold';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.display = 'flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';
    removeBtn.style.fontSize = '16px';
    removeBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
    removeBtn.title = 'Remove Image';
    removeBtn.onclick = () => {
      uploadedImages.splice(index, 1);
      renderImagePreviews();
    };
    
    wrapper.appendChild(imgEl);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  });
}

function handleImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  document.getElementById('dropZone').style.display = 'none';
  document.getElementById('imagePreviewSection').style.display = 'block';
  
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        uploadedImages.push({
          img: img,
          originalName: file.name
        });
        renderImagePreviews();
      }
      img.src = e.target.result;
    }
    reader.readAsDataURL(file);
  });
  
  // Clear the input so the same files can be selected again if needed
  event.target.value = '';
}

// Drag and drop functionality
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent-blue-light)';
      dropZone.style.background = 'rgba(56, 189, 248, 0.1)';
    });
    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'rgba(139, 92, 246, 0.4)';
      dropZone.style.background = 'rgba(139, 92, 246, 0.03)';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'rgba(139, 92, 246, 0.4)';
      dropZone.style.background = 'rgba(139, 92, 246, 0.03)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        document.getElementById('imageInput').files = e.dataTransfer.files;
        handleImageUpload({ target: document.getElementById('imageInput') });
      }
    });
  }
});

function resetImageConverter() {
  uploadedImages = [];
  document.getElementById('imageInput').value = '';
  const container = document.getElementById('imagePreviewContainer');
  if (container) container.innerHTML = '';
  document.getElementById('dropZone').style.display = 'block';
  document.getElementById('imagePreviewSection').style.display = 'none';
}

function downloadConvertedImage() {
  if (uploadedImages.length === 0) return;

  const format = document.getElementById('convertFormat').value; // e.g. "image/png"
  let extension = format.split('/')[1];
  if (extension === 'jpeg') extension = 'jpg';

  uploadedImages.forEach((item, index) => {
    setTimeout(() => {
      const canvas = document.createElement('canvas');
      canvas.width = item.img.width;
      canvas.height = item.img.height;
      
      const ctx = canvas.getContext('2d');
      
      // Fill white background for JPEG conversion if original image has transparency
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.drawImage(item.img, 0, 0);

      const dataUrl = canvas.toDataURL(format, 0.9); // 0.9 quality for formats that support it
      
      let baseName = item.originalName;
      if (baseName.lastIndexOf('.') !== -1) {
        baseName = baseName.substring(0, baseName.lastIndexOf('.'));
      } else {
        baseName = `image_${index + 1}`;
      }
      
      const link = document.createElement('a');
      link.download = `${baseName}-converted.${extension}`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, index * 300); // 300ms delay to allow multiple downloads
  });
}
