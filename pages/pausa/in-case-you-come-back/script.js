(() => {
  const container = document.querySelector('[data-scroll-container]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hudState = document.querySelector('[data-scroll-state]');
  const hudProgressTexts = document.querySelectorAll('[data-scroll-progress-text]');
  const hudProgressFill = document.querySelector('[data-scroll-progress-fill]');
  const hudDirection = document.querySelector('[data-scroll-direction]');
  let locomotive = null;

  const setHud = ({ progress = 0, direction = 'down', active = false } = {}) => {
    const percent = `${String(Math.round(progress * 100)).padStart(3, '0')}%`;
    document.documentElement.style.setProperty('--scroll-progress', percent);

    hudProgressTexts.forEach((node) => {
      node.textContent = percent;
    });

    if (hudProgressFill) {
      hudProgressFill.style.width = percent;
    }

    if (hudDirection) {
      hudDirection.textContent = direction === 'up' ? 'up' : 'down';
    }

    if (hudState) {
      hudState.textContent = active ? 'locomotive on' : 'native scroll';
    }
  };

  const updateNativeHud = () => {
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
    setHud({ progress, direction: 'down', active: false });
  };

  const updateTicker = () => {
    document.querySelectorAll('.ticker span').forEach((ticker) => {
      const copy = ticker.textContent.trim();
      ticker.textContent = `${copy} ${copy}`;
    });
  };

  const startScroll = () => {
    if (!container || prefersReducedMotion.matches || !window.LocomotiveScroll) {
      document.body.classList.add('native-scroll');
      updateNativeHud();
      window.addEventListener('scroll', updateNativeHud, { passive: true });
      return;
    }

    locomotive = new window.LocomotiveScroll({
      el: container,
      smooth: true,
      lerp: 0.075,
      multiplier: 0.82,
      tablet: { smooth: true, breakpoint: 1024 },
      smartphone: { smooth: true },
      getDirection: true
    });

    document.body.classList.add('smooth-scroll-ready');
    window.inCaseYouComeBackLocomotive = locomotive;

    locomotive.on('scroll', (args) => {
      const max = Math.max(1, args.limit?.y || 1);
      const progress = Math.min(1, Math.max(0, (args.scroll?.y || 0) / max));
      setHud({ progress, direction: args.direction || 'down', active: true });
    });

    setHud({ progress: 0, direction: 'down', active: true });
    window.setTimeout(() => locomotive?.update(), 400);
  };

  const refreshScroll = () => {
    window.setTimeout(() => locomotive?.update(), 120);
  };

  updateTicker();

  if (document.readyState === 'complete') {
    startScroll();
  } else {
    window.addEventListener('load', startScroll, { once: true });
  }

  window.addEventListener('resize', refreshScroll, { passive: true });
})();
