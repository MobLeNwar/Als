'use strict';

/**
 * Generate OSINT investigation links for a phone number.
 * All links point to free services - no API keys, no scraping, no paid services.
 * These are presented as clickable references for manual deep-dive.
 *
 * @param {string} phoneNumber - International formatted number
 * @param {object} [options] - Optional parameters
 * @param {string} [options.countryCode] - ISO 2-letter country code (e.g. 'US', 'GB')
 * @param {string} [options.nationalNumber] - National number without country code
 * @returns {object[]} Array of { name, url, category } objects
 */
function generateDorks(phoneNumber, options) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const encoded = encodeURIComponent(phoneNumber);
  const encodedStripped = encodeURIComponent(stripped);
  const countryCode = (options && options.countryCode) ? options.countryCode.toLowerCase() : null;
  const nationalNumber = (options && options.nationalNumber) ? options.nationalNumber : stripped;

  // Build Truecaller URL using ISO country code if available, otherwise use generic search
  const truecallerUrl = countryCode
    ? `https://www.truecaller.com/search/${countryCode}/${nationalNumber}`
    : `https://www.truecaller.com/search?q=${encodedStripped}`;

  return [
    // --- General ---
    {
      name: 'General Search',
      url: `https://www.google.com/search?q=%22${encoded}%22`,
      category: 'general',
    },
    {
      name: 'General (digits only)',
      url: `https://www.google.com/search?q=%22${encodedStripped}%22`,
      category: 'general',
    },

    // --- Social Media ---
    {
      name: 'Facebook',
      url: `https://www.google.com/search?q=%22${encoded}%22+site:facebook.com`,
      category: 'social',
    },
    {
      name: 'Instagram',
      url: `https://www.google.com/search?q=%22${encoded}%22+site:instagram.com`,
      category: 'social',
    },
    {
      name: 'LinkedIn',
      url: `https://www.google.com/search?q=%22${encoded}%22+site:linkedin.com`,
      category: 'social',
    },
    {
      name: 'Twitter/X',
      url: `https://www.google.com/search?q=%22${encoded}%22+site:twitter.com+OR+site:x.com`,
      category: 'social',
    },
    {
      name: 'TikTok',
      url: `https://www.google.com/search?q=%22${encodedStripped}%22+site:tiktok.com`,
      category: 'social',
    },

    // --- Messaging ---
    {
      name: 'WhatsApp Groups',
      url: `https://www.google.com/search?q=%22${encodedStripped}%22+site:chat.whatsapp.com`,
      category: 'messaging',
    },
    {
      name: 'WhatsApp Business (wa.me)',
      url: `https://www.google.com/search?q=site:wa.me+%22${encodedStripped}%22`,
      category: 'messaging',
    },
    {
      name: 'Telegram',
      url: `https://www.google.com/search?q=%22${encodedStripped}%22+site:t.me+OR+site:telegram.org`,
      category: 'messaging',
    },

    // --- Forums ---
    {
      name: 'Reddit',
      url: `https://www.google.com/search?q=%22${encoded}%22+site:reddit.com`,
      category: 'forums',
    },
    {
      name: 'Forums',
      url: `https://www.google.com/search?q=%22${encoded}%22+inurl:forum+OR+inurl:thread+OR+inurl:topic`,
      category: 'forums',
    },

    // --- Classifieds & Directories ---
    {
      name: 'Classifieds',
      url: `https://www.google.com/search?q=%22${encoded}%22+site:olx.com+OR+site:craigslist.org+OR+site:gumtree.com`,
      category: 'classifieds',
    },
    {
      name: 'Business Directories',
      url: `https://www.google.com/search?q=%22${encoded}%22+inurl:directory+OR+inurl:yellowpages+OR+inurl:whitepages`,
      category: 'directories',
    },

    // --- People Search (all free) ---
    {
      name: 'Spokeo',
      url: `https://www.spokeo.com/phone/${stripped}`,
      category: 'people_search',
    },
    {
      name: 'ThatsThem',
      url: `https://thatsthem.com/phone/${stripped}`,
      category: 'people_search',
    },
    {
      name: 'WhitePages',
      url: `https://www.whitepages.com/phone/${stripped}`,
      category: 'people_search',
    },
    {
      name: 'NumLookup',
      url: `https://www.numlookup.com/phone/${stripped}`,
      category: 'people_search',
    },

    // --- Caller ID & Spam (all free) ---
    {
      name: 'Truecaller',
      url: truecallerUrl,
      category: 'caller_id',
    },
    {
      name: 'Sync.me',
      url: `https://sync.me/search/?number=%2B${stripped}`,
      category: 'caller_id',
    },
    {
      name: 'Spam Caller Check',
      url: `https://www.google.com/search?q=%22${encoded}%22+site:whocalledme.com+OR+site:whocallsme.com+OR+site:shouldianswer.com`,
      category: 'caller_id',
    },

    // --- Paste / Breach / Leaks ---
    {
      name: 'Pastebin',
      url: `https://www.google.com/search?q=%22${encodedStripped}%22+site:pastebin.com`,
      category: 'breach',
    },
    {
      name: 'Data Leaks & Breaches',
      url: `https://www.google.com/search?q=%22${encodedStripped}%22+leak+OR+breach+OR+dump+OR+database`,
      category: 'breach',
    },

    // --- Documents & Files ---
    {
      name: 'Documents (PDF/DOC/CSV)',
      url: `https://www.google.com/search?q=%22${encoded}%22+filetype:pdf+OR+filetype:doc+OR+filetype:xlsx+OR+filetype:csv`,
      category: 'documents',
    },

    // --- Age & Identity (all free) ---
    {
      name: 'FastPeopleSearch',
      url: `https://www.fastpeoplesearch.com/phone/${stripped}`,
      category: 'age_identity',
    },
    {
      name: 'USPhoneBook',
      url: `https://www.usphonebook.com/${stripped}`,
      category: 'age_identity',
    },
    {
      name: 'TruePeopleSearch',
      url: `https://www.truepeoplesearch.com/resultphone?phoneno=${stripped}`,
      category: 'age_identity',
    },
    {
      name: 'ZabaSearch',
      url: `https://www.zabasearch.com/phone/${stripped}`,
      category: 'age_identity',
    },
    {
      name: 'Age/DOB Search',
      url: `https://www.google.com/search?q=%22${encoded}%22+%22age%22+OR+%22born%22+OR+%22years+old%22+OR+%22DOB%22`,
      category: 'age_identity',
    },
    {
      name: 'Social Profile Age Search',
      url: `https://www.google.com/search?q=%22${encoded}%22+%22birthday%22+OR+%22born+in%22+site:facebook.com+OR+site:linkedin.com`,
      category: 'age_identity',
    },
    {
      name: 'Public Records Search',
      url: `https://www.google.com/search?q=%22${encodedStripped}%22+%22public+records%22+OR+%22voter+registration%22+OR+%22property+records%22`,
      category: 'age_identity',
    },

    // --- Carrier & VoIP Check (free) ---
    {
      name: 'FreeCarrierLookup',
      url: 'https://freecarrierlookup.com/',
      category: 'carrier',
    },
    {
      name: 'CarrierLookup',
      url: `https://www.carrierlookup.com/index.php/lookup?phonenumber=${stripped}`,
      category: 'carrier',
    },
    {
      name: 'CallerID Test',
      url: 'https://calleridtest.com/',
      category: 'carrier',
    },
  ];
}

/**
 * Generate reverse image search URLs for a WhatsApp profile picture.
 * All free, no API keys.
 * @param {string} imageUrl - URL of the profile picture
 * @returns {object[]} Array of { name, url }
 */
function generateReverseImageSearchLinks(imageUrl) {
  if (!imageUrl) return [];

  const encoded = encodeURIComponent(imageUrl);
  return [
    {
      name: 'Google Lens (reverse)',
      url: `https://lens.google.com/uploadbyurl?url=${encoded}`,
    },
    {
      name: 'TinEye',
      url: `https://tineye.com/search?url=${encoded}`,
    },
    {
      name: 'Yandex Images',
      url: `https://yandex.com/images/search?rpt=imageview&url=${encoded}`,
    },
  ];
}

module.exports = {
  generateDorks,
  generateReverseImageSearchLinks,
};
