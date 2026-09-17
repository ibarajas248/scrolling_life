/**
 * Precarga de vídeos locales para el loop infinito.
 * Mantiene blobs/elementos listos sin depender de TikTok.
 */

const cache = new Map(); // src -> HTMLVideoElement (off-DOM)

function makeVideoEl({ preloadOnly = false } = {}) {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.loop = false;
  v.setAttribute('playsinline', '');
  v.setAttribute('webkit-playsinline', '');
  if (preloadOnly) {
    v.addEventListener('play', () => {
      v.pause();
      v.muted = true;
      v.volume = 0;
    });
  }
  Object.assign(v.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    background: '#000',
  });
  return v;
}

/** Corta cualquier audio de la caché off-DOM (precarga). */
export function silenceWarmPool() {
  cache.forEach((v) => {
    v.pause();
    v.muted = true;
    v.volume = 0;
  });
}

export function ensureWarming(src, { priority = false } = {}) {
  if (!src || cache.has(src)) return cache.get(src) || null;
  const v = makeVideoEl({ preloadOnly: true });
  v.src = src;
  v.muted = true;
  v.volume = 0;
  v.load();
  cache.set(src, v);
  // Limitar caché
  if (cache.size > 12) {
    const first = cache.keys().next().value;
    if (first && first !== src) {
      const old = cache.get(first);
      old?.removeAttribute('src');
      old?.load();
      cache.delete(first);
    }
  }
  return v;
}

export function warmAhead(items = []) {
  items.forEach((item, i) => {
    if (item?.src) ensureWarming(item.src, { priority: i === 0 });
  });
}

export function createSlideVideo() {
  return makeVideoEl({ preloadOnly: false });
}
