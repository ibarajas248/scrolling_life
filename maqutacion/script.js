const formatRecycler = document.querySelector('.format-recycler');

const extraFormats = [
  { index: '07', template: 'home', label: 'BG_07_HOME', thumb: 'thumb-home', title: 'Fondo Home', meta: 'sin texto' },
  { index: '08', template: 'archive', label: 'BG_08_ARCHIVO', thumb: 'thumb-archive', title: 'Fondo Archivo', meta: 'sin texto' },
  { index: '09', template: 'date', label: 'BG_09_FECHA', thumb: 'thumb-date', title: 'Fondo Fecha', meta: 'sin texto' },
  { index: '10', template: 'clean', label: 'BG_10_LIMPIO', thumb: 'thumb-clean', title: 'Fondo Limpio', meta: 'sin texto' },
  { index: '11', template: 'reel', label: 'BG_11_REEL', thumb: 'thumb-date', title: 'Fondo Reel', meta: 'sin texto', aspect: '9:16' },
  { index: '12', template: 'story', label: 'BG_12_HISTORIA', thumb: 'thumb-archive', title: 'Fondo Historia', meta: 'sin texto', aspect: '9:16' },
  { index: '13', template: 'story-blue', label: 'BG_13_HISTORIA_AZUL', thumb: 'thumb-archive thumb-blue', title: 'Historia Azul', meta: 'sin texto', aspect: '9:16' },
  { index: '14', template: 'story-glitch', label: 'BG_14_HISTORIA_GLITCH', thumb: 'thumb-archive thumb-blue thumb-glitch', title: 'Historia Glitch', meta: 'azul + glitch', aspect: '9:16' },
  { index: '15', template: 'story-binary', label: 'BG_15_HISTORIA_BINARIA', thumb: 'thumb-archive thumb-blue thumb-glitch thumb-binary', title: 'Historia Binaria', meta: 'glitch + 1/0', aspect: '9:16' },
];

if (formatRecycler) {
  extraFormats.forEach((format) => {
    const exists = Array.from(formatRecycler.querySelectorAll('.format-index'))
      .some((item) => item.textContent.trim() === format.index);

    if (exists) return;

    const button = document.createElement('button');
    button.className = 'format-item';
    button.type = 'button';
    button.dataset.template = format.template;
    button.dataset.bgOnly = 'true';
    button.dataset.label = format.label;
    button.setAttribute('aria-pressed', 'false');

    if (format.aspect) {
      button.dataset.aspect = format.aspect;
    }

    button.innerHTML = `
      <span class="format-thumb ${format.thumb}" aria-hidden="true"></span>
      <span class="format-index">${format.index}</span>
      <strong>${format.title}</strong>
      <small>${format.meta}</small>
    `;

    formatRecycler.appendChild(button);
  });
}

const formatButtons = document.querySelectorAll('.format-item');
const igPost = document.getElementById('igPost');
const activeFormat = document.getElementById('activeFormat');
const activeAspect = document.getElementById('activeAspect');
const formatText = document.getElementById('formatText');
const rgbText = document.getElementById('rgbText');
const btnDownloadImg = document.getElementById('btnDownloadImg');
const btnDownloadVid = document.getElementById('btnDownloadVid');

const templateLabels = {
  poster: 'POST_16_AFICHE_GSF',
  home: 'POST_01_HOME',
  archive: 'POST_02_ARCHIVO',
  date: 'POST_03_FECHA',
  clean: 'POST_04_LIMPIO',
  reel: 'REEL_01_FEED',
  story: 'STORY_01_ARCH',
  'story-blue': 'BG_13_HISTORIA_AZUL',
  'story-glitch': 'BG_14_HISTORIA_GLITCH',
  'story-binary': 'BG_15_HISTORIA_BINARIA',
};

const templateClasses = Object.keys(templateLabels).map((name) => `template-${name}`);
const imageCache = new Map();
const imageExportBase = 1080;
const videoExportBase = 1080;
const videoFps = 30;
const videoDurationMs = 15000;
const videoMotionMultiplier = 1.18;

let activeTemplate = 'poster';
let activeAspectRatio = '4:5';
let activeBgOnly = false;
let activeLabel = templateLabels.poster;

formatButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const template = button.dataset.template || 'home';
    const aspect = button.dataset.aspect || '1:1';
    const isBgOnly = button.dataset.bgOnly === 'true';
    const label = button.dataset.label || templateLabels[template] || templateLabels.home;

    activeTemplate = template;
    activeAspectRatio = aspect;
    activeBgOnly = isBgOnly;
    activeLabel = label;

    formatButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-pressed', String(isActive));
    });

    igPost.classList.remove(...templateClasses);
    igPost.classList.add(`template-${template}`);
    igPost.classList.toggle('bg-only', isBgOnly);

    igPost.classList.remove('aspect-9-16', 'aspect-4-5');

    if (aspect === '9:16') {
      igPost.classList.add('aspect-9-16');
      if (activeAspect) activeAspect.textContent = '9:16';
      if (formatText) formatText.textContent = isBgOnly ? 'Fondo vertical animado' : 'Formato vertical';
      if (rgbText) rgbText.textContent = isBgOnly ? 'RGB / fondo animado' : 'RGB / vertical';
      igPost.setAttribute('aria-label', 'Publicacion vertical Scrolling Life');
    } else if (aspect === '4:5') {
      igPost.classList.add('aspect-4-5');
      if (activeAspect) activeAspect.textContent = '4:5';
      if (formatText) formatText.textContent = 'Afiche vertical para feed';
      if (rgbText) rgbText.textContent = 'RGB / 1080 x 1350';
      igPost.setAttribute('aria-label', 'Afiche vertical Scrolling Life');
    } else {
      if (activeAspect) activeAspect.textContent = '1:1';
      if (formatText) formatText.textContent = isBgOnly ? 'Fondo cuadrado animado' : 'Formato para feed';
      if (rgbText) rgbText.textContent = isBgOnly ? 'RGB / fondo animado' : 'RGB / cuadrado';
      igPost.setAttribute('aria-label', 'Publicacion cuadrada Scrolling Life');
    }

    if (activeFormat) activeFormat.textContent = label;
  });
});

function getExportSize(type = 'image') {
  const base = type === 'video' ? videoExportBase : imageExportBase;

  if (activeAspectRatio === '9:16') {
    return { width: base, height: Math.round(base * 16 / 9) };
  }

  if (activeAspectRatio === '4:5') {
    return { width: base, height: Math.round(base * 5 / 4) };
  }

  return { width: base, height: base };
}

function getVideoBitrate() {
  if (activeAspectRatio === '9:16') return 16000000;
  if (activeAspectRatio === '4:5') return 14000000;
  return 12000000;
}

function canRecordMimeType(mimeType) {
  try {
    return Boolean(window.MediaRecorder && MediaRecorder.isTypeSupported(mimeType));
  } catch (error) {
    return false;
  }
}

function getMp4VideoFormat() {
  const mp4Formats = [
    'video/mp4;codecs=avc1.64002A',
    'video/mp4;codecs=avc1.4D002A',
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=h264',
    'video/mp4',
  ];

  return mp4Formats.find(canRecordMimeType) || '';
}

function sanitizeFilename(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'scrolling-life';
}

