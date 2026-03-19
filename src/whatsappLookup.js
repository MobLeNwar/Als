'use strict';

/**
 * Perform deep WhatsApp OSINT lookup using whatsapp-web.js client API.
 * Extracts maximum information available from WhatsApp's discovery system.
 *
 * @param {import('whatsapp-web.js').Client} client - Authenticated WWeb client
 * @param {string} waId - WhatsApp ID (e.g. 1234567890@c.us)
 * @returns {Promise<object>} WhatsApp profile data
 */
async function lookupWhatsApp(client, waId) {
  const result = {
    registered: false,
    pushname: null,
    shortName: null,
    about: null,
    profilePicUrl: null,
    isBusiness: false,
    isEnterprise: false,
    isMyContact: false,
    verifiedName: null,
    verifiedLevel: null,
    commonGroups: [],
    businessProfile: null,
    countryCode: null,
    formattedNumber: null,
  };

  try {
    const isRegistered = await client.isRegisteredUser(waId);
    result.registered = isRegistered;

    if (!isRegistered) {
      return result;
    }

    const contact = await client.getContactById(waId);

    // Basic identity
    result.pushname = contact.pushname || null;
    result.shortName = contact.shortName || null;
    result.isBusiness = contact.isBusiness || false;
    result.isEnterprise = contact.isEnterprise || false;
    result.isMyContact = contact.isMyContact || false;
    result.verifiedName = contact.verifiedName || null;
    result.verifiedLevel = contact.verifiedLevel || null;

    // Country code
    try {
      const cc = await contact.getCountryCode();
      result.countryCode = cc || null;
    } catch (_e) {
      result.countryCode = null;
    }

    // Formatted number
    try {
      const formatted = await contact.getFormattedNumber();
      result.formattedNumber = formatted || null;
    } catch (_e) {
      result.formattedNumber = null;
    }

    // About/status text
    try {
      const about = await contact.getAbout();
      result.about = about || null;
    } catch (_e) {
      result.about = null;
    }

    // Profile picture URL
    try {
      const picUrl = await contact.getProfilePicUrl();
      result.profilePicUrl = picUrl || null;
    } catch (_e) {
      result.profilePicUrl = null;
    }

    // Common groups (reveals social connections)
    try {
      const groups = await contact.getCommonGroups();
      result.commonGroups = groups.map((g) => ({
        id: g.id._serialized,
        name: g.name,
        participantCount: g.participants ? g.participants.length : null,
      }));
    } catch (_e) {
      result.commonGroups = [];
    }

    // Business profile details
    if (contact.isBusiness) {
      try {
        result.businessProfile = contact.businessProfile || null;
      } catch (_e) {
        result.businessProfile = null;
      }
    }

  } catch (err) {
    console.error(`[WhatsApp Lookup] Error for ${waId}:`, err.message);
  }

  return result;
}

/**
 * Batch check if multiple numbers are registered on WhatsApp.
 *
 * @param {import('whatsapp-web.js').Client} client
 * @param {string[]} waIds - Array of WhatsApp IDs (e.g. ['1234@c.us', '5678@c.us'])
 * @returns {Promise<object[]>} Array of { waId, registered }
 */
async function batchCheckRegistration(client, waIds) {
  const results = [];
  for (const waId of waIds) {
    try {
      const registered = await client.isRegisteredUser(waId);
      results.push({ waId, registered });
    } catch (_e) {
      results.push({ waId, registered: false, error: true });
    }
  }
  return results;
}

module.exports = { lookupWhatsApp, batchCheckRegistration };
