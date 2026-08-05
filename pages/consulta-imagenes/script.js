(() => {
  const API_URL = 'https://commons.wikimedia.org/w/api.php';
  const DEFAULT_QUERY = 'scroll internet visual culture';
  const BATCH_SIZE = 20;
  const REFILL_AT = 6;
  const MAX_OFFSET = 420;
  const THUMB_WIDTH = 560;
  const SCROLL_DROP_STEP = 34;
  const PASSIVE_RAIN_MS = 1000;
  const MAX_ACTIVE_DROPS = 110;
  const SEGMENT_SAMPLE_MAX = 180;
  const SEGMENT_GRID_COLUMNS = 18;
  const SEGMENT_GRID_ROWS = 12;
  const MAX_VISUAL_SEGMENTS = 9;
  const MAX_FRAME_RETICLES = 3;
  const MAX_SEGMENT_MASKS = 3;
  const MAX_SELECTION_BOXES = 2;
  const VISION_MODEL_TIMEOUT_MS = 9000;
  const VISION_MODEL_SCRIPTS = [
    {
      src: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
      test: () => window.tf
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js',
      test: () => window.cocoSsd
    }
  ];
  const FALLBACK_QUERIES = [
    'net art screen',
    'digital archive',
    'internet culture',
    'city window night',
    'public domain photograph',
    'visual culture',
    'computer screen'
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

  const imageEl = document.getElementById('streamImage');
  const stage = document.querySelector('.stream-stage');
  const rainField = document.getElementById('rainField');
  const queryForm = document.getElementById('queryForm');
  const queryInput = document.getElementById('queryInput');
  const pauseButton = document.getElementById('pauseButton');
  const nextButton = document.getElementById('nextButton');
  const sourceLink = document.getElementById('sourceLink');
  const statusLine = document.getElementById('statusLine');
  const imageTitle = document.getElementById('imageTitle');
  const imageCredit = document.getElementById('imageCredit');
  const queryLabel = document.getElementById('queryLabel');
  const poolLabel = document.getElementById('poolLabel');
  const licenseLabel = document.getElementById('licenseLabel');
  const counterLabel = document.getElementById('counterLabel');
  const learningSelection = document.getElementById('learningSelection');
  const learningLog = document.getElementById('learningLog');
  const frameStrip = document.getElementById('frameStrip');
  const mlCycle = document.getElementById('mlCycle');
  const mlScore = document.getElementById('mlScore');
  const mlContext = document.getElementById('mlContext');
  const mlSemantic = document.getElementById('mlSemantic');
  const embeddingBars = document.getElementById('embeddingBars');
  const llmSpeech = document.getElementById('llmSpeech');
  const llmTokens = document.getElementById('llmTokens');
  const yoloLayer = document.getElementById('yoloLayer');
  const sectorMap = document.getElementById('sectorMap');
  const segmentationLayer = document.getElementById('segmentationLayer');

  let activeQuery = DEFAULT_QUERY;
  let imagePool = [];
  let seenImages = new Set();
  let nextImageIndex = 0;
  let launchCount = 0;
  let fallbackIndex = 0;
  let isPaused = false;
  let isLoadingBatch = false;
  let loadingPromise = null;
  let timerId = null;
  let lastScrollY = window.scrollY;
  let scrollAccumulator = 0;
  let learningCycle = 0;
  let frameMemory = [];
  let lastLearningImageId = '';
  let lastLearningEnergy = 1;
  let localFallbackBatch = 0;

  const visionModelState = {
    status: 'idle',
    source: 'canvas-pixels',
    detector: null,
    promise: null
  };

  const segmentCanvas = document.createElement('canvas');
  const segmentContext = segmentCanvas.getContext('2d', { willReadFrequently: true });

  const CONTEXTS = [
    'archivo visual',
    'ruido de red',
    'gesto scroll',
    'objeto encontrado',
    'pantalla cotidiana',
    'memoria publica',
    'cuerpo entrenado',
    'deriva semantica'
  ];

  const STOP_WORDS = new Set([
    'the', 'and', 'with', 'from', 'file', 'image', 'photo', 'jpg', 'jpeg',
    'png', 'commons', 'wikimedia', 'una', 'uno', 'las', 'los', 'del', 'para',
    'con', 'por', 'sin', 'que', 'de', 'la', 'el', 'en'
  ]);

  const SECTOR_NAMES = [
    'arriba izquierda',
    'arriba centro',
    'arriba derecha',
    'centro izquierda',
    'centro',
    'centro derecha',
    'abajo izquierda',
    'abajo centro',
    'abajo derecha'
  ];

  const SECTOR_SIGNALS = [
    'fondo',
    'luz',
    'borde',
    'textura',
    'sujeto',
    'movimiento',
    'ruido',
    'objeto',
    'contexto'
  ];

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const hashString = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const cosineSimilarity = (a, b) => {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      dot += a[index] * b[index];
      normA += a[index] * a[index];
      normB += b[index] * b[index];
    }

    if (!normA || !normB) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const seededUnit = (seed, index) => {
    const wave = Math.sin(seed * (index + 1) * 0.000017 + index * 1.618);
    return (wave + 1) / 2;
  };

  const average = (items, field) => {
    if (!items.length) return 0;
    return items.reduce((sum, item) => sum + (item[field] || 0), 0) / items.length;
  };

  const getColorToken = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

    if (luma < 0.2) return 'sombra';
    if (luma > 0.82 && delta < 34) return 'luz blanca';
    if (delta < 28) return 'gris';
    if (max === r && g > 145) return 'amarillo';
    if (max === r && b > 135) return 'magenta';
    if (max === g && b > 135) return 'cian';
    if (max === r) return 'rojo';
    if (max === g) return 'verde';
    if (max === b) return 'azul';
    return 'color mixto';
  };

  const getRegionNameFromPoint = (x, y) => {
    const column = x < 0.34 ? 0 : x > 0.66 ? 2 : 1;
    const row = y < 0.34 ? 0 : y > 0.66 ? 2 : 1;
    return SECTOR_NAMES[row * 3 + column] || 'region visual';
  };

  const classifyPixelRegion = (region) => {
    if (region.centerBias > 0.72 && region.edge > 0.15) return 'sujeto probable';
    if (region.edge > 0.24 && region.area < 0.18) return 'contorno activo';
    if (region.saturation > 0.48 && region.edge > 0.12) return 'masa cromatica';
    if (region.luma > 0.72) return 'zona luminosa';
    if (region.luma < 0.24) return 'sombra profunda';
    if (region.area > 0.3 && region.edge < 0.13) return 'plano continuo';
    return 'textura visual';
  };

  const tokenize = (value) => (
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  );

  const createVisualRegion = (members, columns, rows, fallbackIndex = 0) => {
    const safeMembers = members.length ? members : [{
      col: fallbackIndex % columns,
      row: Math.floor(fallbackIndex / columns),
      red: 90,
      green: 120,
      blue: 135,
      luma: 0.45,
      saturation: 0.18,
      edge: 0.08,
      salience: 0.1
    }];
    const minCol = Math.min(...safeMembers.map((cell) => cell.col));
    const maxCol = Math.max(...safeMembers.map((cell) => cell.col));
    const minRow = Math.min(...safeMembers.map((cell) => cell.row));
    const maxRow = Math.max(...safeMembers.map((cell) => cell.row));
    const red = Math.round(average(safeMembers, 'red'));
    const green = Math.round(average(safeMembers, 'green'));
    const blue = Math.round(average(safeMembers, 'blue'));
    const x = minCol / columns;
    const y = minRow / rows;
    const width = (maxCol - minCol + 1) / columns;
    const height = (maxRow - minRow + 1) / rows;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const area = clamp(safeMembers.length / (columns * rows), 0.01, 1);
    const centerBias = clamp(1 - Math.hypot(centerX - 0.5, centerY - 0.5) / 0.72, 0, 1);
    const region = {
      x,
      y,
      width,
      height,
      centerX,
      centerY,
      area,
      centerBias,
      red,
      green,
      blue,
      colorLabel: getColorToken(red, green, blue),
      luma: average(safeMembers, 'luma'),
      saturation: average(safeMembers, 'saturation'),
      edge: average(safeMembers, 'edge'),
      salience: clamp(
        average(safeMembers, 'salience') * 0.42 + area * 0.22 + centerBias * 0.18 + average(safeMembers, 'edge') * 0.18,
        0.01,
        0.99
      )
    };

    region.name = getRegionNameFromPoint(centerX, centerY);
    region.label = classifyPixelRegion(region);
    region.signal = region.label.split(' ')[0] || 'mask';
    region.confidence = clamp(0.22 + region.salience * 0.76, 0.01, 0.99);
    return region;
  };

  const buildPixelCells = (data, width, height, columns, rows) => {
    const cells = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const startX = Math.floor((col / columns) * width);
        const endX = Math.max(startX + 1, Math.floor(((col + 1) / columns) * width));
        const startY = Math.floor((row / rows) * height);
        const endY = Math.max(startY + 1, Math.floor(((row + 1) / rows) * height));
        let red = 0;
        let green = 0;
        let blue = 0;
        let luma = 0;
        let saturation = 0;
        let edge = 0;
        let count = 0;

        for (let y = startY; y < endY; y += 1) {
          for (let x = startX; x < endX; x += 1) {
            const offset = (y * width + x) * 4;
            const alpha = data[offset + 3] / 255;
            if (alpha < 0.08) continue;

            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const pixelLuma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            let localEdge = 0;

            if (x > 0) {
              const leftOffset = (y * width + x - 1) * 4;
              const leftLuma = (
                0.2126 * data[leftOffset] +
                0.7152 * data[leftOffset + 1] +
                0.0722 * data[leftOffset + 2]
              ) / 255;
              localEdge += Math.abs(pixelLuma - leftLuma);
            }

            if (y > 0) {
              const topOffset = ((y - 1) * width + x) * 4;
              const topLuma = (
                0.2126 * data[topOffset] +
                0.7152 * data[topOffset + 1] +
                0.0722 * data[topOffset + 2]
              ) / 255;
              localEdge += Math.abs(pixelLuma - topLuma);
            }

            red += r;
            green += g;
            blue += b;
            luma += pixelLuma;
            saturation += max ? (max - min) / max : 0;
            edge += localEdge / 2;
            count += 1;
          }
        }

        if (!count) count = 1;
        const cell = {
          col,
          row,
          red: red / count,
          green: green / count,
          blue: blue / count,
          luma: luma / count,
          saturation: saturation / count,
          edge: edge / count
        };

        cell.salience = clamp(
          cell.edge * 0.52 + cell.saturation * 0.24 + Math.abs(cell.luma - 0.5) * 0.16 + seededUnit(hashString(`${col}-${row}`), 1) * 0.08,
          0.01,
          0.99
        );
        cells.push(cell);
      }
    }

    return cells;
  };

  const getMetricSpread = (items, field, mean) => {
    if (!items.length) return 0;
    const variance = items.reduce((sum, item) => sum + (item[field] - mean) ** 2, 0) / items.length;
    return Math.sqrt(variance);
  };

  const buildDetailVisualRegions = (members, columns, rows, limit = 3) => {
    const candidates = [...members]
      .sort((a, b) => b.salience - a.salience)
      .slice(0, Math.min(members.length, limit * 4));
    const selected = [];

    for (const cell of candidates) {
      const region = createVisualRegion([cell], columns, rows, cell.row * columns + cell.col);
      const duplicate = selected.some((existing) => (
        Math.hypot(region.centerX - existing.centerX, region.centerY - existing.centerY) < 0.09
      ));

      if (!duplicate && region.salience > 0.08) {
        region.label = classifyPixelRegion(region);
        region.signal = 'detalle';
        selected.push(region);
      }

      if (selected.length >= limit) break;
    }

    return selected;
  };

  const buildConnectedVisualSegments = (cells, columns, rows) => {
    const meanEdge = average(cells, 'edge');
    const meanSaturation = average(cells, 'saturation');
    const meanLuma = average(cells, 'luma');
    const edgeSpread = getMetricSpread(cells, 'edge', meanEdge);
    const saturationSpread = getMetricSpread(cells, 'saturation', meanSaturation);
    const lumaSpread = getMetricSpread(cells, 'luma', meanLuma);
    const active = cells.map((cell) => (
      cell.edge > meanEdge + edgeSpread * 0.35 ||
      cell.saturation > meanSaturation + saturationSpread * 0.55 ||
      Math.abs(cell.luma - meanLuma) > lumaSpread * 0.72
    ));

    [...cells]
      .sort((a, b) => b.salience - a.salience)
      .slice(0, 8)
      .forEach((cell) => {
        active[cell.row * columns + cell.col] = true;
      });

    const visited = new Set();
    const segments = [];

    for (let index = 0; index < cells.length; index += 1) {
      if (!active[index] || visited.has(index)) continue;

      const stack = [index];
      const members = [];
      visited.add(index);

      while (stack.length) {
        const current = stack.pop();
        const cell = cells[current];
        members.push(cell);

        [
          [cell.col - 1, cell.row],
          [cell.col + 1, cell.row],
          [cell.col, cell.row - 1],
          [cell.col, cell.row + 1]
        ].forEach(([nextCol, nextRow]) => {
          if (nextCol < 0 || nextCol >= columns || nextRow < 0 || nextRow >= rows) return;
          const nextIndex = nextRow * columns + nextCol;
          if (!active[nextIndex] || visited.has(nextIndex)) return;
          visited.add(nextIndex);
          stack.push(nextIndex);
        });
      }

      const region = createVisualRegion(members, columns, rows, index);

      if (region.area > 0.18 || region.width > 0.36 || region.height > 0.36) {
        segments.push(...buildDetailVisualRegions(members, columns, rows, 3));
      } else {
        segments.push(region);
      }
    }

    return segments
      .sort((a, b) => b.salience - a.salience)
      .slice(0, MAX_VISUAL_SEGMENTS);
  };

  const buildSectorStats = (cells, columns, rows) => SECTOR_NAMES.map((name, index) => {
    const sectorCol = index % 3;
    const sectorRow = Math.floor(index / 3);
    const minCol = Math.floor((sectorCol / 3) * columns);
    const maxCol = Math.ceil(((sectorCol + 1) / 3) * columns);
    const minRow = Math.floor((sectorRow / 3) * rows);
    const maxRow = Math.ceil(((sectorRow + 1) / 3) * rows);
    const members = cells.filter((cell) => (
      cell.col >= minCol &&
      cell.col < maxCol &&
      cell.row >= minRow &&
      cell.row < maxRow
    ));
    const region = createVisualRegion(members, columns, rows, index);

    return {
      ...region,
      name,
      signal: SECTOR_SIGNALS[index],
      label: classifyPixelRegion(region),
      confidence: clamp(region.confidence * 0.72 + region.edge * 0.18 + region.saturation * 0.1, 0.01, 0.99)
    };
  });

  const buildMetadataSegmentation = (image, source = 'metadata-size') => {
    const ratio = clamp(image.width / Math.max(1, image.height), 0.35, 2.4);
    const width = ratio > 1.25 ? 0.48 : 0.34;
    const height = ratio > 1.25 ? 0.28 : 0.42;
    const region = {
      x: 0.5 - width / 2,
      y: 0.5 - height / 2,
      width,
      height,
      centerX: 0.5,
      centerY: 0.5,
      area: width * height,
      centerBias: 1,
      red: 96,
      green: 130,
      blue: 150,
      colorLabel: 'sin pixel',
      luma: 0.5,
      saturation: 0.12,
      edge: 0.08,
      salience: 0.22,
      name: 'centro',
      label: 'zona estimada',
      signal: 'metadata',
      confidence: 0.32
    };

    return {
      source,
      status: 'estimated',
      meanLuma: 0.5,
      meanSaturation: 0.12,
      meanContrast: 0.08,
      dominantColor: 'sin pixel',
      maskCoverage: region.area,
      segments: [region],
      sectorStats: SECTOR_NAMES.map((name, index) => ({
        ...region,
        name,
        signal: SECTOR_SIGNALS[index],
        confidence: clamp(region.confidence - index * 0.01, 0.08, 0.32)
      }))
    };
  };

  const buildCanvasSegmentation = (sourceImage, image) => {
    if (!segmentContext) return buildMetadataSegmentation(image, 'canvas-unavailable');

    const naturalWidth = sourceImage.naturalWidth || sourceImage.width || image.width || THUMB_WIDTH;
    const naturalHeight = sourceImage.naturalHeight || sourceImage.height || image.height || Math.round(THUMB_WIDTH * 0.72);
    const scale = Math.min(1, SEGMENT_SAMPLE_MAX / Math.max(naturalWidth, naturalHeight));
    const sampleWidth = Math.max(24, Math.round(naturalWidth * scale));
    const sampleHeight = Math.max(24, Math.round(naturalHeight * scale));

    try {
      segmentCanvas.width = sampleWidth;
      segmentCanvas.height = sampleHeight;
      segmentContext.clearRect(0, 0, sampleWidth, sampleHeight);
      segmentContext.drawImage(sourceImage, 0, 0, sampleWidth, sampleHeight);

      const { data } = segmentContext.getImageData(0, 0, sampleWidth, sampleHeight);
      const cells = buildPixelCells(data, sampleWidth, sampleHeight, SEGMENT_GRID_COLUMNS, SEGMENT_GRID_ROWS);
      const segments = buildConnectedVisualSegments(cells, SEGMENT_GRID_COLUMNS, SEGMENT_GRID_ROWS);
      const sectorStats = buildSectorStats(cells, SEGMENT_GRID_COLUMNS, SEGMENT_GRID_ROWS);
      const red = Math.round(average(cells, 'red'));
      const green = Math.round(average(cells, 'green'));
      const blue = Math.round(average(cells, 'blue'));

      return {
        source: 'canvas-pixels',
        status: 'ready',
        width: naturalWidth,
        height: naturalHeight,
        sampleWidth,
        sampleHeight,
        meanLuma: average(cells, 'luma'),
        meanSaturation: average(cells, 'saturation'),
        meanContrast: average(cells, 'edge'),
        dominantColor: getColorToken(red, green, blue),
        maskCoverage: clamp(segments.reduce((sum, segment) => sum + segment.area, 0), 0.01, 1),
        segments,
        sectorStats
      };
    } catch (error) {
      image.pixelError = error instanceof Error ? error.message : 'canvas blocked';
      return buildMetadataSegmentation(image, 'canvas-blocked');
    }
  };

  const getClosestVisualRegion = (regions, x, y) => {
    if (!regions?.length) return null;
    return regions.reduce((closest, region) => {
      const distance = Math.hypot(region.centerX - x, region.centerY - y);
      if (!closest || distance < closest.distance) {
        return { region, distance };
      }
      return closest;
    }, null)?.region || null;
  };

  const getVisualSegmentation = (image) => {
    if (image.modelSegmentation?.segments?.length) return image.modelSegmentation;
    if (image.pixelSegmentation?.segments?.length) return image.pixelSegmentation;
    return buildMetadataSegmentation(image);
  };

  const truncateText = (value, maxLength = 34) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
  };

  const getSafeRegionBox = (region = {}, padding = 0) => {
    const area = clamp(region.area || 0.08, 0.008, 0.72);
    const fallbackSize = Math.sqrt(area);
    const sourceWidth = Number.isFinite(region.width) ? region.width : fallbackSize * 1.16;
    const sourceHeight = Number.isFinite(region.height) ? region.height : fallbackSize * 0.86;
    const maxWidth = region.model ? 0.46 : 0.24;
    const maxHeight = region.model ? 0.42 : 0.22;
    const width = clamp(sourceWidth + padding * 2, 0.045, maxWidth);
    const height = clamp(sourceHeight + padding * 2, 0.045, maxHeight);
    const centerX = Number.isFinite(region.centerX)
      ? region.centerX
      : Number.isFinite(region.x)
        ? region.x + sourceWidth / 2
        : 0.5;
    const centerY = Number.isFinite(region.centerY)
      ? region.centerY
      : Number.isFinite(region.y)
        ? region.y + sourceHeight / 2
        : 0.5;
    const rawX = centerX - width / 2;
    const rawY = centerY - height / 2;
    const x = clamp(rawX, 0, Math.max(0, 1 - width));
    const y = clamp(rawY, 0, Math.max(0, 1 - height));

    return {
      x,
      y,
      width,
      height,
      centerX: clamp(x + width / 2, 0, 1),
      centerY: clamp(y + height / 2, 0, 1)
    };
  };

  const getRegionDisplayScore = (region, source = 'unknown') => {
    const box = getSafeRegionBox(region);
    const sourceWidth = Number.isFinite(region.width) ? region.width : box.width;
    const sourceHeight = Number.isFinite(region.height) ? region.height : box.height;
    const rawArea = clamp(sourceWidth * sourceHeight, 0.008, 1);
    const area = clamp(region.area || rawArea, 0.008, 0.72);
    const aspect = sourceWidth / Math.max(0.01, sourceHeight);
    const confidence = clamp(region.confidence || region.salience || 0.18, 0.01, 0.99);
    const salience = clamp(region.salience || confidence, 0.01, 0.99);
    const centerBias = clamp(region.centerBias || (1 - Math.hypot(box.centerX - 0.5, box.centerY - 0.5) / 0.72), 0, 1);
    const areaFit = clamp(1 - Math.abs(area - 0.11) / 0.26, 0, 1);
    const aspectFit = clamp(1 - Math.abs(Math.log(aspect)) / 1.65, 0, 1);
    const hugePenalty = !region.model && (rawArea > 0.42 || sourceWidth > 0.82 || sourceHeight > 0.82) ? 0.3 : 0;
    const sourceBoost = region.model ? 0.2 : source === 'canvas-pixels' ? 0.08 : 0;

    return clamp(
      confidence * 0.34 +
      salience * 0.25 +
      centerBias * 0.1 +
      areaFit * 0.1 +
      aspectFit * 0.08 +
      (region.edge || 0) * 0.1 +
      (region.saturation || 0) * 0.07 +
      sourceBoost -
      hugePenalty,
      0.01,
      0.99
    );
  };

  const getBoxOverlapRatio = (regionA, regionB) => {
    const a = getSafeRegionBox(regionA);
    const b = getSafeRegionBox(regionB);
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    const intersection = width * height;
    const smallerArea = Math.min(a.width * a.height, b.width * b.height);

    return smallerArea ? intersection / smallerArea : 0;
  };

  const normalizeVisualRegion = (region, index, source) => {
    const box = getSafeRegionBox(region);
    const rawWidth = Number.isFinite(region.width) ? region.width : box.width;
    const rawHeight = Number.isFinite(region.height) ? region.height : box.height;
    const rawArea = clamp(rawWidth * rawHeight, 0.008, 1);
    const confidence = clamp(region.confidence || region.salience || 0.18, 0.01, 0.99);

    return {
      ...region,
      ...box,
      area: clamp(region.area || box.width * box.height, 0.008, 0.72),
      rawWidth,
      rawHeight,
      rawArea,
      centerBias: clamp(region.centerBias || (1 - Math.hypot(box.centerX - 0.5, box.centerY - 0.5) / 0.72), 0, 1),
      confidence,
      salience: clamp(region.salience || confidence, 0.01, 0.99),
      name: region.name || getRegionNameFromPoint(box.centerX, box.centerY),
      signal: region.signal || SECTOR_SIGNALS[index % SECTOR_SIGNALS.length],
      label: region.label || region.signal || 'region visual',
      visualSource: source,
      displayScore: getRegionDisplayScore(region, source)
    };
  };

  const getRankedVisualRegions = (visual = {}, limit = MAX_FRAME_RETICLES) => {
    const source = visual.source || 'unknown';
    if (/metadata|canvas-blocked|canvas-unavailable/i.test(source)) return [];

    const sourceRegions = visual.segments?.length ? visual.segments : (visual.sectorStats || []);
    const regions = sourceRegions
      .map((region, index) => normalizeVisualRegion(region, index, source))
      .filter((region) => (
        Number.isFinite(region.x) &&
        Number.isFinite(region.y) &&
        region.width > 0.02 &&
        region.height > 0.02 &&
        (region.model || (region.rawArea < 0.42 && region.rawWidth < 0.86 && region.rawHeight < 0.86))
      ))
      .sort((a, b) => b.displayScore - a.displayScore);

    const selected = [];

    for (const region of regions) {
      const duplicate = selected.some((existing) => (
        getBoxOverlapRatio(region, existing) > 0.62 ||
        Math.hypot(region.centerX - existing.centerX, region.centerY - existing.centerY) < 0.07
      ));

      if (!duplicate) {
        selected.push(region);
      }

      if (selected.length >= limit) break;
    }

    return selected;
  };

  const getDisplayRegionsForCycle = (visual = {}, cycle = 0, limit = MAX_FRAME_RETICLES) => {
    const ranked = getRankedVisualRegions(visual, Math.max(limit + 3, MAX_FRAME_RETICLES));
    if (!ranked.length) return [];

    const focusPoolSize = Math.min(ranked.length, Math.max(1, Math.min(3, limit)));
    const focusIndex = Math.max(0, cycle - 1) % focusPoolSize;
    const primary = { ...ranked[focusIndex], focusRole: 'primary' };
    const secondary = ranked
      .filter((_, index) => index !== focusIndex)
      .slice(0, limit - 1)
      .map((region, index) => ({
        ...region,
        focusRole: index === 0 ? 'secondary' : 'support'
      }));

    return [primary, ...secondary].slice(0, limit);
  };

  const getCompactRegionLabel = (region, fallback = 'region') => {
    const label = String(region?.label || region?.signal || fallback)
      .replace(/^objeto\s+/i, '')
      .replace(/\s*\|\s*.*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const color = region?.colorLabel && !/sin pixel|modelo/i.test(region.colorLabel)
      ? region.colorLabel
      : '';
    const area = region?.area ? `${Math.round(region.area * 100)}%` : '';

    return truncateText([label || fallback, color, area].filter(Boolean).join(' '), 36);
  };

  const getObjectLabel = (label = '') => {
    const normalized = String(label || '').toLowerCase().trim();
    const labels = {
      person: 'persona',
      tie: 'corbata',
      backpack: 'mochila',
      handbag: 'bolso',
      suitcase: 'maleta',
      bottle: 'botella',
      cup: 'vaso',
      chair: 'silla',
      couch: 'sofa',
      tv: 'pantalla',
      laptop: 'laptop',
      keyboard: 'teclado',
      mouse: 'mouse',
      cell_phone: 'celular',
      'cell phone': 'celular',
      book: 'libro',
      clock: 'reloj',
      sports_ball: 'balon',
      'sports ball': 'balon',
      car: 'auto',
      bicycle: 'bicicleta',
      motorcycle: 'moto',
      bus: 'bus',
      truck: 'camion'
    };

    return labels[normalized] || normalized.replace(/_/g, ' ') || 'objeto';
  };

  const getShapeLabel = (region = {}) => {
    const box = getSafeRegionBox(region);
    const aspect = box.width / Math.max(0.01, box.height);
    const area = clamp(region.rawArea || region.area || box.width * box.height, 0.001, 1);

    if (region.edge > 0.18 && aspect > 2.2) return 'borde horizontal';
    if (region.edge > 0.18 && aspect < 0.46) return 'borde vertical';
    if (region.edge > 0.24 && area < 0.035) return 'detalle duro';
    if (region.saturation > 0.5 && area < 0.18) return 'forma color';
    if (region.luma > 0.72) return 'zona luminosa';
    if (region.luma < 0.25) return 'sombra';
    if (area < 0.035) return 'detalle';
    return 'textura';
  };

  const getYoloDetections = (analysis, limit = 6) => {
    const visual = analysis.visual || {};
    const isModel = visual.source === 'cdn-coco-ssd';
    const requestedLimit = isModel ? limit : Math.min(4, limit);

    return getRankedVisualRegions(visual, requestedLimit + 3)
      .filter((region) => {
        const box = getSafeRegionBox(region);
        const area = box.width * box.height;
        if (region.model) return region.confidence >= 0.34 && area >= 0.002;
        return (
          region.displayScore >= 0.22 &&
          area >= 0.002 &&
          area <= 0.16 &&
          box.width <= 0.32 &&
          box.height <= 0.3
        );
      })
      .slice(0, requestedLimit)
      .map((region, index) => {
        const box = getSafeRegionBox(region, region.model ? 0.004 : 0.002);
        const confidence = clamp(region.confidence || region.displayScore || region.salience || 0.2, 0.01, 0.99);
        const label = region.model
          ? getObjectLabel(region.signal || region.label)
          : getShapeLabel(region);

        return {
          ...region,
          ...box,
          id: `yolo_${analysis.cycle}_${index}`,
          label,
          confidence,
          source: region.model ? 'COCO' : 'SHAPE',
          color: `${Math.round(region.red || 202)}, ${Math.round(region.green || 255)}, ${Math.round(region.blue || 106)}`
        };
      });
  };

  const ensureEmbeddingBars = () => {
    if (!embeddingBars || embeddingBars.children.length) return;
    for (let index = 0; index < 16; index += 1) {
      embeddingBars.append(document.createElement('span'));
    }
  };

  const ensureSectorMap = () => {
    if (!sectorMap || sectorMap.querySelector('.sector-cell')) return;

    SECTOR_NAMES.forEach((name) => {
      const cell = document.createElement('div');
      const tag = document.createElement('span');

      cell.className = 'sector-cell';
      cell.dataset.sector = name;
      tag.className = 'sector-tag';
      tag.textContent = `${name} // esperando`;
      cell.append(tag);
      sectorMap.append(cell);
    });

    const core = document.createElement('div');
    core.className = 'sector-core';
    sectorMap.append(core);
  };

  const updateSectorMapBounds = () => {
    if (!sectorMap || !imageEl || !imageEl.naturalWidth || !imageEl.naturalHeight) return;

    const imageBox = imageEl.getBoundingClientRect();
    const styles = window.getComputedStyle(imageEl);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;
    const contentWidth = Math.max(1, imageBox.width - paddingLeft - paddingRight);
    const contentHeight = Math.max(1, imageBox.height - paddingTop - paddingBottom);
    const imageRatio = imageEl.naturalWidth / Math.max(1, imageEl.naturalHeight);
    const contentRatio = contentWidth / contentHeight;
    const renderedWidth = contentRatio > imageRatio ? contentHeight * imageRatio : contentWidth;
    const renderedHeight = contentRatio > imageRatio ? contentHeight : contentWidth / imageRatio;

    [yoloLayer, sectorMap, segmentationLayer, learningSelection].forEach((layer) => {
      if (!layer) return;
      layer.style.left = `${paddingLeft + (contentWidth - renderedWidth) / 2}px`;
      layer.style.top = `${paddingTop + (contentHeight - renderedHeight) / 2}px`;
      layer.style.width = `${renderedWidth}px`;
      layer.style.height = `${renderedHeight}px`;
      layer.style.right = 'auto';
      layer.style.bottom = 'auto';
    });
  };

  const setStatus = (message) => {
    statusLine.textContent = message;
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

  const shuffle = (items) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
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
    const source = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURI(sourceTitle)}`;

    return {
      id: `${page.pageid || source}-${url}`,
      title: title || 'Imagen sin titulo',
      credit: credit || 'Wikimedia Commons',
      license: license || 'licencia abierta',
      url,
      source,
      width: info.thumbwidth || info.width || THUMB_WIDTH,
      height: info.thumbheight || info.height || Math.round(THUMB_WIDTH * 0.72),
      ready: false,
      failed: false,
      loadingPromise: null,
      pixelSegmentation: null,
      modelSegmentation: null,
      modelSegmentationPromise: null
    };
  };

  const buildLocalFallbackImages = () => {
    localFallbackBatch += 1;
    return LOCAL_FALLBACK_IMAGES.map((image, index) => ({
      ...image,
      id: `${image.id}-${localFallbackBatch}-${index}`,
      source: image.url,
      width: THUMB_WIDTH,
      height: Math.round(THUMB_WIDTH * 0.72),
      ready: false,
      failed: false,
      loadingPromise: null,
      pixelSegmentation: null,
      modelSegmentation: null,
      modelSegmentationPromise: null
    }));
  };

  const preloadImage = (image) => {
    if (image.ready || image.failed) {
      return Promise.resolve(image.ready);
    }

    if (image.loadingPromise) {
      return image.loadingPromise;
    }

    image.loadingPromise = new Promise((resolve) => {
      const preload = new Image();
      preload.crossOrigin = 'anonymous';
      preload.decoding = 'async';

      preload.onload = () => {
        image.ready = true;
        image.width = preload.naturalWidth || image.width;
        image.height = preload.naturalHeight || image.height;
        image.pixelSegmentation = buildCanvasSegmentation(preload, image);
        if (visionModelState.status === 'ready') {
          queueModelSegmentation(image, preload);
        }
        resolve(true);
      };

      preload.onerror = () => {
        image.failed = true;
        resolve(false);
      };

      preload.src = image.url;
    });

    return image.loadingPromise;
  };

  const cacheBatch = async (images) => {
    await Promise.all(images.map(preloadImage));
    return images.filter((image) => image.ready && !image.failed);
  };

  const fetchImages = async (query, offset) => {
    const response = await fetch(buildApiURL(query, offset), { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Respuesta ${response.status}`);
    }

    const data = await response.json();
    const pages = data.query?.pages || [];
    return pages.map(pageToImage).filter(Boolean);
  };

  const unusedImages = () => imagePool.slice(nextImageIndex).filter((image) => image.ready && !image.failed);

  const updateReadout = () => {
    const readyUnused = unusedImages().length;
    const totalUnused = imagePool.slice(nextImageIndex).filter((image) => !image.failed).length || BATCH_SIZE;
    queryLabel.textContent = activeQuery;
    poolLabel.textContent = `${String(readyUnused).padStart(2, '0')}/${totalUnused}`;
  };

  const addLearningLine = (tag, message) => {
    if (!learningLog) return;

    const item = document.createElement('li');
    const label = document.createElement('strong');
    const copy = document.createElement('span');

    label.textContent = tag;
    copy.textContent = message;
    item.append(label, copy);
    learningLog.append(item);

    while (learningLog.children.length > 9) {
      learningLog.firstElementChild?.remove();
    }
  };

  const loadExternalVisionScript = ({ src, test }) => new Promise((resolve, reject) => {
    if (test()) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[data-vision-src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`No cargo ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timeout ${src}`));
    }, VISION_MODEL_TIMEOUT_MS);

    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.visionSrc = src;
    script.onload = () => {
      window.clearTimeout(timer);
      if (test()) {
        resolve();
      } else {
        reject(new Error(`Modelo no expuesto ${src}`));
      }
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`No cargo ${src}`));
    };

    document.head.append(script);
  });

  const initVisionModel = () => {
    if (visionModelState.promise) return visionModelState.promise;

    visionModelState.status = 'loading';
    visionModelState.promise = (async () => {
      try {
        for (const script of VISION_MODEL_SCRIPTS) {
          await loadExternalVisionScript(script);
        }

        if (!window.cocoSsd?.load) {
          throw new Error('coco-ssd no disponible');
        }

        visionModelState.detector = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        visionModelState.status = 'ready';
        visionModelState.source = 'cdn-coco-ssd';
        addLearningLine('vision', 'modelo: coco-ssd | fuente: cdn | status: ready');
        return visionModelState.detector;
      } catch (error) {
        console.warn(error);
        visionModelState.status = 'fallback';
        visionModelState.source = 'canvas-pixels';
        addLearningLine('vision', 'modelo: unavailable | fallback: canvas_pixeles | status: real_pixels');
        return null;
      }
    })();

    return visionModelState.promise;
  };

  const loadImageProbe = (image) => new Promise((resolve) => {
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.decoding = 'async';
    probe.onload = () => resolve(probe);
    probe.onerror = () => resolve(null);
    probe.src = image.url;
  });

  const buildModelSegmentation = (image, predictions) => {
    const pixelSegmentation = image.pixelSegmentation || buildMetadataSegmentation(image);
    const sourceRegions = pixelSegmentation.segments || pixelSegmentation.sectorStats || [];
    const segments = predictions
      .filter((prediction) => prediction.score >= 0.34 && Array.isArray(prediction.bbox))
      .slice(0, MAX_VISUAL_SEGMENTS)
      .map((prediction) => {
        const [boxX, boxY, boxWidth, boxHeight] = prediction.bbox;
        const width = Math.max(1, image.width || pixelSegmentation.width || THUMB_WIDTH);
        const height = Math.max(1, image.height || pixelSegmentation.height || Math.round(THUMB_WIDTH * 0.72));
        const x = clamp(boxX / width, 0, 0.96);
        const y = clamp(boxY / height, 0, 0.96);
        const regionWidth = clamp(boxWidth / width, 0.04, 1);
        const regionHeight = clamp(boxHeight / height, 0.04, 1);
        const centerX = clamp(x + regionWidth / 2, 0, 1);
        const centerY = clamp(y + regionHeight / 2, 0, 1);
        const supportingRegion = getClosestVisualRegion(sourceRegions, centerX, centerY);
        const area = clamp(regionWidth * regionHeight, 0.01, 1);
        const confidence = clamp(prediction.score, 0.01, 0.99);

        return {
          x,
          y,
          width: regionWidth,
          height: regionHeight,
          centerX,
          centerY,
          area,
          centerBias: clamp(1 - Math.hypot(centerX - 0.5, centerY - 0.5) / 0.72, 0, 1),
          red: supportingRegion?.red || 104,
          green: supportingRegion?.green || 176,
          blue: supportingRegion?.blue || 188,
          colorLabel: supportingRegion?.colorLabel || 'modelo',
          luma: supportingRegion?.luma || pixelSegmentation.meanLuma || 0.5,
          saturation: supportingRegion?.saturation || pixelSegmentation.meanSaturation || 0.22,
          edge: supportingRegion?.edge || pixelSegmentation.meanContrast || 0.12,
          salience: clamp(confidence * 0.72 + area * 0.18, 0.01, 0.99),
          name: getRegionNameFromPoint(centerX, centerY),
          signal: prediction.class || 'object',
          label: `objeto ${prediction.class || 'detectado'}`,
          confidence,
          model: true
        };
      });

    if (!segments.length) return null;

    return {
      ...pixelSegmentation,
      source: 'cdn-coco-ssd',
      status: 'model',
      modelObjects: segments.length,
      maskCoverage: clamp(segments.reduce((sum, segment) => sum + segment.area, 0), 0.01, 1),
      segments
    };
  };

  const queueModelSegmentation = (image, element = null) => {
    if (!image || image.modelSegmentation?.segments?.length) {
      return Promise.resolve(image?.modelSegmentation || null);
    }

    if (image.modelSegmentationPromise) return image.modelSegmentationPromise;

    image.modelSegmentationPromise = (async () => {
      let detector = visionModelState.detector;

      if (!detector) {
        if (visionModelState.status === 'fallback') return null;
        detector = await initVisionModel();
      }

      if (!detector || visionModelState.status !== 'ready') return null;

      const probe = element || await loadImageProbe(image);
      if (!probe) return null;

      const predictions = await detector.detect(probe);
      const segmentation = buildModelSegmentation(image, predictions || []);

      if (segmentation) {
        image.modelSegmentation = segmentation;
      }

      return segmentation;
    })()
      .catch((error) => {
        console.warn(error);
        return null;
      })
      .finally(() => {
        image.modelSegmentationPromise = null;
      });

    return image.modelSegmentationPromise;
  };

  const getSemanticUnit = (image, cycle = learningCycle) => {
    const tokens = tokenize(`${activeQuery} ${image.title} ${image.credit}`);
    if (!tokens.length) return 'frame sin texto';
    const seed = hashString(`${image.id}-${cycle}`);
    const sorted = [...tokens].sort((a, b) => seededUnit(seed, b.length) - seededUnit(seed, a.length));
    return sorted.slice(0, 2).join(' / ');
  };

  const getContextLabel = (image, unit) => {
    const source = `${activeQuery} ${image.title} ${unit}`.toLowerCase();

    if (/futbol|football|sport|juego|game|team/.test(source)) return 'cuerpo / juego';
    if (/internet|screen|net|digital|computer|archivo/.test(source)) return 'red / archivo';
    if (/city|street|window|urban|building/.test(source)) return 'espacio urbano';
    if (/nature|landscape|water|forest|animal|plant/.test(source)) return 'paisaje vivo';
    if (/art|museum|painting|visual|culture/.test(source)) return 'cultura visual';

    const seed = hashString(`${image.id}-${activeQuery}`);
    return CONTEXTS[seed % CONTEXTS.length];
  };

  const buildEmbedding = (image, unit) => {
    const seed = hashString(`${image.id}-${unit}-${activeQuery}`);
    const visual = getVisualSegmentation(image);
    const visualSignals = [
      visual.meanContrast || 0,
      visual.meanSaturation || 0,
      visual.meanLuma || 0,
      visual.maskCoverage || 0,
      (visual.segments?.length || 0) / MAX_VISUAL_SEGMENTS
    ];

    return Array.from({ length: 16 }, (_, index) => {
      const base = seededUnit(seed, index);
      const ratioSignal = clamp(image.width / Math.max(1, image.height), 0.2, 2.4) / 2.4;
      const querySignal = tokenize(activeQuery).length / 12;
      const visualSignal = visualSignals[index % visualSignals.length];
      return clamp(base * 0.5 + ratioSignal * 0.14 + querySignal * 0.1 + visualSignal * 0.26, 0.04, 0.98);
    });
  };

  const getFrameLabel = (image, unit, context) => {
    const source = `${activeQuery} ${image.title} ${image.credit} ${unit} ${context}`.toLowerCase();
    const labels = [
      ['football', /futbol|football|soccer|balon|ball|team|stadium|deporte|sport/],
      ['screen', /screen|pantalla|monitor|computer|terminal|digital|internet|web/],
      ['archive', /archive|archivo|commons|museum|collection|document|memoria/],
      ['body', /body|cuerpo|person|people|face|gesture|portrait|human/],
      ['city', /city|street|urban|building|window|calle|ciudad/],
      ['landscape', /landscape|nature|water|forest|mountain|paisaje|river|sea/],
      ['object', /object|tool|device|machine|vehiculo|vehicle|objeto/],
      ['texture', /texture|pattern|surface|ruido|noise|abstract/]
    ];
    const found = labels.find(([, pattern]) => pattern.test(source));

    if (found) {
      return found[0];
    }

    return tokenize(`${image.title} ${activeQuery}`)[0] || unit.split('/')[0].trim() || 'unknown';
  };

  const getNoveltyFromMemory = (vector) => {
    if (!frameMemory.length) return 1;

    const closestSimilarity = frameMemory.reduce((closest, memoryVector) => (
      Math.max(closest, cosineSimilarity(vector, memoryVector))
    ), 0);

    return clamp(1 - closestSimilarity, 0.01, 0.99);
  };

  const analyzeFrame = (image, energy, options = {}) => {
    if (!options.cycle) {
      learningCycle += 1;
    }

    const cycle = options.cycle || learningCycle;
    const visual = getVisualSegmentation(image);
    const unit = getSemanticUnit(image, cycle);
    const context = getContextLabel(image, unit);
    const vector = buildEmbedding(image, unit);
    const queryTokens = new Set(tokenize(activeQuery));
    const imageTokens = tokenize(`${image.title} ${image.credit}`);
    const overlap = imageTokens.filter((token) => queryTokens.has(token)).length;
    const density = imageTokens.length ? overlap / imageTokens.length : 0;
    const vectorMean = vector.reduce((sum, value) => sum + value, 0) / vector.length;
    const visualStrength = clamp(
      (visual.meanContrast || 0) * 0.32 +
      (visual.meanSaturation || 0) * 0.22 +
      (visual.maskCoverage || 0) * 0.22 +
      ((visual.segments?.length || 0) / MAX_VISUAL_SEGMENTS) * 0.24,
      0,
      1
    );
    const novelty = getNoveltyFromMemory(vector);
    const score = clamp(0.3 + density * 1.45 + vectorMean * 0.28 + novelty * 0.12 + visualStrength * 0.22 + energy * 0.03, 0.01, 0.99);
    const precision = clamp(score - 0.05 + vector[2] * 0.08 + visualStrength * 0.08, 0.01, 0.99);
    const sensitivity = clamp(score + vector[7] * 0.08 + (visual.meanContrast || 0) * 0.08, 0.01, 0.99);
    const label = getFrameLabel(image, unit, context);
    const cluster = context;
    const sectors = buildSectorAnalysis(image, {
      cycle,
      context,
      unit,
      vector,
      score,
      novelty,
      visual
    });

    return {
      cycle,
      unit,
      context,
      vector,
      score,
      precision,
      sensitivity,
      novelty,
      label,
      cluster,
      sectors,
      visualSource: visual.source,
      maskCount: visual.segments?.length || 0,
      visual
    };
  };

  const buildSectorAnalysis = (image, partialAnalysis) => {
    const tokens = tokenize(`${image.title} ${image.credit} ${activeQuery}`);
    const seed = hashString(`${image.id}-${partialAnalysis.unit}-${partialAnalysis.context}`);
    const primaryTokens = tokens.length ? tokens : partialAnalysis.unit.split('/').map((token) => token.trim()).filter(Boolean);
    const visual = partialAnalysis.visual || getVisualSegmentation(image);
    const displayRegions = getDisplayRegionsForCycle(
      visual,
      partialAnalysis.cycle || learningCycle,
      MAX_FRAME_RETICLES
    );
    const activeCount = displayRegions.length ? Math.min(displayRegions.length, MAX_FRAME_RETICLES) : 0;

    return SECTOR_NAMES.map((name, index) => {
      const vectorSignal = partialAnalysis.vector[index % partialAnalysis.vector.length];
      const visualItem = index < activeCount ? displayRegions[index] : null;
      const visualConfidence = visualItem?.confidence || 0;
      const confidence = visualItem
        ? clamp(
          partialAnalysis.score * 0.2 +
          vectorSignal * 0.1 +
          visualConfidence * 0.36 +
          (visualItem.displayScore || 0) * 0.24 +
          (visualItem.edge || 0) * 0.06 +
          (visualItem.saturation || 0) * 0.04,
          0.01,
          0.99
        )
        : clamp(partialAnalysis.score * 0.42 + vectorSignal * 0.18 + seededUnit(seed, index) * 0.08, 0.01, 0.58);
      const token = primaryTokens[index % Math.max(1, primaryTokens.length)] || partialAnalysis.context;
      const signal = truncateText(visualItem?.signal || SECTOR_SIGNALS[index], 18);
      const label = visualItem
        ? getCompactRegionLabel(visualItem, token)
        : index === 0
          ? truncateText(`${signal} ${partialAnalysis.unit}`, 32)
          : truncateText(`${signal} ${token}`, 28);
      const role = visualItem?.focusRole || 'support';
      const active = Boolean(visualItem);
      const boxPadding = role === 'primary' ? 0.014 : role === 'secondary' ? 0.008 : 0.004;
      const box = visualItem ? getSafeRegionBox(visualItem, boxPadding) : null;

      return {
        name: visualItem?.name || name,
        signal,
        label,
        confidence,
        active,
        focusRole: role,
        hot: active && (role !== 'support' || confidence > 0.64 || Boolean(visualItem?.model)),
        visualSource: visual.source,
        box,
        color: visualItem ? `${Math.round(visualItem.red || 0)}, ${Math.round(visualItem.green || 0)}, ${Math.round(visualItem.blue || 0)}` : null,
        metrics: visualItem ? {
          contrast: visualItem.edge || 0,
          saturation: visualItem.saturation || 0,
          area: visualItem.area || 0,
          displayScore: visualItem.displayScore || confidence
        } : null
      };
    });
  };

  const drawEmbedding = (vector) => {
    ensureEmbeddingBars();
    Array.from(embeddingBars.children).forEach((bar, index) => {
      const value = vector[index] || 0;
      bar.style.height = `${Math.round(4 + value * 30)}px`;
      bar.style.opacity = String(0.42 + value * 0.58);
    });
  };

  const drawSectorMap = (analysis) => {
    ensureSectorMap();
    if (!sectorMap) return;

    const baseX = [5, 38, 72, 16, 44, 65, 8, 34, 75];
    const baseY = [9, 5, 14, 38, 42, 35, 68, 72, 64];

    Array.from(sectorMap.querySelectorAll('.sector-cell')).forEach((cell, index) => {
      const sector = analysis.sectors[index];
      const tag = cell.querySelector('.sector-tag');

      if (!sector || !tag || !sector.active) {
        cell.style.opacity = '0';
        cell.style.zIndex = '1';
        cell.classList.remove('is-hot');
        cell.removeAttribute('data-focus-role');
        cell.removeAttribute('data-vision-source');
        if (tag) tag.textContent = '';
        return;
      }

      const seed = hashString(`${analysis.cycle}-${sector.name}-${sector.label}`);
      const hasBox = sector.box && Number.isFinite(sector.box.x);
      const roleBoost = sector.focusRole === 'primary' ? 0.018 : sector.focusRole === 'secondary' ? 0.01 : 0;
      const fittedBox = hasBox ? getSafeRegionBox(sector.box, roleBoost) : null;
      const x = hasBox
        ? clamp(fittedBox.x * 100, 0.5, 94)
        : clamp(baseX[index] + (seededUnit(seed, 1) - 0.5) * 13, 2, 82);
      const y = hasBox
        ? clamp(fittedBox.y * 100, 1, 94)
        : clamp(baseY[index] + (seededUnit(seed, 2) - 0.5) * 13, 4, 82);
      const width = hasBox
        ? clamp(fittedBox.width * 100, 5, 56)
        : clamp(14 + sector.confidence * 18 + seededUnit(seed, 3) * 10, 11, 34);
      const height = hasBox
        ? clamp(fittedBox.height * 100, 5, 48)
        : clamp(9 + sector.confidence * 12 + seededUnit(seed, 4) * 8, 7, 24);
      const tilt = sector.focusRole === 'primary'
        ? (seededUnit(seed, 5) - 0.5) * 5
        : (seededUnit(seed, 5) - 0.5) * 12;
      const roleOpacity = sector.focusRole === 'primary' ? 0.86 : sector.focusRole === 'secondary' ? 0.68 : 0.5;
      const alpha = clamp(0.22 + sector.confidence * 0.5, 0.24, 0.78);

      cell.style.setProperty('--sector-x', `${x}%`);
      cell.style.setProperty('--sector-y', `${y}%`);
      cell.style.setProperty('--sector-w', `${width}%`);
      cell.style.setProperty('--sector-h', `${height}%`);
      cell.style.setProperty('--sector-tilt', `${tilt.toFixed(2)}deg`);
      cell.style.setProperty('--sector-alpha', alpha.toFixed(2));
      cell.style.setProperty('--sector-depth', `${Math.round((seededUnit(seed, 6) - 0.5) * 26)}px`);
      if (sector.color) {
        cell.style.setProperty('--sector-color-rgb', sector.color);
      }
      cell.style.animationDelay = `${index * 36}ms`;
      cell.style.opacity = String(clamp(roleOpacity + sector.confidence * 0.12, 0.34, 0.94));
      cell.style.zIndex = String(sector.focusRole === 'primary' ? 5 : sector.hot ? 4 : 2);
      cell.dataset.visionSource = sector.visualSource || 'unknown';
      cell.dataset.focusRole = sector.focusRole || 'support';
      cell.classList.toggle('is-hot', sector.hot);
      tag.textContent = truncateText(
        `${sector.focusRole || 'scan'} ${sector.signal} ${sector.confidence.toFixed(2)} // ${sector.label}`,
        58
      );
    });
  };

  const getSegmentPath = (seed) => {
    const paths = [
      'polygon(12% 0, 86% 8%, 100% 48%, 78% 100%, 20% 88%, 0 36%)',
      'polygon(4% 18%, 28% 0, 92% 8%, 100% 76%, 62% 100%, 0 84%)',
      'polygon(18% 4%, 74% 0, 100% 28%, 86% 92%, 24% 100%, 0 62%)',
      'polygon(0 12%, 58% 0, 100% 18%, 94% 82%, 42% 100%, 8% 72%)'
    ];

    return paths[seed % paths.length];
  };

  const drawSegmentationLayer = (analysis) => {
    if (!segmentationLayer) return;

    const visual = analysis.visual || {};
    const segments = getDisplayRegionsForCycle(visual, analysis.cycle, MAX_SEGMENT_MASKS);

    const elements = [];

    segments.forEach((segment, index) => {
      const seed = hashString(`${analysis.cycle}-${segment.label}-${index}`);
      const red = Math.round(segment.red || 202);
      const green = Math.round(segment.green || 255);
      const blue = Math.round(segment.blue || 106);
      const mask = document.createElement('div');
      const contour = document.createElement('span');
      const particle = document.createElement('span');
      const box = getSafeRegionBox(segment, segment.focusRole === 'primary' ? 0.008 : 0.002);
      const confidence = segment.confidence || segment.salience || 0.4;

      mask.className = 'segment-mask';
      mask.dataset.visionSource = visual.source || analysis.visualSource || 'unknown';
      mask.dataset.focusRole = segment.focusRole || 'support';
      mask.style.setProperty('--segment-x', `${clamp(box.x * 100, 0, 96).toFixed(2)}%`);
      mask.style.setProperty('--segment-y', `${clamp(box.y * 100, 0, 96).toFixed(2)}%`);
      mask.style.setProperty('--segment-w', `${clamp(box.width * 100, 5, 58).toFixed(2)}%`);
      mask.style.setProperty('--segment-h', `${clamp(box.height * 100, 5, 58).toFixed(2)}%`);
      mask.style.setProperty('--segment-tilt', `${((seededUnit(seed, 1) - 0.5) * 10).toFixed(2)}deg`);
      mask.style.setProperty('--segment-path', getSegmentPath(seed));
      mask.style.setProperty('--segment-color-rgb', `${red}, ${green}, ${blue}`);
      mask.style.opacity = String(clamp(0.13 + confidence * 0.22 + (segment.focusRole === 'primary' ? 0.08 : 0), 0.14, 0.4));
      mask.style.animationDelay = `${index * 70}ms`;

      contour.className = 'segment-contour';
      mask.append(contour);
      elements.push(mask);

      particle.className = 'vision-particle';
      particle.dataset.focusRole = segment.focusRole || 'support';
      particle.style.setProperty('--particle-x', `${clamp(box.centerX * 100, 2, 98).toFixed(2)}%`);
      particle.style.setProperty('--particle-y', `${clamp(box.centerY * 100, 2, 98).toFixed(2)}%`);
      particle.style.setProperty('--particle-speed', `${Math.round(1900 + seededUnit(seed, 2) * 1700)}ms`);
      particle.style.setProperty('--segment-color-rgb', `${red}, ${green}, ${blue}`);
      elements.push(particle);

      if (index < 2 || segment.focusRole === 'primary') {
        const beam = document.createElement('span');
        beam.className = 'vision-beam';
        beam.dataset.focusRole = segment.focusRole || 'support';
        beam.style.setProperty('--beam-x', `${clamp(box.centerX * 100 - 28, 0, 84).toFixed(2)}%`);
        beam.style.setProperty('--beam-y', `${clamp(box.centerY * 100, 3, 97).toFixed(2)}%`);
        beam.style.setProperty('--beam-w', `${clamp(22 + (segment.area || 0.1) * 130, 18, 68).toFixed(2)}%`);
        beam.style.setProperty('--beam-tilt', `${((seededUnit(seed, 3) - 0.5) * 22).toFixed(2)}deg`);
        beam.style.setProperty('--segment-color-rgb', `${red}, ${green}, ${blue}`);
        elements.push(beam);
      }
    });

    segmentationLayer.replaceChildren(...elements);
  };

  const drawYoloLayer = (analysis) => {
    if (!yoloLayer) return;

    const detections = analysis.yoloDetections || getYoloDetections(analysis);
    analysis.yoloDetections = detections;

    if (!detections.length) {
      const status = document.createElement('div');
      status.className = 'yolo-status';
      status.textContent = visionModelState.status === 'loading'
        ? 'YOLO cargando modelo...'
        : 'YOLO sin objeto confiable';
      yoloLayer.replaceChildren(status);
      return;
    }

    const boxes = detections.map((detection, index) => {
      const box = document.createElement('div');
      const label = document.createElement('span');
      const score = document.createElement('b');
      const source = document.createElement('i');

      box.className = 'yolo-box';
      box.dataset.source = detection.source;
      box.style.setProperty('--yolo-x', `${clamp(detection.x * 100, 0, 99).toFixed(2)}%`);
      box.style.setProperty('--yolo-y', `${clamp(detection.y * 100, 0, 99).toFixed(2)}%`);
      box.style.setProperty('--yolo-w', `${clamp(detection.width * 100, 2.4, 68).toFixed(2)}%`);
      box.style.setProperty('--yolo-h', `${clamp(detection.height * 100, 2.4, 68).toFixed(2)}%`);
      box.style.setProperty('--yolo-color-rgb', detection.color || '202, 255, 106');
      box.style.animationDelay = `${index * 55}ms`;

      label.className = 'yolo-label';
      score.textContent = detection.confidence.toFixed(2);
      source.textContent = detection.source;
      label.append(
        document.createTextNode(`${truncateText(detection.label, 22)} `),
        score,
        source
      );

      box.append(label);
      return box;
    });

    yoloLayer.replaceChildren(...boxes);
  };

  const drawSelectionBox = (analysis) => {
    if (!learningSelection) return;

    const targets = getDisplayRegionsForCycle(analysis.visual || {}, analysis.cycle, 2);
    const fallbackTargets = analysis.sectors
      .filter((sector) => sector.active && sector.box)
      .slice(0, 2)
      .map((sector) => ({
        ...sector.box,
        signal: sector.signal,
        label: sector.label,
        confidence: sector.confidence,
        focusRole: sector.focusRole,
        visualSource: sector.visualSource
      }));
    const selectionTargets = targets.length ? targets : fallbackTargets;

    selectionTargets.forEach((target, index) => {
      const box = document.createElement('div');
      const label = document.createElement('span');
      const focus = target.focusRole || (index === 0 ? 'primary' : 'secondary');
      const bounds = getSafeRegionBox(target, focus === 'primary' ? 0.018 : 0.01);

      box.className = 'learning-box';
      box.dataset.focusRole = focus;
      box.dataset.visionSource = target.visualSource || analysis.visualSource || 'unknown';
      label.className = 'learning-label';
      label.textContent = truncateText(
        `${focus === 'primary' ? 'focus' : 'scan'}_${String(analysis.cycle).padStart(3, '0')} ${target.signal || analysis.label} ${analysis.score.toFixed(2)}`,
        44
      );
      box.style.setProperty('--box-x', `${(bounds.x * 100).toFixed(2)}%`);
      box.style.setProperty('--box-y', `${(bounds.y * 100).toFixed(2)}%`);
      box.style.setProperty('--box-w', `${(bounds.width * 100).toFixed(2)}%`);
      box.style.setProperty('--box-h', `${(bounds.height * 100).toFixed(2)}%`);
      box.style.animationDelay = `${index * 120}ms`;
      box.append(label);
      learningSelection.append(box);
      box.addEventListener('animationend', () => box.remove(), { once: true });
    });

    while (learningSelection.children.length > MAX_SELECTION_BOXES) {
      learningSelection.firstElementChild?.remove();
    }
  };

  const addFrameTile = (image, analysis) => {
    if (!frameStrip) return;

    const tile = document.createElement('div');
    const thumb = document.createElement('img');
    const score = document.createElement('span');

    tile.className = 'frame-tile';
    thumb.src = image.url;
    thumb.alt = '';
    score.textContent = analysis.score.toFixed(2);
    tile.append(thumb, score);
    frameStrip.prepend(tile);

    while (frameStrip.children.length > 9) {
      frameStrip.lastElementChild?.remove();
    }
  };

  const buildVisionSentence = (image, analysis) => {
    const title = normalizeTitle(image.title).toLowerCase();
    const confidence = analysis.score > 0.78 ? 'con mucha confianza' : analysis.score > 0.58 ? 'con confianza media' : 'con duda';
    const relation = analysis.score > 0.72 ? 'se acerca a la busqueda' : analysis.score > 0.5 ? 'roza la busqueda' : 'parece desviarse de la busqueda';
    const novelty = analysis.novelty > 0.78 ? 'todavia se siente nuevo para mi memoria' : analysis.novelty > 0.54 ? 'lo comparo con frames cercanos' : 'lo siento parecido a algo ya visto';
    const namedSubject = title && title !== 'imagen sin titulo' ? ` El archivo se llama "${title}".` : '';
    const visionMode = analysis.visualSource === 'cdn-coco-ssd'
      ? 'modelo de navegador'
      : analysis.visualSource === 'canvas-pixels'
        ? 'canvas de pixeles'
        : 'estimacion visual';

    const yoloObjects = (analysis.yoloDetections || [])
      .slice(0, 3)
      .map((detection) => `${detection.label} ${detection.confidence.toFixed(2)}`);
    const detectedText = yoloObjects.length
      ? `YOLO identifica ${yoloObjects.join('; ')}`
      : 'YOLO no tiene objeto confiable aun';

    return `Veo ${analysis.context}: una unidad ${analysis.unit} que ${relation}, ${confidence}. Uso ${visionMode}: ${detectedText}. ${novelty}.${namedSubject}`;
  };

  const updateLLMVision = (image, analysis) => {
    if (!llmSpeech) return;

    const tokens = [
      analysis.context,
      analysis.unit,
      analysis.visualSource,
      `yolo ${(analysis.yoloDetections || []).length}`,
      ...(analysis.yoloDetections || [])
        .slice(0, 3)
        .map((detection) => `${detection.label} ${detection.confidence.toFixed(2)}`),
      `score ${analysis.score.toFixed(2)}`,
      `novelty ${analysis.novelty.toFixed(2)}`,
      ...tokenize(image.title).slice(0, 4)
    ].filter(Boolean);

    llmSpeech.textContent = buildVisionSentence(image, analysis);
    llmSpeech.classList.remove('is-updating');
    void llmSpeech.offsetWidth;
    llmSpeech.classList.add('is-updating');

    if (llmTokens) {
      llmTokens.replaceChildren(...tokens.slice(0, 8).map((token) => {
        const item = document.createElement('span');
        item.textContent = token;
        return item;
      }));
    }
  };

  const renderLearningAnalysis = (image, analysis, options = {}) => {
    if (mlCycle) mlCycle.textContent = String(analysis.cycle).padStart(2, '0');
    if (mlScore) mlScore.textContent = analysis.score.toFixed(2);
    if (mlContext) mlContext.textContent = analysis.context;
    if (mlSemantic) mlSemantic.textContent = analysis.unit;

    analysis.yoloDetections = getYoloDetections(analysis);
    const yoloSummary = analysis.yoloDetections.length
      ? analysis.yoloDetections
        .slice(0, 3)
        .map((detection) => `${detection.label}:${detection.confidence.toFixed(2)}`)
        .join(',')
      : 'sin_objeto';

    drawEmbedding(analysis.vector);
    drawYoloLayer(analysis);
    if (options.frameTile !== false) addFrameTile(image, analysis);
    updateLLMVision(image, analysis);

    if (options.log !== false) {
      addLearningLine(
        options.tag || `frame_${String(analysis.cycle).padStart(3, '0')}`,
        options.message || `label: ${analysis.label} | score: ${analysis.score.toFixed(2)} | novelty: ${analysis.novelty.toFixed(2)} | cluster: ${analysis.cluster} | precision: ${analysis.precision.toFixed(2)} | vision: ${analysis.visualSource} | yolo: ${analysis.yoloDetections.length} | det: ${yoloSummary}`
      );
    }

    if (options.memory !== false) {
      frameMemory.push(analysis.vector);
      if (frameMemory.length > 120) {
        frameMemory = frameMemory.slice(-120);
      }
    }
  };

  const enhanceCurrentFrameWithModel = (image, baseAnalysis) => {
    queueModelSegmentation(image).then((segmentation) => {
      if (!segmentation || lastLearningImageId !== image.id) return;

      const upgradedAnalysis = analyzeFrame(image, lastLearningEnergy, { cycle: baseAnalysis.cycle });
      renderLearningAnalysis(image, upgradedAnalysis, {
        selection: false,
        frameTile: false,
        memory: false,
        tag: `vision_${String(baseAnalysis.cycle).padStart(3, '0')}`,
        message: `modelo: ${upgradedAnalysis.visualSource} | objetos: ${segmentation.modelObjects || upgradedAnalysis.yoloDetections.length} | score: ${upgradedAnalysis.score.toFixed(2)} | yolo: ${upgradedAnalysis.yoloDetections.length}`
      });
    });
  };

  const updateLearning = (image, energy) => {
    lastLearningImageId = image.id;
    lastLearningEnergy = energy;
    const analysis = analyzeFrame(image, energy);

    renderLearningAnalysis(image, analysis);
    enhanceCurrentFrameWithModel(image, analysis);
  };

  const trimConsumedCache = () => {
    if (nextImageIndex <= BATCH_SIZE || imagePool.length <= BATCH_SIZE * 2) {
      return;
    }

    imagePool = imagePool.slice(nextImageIndex - BATCH_SIZE);
    nextImageIndex = BATCH_SIZE;
  };

  const requestRefillIfNeeded = () => {
    if (imagePool.length - nextImageIndex <= REFILL_AT) {
      loadBatch();
    }
  };

  const loadBatch = async ({ replace = false, query = activeQuery } = {}) => {
    if (isLoadingBatch) {
      return loadingPromise;
    }

    isLoadingBatch = true;
    stage.classList.add('is-loading');
    setStatus('Consultando y comprimiendo lote de 20 imagenes.');

    if (replace) {
      imagePool = [];
      seenImages = new Set();
      nextImageIndex = 0;
      launchCount = 0;
      frameMemory = [];
      lastLearningImageId = '';
      counterLabel.textContent = '00';
      updateReadout();
    }

    loadingPromise = (async () => {
      try {
        const randomOffset = Math.floor(Math.random() * MAX_OFFSET);
        let images = await fetchImages(query, randomOffset);

        if (!images.length) {
          images = await fetchImages(query, 0);
        }

        let freshImages = shuffle(images).filter((image) => !seenImages.has(image.id));

        if (!freshImages.length) {
          const fallbackQuery = FALLBACK_QUERIES[fallbackIndex % FALLBACK_QUERIES.length];
          fallbackIndex += 1;
          activeQuery = fallbackQuery;
          queryInput.value = fallbackQuery;
          freshImages = shuffle(await fetchImages(fallbackQuery, 0)).filter((image) => !seenImages.has(image.id));
        }

        const cachedImages = await cacheBatch(freshImages.slice(0, BATCH_SIZE));

        if (!cachedImages.length) {
          throw new Error('No llegaron imagenes compatibles.');
        }

        cachedImages.forEach((image) => {
          seenImages.add(image.id);
          imagePool.push(image);
        });

        setStatus(`Cache listo: ${cachedImages.length} imagenes comprimidas.`);
        addLearningLine('sys', `mode: no_molestar | cache: ${cachedImages.length}/20 | query: ${activeQuery} | status: learning`);
        updateReadout();
        trimConsumedCache();
      } catch (error) {
        console.error(error);
        const cachedLocalImages = await cacheBatch(buildLocalFallbackImages());

        if (cachedLocalImages.length) {
          cachedLocalImages.forEach((image) => {
            seenImages.add(image.id);
            imagePool.push(image);
          });
          setStatus(`Modo local: ${cachedLocalImages.length} imagenes listas para detectar formas.`);
          addLearningLine('sys', `fallback: local_images | cache: ${cachedLocalImages.length}/${LOCAL_FALLBACK_IMAGES.length} | detector: shape`);
          updateReadout();
          trimConsumedCache();
          return;
        }

        setStatus('No se pudo llenar la cache. Reintentando en el siguiente movimiento.');
        addLearningLine('err', 'cache: incomplete | retry: wikimedia_query | status: waiting');
        if (!imagePool.length) {
          imageTitle.textContent = 'Sin respuesta del archivo';
          imageCredit.textContent = 'La sala volvera a consultar al hacer scroll.';
        }
      } finally {
        isLoadingBatch = false;
        loadingPromise = null;
        if (imagePool.length) {
          stage.classList.remove('is-loading');
        }
      }
    })();

    return loadingPromise;
  };

  const getNextCachedImage = () => {
    for (let index = nextImageIndex; index < imagePool.length; index += 1) {
      const candidate = imagePool[index];

      if (!candidate.ready || candidate.failed) {
        continue;
      }

      nextImageIndex = index + 1;
      requestRefillIfNeeded();
      trimConsumedCache();
      return candidate;
    }

    requestRefillIfNeeded();
    return null;
  };

  const renderFeaturedImage = (image) => {
    imageEl.crossOrigin = 'anonymous';
    imageEl.src = image.url;
    imageEl.alt = image.title;
    imageTitle.textContent = image.title;
    imageCredit.textContent = image.credit;
    licenseLabel.textContent = image.license;
    sourceLink.href = image.source;
    window.requestAnimationFrame(updateSectorMapBounds);
  };

  const spawnRainDrop = (energy = 1) => {
    const image = getNextCachedImage();

    if (!image) {
      stage.classList.add('is-loading');
      setStatus('Llenando cache para seguir la lluvia.');
      return false;
    }

    renderFeaturedImage(image);
    updateLearning(image, energy);

    const drop = document.createElement('img');
    const size = Math.round(randomBetween(72, 156) * Math.min(1.45, energy));
    const ratio = Math.min(1.5, Math.max(0.58, image.height / Math.max(1, image.width)));

    drop.className = 'rain-drop';
    drop.src = image.url;
    drop.alt = '';
    drop.decoding = 'async';
    drop.style.setProperty('--x', `${randomBetween(-10, 98).toFixed(2)}vw`);
    drop.style.setProperty('--size', `${size}px`);
    drop.style.setProperty('--height', `${Math.round(size * ratio)}px`);
    drop.style.setProperty('--drift', `${randomBetween(-22, 22).toFixed(2)}vw`);
    drop.style.setProperty('--rotate', `${randomBetween(-18, 18).toFixed(2)}deg`);
    drop.style.setProperty('--spin', `${randomBetween(-140, 140).toFixed(2)}deg`);
    drop.style.setProperty('--duration', `${Math.round(randomBetween(2100, 5200) / Math.min(1.45, energy))}ms`);
    drop.style.setProperty('--opacity', randomBetween(0.62, 0.92).toFixed(2));

    if (ratio < 0.7 || ratio > 1.28) {
      drop.classList.add('is-wide');
    }

    rainField.append(drop);

    while (rainField.children.length > MAX_ACTIVE_DROPS) {
      rainField.firstElementChild?.remove();
    }

    drop.addEventListener('animationend', () => {
      drop.remove();
    }, { once: true });

    launchCount += 1;
    counterLabel.textContent = String(launchCount % 100).padStart(2, '0');
    updateReadout();
    return true;
  };

  const launchRain = (count = 1, energy = 1) => {
    if (isPaused) return;

    let launched = 0;
    for (let index = 0; index < count; index += 1) {
      window.setTimeout(() => {
        if (spawnRainDrop(energy)) {
          setStatus('Lluvia activa: desliza para intensificar.');
        }
      }, index * 42);
      launched += 1;
    }

    if (!launched) {
      loadBatch();
    }
  };

  const handleScroll = () => {
    const currentScrollY = window.scrollY;
    const delta = Math.abs(currentScrollY - lastScrollY);
    lastScrollY = currentScrollY;

    if (isPaused || delta < 1) {
      return;
    }

    scrollAccumulator += delta;
    const drops = Math.min(14, Math.floor(scrollAccumulator / SCROLL_DROP_STEP));

    if (drops > 0) {
      scrollAccumulator -= drops * SCROLL_DROP_STEP;
      launchRain(drops, 1 + Math.min(1.8, delta / 260));
    }
  };

  const setPaused = (nextState) => {
    isPaused = nextState;
    document.body.classList.toggle('is-paused', isPaused);
    pauseButton.textContent = isPaused ? 'Reanudar' : 'Pausa';
    setStatus(isPaused ? 'Lluvia en pausa.' : 'Lluvia activa.');
  };

  queryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nextQuery = queryInput.value.trim();
    if (!nextQuery) return;
    activeQuery = nextQuery;
    setPaused(false);
    addLearningLine('reset', `query: ${activeQuery} | memory: cleared | status: retraining`);
    await loadBatch({ replace: true, query: activeQuery });
    launchRain(12, 1.5);
  });

  pauseButton.addEventListener('click', () => {
    setPaused(!isPaused);
  });

  nextButton.addEventListener('click', () => {
    launchRain(12, 1.8);
  });

  const startTimer = () => {
    if (timerId) return;
    timerId = window.setInterval(() => {
      launchRain(1, 0.86);
    }, PASSIVE_RAIN_MS);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', updateSectorMapBounds);
  window.addEventListener('pagehide', () => {
    window.clearInterval(timerId);
  });

  initVisionModel();

  loadBatch({ replace: true }).then(() => {
    launchRain(10, 1.25);
    startTimer();
  });
})();
