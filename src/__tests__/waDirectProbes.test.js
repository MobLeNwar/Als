'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { extractOGTags, extractTitle, correlateHttpResults } = require('../waDirectProbes');

describe('extractOGTags', () => {
  it('should extract OG tags from HTML', () => {
    const html = '<html><head><meta property="og:title" content="John Smith"><meta property="og:description" content="Chat on WhatsApp"></head></html>';
    const tags = extractOGTags(html);
    assert.strictEqual(tags['og:title'], 'John Smith');
    assert.strictEqual(tags['og:description'], 'Chat on WhatsApp');
  });

  it('should handle reversed attribute order (content before property)', () => {
    const html = '<meta content="Test Name" property="og:title">';
    const tags = extractOGTags(html);
    assert.strictEqual(tags['og:title'], 'Test Name');
  });

  it('should return empty object for HTML without OG tags', () => {
    const html = '<html><head><title>Test</title></head></html>';
    const tags = extractOGTags(html);
    assert.deepStrictEqual(tags, {});
  });

  it('should handle name attribute as well as property', () => {
    const html = '<meta name="og:image" content="https://example.com/pic.jpg">';
    const tags = extractOGTags(html);
    assert.strictEqual(tags['og:image'], 'https://example.com/pic.jpg');
  });
});

describe('extractTitle', () => {
  it('should extract page title', () => {
    const html = '<html><head><title>WhatsApp Chat</title></head></html>';
    assert.strictEqual(extractTitle(html), 'WhatsApp Chat');
  });

  it('should return null for HTML without title', () => {
    const html = '<html><head></head></html>';
    assert.strictEqual(extractTitle(html), null);
  });

  it('should trim whitespace from title', () => {
    const html = '<title>  Some Title  </title>';
    assert.strictEqual(extractTitle(html), 'Some Title');
  });
});

describe('correlateHttpResults', () => {
  it('should detect registration from multiple sources', () => {
    const waMe = { registered: true, displayName: 'Alice' };
    const api = { registered: true, displayName: 'Alice' };
    const catalog = { isBusiness: false };
    const bizApi = {};
    const profilePic = { profilePicSignal: 'unknown' };

    const result = correlateHttpResults(waMe, api, catalog, bizApi, profilePic);
    assert.strictEqual(result.registered, true);
    assert.strictEqual(result.displayName, 'Alice');
    assert.strictEqual(result.confidence, 'high');
  });

  it('should detect unregistered number', () => {
    const waMe = { registered: false, displayName: null };
    const api = { registered: false, displayName: null };
    const catalog = { isBusiness: false };
    const bizApi = {};
    const profilePic = { profilePicSignal: 'unknown' };

    const result = correlateHttpResults(waMe, api, catalog, bizApi, profilePic);
    assert.strictEqual(result.registered, false);
    assert.strictEqual(result.confidence, 'high');
  });

  it('should detect business from catalog', () => {
    const waMe = { registered: null, displayName: null };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: true, businessName: 'Acme Corp' };
    const bizApi = {};
    const profilePic = { profilePicSignal: 'unknown' };

    const result = correlateHttpResults(waMe, api, catalog, bizApi, profilePic);
    assert.strictEqual(result.isBusiness, true);
    assert.strictEqual(result.businessName, 'Acme Corp');
  });

  it('should return low confidence when no signals', () => {
    const waMe = { registered: null, displayName: null };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: false };
    const bizApi = {};
    const profilePic = { profilePicSignal: 'unknown' };

    const result = correlateHttpResults(waMe, api, catalog, bizApi, profilePic);
    assert.strictEqual(result.confidence, 'low');
  });

  it('should detect visible profile picture', () => {
    const waMe = { registered: null, displayName: null };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: false };
    const bizApi = {};
    const profilePic = { profilePicSignal: 'visible' };

    const result = correlateHttpResults(waMe, api, catalog, bizApi, profilePic);
    assert.strictEqual(result.profilePicStatus, 'visible');
    assert.ok(result.signals.some((s) => s.includes('profile picture')));
  });

  it('should include signals array', () => {
    const waMe = { registered: true, displayName: 'Bob' };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: false };
    const bizApi = {};
    const profilePic = { profilePicSignal: 'unknown' };

    const result = correlateHttpResults(waMe, api, catalog, bizApi, profilePic);
    assert.ok(Array.isArray(result.signals));
    assert.ok(result.signals.length > 0);
  });

  it('should detect redirect signals', () => {
    const waMe = { registered: null, displayName: null, redirectedToApi: true };
    const api = { registered: null, displayName: null };
    const catalog = { isBusiness: false };
    const bizApi = {};
    const profilePic = { profilePicSignal: 'unknown' };

    const result = correlateHttpResults(waMe, api, catalog, bizApi, profilePic);
    assert.ok(result.signals.some((s) => s.includes('redirected')));
  });
});
