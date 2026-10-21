/* Temporary home popup for Museo de la Censura. */
(() => {
  const MUSEO_URL = 'https://museodelacensura.art/';
  const SESSION_KEY = 'scrolling-life:museo-censura-opened';
  const FALLBACK_ID = 'museo-censura-popup-fallback';

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
    if (wasOpenedThisSession()) return true;

    const museumWindow = window.open(MUSEO_URL, '_blank', 'noopener,noreferrer');
    if (!museumWindow || museumWindow.closed) return false;

    markAsOpened();
    return true;
  };

  const removeFallback = (fallback) => {
    fallback?.remove();
  };

  const showFallback = () => {
    if (document.getElementById(FALLBACK_ID)) return;

    const fallback = document.createElement('aside');
    fallback.id = FALLBACK_ID;
    fallback.className = 'museo-censura-popup-fallback';
    fallback.setAttribute('role', 'status');
    fallback.innerHTML = `
      <button class="museo-censura-popup-fallback__close" type="button" aria-label="Cerrar aviso">×</button>
      <p class="museo-censura-popup-fallback__title">MUSEO DE LA CENSURA</p>
      <p class="museo-censura-popup-fallback__copy">El navegador bloqueó la ventana emergente.</p>
      <a class="museo-censura-popup-fallback__link" href="${MUSEO_URL}" target="_blank" rel="noopener noreferrer">
        Abrir museo ↗
      </a>
    `;

    fallback.querySelector('.museo-censura-popup-fallback__close')
      .addEventListener('click', () => removeFallback(fallback));

    fallback.querySelector('.museo-censura-popup-fallback__link')
      .addEventListener('click', markAsOpened, { once: true });

    document.body.append(fallback);
  };

  const init = () => {
    if (!openMuseum()) showFallback();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
