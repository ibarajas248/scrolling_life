(() => {
  const body = document.body;
  const heroGifs = document.querySelector('[data-hero-gifs]');
  const gifSwarm = document.querySelector('[data-gif-swarm]');
  const gifStrips = [...document.querySelectorAll('[data-gif-strip]')];
  const remixButton = document.querySelector('[data-remix]');
  const pauseButton = document.querySelector('[data-pause]');
  const counter = document.querySelector('[data-counter]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gifAssets = [
    'heart.gif',
    'star.gif',
    'computer.gif',
    'floppy.gif',
    'cursor.gif',
    'planet.gif',
    'flame.gif',
    'portal.gif',
    'book.gif',
    'cassette.gif',
    'envelope.gif',
    'gem.gif',
    'crown.gif',
    'construction.gif',
    'new-badge.gif',
    'sparkle-line.gif',
    'smile.gif',
    'lightning.gif',
    'flower.gif',
  ];

  const pad = (value) => String(value).padStart(6, '0').slice(-6);

  const setCounter = () => {
    if (!counter) return;
    const key = 'scrolling_life_mundo_gif_visits';
    let value = Number(window.localStorage.getItem(key) || '0');
    value = Number.isFinite(value) ? value + 1 : 1;
    window.localStorage.setItem(key, String(value));
    counter.textContent = pad(170 + value);
  };

  const randomBetween = (min, max) => Math.round(min + Math.random() * (max - min));
  const randomFloat = (min, max) => min + Math.random() * (max - min);
  const assetSrc = (index) => `./assets/${gifAssets[index % gifAssets.length]}`;

  const makeGif = (className, index) => {
    const img = document.createElement('img');
    img.className = className;
    img.src = assetSrc(index);
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager';
    img.setAttribute('aria-hidden', 'true');
    return img;
  };

  const fillCloud = (container, count, className, options) => {
    if (!container) return 0;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const img = makeGif(className, i + options.offset);
      img.style.setProperty('--x', `${randomFloat(options.minX, options.maxX).toFixed(2)}%`);
      img.style.setProperty('--y', `${randomFloat(options.minY, options.maxY).toFixed(2)}%`);
      img.style.setProperty('--size', `${randomBetween(options.minSize, options.maxSize)}px`);
      img.style.setProperty('--time', `${randomFloat(1.2, 4.8).toFixed(2)}s`);
      img.style.setProperty('--delay', `${randomFloat(-5, 0).toFixed(2)}s`);
      img.style.setProperty('--rx', `${randomBetween(-18, 18)}px`);
      img.style.setProperty('--ry', `${randomBetween(-18, 18)}px`);
      img.style.setProperty('--rot', `${randomBetween(-12, 12)}deg`);
      fragment.appendChild(img);
    }
    container.appendChild(fragment);
    return count;
  };

  const fillStrips = () => {
    let count = 0;
    const perStrip = window.innerWidth < 760 ? 24 : 44;
    gifStrips.forEach((strip, stripIndex) => {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < perStrip; i += 1) {
        const img = makeGif('strip-gif', i + stripIndex * 7);
        img.style.setProperty('--size', `${randomBetween(34, 78)}px`);
        img.style.setProperty('--time', `${randomFloat(0.85, 2.4).toFixed(2)}s`);
        img.style.setProperty('--delay', `${randomFloat(-3, 0).toFixed(2)}s`);
        fragment.appendChild(img);
      }
      strip.appendChild(fragment);
      count += perStrip;
    });
    return count;
  };

  const buildGifExplosion = () => {
    const compact = window.innerWidth < 760;
    const total =
      fillCloud(heroGifs, compact ? 42 : 72, 'hero-gif', {
        offset: 3,
        minX: -4,
        maxX: 96,
        minY: -4,
        maxY: 92,
        minSize: compact ? 32 : 42,
        maxSize: compact ? 82 : 118,
      }) +
      fillCloud(gifSwarm, compact ? 96 : 164, 'swarm-gif', {
        offset: 11,
        minX: 0,
        maxX: 95,
        minY: 0,
        maxY: 96,
        minSize: compact ? 28 : 34,
        maxSize: compact ? 94 : 132,
      }) +
      fillStrips();

    document.documentElement.dataset.gifCount = String(total + document.querySelectorAll('.sprite').length);
  };

  const animatedGifs = () => [...document.querySelectorAll('.sprite, .swarm-gif, .hero-gif, .strip-gif')];

  const remix = () => {
    animatedGifs().forEach((sprite) => {
      sprite.style.setProperty('--rx', `${randomBetween(-36, 36)}px`);
      sprite.style.setProperty('--ry', `${randomBetween(-32, 32)}px`);
      sprite.style.setProperty('--rot', `${randomBetween(-10, 10)}deg`);
      sprite.style.animationDelay = `${Math.random() * -3}s`;
    });
  };

  const togglePause = () => {
    const paused = body.classList.toggle('motion-paused');
    if (pauseButton) {
      pauseButton.textContent = paused ? 'mover' : 'pausar';
      pauseButton.setAttribute('aria-pressed', String(paused));
    }
  };

  let lastTrail = 0;
  const colors = ['#9cff38', '#ff44b7', '#34f7ff', '#ffe450'];

  const addTrail = (event) => {
    if (prefersReducedMotion.matches || body.classList.contains('motion-paused')) return;
    const now = Date.now();
    if (now - lastTrail < 90) return;
    lastTrail = now;

    const dot = document.createElement('span');
    dot.className = 'pixel-trail';
    dot.style.left = `${event.clientX}px`;
    dot.style.top = `${event.clientY}px`;
    dot.style.background = colors[randomBetween(0, colors.length - 1)];
    document.body.appendChild(dot);
    window.setTimeout(() => dot.remove(), 800);
  };

  setCounter();
  buildGifExplosion();
  remix();

  remixButton?.addEventListener('click', remix);
  pauseButton?.addEventListener('click', togglePause);
  window.addEventListener('pointermove', addTrail, { passive: true });
})();
