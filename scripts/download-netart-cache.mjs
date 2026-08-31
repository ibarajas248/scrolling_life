import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';

const SITE_ROOT = process.cwd();
const DEFAULT_CACHE_DIR = path.join(SITE_ROOT, 'assets', 'images', 'netart-cache');
const DEFAULT_TARGET_MB = 500;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_IMAGE_WIDTH = 2000;
const DEFAULT_IMAGE_HEIGHT = 2000;

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

const outputDir = parseStringArg('output-dir', DEFAULT_CACHE_DIR);
const CACHE_DIR = path.resolve(outputDir);
const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json');
const targetMb = parseNumberArg('target-mb', DEFAULT_TARGET_MB);
const concurrency = Math.max(1, Math.floor(parseNumberArg('concurrency', DEFAULT_CONCURRENCY)));
const IMAGE_WIDTH = Math.floor(parseNumberArg('width', DEFAULT_IMAGE_WIDTH));
const IMAGE_HEIGHT = Math.floor(parseNumberArg('height', DEFAULT_IMAGE_HEIGHT));
const manifestImagePrefix = parseStringArg(
  'manifest-prefix',
  CACHE_DIR === DEFAULT_CACHE_DIR ? './assets/images/netart-cache/' : './'
);
const targetBytes = Math.floor(targetMb * 1024 * 1024);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toSafeSlug = (value) => String(value).replace(/[^a-z0-9_-]+/gi, '-');

const toCacheName = (id) => `picsum_${toSafeSlug(id)}_${IMAGE_WIDTH}x${IMAGE_HEIGHT}.jpg`;

const listExistingImages = async () => {
  try {
    const names = await readdir(CACHE_DIR);
    return names.filter((name) => /\.jpe?g$/i.test(name)).sort();
  } catch {
    return [];
  }
};

const getCacheBytes = async (names) => {
  let total = 0;

  for (const name of names) {
    try {
      const info = await stat(path.join(CACHE_DIR, name));
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

const writeManifest = async () => {
  const names = await listExistingImages();
  const totalBytes = await getCacheBytes(names);
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'https://picsum.photos',
    targetMb,
    totalBytes,
    imageCount: names.length,
    imageWidth: IMAGE_WIDTH,
    imageHeight: IMAGE_HEIGHT,
    outputDir: CACHE_DIR,
    images: names.map((name) => `${manifestImagePrefix}${name}`),
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
};

const fetchJson = async (url, attempts = 4) => {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ScrollingLifeNetartCache/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(800 * attempt);
    }
  }

  throw lastError;
};

const downloadImage = async (url, filePath, attempts = 4) => {
  const tempPath = `${filePath}.part`;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'ScrollingLifeNetartCache/1.0',
        },
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      await pipeline(response.body, createWriteStream(tempPath));
      const info = await stat(tempPath);

      if (info.size < 10_000) {
        throw new Error(`File too small: ${info.size} bytes`);
      }

      await rename(tempPath, filePath);
      return info.size;
    } catch (error) {
      lastError = error;
      await unlink(tempPath).catch(() => {});
      await sleep(900 * attempt);
    }
  }

  throw lastError;
};

const loadCandidateIds = async (startPage, pagesToRead = 4) => {
  const candidates = [];

  for (let offset = 0; offset < pagesToRead; offset += 1) {
    const page = startPage + offset;
    const data = await fetchJson(`https://picsum.photos/v2/list?page=${page}&limit=100`);

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item && item.id) {
          candidates.push(String(item.id));
        }
      }
    }
  }

  return candidates;
};

const makeSeedCandidates = (start, count = 400) => (
  Array.from({ length: count }, (_, index) => `seed-${start + index}`)
);

const progressLine = (downloaded, totalBytes, count) => {
  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  const target = (targetBytes / 1024 / 1024).toFixed(0);
  const size = (downloaded / 1024 / 1024).toFixed(2);
  console.log(`saved=${count} cache=${mb}MB/${target}MB last=${size}MB`);
};

const main = async () => {
  await mkdir(CACHE_DIR, { recursive: true });

  const existing = await listExistingImages();
  const previousManifest = await readManifest();
  let totalBytes = await getCacheBytes(existing);
  const known = new Set(existing);

  console.log(`cache_dir=${CACHE_DIR}`);
  console.log(`target_mb=${targetMb}`);
  console.log(`existing_images=${existing.length}`);
  console.log(`existing_mb=${(totalBytes / 1024 / 1024).toFixed(1)}`);

  if (previousManifest?.imageCount) {
    console.log(`previous_manifest_images=${previousManifest.imageCount}`);
  }

  let page = Math.max(1, Math.floor(Math.random() * 20) + 1);
  let seedCursor = Date.now();
  let candidates = [];
  let active = 0;
  let failures = 0;

  while (totalBytes < targetBytes) {
    if (candidates.length < concurrency * 2) {
      try {
        const nextCandidates = await loadCandidateIds(page);
        if (nextCandidates.length > 0) {
          candidates.push(...nextCandidates);
        } else {
          candidates.push(...makeSeedCandidates(seedCursor));
          seedCursor += 400;
        }
        page += 4;
      } catch (error) {
        console.warn(`api_page_failed page=${page} reason=${error?.message || error}`);
        candidates.push(...makeSeedCandidates(seedCursor));
        seedCursor += 400;
        page += 4;
      }
    }

    const batch = [];
    while (batch.length < concurrency && candidates.length > 0) {
      const id = candidates.shift();
      const filename = toCacheName(id);
      if (!id || known.has(filename)) continue;

      known.add(filename);
      batch.push(id);
    }

    if (batch.length === 0) {
      page += 4;
      continue;
    }

    active += batch.length;
    const results = await Promise.allSettled(batch.map(async (id) => {
      const filename = toCacheName(id);
      const filePath = path.join(CACHE_DIR, filename);
      const pathPart = String(id).startsWith('seed-') ? 'seed' : 'id';
      const imageUrl = `https://picsum.photos/${pathPart}/${encodeURIComponent(id)}/${IMAGE_WIDTH}/${IMAGE_HEIGHT}.jpg`;
      return downloadImage(imageUrl, filePath);
    }));
    active -= batch.length;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalBytes += result.value;
        const imageCount = (await listExistingImages()).length;
        progressLine(result.value, totalBytes, imageCount);
      } else {
        failures += 1;
        console.warn(`download_failed=${failures} reason=${result.reason?.message || result.reason}`);
      }
    }

    if (failures > 40 && totalBytes === 0) {
      throw new Error('Too many failures before downloading any image.');
    }

    if (active === 0) {
      await writeManifest();
    }
  }

  const manifest = await writeManifest();
  console.log(`done_images=${manifest.imageCount}`);
  console.log(`done_mb=${(manifest.totalBytes / 1024 / 1024).toFixed(1)}`);
  console.log(`manifest=${MANIFEST_PATH}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
