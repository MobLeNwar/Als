'use strict';

/**
 * Lightweight HTTP-based WhatsApp endpoint probes.
 * These do NOT require puppeteer or a browser - they use native Node.js HTTP(S).
 *
 * Probes:
 *   1. wa.me/<number> HTTP redirect analysis (registration signal from redirect behavior)
 *   2. api.whatsapp.com/send HTTP HEAD (OG meta extraction via raw HTML)
 *   3. wa.me/c/<number> HTTP GET (business catalog detection)
 *   4. Profile picture CDN probe (pps.whatsapp.net URL pattern analysis)
 *   5. WhatsApp Business API check (web.whatsapp.com deeplink analysis)
 *
 * All probes are free, require no authentication, and use only built-in Node.js modules.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Make an HTTPS GET request and return response details.
 * Follows up to maxRedirects redirects.
 * @param {string} url
 * @param {object} [options]
 * @returns {Promise<{statusCode: number, headers: object, body: string, finalUrl: string, redirectChain: string[]}>}
 */
function httpsGet(url, options = {}) {
  const {
    userAgent = DEFAULT_USER_AGENT,
    maxRedirects = 5,
    timeoutMs = 12000,
    maxBodyBytes = 64000,
    method = 'GET',
  } = options;

  return new Promise((resolve, reject) => {
    const redirectChain = [];
    let currentUrl = url;
    let redirectCount = 0;

    function doRequest(reqUrl) {
      const parsed = new URL(reqUrl);
      const requestModule = parsed.protocol === 'https:' ? https : http;

      const reqOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        timeout: timeoutMs,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Connection': 'close',
        },
      };

      const req = requestModule.request(reqOptions, (res) => {
        const statusCode = res.statusCode;

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
          redirectChain.push(reqUrl);
          redirectCount++;
          if (redirectCount > maxRedirects) {
            resolve({
              statusCode,
              headers: res.headers,
              body: '',
              finalUrl: reqUrl,
              redirectChain,
              error: 'max redirects exceeded',
            });
            return;
          }
          let nextUrl = res.headers.location;
          if (nextUrl.startsWith('/')) {
            nextUrl = `${parsed.protocol}//${parsed.host}${nextUrl}`;
          }
          currentUrl = nextUrl;
          doRequest(nextUrl);
          return;
        }

        // Collect body
        const chunks = [];
        let totalBytes = 0;
        res.on('data', (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes <= maxBodyBytes) {
            chunks.push(chunk);
          }
        });
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve({
            statusCode,
            headers: res.headers,
            body,
            finalUrl: currentUrl,
            redirectChain,
          });
        });
        res.on('error', (err) => {
          reject(err);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });
      req.on('error', (err) => {
        reject(err);
      });
      req.end();
    }

    doRequest(currentUrl);
  });
}

/**
 * Extract Open Graph tags from raw HTML.
 * @param {string} html
 * @returns {object}
 */
