// Same image sources and introductory rain as the home, running indefinitely.
const netArtLayer = document.querySelector('.netart-layer');
const netArtItems = [];
const NETART_DATASET_MANIFEST = '/datasets/people_80s_style_compressed/manifest.json';
const NETART_DATASET_BASE = '/datasets/people_80s_style_compressed/';
const NETART_CACHE_MANIFEST = '/assets/images/netart-cache/manifest.json';
const NETART_REMOTE_IMAGE_SIZE = 420;
const NETART_PROBE_LIMIT = 70;
const NETART_MIN_VALID_IMAGES = 8;
const NETART_IMAGE_TIMEOUT_MS = 650;
let netArtStartTime = performance.now();
let netArtImages = [
  '/assets/images/scroll-strips/strip_000001.jpg',
  '/assets/images/scroll-strips/strip_000002.jpg',
  '/assets/images/scroll-strips/strip_000003.jpg',
  '/assets/images/scroll-strips/strip_000004.jpg',
  '/assets/images/archive-sides/paper-strips-installation.png',
  '/assets/images/archive-sides/dense-text-column.png',
  '/assets/images/archive-sides/vertical-contact-strips.png',
  '/assets/images/archive-sides/sepia-contact-sheet.png',
  '/assets/images/archive-sides/folded-paper-floor.png'
];

const shuffleImages = (images) => {
  const shuffled = [...images];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const encodeNetArtPathSegment = (segment) => encodeURIComponent(segment).replace(/%2F/gi, '/');

const datasetNetArtImagePath = (entry) => {
  const file = typeof entry === 'string' ? entry : entry?.file;
  if (typeof file !== 'string' || !file.trim()) return null;

  return `${NETART_DATASET_BASE}${encodeNetArtPathSegment(file.trim())}`;
};

const picsumUrlFromCachePath = (src) => {
  const fileName = src.split('/').pop() || '';
  const idMatch = fileName.match(/^picsum_0*(\d+)_(\d+)x(\d+)\.jpe?g$/i);
  if (idMatch) {
    return `https://picsum.photos/id/${idMatch[1]}/${NETART_REMOTE_IMAGE_SIZE}/${NETART_REMOTE_IMAGE_SIZE}`;
  }

  const seedMatch = fileName.match(/^picsum_seed-([^_]+)_(\d+)x(\d+)\.jpe?g$/i);
  if (seedMatch) {
    return `https://picsum.photos/seed/${encodeURIComponent(seedMatch[1])}/${NETART_REMOTE_IMAGE_SIZE}/${NETART_REMOTE_IMAGE_SIZE}`;
  }

  return null;
};

const normalizeCachedNetArtPath = (src, source = '') => {
  if (typeof src !== 'string' || !src.trim()) return null;
  const clean = src.trim();
  const remotePicsumUrl = source.includes('picsum.photos') ? picsumUrlFromCachePath(clean) : null;

  return remotePicsumUrl || (clean.startsWith('./') ? clean.slice(1) : clean);
};

const cssUrl = (src) => `url("${String(src).replace(/["\\]/g, '\\$&')}")`;

const probeImage = (src) => new Promise((resolve) => {
  const image = new Image();
  let settled = false;

  const finish = (valid) => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeout);
    image.onload = null;
    image.onerror = null;
    resolve(valid ? src : null);
  };

  const timeout = window.setTimeout(() => finish(false), NETART_IMAGE_TIMEOUT_MS);
  image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
  image.onerror = () => finish(false);
  image.src = src;
});

const collectReachableImages = async (images) => {
  const candidates = shuffleImages(images)
    .filter((image) => typeof image === 'string' && image.length > 0)
    .slice(0, NETART_PROBE_LIMIT);

  if (candidates.length === 0) return null;

  const testedImages = await Promise.all(candidates.map((image) => probeImage(image)));
  const validImages = testedImages.filter(Boolean);

  return validImages.length >= NETART_MIN_VALID_IMAGES ? validImages : null;
};

