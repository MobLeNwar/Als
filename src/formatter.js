'use strict';

const { generateReverseImageSearchLinks } = require('./webSearch');
const { buildProfile, formatProfileReport } = require('./profileBuilder');

/**
 * Format the complete OSINT report for WhatsApp message output.
 * Focuses on WhatsApp-extracted data with OSINT links for deeper investigation.
 *
 * @param {object} phoneInfo - Parsed phone number metadata
 * @param {object} waData - WhatsApp discovery data
 * @param {object[]} dorks - OSINT investigation links
 * @returns {string} Formatted WhatsApp message
 */
function formatReport(phoneInfo, waData, dorks) {
  const lines = [];

  lines.push('*=============================*');
  lines.push('*   PHONE NUMBER OSINT REPORT*');
  lines.push('*=============================*');
  lines.push('');

  // --- Phone metadata ---
  lines.push('*--- PHONE INFO ---*');
  lines.push(`Number: ${phoneInfo.international}`);
  lines.push(`Country: ${phoneInfo.country}`);
  lines.push(`Calling Code: +${phoneInfo.callingCode}`);
  lines.push(`Type: ${phoneInfo.type}`);
  lines.push(`Valid: ${phoneInfo.valid ? 'Yes' : 'No'}`);
  lines.push('');

  // --- Endpoint Discovery (no auth needed) ---
  if (waData.endpointProbes) {
    const ep = waData.endpointProbes;
    lines.push('*--- ENDPOINT DISCOVERY (no auth) ---*');

    if (ep.summary) {
      const s = ep.summary;
      const confLabel = s.confidence ? s.confidence.toUpperCase() : 'UNKNOWN';
      lines.push(`Confidence: ${confLabel}`);
      if (s.displayName) {
        lines.push(`Display Name: ${s.displayName}`);
      }
      const regLabel = s.registered === true
        ? 'YES'
        : s.registered === false ? 'NO (invalid)' : 'Inconclusive';
      lines.push(`Registration: ${regLabel}`);
      if (s.isBusiness) {
        lines.push(`Business Account: YES${s.businessName ? ` (${s.businessName})` : ''}`);
      }
      if (s.waMeLink) {
        lines.push(`wa.me Link: ${s.waMeLink}`);
      }
      if (s.signals && s.signals.length > 0) {
        lines.push('Signals:');
        s.signals.forEach((sig) => lines.push(`  - ${sig}`));
      }
    }

    // Individual probe details
    if (ep.probes) {
      const probeList = [
        { key: 'waMe', label: 'wa.me' },
        { key: 'apiWhatsApp', label: 'api.whatsapp.com' },
        { key: 'businessCatalog', label: 'wa.me/c (catalog)' },
      ];
      for (const p of probeList) {
        const probe = ep.probes[p.key];
        if (!probe || probe.error) continue;
        if (probe.displayName) {
          lines.push(`  ${p.label} name: ${probe.displayName}`);
        }
        if (probe.ogMeta && probe.ogMeta.ogTitle) {
          lines.push(`  ${p.label} OG title: ${probe.ogMeta.ogTitle}`);
        }
        if (probe.ogMeta && probe.ogMeta.ogDescription) {
          lines.push(`  ${p.label} OG desc: ${probe.ogMeta.ogDescription}`);
        }
      }
    }

    if (ep.probeTimeMs) {
      lines.push(`Probe time: ${ep.probeTimeMs}ms`);
    }
    lines.push('');
  } else if (waData.waProbe) {
    // Legacy single-probe format
    lines.push('*--- WA.ME DISCOVERY (no auth) ---*');
    const probe = waData.waProbe;
    if (probe.displayName) {
      lines.push(`Display Name (wa.me): ${probe.displayName}`);
    }
    const regLabel = probe.registered === true
      ? 'YES (name found)'
      : probe.registered === false ? 'NO (invalid number)' : 'Inconclusive';
    lines.push(`wa.me Registration Signal: ${regLabel}`);
    lines.push(`wa.me Link: ${probe.url}`);
    lines.push('');
  }

  // --- WhatsApp Discovery (core intelligence) ---
  lines.push('*--- WHATSAPP DISCOVERY ---*');
  lines.push(`Registered on WhatsApp: ${waData.registered ? 'YES' : 'NO'}`);

  if (waData.registered) {
    if (waData.pushname) {
      lines.push(`Display Name (pushname): ${waData.pushname}`);
    }
    if (waData.shortName) {
      lines.push(`Short Name: ${waData.shortName}`);
    }
    if (waData.verifiedName) {
      lines.push(`Verified Name: ${waData.verifiedName}`);
    }
    if (waData.verifiedLevel) {
      lines.push(`Verified Level: ${waData.verifiedLevel}`);
    }
    if (waData.about) {
      lines.push(`About / Status: ${waData.about}`);
    } else {
      lines.push('About / Status: (hidden or not set)');
    }
    if (waData.profilePicUrl) {
      lines.push(`Profile Picture: ${waData.profilePicUrl}`);
    } else {
      lines.push('Profile Picture: (hidden or not set)');
    }
    if (waData.countryCode) {
      lines.push(`WhatsApp Country Code: ${waData.countryCode}`);
    }
    if (waData.formattedNumber) {
      lines.push(`Formatted Number: ${waData.formattedNumber}`);
    }

    lines.push(`Business Account: ${waData.isBusiness ? 'YES' : 'No'}`);
    if (waData.isEnterprise) {
      lines.push('Enterprise Account: YES');
    }
    lines.push(`In Your Contacts: ${waData.isMyContact ? 'Yes' : 'No'}`);

    // Number type
    if (waData.numberType) {
      lines.push(`Number Type: ${waData.numberType}`);
    }

    // Privacy settings inference
    if (waData.privacySettings) {
      const ps = waData.privacySettings;
      const hasPrivacyData = ps.profilePic !== 'unknown' || ps.about !== 'unknown';
      if (hasPrivacyData) {
        lines.push('');
        lines.push('*--- PRIVACY SETTINGS (inferred) ---*');
        if (ps.profilePic !== 'unknown') {
          lines.push(`  Profile Picture: ${ps.profilePic}`);
        }
        if (ps.about !== 'unknown') {
          lines.push(`  About/Status: ${ps.about}`);
        }
      }
    }

    // Business profile details
    if (waData.businessProfile) {
      lines.push('');
      lines.push('*--- BUSINESS PROFILE ---*');
      const bp = waData.businessProfile;
      if (bp.description) lines.push(`Description: ${bp.description}`);
      if (bp.email) lines.push(`Email: ${bp.email}`);
      if (bp.website) {
        const websites = Array.isArray(bp.website) ? bp.website : [bp.website];
        websites.forEach((w) => lines.push(`Website: ${w}`));
      }
      if (bp.address) lines.push(`Address: ${bp.address}`);
      if (bp.category) lines.push(`Category: ${bp.category}`);
      if (bp.businessHours) {
        lines.push(`Business Hours: ${JSON.stringify(bp.businessHours)}`);
      }
    }

    // Common groups
    if (waData.commonGroups && waData.commonGroups.length > 0) {
      lines.push('');
      lines.push(`*--- COMMON GROUPS (${waData.commonGroups.length}) ---*`);
      waData.commonGroups.forEach((g) => {
        const count = g.participantCount ? ` (${g.participantCount} members)` : '';
        lines.push(`  - ${g.name}${count}`);
      });
    }

    // Reverse image search links for profile picture
    if (waData.profilePicUrl) {
      const reverseLinks = generateReverseImageSearchLinks(waData.profilePicUrl);
      if (reverseLinks.length > 0) {
        lines.push('');
        lines.push('*--- REVERSE IMAGE SEARCH ---*');
        lines.push('(Use to identify the person behind the profile picture)');
        reverseLinks.forEach((r) => {
          lines.push(`  - ${r.name}: ${r.url}`);
        });
      }
    }
  }
  lines.push('');

  // --- OSINT Investigation Links ---
  if (dorks && dorks.length > 0) {
    const categories = {
      general: 'General',
      social: 'Social Media',
      messaging: 'Messaging Platforms',
      forums: 'Forums & Communities',
      classifieds: 'Classifieds',
      directories: 'Directories',
      people_search: 'People Search Engines',
      caller_id: 'Caller ID & Spam Check',
      breach: 'Breach & Paste Sites',
      documents: 'Documents & Files',
      age_identity: 'Age & Identity (free)',
      carrier: 'Carrier & VoIP Check',
    };

    lines.push('*--- OSINT INVESTIGATION LINKS ---*');
    lines.push('(Click to investigate further - all free)');

    const grouped = {};
    dorks.forEach((d) => {
      const cat = d.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(d);
    });

    for (const [cat, items] of Object.entries(grouped)) {
      lines.push('');
      lines.push(`*${categories[cat] || cat}:*`);
      items.forEach((d) => {
        lines.push(`  - ${d.name}: ${d.url}`);
      });
    }
  }

  lines.push('');
  lines.push('*=============================*');
  lines.push('*  Report by Als OSINT Bot*');
  lines.push('*=============================*');

  return lines.join('\n');
}

/**
 * Generate a full intelligence profile report.
 * Combines all data sources into a comprehensive profile with age estimation.
 *
 * @param {object} phoneInfo - Parsed phone number metadata
 * @param {object} [waData] - WhatsApp discovery data (authenticated)
 * @param {object} [httpProbeData] - HTTP probe results from waDirectProbes.js
 * @param {object} [browserProbeData] - Browser probe results from waEndpoints.js
 * @param {object[]} [dorks] - OSINT investigation links
 * @returns {string} Formatted full profile report
 */
function formatFullProfile(phoneInfo, waData, httpProbeData, browserProbeData, dorks) {
  const profile = buildProfile(phoneInfo, waData, httpProbeData, browserProbeData);
  return formatProfileReport(profile, dorks);
}

module.exports = { formatReport, formatFullProfile };
