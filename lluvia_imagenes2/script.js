(() => {
  const CACHE_MANIFEST = '../assets/images/netart-cache/manifest.json';
  const FALLBACK_IMAGES = [
    '../assets/images/scroll-strips/strip_000001.jpg',
    '../assets/images/scroll-strips/strip_000002.jpg',
    '../assets/images/scroll-strips/strip_000003.jpg',
    '../assets/images/scroll-strips/strip_000004.jpg'
  ];
  const MAX_ACTIVE_DROPS = 92;
  const PRELOAD_COUNT = 42;
  const BASE_INTERVAL_MS = 118;
  const BURST_INTERVAL_MS = 1100;

  const rainField = document.getElementById('rainField');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!rainField) return;

  let images = [...FALLBACK_IMAGES];
  let cursor = 0;
  let lastBurst = performance.now();
  let isPaused = document.hidden;
  let nextTimer = null;

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const shuffle = (items) => {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
  };

  const normalizeImagePath = (src) => {
    if (typeof src !== 'string' || !src.trim()) return null;
    const clean = src.trim();

    if (clean.startsWith('./assets/')) return `../${clean.slice(2)}`;
    if (clean.startsWith('assets/')) return `../${clean}`;
    if (clean.startsWith('../') || clean.startsWith('http')) return clean;
    return clean;
  };

  const loadLocalImages = async () => {
    try {
      const response = await fetch(`${CACHE_MANIFEST}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return null;

      const manifest = await response.json();
      const localImages = Array.isArray(manifest.images)
        ? manifest.images.map(normalizeImagePath).filter(Boolean)
        : [];

      return localImages.length ? shuffle(localImages) : null;
    } catch (error) {
      console.warn('No se pudo leer el cache local de imagenes.', error);
      return null;
    }
  };

  const preloadSomeImages = () => {
    images.slice(0, PRELOAD_COUNT).forEach((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
    });
  };

  const nextImage = () => {
    if (!images.length) return FALLBACK_IMAGES[0];

    const src = images[cursor % images.length];
    cursor += 1;

    if (cursor % images.length === 0) {
      images = shuffle(images);
      cursor = 0;
    }

    return src;
  };

  const trimDrops = () => {
    while (rainField.children.length > MAX_ACTIVE_DROPS) {
      rainField.firstElementChild?.remove();
    }
  };

  const spawnDrop = (mode = 'normal') => {
    const drop = document.createElement('img');
    const near = mode === 'burst' || Math.random() > 0.72;
    const far = !near && Math.random() > 0.58;
    const depth = near ? 'near' : far ? 'far' : 'mid';
    const baseSize = near ? randomBetween(130, 260) : far ? randomBetween(58, 128) : randomBetween(88, 190);
    const ratio = randomBetween(0.72, 1.32);
    const duration = near ? randomBetween(3600, 6200) : far ? randomBetween(8200, 13200) : randomBetween(5200, 9200);
    const x = randomBetween(-10, 106);
    const drift = randomBetween(-22, 22);
    const curve = randomBetween(-9, 9);
    const opacity = near ? randomBetween(0.5, 0.82) : far ? randomBetween(0.18, 0.38) : randomBetween(0.32, 0.62);

    drop.className = 'rain-image';
    drop.dataset.depth = depth;
    drop.src = nextImage();
    drop.alt = '';
    drop.decoding = 'async';
    drop.loading = 'eager';
    drop.draggable = false;
    drop.style.setProperty('--w', `${baseSize.toFixed(0)}px`);
    drop.style.setProperty('--h', `${(baseSize * ratio).toFixed(0)}px`);
    drop.style.setProperty('--x-start', `${x.toFixed(2)}vw`);
    drop.style.setProperty('--drift', `${drift.toFixed(2)}vw`);
    drop.style.setProperty('--curve', `${curve.toFixed(2)}vw`);
    drop.style.setProperty('--duration', `${duration.toFixed(0)}ms`);
    drop.style.setProperty('--opacity', opacity.toFixed(3));
    drop.style.setProperty('--r-start', `${randomBetween(-18, 18).toFixed(2)}deg`);
    drop.style.setProperty('--r-mid', `${randomBetween(-8, 8).toFixed(2)}deg`);
    drop.style.setProperty('--spin', `${randomBetween(-130, 130).toFixed(2)}deg`);
    drop.style.setProperty('--rx', `${randomBetween(-12, 15).toFixed(2)}deg`);
    drop.style.setProperty('--rx-end', `${randomBetween(-16, 10).toFixed(2)}deg`);
    drop.style.setProperty('--skew-start', `${randomBetween(-4, 4).toFixed(2)}deg`);
    drop.style.setProperty('--skew-end', `${randomBetween(-6, 6).toFixed(2)}deg`);
    drop.style.setProperty('--scale-start', `${randomBetween(0.78, 0.96).toFixed(3)}`);
    drop.style.setProperty('--scale-mid', `${randomBetween(0.9, 1.08).toFixed(3)}`);
    drop.style.setProperty('--scale-end', `${randomBetween(0.98, 1.18).toFixed(3)}`);
    drop.style.setProperty('--z', `${far ? -160 : near ? 90 : -20}px`);
    drop.style.setProperty('--z-mid', `${far ? -80 : near ? 120 : 30}px`);
    drop.style.setProperty('--z-end', `${far ? -40 : near ? 180 : 90}px`);
    drop.style.setProperty('--gray', `${near ? randomBetween(0.42, 0.82) : randomBetween(0.78, 1).toFixed(2)}`);
    drop.style.setProperty('--sat', `${near ? randomBetween(1.02, 1.28) : randomBetween(0.78, 1.08).toFixed(2)}`);
    drop.style.setProperty('--contrast', `${randomBetween(1.04, 1.24).toFixed(2)}`);
    drop.style.setProperty('--brightness', `${near ? randomBetween(0.86, 1.02) : randomBetween(0.58, 0.84).toFixed(2)}`);
    drop.style.setProperty('--blur', `${far ? randomBetween(0.3, 1.4).toFixed(2) : randomBetween(0, 0.4).toFixed(2)}px`);

    rainField.append(drop);
    trimDrops();

    window.setTimeout(() => {
      drop.remove();
    }, duration + 600);
  };

  const scheduleRain = () => {
    window.clearTimeout(nextTimer);

    if (!isPaused) {
      spawnDrop();

      const now = performance.now();
      if (now - lastBurst > BURST_INTERVAL_MS) {
        lastBurst = now;
        const burstCount = prefersReducedMotion.matches ? 1 : Math.floor(randomBetween(2, 5));
        for (let index = 0; index < burstCount; index += 1) {
          window.setTimeout(() => spawnDrop('burst'), index * 48);
        }
      }
    }

    const delay = prefersReducedMotion.matches ? 420 : BASE_INTERVAL_MS + randomBetween(-34, 58);
    nextTimer = window.setTimeout(scheduleRain, delay);
  };

  document.addEventListener('visibilitychange', () => {
    isPaused = document.hidden;
  });

  window.addEventListener('pagehide', () => {
    window.clearTimeout(nextTimer);
  });

  window.addEventListener('pointerdown', () => {
    if (isPaused) return;
    for (let index = 0; index < 8; index += 1) {
      window.setTimeout(() => spawnDrop('burst'), index * 34);
    }
  }, { passive: true });

  loadLocalImages().then((localImages) => {
    if (localImages) {
      images = localImages;
    }

    preloadSomeImages();

    const initialBurst = prefersReducedMotion.matches ? 8 : 34;
    for (let index = 0; index < initialBurst; index += 1) {
      window.setTimeout(() => spawnDrop(index < 12 ? 'burst' : 'normal'), index * 44);
    }

    scheduleRain();
  });
})();