const loadDatasetNetArtImages = async () => {
  try {
    const response = await fetch(`${NETART_DATASET_MANIFEST}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;

    const manifest = await response.json();
    const images = Array.isArray(manifest)
      ? manifest.map(datasetNetArtImagePath).filter(Boolean)
      : [];
    const validImages = await collectReachableImages(images);

    return validImages ? shuffleImages(validImages) : null;
  } catch (error) {
    console.warn('Dataset de imagenes no disponible, usando fallback.', error);
    return null;
  }
};

const loadLocalNetArtImages = async () => {
  try {
    const response = await fetch(`${NETART_CACHE_MANIFEST}?ts=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) {
      const manifest = await response.json();
      const skipFallbackCache = manifest.source === 'local-fallback';
      const images = !skipFallbackCache && Array.isArray(manifest.images)
        ? manifest.images.map((src) => normalizeCachedNetArtPath(src, manifest.source || '')).filter(Boolean)
        : [];
      const validImages = await collectReachableImages(images);

      if (validImages) return shuffleImages(validImages);
    }
  } catch (error) {
    console.warn('Cache local de imagenes no disponible, probando dataset comprimido.', error);
  }

  const datasetImages = await loadDatasetNetArtImages();
  if (datasetImages) return datasetImages;

  try {
    const remoteImages = await loadRemoteNetArtImages();
    return remoteImages.length ? shuffleImages(remoteImages) : null;
  } catch (error) {
    console.warn('API de imagenes no disponible, usando fallback.', error);
    return null;
  }
};

const loadRemoteNetArtImages = async () => {
  const randomPage = Math.floor(Math.random() * 20) + 1;
  const response = await fetch(`https://picsum.photos/v2/list?page=${randomPage}&limit=30`);
  const data = await response.json();

  return Array.isArray(data) ? data.map((item) => item.download_url).filter(Boolean) : [];
};

const randomBetween = (min, max) => min + Math.random() * (max - min);

const wrapValue = (value, min, max) => {
  const range = max - min;
  if (range <= 0) return value;
  return ((value - min) % range + range) % range + min;
};

const randomizeNetArtItem = (item, subtle = false) => {
  item.style.left = `${Math.random() * 100}%`;

  const size = subtle ? randomBetween(118, 220) : randomBetween(96, 236);
  item.style.width = `${size}px`;
  item.style.height = `${size}px`;

  if (subtle) {
    const idleOpacity = randomBetween(0.05, 0.11);
    item.dataset.idleOpacity = idleOpacity.toFixed(3);
    item.style.opacity = `${idleOpacity}`;
  }
};

const initNetArt = async () => {
  if (!netArtLayer) return;
  const count = 45;
  const vh = window.innerHeight;

  try {
    const localImages = await loadLocalNetArtImages();

    if (localImages) {
      netArtImages = localImages;
    }
  } catch (e) {
    console.warn('API de imágenes falló, usando imágenes locales de respaldo.', e);
  }

  // Start the animation clock after the images have loaded.
  netArtStartTime = performance.now();

  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'netart-item';

    const image = netArtImages[i % netArtImages.length];
    item.style.backgroundImage = cssUrl(image);

    const y = Math.random() * vh * 1.2 - vh * 0.6;
    item.style.top = '0px';
    item.dataset.nearst = (0.35 + Math.random() * 1.5).toFixed(2);
    item.dataset.rain = (0.8 + Math.random() * 2.1).toFixed(3);
    item.dataset.scrollRain = (0.08 + Math.random() * 0.18).toFixed(3);
    item.dataset.phase = (Math.random() * Math.PI * 2).toFixed(3);
    item.dataset.idleOpacity = (0.05 + Math.random() * 0.06).toFixed(3);
    item.dataset.baseY = y.toFixed(2);
    item.dataset.introCycle = '0';
    item.dataset.scrollCycle = '0';

    randomizeNetArtItem(item, true);
    item.style.transform = `translate3d(0, ${y}px, 0) scale(0.94)`;

    netArtLayer.append(item);
    netArtItems.push(item);
  }
};

const animate = () => {
  const elapsed = performance.now() - netArtStartTime;
  const wrapTop = -window.innerHeight * 2.4;
  const wrapBottom = window.innerHeight + 220;
  const wrapRange = wrapBottom - wrapTop;

  netArtItems.forEach((item) => {
    const base = Number(item.dataset.baseY || 0);
    const rainSpeed = Number(item.dataset.rain || 1.4);
    const phase = Number(item.dataset.phase || 0);
    const rawY = base + elapsed * rainSpeed * 1.35;
    const cycle = Math.floor((rawY - wrapTop) / wrapRange);

    if (cycle !== Number(item.dataset.introCycle || 0)) {
      item.dataset.introCycle = String(cycle);
      randomizeNetArtItem(item, false);
    }

    const y = wrapValue(rawY, wrapTop, wrapBottom);
    const scale = 1 + Math.sin(elapsed * 0.012 + rainSpeed + phase) * 0.08;
    item.style.opacity = `${0.28 + Math.abs(Math.sin(elapsed * 0.022 + rainSpeed + phase)) * 0.22}`;
    item.style.transform = `translate3d(0, ${y}px, 0) scale(${scale})`;
  });

  requestAnimationFrame(animate);
};

initNetArt().then(() => requestAnimationFrame(animate));