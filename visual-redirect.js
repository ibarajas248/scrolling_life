(() => {
  const visualUrl = 'https://radio.scrollinglife.com/visuales';
  let frame = null;
  const showVisuals = () => {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.src = visualUrl;
    frame.title = 'Visuales en vivo';
    frame.allow = 'autoplay; fullscreen';
    Object.assign(frame.style, {
      position: 'fixed', inset: '0', width: '100vw', height: '100vh',
      border: '0', zIndex: '2147483647', background: '#000'
    });
    document.body.append(frame);
  };
  const hideVisuals = () => { frame?.remove(); frame = null; };
  const poll = async () => {
    try {
      const response = await fetch('/api/visual-redirect', { cache: 'no-store' });
      const payload = await response.json();
      if (payload?.state?.siteRedirectEnabled) showVisuals();
      else hideVisuals();
    } catch {
      // Keep the current page during a short network interruption.
    }
  };
  poll();
  setInterval(poll, 2000);
})();
