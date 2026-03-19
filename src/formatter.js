'use strict';

const { generateReverseImageSearchLinks } = require('./webSearch');

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

module.exports = { formatReport };
