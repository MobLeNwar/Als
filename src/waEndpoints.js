'use strict';

/**
 * Direct WhatsApp endpoint probes - no QR code authentication needed.
 *
 * Probes multiple WhatsApp-owned endpoints to extract maximum intelligence
 * about a phone number using only publicly accessible discovery mechanisms:
 *
 *   1. wa.me/<number>         - Main Click-to-Chat landing page (display name, registration signal)
 *   2. api.whatsapp.com/send  - Alternative click-to-chat endpoint (may yield different OG tags)
 *   3. wa.me/c/<number>       - WhatsApp Business catalog page (business detection)
 *
 * Each probe extracts:
 *   - Display name (if publicly set)
 *   - Open Graph meta tags (og:title, og:description, og:image)
 *   - Page title
 *   - Registration / business signals
 *
 * Results are correlated across probes for a confidence score.
 */

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (_e) {
  // puppeteer is a peer dep of whatsapp-web.js, should be available
}

/**
 * Launch a shared headless browser for all probes.
 * @returns {Promise<import('puppeteer').Browser|null>}
 */
async function launchBrowser() {
  if (!puppeteer) return null;
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
}

/**
 * Extract Open Graph and meta tags from a page.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<object>}
 */
async function extractMetaTags(page) {
  return page.evaluate(() => {
    const getMeta = (property) => {
      const el =
        document.querySelector(`meta[property="${property}"]`) ||
        document.querySelector(`meta[name="${property}"]`);
      return el ? el.getAttribute('content') : null;
    };
    return {
      ogTitle: getMeta('og:title'),
      ogDescription: getMeta('og:description'),
      ogImage: getMeta('og:image'),
      ogUrl: getMeta('og:url'),
      ogSiteName: getMeta('og:site_name'),
      twitterTitle: getMeta('twitter:title'),
      twitterDescription: getMeta('twitter:description'),
      twitterImage: getMeta('twitter:image'),
      description: getMeta('description'),
    };
  });
}

/**
 * Extract display name from wa.me page text using multiple strategies.
 * @param {string} text - Full page inner text
 * @returns {{ displayName: string|null, registered: boolean|null, method: string|null }}
 */
