(() => {
  const API_URL = 'https://commons.wikimedia.org/w/api.php';
  const BATCH_SIZE = 20;
  const REFILL_AT = 6;
  const MAX_OFFSET = 460;
  const THUMB_WIDTH = 420;
  const PROCESS_MS = 1050;
  const MAX_ACTIVE_RAIN = 72;
  const MAX_MEMORY = 140;
  const MAX_VISIBLE_NODES = 72;
  const VECTOR_DIMS = 64;
  const PCA_DIMS = 48;
  const MODEL_TIMEOUT_MS = 9000;
  const THREE_TIMEOUT_MS = 3600;
  const FETCH_TIMEOUT_MS = 6500;
  const STORAGE_KEY = 'scrolling_life_embedding_rain_memory_v1';

  const MODEL_SCRIPTS = [
    {
      src: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
      test: () => window.tf
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js',
      test: () => window.mobilenet
    }
  ];

  const LOCAL_FALLBACK_IMAGES = [
    {
      id: 'local-netart-screen',
      title: 'Pantalla local de archivo visual',
      credit: 'Archivo local Scrolling Life',
      license: 'fallback local',
      url: '../../assets/images/netart/Screenshot_20250108-144156.jpg'
    },
    {
      id: 'local-strip-001',
      title: 'Fragmento scroll 001',
      credit: 'Archivo local Scrolling Life',
      license: 'fallback local',
      url: '../../assets/images/scroll-strips/strip_000001.jpg'
    },
    {
      id: 'local-strip-002',
      title: 'Fragmento scroll 002',
      credit: 'Archivo local Scrolling Life',
      license: 'fallback local',
      url: '../../assets/images/scroll-strips/strip_000002.jpg'
    },
    {
      id: 'local-strip-003',
      title: 'Fragmento scroll 003',
      credit: 'Archivo local Scrolling Life',
      license: 'fallback local',
      url: '../../assets/images/scroll-strips/strip_000003.jpg'
    },
    {
      id: 'local-strip-004',
      title: 'Fragmento scroll 004',
      credit: 'Archivo local Scrolling Life',
      license: 'fallback local',
      url: '../../assets/images/scroll-strips/strip_000004.jpg'
    }
  ];

  const RANDOM_QUERIES = [
    'internet visual culture',
    'digital archive',
    'internet culture',
    'computer screen',
    'public domain photograph',
    'visual culture',
    'urban night',
    'net art',
    'street photograph',
    'archive screen',
    'human gesture',
    'city reflection',
    'machine vision',
    'public space',
    'media art'
  ];

  const canvas = document.getElementById('pcaCanvas');
  const mapOverlay = document.getElementById('mapOverlay');
  const rainLayer = document.getElementById('rainLayer');
  const queryForm = document.getElementById('queryForm');
  const queryInput = document.getElementById('queryInput');
  const modelStatus = document.getElementById('modelStatus');
  const memoryCount = document.getElementById('memoryCount');
  const pcaStatus = document.getElementById('pcaStatus');
  const clusterStatus = document.getElementById('clusterStatus');
  const currentLabel = document.getElementById('currentLabel');
  const currentVector = document.getElementById('currentVector');
  const learningLog = document.getElementById('learningLog');
  let ctx = null;
  const pixelCanvas = document.createElement('canvas');
  const pixelContext = pixelCanvas.getContext('2d', { willReadFrequently: true });

  let activeQuery = RANDOM_QUERIES[Math.floor(Math.random() * RANDOM_QUERIES.length)];
  let imagePool = [];
  let seenImages = new Set();
  let nextImageIndex = 0;
  let isLoadingBatch = false;
  let loadingPromise = null;
  let isProcessing = false;
  let launchCount = 0;
  let fallbackIndex = 0;
  let localFallbackBatch = 0;
  let memory = [];
  let pcaDirty = true;
  let pcaScheduled = false;
  let latestItemId = memory.at(-1)?.id || '';
  let nodeById = new Map();
  let threeState = null;
  let renderTime = 0;
  let resizeTimer = null;
  let processTimer = null;

  const modelState = {
    status: 'loading',
    source: 'pixel',
    model: null,
    promise: null
  };

  const clusterColors = [
    [97, 219, 227],
    [202, 255, 106],
    [255, 123, 95],
    [255, 209, 102],
    [155, 108, 255],
    [245, 247, 251]
  ];

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const waitFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  const truncateText = (value, max = 58) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
  };

  const hashString = (value) => {
    let hash = 2166136261;
    const input = String(value || '');
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const seededUnit = (seed, offset = 0) => {
    let value = (seed + offset * 1013904223) >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return ((value >>> 0) % 10000) / 10000;
  };

  const stripMarkup = (value) => {
    if (!value) return '';
    const doc = new DOMParser().parseFromString(String(value), 'text/html');
    return doc.body.textContent.replace(/\s+/g, ' ').trim();
  };

  const normalizeTitle = (title) => (
    stripMarkup(title)
      .replace(/^File:/i, '')
      .replace(/_/g, ' ')
      .replace(/\.[a-z0-9]{2,5}$/i, '')
      .trim()
  );

  const normalizeVector = (vector) => {
    const out = Array.from(vector, (value) => Number.isFinite(value) ? value : 0);
    const norm = Math.hypot(...out) || 1;
    return out.map((value) => value / norm);
  };

  const cosineSimilarity = (a, b) => {
    const length = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let index = 0; index < length; index += 1) {
      dot += a[index] * b[index];
      normA += a[index] * a[index];
      normB += b[index] * b[index];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  };

  const loadMemory = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => Array.isArray(item.vector) && item.vector.length === VECTOR_DIMS)
        .slice(-MAX_MEMORY)
        .map((item, index) => ({
          ...item,
          order: item.order || index,
          pca: item.pca || null,
          cluster: Number.isFinite(item.cluster) ? item.cluster : 0
        }));
    } catch {
      return [];
    }
  };

  const saveMemory = () => {
    try {
      const serializable = memory.slice(-MAX_MEMORY).map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        label: item.label,
        score: item.score,
        novelty: item.novelty,
        similarity: item.similarity,
        source: item.source,
        vector: item.vector,
        pca: item.pca,
        cluster: item.cluster,
        createdAt: item.createdAt,
        order: item.order
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      addLearningLine('mem', 'storage: limitado | memoria: solo sesion');
    }
  };

  const updateReadout = () => {
    if (!modelStatus || !memoryCount || !pcaStatus || !clusterStatus) return;

    modelStatus.textContent = modelState.status === 'ready'
      ? 'mobilenet real'
      : modelState.status === 'loading'
        ? 'cargando modelo'
        : 'pixeles fallback';
    memoryCount.textContent = String(memory.length).padStart(3, '0');
    pcaStatus.textContent = memory.length >= 4 ? '3 ejes activos' : 'calibrando';
    const clusterCounts = new Map();
    memory.forEach((item) => clusterCounts.set(item.cluster || 0, (clusterCounts.get(item.cluster || 0) || 0) + 1));
    const strongest = Array.from(clusterCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    clusterStatus.textContent = strongest ? `c${strongest[0]} / ${strongest[1]} imgs` : 'sin datos';
  };

  const addLearningLine = (tag, message) => {
    if (!learningLog) return;

    const item = document.createElement('li');
    const label = document.createElement('strong');
    const copy = document.createElement('span');
    label.textContent = tag;
    copy.textContent = message;
    item.append(label, copy);
    learningLog.prepend(item);
    while (learningLog.children.length > 12) {
      learningLog.lastElementChild?.remove();
    }
  };

  const loadExternalScript = ({ src, test }) => new Promise((resolve, reject) => {
    if (test()) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[data-model-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`No cargo ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timeout ${src}`));
    }, MODEL_TIMEOUT_MS);

    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.modelSrc = src;
    script.onload = () => {
      window.clearTimeout(timer);
      test() ? resolve() : reject(new Error(`Modelo no expuesto ${src}`));
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`No cargo ${src}`));
    };

    document.head.append(script);
  });

  const initModel = () => {
    if (modelState.promise) return modelState.promise;

    modelState.status = 'loading';
    updateReadout();
    modelState.promise = (async () => {
      try {
        for (const script of MODEL_SCRIPTS) {
          await loadExternalScript(script);
        }

        if (!window.mobilenet?.load) {
          throw new Error('mobilenet no disponible');
        }

        modelState.model = await window.mobilenet.load({ version: 2, alpha: 0.5 });
        modelState.status = 'ready';
        modelState.source = 'mobilenet';
        addLearningLine('model', 'mobilenet: ready | embedding: real | pca: online');
      } catch (error) {
        console.warn(error);
        modelState.status = 'fallback';
        modelState.source = 'pixel';
        addLearningLine('model', 'cdn: bloqueado | embedding: pixeles reales | pca: online');
      }
      updateReadout();
      return modelState.model;
    })();

    return modelState.promise;
  };

  const buildApiURL = (query, offset) => {
    const params = new URLSearchParams({
      origin: '*',
      action: 'query',
      format: 'json',
      formatversion: '2',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: `${query} filetype:bitmap`,
      gsrlimit: String(BATCH_SIZE),
      gsroffset: String(offset),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime|mediatype|size',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatalanguage: 'es'
    });

    return `${API_URL}?${params.toString()}`;
  };

  const pickRandomQuery = (avoid = '') => {
    const pool = RANDOM_QUERIES.filter((query) => query !== avoid);
    return pool[Math.floor(Math.random() * pool.length)] || RANDOM_QUERIES[0];
  };

  const pageToImage = (page) => {
    const info = page.imageinfo?.[0];
    if (!info) return null;

    const url = info.thumburl || info.url;
    const mime = info.mime || '';
    const metadata = info.extmetadata || {};

    if (!url || !mime.startsWith('image/') || mime.includes('svg')) {
      return null;
    }

    const title = normalizeTitle(metadata.ObjectName?.value || page.title);
    const credit = stripMarkup(metadata.Artist?.value || metadata.Credit?.value || 'Wikimedia Commons');
    const license = stripMarkup(metadata.LicenseShortName?.value || metadata.UsageTerms?.value || 'licencia abierta');
    const sourceTitle = String(page.title || '').replace(/\s+/g, '_');

    return {
      id: `${page.pageid || sourceTitle}-${url}`,
      title: title || 'Imagen sin titulo',
      credit,
      license,
      url,
      width: info.thumbwidth || info.width || THUMB_WIDTH,
      height: info.thumbheight || info.height || Math.round(THUMB_WIDTH * 0.72),
      ready: false,
      failed: false,
      element: null,
      loadingPromise: null
    };
  };

  const buildLocalFallbackImages = () => {
    localFallbackBatch += 1;
    return Array.from({ length: BATCH_SIZE }, (_, index) => {
      const source = LOCAL_FALLBACK_IMAGES[index % LOCAL_FALLBACK_IMAGES.length];
      return {
        ...source,
        id: `${source.id}-${localFallbackBatch}-${index}`,
        title: `${source.title} ${String(index + 1).padStart(2, '0')}`,
        width: THUMB_WIDTH,
        height: Math.round(THUMB_WIDTH * 0.72),
        ready: false,
        failed: false,
        element: null,
        loadingPromise: null
      };
    });
  };

  const fetchImages = async (query, offset) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(buildApiURL(query, offset), {
        mode: 'cors',
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Respuesta ${response.status}`);
      }

      const data = await response.json();
      return (data.query?.pages || []).map(pageToImage).filter(Boolean);
    } finally {
      window.clearTimeout(timer);
    }
  };

  const preloadImage = (image) => {
    if (image.ready || image.failed) return Promise.resolve(image.ready);
    if (image.loadingPromise) return image.loadingPromise;

    image.loadingPromise = new Promise((resolve) => {
      const element = new Image();
      element.crossOrigin = 'anonymous';
      element.decoding = 'async';
      element.onload = () => {
        image.ready = true;
        image.element = element;
        image.width = element.naturalWidth || image.width;
        image.height = element.naturalHeight || image.height;
        resolve(true);
      };
      element.onerror = () => {
        image.failed = true;
        resolve(false);
      };
      element.src = image.url;
    });

    return image.loadingPromise;
  };

  const cacheBatch = async (images) => {
    const cached = [];
    for (const image of images) {
      const ready = await preloadImage(image);
      if (ready) cached.push(image);
      await waitFrame();
    }
    return cached;
  };

  const loadBatch = async ({ replace = false, query = pickRandomQuery(activeQuery) } = {}) => {
    if (isLoadingBatch) return loadingPromise;

    isLoadingBatch = true;
    activeQuery = query;
    if (replace) {
      imagePool = [];
      seenImages = new Set();
      nextImageIndex = 0;
    }

    loadingPromise = (async () => {
      try {
        const randomOffset = Math.floor(Math.random() * MAX_OFFSET);
        let images = await fetchImages(query, randomOffset);

        if (!images.length) {
          images = await fetchImages(query, 0);
        }

        let freshImages = images.filter((image) => !seenImages.has(image.id));

        if (!freshImages.length) {
          const fallbackQuery = pickRandomQuery(activeQuery);
          fallbackIndex += 1;
          activeQuery = fallbackQuery;
          freshImages = await fetchImages(fallbackQuery, 0);
        }

        const cached = await cacheBatch(freshImages.slice(0, BATCH_SIZE));
        if (!cached.length) {
          throw new Error('No llegaron imagenes compatibles');
        }

        cached.forEach((image) => {
          seenImages.add(image.id);
          imagePool.push(image);
        });
        addLearningLine('cache', `api: wikimedia | lote: ${cached.length}/20 | query: ${truncateText(activeQuery, 26)}`);
      } catch (error) {
        console.warn(error);
        const localImages = await cacheBatch(buildLocalFallbackImages());
        localImages.forEach((image) => {
          seenImages.add(image.id);
          imagePool.push(image);
        });
        addLearningLine('cache', `api: local | lote: ${localImages.length}/20 | fluido: true`);
      } finally {
        isLoadingBatch = false;
        loadingPromise = null;
      }
    })();

    return loadingPromise;
  };

  const requestRefillIfNeeded = () => {
    if (imagePool.length - nextImageIndex <= REFILL_AT) {
      loadBatch();
    }
  };

  const getNextImage = () => {
    for (let index = nextImageIndex; index < imagePool.length; index += 1) {
      const image = imagePool[index];
      if (!image.ready || image.failed) continue;
      nextImageIndex = index + 1;
      requestRefillIfNeeded();
      return image;
    }

    requestRefillIfNeeded();
    return null;
  };

  const spawnRainFrame = (image) => {
    const frame = document.createElement('div');
    const img = document.createElement('img');
    const seed = hashString(`${image.id}-${launchCount}`);
    const width = clamp(92 + seededUnit(seed, 1) * 160, 88, 240);
    const ratio = clamp(image.width / Math.max(1, image.height), 0.46, 1.72);

    frame.className = 'rain-frame';
    frame.style.setProperty('--rain-x', `${clamp(seededUnit(seed, 2) * 100, -3, 96).toFixed(2)}%`);
    frame.style.setProperty('--rain-size', `${width.toFixed(0)}px`);
    frame.style.setProperty('--rain-ratio', ratio.toFixed(3));
    frame.style.setProperty('--rain-speed', `${Math.round(3900 + seededUnit(seed, 3) * 2700)}ms`);
    frame.style.setProperty('--rain-tilt', `${((seededUnit(seed, 4) - 0.5) * 26).toFixed(2)}deg`);
    frame.style.setProperty('--rain-spin', `${((seededUnit(seed, 5) - 0.5) * 54).toFixed(2)}deg`);
    frame.style.setProperty('--rain-drift', `${Math.round((seededUnit(seed, 6) - 0.5) * 180)}px`);
    frame.style.setProperty('--rain-depth', `${Math.round((seededUnit(seed, 7) - 0.5) * 110)}px`);
    frame.style.setProperty('--rain-z', String(Math.round(8 + seededUnit(seed, 8) * 12)));
    frame.style.setProperty('--rain-opacity', String(clamp(0.48 + seededUnit(seed, 9) * 0.38, 0.48, 0.86)));

    img.src = image.url;
    img.alt = '';
    frame.append(img);
    rainLayer.append(frame);
    frame.addEventListener('animationend', () => frame.remove(), { once: true });

    while (rainLayer.children.length > MAX_ACTIVE_RAIN) {
      rainLayer.firstElementChild?.remove();
    }
  };

  const reduceRawVector = (rawVector) => {
    const out = new Array(VECTOR_DIMS).fill(0);
    const raw = Array.from(rawVector || []);

    if (!raw.length) {
      return out;
    }

    raw.forEach((value, index) => {
      const slot = index % VECTOR_DIMS;
      const sign = ((Math.imul(index + 17, 1103515245) >>> 30) & 1) ? -1 : 1;
      out[slot] += (Number.isFinite(value) ? value : 0) * sign;
    });

    return normalizeVector(out);
  };

  const pixelEmbedding = (image) => {
    const element = image.element;
    const size = 32;
    pixelCanvas.width = size;
    pixelCanvas.height = size;

    try {
      pixelContext.drawImage(element, 0, 0, size, size);
      const { data } = pixelContext.getImageData(0, 0, size, size);
      const vector = new Array(VECTOR_DIMS).fill(0);
      let warm = 0;
      let cool = 0;
      let edgeSum = 0;
      let lumaSum = 0;

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const index = (y * size + x) * 4;
          const red = data[index] / 255;
          const green = data[index + 1] / 255;
          const blue = data[index + 2] / 255;
          const luma = red * 0.299 + green * 0.587 + blue * 0.114;
          const cellX = Math.floor(x / 4);
          const cellY = Math.floor(y / 4);
          const slot = cellY * 8 + cellX;
          const rightIndex = (y * size + Math.min(size - 1, x + 1)) * 4;
          const downIndex = (Math.min(size - 1, y + 1) * size + x) * 4;
          const rightLuma = data[rightIndex] / 255 * 0.299 + data[rightIndex + 1] / 255 * 0.587 + data[rightIndex + 2] / 255 * 0.114;
          const downLuma = data[downIndex] / 255 * 0.299 + data[downIndex + 1] / 255 * 0.587 + data[downIndex + 2] / 255 * 0.114;
          const edge = Math.abs(luma - rightLuma) + Math.abs(luma - downLuma);

          vector[slot] += luma * 0.68 + Math.abs(red - blue) * 0.18 + edge * 0.45;
          warm += Math.max(0, red - blue);
          cool += Math.max(0, blue - red);
          edgeSum += edge;
          lumaSum += luma;
        }
      }

      const total = size * size;
      const label = edgeSum / total > 0.22
        ? 'textura / borde'
        : warm > cool * 1.2
          ? 'zona calida'
          : cool > warm * 1.2
            ? 'zona fria'
            : lumaSum / total > 0.58
              ? 'zona luminosa'
              : 'forma visual';

      return {
        vector: normalizeVector(vector),
        label,
        score: clamp(0.34 + edgeSum / total + Math.abs(warm - cool) / total, 0.1, 0.86),
        source: 'pixel'
      };
    } catch {
      return {
        vector: reduceRawVector([hashString(image.id) % 991, image.width, image.height, image.title.length]),
        label: 'metadata visual',
        score: 0.22,
        source: 'metadata'
      };
    }
  };

  const embedImage = async (image) => {
    if (modelState.status === 'ready' && modelState.model) {
      try {
        const activation = modelState.model.infer(image.element, true);
        const raw = await activation.data();
        activation.dispose?.();
        const predictions = await modelState.model.classify(image.element, 3);
        const top = predictions[0] || {};
        return {
          vector: reduceRawVector(raw),
          label: top.className || 'objeto visual',
          score: clamp(top.probability || 0.5, 0.01, 0.99),
          source: 'mobilenet'
        };
      } catch (error) {
        console.warn(error);
      }
    }

    return pixelEmbedding(image);
  };

  const getSimilarityStats = (vector) => {
    if (!memory.length) {
      return { similarity: 0, novelty: 1, closest: null };
    }

    let closest = null;
    let similarity = -1;
    memory.forEach((item) => {
      const score = cosineSimilarity(vector, item.vector);
      if (score > similarity) {
        similarity = score;
        closest = item;
      }
    });

    return {
      similarity: clamp(similarity, 0, 0.999),
      novelty: clamp(1 - similarity, 0.001, 0.999),
      closest
    };
  };

  const learnImage = async (image) => {
    const embedding = await embedImage(image);
    const stats = getSimilarityStats(embedding.vector);
    const item = {
      id: `${image.id}-${Date.now()}-${launchCount}`,
      title: image.title,
      url: image.url,
      label: embedding.label,
      score: embedding.score,
      novelty: stats.novelty,
      similarity: stats.similarity,
      source: embedding.source,
      vector: embedding.vector,
      pca: null,
      cluster: stats.closest?.cluster || 0,
      createdAt: Date.now(),
      order: memory.length
    };

    memory.push(item);
    if (memory.length > MAX_MEMORY) {
      memory = memory.slice(-MAX_MEMORY);
    }
    latestItemId = item.id;
    pcaDirty = true;
    schedulePCA();
    syncDomNodes();
    saveMemory();
    updateCurrentReadout(item);
    addLearningLine(
      `img_${String(launchCount).padStart(3, '0')}`,
      `src:${item.source} | label:${truncateText(item.label, 24)} | score:${item.score.toFixed(2)} | novelty:${item.novelty.toFixed(2)} | sim:${item.similarity.toFixed(2)}`
    );
    updateReadout();
  };

  const updateCurrentReadout = (item) => {
    if (!currentLabel || !currentVector) return;

    currentLabel.textContent = truncateText(item.label || item.title, 42);
    currentVector.textContent = `vector:${VECTOR_DIMS} | novelty:${item.novelty.toFixed(2)} | similitud:${item.similarity.toFixed(2)} | ${item.source}`;
  };

  const fallbackPCA = () => {
    memory.forEach((item, index) => {
      const vector = item.vector;
      const seed = hashString(`${item.id}-${index}`);
      item.pca = {
        x: clamp((vector[0] || seededUnit(seed, 1)) * 2 - 1, -1, 1),
        y: clamp((vector[7] || seededUnit(seed, 2)) * 2 - 1, -1, 1),
        z: clamp((vector[13] || seededUnit(seed, 3)) * 2 - 1, -1, 1)
      };
    });
  };

  const powerIteration = (matrix, dims, seed) => {
    let vector = Array.from({ length: dims }, (_, index) => seededUnit(seed, index + 1) * 2 - 1);
    vector = normalizeVector(vector);

    for (let iteration = 0; iteration < 16; iteration += 1) {
      const next = new Array(dims).fill(0);
      for (let row = 0; row < dims; row += 1) {
        let sum = 0;
        for (let col = 0; col < dims; col += 1) {
          sum += matrix[row * dims + col] * vector[col];
        }
        next[row] = sum;
      }
      vector = normalizeVector(next);
    }

    let eigen = 0;
    for (let row = 0; row < dims; row += 1) {
      let sum = 0;
      for (let col = 0; col < dims; col += 1) {
        sum += matrix[row * dims + col] * vector[col];
      }
      eigen += vector[row] * sum;
    }

    return { vector, eigen: Math.max(0, eigen) };
  };

  const deflate = (matrix, dims, component) => {
    const { vector, eigen } = component;
    if (!eigen) return;

    for (let row = 0; row < dims; row += 1) {
      for (let col = 0; col < dims; col += 1) {
        matrix[row * dims + col] -= eigen * vector[row] * vector[col];
      }
    }
  };

  const computePCA = () => {
    if (memory.length < 4) {
      fallbackPCA();
      assignClusters();
      return;
    }

    const dims = Math.min(PCA_DIMS, VECTOR_DIMS);
    const mean = new Array(dims).fill(0);

    memory.forEach((item) => {
      for (let dim = 0; dim < dims; dim += 1) {
        mean[dim] += item.vector[dim] || 0;
      }
    });
    for (let dim = 0; dim < dims; dim += 1) {
      mean[dim] /= memory.length;
    }

    const covariance = new Float64Array(dims * dims);
    memory.forEach((item) => {
      for (let row = 0; row < dims; row += 1) {
        const rowValue = (item.vector[row] || 0) - mean[row];
        for (let col = row; col < dims; col += 1) {
          covariance[row * dims + col] += rowValue * ((item.vector[col] || 0) - mean[col]);
        }
      }
    });

    for (let row = 0; row < dims; row += 1) {
      for (let col = row; col < dims; col += 1) {
        const value = covariance[row * dims + col] / Math.max(1, memory.length - 1);
        covariance[row * dims + col] = value;
        covariance[col * dims + row] = value;
      }
    }

    const work = new Float64Array(covariance);
    const components = [];
    for (let axis = 0; axis < 3; axis += 1) {
      const component = powerIteration(work, dims, hashString(`${memory.length}-pca-${axis}`));
      components.push(component.vector);
      deflate(work, dims, component);
    }

    const projected = memory.map((item) => {
      const centered = new Array(dims);
      for (let dim = 0; dim < dims; dim += 1) {
        centered[dim] = (item.vector[dim] || 0) - mean[dim];
      }
      return {
        x: components[0].reduce((sum, value, index) => sum + value * centered[index], 0),
        y: components[1].reduce((sum, value, index) => sum + value * centered[index], 0),
        z: components[2].reduce((sum, value, index) => sum + value * centered[index], 0)
      };
    });

    const maxAbs = projected.reduce((acc, point) => ({
      x: Math.max(acc.x, Math.abs(point.x)),
      y: Math.max(acc.y, Math.abs(point.y)),
      z: Math.max(acc.z, Math.abs(point.z))
    }), { x: 0.001, y: 0.001, z: 0.001 });

    projected.forEach((point, index) => {
      memory[index].pca = {
        x: clamp(point.x / maxAbs.x, -1, 1),
        y: clamp(point.y / maxAbs.y, -1, 1),
        z: clamp(point.z / maxAbs.z, -1, 1)
      };
    });

    assignClusters();
  };

  const distance3 = (a, b) => (
    Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0))
  );

  const assignClusters = () => {
    if (!memory.length) return;

    const clusterTotal = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(memory.length / 5))));
    let centroids = Array.from({ length: clusterTotal }, (_, index) => {
      const item = memory[Math.floor(index * memory.length / clusterTotal)] || memory[0];
      return { ...(item.pca || { x: 0, y: 0, z: 0 }) };
    });

    for (let iteration = 0; iteration < 5; iteration += 1) {
      const buckets = Array.from({ length: clusterTotal }, () => ({ x: 0, y: 0, z: 0, count: 0 }));
      memory.forEach((item) => {
        const point = item.pca || { x: 0, y: 0, z: 0 };
        let best = 0;
        let bestDistance = Infinity;
        centroids.forEach((centroid, index) => {
          const distance = distance3(point, centroid);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        });
        item.cluster = best;
        buckets[best].x += point.x;
        buckets[best].y += point.y;
        buckets[best].z += point.z;
        buckets[best].count += 1;
      });

      centroids = buckets.map((bucket, index) => (
        bucket.count
          ? { x: bucket.x / bucket.count, y: bucket.y / bucket.count, z: bucket.z / bucket.count }
          : centroids[index]
      ));
    }
  };

  const schedulePCA = () => {
    if (pcaScheduled) return;
    pcaScheduled = true;
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 16));
    schedule(() => {
      pcaScheduled = false;
      if (!pcaDirty) return;
      pcaDirty = false;
      computePCA();
      syncDomNodes();
      updateThreePoints();
      saveMemory();
      updateReadout();
    }, { timeout: 700 });
  };

  const colorForCluster = (cluster = 0) => clusterColors[Math.abs(cluster) % clusterColors.length];

  const projectPoint = (point, time = renderTime) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const angle = time * 0.00009;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const baseScale = Math.min(width, height) * 0.34;
    const x = (point?.x || 0) * baseScale;
    const y = (point?.y || 0) * baseScale * 0.82;
    const z = (point?.z || 0) * baseScale;
    const rotatedX = x * cos - z * sin;
    const rotatedZ = x * sin + z * cos;
    const perspective = Math.max(520, baseScale * 2.4);
    const scale = clamp(perspective / (perspective + rotatedZ), 0.42, 1.8);

    return {
      x: width / 2 + rotatedX * scale,
      y: height / 2 - y * scale,
      z: rotatedZ,
      scale
    };
  };

  const syncDomNodes = () => {
    const visible = memory.slice(-MAX_VISIBLE_NODES);
    const visibleIds = new Set(visible.map((item) => item.id));

    Array.from(nodeById.entries()).forEach(([id, element]) => {
      if (!visibleIds.has(id)) {
        element.remove();
        nodeById.delete(id);
      }
    });

    visible.forEach((item) => {
      if (nodeById.has(item.id)) return;

      const node = document.createElement('div');
      const img = document.createElement('img');
      const seed = hashString(item.id);

      node.className = 'embedding-node';
      node.dataset.id = item.id;
      node.style.setProperty('--node-tilt', `${((seededUnit(seed, 1) - 0.5) * 18).toFixed(2)}deg`);
      node.style.setProperty('--node-vector-angle', `${Math.round((seededUnit(seed, 2) - 0.5) * 120)}deg`);
      img.src = item.url;
      img.alt = '';
      node.append(img);
      mapOverlay.append(node);
      nodeById.set(item.id, node);
    });
  };

  const positionNodes = (time) => {
    memory.slice(-MAX_VISIBLE_NODES).forEach((item) => {
      const node = nodeById.get(item.id);
      if (!node) return;

      const projected = projectPoint(item.pca || { x: 0, y: 0, z: 0 }, time);
      const color = colorForCluster(item.cluster);
      const age = Math.max(0, memory.length - 1 - memory.indexOf(item));
      const size = clamp(34 + item.score * 56 - age * 0.18, 26, 78);
      const opacity = item.id === latestItemId ? 0.98 : clamp(0.28 + projected.scale * 0.38 - age * 0.002, 0.22, 0.82);

      node.classList.toggle('is-current', item.id === latestItemId);
      node.style.setProperty('--node-screen-x', `${projected.x.toFixed(2)}px`);
      node.style.setProperty('--node-screen-y', `${projected.y.toFixed(2)}px`);
      node.style.setProperty('--node-scale', projected.scale.toFixed(3));
      node.style.setProperty('--node-z', String(Math.round(20 + projected.z)));
      node.style.setProperty('--node-size', `${size.toFixed(1)}px`);
      node.style.setProperty('--node-opacity', opacity.toFixed(2));
      node.style.setProperty('--node-color-rgb', color.join(', '));
    });
  };

  const resizeCanvas = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    if (ctx) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    if (threeState) {
      threeState.camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
      threeState.camera.updateProjectionMatrix();
      threeState.renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
  };

  const drawCanvasMap = (time) => {
    if (!ctx) {
      ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;
      ctx.setTransform(Math.min(window.devicePixelRatio || 1, 1.6), 0, 0, Math.min(window.devicePixelRatio || 1, 1.6), 0, 0);
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const axes = [
      { point: { x: 1.18, y: 0, z: 0 }, color: 'rgba(202, 255, 106, 0.48)' },
      { point: { x: 0, y: 1.18, z: 0 }, color: 'rgba(255, 209, 102, 0.48)' },
      { point: { x: 0, y: 0, z: 1.18 }, color: 'rgba(97, 219, 227, 0.48)' }
    ];

    ctx.save();
    ctx.lineWidth = 1;
    axes.forEach((axis) => {
      const end = projectPoint(axis.point, time);
      ctx.strokeStyle = axis.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    });

    for (let radius = 0.22; radius <= 1.1; radius += 0.22) {
      ctx.strokeStyle = `rgba(97, 219, 227, ${0.075 + radius * 0.025})`;
      ctx.beginPath();
      for (let step = 0; step <= 80; step += 1) {
        const angle = step / 80 * Math.PI * 2;
        const point = projectPoint({ x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius }, time);
        if (step === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    memory.forEach((item) => {
      const point = projectPoint(item.pca || { x: 0, y: 0, z: 0 }, time);
      const color = colorForCluster(item.cluster);
      const radius = item.id === latestItemId ? 4.8 : 2.2 + item.score * 2;
      ctx.fillStyle = `rgba(${color.join(', ')}, ${item.id === latestItemId ? 0.94 : 0.48})`;
      ctx.shadowColor = `rgba(${color.join(', ')}, 0.55)`;
      ctx.shadowBlur = item.id === latestItemId ? 18 : 8;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * point.scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  const initThree = async () => {
    try {
      const module = await Promise.race([
        import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('three timeout')), THREE_TIMEOUT_MS))
      ]);
      const THREE = module;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(46, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 100);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.position.set(0, 1.4, 6.4);

      const grid = new THREE.GridHelper(7, 16, 0x245b63, 0x17262d);
      grid.material.transparent = true;
      grid.material.opacity = 0.28;
      scene.add(grid);

      const axisMaterialX = new THREE.LineBasicMaterial({ color: 0xcaff6a, transparent: true, opacity: 0.62 });
      const axisMaterialY = new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.62 });
      const axisMaterialZ = new THREE.LineBasicMaterial({ color: 0x61dbe3, transparent: true, opacity: 0.62 });
      const makeAxis = (to, material) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), to]);
        scene.add(new THREE.Line(geometry, material));
      };
      makeAxis(new THREE.Vector3(3.2, 0, 0), axisMaterialX);
      makeAxis(new THREE.Vector3(0, 3.2, 0), axisMaterialY);
      makeAxis(new THREE.Vector3(0, 0, 3.2), axisMaterialZ);

      const pointGeometry = new THREE.BufferGeometry();
      const pointMaterial = new THREE.PointsMaterial({
        size: 0.065,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        depthWrite: false
      });
      const points = new THREE.Points(pointGeometry, pointMaterial);
      scene.add(points);

      threeState = { THREE, scene, camera, renderer, points, pointGeometry };
      addLearningLine('render', 'three.js: activo | escena: pca_3d');
      updateThreePoints();
    } catch (error) {
      console.warn(error);
      threeState = null;
      addLearningLine('render', 'three.js: fallback canvas | escena: pca_3d');
    }
  };

  const updateThreePoints = () => {
    if (!threeState) return;
    const { THREE, pointGeometry } = threeState;
    const positions = new Float32Array(memory.length * 3);
    const colors = new Float32Array(memory.length * 3);

    memory.forEach((item, index) => {
      const point = item.pca || { x: 0, y: 0, z: 0 };
      const color = colorForCluster(item.cluster);
      positions[index * 3] = point.x * 2.8;
      positions[index * 3 + 1] = point.y * 2.2;
      positions[index * 3 + 2] = point.z * 2.8;
      colors[index * 3] = color[0] / 255;
      colors[index * 3 + 1] = color[1] / 255;
      colors[index * 3 + 2] = color[2] / 255;
    });

    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pointGeometry.computeBoundingSphere();
  };

  const renderLoop = (time) => {
    renderTime = time;
    if (threeState) {
      const { camera, renderer, scene } = threeState;
      const angle = time * 0.00009;
      camera.position.x = Math.sin(angle) * 5.2;
      camera.position.z = Math.cos(angle) * 5.2;
      camera.position.y = 1.25 + Math.sin(time * 0.00017) * 0.45;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    } else {
      drawCanvasMap(time);
    }

    positionNodes(time);
    requestAnimationFrame(renderLoop);
  };

  const processNext = async () => {
    if (isProcessing) return;

    const image = getNextImage();
    if (!image) return;

    isProcessing = true;
    launchCount += 1;
    spawnRainFrame(image);

    try {
      await learnImage(image);
    } catch (error) {
      console.warn(error);
      addLearningLine('err', 'embedding: fallo | continua cola');
    } finally {
      isProcessing = false;
    }
  };

  if (queryForm && queryInput) {
    queryForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const nextQuery = queryInput.value.trim();
      if (!nextQuery) return;
      activeQuery = nextQuery;
      addLearningLine('query', `nuevo campo: ${truncateText(activeQuery, 34)}`);
      loadBatch({ replace: true, query: activeQuery });
    });
  }

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resizeCanvas, 120);
  });

  const boot = async () => {
    memory = loadMemory();
    resizeCanvas();
    syncDomNodes();
    fallbackPCA();
    updateReadout();
    updateCurrentReadout(memory.at(-1) || {
      label: 'esperando imagen',
      title: 'esperando imagen',
      novelty: 1,
      similarity: 0,
      score: 0,
      source: 'init'
    });
    const rendererReady = initThree();
    initModel();
    loadBatch().then(() => {
      if (!processTimer) {
        processTimer = window.setInterval(processNext, PROCESS_MS);
      }
      processNext();
    });
    await rendererReady;
    requestAnimationFrame(renderLoop);
  };

  boot();
})();
