'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseWaMeText, correlateResults, getWaMeLink } = require('../waEndpoints');

describe('parseWaMeText', () => {
  it('should detect invalid number signal', () => {
    const result = parseWaMeText('Phone number shared via url is invalid.');
    assert.strictEqual(result.registered, false);
    assert.strictEqual(result.displayName, null);
    assert.strictEqual(result.method, 'invalid_signal');
  });

  it('should extract display name from Skip to content pattern', () => {
    const text = 'Skip to content\nJohn Smith\nOpen app\nContinue to WhatsApp Web';
    const result = parseWaMeText(text);
    assert.strictEqual(result.registered, true);
    assert.strictEqual(result.displayName, 'John Smith');
    assert.strictEqual(result.method, 'skip_to_content');
  });

  it('should return inconclusive for Chat on WhatsApp pattern', () => {
    const text = 'Skip to content\nChat on WhatsApp with +1 202 555 1234\nOpen app';
    const result = parseWaMeText(text);
    assert.strictEqual(result.registered, null);
    assert.strictEqual(result.displayName, null);
  });

  it('should return inconclusive when no name between Skip and Open app', () => {
    const text = 'Skip to content\nOpen app\nContinue to WhatsApp Web';
    const result = parseWaMeText(text);
    assert.strictEqual(result.registered, null);
    assert.strictEqual(result.displayName, null);
  });

  it('should detect name from Message pattern', () => {
    const text = 'Some content\nMessage Jane Doe\nSend';
    const result = parseWaMeText(text);
    assert.strictEqual(result.registered, true);
    assert.strictEqual(result.displayName, 'Jane Doe');
    assert.strictEqual(result.method, 'message_pattern');
  });

  it('should not detect name from Message pattern with phone number', () => {
    const text = 'Some content\nMessage +1234567890\nSend';
    const result = parseWaMeText(text);
    assert.strictEqual(result.displayName, null);
  });

  it('should return inconclusive for empty or generic text', () => {
    const result = parseWaMeText('Some random page text');
    assert.strictEqual(result.registered, null);
    assert.strictEqual(result.displayName, null);
  });
});

describe('correlateResults', () => {
  it('should correlate when both probes find a name', () => {
    const waMe = { registered: true, displayName: 'Alice', method: 'skip_to_content' };
    const api = { registered: true, displayName: 'Alice', method: 'og_title_api' };
    const catalog = { isBusiness: false };

    const result = correlateResults(waMe, api, catalog);
    assert.strictEqual(result.displayName, 'Alice');
    assert.strictEqual(result.registered, true);
    assert.strictEqual(result.confidence, 'high');
    assert.strictEqual(result.isBusiness, false);
  });

  it('should detect business from catalog probe', () => {
    const waMe = { registered: null, displayName: null };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: true, businessName: 'Acme Corp' };

    const result = correlateResults(waMe, api, catalog);
    assert.strictEqual(result.isBusiness, true);
    assert.strictEqual(result.businessName, 'Acme Corp');
  });

  it('should return low confidence when no signals found', () => {
    const waMe = { registered: null, displayName: null };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: false };

    const result = correlateResults(waMe, api, catalog);
    assert.strictEqual(result.confidence, 'low');
    assert.strictEqual(result.registered, null);
  });

  it('should return high confidence for invalid number', () => {
    const waMe = { registered: false, displayName: null };
    const api = { registered: false, displayName: null };
    const catalog = { isBusiness: false };

    const result = correlateResults(waMe, api, catalog);
    assert.strictEqual(result.registered, false);
    assert.strictEqual(result.confidence, 'high');
  });

  it('should include signals array', () => {
    const waMe = { registered: true, displayName: 'Bob', method: 'skip_to_content' };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: false };

    const result = correlateResults(waMe, api, catalog);
    assert.ok(Array.isArray(result.signals));
    assert.ok(result.signals.length > 0);
  });
});

describe('getWaMeLink', () => {
  it('should generate correct wa.me link', () => {
    assert.strictEqual(getWaMeLink('+1234567890'), 'https://wa.me/1234567890');
  });

  it('should strip non-digit characters', () => {
    assert.strictEqual(getWaMeLink('+1 (202) 555-1234'), 'https://wa.me/12025551234');
  });
});