function parseWaMeText(text) {
  const textLower = text.toLowerCase();

  // Check for invalid number
  if (
    textLower.includes('phone number shared via url is invalid') ||
    textLower.includes('is invalid')
  ) {
    return { displayName: null, registered: false, method: 'invalid_signal' };
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Strategy 1: "Skip to content" followed by display name
  const skipIdx = lines.findIndex((l) => l.toLowerCase() === 'skip to content');
  if (skipIdx >= 0 && skipIdx + 1 < lines.length) {
    const nextLine = lines[skipIdx + 1];

    if (nextLine.startsWith('Chat on WhatsApp with')) {
      // Number accepted but no display name - registered status uncertain
      return { displayName: null, registered: null, method: null };
    }
    if (nextLine === 'Open app' || nextLine === 'Continue to WhatsApp Web') {
      return { displayName: null, registered: null, method: null };
    }
    // Filter out generic UI text
    const uiTexts = ['download', 'whatsapp', 'message', 'send', 'open', 'continue', 'share'];
    if (!uiTexts.some((t) => nextLine.toLowerCase() === t)) {
      return { displayName: nextLine, registered: true, method: 'skip_to_content' };
    }
  }

  // Strategy 2: Look for "Message <Name>" pattern
  const msgMatch = text.match(/Message\s+(.+?)(?:\n|$)/);
  if (msgMatch && msgMatch[1] && !msgMatch[1].startsWith('+')) {
    const candidate = msgMatch[1].trim();
    if (candidate.length > 1 && candidate.length < 60) {
      return { displayName: candidate, registered: true, method: 'message_pattern' };
    }
  }

  // Strategy 3: Check for "Chat on WhatsApp with +..." (registered but no name)
  if (textLower.includes('chat on whatsapp with')) {
    return { displayName: null, registered: null, method: null };
  }

  return { displayName: null, registered: null, method: null };
}

/**
 * Probe the wa.me/<number> endpoint.
 * @param {string} phoneNumber - Digits (with or without +)
 * @param {import('puppeteer').Browser} [browser]
 * @returns {Promise<object>}
 */
async function probeWaMe(phoneNumber, browser) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/${stripped}`;
  let ownBrowser = false;

  try {
    if (!browser) {
      if (!puppeteer) {
        return { registered: null, displayName: null, error: 'puppeteer not available', url, endpoint: 'wa.me' };
      }
      browser = await launchBrowser();
      ownBrowser = true;
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForFunction(
      () => document.body && document.body.innerText.length > 10,
      { timeout: 10000 }
    ).catch(() => {});

    const pageData = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const title = document.title || '';
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const h3 = document.querySelector('h3');
      return {
        text,
        title,
        h1: h1 ? h1.innerText.trim() : null,
        h2: h2 ? h2.innerText.trim() : null,
        h3: h3 ? h3.innerText.trim() : null,
      };
    });

    const meta = await extractMetaTags(page);
    const finalUrl = page.url();
    await page.close();

    const parsed = parseWaMeText(pageData.text);

    // If OG title has a name (not generic WhatsApp text), use it
    if (!parsed.displayName && meta.ogTitle) {
      const ogTitle = meta.ogTitle.trim();
      // OG title that isn't generic WhatsApp branding likely contains the name
      if (
        ogTitle &&
        !ogTitle.toLowerCase().includes('whatsapp') &&
        !ogTitle.startsWith('+') &&
        ogTitle.length < 60
      ) {
        parsed.displayName = ogTitle;
        parsed.registered = true;
        parsed.method = 'og_title';
      }
    }

    if (ownBrowser) await browser.close();

    return {
      endpoint: 'wa.me',
      registered: parsed.registered,
      displayName: parsed.displayName,
      method: parsed.method,
      pageTitle: pageData.title,
      ogMeta: meta,
      headings: { h1: pageData.h1, h2: pageData.h2, h3: pageData.h3 },
      finalUrl,
      url,
      pageTextPreview: pageData.text.substring(0, 500),
      error: null,
    };
  } catch (err) {
    if (ownBrowser && browser) {
      try { await browser.close(); } catch (_e) { /* ignore */ }
    }
    return { endpoint: 'wa.me', registered: null, displayName: null, url, error: err.message };
  }
}

/**
 * Probe the api.whatsapp.com/send?phone=<number> endpoint.
 * This is an alternative click-to-chat URL that may provide different metadata.
 * @param {string} phoneNumber
 * @param {import('puppeteer').Browser} [browser]
 * @returns {Promise<object>}
 */
async function probeApiWhatsApp(phoneNumber, browser) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://api.whatsapp.com/send?phone=${stripped}`;
  let ownBrowser = false;

  try {
    if (!browser) {
      if (!puppeteer) {
        return { registered: null, displayName: null, error: 'puppeteer not available', url, endpoint: 'api.whatsapp.com' };
      }
      browser = await launchBrowser();
      ownBrowser = true;
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForFunction(
      () => document.body && document.body.innerText.length > 10,
      { timeout: 10000 }
    ).catch(() => {});

    const pageData = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const title = document.title || '';
      return { text, title };
    });

    const meta = await extractMetaTags(page);
    const finalUrl = page.url();
    await page.close();

    const parsed = parseWaMeText(pageData.text);

    if (!parsed.displayName && meta.ogTitle) {
      const ogTitle = meta.ogTitle.trim();
      if (
        ogTitle &&
        !ogTitle.toLowerCase().includes('whatsapp') &&
        !ogTitle.startsWith('+') &&
        ogTitle.length < 60
      ) {
        parsed.displayName = ogTitle;
        parsed.registered = true;
        parsed.method = 'og_title_api';
      }
    }

    if (ownBrowser) await browser.close();

    return {
      endpoint: 'api.whatsapp.com',
      registered: parsed.registered,
      displayName: parsed.displayName,
      method: parsed.method,
      pageTitle: pageData.title,
      ogMeta: meta,
      finalUrl,
      url,
      pageTextPreview: pageData.text.substring(0, 500),
      error: null,
    };
  } catch (err) {
    if (ownBrowser && browser) {
      try { await browser.close(); } catch (_e) { /* ignore */ }
    }
    return { endpoint: 'api.whatsapp.com', registered: null, displayName: null, url, error: err.message };
  }
}

/**
 * Probe the wa.me/c/<number> endpoint for WhatsApp Business catalog.
 * Business accounts expose a catalog page that leaks:
 *   - Business name
 *   - Business description
 *   - Category
 *   - Product listings
 * @param {string} phoneNumber
 * @param {import('puppeteer').Browser} [browser]
 * @returns {Promise<object>}
 */
