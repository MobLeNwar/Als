'use strict';

/**
 * Perform deep WhatsApp OSINT lookup using whatsapp-web.js client API.
 * Extracts maximum information available from WhatsApp's discovery system.
 *
 * When authenticated (QR code scanned), this module can access:
 *   - Registration status
 *   - Push name (display name set by the user)
 *   - About / status text
 *   - Profile picture URL (hosted on pps.whatsapp.net CDN)
 *   - Business profile (description, email, website, address, category, hours)
 *   - Common groups (social graph intelligence)
 *   - Verified business name and level
 *   - Country code and formatted number
 *   - Privacy settings inference (based on what data is/isn't accessible)
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
    privacySettings: {
      profilePic: 'unknown',
      about: 'unknown',
    },
    numberType: null,
    labels: [],
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

    // Determine number type from contact metadata
    if (contact.isBusiness) {
      result.numberType = contact.isEnterprise ? 'enterprise' : 'business';
    } else {
      result.numberType = 'personal';
    }

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

    // About/status text + privacy inference
    try {
      const about = await contact.getAbout();
      if (about) {
        result.about = about;
        result.privacySettings.about = 'visible';
      } else {
        result.about = null;
        result.privacySettings.about = 'hidden_or_unset';
      }
    } catch (_e) {
      result.about = null;
      result.privacySettings.about = 'restricted';
    }

    // Profile picture URL + privacy inference
    try {
      const picUrl = await contact.getProfilePicUrl();
      if (picUrl) {
        result.profilePicUrl = picUrl;
        result.privacySettings.profilePic = 'visible';
      } else {
        result.profilePicUrl = null;
        result.privacySettings.profilePic = 'hidden_or_unset';
      }
    } catch (_e) {
      result.profilePicUrl = null;
      result.privacySettings.profilePic = 'restricted';
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

    // Business profile details (deep extraction)
    if (contact.isBusiness) {
      try {
        const bp = contact.businessProfile || null;
        if (bp) {
          result.businessProfile = {
            description: bp.description || null,
            email: bp.email || null,
            website: bp.website || null,
            address: bp.address || null,
            category: bp.category || null,
            businessHours: bp.businessHours || null,
            latitude: bp.latitude || null,
            longitude: bp.longitude || null,
          };
        }
      } catch (_e) {
        result.businessProfile = null;
      }
    }

    // Try to get labels (if available)
    try {
      if (contact.labels && contact.labels.length > 0) {
        result.labels = contact.labels;
      }
    } catch (_e) {
      result.labels = [];
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
