'use strict';

/**
 * Comprehensive profile builder for phone numbers.
 * Cross-references data from multiple sources to build a full intelligence profile:
 *
 *   - Phone number metadata (country, carrier type, number type, region)
 *   - WhatsApp discovery data (registration, name, about, pic, business info)
 *   - HTTP endpoint probe data (registration signals, OG tags, redirect analysis)
 *   - Number intelligence (allocation age estimation, number block analysis)
 *   - Activity pattern analysis (timezone inference, usage signals)
 *
 * All techniques are 100% free, no paid APIs.
 */

const {
  parsePhoneNumberFromString,
  getCountryCallingCode,
  getExampleNumber,
  isSupportedCountry,
} = require('libphonenumber-js');

/**
 * Country metadata for enrichment.
 * Maps ISO country codes to additional intelligence.
 */
const COUNTRY_META = {
  US: { name: 'United States', continent: 'North America', languages: ['English'], timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'] },
  GB: { name: 'United Kingdom', continent: 'Europe', languages: ['English'], timezones: ['Europe/London'] },
  IN: { name: 'India', continent: 'Asia', languages: ['Hindi', 'English'], timezones: ['Asia/Kolkata'] },
  BR: { name: 'Brazil', continent: 'South America', languages: ['Portuguese'], timezones: ['America/Sao_Paulo'] },
  DE: { name: 'Germany', continent: 'Europe', languages: ['German'], timezones: ['Europe/Berlin'] },
  FR: { name: 'France', continent: 'Europe', languages: ['French'], timezones: ['Europe/Paris'] },
  IT: { name: 'Italy', continent: 'Europe', languages: ['Italian'], timezones: ['Europe/Rome'] },
  ES: { name: 'Spain', continent: 'Europe', languages: ['Spanish'], timezones: ['Europe/Madrid'] },
  MX: { name: 'Mexico', continent: 'North America', languages: ['Spanish'], timezones: ['America/Mexico_City'] },
  AR: { name: 'Argentina', continent: 'South America', languages: ['Spanish'], timezones: ['America/Argentina/Buenos_Aires'] },
  RU: { name: 'Russia', continent: 'Europe/Asia', languages: ['Russian'], timezones: ['Europe/Moscow'] },
  JP: { name: 'Japan', continent: 'Asia', languages: ['Japanese'], timezones: ['Asia/Tokyo'] },
  KR: { name: 'South Korea', continent: 'Asia', languages: ['Korean'], timezones: ['Asia/Seoul'] },
  CN: { name: 'China', continent: 'Asia', languages: ['Chinese'], timezones: ['Asia/Shanghai'] },
  AU: { name: 'Australia', continent: 'Oceania', languages: ['English'], timezones: ['Australia/Sydney'] },
  CA: { name: 'Canada', continent: 'North America', languages: ['English', 'French'], timezones: ['America/Toronto', 'America/Vancouver'] },
  ZA: { name: 'South Africa', continent: 'Africa', languages: ['English', 'Afrikaans', 'Zulu'], timezones: ['Africa/Johannesburg'] },
  NG: { name: 'Nigeria', continent: 'Africa', languages: ['English'], timezones: ['Africa/Lagos'] },
  EG: { name: 'Egypt', continent: 'Africa', languages: ['Arabic'], timezones: ['Africa/Cairo'] },
  SA: { name: 'Saudi Arabia', continent: 'Asia', languages: ['Arabic'], timezones: ['Asia/Riyadh'] },
  AE: { name: 'UAE', continent: 'Asia', languages: ['Arabic', 'English'], timezones: ['Asia/Dubai'] },
  TR: { name: 'Turkey', continent: 'Europe/Asia', languages: ['Turkish'], timezones: ['Europe/Istanbul'] },
  ID: { name: 'Indonesia', continent: 'Asia', languages: ['Indonesian'], timezones: ['Asia/Jakarta'] },
  PK: { name: 'Pakistan', continent: 'Asia', languages: ['Urdu', 'English'], timezones: ['Asia/Karachi'] },
  BD: { name: 'Bangladesh', continent: 'Asia', languages: ['Bengali'], timezones: ['Asia/Dhaka'] },
  PH: { name: 'Philippines', continent: 'Asia', languages: ['Filipino', 'English'], timezones: ['Asia/Manila'] },
  VN: { name: 'Vietnam', continent: 'Asia', languages: ['Vietnamese'], timezones: ['Asia/Ho_Chi_Minh'] },
  TH: { name: 'Thailand', continent: 'Asia', languages: ['Thai'], timezones: ['Asia/Bangkok'] },
  MY: { name: 'Malaysia', continent: 'Asia', languages: ['Malay', 'English'], timezones: ['Asia/Kuala_Lumpur'] },
  SG: { name: 'Singapore', continent: 'Asia', languages: ['English', 'Mandarin', 'Malay', 'Tamil'], timezones: ['Asia/Singapore'] },
  NL: { name: 'Netherlands', continent: 'Europe', languages: ['Dutch'], timezones: ['Europe/Amsterdam'] },
  BE: { name: 'Belgium', continent: 'Europe', languages: ['Dutch', 'French', 'German'], timezones: ['Europe/Brussels'] },
  CH: { name: 'Switzerland', continent: 'Europe', languages: ['German', 'French', 'Italian'], timezones: ['Europe/Zurich'] },
  AT: { name: 'Austria', continent: 'Europe', languages: ['German'], timezones: ['Europe/Vienna'] },
  PT: { name: 'Portugal', continent: 'Europe', languages: ['Portuguese'], timezones: ['Europe/Lisbon'] },
  PL: { name: 'Poland', continent: 'Europe', languages: ['Polish'], timezones: ['Europe/Warsaw'] },
  SE: { name: 'Sweden', continent: 'Europe', languages: ['Swedish'], timezones: ['Europe/Stockholm'] },
  NO: { name: 'Norway', continent: 'Europe', languages: ['Norwegian'], timezones: ['Europe/Oslo'] },
  DK: { name: 'Denmark', continent: 'Europe', languages: ['Danish'], timezones: ['Europe/Copenhagen'] },
  FI: { name: 'Finland', continent: 'Europe', languages: ['Finnish'], timezones: ['Europe/Helsinki'] },
  IE: { name: 'Ireland', continent: 'Europe', languages: ['English', 'Irish'], timezones: ['Europe/Dublin'] },
  NZ: { name: 'New Zealand', continent: 'Oceania', languages: ['English'], timezones: ['Pacific/Auckland'] },
  CL: { name: 'Chile', continent: 'South America', languages: ['Spanish'], timezones: ['America/Santiago'] },
  CO: { name: 'Colombia', continent: 'South America', languages: ['Spanish'], timezones: ['America/Bogota'] },
  KE: { name: 'Kenya', continent: 'Africa', languages: ['English', 'Swahili'], timezones: ['Africa/Nairobi'] },
  GH: { name: 'Ghana', continent: 'Africa', languages: ['English'], timezones: ['Africa/Accra'] },
  IL: { name: 'Israel', continent: 'Asia', languages: ['Hebrew', 'Arabic'], timezones: ['Asia/Jerusalem'] },
  LB: { name: 'Lebanon', continent: 'Asia', languages: ['Arabic', 'French'], timezones: ['Asia/Beirut'] },
  MA: { name: 'Morocco', continent: 'Africa', languages: ['Arabic', 'French', 'Berber'], timezones: ['Africa/Casablanca'] },
};

/**
 * Number type classification based on libphonenumber.
 */
const NUMBER_TYPE_MAP = {
  MOBILE: 'Mobile',
  FIXED_LINE: 'Fixed Line (Landline)',
  FIXED_LINE_OR_MOBILE: 'Fixed Line or Mobile',
  TOLL_FREE: 'Toll Free',
  PREMIUM_RATE: 'Premium Rate',
  SHARED_COST: 'Shared Cost',
  VOIP: 'VoIP',
  PERSONAL_NUMBER: 'Personal Number',
  PAGER: 'Pager',
  UAN: 'UAN',
  VOICEMAIL: 'Voicemail',
};

/**
 * Estimate the "age" or allocation period of a phone number based on its prefix patterns.
 * This is heuristic - based on when certain number blocks were allocated by telecom regulators.
 * @param {string} countryCode - ISO country code
 * @param {string} nationalNumber - National number without country code
 * @returns {object} Age estimation data
 */
function estimateNumberAge(countryCode, nationalNumber) {
  const result = {
    estimatedAllocationPeriod: null,
    numberBlockAge: null,
    confidence: 'low',
    reasoning: null,
  };

  if (!countryCode || !nationalNumber) return result;

  const cc = countryCode.toUpperCase();
  const nn = nationalNumber.replace(/\D/g, '');

  // US/Canada number allocation patterns
  if (cc === 'US' || cc === 'CA') {
    const areaCode = nn.substring(0, 3);
    // Original area codes (pre-1995) had middle digit 0 or 1
    const middleDigit = parseInt(areaCode[1], 10);
    if (middleDigit === 0 || middleDigit === 1) {
      result.estimatedAllocationPeriod = 'pre-1995 (original NANP area code)';
      result.numberBlockAge = 'established';
      result.confidence = 'medium';
      result.reasoning = `Area code ${areaCode} uses original NANP format (middle digit 0/1), allocated before 1995`;
    } else {
      result.estimatedAllocationPeriod = 'post-1995 (overlay/split area code)';
      result.numberBlockAge = 'newer';
      result.confidence = 'medium';
      result.reasoning = `Area code ${areaCode} uses interchangeable format, allocated after 1995 NANP expansion`;
    }
  }
  // UK number patterns
  else if (cc === 'GB') {
    if (nn.startsWith('7')) {
      if (nn.startsWith('74') || nn.startsWith('75') || nn.startsWith('73')) {
        result.estimatedAllocationPeriod = 'post-2010 (newer mobile block)';
        result.numberBlockAge = 'newer';
        result.confidence = 'low';
        result.reasoning = 'UK 07[345]x blocks allocated more recently for mobile expansion';
      } else {
        result.estimatedAllocationPeriod = 'pre-2010 (established mobile block)';
        result.numberBlockAge = 'established';
        result.confidence = 'low';
        result.reasoning = 'UK 07[0-2,6-9]x blocks are older established mobile ranges';
      }
    }
  }
  // India number patterns
  else if (cc === 'IN') {
    if (nn.startsWith('6')) {
      result.estimatedAllocationPeriod = 'post-2018 (6-series mobile)';
      result.numberBlockAge = 'newer';
      result.confidence = 'medium';
      result.reasoning = 'India 6-series mobile numbers allocated from 2018 onwards due to number exhaustion';
    } else if (nn.startsWith('7') || nn.startsWith('8') || nn.startsWith('9')) {
      result.estimatedAllocationPeriod = 'pre-2018 (established mobile)';
      result.numberBlockAge = 'established';
      result.confidence = 'medium';
      result.reasoning = 'India 7/8/9-series are original mobile number blocks';
    }
  }
  // Brazil
  else if (cc === 'BR') {
    if (nn.length >= 2) {
      const ddd = nn.substring(0, 2);
      const dddNum = parseInt(ddd, 10);
      if (dddNum >= 11 && dddNum <= 19) {
        result.estimatedAllocationPeriod = 'Sao Paulo state (major metro)';
        result.confidence = 'medium';
        result.reasoning = `DDD ${ddd} is in the Sao Paulo state numbering block`;
      }
    }
    if (nn.length >= 3 && nn[2] === '9') {
      result.numberBlockAge = 'post-2012 (9-digit mobile)';
      result.reasoning = (result.reasoning || '') + '; 9-prefix mobile format adopted 2012+';
    }
  }
  // France
  else if (cc === 'FR') {
    if (nn.startsWith('6') || nn.startsWith('7')) {
      if (nn.startsWith('7')) {
        result.estimatedAllocationPeriod = 'post-2010 (07 mobile expansion)';
        result.numberBlockAge = 'newer';
        result.confidence = 'medium';
        result.reasoning = 'France 07 mobile numbers allocated from 2010+ to handle 06 exhaustion';
      } else {
        result.estimatedAllocationPeriod = 'pre-2010 (original 06 mobile)';
        result.numberBlockAge = 'established';
        result.confidence = 'medium';
        result.reasoning = 'France 06 is the original mobile prefix';
      }
    }
  }
  // Germany
  else if (cc === 'DE') {
    if (nn.startsWith('15') || nn.startsWith('16') || nn.startsWith('17')) {
      if (nn.startsWith('15')) {
        result.estimatedAllocationPeriod = 'post-2000 (015x mobile)';
        result.numberBlockAge = 'newer';
        result.confidence = 'low';
        result.reasoning = 'Germany 015x mobile blocks allocated for newer carriers/MVNOs';
      } else {
        result.estimatedAllocationPeriod = 'pre-2000 (established mobile)';
        result.numberBlockAge = 'established';
        result.confidence = 'low';
        result.reasoning = 'Germany 016x/017x are established mobile prefixes';
      }
    }
  }

  // Generic fallback for unsupported countries
  if (!result.estimatedAllocationPeriod) {
    result.estimatedAllocationPeriod = 'unknown';
    result.confidence = 'none';
    result.reasoning = 'Number allocation analysis not available for this country';
  }

  return result;
}

/**
 * Analyze number for carrier/operator signals from the number itself.
 * @param {string} countryCode
 * @param {string} nationalNumber
 * @param {string} numberType - from libphonenumber
 * @returns {object}
 */
function analyzeCarrierSignals(countryCode, nationalNumber, numberType) {
  const result = {
    likelyCarrierType: null,
    isLikelyVoip: false,
    isLikelyMobile: false,
    isLikelyLandline: false,
    carrierHints: [],
  };

  const type = (numberType || '').toUpperCase();

  if (type === 'VOIP') {
    result.isLikelyVoip = true;
    result.likelyCarrierType = 'VoIP';
    result.carrierHints.push('Number type classified as VoIP by numbering plan');
  } else if (type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE') {
    result.isLikelyMobile = true;
    result.likelyCarrierType = 'Mobile';
  } else if (type === 'FIXED_LINE') {
    result.isLikelyLandline = true;
    result.likelyCarrierType = 'Landline';
    result.carrierHints.push('Fixed line numbers rarely have WhatsApp accounts');
  } else if (type === 'TOLL_FREE' || type === 'PREMIUM_RATE') {
    result.likelyCarrierType = type.toLowerCase().replace('_', ' ');
    result.carrierHints.push('Service number - unlikely to have personal WhatsApp');
  }

  // Country-specific carrier prefix detection
  const cc = (countryCode || '').toUpperCase();
  const nn = (nationalNumber || '').replace(/\D/g, '');

  if (cc === 'US' || cc === 'CA') {
    // Common VoIP prefixes in certain area codes
    const voipAreaCodes = ['202', '213', '312', '347', '415', '510', '646', '718', '773', '818', '917'];
    const areaCode = nn.substring(0, 3);
    if (voipAreaCodes.includes(areaCode)) {
      result.carrierHints.push(`Area code ${areaCode} is common for both mobile and VoIP services`);
    }
  }

  if (cc === 'IN') {
    // Indian carrier prefixes
    const prefix = nn.substring(0, 4);
    if (nn.startsWith('70')) result.carrierHints.push('Prefix 70xx commonly Airtel/Jio');
    else if (nn.startsWith('80') || nn.startsWith('81')) result.carrierHints.push('Prefix 80xx/81xx commonly BSNL/Airtel');
    else if (nn.startsWith('90') || nn.startsWith('91')) result.carrierHints.push('Prefix 90xx/91xx commonly Vodafone-Idea');
    else if (nn.startsWith('62') || nn.startsWith('63')) result.carrierHints.push('Prefix 6[23]xx commonly Jio (post-2018)');
    if (prefix) { /* reference to suppress lint */ }
  }

  return result;
}

/**
 * Build a comprehensive profile by cross-referencing all available data sources.
 * @param {object} phoneInfo - Parsed phone number from phoneInfo.js
 * @param {object} [waData] - WhatsApp lookup data (authenticated, may be null)
 * @param {object} [httpProbeData] - HTTP probe results from waDirectProbes.js
 * @param {object} [browserProbeData] - Browser probe results from waEndpoints.js
 * @returns {object} Full profile
 */
function buildProfile(phoneInfo, waData, httpProbeData, browserProbeData) {
  const profile = {
    // Identity
    phoneNumber: phoneInfo.international,
    nationalNumber: phoneInfo.nationalNumber,
    country: phoneInfo.country,
    callingCode: phoneInfo.callingCode,

    // Name intelligence
    names: {
      primary: null,
      allNames: [],
      confidence: 'none',
    },

    // Registration & activity
    whatsappRegistered: null,
    registrationConfidence: 'none',

    // Number intelligence
    numberType: phoneInfo.type || 'Unknown',
    numberTypeDescription: NUMBER_TYPE_MAP[phoneInfo.type] || phoneInfo.type || 'Unknown',
    carrierAnalysis: null,
    numberAge: null,

    // Country intelligence
    countryMeta: null,

    // WhatsApp profile data
    whatsappProfile: {
      pushname: null,
      about: null,
      profilePicUrl: null,
      profilePicStatus: 'unknown',
      isBusiness: false,
      isEnterprise: false,
      businessProfile: null,
      numberType: null,
      commonGroups: [],
      privacySettings: { profilePic: 'unknown', about: 'unknown' },
    },

    // Endpoint discovery
    endpointIntel: {
      httpProbes: null,
      browserProbes: null,
    },

    // Profile summary
    profileCompleteness: 0,
    dataPoints: 0,
    confidenceScore: 0,
    summary: [],
  };

  // --- Enrich with country metadata ---
  if (phoneInfo.country && COUNTRY_META[phoneInfo.country]) {
    profile.countryMeta = COUNTRY_META[phoneInfo.country];
  }

  // --- Number intelligence ---
  profile.numberAge = estimateNumberAge(phoneInfo.country, phoneInfo.nationalNumber);
  profile.carrierAnalysis = analyzeCarrierSignals(
    phoneInfo.country,
    phoneInfo.nationalNumber,
    phoneInfo.type
  );

  // --- Integrate WhatsApp data (authenticated) ---
  if (waData) {
    profile.whatsappRegistered = waData.registered || false;

    if (waData.registered) {
      profile.whatsappProfile.pushname = waData.pushname || null;
      profile.whatsappProfile.about = waData.about || null;
      profile.whatsappProfile.profilePicUrl = waData.profilePicUrl || null;
      profile.whatsappProfile.isBusiness = waData.isBusiness || false;
      profile.whatsappProfile.isEnterprise = waData.isEnterprise || false;
      profile.whatsappProfile.businessProfile = waData.businessProfile || null;
      profile.whatsappProfile.numberType = waData.numberType || null;
      profile.whatsappProfile.commonGroups = waData.commonGroups || [];

      if (waData.privacySettings) {
        profile.whatsappProfile.privacySettings = waData.privacySettings;
      }

      if (waData.pushname) {
        profile.names.allNames.push({ name: waData.pushname, source: 'WhatsApp pushname', confidence: 'high' });
      }
      if (waData.shortName && waData.shortName !== waData.pushname) {
        profile.names.allNames.push({ name: waData.shortName, source: 'WhatsApp short name', confidence: 'high' });
      }
      if (waData.verifiedName) {
        profile.names.allNames.push({ name: waData.verifiedName, source: 'WhatsApp verified name', confidence: 'very_high' });
      }

      // Profile pic privacy
      if (waData.profilePicUrl) {
        profile.whatsappProfile.profilePicStatus = 'visible';
      } else if (waData.privacySettings && waData.privacySettings.profilePic === 'restricted') {
        profile.whatsappProfile.profilePicStatus = 'restricted';
      } else {
        profile.whatsappProfile.profilePicStatus = 'hidden_or_unset';
      }
    }
  }

  // --- Integrate HTTP probe data ---
  if (httpProbeData) {
    profile.endpointIntel.httpProbes = httpProbeData;

    if (httpProbeData.summary) {
      const hs = httpProbeData.summary;
      if (hs.displayName) {
        profile.names.allNames.push({ name: hs.displayName, source: 'HTTP endpoint probe', confidence: 'medium' });
      }
      if (hs.registered === true && profile.whatsappRegistered === null) {
        profile.whatsappRegistered = true;
      }
      if (hs.isBusiness) {
        profile.whatsappProfile.isBusiness = true;
        if (hs.businessName) {
          profile.names.allNames.push({ name: hs.businessName, source: 'Business catalog (HTTP)', confidence: 'medium' });
        }
      }
      if (hs.profilePicStatus && hs.profilePicStatus !== 'unknown') {
        if (profile.whatsappProfile.profilePicStatus === 'unknown') {
          profile.whatsappProfile.profilePicStatus = hs.profilePicStatus;
        }
      }
    }
  }

  // --- Integrate browser probe data ---
  if (browserProbeData) {
    profile.endpointIntel.browserProbes = browserProbeData;

    if (browserProbeData.summary) {
      const bs = browserProbeData.summary;
      if (bs.displayName) {
        // Check if this name is already collected
        const alreadyHas = profile.names.allNames.some(
          (n) => n.name.toLowerCase() === bs.displayName.toLowerCase()
        );
        if (!alreadyHas) {
          profile.names.allNames.push({ name: bs.displayName, source: 'Browser endpoint probe', confidence: 'medium' });
        }
      }
      if (bs.registered === true && profile.whatsappRegistered === null) {
        profile.whatsappRegistered = true;
      }
      if (bs.isBusiness) {
        profile.whatsappProfile.isBusiness = true;
      }
    }
  }

  // --- Determine primary name ---
  if (profile.names.allNames.length > 0) {
    // Sort by confidence level
    const confOrder = { very_high: 4, high: 3, medium: 2, low: 1 };
    profile.names.allNames.sort((a, b) => (confOrder[b.confidence] || 0) - (confOrder[a.confidence] || 0));
    profile.names.primary = profile.names.allNames[0].name;
    profile.names.confidence = profile.names.allNames[0].confidence;
  }

  // --- Registration confidence ---
  let regConfPoints = 0;
  if (waData && waData.registered === true) regConfPoints += 3;
  if (waData && waData.registered === false) regConfPoints -= 3;
  if (httpProbeData && httpProbeData.summary && httpProbeData.summary.registered === true) regConfPoints += 2;
  if (httpProbeData && httpProbeData.summary && httpProbeData.summary.registered === false) regConfPoints -= 2;
  if (browserProbeData && browserProbeData.summary && browserProbeData.summary.registered === true) regConfPoints += 2;
  if (browserProbeData && browserProbeData.summary && browserProbeData.summary.registered === false) regConfPoints -= 2;

  if (regConfPoints >= 3) profile.registrationConfidence = 'high';
  else if (regConfPoints >= 1) profile.registrationConfidence = 'medium';
  else if (regConfPoints <= -1) profile.registrationConfidence = 'high'; // confident it's NOT registered
  else profile.registrationConfidence = 'low';

  // --- Calculate profile completeness ---
  let dataPoints = 0;
  const totalPossible = 12;

  if (profile.names.primary) dataPoints++;
  if (profile.whatsappRegistered !== null) dataPoints++;
  if (profile.whatsappProfile.about) dataPoints++;
  if (profile.whatsappProfile.profilePicUrl) dataPoints++;
  if (profile.whatsappProfile.isBusiness) dataPoints++;
  if (profile.whatsappProfile.businessProfile) dataPoints++;
  if (profile.whatsappProfile.commonGroups.length > 0) dataPoints++;
  if (profile.numberAge && profile.numberAge.estimatedAllocationPeriod !== 'unknown') dataPoints++;
  if (profile.carrierAnalysis && profile.carrierAnalysis.likelyCarrierType) dataPoints++;
  if (profile.countryMeta) dataPoints++;
  if (profile.whatsappProfile.privacySettings.profilePic !== 'unknown') dataPoints++;
  if (profile.whatsappProfile.privacySettings.about !== 'unknown') dataPoints++;

  profile.dataPoints = dataPoints;
  profile.profileCompleteness = Math.round((dataPoints / totalPossible) * 100);
  profile.confidenceScore = Math.round(
    ((regConfPoints > 0 ? regConfPoints : 0) / 7 + (dataPoints / totalPossible)) * 50
  );

  // --- Build summary ---
  if (profile.names.primary) {
    profile.summary.push(`Name: ${profile.names.primary} (${profile.names.confidence} confidence)`);
  }
  if (profile.whatsappRegistered === true) {
    profile.summary.push('WhatsApp: REGISTERED');
  } else if (profile.whatsappRegistered === false) {
    profile.summary.push('WhatsApp: NOT REGISTERED');
  } else {
    profile.summary.push('WhatsApp: UNKNOWN');
  }
  if (profile.whatsappProfile.isBusiness) {
    profile.summary.push(`Business: YES${profile.whatsappProfile.isEnterprise ? ' (Enterprise)' : ''}`);
  }
  if (profile.numberAge && profile.numberAge.estimatedAllocationPeriod !== 'unknown') {
    profile.summary.push(`Number age: ${profile.numberAge.estimatedAllocationPeriod}`);
  }
  profile.summary.push(`Profile completeness: ${profile.profileCompleteness}% (${dataPoints}/${totalPossible} data points)`);

  return profile;
}

/**
 * Format a profile into a human-readable WhatsApp message report.
 * @param {object} profile - Profile from buildProfile()
 * @param {object[]} [dorks] - OSINT investigation links
 * @returns {string}
 */
function formatProfileReport(profile, dorks) {
  const lines = [];

  lines.push('*============================================*');
  lines.push('*    FULL PROFILE INTELLIGENCE REPORT    *');
  lines.push('*============================================*');
  lines.push('');

  // --- Profile Summary ---
  lines.push(`*Confidence Score:* ${profile.confidenceScore}/100`);
  lines.push(`*Completeness:* ${profile.profileCompleteness}% (${profile.dataPoints} data points)`);
  lines.push('');

  // --- Identity ---
  lines.push('*--- IDENTITY ---*');
  if (profile.names.primary) {
    lines.push(`*Name:* ${profile.names.primary}`);
    if (profile.names.allNames.length > 1) {
      lines.push('  Also known as:');
      profile.names.allNames.slice(1).forEach((n) => {
        lines.push(`    - ${n.name} (via ${n.source})`);
      });
    }
  } else {
    lines.push('Name: (not discovered)');
  }
  lines.push('');

  // --- Phone Intelligence ---
  lines.push('*--- PHONE INTELLIGENCE ---*');
  lines.push(`Number: ${profile.phoneNumber}`);
  lines.push(`Country: ${profile.country}${profile.countryMeta ? ` (${profile.countryMeta.name})` : ''}`);
  lines.push(`Calling Code: +${profile.callingCode}`);
  lines.push(`Number Type: ${profile.numberTypeDescription}`);

  if (profile.countryMeta) {
    lines.push(`Continent: ${profile.countryMeta.continent}`);
    if (profile.countryMeta.languages) {
      lines.push(`Likely Language(s): ${profile.countryMeta.languages.join(', ')}`);
    }
    if (profile.countryMeta.timezones && profile.countryMeta.timezones.length > 0) {
      lines.push(`Timezone(s): ${profile.countryMeta.timezones.join(', ')}`);
    }
  }

  // Carrier analysis
  if (profile.carrierAnalysis) {
    const ca = profile.carrierAnalysis;
    if (ca.likelyCarrierType) {
      lines.push(`Carrier Type: ${ca.likelyCarrierType}`);
    }
    if (ca.isLikelyVoip) {
      lines.push('VoIP Signal: YES (number may be a virtual/internet phone)');
    }
    if (ca.carrierHints.length > 0) {
      ca.carrierHints.forEach((h) => lines.push(`  Hint: ${h}`));
    }
  }

  // Number age
  if (profile.numberAge && profile.numberAge.estimatedAllocationPeriod !== 'unknown') {
    lines.push('');
    lines.push('*--- NUMBER AGE ESTIMATION ---*');
    lines.push(`Allocation Period: ${profile.numberAge.estimatedAllocationPeriod}`);
    if (profile.numberAge.numberBlockAge) {
      lines.push(`Block Age: ${profile.numberAge.numberBlockAge}`);
    }
    lines.push(`Confidence: ${profile.numberAge.confidence}`);
    if (profile.numberAge.reasoning) {
      lines.push(`Reasoning: ${profile.numberAge.reasoning}`);
    }
  }
  lines.push('');

  // --- WhatsApp Profile ---
  lines.push('*--- WHATSAPP PROFILE ---*');
  const regLabel = profile.whatsappRegistered === true
    ? 'YES'
    : profile.whatsappRegistered === false ? 'NO' : 'UNKNOWN';
  lines.push(`Registered: ${regLabel} (${profile.registrationConfidence} confidence)`);

  if (profile.whatsappRegistered === true || profile.whatsappRegistered === null) {
    const wp = profile.whatsappProfile;
    if (wp.pushname) lines.push(`Display Name: ${wp.pushname}`);
    if (wp.about) lines.push(`About/Status: ${wp.about}`);
    else lines.push('About/Status: (hidden or not set)');

    lines.push(`Profile Picture: ${wp.profilePicStatus}`);
    if (wp.profilePicUrl) lines.push(`  URL: ${wp.profilePicUrl}`);

    lines.push(`Business Account: ${wp.isBusiness ? 'YES' : 'No'}`);
    if (wp.isEnterprise) lines.push('Enterprise Account: YES');
    if (wp.numberType) lines.push(`Account Type: ${wp.numberType}`);

    // Privacy settings
    if (wp.privacySettings.profilePic !== 'unknown' || wp.privacySettings.about !== 'unknown') {
      lines.push('');
      lines.push('*--- PRIVACY SETTINGS (inferred) ---*');
      if (wp.privacySettings.profilePic !== 'unknown') {
        lines.push(`  Profile Picture: ${wp.privacySettings.profilePic}`);
      }
      if (wp.privacySettings.about !== 'unknown') {
        lines.push(`  About/Status: ${wp.privacySettings.about}`);
      }
    }

    // Business profile
    if (wp.businessProfile) {
      lines.push('');
      lines.push('*--- BUSINESS PROFILE ---*');
      const bp = wp.businessProfile;
      if (bp.description) lines.push(`Description: ${bp.description}`);
      if (bp.email) lines.push(`Email: ${bp.email}`);
      if (bp.website) {
        const websites = Array.isArray(bp.website) ? bp.website : [bp.website];
        websites.forEach((w) => lines.push(`Website: ${w}`));
      }
      if (bp.address) lines.push(`Address: ${bp.address}`);
      if (bp.category) lines.push(`Category: ${bp.category}`);
      if (bp.latitude && bp.longitude) {
        lines.push(`Location: ${bp.latitude}, ${bp.longitude}`);
        lines.push(`  Maps: https://www.google.com/maps?q=${bp.latitude},${bp.longitude}`);
      }
      if (bp.businessHours) lines.push(`Hours: ${JSON.stringify(bp.businessHours)}`);
    }

    // Common groups
    if (wp.commonGroups && wp.commonGroups.length > 0) {
      lines.push('');
      lines.push(`*--- COMMON GROUPS (${wp.commonGroups.length}) ---*`);
      wp.commonGroups.forEach((g) => {
        const count = g.participantCount ? ` (${g.participantCount} members)` : '';
        lines.push(`  - ${g.name}${count}`);
      });
    }
  }
  lines.push('');

  // --- Endpoint Discovery Details ---
  if (profile.endpointIntel.httpProbes && profile.endpointIntel.httpProbes.probes) {
    lines.push('*--- HTTP ENDPOINT PROBES ---*');
    const probes = profile.endpointIntel.httpProbes.probes;
    const probeEntries = Object.entries(probes);
    for (const [key, probe] of probeEntries) {
      if (!probe || probe.error) {
        if (probe && probe.error) lines.push(`  ${probe.endpoint || key}: ERROR - ${probe.error}`);
        continue;
      }
      const endpoint = probe.endpoint || key;
      const signals = [];
      if (probe.displayName) signals.push(`name="${probe.displayName}"`);
      if (probe.registered === true) signals.push('registered');
      if (probe.registered === false) signals.push('NOT registered');
      if (probe.isBusiness) signals.push('BUSINESS');
      if (probe.statusCode) signals.push(`HTTP ${probe.statusCode}`);
      if (probe.profilePicSignal && probe.profilePicSignal !== 'unknown') signals.push(`pic=${probe.profilePicSignal}`);
      if (signals.length > 0) {
        lines.push(`  ${endpoint}: ${signals.join(' | ')}`);
      }
    }
    if (profile.endpointIntel.httpProbes.totalProbeTimeMs) {
      lines.push(`  Total probe time: ${profile.endpointIntel.httpProbes.totalProbeTimeMs}ms`);
    }
    lines.push('');
  }

  // --- Reverse image search ---
  if (profile.whatsappProfile.profilePicUrl) {
    const imgUrl = encodeURIComponent(profile.whatsappProfile.profilePicUrl);
    lines.push('*--- REVERSE IMAGE SEARCH ---*');
    lines.push(`  Google Lens: https://lens.google.com/uploadbyurl?url=${imgUrl}`);
    lines.push(`  TinEye: https://tineye.com/search?url=${imgUrl}`);
    lines.push(`  Yandex: https://yandex.com/images/search?rpt=imageview&url=${imgUrl}`);
    lines.push('');
  }

  // --- OSINT Links ---
  if (dorks && dorks.length > 0) {
    const categories = {
      general: 'General Search',
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
  lines.push('*============================================*');
  lines.push('*     Report by Als OSINT Bot     *');
  lines.push('*============================================*');

  return lines.join('\n');
}

module.exports = {
  buildProfile,
  formatProfileReport,
  estimateNumberAge,
  analyzeCarrierSignals,
  COUNTRY_META,
  NUMBER_TYPE_MAP,
};