function resolveCssUrl(value) {
  const match = /url\((['"]?)(.*?)\1\)/.exec(value || '');
  return match ? match[2] : '';
}

function getCssSeconds(value, fallback) {
  const parsed = Number.parseFloat(String(value || '').replace('s', '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (imageCache.has(url)) return imageCache.get(url);

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    const parsed = new URL(url, window.location.href);

    if (parsed.origin !== window.location.origin) {
      image.crossOrigin = 'anonymous';
    }

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    image.src = parsed.href;
  });

  imageCache.set(url, promise);
  return promise;
}

async function getStripLayers() {
  const postRect = igPost.getBoundingClientRect();
  const strips = Array.from(igPost.querySelectorAll('.post-strip'));

  const layers = await Promise.all(strips.map(async (strip) => {
    const rect = strip.getBoundingClientRect();
    const style = getComputedStyle(strip);
    const image = await loadImage(resolveCssUrl(style.backgroundImage));
    const to = style.getPropertyValue('--to');
    const direction = to.includes('-') ? -1 : 1;

    if (!image || postRect.width === 0 || postRect.height === 0) return null;

    return {
      image,
      x: (rect.left - postRect.left) / postRect.width,
      y: (rect.top - postRect.top) / postRect.height,
      width: rect.width / postRect.width,
      height: rect.height / postRect.height,
      filter: style.filter && style.filter !== 'none' ? style.filter : 'grayscale(1) contrast(1.22) brightness(0.88)',
      alpha: Number.parseFloat(style.opacity) || Number.parseFloat(style.getPropertyValue('--alpha')) || 0.55,
      blend: style.mixBlendMode === 'screen' ? 'screen' : 'source-over',
      speed: getCssSeconds(style.getPropertyValue('--speed'), 16),
      swaySpeed: getCssSeconds(style.getPropertyValue('--sway-speed'), 9),
      sway: Number.parseFloat(style.getPropertyValue('--sway-to')) || 4,
      direction,
    };
  }));

  return layers.filter(Boolean);
}

async function getPosterAssets() {
  if (activeTemplate !== 'poster') return null;

  const [campaign, bogota] = await Promise.all([
    loadImage('./assets/bogota-mi-ciudad-mi-casa-blanco.png'),
    loadImage('./assets/bogota-blanco.png'),
  ]);

  return { campaign, bogota };
}

async function prepareExportCanvas(type = 'image') {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const size = getExportSize(type);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  return {
    canvas,
    layers: await getStripLayers(),
    posterAssets: await getPosterAssets(),
  };
}

function fillBase(ctx, width, height) {
  if (activeTemplate === 'archive' || activeTemplate === 'story-blue' || activeTemplate === 'story-glitch' || activeTemplate === 'story-binary') {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    const isBlue = activeTemplate === 'story-blue' || activeTemplate === 'story-glitch' || activeTemplate === 'story-binary';
    const isGlitch = activeTemplate === 'story-glitch' || activeTemplate === 'story-binary';
    gradient.addColorStop(0, isGlitch ? '#080909' : isBlue ? '#001160' : '#000622');
    gradient.addColorStop(0.18, isGlitch ? '#5d6464' : isBlue ? '#0023b8' : '#00116d');
    gradient.addColorStop(0.44, isGlitch ? '#e6e8de' : isBlue ? '#0057ff' : '#001b9b');
    gradient.addColorStop(0.7, isGlitch ? '#2b3033' : isBlue ? '#001b88' : '#00093f');
    gradient.addColorStop(1, isGlitch ? '#111416' : isBlue ? '#0032d6' : '#0020b8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.fillStyle = '#010204';
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, width * 0.48);
  glow.addColorStop(0, 'rgba(158, 255, 113, 0.15)');
  glow.addColorStop(0.44, 'rgba(158, 255, 113, 0.05)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function drawStrip(ctx, layer, width, height, timeMs) {
  const x = layer.x * width;
  const y = layer.y * height;
  const stripWidth = layer.width * width;
  const stripHeight = layer.height * height;
  const tileHeight = Math.max(1, layer.image.naturalHeight * (stripWidth / layer.image.naturalWidth));
  const travel = (timeMs / 1000 / layer.speed) * tileHeight * layer.direction;
  const offset = ((travel % tileHeight) + tileHeight) % tileHeight;
  const sway = Math.sin((timeMs / 1000 / layer.swaySpeed) * Math.PI * 2) * layer.sway * (width / 720);
  let drawY = y + offset - tileHeight;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y, stripWidth + 8, stripHeight);
  ctx.clip();
  ctx.globalAlpha = layer.alpha;
  ctx.globalCompositeOperation = layer.blend;
  ctx.filter = layer.filter;

  while (drawY < y + stripHeight) {
    ctx.drawImage(layer.image, x + sway, drawY, stripWidth, tileHeight);
    drawY += tileHeight;
  }

  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = Math.min(0.32, layer.alpha * 0.55);

  const shine = ctx.createLinearGradient(x, 0, x + stripWidth, 0);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  shine.addColorStop(0.2, 'rgba(255, 255, 255, 0.02)');
  shine.addColorStop(0.78, 'rgba(158, 255, 113, 0.08)');
  shine.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = shine;
  ctx.fillRect(x + sway, y, stripWidth, stripHeight);
  ctx.restore();
}

function drawScanlines(ctx, width, height, opacity = 0.18) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#ffffff';

  for (let y = 0; y < height; y += 6) {
    ctx.fillRect(0, y, width, 1);
  }

  ctx.globalAlpha = opacity * 0.45;

  for (let x = 0; x < width; x += 12) {
    ctx.fillRect(x, 0, 1, height);
  }

  ctx.restore();
}

function drawVignette(ctx, width, height) {
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.12, width * 0.5, height * 0.5, width * 0.72);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(0.65, 'rgba(0, 0, 0, 0.18)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawGlitch(ctx, width, height, timeMs) {
  const pulse = Math.sin(timeMs / 140) > 0.48;
  const snap = Math.sin(timeMs / 67) > 0.36;
  const bandCount = pulse ? 18 : 8;
  const maxShift = pulse ? width * 0.05 : width * 0.018;

  ctx.save();

  if (pulse) {
    const blocks = [
      { x: 0.04, y: 0.03, w: 0.42, h: 0.25, sx: -0.018 },
      { x: 0.58, y: 0.06, w: 0.36, h: 0.2, sx: 0.022 },
      { x: 0.08, y: 0.36, w: 0.48, h: 0.16, sx: 0.03 },
      { x: 0.54, y: 0.42, w: 0.4, h: 0.19, sx: -0.026 },
    ];

    blocks.forEach((block, index) => {
      const sourceY = Math.max(0, Math.min(height - block.h * height, block.y * height + Math.sin(timeMs * 0.003 + index) * height * 0.04));
      const dx = block.x * width + Math.sin(timeMs * 0.012 + index * 2) * width * block.sx;
      const dy = block.y * height;
      const dw = block.w * width;
      const dh = block.h * height;

      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.filter = 'grayscale(1) contrast(1.7) brightness(1.24)';
      ctx.drawImage(ctx.canvas, 0, sourceY, width, dh, dx, dy, dw, dh);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = index % 2 === 0 ? '#00f2ff' : '#ff004c';
      ctx.fillRect(dx + width * 0.01, dy, dw, dh);
      ctx.restore();
    });
  }

  if (snap) {
    for (let index = 0; index < 7; index += 1) {
      const y = Math.abs(Math.sin(timeMs * 0.0029 + index * 3.7)) * height;
      const bandHeight = Math.max(4, height * (0.012 + (index % 3) * 0.008));
      const shift = Math.sin(timeMs * 0.017 + index * 5.2) * maxShift;
      const sourceY = Math.max(0, Math.min(height - bandHeight, y));

      ctx.drawImage(
        ctx.canvas,
        0,
        sourceY,
        width,
        bandHeight,
        shift,
        sourceY,
        width,
        bandHeight
      );
    }
  }

  ctx.globalCompositeOperation = 'screen';

  for (let index = 0; index < bandCount; index += 1) {
    const y = Math.abs(Math.sin(timeMs * 0.0024 + index * 2.3)) * height;
    const bandHeight = Math.max(2, height * (pulse ? 0.026 : 0.013));
    const shift = Math.sin(timeMs * 0.019 + index * 4.1) * maxShift;

    ctx.globalAlpha = pulse ? 0.42 : 0.2;
    ctx.fillStyle = index % 4 === 0 ? '#00f2ff' : index % 4 === 1 ? '#ff004c' : index % 4 === 2 ? '#f1ff00' : '#ffffff';
    ctx.fillRect(shift, y, width, bandHeight);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = pulse ? 0.26 : 0.12;
  ctx.fillStyle = '#00ccff';

  for (let y = 0; y < height; y += 34) {
    const shift = Math.sin((timeMs + y * 13) * 0.006) * maxShift;
    ctx.fillRect(shift, y, width, y % 68 === 0 ? 3 : 1);
  }

  ctx.restore();
}

function drawBinaryOverlay(ctx, width, height, timeMs) {
  const columns = 12;
  const binary = '0100100110110100000111011100101000101101101001100101110011100010';
  const fontSize = Math.max(11, width * 0.018);
  const drift = (timeMs * 0.018) % (fontSize * 8);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.font = `${fontSize}px "Share Tech Mono", "Courier New", monospace`;
  ctx.textBaseline = 'top';

  for (let col = 0; col < columns; col += 1) {
    const x = (col + 0.35) * (width / columns);
    const yOffset = -drift - (col % 3) * fontSize * 3;
    const alpha = col % 2 === 0 ? 0.48 : 0.28;

    ctx.fillStyle = col % 4 === 0
      ? `rgba(158, 255, 113, ${alpha})`
      : col % 4 === 1
        ? `rgba(0, 240, 255, ${alpha * 0.8})`
        : `rgba(235, 255, 236, ${alpha * 0.52})`;

    for (let y = yOffset; y < height + fontSize; y += fontSize * 1.24) {
      const offset = Math.floor((y + timeMs * 0.02 + col * 7) / fontSize);
      const char = binary[Math.abs(offset) % binary.length];
      ctx.fillText(char, x + Math.sin(timeMs * 0.004 + y * 0.01) * width * 0.006, y);
    }
  }

  ctx.restore();
}

function drawLine(ctx, text, x, y, options = {}) {
  const {
    size = 28,
    font = 'Share Tech Mono',
    align = 'left',
    color = 'rgba(245, 248, 245, 0.9)',
    shadow = 'rgba(0, 0, 0, 0.85)',
    blur = 4,
    letterSpacing = 0,
  } = options;

  ctx.save();
  ctx.font = `${size}px "${font}", "Courier New", monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = blur;

  if (letterSpacing <= 0) {
    ctx.fillText(text, x, y);
    ctx.restore();
    return;
  }

  const chars = Array.from(text);
  const total = chars.reduce((sum, char) => sum + ctx.measureText(char).width + letterSpacing, -letterSpacing);
  let cursor = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;

  chars.forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + letterSpacing;
  });

  ctx.restore();
}

function drawPostText(ctx, width, height) {
  const vertical = height > width;
  const left = width * 0.09;
  const center = width * 0.5;
  const titleSize = vertical ? 82 : 78;
  const smallSize = vertical ? 30 : 24;

  if (activeTemplate === 'archive') {
    drawLine(ctx, '> Proyecto ganador de la Beca de Programacion Virtual', left, height * 0.14, { size: smallSize, letterSpacing: 2 });
    drawLine(ctx, 'Scrolling', left, height * 0.28, { size: titleSize, font: 'Disket Mono', color: '#9eff71', shadow: 'rgba(158, 255, 113, 0.72)', blur: 18, letterSpacing: 6 });
    drawLine(ctx, 'Life', left, height * 0.36, { size: titleSize, font: 'Disket Mono', color: '#9eff71', shadow: 'rgba(158, 255, 113, 0.72)', blur: 18, letterSpacing: 6 });
    drawLine(ctx, '> Ivan Barajas Hurtado', left, height * 0.48, { size: smallSize, letterSpacing: 2 });
    drawLine(ctx, '17 de septiembre de 2026', left, height * 0.57, { size: smallSize + 4, color: '#e0ffd5', letterSpacing: 4 });
    return;
  }

  if (activeTemplate === 'date') {
    drawLine(ctx, '17 de septiembre de 2026', center, height * 0.68, { size: vertical ? 42 : 34, align: 'center', color: '#9eff71', letterSpacing: 5 });
    drawLine(ctx, 'Scrolling', center, height * 0.78, { size: titleSize, font: 'Disket Mono', align: 'center', color: '#9eff71', shadow: 'rgba(158, 255, 113, 0.72)', blur: 18, letterSpacing: 6 });
    drawLine(ctx, 'Life', center, height * 0.86, { size: titleSize, font: 'Disket Mono', align: 'center', color: '#9eff71', shadow: 'rgba(158, 255, 113, 0.72)', blur: 18, letterSpacing: 6 });
    return;
  }

  drawLine(ctx, '> Proyecto ganador de la Beca de Programacion Virtual', center, height * 0.25, { size: smallSize, align: 'center', letterSpacing: 2 });
  drawLine(ctx, 'Scrolling', center, height * 0.43, { size: titleSize, font: 'Disket Mono', align: 'center', color: '#9eff71', shadow: 'rgba(158, 255, 113, 0.72)', blur: 18, letterSpacing: 6 });
  drawLine(ctx, 'Life', center, height * 0.52, { size: titleSize, font: 'Disket Mono', align: 'center', color: '#9eff71', shadow: 'rgba(158, 255, 113, 0.72)', blur: 18, letterSpacing: 6 });
  drawLine(ctx, '> Ivan Barajas Hurtado', center, height * 0.67, { size: smallSize, align: 'center', letterSpacing: 2 });
  drawLine(ctx, '17 de septiembre de 2026', center, height * 0.77, { size: smallSize + 4, align: 'center', color: '#e0ffd5', letterSpacing: 4 });
}

function drawPosterRect(ctx, width, height, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(width * x, height * y, width * w, height * h);
}

function drawPosterImage(ctx, image, x, y, w, h, makeWhite = false) {
  if (!image) return;

  ctx.save();
  ctx.filter = makeWhite ? 'brightness(0) invert(1)' : 'none';
  ctx.drawImage(image, x, y, w, h);
  ctx.restore();
}

function drawPosterDesign(ctx, width, height, assets) {
  const blue = '#1100ff';
  const green = '#00ff19';
  const gray = '#c7c7c7';
  const darkGray = '#565a5b';
  const yellow = '#fff100';

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = gray;
  ctx.fillRect(0, 0, width, height);

  drawPosterRect(ctx, width, height, 0, 0, 0.606, 0.218, blue);
  drawPosterRect(ctx, width, height, 0.606, 0, 0.394, 0.178, '#000');
  drawPosterRect(ctx, width, height, 0.597, 0.177, 0.344, 0.235, blue);
  drawPosterRect(ctx, width, height, 0.597, 0.397, 0.032, 0.078, blue);
  drawPosterRect(ctx, width, height, 0.056, 0.145, 0.455, 0.118, darkGray);
  drawPosterRect(ctx, width, height, 0.285, 0.188, 0.232, 0.051, green);
  drawPosterRect(ctx, width, height, 0, 0.366, 0.344, 0.271, green);
  drawPosterRect(ctx, width, height, 0, 0.637, 0.344, 0.218, darkGray);
  drawPosterRect(ctx, width, height, 0, 0.854, 0.502, 0.146, '#000');
  drawPosterRect(ctx, width, height, 0.573, 0.697, 0.081, 0.064, '#000');
  drawPosterRect(ctx, width, height, 0.573, 0.74, 0.148, 0.052, '#000');
  drawPosterRect(ctx, width, height, 0, 0.637, 0.061, 0.048, yellow);
  drawPosterRect(ctx, width, height, 0.248, 0.693, 0.079, 0.067, yellow);
  drawPosterRect(ctx, width, height, 0.283, 0.693, 0.044, 0.054, yellow);
  drawPosterRect(ctx, width, height, 0.943, 0.411, 0.057, 0.184, green);
  drawPosterRect(ctx, width, height, 0.502, 0.821, 0.072, 0.179, green);
  drawPosterRect(ctx, width, height, 0.558, 0.821, 0.016, 0.13, green);

  const checkerX = 0;
  const checkerY = height * 0.217;
  const checkerW = width * 0.307;
  const checkerH = height * 0.152;
  const columns = 8;
  const rows = 5;
  const cellW = checkerW / columns;
  const cellH = checkerH / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? green : blue;
      ctx.fillRect(checkerX + col * cellW, checkerY + row * cellH, cellW + 1, cellH + 1);
    }
  }

  drawPosterRect(ctx, width, height, 0.189, 0.365, 0.118, 0.092, green);
  drawPosterRect(ctx, width, height, 0.19, 0.392, 0.077, 0.037, gray);
  drawPosterRect(ctx, width, height, 0.228, 0.43, 0.039, 0.026, gray);

  const lineAreaW = width * 0.191;
  const lineAreaY = height * 0.366;
  const lineAreaH = height * 0.221;
  ctx.fillStyle = '#f1f1f1';
  ctx.fillRect(0, lineAreaY, lineAreaW, lineAreaH);
  ctx.fillStyle = green;

  for (let y = lineAreaY; y < lineAreaY + lineAreaH; y += Math.max(4, width * 0.0075)) {
    ctx.fillRect(0, y, lineAreaW, Math.max(2, width * 0.0048));
  }

  ctx.fillStyle = blue;
  ctx.fillRect(width * 0.058, lineAreaY, 1.5, lineAreaH);
  ctx.fillRect(lineAreaW - 1.5, lineAreaY, 1.5, lineAreaH);

  const greenLineX = width * 0.15;
  const greenLineY = height * 0.093;
  const greenLineW = width * 0.468;
  const greenLineH = height * 0.097;

  for (let x = greenLineX; x < greenLineX + greenLineW; x += Math.max(5, width * 0.0078)) {
    ctx.fillStyle = green;
    ctx.fillRect(x, greenLineY, Math.max(3, width * 0.0045), greenLineH);
  }

  const topBarX = width * 0.606;
  const topBarY = height * 0.093;
  const topBarW = width * 0.341;
  const topBarH = height * 0.085;
  ctx.fillStyle = '#000';
  ctx.fillRect(topBarX, topBarY, topBarW, topBarH);
  ctx.fillStyle = '#777';

  for (let x = topBarX; x < topBarX + topBarW; x += Math.max(4, width * 0.0065)) {
    ctx.fillRect(x, topBarY, Math.max(1.5, width * 0.0018), topBarH);
  }

  ctx.fillStyle = blue;
  ctx.fillRect(topBarX, topBarY + topBarH * 0.42, topBarW, Math.max(1.5, width * 0.002));
  ctx.fillStyle = '#000';
  ctx.fillRect(topBarX + topBarW * 0.51, topBarY + topBarH * 0.46, topBarW * 0.49, topBarH * 0.54);

  for (let x = width * 0.635; x < width * 0.75; x += width * 0.025) {
    ctx.fillStyle = blue;
    ctx.fillRect(x, 0, Math.max(2, width * 0.0032), topBarY);
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = Math.max(1, width * 0.0012);
  const wirePaths = [
    [[0.31, 0.216], [0.31, 0.602], [0.348, 0.645], [0.51, 0.645]],
    [[0.379, 0.216], [0.379, 0.599], [0.412, 0.645], [0.51, 0.645]],
    [[0.51, 0.216], [0.51, 0.596], [0.55, 0.646], [0.55, 0.692]],
    [[0.653, 0.41], [0.653, 0.443], [0.747, 0.443], [0.747, 0.504], [0.695, 0.504]],
    [[0.827, 0.41], [0.851, 0.444], [0.918, 0.444], [0.918, 0.502], [0.857, 0.502]],
    [[0.765, 0.444], [0.765, 0.598], [0.81, 0.645], [0.918, 0.645], [0.919, 0.692]],
  ];

  wirePaths.forEach((points) => {
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(width * x, height * y);
      else ctx.lineTo(width * x, height * y);
    });
    ctx.stroke();
  });
  ctx.restore();

  drawPosterImage(ctx, assets?.campaign, width * 0.028, height * 0.025, width * 0.113, height * 0.07, true);
  drawPosterImage(ctx, assets?.bogota, width * 0.865, height * 0.029, width * 0.108, height * 0.045);

  ctx.save();
  ctx.font = `${width * 0.078}px "Instrument Serif", Georgia, serif`;
  ctx.textBaseline = 'top';
  ctx.lineWidth = Math.max(1.5, width * 0.0017);
  ctx.strokeStyle = green;
  ctx.fillStyle = darkGray;
  ctx.strokeText('SCROLLING', width * 0.057, height * 0.143);
  ctx.fillText('SCROLLING', width * 0.057, height * 0.143);
  ctx.strokeText('LIFE', width * 0.057, height * 0.197);
  ctx.fillText('LIFE', width * 0.057, height * 0.197);
  ctx.restore();

  const sCanvas = document.createElement('canvas');
  sCanvas.width = Math.ceil(width * 0.24);
  sCanvas.height = Math.ceil(height * 0.22);
  const sCtx = sCanvas.getContext('2d');
  sCtx.font = `${width * 0.205}px "Instrument Serif", Georgia, serif`;
  sCtx.textBaseline = 'top';
  sCtx.fillStyle = green;
  sCtx.fillText('S', 0, 0);
  sCtx.globalCompositeOperation = 'source-in';

  for (let x = 0; x < sCanvas.width; x += Math.max(6, width * 0.0128)) {
    sCtx.fillStyle = x % Math.max(12, width * 0.0256) < Math.max(4, width * 0.009) ? green : blue;
    sCtx.fillRect(x, 0, Math.max(5, width * 0.009), sCanvas.height);
  }

  ctx.drawImage(sCanvas, width * 0.716, height * 0.213);

  ctx.save();
  ctx.fillStyle = green;
  ctx.font = `${width * 0.073}px "Instrument Serif", Georgia, serif`;
  ctx.textBaseline = 'top';
  ctx.fillText('sept.17', width * 0.058, height * 0.646);
  ctx.fillText('2026', width * 0.058, height * 0.703);

  ctx.font = `${width * 0.021}px "VT323", "Share Tech Mono", monospace`;
  ctx.fillText('PROYECTO GANADOR DE LA BECA DE PROGRAMACIÓN', width * 0.061, height * 0.779);
  ctx.fillText('VIRTUAL EN ARTES PLÁSTICAS Y VISUALES', width * 0.061, height * 0.797);
  ctx.fillText('GSF', width * 0.061, height * 0.815);
  ctx.restore();

  ctx.save();
  ctx.translate(width * 0.062, height * 0.942);
  ctx.rotate(-43 * Math.PI / 180);
  ctx.fillStyle = '#fff';
  ctx.font = `${width * 0.011}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('GALERÍA', 0, 0);
  ctx.fillText('SANTA FE', 0, width * 0.014);
  ctx.fillText('DESDE 1948', 0, width * 0.028);
  ctx.restore();

  ctx.save();
  ctx.translate(width * 0.17, height * 0.946);
  ctx.rotate(-43 * Math.PI / 180);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2, width * 0.0022);
  ctx.strokeRect(-width * 0.039, -width * 0.039, width * 0.078, width * 0.078);
  ctx.fillStyle = '#fff';
  ctx.font = `${width * 0.025}px "Disket Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GSF', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#050505';
  ctx.font = `700 ${width * 0.0115}px "Bricolage Grotesque", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const idartesX = width * 0.92;
  ctx.fillText('INSTITUTO', idartesX, height * 0.923);
  ctx.fillText('DISTRITAL DE LAS ARTES', idartesX, height * 0.936);
  ctx.fillText('IDARTES', idartesX, height * 0.949);
  ctx.restore();

  ctx.restore();
}

function drawPostFrame(canvas, layers, timeMs = performance.now(), posterAssets = null) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;

  if (activeTemplate === 'poster') {
    drawPosterDesign(ctx, width, height, posterAssets);
    return;
  }

  ctx.clearRect(0, 0, width, height);
  fillBase(ctx, width, height);
  layers.forEach((layer) => drawStrip(ctx, layer, width, height, timeMs));
  drawScanlines(ctx, width, height, activeTemplate === 'archive' || activeTemplate === 'story-blue' || activeTemplate === 'story-glitch' || activeTemplate === 'story-binary' ? 0.11 : 0.16);
  if (activeTemplate === 'story-glitch' || activeTemplate === 'story-binary') {
    drawGlitch(ctx, width, height, timeMs);
  }
  if (activeTemplate === 'story-binary') {
    drawBinaryOverlay(ctx, width, height, timeMs);
  }
  drawVignette(ctx, width, height);

  if (!activeBgOnly) {
    drawPostText(ctx, width, height);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo crear el archivo.'));
    }, type, quality);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setButtonBusy(button, isBusy, label = '') {
  if (!button) return;
  if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;

  button.disabled = isBusy;
  button.setAttribute('aria-busy', String(isBusy));

  if (isBusy) {
    button.textContent = label;
  } else {
    button.innerHTML = button.dataset.idleHtml;
  }
}

if (btnDownloadImg) {
  btnDownloadImg.addEventListener('click', async () => {
    setButtonBusy(btnDownloadImg, true, 'Generando PNG...');

    try {
      const { canvas, layers, posterAssets } = await prepareExportCanvas();
      drawPostFrame(canvas, layers, performance.now(), posterAssets);
      const blob = await canvasToBlob(canvas, 'image/png');
      downloadBlob(blob, `${sanitizeFilename(activeLabel)}.png`);
    } catch (error) {
      console.error(error);
      alert('No se pudo generar la imagen. Intenta abrir la pagina desde localhost.');
    } finally {
      setButtonBusy(btnDownloadImg, false);
    }
  });
}

if (btnDownloadVid) {
  btnDownloadVid.addEventListener('click', async () => {
    if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) {
      alert('Este navegador no permite grabar video desde canvas.');
      return;
    }

    const mp4MimeType = getMp4VideoFormat();

    if (!mp4MimeType) {
      alert('Este navegador no permite exportar MP4 real desde canvas. Prueba en una version actualizada de Chrome, Edge o Safari.');
      return;
    }

    setButtonBusy(btnDownloadVid, true, 'Grabando MP4...');

    try {
      const { canvas, layers, posterAssets } = await prepareExportCanvas('video');
      const chunks = [];
      const stream = canvas.captureStream(videoFps);
      const recorderOptions = {
        mimeType: mp4MimeType,
        videoBitsPerSecond: getVideoBitrate(),
      };

      const recorder = new MediaRecorder(stream, recorderOptions);

      const done = new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('No se pudo grabar el video.'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mp4MimeType }));
      });

      drawPostFrame(canvas, layers, performance.now(), posterAssets);
      recorder.start();

      const start = performance.now();
      const render = (now) => {
        const elapsed = now - start;
        drawPostFrame(canvas, layers, start + elapsed * videoMotionMultiplier, posterAssets);

        if (elapsed < videoDurationMs) {
          requestAnimationFrame(render);
        } else if (recorder.state === 'recording') {
          recorder.stop();
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      requestAnimationFrame(render);
      const blob = await done;
      const size = getExportSize('video');
      downloadBlob(blob, `${sanitizeFilename(activeLabel)}-${size.width}x${size.height}-hd.mp4`);
    } catch (error) {
      console.error(error);
      alert('No se pudo generar el video. Intenta abrir la pagina desde localhost.');
    } finally {
      setButtonBusy(btnDownloadVid, false);
    }
  });
}