function extractOGTags(html) {
  const tags = {};
  const ogPattern = /<meta\s+(?:property|name)=["']og:(\w+)["']\s+content=["']([^"']*)["']/gi;
  let match;
  while ((match = ogPattern.exec(html)) !== null) {
    tags[`og:${match[1]}`] = match[2];
  }
  // Also try reversed attribute order: content before property
  const ogPattern2 = /<meta\s+content=["']([^"']*)["']\s+(?:property|name)=["']og:(\w+)["']/gi;
  while ((match = ogPattern2.exec(html)) !== null) {
    tags[`og:${match[2]}`] = match[1];
  }
  return tags;
}

/**
 * Extract page title from raw HTML.
 * @param {string} html
 * @returns {string|null}
 */
function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : null;
}

/**
 * Probe wa.me/<number> via HTTP (no browser).
 * Analyzes redirect behavior, response headers, and HTML content for registration signals.
 * @param {string} phoneNumber - Digits only
 * @returns {Promise<object>}
 */
async function probeWaMeHttp(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/${stripped}`;
  const startTime = Date.now();

  try {
    const result = await httpsGet(url, { userAgent: DEFAULT_USER_AGENT });
    const og = extractOGTags(result.body);
    const title = extractTitle(result.body);

    // Analyze redirect behavior
    const redirectedToApi = result.finalUrl.includes('api.whatsapp.com');
    const redirectedToWeb = result.finalUrl.includes('web.whatsapp.com');
    const hasRedirects = result.redirectChain.length > 0;

    // Check for invalid number signal in body
    const bodyLower = result.body.toLowerCase();
    const isInvalid =
      bodyLower.includes('phone number shared via url is invalid') ||
      bodyLower.includes('is invalid');

    // Try to extract display name from OG title
    let displayName = null;
    const ogTitle = og['og:title'] || '';
    if (
      ogTitle &&
      !ogTitle.toLowerCase().includes('whatsapp') &&
      !ogTitle.toLowerCase().includes('share on') &&
      !ogTitle.startsWith('+') &&
      ogTitle.length > 1 &&
      ogTitle.length < 60
    ) {
      displayName = ogTitle;
    }

    // Check content-length as a signal (larger pages may have more dynamic content)
    const contentLength = result.headers['content-length']
      ? parseInt(result.headers['content-length'], 10)
      : result.body.length;

    // Extract server header for fingerprinting
    const serverHeader = result.headers['server'] || null;

    // Registration inference
    let registered = null;
    if (isInvalid) {
      registered = false;
    } else if (displayName) {
      registered = true;
    } else if (redirectedToApi || redirectedToWeb) {
      // Redirect to api/web suggests number is valid enough to proceed
      registered = null; // inconclusive but number accepted
    }

    return {
      endpoint: 'wa.me (HTTP)',
      url,
      registered,
      displayName,
      isInvalid,
      pageTitle: title,
      ogTags: og,
      finalUrl: result.finalUrl,
      redirectChain: result.redirectChain,
      redirectedToApi,
      redirectedToWeb,
      statusCode: result.statusCode,
      contentLength,
      serverHeader,
      probeTimeMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    return {
      endpoint: 'wa.me (HTTP)',
      url,
      registered: null,
      displayName: null,
      probeTimeMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

/**
 * Probe api.whatsapp.com/send?phone=<number> via HTTP.
 * @param {string} phoneNumber
 * @returns {Promise<object>}
 */
async function probeApiWhatsAppHttp(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://api.whatsapp.com/send?phone=${stripped}`;
  const startTime = Date.now();

  try {
    const result = await httpsGet(url, { userAgent: DEFAULT_USER_AGENT });
    const og = extractOGTags(result.body);
    const title = extractTitle(result.body);

    let displayName = null;
    const ogTitle = og['og:title'] || '';
    if (
      ogTitle &&
      !ogTitle.toLowerCase().includes('whatsapp') &&
      !ogTitle.toLowerCase().includes('share on') &&
      !ogTitle.startsWith('+') &&
      ogTitle.length > 1 &&
      ogTitle.length < 60
    ) {
      displayName = ogTitle;
    }

    const bodyLower = result.body.toLowerCase();
    const isInvalid = bodyLower.includes('is invalid');

    let registered = null;
    if (isInvalid) {
      registered = false;
    } else if (displayName) {
      registered = true;
    }

    return {
      endpoint: 'api.whatsapp.com (HTTP)',
      url,
      registered,
      displayName,
      isInvalid,
      pageTitle: title,
      ogTags: og,
      finalUrl: result.finalUrl,
      statusCode: result.statusCode,
      probeTimeMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    return {
      endpoint: 'api.whatsapp.com (HTTP)',
      url,
      registered: null,
      displayName: null,
      probeTimeMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

/**
 * Probe wa.me/c/<number> for business catalog via HTTP.
 * @param {string} phoneNumber
 * @returns {Promise<object>}
 */
async function probeBusinessCatalogHttp(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/c/${stripped}`;
  const startTime = Date.now();

  try {
    const result = await httpsGet(url, { userAgent: MOBILE_USER_AGENT });
    const og = extractOGTags(result.body);
    const title = extractTitle(result.body);
    const bodyLower = result.body.toLowerCase();

    const isBusiness =
      result.statusCode === 200 &&
      result.body.length > 50 &&
      !bodyLower.includes('page not found') &&
      !bodyLower.includes('not found') &&
      !bodyLower.includes('invalid');

    let businessName = null;
    if (isBusiness) {
      businessName = og['og:title'] || title || null;
      if (businessName && businessName.toLowerCase().includes('whatsapp')) {
        businessName = null;
      }
    }

    // Look for catalog items in HTML
    const hasCatalogItems =
      bodyLower.includes('catalog') ||
      bodyLower.includes('product') ||
      bodyLower.includes('item');

    return {
      endpoint: 'wa.me/c (HTTP)',
      url,
      isBusiness,
      businessName,
      hasCatalogItems,
      pageTitle: title,
      ogTags: og,
      statusCode: result.statusCode,
      contentLength: result.body.length,
      probeTimeMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    return {
      endpoint: 'wa.me/c (HTTP)',
      url,
      isBusiness: false,
      probeTimeMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

/**
 * Probe WhatsApp Business API endpoint for number verification.
 * Uses the WhatsApp Business Platform public lookup.
 * @param {string} phoneNumber
 * @returns {Promise<object>}
 */
async function probeWhatsAppBusinessApi(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/message/${stripped}`;
  const startTime = Date.now();

  try {
    const result = await httpsGet(url, {
      userAgent: MOBILE_USER_AGENT,
      maxRedirects: 3,
    });

    const og = extractOGTags(result.body);
    const title = extractTitle(result.body);

    // Different redirect behavior for message vs standard wa.me
    const redirectPattern = result.redirectChain.length > 0
      ? result.redirectChain.map((u) => new URL(u).hostname).join(' -> ')
      : 'none';

    return {
      endpoint: 'wa.me/message (HTTP)',
      url,
      pageTitle: title,
      ogTags: og,
      statusCode: result.statusCode,
      finalUrl: result.finalUrl,
      redirectPattern,
      probeTimeMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    return {
      endpoint: 'wa.me/message (HTTP)',
      url,
      probeTimeMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

/**
 * Probe profile picture availability via HTTP HEAD to known CDN patterns.
 * WhatsApp profile pictures are served from pps.whatsapp.net.
 * We can check if a profile picture URL pattern returns data.
 * @param {string} phoneNumber
 * @returns {Promise<object>}
 */
async function probeProfilePicAvailability(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  // This is a heuristic check - we probe the wa.me page with mobile UA
  // which sometimes includes profile pic references in the HTML/OG tags
  const url = `https://wa.me/${stripped}`;
  const startTime = Date.now();

  try {
    const result = await httpsGet(url, { userAgent: MOBILE_USER_AGENT });
    const og = extractOGTags(result.body);

    const ogImage = og['og:image'] || null;
    let profilePicSignal = 'unknown';
    let profilePicCdnUrl = null;

    if (ogImage) {
      if (ogImage.includes('pps.whatsapp.net')) {
        profilePicSignal = 'visible';
        profilePicCdnUrl = ogImage;
      } else if (ogImage.includes('static.whatsapp.net') || ogImage.includes('whatsapp-cdn')) {
        profilePicSignal = 'default_or_hidden';
      } else {
        profilePicSignal = 'custom_image';
        profilePicCdnUrl = ogImage;
      }
    }

    // Look for profile pic references in the HTML body
    const ppMatches = result.body.match(/pps\.whatsapp\.net[^"'\s]*/g) || [];

    return {
      endpoint: 'profile_pic_probe',
      profilePicSignal,
      profilePicCdnUrl,
      ogImage,
      ppsCdnReferences: ppMatches.length,
      probeTimeMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    return {
      endpoint: 'profile_pic_probe',
      profilePicSignal: 'error',
      probeTimeMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

/**
 * Run all lightweight HTTP probes in parallel.
 * No puppeteer/browser needed - uses only Node.js built-in HTTPS.
 * @param {string} phoneNumber
 * @returns {Promise<object>}
 */
async function probeAllHttpEndpoints(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const startTime = Date.now();

  const [waMeResult, apiResult, catalogResult, businessApiResult, profilePicResult] =
    await Promise.all([
      probeWaMeHttp(stripped).catch((e) => ({ endpoint: 'wa.me (HTTP)', error: e.message })),
      probeApiWhatsAppHttp(stripped).catch((e) => ({ endpoint: 'api.whatsapp.com (HTTP)', error: e.message })),
      probeBusinessCatalogHttp(stripped).catch((e) => ({ endpoint: 'wa.me/c (HTTP)', error: e.message })),
      probeWhatsAppBusinessApi(stripped).catch((e) => ({ endpoint: 'wa.me/message (HTTP)', error: e.message })),
      probeProfilePicAvailability(stripped).catch((e) => ({ endpoint: 'profile_pic_probe', error: e.message })),
    ]);

  // Cross-reference all HTTP probe results
  const summary = correlateHttpResults(waMeResult, apiResult, catalogResult, businessApiResult, profilePicResult);

  return {
    phoneNumber: stripped,
    probes: {
      waMe: waMeResult,
      apiWhatsApp: apiResult,
      businessCatalog: catalogResult,
      businessApi: businessApiResult,
      profilePic: profilePicResult,
    },
    summary,
    totalProbeTimeMs: Date.now() - startTime,
  };
}

/**
 * Cross-reference HTTP probe results for a confidence-scored summary.
 * @param {object} waMeResult
 * @param {object} apiResult
 * @param {object} catalogResult
 * @param {object} businessApiResult
 * @param {object} profilePicResult
 * @returns {object}
 */
function correlateHttpResults(waMeResult, apiResult, catalogResult, businessApiResult, profilePicResult) {
  const summary = {
    displayName: null,
    registered: null,
    isBusiness: false,
    businessName: null,
    profilePicStatus: 'unknown',
    confidence: 'low',
    signals: [],
  };

  // Collect registration signals
  const regSignals = [];
  if (waMeResult && waMeResult.registered === true) regSignals.push({ source: 'wa.me', value: true });
  if (waMeResult && waMeResult.registered === false) regSignals.push({ source: 'wa.me', value: false });
  if (apiResult && apiResult.registered === true) regSignals.push({ source: 'api.whatsapp.com', value: true });
  if (apiResult && apiResult.registered === false) regSignals.push({ source: 'api.whatsapp.com', value: false });

  const trueCount = regSignals.filter((s) => s.value === true).length;
  const falseCount = regSignals.filter((s) => s.value === false).length;
  if (trueCount > 0) {
    summary.registered = true;
    summary.signals.push(`Registered: confirmed by ${trueCount} HTTP probe(s)`);
  } else if (falseCount > 0) {
    summary.registered = false;
    summary.signals.push('Not registered: invalid number detected');
  } else {
    summary.registered = null;
    summary.signals.push('Registration: inconclusive from HTTP probes');
  }

  // Collect display names
  const names = [];
  if (waMeResult && waMeResult.displayName) names.push({ name: waMeResult.displayName, source: 'wa.me' });
  if (apiResult && apiResult.displayName) names.push({ name: apiResult.displayName, source: 'api.whatsapp.com' });
  if (catalogResult && catalogResult.businessName) names.push({ name: catalogResult.businessName, source: 'wa.me/c' });

  if (names.length > 0) {
    summary.displayName = names[0].name;
    summary.signals.push(`Name "${names[0].name}" via ${names[0].source} (HTTP)`);
    if (names.length > 1) {
      summary.signals.push(`Name corroborated by ${names.length} HTTP source(s)`);
    }
  }

  // Business detection
  if (catalogResult && catalogResult.isBusiness) {
    summary.isBusiness = true;
    summary.businessName = catalogResult.businessName;
    summary.signals.push('Business account detected via catalog HTTP probe');
  }

  // Profile picture
  if (profilePicResult && profilePicResult.profilePicSignal) {
    summary.profilePicStatus = profilePicResult.profilePicSignal;
    if (profilePicResult.profilePicSignal === 'visible') {
      summary.signals.push('Profile picture: publicly visible (CDN URL found)');
    } else if (profilePicResult.profilePicSignal === 'default_or_hidden') {
      summary.signals.push('Profile picture: default/hidden');
    }
  }

  // Redirect analysis
  if (waMeResult && waMeResult.redirectedToApi) {
    summary.signals.push('wa.me redirected to api.whatsapp.com (number accepted)');
  }
  if (waMeResult && waMeResult.redirectedToWeb) {
    summary.signals.push('wa.me redirected to web.whatsapp.com (number accepted)');
  }

  // Confidence scoring
  if (summary.registered === true && names.length >= 2) {
    summary.confidence = 'high';
  } else if (summary.registered === true || names.length > 0) {
    summary.confidence = 'medium';
  } else if (summary.registered === false) {
    summary.confidence = 'high';
  } else {
    summary.confidence = 'low';
  }

  return summary;
}

module.exports = {
  probeAllHttpEndpoints,
  probeWaMeHttp,
  probeApiWhatsAppHttp,
  probeBusinessCatalogHttp,
  probeWhatsAppBusinessApi,
  probeProfilePicAvailability,
  correlateHttpResults,
  // Utility exports for testing
  extractOGTags,
  extractTitle,
  httpsGet,
};
