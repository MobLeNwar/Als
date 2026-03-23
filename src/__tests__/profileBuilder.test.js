'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildProfile, estimateNumberAge, analyzeCarrierSignals, COUNTRY_META, NUMBER_TYPE_MAP } = require('../profileBuilder');

describe('estimateNumberAge', () => {
  it('should identify pre-1995 US area codes (middle digit 0/1)', () => {
    const result = estimateNumberAge('US', '2025551234');
    assert.strictEqual(result.confidence, 'medium');
    assert.ok(result.estimatedAllocationPeriod.includes('pre-1995'));
    assert.strictEqual(result.numberBlockAge, 'established');
  });

  it('should identify post-1995 US area codes', () => {
    const result = estimateNumberAge('US', '4695551234');
    assert.strictEqual(result.confidence, 'medium');
    assert.ok(result.estimatedAllocationPeriod.includes('post-1995'));
    assert.strictEqual(result.numberBlockAge, 'newer');
  });

  it('should identify post-2018 India 6-series numbers', () => {
    const result = estimateNumberAge('IN', '6234567890');
    assert.strictEqual(result.confidence, 'medium');
    assert.ok(result.estimatedAllocationPeriod.includes('post-2018'));
    assert.strictEqual(result.numberBlockAge, 'newer');
  });

  it('should identify pre-2018 India 9-series numbers', () => {
    const result = estimateNumberAge('IN', '9876543210');
    assert.strictEqual(result.confidence, 'medium');
    assert.ok(result.estimatedAllocationPeriod.includes('pre-2018'));
    assert.strictEqual(result.numberBlockAge, 'established');
  });

  it('should identify France 07 as post-2010', () => {
    const result = estimateNumberAge('FR', '712345678');
    assert.ok(result.estimatedAllocationPeriod.includes('post-2010'));
    assert.strictEqual(result.numberBlockAge, 'newer');
  });

  it('should identify France 06 as pre-2010', () => {
    const result = estimateNumberAge('FR', '612345678');
    assert.ok(result.estimatedAllocationPeriod.includes('pre-2010'));
    assert.strictEqual(result.numberBlockAge, 'established');
  });

  it('should return unknown for unsupported countries', () => {
    const result = estimateNumberAge('ZZ', '1234567890');
    assert.strictEqual(result.estimatedAllocationPeriod, 'unknown');
    assert.strictEqual(result.confidence, 'none');
  });

  it('should handle null/undefined inputs', () => {
    const result = estimateNumberAge(null, null);
    assert.strictEqual(result.estimatedAllocationPeriod, null);
    assert.strictEqual(result.confidence, 'low');
  });

  it('should identify UK newer mobile blocks (07[345]x)', () => {
    const result = estimateNumberAge('GB', '7412345678');
    assert.ok(result.estimatedAllocationPeriod.includes('post-2010'));
  });

  it('should identify Germany 015x as newer', () => {
    const result = estimateNumberAge('DE', '15123456789');
    assert.ok(result.estimatedAllocationPeriod.includes('post-2000'));
    assert.strictEqual(result.numberBlockAge, 'newer');
  });
});

describe('analyzeCarrierSignals', () => {
  it('should identify VoIP numbers', () => {
    const result = analyzeCarrierSignals('US', '2025551234', 'VOIP');
    assert.strictEqual(result.isLikelyVoip, true);
    assert.strictEqual(result.likelyCarrierType, 'VoIP');
  });

  it('should identify mobile numbers', () => {
    const result = analyzeCarrierSignals('US', '2025551234', 'MOBILE');
    assert.strictEqual(result.isLikelyMobile, true);
    assert.strictEqual(result.likelyCarrierType, 'Mobile');
  });

  it('should identify landline numbers', () => {
    const result = analyzeCarrierSignals('US', '2025551234', 'FIXED_LINE');
    assert.strictEqual(result.isLikelyLandline, true);
    assert.strictEqual(result.likelyCarrierType, 'Landline');
    assert.ok(result.carrierHints.some((h) => h.includes('Fixed line')));
  });

  it('should detect India carrier prefixes', () => {
    const result = analyzeCarrierSignals('IN', '7012345678', 'MOBILE');
    assert.ok(result.carrierHints.some((h) => h.includes('Airtel') || h.includes('Jio')));
  });

  it('should handle unknown number type', () => {
    const result = analyzeCarrierSignals('US', '1234567890', 'Unknown');
    assert.strictEqual(result.likelyCarrierType, null);
  });
});

