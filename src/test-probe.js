'use strict';

/**
 * Standalone test script for WhatsApp endpoint probes.
 * Tests multiple WhatsApp endpoints via puppeteer to extract maximum intelligence.
 * No WhatsApp QR code authentication needed.
 *
 * Probes:
 *   1. wa.me/<number>                  - Display name, registration signal
 *   2. api.whatsapp.com/send?phone=    - Alternative endpoint, OG meta tags
 *   3. wa.me/c/<number>                - Business catalog detection
 *
 * Usage: node src/test-probe.js [phone_numbers...]
 * Example: node src/test-probe.js +919876543210 +33612345678
 */

const { probeAllEndpoints } = require('./waEndpoints');
const { parsePhoneNumber } = require('./phoneInfo');
const { generateDorks } = require('./webSearch');

const DEFAULT_TEST_NUMBERS = [
  '+12025551234',   // US 555 (likely unregistered)
  '+919876543210',  // India
  '+33612345678',   // France
  '+447911123456',  // UK mobile
];

async function testNumber(numberInput) {
  console.log('\n' + '='.repeat(60));
  console.log(`Testing: ${numberInput}`);
  console.log('='.repeat(60));

  const phoneInfo = parsePhoneNumber(numberInput);
  if (!phoneInfo) {
    console.log('  [PARSE] FAILED - could not parse number');
    return { number: numberInput };
  }

  console.log('  [PARSE] Valid:', phoneInfo.valid);
  console.log('  [PARSE] Country:', phoneInfo.country);
  console.log('  [PARSE] Calling Code: +' + phoneInfo.callingCode);
  console.log('  [PARSE] Type:', phoneInfo.type);
  console.log('  [PARSE] International:', phoneInfo.international);

  if (!phoneInfo.valid) {
    console.log('  [SKIP] Number is not valid');
    return { number: numberInput, phoneInfo };
  }

  console.log('\n  [PROBES] Running all endpoint probes...');
  const probeResults = await probeAllEndpoints(phoneInfo.number);

  // Display individual probe results
  const probes = probeResults.probes || {};

  if (probes.waMe) {
    const p = probes.waMe;
    console.log('\n  [wa.me]');
    console.log('    Display Name:', p.displayName || '(none)');
    console.log('    Registered:', formatRegStatus(p.registered));
    console.log('    Method:', p.method || 'N/A');
    if (p.ogMeta && p.ogMeta.ogTitle) console.log('    OG Title:', p.ogMeta.ogTitle);
    if (p.ogMeta && p.ogMeta.ogDescription) console.log('    OG Desc:', p.ogMeta.ogDescription);
    if (p.error) console.log('    Error:', p.error);
  }

  if (probes.apiWhatsApp) {
    const p = probes.apiWhatsApp;
    console.log('\n  [api.whatsapp.com]');
    console.log('    Display Name:', p.displayName || '(none)');
    console.log('    Registered:', formatRegStatus(p.registered));
    console.log('    Method:', p.method || 'N/A');
    if (p.ogMeta && p.ogMeta.ogTitle) console.log('    OG Title:', p.ogMeta.ogTitle);
    if (p.ogMeta && p.ogMeta.ogDescription) console.log('    OG Desc:', p.ogMeta.ogDescription);
    if (p.error) console.log('    Error:', p.error);
  }

  if (probes.businessCatalog) {
    const p = probes.businessCatalog;
    console.log('\n  [wa.me/c (business catalog)]');
    console.log('    Is Business:', p.isBusiness ? 'YES' : 'No');
    if (p.businessName) console.log('    Business Name:', p.businessName);
    console.log('    HTTP Status:', p.httpStatus || 'N/A');
    if (p.error) console.log('    Error:', p.error);
  }

  // Display correlated summary
  const summary = probeResults.summary || {};
  console.log('\n  [CORRELATION SUMMARY]');
  console.log('    Confidence:', (summary.confidence || 'unknown').toUpperCase());
  console.log('    Display Name:', summary.displayName || '(none found)');
  console.log('    Registered:', formatRegStatus(summary.registered));
  console.log('    Is Business:', summary.isBusiness ? 'YES' : 'No');
  if (summary.signals) {
    summary.signals.forEach((s) => console.log('    Signal:', s));
  }
  console.log('    Probe Time:', probeResults.probeTimeMs + 'ms');

  const dorks = generateDorks(phoneInfo.international);
  console.log(`\n  [OSINT] Generated ${dorks.length} investigation links`);

  return { number: numberInput, phoneInfo, probeResults, dorks };
}

function formatRegStatus(val) {
  if (val === true) return 'YES';
  if (val === false) return 'NO (invalid)';
  return 'INCONCLUSIVE';
}

async function main() {
  const args = process.argv.slice(2);
  const numbers = args.length > 0 ? args : DEFAULT_TEST_NUMBERS;

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Als OSINT Bot - Multi-Endpoint Probe Test     ║');
  console.log('║  Probes: wa.me, api.whatsapp.com, wa.me/c           ║');
  console.log('║  No QR code / WhatsApp auth needed                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nTesting ${numbers.length} number(s)...\n`);

  const results = [];
  for (const num of numbers) {
    const result = await testNumber(num);
    results.push(result);
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    if (!r.probeResults || !r.probeResults.summary) {
      console.log(`  ${r.number}: PARSE FAILED or INVALID`);
      continue;
    }
    const s = r.probeResults.summary;
    const name = s.displayName ? ` → "${s.displayName}"` : '';
    const verdict = formatRegStatus(s.registered);
    const conf = (s.confidence || '?').toUpperCase();
    const biz = s.isBusiness ? ' [BUSINESS]' : '';
    console.log(`  ${r.number}: ${verdict} (${conf})${name}${biz}`);
  }

  console.log('\nNote: For full profile data (about, pic, business info, groups),');
  console.log('run the bot with QR auth: npm start');
}

main().catch(console.error);
