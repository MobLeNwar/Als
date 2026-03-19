'use strict';

/**
 * Generate OSINT investigation links for a phone number.
 * All links point to free services - no API keys, no scraping, no paid services.
 * These are presented as clickable references for manual deep-dive.
 *
 * @param {string} phoneNumber - International formatted number
 * @returns {object[]} Array of { name, url, category } objects
 */
function generateDorks(phoneNumber) {
  const stripped = phoneNumber.replace(/\D/g, '');
  const encoded = encodeURIComponent(phoneNumber);
  const encodedStripped = encodeURIComponent(stripped);

  return [
    // --- General ---
    {
      name: 'General Search',
      url: `https://www.google.com/search?q="${encoded}"`,
      category: 'general',
    },
    {
      name: 'General (digits only)',
      url: `https://www.google.com/search?q="${encodedStripped}"`,
      category: 'general',
    },

    // --- Social Media ---
    {
      name: 'Facebook',
      url: `https://www.google.com/search?q="${encoded}"+site:facebook.com`,
      category: 'social',
    },
    {
      name: 'Instagram',
      url: `https://www.google.com/search?q="${encoded}"+site:instagram.com`,
      category: 'social',
    },
    {
      name: 'LinkedIn',
      url: `https://www.google.com/search?q="${encoded}"+site:linkedin.com`,
      category: 'social',
    },
    {
      name: 'Twitter/X',
      url: `https://www.google.com/search?q="${encoded}"+site:twitter.com+OR+site:x.com`,
      category: 'social',
    },
    {
      name: 'TikTok',
      url: `https://www.google.com/search?q="${encodedStripped}"+site:tiktok.com`,
      category: 'social',
    },

    // --- Messaging ---
    {
      name: 'WhatsApp Groups',
      url: `https://www.google.com/search?q="${encodedStripped}"+site:chat.whatsapp.com`,
      category: 'messaging',
    },
    {
      name: 'WhatsApp Business (wa.me)',
      url: `https://www.google.com/search?q=site:wa.me+"${encodedStripped}"`,
      category: 'messaging',
    },
    {
      name: 'Telegram',
      url: `https://www.google.com/search?q="${encodedStripped}"+site:t.me+OR+site:telegram.org`,
      category: 'messaging',
    },

    // --- Forums ---
    {
      name: 'Reddit',
      url: `https://www.google.com/search?q="${encoded}"+site:reddit.com`,
      category: 'forums',
    },
    {
      name: 'Forums',
      url: `https://www.google.com/search?q="${encoded}"+inurl:forum+OR+inurl:thread+OR+inurl:topic`,
      category: 'forums',
    },

    // --- Classifieds & Directories ---
    {
      name: 'Classifieds',
      url: `https://www.google.com/search?q="${encoded}"+site:olx.com+OR+site:craigslist.org+OR+site:gumtree.com`,
      category: 'classifieds',
    },
    {
      name: 'Business Directories',
      url: `https://www.google.com/search?q="${encoded}"+inurl:directory+OR+inurl:yellowpages+OR+inurl:whitepages`,
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
      url: `https://www.truecaller.com/search/${stripped.slice(0, 2)}/${stripped.slice(2)}`,
      category: 'caller_id',
    },
    {
      name: 'Sync.me',
      url: `https://sync.me/search/?number=%2B${stripped}`,
      category: 'caller_id',
    },
    {
      name: 'Spam Caller Check',
      url: `https://www.google.com/search?q="${encoded}"+site:whocalledme.com+OR+site:whocallsme.com+OR+site:shouldianswer.com`,
      category: 'caller_id',
    },

    // --- Paste / Breach / Leaks ---
    {
      name: 'Pastebin',
      url: `https://www.google.com/search?q="${encodedStripped}"+site:pastebin.com`,
      category: 'breach',
    },
    {
      name: 'Data Leaks & Breaches',
      url: `https://www.google.com/search?q="${encodedStripped}"+leak+OR+breach+OR+dump+OR+database`,
      category: 'breach',
    },

    // --- Documents & Files ---
    {
      name: 'Documents (PDF/DOC/CSV)',
      url: `https://www.google.com/search?q="${encoded}"+filetype:pdf+OR+filetype:doc+OR+filetype:xlsx+OR+filetype:csv`,
      category: 'documents',
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
