const express = require('express');
const tls = require('tls');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const psl = require('psl');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── SSL Certificate Check ───────────────────────────────────────────
function getSSLInfo(domain) {
  return new Promise((resolve, reject) => {
    const options = {
      host: domain,
      port: 443,
      servername: domain,
      rejectUnauthorized: false,
      timeout: 10000
    };

    const socket = tls.connect(options, () => {
      try {
        const cert = socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy();
          return reject(new Error('No SSL certificate found for this domain.'));
        }

        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysLeft = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

        const info = {
          issuer: cert.issuer ? (cert.issuer.O || cert.issuer.CN || 'Unknown') : 'Unknown',
          subject: cert.subject ? (cert.subject.CN || 'Unknown') : 'Unknown',
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysLeft: daysLeft,
          isValid: now >= validFrom && now <= validTo,
          serialNumber: cert.serialNumber || 'N/A',
          fingerprint: cert.fingerprint || 'N/A',
          protocol: socket.getProtocol ? socket.getProtocol() : 'N/A',
        };

        socket.destroy();
        resolve(info);
      } catch (err) {
        socket.destroy();
        reject(new Error('Failed to parse SSL certificate.'));
      }
    });

    socket.on('error', (err) => {
      socket.destroy();
      reject(new Error(`SSL connection failed: ${err.message}`));
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Connection timed out. Domain may not exist or is unreachable.'));
    });
  });
}

// ─── RDAP Lookup (Modern WHOIS Alternative – supports all TLDs) ──────
async function getRDAPInfo(domain) {
  // ICANN's RDAP bootstrap lookup
  const rdapUrl = `https://rdap.org/domain/${domain}`;
  const response = await axios.get(rdapUrl, {
    timeout: 12000,
    headers: { 'Accept': 'application/rdap+json, application/json' }
  });
  const d = response.data;

  // Extract dates from events array
  const getEvent = (action) => {
    const ev = (d.events || []).find(e => e.eventAction === action);
    return ev ? ev.eventDate : null;
  };

  const creationDate = getEvent('registration');
  const updatedDate  = getEvent('last changed');
  const expiryDate   = getEvent('expiration');

  // Registrar name
  let registrar = 'Unknown';
  const regEntity = (d.entities || []).find(e => (e.roles || []).includes('registrar'));
  if (regEntity) {
    registrar = (regEntity.vcardArray && regEntity.vcardArray[1])
      ? (regEntity.vcardArray[1].find(v => v[0] === 'fn') || [])[3] || regEntity.handle || 'Unknown'
      : regEntity.handle || 'Unknown';
  }

  // Name servers
  const nameServers = (d.nameservers || []).map(ns => ns.ldhName).join(', ') || 'N/A';

  // Status
  const status = (d.status || []).join(', ') || 'N/A';

  let daysLeft = null;
  if (expiryDate) {
    const expiry = new Date(expiryDate);
    daysLeft = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
  }

  return {
    domainName: d.ldhName || domain,
    registrar,
    creationDate,
    updatedDate,
    expiryDate,
    daysLeft,
    nameServers,
    status,
    source: 'RDAP'
  };
}

// ─── Domain WHOIS Check (RDAP first) ─────────────────
async function getDomainInfo(domain) {
  // Try RDAP (supports all modern TLDs, uses HTTP so it works on Vercel)
  try {
    return await getRDAPInfo(domain);
  } catch (rdapErr) {
    // If RDAP fails (some old ccTLDs), we gracefully return a fallback object
    // instead of crashing Vercel with a native WHOIS socket request.
    return {
      domainName: domain,
      registrar: 'Unknown (Not supported by RDAP)',
      creationDate: null,
      updatedDate: null,
      expiryDate: null,
      daysLeft: null,
      nameServers: 'N/A',
      status: 'N/A',
      source: 'N/A'
    };
  }
}

// ─── Broken Links Check ──────────────────────────────────────────────
async function getBrokenLinks(inputUrl) {
  try {
    // Ensure inputUrl starts with http
    let url = inputUrl;
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }

    const response = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8'
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);
    
    const links = new Map();
    $('a[href]').each((i, el) => {
      let href = $(el).attr('href');
      let text = $(el).text().trim();
      if (!text) {
        if ($(el).attr('title')) text = $(el).attr('title');
        else if ($(el).find('img').length > 0) {
          text = $(el).find('img').attr('alt') || '[Image Link]';
        } else {
          text = 'No text';
        }
      }
      if (text.length > 60) text = text.substring(0, 57) + '...';

      if (href && !href.startsWith('mailto:') && !href.startsWith('javascript:') && !href.startsWith('tel:') && !href.startsWith('#')) {
        try {
          // Normalize and make absolute
          const absoluteUrl = new URL(href, url).href;
          if (!links.has(absoluteUrl)) {
            links.set(absoluteUrl, text);
          }
        } catch(e) {}
      }
    });

    const linksArray = Array.from(links.entries()).map(([linkUrl, text]) => ({ url: linkUrl, text, source: url }));
    const checkedLinks = [];
    
    // Check all links found on the page
    const linksToCheck = linksArray;

    const batchSize = 25;
    
    for (let i = 0; i < linksToCheck.length; i += batchSize) {
      const batch = linksToCheck.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(async (linkItem) => {
        const link = linkItem.url;
        let isBroken = false;
        let statusText = 'OK';
        
        // Skip common social media domains that block bots and return false positives
        try {
          const parsedUrl = new URL(link);
          const hostname = parsedUrl.hostname.toLowerCase();
          const socialDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'pinterest.com', 'youtube.com', 'tiktok.com'];
          if (socialDomains.some(d => hostname.includes(d))) {
             return; // Treat as OK, skip checking
          }
        } catch(e) {}

        try {
          // Use HEAD for much faster checking
          await axios.head(link, { 
            timeout: 5000,
            headers: {
               'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            validateStatus: (status) => status < 400 // Consider anything 400+ as broken
          });
        } catch (err) {
          // Fallback to GET just in case the server blocks HEAD requests but allows GET
          try {
            await axios.get(link, { 
              timeout: 6000,
              headers: {
                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              validateStatus: (status) => status < 400 // Consider anything 400+ as broken
            });
          } catch (err2) {
            isBroken = true;
            if (err2.response) {
              statusText = err2.response.status + ' ' + (err2.response.statusText || 'Error');
            } else if (err2.code === 'ENOTFOUND' || err2.code === 'ECONNREFUSED') {
              statusText = 'Not Found';
            } else {
              statusText = 'Timeout/Error';
            }
          }
        }
        if (isBroken) {
          checkedLinks.push({ url: link, status: statusText, text: linkItem.text, source: linkItem.source });
        }
      }));
    }

    return { 
      totalFound: linksArray.length,
      totalChecked: linksToCheck.length, 
      brokenLinks: checkedLinks 
    };
  } catch (err) {
    throw new Error('Failed to crawl website. Site may be unreachable or disallowing bots.');
  }
}

