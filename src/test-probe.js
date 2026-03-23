'use strict';

/**
 * Standalone test script for WhatsApp endpoint probes.
 * Tests multiple WhatsApp endpoints via both HTTP and puppeteer to extract maximum intelligence.
 * No WhatsApp QR code authentication needed.
 *
 * Probes (Browser-based):
 *   1. wa.me/<number>                  - Display name, registration signal
 *   2. api.whatsapp.com/send?phone=    - Alternative endpoint, OG meta tags
 *   3. wa.me/c/<number>                - Business catalog detection
 *
 * Probes (HTTP-based, no browser):
 *   4. wa.me HTTP redirect analysis     - Registration signal from redirect behavior
 *   5. api.whatsapp.com HTTP            - OG meta extraction via raw HTML
 *   6. wa.me/c HTTP                     - Business catalog detection
 *   7. wa.me/message HTTP               - WhatsApp Business API check
 *   8. Profile picture CDN probe        - pps.whatsapp.net URL pattern analysis
 *
 * Profile Builder:
 *   - Cross-references all sources for confidence scoring
 *   - Number age estimation (allocation period analysis)
 *   - Carrier type analysis
 *   - Country intelligence (timezone, language)
 *
 * Usage: node src/test-probe.js [phone_numbers...]
 * Example: node src/test-probe.js +919876543210 +33612345678
 */

