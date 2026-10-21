/* Temporary home popup for Museo de la Censura. */
(() => {
  const MUSEO_URL = 'https://museodelacensura.art/';
  const SESSION_KEY = 'scrolling-life:museo-censura-opened';
  let openingSucceeded = false;

  const wasOpenedThisSession = () => {
    try {
      return window.sessionStorage.getItem(SESSION_KEY) === 'true';
    } catch {
      return false;
    }
  };

  const markAsOpened = () => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, 'true');
    } catch {
      // The fallback link remains available if sessionStorage is unavailable.
    }
  };

  const openMuseum = () => {
    if (openingSucceeded || wasOpenedThisSession()) return true;

    const museumWindow = window.open(MUSEO_URL, '_blank', 'noopener,noreferrer');
    if (!museumWindow || museumWindow.closed) return false;

    openingSucceeded = true;
    markAsOpened();
    return true;
  };

  const init = () => {
    openMuseum();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
