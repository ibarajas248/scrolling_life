(() => {
  const root = document.documentElement;
  const touch = matchMedia('(max-width: 1024px), (pointer: coarse)');
  const connection = navigator.connection;
  let constrained = false;
  const apply = () => {
    root.dataset.homeQuality = constrained || touch.matches ? 'light' : 'full';
  };
  const lower = reason => {
    constrained = true;
    root.dataset.homeQualityReason = reason;
    apply();
  };
  // Browser estimates are optional; never download a file just to test bandwidth.
  const checkConnection = () => {
    if (!connection) return;
    if (connection.saveData || ['slow-2g', '2g', '3g'].includes(connection.effectiveType)
        || (connection.downlink > 0 && connection.downlink < 1.5)
        || connection.rtt >= 450) lower('connection');
  };
  checkConnection();
  const navigation = performance.getEntriesByType('navigation')[0];
  // This measures response delay, including server time, not pure network RTT.
  if (navigation && navigation.responseStart - navigation.requestStart > 1200) lower('response-delay');
  if ((navigator.deviceMemory && navigator.deviceMemory <= 2)
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)) lower('device');
  apply();
  touch.addEventListener('change', apply);
  connection?.addEventListener('change', checkConnection);

  document.addEventListener('DOMContentLoaded', () => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('home-offscreen', !entry.isIntersecting));
    });
    document.querySelectorAll('.section, .win98-desktop-container').forEach(node => observer.observe(node));
    const visibility = () => root.classList.toggle('home-background', document.hidden);
    document.addEventListener('visibilitychange', visibility);
    visibility();

    // Two poor three-second windows after startup are required. Quality only
    // decreases during this visit, avoiding flicker from switching back and forth.
    let last = 0, start = 0, frames = 0, slow = 0, poorWindows = 0, visibleMs = 0;
    const sample = now => {
      if (constrained || visibleMs >= 30000) return;
      if (document.hidden || now < 5000) {
        last = start = frames = slow = poorWindows = 0;
      } else {
        if (last) {
          const delta = now - last;
          visibleMs += delta;
          frames++;
          if (delta > 50) slow++;
        }
        last = now;
        if (!start) start = now;
        if (now - start >= 3000) {
          poorWindows = frames && slow / frames > 0.3 ? poorWindows + 1 : 0;
          if (poorWindows >= 2) lower('frame-rate');
          start = now; frames = slow = 0;
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, { once: true });
})();
