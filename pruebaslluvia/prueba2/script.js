(() => {
  const CACHE_MANIFEST = '../../assets/images/netart-cache/manifest.json';
  const FALLBACK_IMAGES = [
    '../../assets/images/archive-sides/paper-strips-installation.png',
    '../../assets/images/archive-sides/dense-text-column.png',
    '../../assets/images/archive-sides/vertical-contact-strips.png',
    '../../assets/images/archive-sides/sepia-contact-sheet.png',
    '../../assets/images/archive-sides/folded-paper-floor.png'
  ];
  const STRIP_WIDTH = 150;
  const FRAMES_PER_STRIP = 14;

  const stripField = document.getElementById('stripField');
  if (!stripField) return;

  let images = [...FALLBACK_IMAGES];
  let imageCursor = 0;
  let resizeTimer = null;

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

    if (clean.startsWith('./assets/')) return `../../${clean.slice(2)}`;
    if (clean.startsWith('assets/')) return `../../${clean}`;
    if (clean.startsWith('../../') || clean.startsWith('http')) return clean;
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
      console.warn('No se pudo leer el cache local para prueba2.', error);
      return null;
    }
  };

  const preloadImages = () => {
    images.slice(0, 72).forEach((src) => {
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

  const createFrame = (src, height, seed) => {
    const frame = document.createElement('span');
    const image = document.createElement('img');

    frame.className = 'strip-frame';
    frame.style.setProperty('--frame-height', `${height}px`);
    frame.style.setProperty('--frame-opacity', randomBetween(0.62, 0.92).toFixed(2));
    frame.style.setProperty('--frame-gray', randomBetween(0.68, 1).toFixed(2));
    frame.style.setProperty('--frame-contrast', randomBetween(1.08, 1.34).toFixed(2));
    frame.style.setProperty('--frame-brightness', randomBetween(0.72, 1.04).toFixed(2));
    frame.style.setProperty('--frame-sat', randomBetween(0.7, 1.2).toFixed(2));
    frame.style.setProperty('--frame-scale', randomBetween(1.01, 1.18).toFixed(3));
    image.src = src;
    image.alt = '';
    image.decoding = 'async';
    image.loading = seed < 4 ? 'eager' : 'lazy';
    image.draggable = false;
    frame.append(image);
    return frame;
  };

  const createStripSet = (frameData) => {
    const set = document.createElement('div');
    set.className = 'strip-set';

    frameData.forEach((frame, index) => {
      set.append(createFrame(frame.src, frame.height, index));
    });

    return set;
  };

  const renderStrips = () => {
    const stripCount = Math.ceil(window.innerWidth / STRIP_WIDTH) + 1;
    const strips = [];

    stripField.replaceChildren();

    for (let stripIndex = 0; stripIndex < stripCount; stripIndex += 1) {
      const strip = document.createElement('section');
      const track = document.createElement('div');
      const frameData = Array.from({ length: FRAMES_PER_STRIP }, () => ({
        src: nextImage(),
        height: Math.round(randomBetween(118, 276))
      }));
      const speed = randomBetween(13, 54);

      strip.className = 'scroll-strip';
      strip.dataset.direction = stripIndex % 2 === 0 ? 'normal' : 'reverse';
      strip.style.setProperty('--left', `${stripIndex * STRIP_WIDTH}px`);
      strip.style.setProperty('--strip-opacity', randomBetween(0.44, 0.86).toFixed(2));
      strip.style.setProperty('--strip-gray', randomBetween(0.72, 1).toFixed(2));
      strip.style.setProperty('--strip-contrast', randomBetween(1.12, 1.42).toFixed(2));
      strip.style.setProperty('--strip-brightness', randomBetween(0.6, 0.92).toFixed(2));
      strip.style.setProperty('--strip-sat', randomBetween(0.58, 1.08).toFixed(2));
      strip.style.setProperty('--strip-skew', `${randomBetween(-1.2, 1.2).toFixed(2)}deg`);
      track.className = 'strip-track';
      track.style.setProperty('--speed', `${speed.toFixed(2)}s`);
      track.style.setProperty('--delay', `-${randomBetween(0, speed).toFixed(2)}s`);
      track.append(createStripSet(frameData), createStripSet(frameData));
      strip.append(track);
      strips.push(strip);
    }

    stripField.append(...strips);
  };

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(renderStrips, 180);
  });

  loadLocalImages().then((localImages) => {
    if (localImages) {
      images = localImages;
    }

    preloadImages();
    renderStrips();
  });
})();
