'use strict';

/**
 * Standalone test script for WhatsApp probes.
 * Tests wa.me endpoint via puppeteer to extract display names and registration signals.
 * No WhatsApp QR code authentication needed.
 *
 * Usage: node src/test-probe.js [phone_numbers...]
 * Example: node src/test-probe.js +919876543210 +33612345678
 */

const { probeWaMe } = require('./waProbe');
const { parsePhoneNumber } = require('./phoneInfo');
const { generateDorks } = require('./webSearch');

const DEFAULT_TEST_NUMBERS = [
  '+12025551234',   // US 555 (likely unregistered)
  '+919876543210',  // India (previously showed "Hitesh Sevlani")
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

  console.log('\n  [PROBE] Rendering wa.me page...');
  const probe = await probeWaMe(phoneInfo.number);

  console.log('  [PROBE] Display Name:', probe.displayName || '(none found)');
  const regStatus = probe.registered === true
    ? 'YES (name found)'
    : probe.registered === false ? 'NO (invalid)' : 'INCONCLUSIVE';
  console.log('  [PROBE] Registered:', regStatus);
  console.log('  [PROBE] wa.me Link:', probe.url);
  if (probe.error) console.log('  [PROBE] Error:', probe.error);

  const dorks = generateDorks(phoneInfo.international);
  console.log(`\n  [OSINT] Generated ${dorks.length} investigation links`);

  return { number: numberInput, phoneInfo, probe, dorks };
}

async function main() {
  const args = process.argv.slice(2);
  const numbers = args.length > 0 ? args : DEFAULT_TEST_NUMBERS;

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       Als OSINT Bot - WhatsApp Probe Test           ║');
  console.log('║  wa.me discovery via browser rendering              ║');
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
    if (!r.probe) {
      console.log(`  ${r.number}: PARSE FAILED or INVALID`);
      continue;
    }
    const name = r.probe.displayName ? ` → "${r.probe.displayName}"` : '';
    const verdict = r.probe.registered === true
      ? 'REGISTERED'
      : r.probe.registered === false ? 'NOT REGISTERED' : 'INCONCLUSIVE';
    console.log(`  ${r.number}: ${verdict}${name}`);
  }

  console.log('\nNote: For full profile data (about, pic, business info, groups),');
  console.log('run the bot with QR auth: npm start');
}

main().catch(console.error);
