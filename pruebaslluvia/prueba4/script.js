(() => {
  const DATASET_MANIFEST = '../../datasets/people_80s_style_compressed/manifest.json';
  const DATASET_BASE = '../../datasets/people_80s_style_compressed/';
  const CACHE_MANIFEST = '../../assets/images/netart-cache/manifest.json';
  const FALLBACK_IMAGES = [
    '../../assets/images/archive-sides/paper-strips-installation.png',
    '../../assets/images/archive-sides/dense-text-column.png',
    '../../assets/images/archive-sides/vertical-contact-strips.png',
    '../../assets/images/archive-sides/sepia-contact-sheet.png',
    '../../assets/images/archive-sides/folded-paper-floor.png'
  ];

  const fallLayer = document.getElementById('fallLayer');
  const sedimentLayer = document.getElementById('sedimentLayer');
  if (!fallLayer || !sedimentLayer) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MAX_SEDIMENT = window.innerWidth < 720 ? 360 : 760;
  const SPAWN_MIN = prefersReducedMotion.matches ? 1650 : 720;
  const SPAWN_MAX = prefersReducedMotion.matches ? 2600 : 1420;
  const FALL_MIN = prefersReducedMotion.matches ? 15000 : 7600;
  const FALL_MAX = prefersReducedMotion.matches ? 26000 : 16800;
  const COLUMN_WIDTH = window.innerWidth < 720 ? 92 : 128;
  const PRELOAD_COUNT = window.innerWidth < 720 ? 16 : 32;

  let images = [...FALLBACK_IMAGES];
  let imageCursor = 0;
  let spawnTimer = null;
  let sedimentCount = 0;
  let resizeTimer = null;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;

  const randomBetween = (min, max) => min + Math.random() * (max - min);
  const randomInt = (min, max) => Math.floor(randomBetween(min, max + 1));

  const shuffle = (items) => {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled;
  };

  const encodePathSegment = (segment) => encodeURIComponent(segment).replace(/%2F/gi, '/');

  const datasetImagePath = (entry) => {
    const file = typeof entry === 'string' ? entry : entry?.file;
    if (typeof file !== 'string' || !file.trim()) return null;

    return `${DATASET_BASE}${encodePathSegment(file.trim())}`;
  };

  const normalizeImagePath = (src) => {
    if (typeof src !== 'string' || !src.trim()) return null;
    const clean = src.trim();

    if (clean.startsWith('./assets/')) return `../../${clean.slice(2)}`;
    if (clean.startsWith('assets/')) return `../../${clean}`;
    if (clean.startsWith('../../') || clean.startsWith('http')) return clean;
    return clean;
  };

  const loadDatasetImages = async () => {
    try {
      const response = await fetch(DATASET_MANIFEST, { cache: 'force-cache' });
      if (!response.ok) return null;

      const manifest = await response.json();
      const datasetImages = Array.isArray(manifest)
        ? manifest.map(datasetImagePath).filter(Boolean)
        : [];

      return datasetImages.length ? shuffle(datasetImages) : null;
    } catch (error) {
      console.warn('No se pudo leer el dataset comprimido para prueba4.', error);
      return null;
    }
  };

  const loadImages = async () => {
    const datasetImages = await loadDatasetImages();
    if (datasetImages) return datasetImages;

    try {
      const response = await fetch(CACHE_MANIFEST, { cache: 'force-cache' });
      if (!response.ok) return shuffle(FALLBACK_IMAGES);

      const manifest = await response.json();
      const localImages = Array.isArray(manifest.images)
        ? manifest.images.map(normalizeImagePath).filter(Boolean)
        : [];

      return localImages.length ? shuffle(localImages) : shuffle(FALLBACK_IMAGES);
    } catch (error) {
      console.warn('No se pudo leer el cache local para prueba4.', error);
      return shuffle(FALLBACK_IMAGES);
    }
  };

  const preloadImages = () => {
    images.slice(0, PRELOAD_COUNT).forEach((src) => {
      const image = new Image();
      image.decoding = 'async';
      image.src = src;
    });
  };

  const nextImage = () => {
    const src = images[imageCursor % images.length] || FALLBACK_IMAGES[0];
    imageCursor += 1;

    if (imageCursor % images.length === 0) {
      images = shuffle(images);
      imageCursor = 0;
    }

    return src;
  };

  const columnHeight = (x) => {
    const columnLeft = x - COLUMN_WIDTH * 0.45;
    const columnRight = x + COLUMN_WIDTH * 0.45;
    let height = 0;

    sedimentLayer.querySelectorAll('.sediment-shard').forEach((node) => {
      const nodeX = Number.parseFloat(node.dataset.x || '0');
      const nodeBottom = Number.parseFloat(node.dataset.bottom || '0');
      const nodeHeight = Number.parseFloat(node.dataset.mass || '0');

      if (nodeX >= columnLeft && nodeX <= columnRight) {
        height = Math.max(height, nodeBottom + nodeHeight * 0.44);
      }
    });

    return Math.min(height, viewportHeight * 0.72);
  };

  const pruneSediment = () => {
    const overflow = sedimentLayer.children.length - MAX_SEDIMENT;
    if (overflow <= 0) return;

    Array.from(sedimentLayer.children).slice(0, overflow).forEach((node) => {
      const currentOpacity = Number.parseFloat(node.style.getPropertyValue('--opacity') || '0.5');
      node.style.setProperty('--opacity', Math.max(0.12, currentOpacity * 0.72).toFixed(2));
      node.style.filter = 'grayscale(1) contrast(1.5) brightness(0.48) saturate(0.46)';

      if (sedimentLayer.children.length > MAX_SEDIMENT + 80) {
        node.remove();
      }
    });
  };

  const makeImage = (src, eager = false) => {
    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    image.decoding = 'async';
    image.loading = eager ? 'eager' : 'lazy';
    image.draggable = false;
    return image;
  };

  const addSediment = ({ src, x, width, height, tilt, drift }) => {
    const shard = document.createElement('span');
    const compressedHeight = Math.max(18, Math.round(height * randomBetween(0.09, 0.18)));
    const baseHeight = columnHeight(x + drift);
    const bottom = Math.max(0, baseHeight + randomBetween(-8, 18));
    const depth = Math.min(1, sedimentCount / MAX_SEDIMENT);

    shard.className = 'sediment-shard';
    shard.dataset.x = String(x + drift);
    shard.dataset.bottom = String(bottom);
    shard.dataset.mass = String(compressedHeight);
    shard.style.setProperty('--x', `${x.toFixed(1)}px`);
    shard.style.setProperty('--w', `${(width * randomBetween(1.04, 1.38)).toFixed(1)}px`);
    shard.style.setProperty('--h', `${compressedHeight}px`);
    shard.style.setProperty('--bottom', `${bottom.toFixed(1)}px`);
    shard.style.setProperty('--shift', `${(drift + randomBetween(-24, 24)).toFixed(1)}px`);
    shard.style.setProperty('--tilt', `${(tilt * randomBetween(0.35, 0.82) + randomBetween(-3, 3)).toFixed(2)}deg`);
    shard.style.setProperty('--sx', randomBetween(1.06, 1.5).toFixed(3));
    shard.style.setProperty('--sy', randomBetween(0.38, 0.72).toFixed(3));
    shard.style.setProperty('--opacity', Math.max(0.22, randomBetween(0.48, 0.86) - depth * 0.24).toFixed(2));
    shard.style.setProperty('--gray', Math.min(1, randomBetween(0.8, 1) + depth * 0.18).toFixed(2));
    shard.style.setProperty('--contrast', randomBetween(1.18, 1.58).toFixed(2));
    shard.style.setProperty('--brightness', Math.max(0.42, randomBetween(0.58, 0.86) - depth * 0.22).toFixed(2));
    shard.style.setProperty('--sat', Math.max(0.38, randomBetween(0.58, 1.04) - depth * 0.28).toFixed(2));
    shard.style.setProperty('--blend', sedimentCount % 7 === 0 ? 'screen' : 'normal');
    shard.style.setProperty('--image-scale', randomBetween(1.08, 1.42).toFixed(3));
    shard.append(makeImage(src));
    sedimentLayer.append(shard);
    sedimentCount += 1;
    pruneSediment();
  };

  const spawnStrip = () => {
    const src = nextImage();
    const width = randomBetween(82, viewportWidth < 720 ? 128 : 168);
    const height = randomBetween(260, viewportHeight * 0.82);
    const x = randomBetween(-width * 0.28, viewportWidth - width * 0.72);
    const tilt = randomBetween(-7, 7);
    const drift = randomBetween(-36, 36);
    const duration = randomBetween(FALL_MIN, FALL_MAX);
    const landing = Math.max(54, columnHeight(x + drift) + height * randomBetween(0.1, 0.18));
    const strip = document.createElement('span');

    strip.className = 'fall-strip';
    strip.style.setProperty('--x', `${x.toFixed(1)}px`);
    strip.style.setProperty('--w', `${width.toFixed(1)}px`);
    strip.style.setProperty('--h', `${height.toFixed(1)}px`);
    strip.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);
    strip.style.setProperty('--drift', `${drift.toFixed(1)}px`);
    strip.style.setProperty('--landing', `${landing.toFixed(1)}px`);
    strip.style.setProperty('--duration', `${duration}ms`);
    strip.style.setProperty('--sx', randomBetween(0.86, 1.12).toFixed(3));
    strip.style.setProperty('--opacity', randomBetween(0.58, 0.88).toFixed(2));
    strip.style.setProperty('--gray', randomBetween(0.72, 1).toFixed(2));
    strip.style.setProperty('--contrast', randomBetween(1.08, 1.38).toFixed(2));
    strip.style.setProperty('--brightness', randomBetween(0.66, 0.94).toFixed(2));
    strip.style.setProperty('--sat', randomBetween(0.58, 1.08).toFixed(2));
    strip.style.setProperty('--image-scale', randomBetween(1.03, 1.2).toFixed(3));
    strip.append(makeImage(src, sedimentCount < 6));
    fallLayer.append(strip);

    window.setTimeout(() => {
      addSediment({ src, x, width, height, tilt, drift });
      strip.remove();
    }, duration * 0.96);
  };

  const scheduleSpawn = () => {
    spawnStrip();
    spawnTimer = window.setTimeout(scheduleSpawn, randomInt(SPAWN_MIN, SPAWN_MAX));
  };

  const seedSediment = () => {
    const initial = window.innerWidth < 720 ? 18 : 30;

    for (let index = 0; index < initial; index += 1) {
      addSediment({
        src: nextImage(),
        x: randomBetween(-24, viewportWidth - 84),
        width: randomBetween(90, viewportWidth < 720 ? 128 : 168),
        height: randomBetween(180, 420),
        tilt: randomBetween(-8, 8),
        drift: randomBetween(-42, 42)
      });
    }
  };

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
    }, 160);
  });

  window.addEventListener('pagehide', () => {
    window.clearTimeout(spawnTimer);
  });

  loadImages().then((loadedImages) => {
    images = loadedImages;
    preloadImages();
    seedSediment();
    scheduleSpawn();
  });
})();
