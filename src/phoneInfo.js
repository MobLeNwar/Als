'use strict';

const {
  parsePhoneNumberFromString,
  getCountryCallingCode,
} = require('libphonenumber-js');

/**
 * Parse a phone number and extract metadata.
 * Accepts formats: +1234567890, 1234567890, etc.
 * @param {string} input - Raw phone number string
 * @returns {object|null} Parsed phone info or null if invalid
 */
function parsePhoneNumber(input) {
  const cleaned = input.replace(/[\s\-().]/g, '');

  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;

  const phone = parsePhoneNumberFromString(withPlus);
  if (!phone) {
    return null;
  }

  const countryCode = phone.country;
  let callingCode = '';
  try {
    callingCode = countryCode ? getCountryCallingCode(countryCode) : '';
  } catch (_e) {
    callingCode = '';
  }

  return {
    valid: phone.isValid(),
    possible: phone.isPossible(),
    number: phone.number,
    nationalNumber: phone.nationalNumber,
    country: countryCode || 'Unknown',
    callingCode: callingCode,
    type: phone.getType() || 'Unknown',
    international: phone.formatInternational(),
    uri: phone.getURI(),
  };
}

/**
 * Build the WhatsApp ID for a phone number.
 * @param {string} number - E.164 formatted number (e.g. +1234567890)
 * @returns {string} WhatsApp contact ID (e.g. 1234567890@c.us)
 */
function toWhatsAppId(number) {
  const digits = number.replace(/\D/g, '');
  return `${digits}@c.us`;
}

module.exports = { parsePhoneNumber, toWhatsAppId };
