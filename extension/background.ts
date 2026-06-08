import { generateTOTP } from './utils/totp';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_TOTP') {
    const domain = message.domain;
    
    // Fetch the secret for the domain
    chrome.storage.local.get("vault", (data) => {
      const vault = data.vault || {};
      const searchDomain = domain.toLowerCase();
      
      // Try exact match first
      let entry = vault[domain];
      
      // If no exact match, try partial/case-insensitive match
      if (!entry) {
          const matchKey = Object.keys(vault).find(key => {
              const k = key.toLowerCase();
              return searchDomain.includes(k) || k.includes(searchDomain);
          });
          if (matchKey) {
              entry = vault[matchKey];
          }
      }

      if (entry && entry.secret) {
        try {
          const totpCode = generateTOTP(entry.secret);
          sendResponse({ success: true, code: totpCode });
        } catch (error) {
          console.error("Error generating TOTP:", error);
          sendResponse({ success: false, error: "Failed to generate TOTP" });
        }
      } else {
        sendResponse({ success: false, error: "No secret found for domain" });
      }
    });

    // Return true to indicate asynchronous response
    return true;
  }
});
