(() => {
  const storageKey = 'hypeberries-color-theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function readTheme() {
    try {
      const theme = localStorage.getItem(storageKey);
      return theme === 'light' || theme === 'dark' ? theme : null;
    } catch {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // The selected theme still applies for this page view.
    }
  }

  function updateButtons() {
    const isDark = root.dataset.theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      button.setAttribute('aria-pressed', String(isDark));
      button.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
      button.setAttribute('title', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    });
  }

  function applyTheme(theme, persist = false) {
    root.dataset.theme = theme;
    if (persist) saveTheme(theme);
    updateButtons();
  }

  applyTheme(readTheme() ?? (media.matches ? 'dark' : 'light'));

  document.addEventListener('DOMContentLoaded', updateButtons);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
  media.addEventListener('change', (event) => {
    if (!readTheme()) applyTheme(event.matches ? 'dark' : 'light');
  });
})();
