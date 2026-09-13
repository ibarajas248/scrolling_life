(() => {
  const container = document.querySelector('[data-scroll-container]');
  const poem = document.querySelector('.pause-poem');
  const meterLabel = document.querySelector('.scroll-meter-label');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let locomotive = null;

  const setProgress = (progress) => {
    const bounded = Math.min(1, Math.max(0, progress));
    const value = Math.round(bounded * 100);
    const percent = `${value}%`;
    document.documentElement.style.setProperty('--pause-progress', percent);
    if (meterLabel) meterLabel.textContent = `${String(value).padStart(3, '0')}%`;
  };

  const buildFragments = () => {
    if (!poem) return [];
    const fragments = poem.textContent.trim().split(/\n\s*\n/);
    poem.textContent = '';

    return fragments.map((text, index) => {
      const fragment = document.createElement('section');
      fragment.className = 'poem-fragment';
      const signalMatch = text.match(/^([.\u2026]+)(\s+)(.+)$/s);
      if (signalMatch) {
        const signal = document.createElement('span');
        signal.className = 'poem-signal';
        signal.textContent = signalMatch[1];
        fragment.append(signal, document.createTextNode(`${signalMatch[2]}${signalMatch[3]}`));
      } else {
        fragment.textContent = text;
      }
      fragment.dataset.scroll = '';
      fragment.dataset.scrollClass = 'is-inview';
      fragment.dataset.scrollRepeat = 'true';
      fragment.dataset.scrollSpeed = String([0.08, -0.06, 0.12, -0.04][index % 4]);
      if (index <= 14) fragment.classList.add('is-counter');
      if (index >= 15 && index <= 21) fragment.classList.add('is-opening-copy');
      if (text.includes('¿')) fragment.classList.add('is-question');
      if (text.length <= 18) fragment.classList.add('is-brief');
      poem.appendChild(fragment);
      return fragment;
    });
  };

  const fragments = buildFragments();

  const startNative = () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-inview', entry.isIntersecting));
    }, { rootMargin: '-16% 0px -16%', threshold: 0.08 });
    fragments.forEach((fragment) => observer.observe(fragment));

    const update = () => {
      const limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setProgress(window.scrollY / limit);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  };

  const start = () => {
    if (!container || reducedMotion.matches || !window.LocomotiveScroll) {
      startNative();
      return;
    }

    locomotive = new window.LocomotiveScroll({
      el: container,
      smooth: true,
      lerp: 0.075,
      multiplier: 0.82,
      getDirection: true,
      smartphone: { smooth: false },
      tablet: { smooth: false }
    });

    locomotive.on('scroll', (state) => {
      const limit = Math.max(1, state.limit?.y || 1);
      setProgress((state.scroll?.y || 0) / limit);
    });

    window.pauseLocomotive = locomotive;
    window.setTimeout(() => locomotive?.update(), 250);
  };

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
