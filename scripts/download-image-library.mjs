import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';

const DEFAULT_TARGET_GB = 10;
const DEFAULT_CONCURRENCY = 18;
const DEFAULT_IMAGE_WIDTH = 2400;
const DEFAULT_IMAGE_HEIGHT = 2400;
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'assets', 'images', 'netart-library');

const parseStringArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;

  const value = match.slice(prefix.length).trim();
  return value.length > 0 ? value : fallback;
};

const parseNumberArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  if (!match) return fallback;

  const value = Number(match.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const outputDir = parseStringArg('output-dir', DEFAULT_OUTPUT_DIR);
const LIBRARY_DIR = path.resolve(outputDir);
const MANIFEST_PATH = path.join(LIBRARY_DIR, 'manifest.json');
const LOG_STATE_PATH = path.join(LIBRARY_DIR, 'download-state.json');
const targetGb = parseNumberArg('target-gb', DEFAULT_TARGET_GB);
const targetMb = parseNumberArg('target-mb', targetGb * 1024);
const targetBytes = Math.floor(targetMb * 1024 * 1024);
const concurrency = Math.max(1, Math.floor(parseNumberArg('concurrency', DEFAULT_CONCURRENCY)));
const IMAGE_WIDTH = Math.floor(parseNumberArg('width', DEFAULT_IMAGE_WIDTH));
const IMAGE_HEIGHT = Math.floor(parseNumberArg('height', DEFAULT_IMAGE_HEIGHT));
const manifestImagePrefix = parseStringArg('manifest-prefix', './');
const minBytes = Math.floor(parseNumberArg('min-kb', 12) * 1024);

const enabledSources = parseStringArg(
  'sources',
  'picsum-list,picsum-seed,loremflickr,commons'
).split(',').map((source) => source.trim()).filter(Boolean);

const topics = [
  'archive',
  'city',
  'screen',
  'street',
  'paper',
  'portrait',
  'landscape',
  'object',
  'technology',
  'night',
  'texture',
  'gallery',
];

const state = {
  picsumPage: Math.max(1, Math.floor(Math.random() * 20) + 1),
  seedCursor: Date.now(),
  loremCursor: Date.now(),
  sourceIndex: 0,
  sourceStats: Object.fromEntries(enabledSources.map((source) => [source, { ok: 0, failed: 0 }])),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toSafeSlug = (value) => String(value).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 90);

const extensionForMime = (mime) => {
  if (/png/i.test(mime)) return 'png';
  if (/webp/i.test(mime)) return 'webp';
  if (/gif/i.test(mime)) return 'gif';
  return 'jpg';
};

const listExistingImages = async () => {
  try {
    const names = await readdir(LIBRARY_DIR);
    return names.filter((name) => /\.(jpe?g|png|webp|gif)$/i.test(name)).sort();
  } catch {
    return [];
  }
};

const getCacheBytes = async (names) => {
  let total = 0;

  for (const name of names) {
    try {
      const info = await stat(path.join(LIBRARY_DIR, name));
      total += info.size;
    } catch {
      // Ignore files deleted between listing and stat.
    }
  }

  return total;
};

const readManifest = async () => {
  try {
    const raw = await readFile(MANIFEST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeJson = async (filePath, data) => {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
};

const writeManifest = async (downloadedBytes, imageCount, startedAt) => {
  const names = await listExistingImages();
  const totalBytes = await getCacheBytes(names);
  const manifest = {
    generatedAt: new Date().toISOString(),
    startedAt,
    sources: enabledSources,
    targetMb,
    totalBytes,
    imageCount: names.length,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    outputDir: LIBRARY_DIR,
    images: names.map((name) => `${manifestImagePrefix}${name}`),
  };

  await writeJson(MANIFEST_PATH, manifest);
  await writeJson(LOG_STATE_PATH, {
    generatedAt: manifest.generatedAt,
    targetMb,
    totalBytes,
    downloadedThisRunBytes: downloadedBytes,
    imageCount,
    sourceStats: state.sourceStats,
  });

  return manifest;
};

const fetchJson = async (url, attempts = 4) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ScrollingLifeImageLibrary/1.0 (local artwork cache)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(700 * attempt);
    }
  }

  throw lastError;
};

const makePicsumListCandidates = async () => {
  const page = state.picsumPage;
  state.picsumPage += 1;
  const data = await fetchJson(`https://picsum.photos/v2/list?page=${page}&limit=100`);

  if (!Array.isArray(data)) return [];

  return data.filter((item) => item?.id).map((item) => {
    const id = String(item.id);
    return {
      id,
      source: 'picsum-list',
      url: `https://picsum.photos/id/${encodeURIComponent(id)}/${IMAGE_WIDTH}/${IMAGE_HEIGHT}.jpg`,
      filename: `picsum_id_${toSafeSlug(id)}_${IMAGE_WIDTH}x${IMAGE_HEIGHT}.jpg`,
    };
  });
};

const makePicsumSeedCandidates = (count = 160) => {
  const start = state.seedCursor;
  state.seedCursor += count;

  return Array.from({ length: count }, (_, index) => {
    const id = `scrolling-life-${start + index}`;
    return {
      id,
      source: 'picsum-seed',
      url: `https://picsum.photos/seed/${encodeURIComponent(id)}/${IMAGE_WIDTH}/${IMAGE_HEIGHT}.jpg`,
      filename: `picsum_seed_${toSafeSlug(id)}_${IMAGE_WIDTH}x${IMAGE_HEIGHT}.jpg`,
    };
  });
};

const makeLoremFlickrCandidates = (count = 96) => {
  const start = state.loremCursor;
  state.loremCursor += count;

  return Array.from({ length: count }, (_, index) => {
    const topic = topics[(start + index) % topics.length];
    const id = `${topic}-${start + index}`;
    return {
      id,
      source: 'loremflickr',
      url: `https://loremflickr.com/${IMAGE_WIDTH}/${IMAGE_HEIGHT}/${encodeURIComponent(topic)}?random=${start + index}`,
      filename: `loremflickr_${toSafeSlug(id)}_${IMAGE_WIDTH}x${IMAGE_HEIGHT}.jpg`,
    };
  });
};

const makeCommonsCandidates = async () => {
  const url = [
    'https://commons.wikimedia.org/w/api.php?action=query',
    'format=json',
    'generator=random',
    'grnnamespace=6',
    'grnlimit=50',
    'prop=imageinfo',
    'iiprop=url|mime|size',
    `iiurlwidth=${IMAGE_WIDTH}`,
    'origin=*',
  ].join('&');
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});

  return pages.flatMap((page) => {
    const imageInfo = page?.imageinfo?.[0];
    const mime = imageInfo?.mime || '';

    if (!/^image\/(jpeg|png|webp)$/i.test(mime)) {
      return [];
    }

    const id = String(page.pageid || page.title || Date.now());
    const ext = extensionForMime(mime);
    return [{
      id,
      source: 'commons',
      url: imageInfo.thumburl || imageInfo.url,
      filename: `commons_${toSafeSlug(id)}_${IMAGE_WIDTH}px.${ext}`,
    }];
  });
};