async function probeBusinessCatalog(phoneNumber, browser) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/c/${stripped}`;
  let ownBrowser = false;

  try {
    if (!browser) {
      if (!puppeteer) {
        return { isBusiness: false, error: 'puppeteer not available', url, endpoint: 'wa.me/c' };
      }
      browser = await launchBrowser();
      ownBrowser = true;
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    const status = response ? response.status() : null;

    await page.waitForFunction(
      () => document.body && document.body.innerText.length > 5,
      { timeout: 8000 }
    ).catch(() => {});

    const pageData = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const title = document.title || '';
      return { text, title };
    });

    const meta = await extractMetaTags(page);
    const finalUrl = page.url();
    await page.close();

    const textLower = pageData.text.toLowerCase();
    const isBusiness =
      !textLower.includes('page not found') &&
      !textLower.includes('not found') &&
      !textLower.includes('invalid') &&
      status === 200 &&
      pageData.text.length > 20;

    let businessName = null;
    if (isBusiness && meta.ogTitle) {
      businessName = meta.ogTitle.trim();
    }

    if (ownBrowser) await browser.close();

    return {
      endpoint: 'wa.me/c',
      isBusiness,
      businessName,
      pageTitle: pageData.title,
      ogMeta: meta,
      httpStatus: status,
      finalUrl,
      url,
      pageTextPreview: pageData.text.substring(0, 500),
      error: null,
    };
  } catch (err) {
    if (ownBrowser && browser) {
      try { await browser.close(); } catch (_e) { /* ignore */ }
    }
    return { endpoint: 'wa.me/c', isBusiness: false, url, error: err.message };
  }
}

/**
 * Run all WhatsApp endpoint probes for a phone number.
 * Uses a shared browser instance for efficiency.
 *
 * @param {string} phoneNumber - Phone number (digits or with +)
 * @returns {Promise<object>} Combined probe results with confidence scoring
 */
async function probeAllEndpoints(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const startTime = Date.now();

  let browser = null;
  let ownBrowser = false;
  try {
    browser = await launchBrowser();
    ownBrowser = true;
  } catch (_e) {
    // Fall through with null browser
  }

  // Run all probes in parallel using shared browser
  const [waMeResult, apiResult, catalogResult] = await Promise.all([
    probeWaMe(stripped, browser).catch((e) => ({ endpoint: 'wa.me', error: e.message })),
    probeApiWhatsApp(stripped, browser).catch((e) => ({ endpoint: 'api.whatsapp.com', error: e.message })),
    probeBusinessCatalog(stripped, browser).catch((e) => ({ endpoint: 'wa.me/c', error: e.message })),
  ]);

  if (ownBrowser && browser) {
    try { await browser.close(); } catch (_e) { /* ignore */ }
  }

  // Correlate results across probes
  const correlation = correlateResults(waMeResult, apiResult, catalogResult);

  return {
    phoneNumber: stripped,
    probes: {
      waMe: waMeResult,
      apiWhatsApp: apiResult,
      businessCatalog: catalogResult,
    },
    summary: correlation,
    probeTimeMs: Date.now() - startTime,
  };
}

/**
 * Cross-reference probe results for confidence scoring.
 * @param {object} waMeResult
 * @param {object} apiResult
 * @param {object} catalogResult
 * @returns {object} Correlated summary
 */
function correlateResults(waMeResult, apiResult, catalogResult) {
  const summary = {
    displayName: null,
    registered: null,
    isBusiness: false,
    businessName: null,
    confidence: 'low',
    signals: [],
    waMeLink: waMeResult.url || null,
  };

  // Collect registration signals
  const regSignals = [];
  if (waMeResult.registered === true) regSignals.push({ source: 'wa.me', value: true });
  if (waMeResult.registered === false) regSignals.push({ source: 'wa.me', value: false });
  if (apiResult.registered === true) regSignals.push({ source: 'api.whatsapp.com', value: true });
  if (apiResult.registered === false) regSignals.push({ source: 'api.whatsapp.com', value: false });

  // Determine registration status
  const trueCount = regSignals.filter((s) => s.value === true).length;
  const falseCount = regSignals.filter((s) => s.value === false).length;
  if (trueCount > 0) {
    summary.registered = true;
    summary.signals.push(`Registered: confirmed by ${trueCount} probe(s)`);
  } else if (falseCount > 0) {
    summary.registered = false;
    summary.signals.push('Not registered: number invalid');
  } else {
    summary.registered = null;
    summary.signals.push('Registration: inconclusive (no display name set or privacy restricted)');
  }

  // Collect display names from all probes
  const names = [];
  if (waMeResult.displayName) names.push({ name: waMeResult.displayName, source: 'wa.me', method: waMeResult.method });
  if (apiResult.displayName) names.push({ name: apiResult.displayName, source: 'api.whatsapp.com', method: apiResult.method });
  if (catalogResult.businessName) names.push({ name: catalogResult.businessName, source: 'wa.me/c' });

  if (names.length > 0) {
    summary.displayName = names[0].name;
    summary.signals.push(`Name "${names[0].name}" found via ${names[0].source} (${names[0].method || 'meta'})`);
    if (names.length > 1) {
      summary.signals.push(`Name corroborated by ${names.length} source(s)`);
    }
  }

  // Business detection
  if (catalogResult.isBusiness) {
    summary.isBusiness = true;
    summary.businessName = catalogResult.businessName;
    summary.signals.push('Business account detected via catalog endpoint');
  }

  // Confidence scoring
  if (summary.registered === true && names.length >= 2) {
    summary.confidence = 'high';
  } else if (summary.registered === true || names.length > 0) {
    summary.confidence = 'medium';
  } else if (summary.registered === false) {
    summary.confidence = 'high'; // confident it's not registered
  } else {
    summary.confidence = 'low';
  }

  return summary;
}

/**
 * Generate a wa.me direct chat link.
 * @param {string} phoneNumber
 * @returns {string}
 */
function getWaMeLink(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${stripped}`;
}

module.exports = {
  probeWaMe,
  probeApiWhatsApp,
  probeBusinessCatalog,
  probeAllEndpoints,
  correlateResults,
  getWaMeLink,
  launchBrowser,
  parseWaMeText,
  extractMetaTags,
};
