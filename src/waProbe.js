'use strict';

/**
 * WhatsApp endpoint probes - no QR code authentication needed.
 * Uses puppeteer (bundled with whatsapp-web.js) to render wa.me pages
 * and extract discovery data from the rendered DOM.
 *
 * Key discovery: wa.me/<number> renders differently based on registration:
 *   - Registered WITH profile name: shows the person's name (e.g. "Hitesh Sevlani")
 *   - Registered WITHOUT name / or any valid format: shows "Chat on WhatsApp with +<number>"
 *   - Invalid format: shows "Phone number shared via url is invalid"
 */

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (_e) {
  // puppeteer is a peer dep of whatsapp-web.js, should be available
}

/**
 * Probe wa.me to extract WhatsApp discovery data for a phone number.
 * This renders the actual page in a browser to extract:
 *   - Display name (if the user has set one publicly)
 *   - Registration signal (name shown = definitely registered)
 *   - Invalid number detection
 *
 * @param {string} phoneNumber - Digits only or with + prefix
 * @param {object} [browser] - Existing puppeteer browser instance (optional)
 * @returns {Promise<object>} { registered, displayName, pageTitle, pageText, url, error }
 */
async function probeWaMe(phoneNumber, browser) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const url = `https://wa.me/${stripped}`;
  let ownBrowser = false;

  try {
    if (!browser) {
      if (!puppeteer) {
        return { registered: null, displayName: null, error: 'puppeteer not available', url };
      }
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      ownBrowser = true;
    }

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    // Wait for meaningful content to render
    await page.waitForFunction(
      () => document.body && document.body.innerText.length > 10,
      { timeout: 10000 }
    ).catch(() => {});

    const pageData = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      const title = document.title || '';

      // Try to find the main heading / display name
      // wa.me pages show the name in a prominent heading element
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      const h3 = document.querySelector('h3');
      // Also check for the specific class WhatsApp uses
      const mainText = document.querySelector('[data-testid="conversation-header"]');

      return {
        text,
        title,
        h1: h1 ? h1.innerText.trim() : null,
        h2: h2 ? h2.innerText.trim() : null,
        h3: h3 ? h3.innerText.trim() : null,
        mainText: mainText ? mainText.innerText.trim() : null,
      };
    });

    await page.close();

    const text = pageData.text;
    const textLower = text.toLowerCase();

    // Check for invalid number
    const isInvalid = textLower.includes('phone number shared via url is invalid') ||
                      textLower.includes('is invalid');

    // Extract display name from the page
    // When a number is registered WITH a public name, wa.me shows:
    //   "Skip to content\n<DisplayName>\nOpen app\n..."
    // When it's just a number (no name or unregistered), it shows:
    //   "Skip to content\n\nChat on WhatsApp with +XX XXX XXX XXXX\n..."
    let displayName = null;
    let registered = null;

    if (isInvalid) {
      registered = false;
    } else {
      // Parse the page text to find the display name
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

      // Find the "Skip to content" line and get what follows
      const skipIdx = lines.findIndex((l) => l.toLowerCase() === 'skip to content');
      if (skipIdx >= 0 && skipIdx + 1 < lines.length) {
        const nextLine = lines[skipIdx + 1];

        // Check if the next line is "Chat on WhatsApp with +..." (no name set)
        if (nextLine.startsWith('Chat on WhatsApp with')) {
          // Number accepted by wa.me but no display name shown
          // This could be registered without public name, or unregistered
          registered = null; // can't definitively tell
          displayName = null;
        } else if (nextLine === 'Open app' || nextLine === 'Continue to WhatsApp Web') {
          // No name between "Skip to content" and "Open app" — odd, treat as inconclusive
          registered = null;
        } else {
          // This IS a display name — the person is definitely registered on WhatsApp
          displayName = nextLine;
          registered = true;
        }
      }
    }

    if (ownBrowser) await browser.close();

    return {
      registered,
      displayName,
      pageTitle: pageData.title,
      pageText: text.substring(0, 500),
      url,
      error: null,
    };
  } catch (err) {
    if (ownBrowser && browser) {
      try { await browser.close(); } catch (_e) { /* ignore */ }
    }
    return { registered: null, displayName: null, url, error: err.message };
  }
}

/**
 * Batch probe multiple numbers using a shared browser instance.
 *
 * @param {string[]} phoneNumbers - Array of phone number strings
 * @returns {Promise<object[]>} Array of probe results
 */
async function batchProbe(phoneNumbers) {
  if (!puppeteer) {
    return phoneNumbers.map((n) => ({
      number: n, registered: null, displayName: null, error: 'puppeteer not available',
    }));
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const results = [];
  for (const num of phoneNumbers) {
    const stripped = num.replace(/\D/g, '');
    const result = await probeWaMe(stripped, browser);
    results.push({ number: num, ...result });
    // Small delay between probes to avoid rate limiting
    await new Promise((r) => setTimeout(r, 1500));
  }

  await browser.close();
  return results;
}

/**
 * Generate a wa.me direct chat link for a phone number.
 * @param {string} phoneNumber - Any format (will be stripped to digits)
 * @returns {string} wa.me URL
 */
function getWaMeLink(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  return `https://wa.me/${stripped}`;
}

module.exports = { probeWaMe, batchProbe, getWaMeLink };