const makeCandidates = async (source) => {
  if (source === 'picsum-list') return makePicsumListCandidates();
  if (source === 'picsum-seed') return makePicsumSeedCandidates();
  if (source === 'loremflickr') return makeLoremFlickrCandidates();
  if (source === 'commons') return makeCommonsCandidates();
  return [];
};

const nextSource = () => {
  const source = enabledSources[state.sourceIndex % enabledSources.length];
  state.sourceIndex += 1;
  return source;
};

const downloadImage = async (candidate, attempts = 3) => {
  const filePath = path.join(LIBRARY_DIR, candidate.filename);
  const tempPath = `${filePath}.part`;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(candidate.url, {
        redirect: 'follow',
        headers: {
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'User-Agent': 'ScrollingLifeImageLibrary/1.0 (local artwork cache)',
        },
      });

      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !response.body || !/^image\//i.test(contentType)) {
        throw new Error(`HTTP ${response.status} ${contentType || 'unknown-content'}`);
      }

      await pipeline(response.body, createWriteStream(tempPath));
      const info = await stat(tempPath);

      if (info.size < minBytes) {
        throw new Error(`file too small: ${info.size} bytes`);
      }

      await rename(tempPath, filePath);
      return info.size;
    } catch (error) {
      lastError = error;
      await unlink(tempPath).catch(() => {});
      await sleep(650 * attempt);
    }
  }

  throw lastError;
};

