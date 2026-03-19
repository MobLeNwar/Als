# Als - WhatsApp Number OSINT Bot

A WhatsApp bot that performs OSINT (Open Source Intelligence) lookups on phone numbers. It leverages WhatsApp's own discovery API to extract maximum profile information, then provides curated OSINT investigation links for deeper research. **100% free, no API keys or paid services needed.**

## Features

### WhatsApp Discovery (via whatsapp-web.js API)
- **Registration Check**: Detect if a number is registered on WhatsApp
- **Display Name (pushname)**: The public name the user has set
- **Short Name / Verified Name**: Additional identity signals
- **About / Status**: The user's public status message
- **Profile Picture URL**: Direct link to their profile picture
- **Business Account Detection**: Identify WhatsApp Business accounts
- **Business Profile**: Description, email, website, address, category, hours
- **Enterprise Account Detection**: Identify enterprise-level accounts
- **Common Groups**: Discover shared WhatsApp groups (social connections)
- **Country Code & Formatted Number**: WhatsApp-reported country and formatting
- **Verified Level**: WhatsApp verification status

### OSINT Investigation Links (all free, no API keys)
- **Reverse Image Search**: Google Lens, TinEye, Yandex (from profile picture)
- **Social Media Dorks**: Facebook, Instagram, LinkedIn, Twitter/X, TikTok
- **Messaging Platform Search**: WhatsApp Groups, wa.me business links, Telegram
- **People Search Engines**: Spokeo, ThatsThem, WhitePages, NumLookup
- **Caller ID / Spam Check**: Truecaller, Sync.me, WhoCalledMe
- **Forum & Community Search**: Reddit, forums, Quora
- **Classifieds & Directories**: OLX, Craigslist, Gumtree, YellowPages
- **Breach / Paste Sites**: Pastebin, data leak mentions
- **Document Search**: PDF, DOC, XLSX, CSV files containing the number

### Additional Features
- **Batch Check**: Check up to 20 numbers at once for WhatsApp registration
- **Multiple Modes**: Full report, WhatsApp-only, or links-only
- **Phone Number Validation**: Powered by libphonenumber-js (country, type, formatting)

## Prerequisites

- **Node.js** >= 18.0.0
- A **WhatsApp account** to authenticate the bot (scans QR code on first run)
- **Chromium/Chrome** installed on the system (used by puppeteer internally)

## Installation

```bash
git clone https://github.com/MobLeNwar/Als.git
cd Als
npm install
```

## Usage

### Start the bot

```bash
npm start
```

On first run, a QR code will appear in the terminal. Scan it with your WhatsApp mobile app (Settings > Linked Devices > Link a Device).

### Commands

Send any of these to the bot via WhatsApp:

| Command | Description |
|---|---|
| `+1234567890` | Full OSINT report (just send a number) |
| `!lookup +1234567890` | Full OSINT report (WhatsApp data + investigation links) |
| `!wa +1234567890` | WhatsApp-only lookup (profile data only, no links) |
| `!links +1234567890` | OSINT investigation links only (no WhatsApp query) |
| `!batch +123 +456 +789` | Batch check if multiple numbers are on WhatsApp |
| `!help` | Show help message |

### Example Output

```
*=============================*
*   PHONE NUMBER OSINT REPORT*
*=============================*

*--- PHONE INFO ---*
Number: +1 202 555 1234
Country: US
Calling Code: +1
Type: FIXED_LINE_OR_MOBILE
Valid: Yes

*--- WHATSAPP DISCOVERY ---*
Registered on WhatsApp: YES
Display Name (pushname): John Doe
Short Name: John
Verified Name: John Doe LLC
About / Status: Hey there! I am using WhatsApp
Profile Picture: https://pps.whatsapp.net/...
WhatsApp Country Code: 1
Formatted Number: +1 (202) 555-1234
Business Account: YES
In Your Contacts: No

*--- BUSINESS PROFILE ---*
Description: Professional consulting services
Email: john@example.com
Website: https://example.com
Address: 123 Main St, New York
Category: Technology

*--- COMMON GROUPS (2) ---*
  - Tech Enthusiasts (45 members)
  - Local Business Network (120 members)

*--- REVERSE IMAGE SEARCH ---*
(Use to identify the person behind the profile picture)
  - Google Lens (reverse): https://lens.google.com/...
  - TinEye: https://tineye.com/...
  - Yandex Images: https://yandex.com/...

*--- OSINT INVESTIGATION LINKS ---*
(Click to investigate further - all free)

*General:*
  - General Search: https://google.com/search?q=...

*Social Media:*
  - Facebook: https://google.com/search?q=...
  - LinkedIn: https://google.com/search?q=...

*Caller ID & Spam Check:*
  - Truecaller: https://truecaller.com/search/...
  - Sync.me: https://sync.me/search/...

*=============================*
*  Report by Als OSINT Bot*
*=============================*
```

## Project Structure

```
src/
  index.js            - Main bot entry, command parsing & message handler
  phoneInfo.js        - Phone number parsing & validation (libphonenumber-js)
  whatsappLookup.js   - WhatsApp API discovery (profile, about, pic, business, groups)
  webSearch.js        - OSINT link generation (dorks, reverse image, people search)
  formatter.js        - Report formatting for WhatsApp message output
  __tests__/          - Unit tests (17 tests)
```

## Running Tests

```bash
npm test
```

## Linting

```bash
npm run lint
```

## How It Works

1. **Phone Parsing**: The input number is parsed using `libphonenumber-js` to extract country, line type, and validate the format.
2. **WhatsApp Discovery**: Using `whatsapp-web.js`, the bot queries WhatsApp's API to check registration, then extracts all available profile data (pushname, about, profile picture, business profile, common groups, verified status).
3. **Reverse Image Search**: If a profile picture is found, reverse image search links are generated for Google Lens, TinEye, and Yandex to help identify the person.
4. **OSINT Links**: Targeted investigation URLs are generated across 25+ free services and search engines for manual deep-dive research.
5. **Report**: All findings are compiled into a formatted report and sent back via WhatsApp.

## Disclaimer

This tool is intended for **educational and legitimate OSINT purposes only**. Always ensure you comply with applicable laws and regulations. The authors are not responsible for any misuse of this tool.

## License

MIT
