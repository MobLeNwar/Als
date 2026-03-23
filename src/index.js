'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { parsePhoneNumber, toWhatsAppId } = require('./phoneInfo');
const { lookupWhatsApp, batchCheckRegistration } = require('./whatsappLookup');
const { generateDorks } = require('./webSearch');
const { formatReport, formatFullProfile } = require('./formatter');
const { probeAllEndpoints, getWaMeLink } = require('./waEndpoints');
const { probeAllHttpEndpoints } = require('./waDirectProbes');

const HELP_TEXT = `*Als OSINT Bot* - WhatsApp Phone Number Intelligence

Send a phone number to get a full OSINT report using WhatsApp's discovery system.

*Supported formats:*
  +1234567890
  1234567890
  +44 7911 123456

*Commands:*
  !lookup <number>   - Full OSINT report (WhatsApp data + investigation links)
  !profile <number>  - Full intelligence profile with age estimation
  !wa <number>       - WhatsApp-only lookup (profile data only)
  !links <number>    - OSINT investigation links only (no WhatsApp query)
  !batch <n1> <n2>   - Batch check if multiple numbers are on WhatsApp
  !help              - Show this help message

All lookups are free. No API keys needed.`;

/**
 * Parse incoming message for commands or raw phone numbers.
 * @param {string} text - Message body
 * @returns {{ command: string, numberInput: string } | null}
 */
function parseCommand(text) {
  const trimmed = text.trim();

  const cmdMatch = trimmed.match(/^!(lookup|profile|wa|links|batch|help)\s*(.*)/i);
  if (cmdMatch) {
    return {
      command: cmdMatch[1].toLowerCase(),
      numberInput: cmdMatch[2].trim(),
    };
  }

  const numberMatch = trimmed.match(/^\+?[\d\s\-().]{7,20}$/);
  if (numberMatch) {
    return { command: 'lookup', numberInput: trimmed };
  }

  return null;
}

function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', (qr) => {
    console.log('\n[Auth] Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('[Bot] WhatsApp client is ready!');
    console.log('[Bot] Send a phone number to any chat to start a lookup.');
  });

  client.on('authenticated', () => {
    console.log('[Auth] Authentication successful.');
  });

  client.on('auth_failure', (msg) => {
    console.error('[Auth] Authentication failed:', msg);
  });

  client.on('disconnected', (reason) => {
    console.log('[Bot] Client disconnected:', reason);
  });

  client.on('message', async (message) => {
    await handleMessage(client, message);
  });

  return client;
}

async function handleMessage(client, message) {
  const parsed = parseCommand(message.body);
  if (!parsed) return;

  const { command, numberInput } = parsed;

  if (command === 'help') {
    await message.reply(HELP_TEXT);
    return;
  }

  if (command === 'batch') {
    await handleBatch(client, message, numberInput);
    return;
  }

  if (!numberInput) {
    await message.reply('Please provide a phone number.\nExample: !lookup +1234567890');
    return;
  }

  const phoneInfo = parsePhoneNumber(numberInput);
  if (!phoneInfo || !phoneInfo.valid) {
    await message.reply(
      `Invalid phone number: "${numberInput}"\n\nUse international format with country code.\nExample: +1234567890`
    );
    return;
  }

  await message.reply(`Analyzing *${phoneInfo.international}*... Please wait.`);

  try {
    if (command === 'lookup') {
      await fullLookup(client, message, phoneInfo);
    } else if (command === 'profile') {
      await fullProfileLookup(client, message, phoneInfo);
    } else if (command === 'wa') {
      await whatsappOnlyLookup(client, message, phoneInfo);
    } else if (command === 'links') {
      await linksOnlyLookup(message, phoneInfo);
    }
  } catch (err) {
    console.error('[Bot] Error handling lookup:', err);
    await message.reply('An error occurred during the lookup. Please try again.');
  }
}

