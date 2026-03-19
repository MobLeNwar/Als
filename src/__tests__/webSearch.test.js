'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { generateDorks, generateReverseImageSearchLinks } = require('../webSearch');

describe('generateDorks', () => {
  it('should generate dork URLs for a phone number', () => {
    const dorks = generateDorks('+1 202 555 1234');

    assert.ok(Array.isArray(dorks));
    assert.ok(dorks.length > 0);

    const names = dorks.map((d) => d.name);
    assert.ok(names.includes('General Search'));
    assert.ok(names.includes('Facebook'));
    assert.ok(names.includes('Truecaller'));
    assert.ok(names.includes('Spokeo'));
    assert.ok(names.includes('WhatsApp Groups'));

    dorks.forEach((d) => {
      assert.ok(d.url, `Dork "${d.name}" should have a URL`);
      assert.ok(d.url.startsWith('https://'), `Dork "${d.name}" URL should start with https://`);
      assert.ok(d.category, `Dork "${d.name}" should have a category`);
    });
  });

  it('should include the phone number in dork URLs', () => {
    const dorks = generateDorks('+447911123456');
    const generalSearch = dorks.find((d) => d.name === 'General Search');
    assert.ok(generalSearch.url.includes('447911123456'));
  });

  it('should use %22 instead of literal quotes in URLs', () => {
    const dorks = generateDorks('+1 202 555 1234');
    dorks.forEach((d) => {
      assert.ok(!d.url.includes('"'), `Dork "${d.name}" should not have literal quotes in URL`);
    });
  });

  it('should use ISO country code for Truecaller URL when provided', () => {
    const dorks = generateDorks('+1 202 555 1234', { countryCode: 'US', nationalNumber: '2025551234' });
    const tc = dorks.find((d) => d.name === 'Truecaller');
    assert.ok(tc.url.includes('/search/us/'), 'Truecaller URL should use lowercase ISO country code');
    assert.ok(tc.url.includes('2025551234'), 'Truecaller URL should include national number');
  });

  it('should have dorks across multiple categories', () => {
    const dorks = generateDorks('+1234567890', {});
    const categories = new Set(dorks.map((d) => d.category));
    assert.ok(categories.has('general'));
    assert.ok(categories.has('social'));
    assert.ok(categories.has('messaging'));
    assert.ok(categories.has('caller_id'));
    assert.ok(categories.has('people_search'));
    assert.ok(categories.has('breach'));
  });
});

describe('generateReverseImageSearchLinks', () => {
  it('should generate reverse image search links for a URL', () => {
    const links = generateReverseImageSearchLinks('https://example.com/pic.jpg');

    assert.ok(Array.isArray(links));
    assert.strictEqual(links.length, 3);

    const names = links.map((l) => l.name);
    assert.ok(names.includes('Google Lens (reverse)'));
    assert.ok(names.includes('TinEye'));
    assert.ok(names.includes('Yandex Images'));

    links.forEach((l) => {
      assert.ok(l.url.includes('example.com'));
    });
  });

  it('should return empty array for null/undefined imageUrl', () => {
    assert.deepStrictEqual(generateReverseImageSearchLinks(null), []);
    assert.deepStrictEqual(generateReverseImageSearchLinks(undefined), []);
    assert.deepStrictEqual(generateReverseImageSearchLinks(''), []);
  });
});
