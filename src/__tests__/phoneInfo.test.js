'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parsePhoneNumber, toWhatsAppId } = require('../phoneInfo');

describe('parsePhoneNumber', () => {
  it('should parse a valid US number', () => {
    const result = parsePhoneNumber('+12025551234');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.country, 'US');
    assert.strictEqual(result.callingCode, '1');
    assert.strictEqual(result.number, '+12025551234');
  });

  it('should parse a valid UK number', () => {
    const result = parsePhoneNumber('+442071234567');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.country, 'GB');
    assert.strictEqual(result.callingCode, '44');
  });

  it('should handle numbers without plus sign', () => {
    const result = parsePhoneNumber('12025551234');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.country, 'US');
  });

  it('should handle numbers with spaces and dashes', () => {
    const result = parsePhoneNumber('+1 202-555-1234');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.country, 'US');
  });

  it('should return null for invalid input', () => {
    const result = parsePhoneNumber('abc');
    assert.strictEqual(result, null);
  });

  it('should mark invalid numbers as not valid', () => {
    const result = parsePhoneNumber('+1234');
    if (result) {
      assert.strictEqual(result.valid, false);
    }
  });
});

describe('toWhatsAppId', () => {
  it('should convert E.164 number to WhatsApp ID', () => {
    const waId = toWhatsAppId('+12025551234');
    assert.strictEqual(waId, '12025551234@c.us');
  });

  it('should strip non-digit characters', () => {
    const waId = toWhatsAppId('+44 7911 123456');
    assert.strictEqual(waId, '447911123456@c.us');
  });
});