// ─── API Routes ──────────────────────────────────────────────────────
app.post('/api/check', async (req, res) => {
  let { domain } = req.body;

  if (!domain) {
    return res.status(400).json({ error: 'Please provide a domain name.' });
  }

  // Domain for WHOIS/SSL should be the naked domain
  const nakedDomain = domain.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

  if (!nakedDomain || nakedDomain.length < 3 || !nakedDomain.includes('.')) {
    return res.status(400).json({ error: 'Invalid domain name. Example: google.com' });
  }

  const parsed = psl.parse(nakedDomain);
  const rootDomain = parsed.domain || nakedDomain;

  const result = {
    domain: nakedDomain,
    ssl: null,
    whois: null,
    sslError: null,
    whoisError: null,
  };

  // Run all checks in parallel
  const [sslResult, whoisResult] = await Promise.allSettled([
    getSSLInfo(nakedDomain),
    getDomainInfo(rootDomain)
  ]);

  if (sslResult.status === 'fulfilled') {
    result.ssl = sslResult.value;
  } else {
    result.sslError = sslResult.reason.message;
  }

  if (whoisResult.status === 'fulfilled') {
    result.whois = whoisResult.value;
  } else {
    result.whoisError = whoisResult.reason.message;
  }

  res.json(result);
});

app.post('/api/broken-links', async (req, res) => {
  let { domain } = req.body; // Actually it's the full input now
  if (!domain) return res.status(400).json({ error: 'Please provide a URL.' });
  
  // For broken links, we want to crawl the specific page if provided
  let urlToCrawl = domain.trim();
  if (!urlToCrawl.startsWith('http')) {
    urlToCrawl = `https://${urlToCrawl}`;
  }

  try {
    const result = await getBrokenLinks(urlToCrawl);
    res.json(result);
  } catch (err) {
    res.json({ error: err.message, brokenLinks: [] });
  }
});

// ─── Bulk Domain Check ───────────────────────────────────────────────
app.post('/api/bulk-check', async (req, res) => {
  let { domains } = req.body;

  if (!domains || !Array.isArray(domains) || domains.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of domain names.' });
  }

  // Limit to 50
  domains = domains.slice(0, 50);

  // Clean each domain
  const cleanedDomains = domains
    .map(d => d.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^www\./, ''))
    .filter(d => d.length >= 3 && d.includes('.'));

  if (cleanedDomains.length === 0) {
    return res.status(400).json({ error: 'No valid domain names provided.' });
  }

  // Process in batches of 10 to avoid overwhelming servers
  const BATCH_SIZE = 10;
  const allResults = [];

  for (let i = 0; i < cleanedDomains.length; i += BATCH_SIZE) {
    const batch = cleanedDomains.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (nakedDomain) => {
        const parsed = psl.parse(nakedDomain);
        const rootDomain = parsed.domain || nakedDomain;

        const [sslResult, whoisResult] = await Promise.allSettled([
          getSSLInfo(nakedDomain),
          getDomainInfo(rootDomain)
        ]);

        return {
          domain: nakedDomain,
          ssl: sslResult.status === 'fulfilled' ? sslResult.value : null,
          sslError: sslResult.status === 'rejected' ? sslResult.reason.message : null,
          whois: whoisResult.status === 'fulfilled' ? whoisResult.value : null,
          whoisError: whoisResult.status === 'rejected' ? whoisResult.reason.message : null,
        };
      })
    );

    batchResults.forEach(r => {
      if (r.status === 'fulfilled') allResults.push(r.value);
      else allResults.push({ domain: '—', ssl: null, whois: null, sslError: r.reason?.message, whoisError: r.reason?.message });
    });
  }

  res.json({ results: allResults });
});

// ─── Start Server ────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`\n🌐 Domain & SSL Checker is running!`);
    console.log(`📡 Open http://localhost:${PORT} in your browser\n`);
  });
}

module.exports = app;
