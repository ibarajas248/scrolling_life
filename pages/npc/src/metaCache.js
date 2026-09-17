const KEY = 'sl-meta-v1';

function readAll() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

/** Metadatos oEmbed cacheados (thumbnail, título…) — lectura síncrona instantánea. */
export function getCachedMeta(videoId) {
  return readAll()[videoId] || null;
}

export function setCachedMeta(videoId, meta) {
  if (!videoId || !meta) return;
  const all = readAll();
  all[videoId] = { ...all[videoId], ...meta };
  writeAll(all);
}

export function mergeCached(video) {
  const cached = getCachedMeta(video.id);
  if (!cached) return video;
  return { ...video, ...cached };
}