async function fullLookup(client, message, phoneInfo) {
  const waId = toWhatsAppId(phoneInfo.number);

  // Run all endpoint probes (no auth) in parallel with WhatsApp API lookup (auth)
  const [waData, endpointProbes] = await Promise.all([
    lookupWhatsApp(client, waId),
    probeAllEndpoints(phoneInfo.number).catch(() => null),
  ]);

  if (endpointProbes) {
    waData.endpointProbes = endpointProbes;
  }
  waData.waMeLink = getWaMeLink(phoneInfo.number);

  const dorkOptions = { countryCode: phoneInfo.country, nationalNumber: phoneInfo.nationalNumber };
  const dorks = generateDorks(phoneInfo.international, dorkOptions);
  const report = formatReport(phoneInfo, waData, dorks);

  await message.reply(report);
}

async function whatsappOnlyLookup(client, message, phoneInfo) {
  const waId = toWhatsAppId(phoneInfo.number);

  const [waData, endpointProbes] = await Promise.all([
    lookupWhatsApp(client, waId),
    probeAllEndpoints(phoneInfo.number).catch(() => null),
  ]);

  if (endpointProbes) {
    waData.endpointProbes = endpointProbes;
  }
  waData.waMeLink = getWaMeLink(phoneInfo.number);

  const report = formatReport(phoneInfo, waData, []);

  await message.reply(report);
}

async function linksOnlyLookup(message, phoneInfo) {
  // Run all endpoint probes (no QR auth needed)
  const endpointProbes = await probeAllEndpoints(phoneInfo.number).catch(() => null);
  const waPlaceholder = { registered: false };
  if (endpointProbes) {
    waPlaceholder.endpointProbes = endpointProbes;
  }
  waPlaceholder.waMeLink = getWaMeLink(phoneInfo.number);

  const dorkOptions = { countryCode: phoneInfo.country, nationalNumber: phoneInfo.nationalNumber };
  const dorks = generateDorks(phoneInfo.international, dorkOptions);
  const report = formatReport(phoneInfo, waPlaceholder, dorks);

  await message.reply(report);
}

async function fullProfileLookup(client, message, phoneInfo) {
  const waId = toWhatsAppId(phoneInfo.number);

  // Run HTTP probes, browser probes, and WhatsApp API lookup in parallel
  const [waData, httpProbeData, browserProbeData] = await Promise.all([
    lookupWhatsApp(client, waId),
    probeAllHttpEndpoints(phoneInfo.number).catch(() => null),
    probeAllEndpoints(phoneInfo.number).catch(() => null),
  ]);

  const dorkOptions = { countryCode: phoneInfo.country, nationalNumber: phoneInfo.nationalNumber };
  const dorks = generateDorks(phoneInfo.international, dorkOptions);
  const report = formatFullProfile(phoneInfo, waData, httpProbeData, browserProbeData, dorks);

  await message.reply(report);
}

async function handleBatch(client, message, input) {
  if (!input) {
    await message.reply('Provide space-separated numbers.\nExample: !batch +1234567890 +9876543210');
    return;
  }

  const rawNumbers = input.split(/[\s,]+/).filter(Boolean);
  if (rawNumbers.length === 0) {
    await message.reply('No valid numbers provided.');
    return;
  }

  if (rawNumbers.length > 20) {
    await message.reply('Maximum 20 numbers per batch. Please split your request.');
    return;
  }

  await message.reply(`Checking ${rawNumbers.length} number(s) on WhatsApp...`);

  const waIds = [];
  const numberMap = {};
  const invalidNumbers = [];

  for (const raw of rawNumbers) {
    const info = parsePhoneNumber(raw);
    if (info && info.valid) {
      const waId = toWhatsAppId(info.number);
      waIds.push(waId);
      numberMap[waId] = info.international;
    } else {
      invalidNumbers.push(raw);
    }
  }

  const results = await batchCheckRegistration(client, waIds);

  const lines = ['*Batch WhatsApp Check Results:*', ''];
  for (const r of results) {
    const display = numberMap[r.waId] || r.waId;
    const status = r.registered ? 'ON WhatsApp' : 'NOT on WhatsApp';
    const icon = r.registered ? '[+]' : '[-]';
    lines.push(`${icon} ${display}: ${status}`);
  }

  if (invalidNumbers.length > 0) {
    lines.push('');
    lines.push('*Skipped (invalid format):*');
    for (const inv of invalidNumbers) {
      lines.push(`  [!] ${inv}`);
    }
  }

  await message.reply(lines.join('\n'));
}

// Start the bot
const client = createClient();
console.log('[Bot] Starting Als OSINT Bot...');
client.initialize();