describe('buildProfile', () => {
  const basePhoneInfo = {
    international: '+1 202 555 1234',
    nationalNumber: '2025551234',
    country: 'US',
    callingCode: '1',
    type: 'FIXED_LINE_OR_MOBILE',
    number: '+12025551234',
    valid: true,
  };

  it('should build a basic profile from phone info only', () => {
    const profile = buildProfile(basePhoneInfo, null, null, null);
    assert.strictEqual(profile.phoneNumber, '+1 202 555 1234');
    assert.strictEqual(profile.country, 'US');
    assert.ok(profile.countryMeta);
    assert.strictEqual(profile.countryMeta.name, 'United States');
    assert.ok(profile.numberAge);
    assert.ok(profile.carrierAnalysis);
    assert.ok(profile.profileCompleteness >= 0);
    assert.ok(profile.confidenceScore >= 0);
  });

  it('should integrate WhatsApp data into profile', () => {
    const waData = {
      registered: true,
      pushname: 'John Doe',
      about: 'Hello World',
      profilePicUrl: 'https://example.com/pic.jpg',
      isBusiness: false,
      isEnterprise: false,
      commonGroups: [{ name: 'Test Group', participantCount: 10 }],
      privacySettings: { profilePic: 'visible', about: 'visible' },
    };

    const profile = buildProfile(basePhoneInfo, waData, null, null);
    assert.strictEqual(profile.whatsappRegistered, true);
    assert.strictEqual(profile.whatsappProfile.pushname, 'John Doe');
    assert.strictEqual(profile.whatsappProfile.about, 'Hello World');
    assert.strictEqual(profile.names.primary, 'John Doe');
    assert.ok(profile.names.allNames.length > 0);
    assert.ok(profile.profileCompleteness > 0);
  });

  it('should integrate HTTP probe data', () => {
    const httpProbeData = {
      summary: {
        displayName: 'Alice',
        registered: true,
        isBusiness: false,
        profilePicStatus: 'visible',
      },
    };

    const profile = buildProfile(basePhoneInfo, null, httpProbeData, null);
    assert.strictEqual(profile.names.primary, 'Alice');
    assert.strictEqual(profile.whatsappRegistered, true);
  });

  it('should integrate browser probe data', () => {
    const browserProbeData = {
      summary: {
        displayName: 'Bob',
        registered: true,
        isBusiness: true,
      },
    };

    const profile = buildProfile(basePhoneInfo, null, null, browserProbeData);
    assert.strictEqual(profile.names.primary, 'Bob');
    assert.strictEqual(profile.whatsappProfile.isBusiness, true);
  });

  it('should cross-reference names from multiple sources', () => {
    const waData = {
      registered: true,
      pushname: 'John',
      verifiedName: 'John Smith LLC',
    };
    const httpProbeData = {
      summary: { displayName: 'John Smith' },
    };

    const profile = buildProfile(basePhoneInfo, waData, httpProbeData, null);
    // Verified name should be highest confidence
    assert.strictEqual(profile.names.primary, 'John Smith LLC');
    assert.ok(profile.names.allNames.length >= 2);
  });

  it('should calculate confidence score', () => {
    const waData = {
      registered: true,
      pushname: 'John Doe',
      about: 'Hi there',
      profilePicUrl: 'https://example.com/pic.jpg',
      isBusiness: true,
      businessProfile: { description: 'Test biz' },
      commonGroups: [{ name: 'Group1' }],
      privacySettings: { profilePic: 'visible', about: 'visible' },
    };

    const profile = buildProfile(basePhoneInfo, waData, null, null);
    assert.ok(profile.confidenceScore > 0);
    assert.ok(profile.profileCompleteness > 50);
    assert.ok(profile.dataPoints > 5);
  });

  it('should generate summary lines', () => {
    const profile = buildProfile(basePhoneInfo, null, null, null);
    assert.ok(Array.isArray(profile.summary));
    assert.ok(profile.summary.length > 0);
    assert.ok(profile.summary.some((s) => s.includes('WhatsApp')));
  });

  it('should handle country metadata for known countries', () => {
    const profile = buildProfile(basePhoneInfo, null, null, null);
    assert.ok(profile.countryMeta);
    assert.strictEqual(profile.countryMeta.name, 'United States');
    assert.ok(profile.countryMeta.languages.includes('English'));
    assert.ok(profile.countryMeta.timezones.length > 0);
  });
});

describe('COUNTRY_META', () => {
  it('should have metadata for major countries', () => {
    const majorCountries = ['US', 'GB', 'IN', 'BR', 'DE', 'FR', 'JP', 'AU', 'CA'];
    for (const cc of majorCountries) {
      assert.ok(COUNTRY_META[cc], `Should have metadata for ${cc}`);
      assert.ok(COUNTRY_META[cc].name, `${cc} should have a name`);
      assert.ok(COUNTRY_META[cc].languages, `${cc} should have languages`);
      assert.ok(COUNTRY_META[cc].timezones, `${cc} should have timezones`);
    }
  });
});

describe('NUMBER_TYPE_MAP', () => {
  it('should map common number types', () => {
    assert.strictEqual(NUMBER_TYPE_MAP.MOBILE, 'Mobile');
    assert.strictEqual(NUMBER_TYPE_MAP.FIXED_LINE, 'Fixed Line (Landline)');
    assert.strictEqual(NUMBER_TYPE_MAP.VOIP, 'VoIP');
  });
});
