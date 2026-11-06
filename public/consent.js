const consentKey = 'hypeberries-analytics-consent';
const containerId = 'GTM-PQG78SH4';
const banner = document.querySelector('[data-consent-banner]');
const acceptButton = document.querySelector('[data-consent-accept]');
const declineButton = document.querySelector('[data-consent-decline]');

function loadAnalytics() {
  if (window.hypeberriesAnalyticsLoaded) return;
  window.hypeberriesAnalyticsLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
  document.head.append(script);
}

function readConsent() {
  try {
    return localStorage.getItem(consentKey);
  } catch {
    return null;
  }
}

function saveConsent(value) {
  try {
    localStorage.setItem(consentKey, value);
  } catch {
    // Analytics remains off if the preference cannot be stored.
  }
}

function showBanner() {
  if (banner) banner.hidden = false;
}

function hideBanner() {
  if (banner) banner.hidden = true;
}

function setConsent(value) {
  saveConsent(value);
  hideBanner();
  if (value === 'accepted') loadAnalytics();
}

const storedConsent = readConsent();
if (storedConsent === 'accepted') {
  loadAnalytics();
} else if (storedConsent !== 'declined') {
  showBanner();
}

acceptButton?.addEventListener('click', () => setConsent('accepted'));
declineButton?.addEventListener('click', () => setConsent('declined'));
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-consent]')) showBanner();
});