const { probeAllEndpoints } = require('./waEndpoints');
const { probeAllHttpEndpoints } = require('./waDirectProbes');
const { parsePhoneNumber } = require('./phoneInfo');
const { generateDorks } = require('./webSearch');
const { buildProfile } = require('./profileBuilder');

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

  // Run HTTP probes (lightweight, no browser)
  console.log('\n  [HTTP PROBES] Running lightweight HTTP endpoint probes...');
  let httpProbeResults = null;
  try {
    httpProbeResults = await probeAllHttpEndpoints(phoneInfo.number);
    const hp = httpProbeResults.probes || {};

    if (hp.waMe) {
      console.log('\n  [HTTP wa.me]');
      console.log('    Display Name:', hp.waMe.displayName || '(none)');
      console.log('    Registered:', formatRegStatus(hp.waMe.registered));
      console.log('    Status Code:', hp.waMe.statusCode || 'N/A');
      if (hp.waMe.redirectedToApi) console.log('    Redirected to API: YES');
      if (hp.waMe.serverHeader) console.log('    Server:', hp.waMe.serverHeader);
      console.log('    Probe Time:', hp.waMe.probeTimeMs + 'ms');
    }

    if (hp.apiWhatsApp) {
      console.log('\n  [HTTP api.whatsapp.com]');
      console.log('    Display Name:', hp.apiWhatsApp.displayName || '(none)');
      console.log('    Registered:', formatRegStatus(hp.apiWhatsApp.registered));
      console.log('    Status Code:', hp.apiWhatsApp.statusCode || 'N/A');
      console.log('    Probe Time:', hp.apiWhatsApp.probeTimeMs + 'ms');
    }

    if (hp.businessCatalog) {
      console.log('\n  [HTTP wa.me/c]');
      console.log('    Is Business:', hp.businessCatalog.isBusiness ? 'YES' : 'No');
      if (hp.businessCatalog.businessName) console.log('    Business Name:', hp.businessCatalog.businessName);
      console.log('    Probe Time:', hp.businessCatalog.probeTimeMs + 'ms');
    }

    if (hp.profilePic) {
      console.log('\n  [Profile Pic Probe]');
      console.log('    Signal:', hp.profilePic.profilePicSignal || 'unknown');
      if (hp.profilePic.profilePicCdnUrl) console.log('    CDN URL:', hp.profilePic.profilePicCdnUrl);
      console.log('    Probe Time:', hp.profilePic.probeTimeMs + 'ms');
    }

    // HTTP correlation summary
    if (httpProbeResults.summary) {
      const hs = httpProbeResults.summary;
      console.log('\n  [HTTP CORRELATION]');
      console.log('    Confidence:', (hs.confidence || 'unknown').toUpperCase());
      console.log('    Display Name:', hs.displayName || '(none found)');
      console.log('    Registered:', formatRegStatus(hs.registered));
      console.log('    Is Business:', hs.isBusiness ? 'YES' : 'No');
      console.log('    Profile Pic:', hs.profilePicStatus || 'unknown');
      if (hs.signals) {
        hs.signals.forEach((s) => console.log('    Signal:', s));
      }
    }
    console.log('    Total HTTP Probe Time:', httpProbeResults.totalProbeTimeMs + 'ms');
  } catch (err) {
    console.log('  [HTTP PROBES] Error:', err.message);
  }

  // Run browser-based probes
  console.log('\n  [BROWSER PROBES] Running browser endpoint probes...');
  let browserProbeResults = null;
  try {
    browserProbeResults = await probeAllEndpoints(phoneInfo.number);
    const probes = browserProbeResults.probes || {};

    if (probes.waMe) {
      const p = probes.waMe;
      console.log('\n  [Browser wa.me]');
      console.log('    Display Name:', p.displayName || '(none)');
      console.log('    Registered:', formatRegStatus(p.registered));
      console.log('    Method:', p.method || 'N/A');
      if (p.ogMeta && p.ogMeta.ogTitle) console.log('    OG Title:', p.ogMeta.ogTitle);
      if (p.error) console.log('    Error:', p.error);
    }

    if (probes.apiWhatsApp) {
      const p = probes.apiWhatsApp;
      console.log('\n  [Browser api.whatsapp.com]');
      console.log('    Display Name:', p.displayName || '(none)');
      console.log('    Registered:', formatRegStatus(p.registered));
      if (p.error) console.log('    Error:', p.error);
    }

    if (probes.businessCatalog) {
      const p = probes.businessCatalog;
      console.log('\n  [Browser wa.me/c]');
      console.log('    Is Business:', p.isBusiness ? 'YES' : 'No');
      if (p.businessName) console.log('    Business Name:', p.businessName);
      if (p.error) console.log('    Error:', p.error);
    }

    // Browser correlation summary
    const summary = browserProbeResults.summary || {};
    console.log('\n  [BROWSER CORRELATION]');
    console.log('    Confidence:', (summary.confidence || 'unknown').toUpperCase());
    console.log('    Display Name:', summary.displayName || '(none found)');
    console.log('    Registered:', formatRegStatus(summary.registered));
    console.log('    Is Business:', summary.isBusiness ? 'YES' : 'No');
    if (summary.signals) {
      summary.signals.forEach((s) => console.log('    Signal:', s));
    }
    console.log('    Browser Probe Time:', browserProbeResults.probeTimeMs + 'ms');
  } catch (err) {
    console.log('  [BROWSER PROBES] Error:', err.message);
  }

  // Build comprehensive profile
  console.log('\n  [PROFILE BUILDER] Building comprehensive profile...');
  const profile = buildProfile(phoneInfo, null, httpProbeResults, browserProbeResults);

  console.log('\n  [PROFILE SUMMARY]');
  console.log('    Primary Name:', profile.names.primary || '(none)');
  console.log('    Name Confidence:', profile.names.confidence);
  if (profile.names.allNames.length > 0) {
    profile.names.allNames.forEach((n) => {
      console.log(`      - "${n.name}" via ${n.source} (${n.confidence})`);
    });
  }
  console.log('    WhatsApp Registered:', formatRegStatus(profile.whatsappRegistered));
  console.log('    Registration Confidence:', profile.registrationConfidence);
  console.log('    Is Business:', profile.whatsappProfile.isBusiness ? 'YES' : 'No');
  console.log('    Number Type:', profile.numberTypeDescription);
  console.log('    Profile Pic Status:', profile.whatsappProfile.profilePicStatus);

  // Carrier analysis
  if (profile.carrierAnalysis) {
    console.log('\n  [CARRIER ANALYSIS]');
    console.log('    Carrier Type:', profile.carrierAnalysis.likelyCarrierType || 'Unknown');
    console.log('    VoIP:', profile.carrierAnalysis.isLikelyVoip ? 'YES' : 'No');
    if (profile.carrierAnalysis.carrierHints.length > 0) {
      profile.carrierAnalysis.carrierHints.forEach((h) => console.log('    Hint:', h));
    }
  }

  // Number age
  if (profile.numberAge) {
    console.log('\n  [NUMBER AGE ESTIMATION]');
    console.log('    Allocation Period:', profile.numberAge.estimatedAllocationPeriod);
    console.log('    Block Age:', profile.numberAge.numberBlockAge || 'unknown');
    console.log('    Confidence:', profile.numberAge.confidence);
    if (profile.numberAge.reasoning) console.log('    Reasoning:', profile.numberAge.reasoning);
  }

  // Country meta
  if (profile.countryMeta) {
    console.log('\n  [COUNTRY INTELLIGENCE]');
    console.log('    Country:', profile.countryMeta.name);
    console.log('    Continent:', profile.countryMeta.continent);
    console.log('    Languages:', profile.countryMeta.languages.join(', '));
    console.log('    Timezones:', profile.countryMeta.timezones.join(', '));
  }

  console.log('\n  [PROFILE METRICS]');
  console.log('    Confidence Score:', profile.confidenceScore + '/100');
  console.log('    Completeness:', profile.profileCompleteness + '%');
  console.log('    Data Points:', profile.dataPoints);
  console.log('    Summary:');
  profile.summary.forEach((s) => console.log('      -', s));

  const dorks = generateDorks(phoneInfo.international, {
    countryCode: phoneInfo.country,
    nationalNumber: phoneInfo.nationalNumber,
  });
  console.log(`\n  [OSINT] Generated ${dorks.length} investigation links`);

  return { number: numberInput, phoneInfo, httpProbeResults, browserProbeResults, profile, dorks };
}

