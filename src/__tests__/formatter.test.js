'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatReport } = require('../formatter');

describe('formatReport', () => {
  it('should format a full report with all WhatsApp data', () => {
    const phoneInfo = {
      international: '+1 202 555 1234',
      country: 'US',
      callingCode: '1',
      type: 'FIXED_LINE_OR_MOBILE',
      valid: true,
    };

    const waData = {
      registered: true,
      pushname: 'John Doe',
      shortName: 'John',
      about: 'Hello World',
      profilePicUrl: 'https://example.com/pic.jpg',
      isBusiness: true,
      isEnterprise: false,
      isMyContact: false,
      verifiedName: 'John Doe LLC',
      verifiedLevel: 'high',
      countryCode: '1',
      formattedNumber: '+1 (202) 555-1234',
      commonGroups: [{ id: '123@g.us', name: 'Test Group', participantCount: 15 }],
      businessProfile: {
        description: 'A test business',
        email: 'john@example.com',
        website: ['https://example.com'],
        address: '123 Main St',
        category: 'Technology',
      },
    };

    const dorks = [
      { name: 'General Search', url: 'https://google.com/search?q=test', category: 'general' },
    ];

    const report = formatReport(phoneInfo, waData, dorks);

    assert.ok(report.includes('PHONE NUMBER OSINT REPORT'));
    assert.ok(report.includes('+1 202 555 1234'));
    assert.ok(report.includes('US'));
    assert.ok(report.includes('John Doe'));
    assert.ok(report.includes('John'));
    assert.ok(report.includes('Hello World'));
    assert.ok(report.includes('https://example.com/pic.jpg'));
    assert.ok(report.includes('John Doe LLC'));
    assert.ok(report.includes('Test Group'));
    assert.ok(report.includes('15 members'));
    assert.ok(report.includes('A test business'));
    assert.ok(report.includes('john@example.com'));
    assert.ok(report.includes('General Search'));
    // Should include reverse image search links since profilePicUrl is set
    assert.ok(report.includes('REVERSE IMAGE SEARCH'));
    assert.ok(report.includes('Google Lens'));
    assert.ok(report.includes('TinEye'));
  });

  it('should handle unregistered WhatsApp number', () => {
    const phoneInfo = {
      international: '+1 202 555 1234',
      country: 'US',
      callingCode: '1',
      type: 'MOBILE',
      valid: true,
    };

    const waData = { registered: false };
    const report = formatReport(phoneInfo, waData, []);

    assert.ok(report.includes('Registered on WhatsApp: NO'));
    assert.ok(!report.includes('Display Name'));
  });

  it('should not include reverse image section when no profile pic', () => {
    const phoneInfo = {
      international: '+1 202 555 1234',
      country: 'US',
      callingCode: '1',
      type: 'MOBILE',
      valid: true,
    };

    const waData = {
      registered: true,
      pushname: 'Jane',
      profilePicUrl: null,
      isBusiness: false,
      isEnterprise: false,
      isMyContact: false,
      commonGroups: [],
    };

    const report = formatReport(phoneInfo, waData, []);

    assert.ok(!report.includes('REVERSE IMAGE SEARCH'));
    assert.ok(report.includes('hidden or not set'));
  });

  it('should group dorks by category', () => {
    const phoneInfo = {
      international: '+1234567890',
      country: 'US',
      callingCode: '1',
      type: 'MOBILE',
      valid: true,
    };

    const waData = { registered: false };
    const dorks = [
      { name: 'Google', url: 'https://google.com', category: 'general' },
      { name: 'Facebook', url: 'https://facebook.com', category: 'social' },
      { name: 'Truecaller', url: 'https://truecaller.com', category: 'caller_id' },
    ];

    const report = formatReport(phoneInfo, waData, dorks);

    assert.ok(report.includes('General'));
    assert.ok(report.includes('Social Media'));
    assert.ok(report.includes('Caller ID'));
  });
});