const formatSize = (bytes) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const formatEta = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'calculando';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
};

const progressLine = ({ totalBytes, imageCount, lastBytes, source, startedAtMs }) => {
  const elapsedSeconds = Math.max(1, (Date.now() - startedAtMs) / 1000);
  const bytesPerSecond = totalBytes / elapsedSeconds;
  const remainingSeconds = (targetBytes - totalBytes) / bytesPerSecond;
  const target = formatSize(targetBytes);
  console.log(
    `saved=${imageCount} cache=${formatSize(totalBytes)}/${target} ` +
    `last=${formatSize(lastBytes)} source=${source} eta=${formatEta(remainingSeconds)}`
  );
};

const main = async () => {
  await mkdir(LIBRARY_DIR, { recursive: true });

  const existing = await listExistingImages();
  const previousManifest = await readManifest();
  let totalBytes = await getCacheBytes(existing);
  let imageCount = existing.length;
  let downloadedThisRun = 0;
  let consecutiveFailures = 0;
  const known = new Set(existing);
  const candidates = [];
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();

  console.log(`library_dir=${LIBRARY_DIR}`);
  console.log(`target_mb=${targetMb}`);
  console.log(`sources=${enabledSources.join(',')}`);
  console.log(`concurrency=${concurrency}`);
  console.log(`existing_images=${imageCount}`);
  console.log(`existing_size=${formatSize(totalBytes)}`);

  if (previousManifest?.imageCount) {
    console.log(`previous_manifest_images=${previousManifest.imageCount}`);
  }

  while (totalBytes < targetBytes) {
    while (candidates.length < concurrency * 6) {
      const source = nextSource();
      try {
        const nextCandidates = await makeCandidates(source);
        candidates.push(...nextCandidates);
      } catch (error) {
        state.sourceStats[source].failed += 1;
        console.warn(`candidate_source_failed=${source} reason=${error?.message || error}`);
      }

      if (candidates.length === 0) {
        candidates.push(...makePicsumSeedCandidates());
      }
    }

    const batch = [];
    while (batch.length < concurrency && candidates.length > 0) {
      const candidate = candidates.shift();
      if (!candidate?.filename || known.has(candidate.filename)) continue;
      known.add(candidate.filename);
      batch.push(candidate);
    }

    if (batch.length === 0) {
      continue;
    }

    const results = await Promise.allSettled(batch.map(downloadImage));

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const candidate = batch[index];

      if (result.status === 'fulfilled') {
        totalBytes += result.value;
        downloadedThisRun += result.value;
        imageCount += 1;
        consecutiveFailures = 0;
        state.sourceStats[candidate.source].ok += 1;
        progressLine({
          totalBytes,
          imageCount,
          lastBytes: result.value,
          source: candidate.source,
          startedAtMs,
        });
      } else {
        consecutiveFailures += 1;
        state.sourceStats[candidate.source].failed += 1;
        console.warn(`download_failed source=${candidate.source} reason=${result.reason?.message || result.reason}`);
      }
    }

    if (consecutiveFailures > concurrency * 20 && downloadedThisRun === 0) {
      throw new Error('Too many failures before downloading any image.');
    }

    await writeManifest(downloadedThisRun, imageCount, startedAt);
  }

  const manifest = await writeManifest(downloadedThisRun, imageCount, startedAt);
  console.log(`done_images=${manifest.imageCount}`);
  console.log(`done_size=${formatSize(manifest.totalBytes)}`);
  console.log(`manifest=${MANIFEST_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