function formatRegStatus(val) {
  if (val === true) return 'YES';
  if (val === false) return 'NO (invalid)';
  return 'INCONCLUSIVE';
}

async function main() {
  const args = process.argv.slice(2);
  const numbers = args.length > 0 ? args : DEFAULT_TEST_NUMBERS;

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       Als OSINT Bot - Full Profile Probe Test            ║');
  console.log('║  HTTP Probes: wa.me, api.whatsapp.com, wa.me/c, CDN     ║');
  console.log('║  Browser Probes: wa.me, api.whatsapp.com, wa.me/c       ║');
  console.log('║  Profile Builder: age estimation, carrier, country intel ║');
  console.log('║  No QR code / WhatsApp auth needed                      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(`\nTesting ${numbers.length} number(s)...\n`);

  const results = [];
  for (const num of numbers) {
    const result = await testNumber(num);
    results.push(result);
  }

  console.log('\n' + '='.repeat(60));
  console.log('FULL PROFILE SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    if (!r.profile) {
      console.log(`  ${r.number}: PARSE FAILED or INVALID`);
      continue;
    }
    const p = r.profile;
    const name = p.names.primary ? ` -> "${p.names.primary}"` : '';
    const verdict = formatRegStatus(p.whatsappRegistered);
    const conf = p.confidenceScore + '/100';
    const biz = p.whatsappProfile.isBusiness ? ' [BUSINESS]' : '';
    const age = p.numberAge && p.numberAge.estimatedAllocationPeriod !== 'unknown'
      ? ` [${p.numberAge.estimatedAllocationPeriod}]`
      : '';
    console.log(`  ${r.number}: ${verdict} (${conf})${name}${biz}${age}`);
  }

  console.log('\nNote: For full profile data (about, pic, business info, groups, presence),');
  console.log('run the bot with QR auth: npm start');
  console.log('Use !profile <number> for the full intelligence report.');
}

main().catch(console.error);
