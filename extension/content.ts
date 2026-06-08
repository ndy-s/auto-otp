let hasAutofilled = false;

function findTOTPInput(): HTMLInputElement | null {
  const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"])'));
  
  for (const input of inputs) {
    const el = input as HTMLInputElement;
    const name = el.name.toLowerCase();
    const id = el.id.toLowerCase();
    const autocomplete = el.autocomplete.toLowerCase();
    const placeholder = el.placeholder.toLowerCase();

    // High confidence matches
    if (
      autocomplete === 'one-time-code' ||
      name.includes('totp') || id.includes('totp') ||
      name.includes('otp') || id.includes('otp') ||
      name.includes('authcode') || id.includes('authcode') ||
      name.includes('authenticator') || id.includes('authenticator')
    ) {
      return el;
    }
    
    // Medium confidence matches
    if (name === 'code' || id === 'code' || placeholder.includes('auth')) {
      const url = window.location.href.toLowerCase();
      if (url.includes('login') || url.includes('auth') || url.includes('verify') || url.includes('session') || url.includes('mfa') || url.includes('2fa')) {
         return el;
      }
    }
  }

  return null;
}

function fillTOTP() {
  if (hasAutofilled) return;

  const input = findTOTPInput();
  if (!input || input.value.length > 0) return;

  // For domain matching, remove www. and use the base hostname
  const domain = window.location.hostname.replace(/^www\./, '');

  chrome.runtime.sendMessage({ action: 'GET_TOTP', domain }, (response) => {
    if (chrome.runtime.lastError) {
      // Suppress error when disconnected
      return;
    }

    if (response && response.success && response.code) {
      input.value = response.code;
      hasAutofilled = true;
      
      // Dispatch events to notify frameworks (React, Vue, etc.)
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

// Check on initial load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', fillTOTP);
} else {
  fillTOTP();
}

// Observe mutations for SPAs (Single Page Applications)
const observer = new MutationObserver(() => {
  if (!hasAutofilled) {
    fillTOTP();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
