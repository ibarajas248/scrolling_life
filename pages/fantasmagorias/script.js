(() => {
  const renderCanvas = document.getElementById('renderCanvas');
  const renderCtx = renderCanvas.getContext('2d', { alpha: false });
  const video = document.getElementById('cameraFeed');

  renderCtx.imageSmoothingEnabled = false;

  let SOURCE_IMAGES = [];
  const RECENT_IMAGE_LIMIT = 40;
  const LOCAL_IMAGE_MANIFEST = '../../assets/images/netart-cache/manifest.json';

  function resolveManifestImageUrl(entry, manifestUrl) {
    const value = String(entry || '').trim();
    if (!value) {
      return null;
    }

    if (/^(?:https?:|data:|blob:)/i.test(value)) {
      return value;
    }

    if (/^(?:\.\/)?assets\//i.test(value)) {
      const siteRoot = new URL('../../', window.location.href);
      return new URL(value.replace(/^\.\//, ''), siteRoot).href;
    }

    return new URL(value, manifestUrl).href;
  }

  async function fetchRecentLocalImages() {
    const manifestUrl = new URL(LOCAL_IMAGE_MANIFEST, window.location.href);
    manifestUrl.searchParams.set('fresh', Date.now().toString());

    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`El archivo de imagenes respondio ${response.status}.`);
    }

    const manifest = await response.json();
    const entries = Array.isArray(manifest?.images) ? manifest.images : [];
    const recentImages = [];
    const seen = new Set();

    for (let index = entries.length - 1; index >= 0 && recentImages.length < RECENT_IMAGE_LIMIT; index -= 1) {
      const url = resolveManifestImageUrl(entries[index], manifestUrl);
      if (url && !seen.has(url)) {
        seen.add(url);
        recentImages.push(url);
      }
    }

    if (!recentImages.length) {
      throw new Error('El archivo local no contiene imagenes utilizables.');
    }

    return recentImages;
  }

  async function fetchApiImages() {
    try {
      SOURCE_IMAGES = await fetchRecentLocalImages();
      return;
    } catch (error) {
      console.warn('Fallo el archivo de imagenes recientes; usando respaldo externo.', error);
    }

    let newImages = [];
    try {
      const endpoint = "https://en.wikipedia.org/w/api.php";
      const params = new URLSearchParams({
        action: "query",
        format: "json",
        prop: "pageimages",
        generator: "random",
        grnnamespace: "0",
        grnlimit: "40",
        pithumbsize: "800",
        origin: "*"
      });
      
      const response = await fetch(`${endpoint}?${params}`);
      const data = await response.json();
      
      if (data && data.query && data.query.pages) {
        const pages = data.query.pages;
        for (const pageId in pages) {
          const thumb = pages[pageId].thumbnail;
          if (thumb && thumb.source) {
            newImages.push(thumb.source);
          }
        }
      }
    } catch (e) {
      console.warn('Fallo la API de Wikipedia.', e);
    }

    // Si Wikipedia devolvió muy pocas (o ninguna), completamos con Picsum API garantizada.
    if (newImages.length < 5) {
      for (let i = 0; i < 8; i++) {
        newImages.push(`https://picsum.photos/800/800?random=${Math.random()}`);
      }
    }

    SOURCE_IMAGES = newImages;
  }

  const config = {
    secondsPerImage: 3.0,
    halfLifeSec: 60.0,
    internalScale: 0.42,
    targetFps: 30,
    cameraMirror: true,
    cameraWidth: 1280,
    cameraHeight: 720,
    paintStrength: 0.45,
    personMaskThreshold: 0.35,
    useMotionBoost: true,
    motionOnly: false,
    motionThreshold: 22,
    minMaskArea: 0.002,
    scrollScreenPxPerSec: 120.0,
  };

  const state = {
    started: false,
    loading: false,
    sourceImages: [],
    sourceFrames: [],
    sourceIndex: 0,
    play: true,
    procW: 0,
    procH: 0,
    pixelCount: 0,
    displayW: 0,
    displayH: 0,
    displayScale: 1,
    buildCanvas: null,
    buildCtx: null,
    workCanvas: null,
    workCtx: null,
    camCanvas: null,
    camCtx: null,
    maskCanvas: null,
    maskCtx: null,
    alphaCanvas: null,
    alphaCtx: null,
    maskedCanvas: null,
    maskedCtx: null,
    alphaImageData: null,
    rawPersonMask: null,
    personMask: null,
    rawMotionMask: null,
    motionMask: null,
    blurBuffer: null,
    prevGray: null,
    activeArea: 0,
    motionLevel: 0,
    scrollAccum: 0,
    lastFrameTime: 0,
    lastSourceSwitch: 0,
    segmenter: null,
    stream: null,
  };

  function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function resizeDisplayCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    state.displayScale = dpr;
    state.displayW = Math.max(1, Math.floor(window.innerWidth * dpr));
    state.displayH = Math.max(1, Math.floor(window.innerHeight * dpr));
    renderCanvas.width = state.displayW;
    renderCanvas.height = state.displayH;
    renderCtx.imageSmoothingEnabled = false;
  }

  function resetProcessingBuffers() {
    const nextProcW = Math.max(320, Math.floor(window.innerWidth * config.internalScale));
    const nextProcH = Math.max(240, Math.floor(window.innerHeight * config.internalScale));

    const previousBuild = state.buildCanvas;

    state.procW = nextProcW;
    state.procH = nextProcH;
    state.pixelCount = state.procW * state.procH;

    state.buildCanvas = createCanvas(state.procW, state.procH);
    state.workCanvas = createCanvas(state.procW, state.procH);
    state.camCanvas = createCanvas(state.procW, state.procH);
    state.maskCanvas = createCanvas(state.procW, state.procH);
    state.alphaCanvas = createCanvas(state.procW, state.procH);
    state.maskedCanvas = createCanvas(state.procW, state.procH);

    state.buildCtx = state.buildCanvas.getContext('2d', { alpha: false });
    state.workCtx = state.workCanvas.getContext('2d', { alpha: true });
    state.camCtx = state.camCanvas.getContext('2d', { willReadFrequently: true });
    state.maskCtx = state.maskCanvas.getContext('2d', { willReadFrequently: true });
    state.alphaCtx = state.alphaCanvas.getContext('2d', { willReadFrequently: true });
    state.maskedCtx = state.maskedCanvas.getContext('2d', { alpha: true });

    state.buildCtx.imageSmoothingEnabled = false;
    state.workCtx.imageSmoothingEnabled = false;
    state.camCtx.imageSmoothingEnabled = false;
    state.maskCtx.imageSmoothingEnabled = false;
    state.alphaCtx.imageSmoothingEnabled = false;
    state.maskedCtx.imageSmoothingEnabled = false;

    state.rawPersonMask = new Float32Array(state.pixelCount);
    state.personMask = new Float32Array(state.pixelCount);
    state.rawMotionMask = new Float32Array(state.pixelCount);
    state.motionMask = new Float32Array(state.pixelCount);
    state.blurBuffer = new Float32Array(state.pixelCount);
    state.prevGray = null;
    state.alphaImageData = state.alphaCtx.createImageData(state.procW, state.procH);
    state.scrollAccum = 0;

    state.buildCtx.fillStyle = '#000000';
    state.buildCtx.fillRect(0, 0, state.procW, state.procH);

    if (previousBuild) {
      state.buildCtx.drawImage(previousBuild, 0, 0, state.procW, state.procH);
    }

    rasterizeSources();
  }

  function rasterizeSources() {
    if (!state.sourceImages.length || !state.procW || !state.procH) {
      state.sourceFrames = [];
      return;
    }

    state.sourceFrames = state.sourceImages.map((image) => {
      const canvas = createCanvas(state.procW, state.procH);
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(image, 0, 0, state.procW, state.procH);
      return canvas;
    });

    state.sourceIndex = clamp(state.sourceIndex, 0, Math.max(0, state.sourceFrames.length - 1));
  }

  function preloadImages() {
    return Promise.all(
      SOURCE_IMAGES.map((url) => new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve({ ok: true, image, url });
        image.onerror = () => resolve({ ok: false, image: null, url });
        image.src = url;
      })),
    );
  }

  function blurCross(source, target, width, height) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      const rowUp = (y > 0 ? y - 1 : y) * width;
      const rowDown = (y < height - 1 ? y + 1 : y) * width;

      for (let x = 0; x < width; x += 1) {
        const index = row + x;
        const left = row + (x > 0 ? x - 1 : x);
        const right = row + (x < width - 1 ? x + 1 : x);
        target[index] = (
          source[index] * 4.0 +
          source[left] +
          source[right] +
          source[rowUp + x] +
          source[rowDown + x]
        ) / 8.0;
      }
    }
  }

  function smoothMask(source, output) {
    blurCross(source, state.blurBuffer, state.procW, state.procH);
    blurCross(state.blurBuffer, output, state.procW, state.procH);
    for (let i = 0; i < state.pixelCount; i += 1) {
      output[i] = clamp(output[i], 0, 1);
    }
  }

  function drawMirrored(ctx, image) {
    ctx.save();
    ctx.clearRect(0, 0, state.procW, state.procH);
    if (config.cameraMirror) {
      ctx.translate(state.procW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(image, 0, 0, state.procW, state.procH);
    ctx.restore();
  }

  function updatePersonMask(results) {
    drawMirrored(state.maskCtx, results.segmentationMask);
    const maskImage = state.maskCtx.getImageData(0, 0, state.procW, state.procH).data;
    let activePixels = 0;

    for (let i = 0, p = 0; i < state.pixelCount; i += 1, p += 4) {
      const value = maskImage[p] / 255;
      const masked = value >= config.personMaskThreshold ? value : 0;
      state.rawPersonMask[i] = masked;
      if (masked > 0.15) {
        activePixels += 1;
      }
    }

    state.activeArea = activePixels / state.pixelCount;

    if (state.activeArea < config.minMaskArea) {
      state.rawPersonMask.fill(0);
      state.personMask.fill(0);
      state.activeArea = 0;
      return;
    }

    smoothMask(state.rawPersonMask, state.personMask);
  }

  function updateMotionMask(cameraData) {
    const pixels = cameraData.data;

    if (!state.prevGray) {
      state.prevGray = new Float32Array(state.pixelCount);
      for (let i = 0, p = 0; i < state.pixelCount; i += 1, p += 4) {
        state.prevGray[i] = pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114;
      }
      state.rawMotionMask.fill(0);
      state.motionMask.fill(0);
      state.motionLevel = 0;
      return;
    }

    let motionSum = 0;

    for (let i = 0, p = 0; i < state.pixelCount; i += 1, p += 4) {
      const gray = pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114;
      const diff = Math.abs(gray - state.prevGray[i]);
      state.prevGray[i] = gray;
      const motion = diff >= config.motionThreshold ? diff / 255 : 0;
      state.rawMotionMask[i] = motion;
      motionSum += motion;
    }

    smoothMask(state.rawMotionMask, state.motionMask);
    state.motionLevel = motionSum / state.pixelCount;
  }

  function updateAlphaMask() {
    const alphaPixels = state.alphaImageData.data;

    for (let i = 0, p = 0; i < state.pixelCount; i += 1, p += 4) {
      const person = state.personMask[i];
      const motion = state.motionMask[i];
      let alpha = 0;

      if (config.motionOnly) {
        alpha = config.paintStrength * person * motion;
      } else if (config.useMotionBoost) {
        alpha = config.paintStrength * person * (0.35 + 0.65 * motion);
      } else {
        alpha = config.paintStrength * person;
      }

      alpha = clamp(alpha, 0, 1);
      const byte = Math.round(alpha * 255);

      alphaPixels[p] = 255;
      alphaPixels[p + 1] = 255;
      alphaPixels[p + 2] = 255;
      alphaPixels[p + 3] = byte;
    }

    state.alphaCtx.putImageData(state.alphaImageData, 0, 0);
  }

  function scrollBuildUp(dy) {
    if (dy <= 0) {
      return;
    }

    if (dy >= state.procH) {
      state.buildCtx.clearRect(0, 0, state.procW, state.procH);
      return;
    }

    state.workCtx.clearRect(0, 0, state.procW, state.procH);
    state.workCtx.drawImage(
      state.buildCanvas,
      0,
      dy,
      state.procW,
      state.procH - dy,
      0,
      0,
      state.procW,
      state.procH - dy,
    );

    state.buildCtx.clearRect(0, 0, state.procW, state.procH);
    state.buildCtx.drawImage(state.workCanvas, 0, 0);
  }

  function fadeBuild(dt) {
    const decay = Math.exp(-Math.LN2 * (dt / Math.max(config.halfLifeSec, 0.001)));
    state.buildCtx.save();
    state.buildCtx.globalCompositeOperation = 'source-over';
    state.buildCtx.fillStyle = `rgba(0, 0, 0, ${1 - decay})`;
    state.buildCtx.fillRect(0, 0, state.procW, state.procH);
    state.buildCtx.restore();
  }

  function paintBuild() {
    if (!state.sourceFrames.length) {
      return;
    }

    state.maskedCtx.clearRect(0, 0, state.procW, state.procH);
    state.maskedCtx.globalCompositeOperation = 'source-over';
    state.maskedCtx.drawImage(state.sourceFrames[state.sourceIndex], 0, 0);
    state.maskedCtx.globalCompositeOperation = 'destination-in';
    state.maskedCtx.drawImage(state.alphaCanvas, 0, 0);
    state.maskedCtx.globalCompositeOperation = 'source-over';
    state.buildCtx.drawImage(state.maskedCanvas, 0, 0);
  }

  function renderBuild() {
    renderCtx.fillStyle = '#020304';
    renderCtx.fillRect(0, 0, state.displayW, state.displayH);
    renderCtx.drawImage(state.buildCanvas, 0, 0, state.displayW, state.displayH);

    renderCtx.save();
    renderCtx.globalAlpha = 0.12;
    renderCtx.fillStyle = '#ffffff';
    for (let y = 0; y < state.displayH; y += 4) {
      renderCtx.fillRect(0, y, state.displayW, 1);
    }
    renderCtx.restore();
  }

  function clearBuild() {
    if (!state.buildCtx) {
      return;
    }
    state.buildCtx.clearRect(0, 0, state.procW, state.procH);
    state.prevGray = null;
  }

  function saveSnapshot() {
    if (!state.started) {
      return;
    }

    renderCanvas.toBlob((blob) => {
      if (!blob) {
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `scroll_fantasmagorias_${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    }, 'image/png');
  }

  function switchSource(now) {
    if (!state.play || state.sourceFrames.length < 2) {
      return;
    }

    if (!state.lastSourceSwitch) {
      state.lastSourceSwitch = now;
      return;
    }

    if (now - state.lastSourceSwitch >= config.secondsPerImage * 1000) {
      state.lastSourceSwitch = now;
      state.sourceIndex = (state.sourceIndex + 1) % state.sourceFrames.length;
    }
  }

  function processFrame(results) {
    if (!state.started || !state.buildCanvas) {
      return;
    }

    const now = performance.now();
    const minFrameTime = 1000 / config.targetFps;

    if (state.lastFrameTime && now - state.lastFrameTime < minFrameTime * 0.5) {
      return;
    }

    const dt = state.lastFrameTime
      ? Math.min(0.1, Math.max(0.001, (now - state.lastFrameTime) / 1000))
      : 1 / config.targetFps;

    state.lastFrameTime = now;
    switchSource(now);

    drawMirrored(state.camCtx, results.image);
    const cameraData = state.camCtx.getImageData(0, 0, state.procW, state.procH);

    updatePersonMask(results);
    updateMotionMask(cameraData);

    state.scrollAccum += (config.scrollScreenPxPerSec * (state.procH / Math.max(window.innerHeight, 1))) * dt;
    const dy = Math.floor(state.scrollAccum);
    if (dy > 0) {
      scrollBuildUp(dy);
      state.scrollAccum -= dy;
    }

    fadeBuild(dt);
    updateAlphaMask();
    paintBuild();
    renderBuild();
  }

  async function pumpSegmentation() {
    if (!state.started || !state.segmenter) {
      return;
    }

    if (video.readyState < 2) {
      requestAnimationFrame(pumpSegmentation);
      return;
    }

    try {
      await state.segmenter.send({ image: video });
    } catch (error) {
      console.error(error);
      stopCameraStream();
      state.started = false;
      return;
    }

    if (state.started) {
      requestAnimationFrame(pumpSegmentation);
    }
  }

  async function initCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
      video.srcObject = null;
    }

    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: config.cameraWidth },
        height: { ideal: config.cameraHeight },
        facingMode: 'user',
      },
    });

    video.srcObject = state.stream;

    await new Promise((resolve) => {
      if (video.readyState >= 2) {
        resolve();
        return;
      }
      video.onloadedmetadata = () => resolve();
    });

    await video.play();
  }

  function stopCameraStream() {
    if (!state.stream) {
      return;
    }

    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    video.srcObject = null;
  }

  function initSegmenter() {
    if (state.segmenter) {
      return;
    }

    if (typeof SelfieSegmentation === 'undefined') {
      throw new Error('MediaPipe SelfieSegmentation no esta disponible.');
    }

    state.segmenter = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    state.segmenter.setOptions({ modelSelection: 1 });
    state.segmenter.onResults(processFrame);
  }

  async function startExperience() {
    if (state.loading || state.started) {
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Este navegador no soporta getUserMedia.');
      return;
    }

    state.loading = true;

    try {
      if (!state.sourceImages.length) {
        await fetchApiImages();
        const loaded = await preloadImages();
        state.sourceImages = loaded.filter((entry) => entry.ok).map((entry) => entry.image);

        if (!state.sourceImages.length) {
          throw new Error('No pude cargar las imagenes recientes.');
        }
      }

      initSegmenter();
      await initCamera();
      resizeDisplayCanvas();
      resetProcessingBuffers();

      state.started = true;
      state.play = true;
      state.sourceIndex = 0;
      state.lastFrameTime = 0;
      state.lastSourceSwitch = performance.now();
      requestAnimationFrame(pumpSegmentation);
    } catch (error) {
      console.error(error);
      stopCameraStream();
    } finally {
      state.loading = false;
    }
  }

  function togglePlay() {
    if (!state.started) {
      return;
    }
    state.play = !state.play;
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error(error);
    }
  }

  function adjustHalfLife(delta) {
    config.halfLifeSec = clamp(config.halfLifeSec + delta, 5, 300);
  }

  function adjustPaintStrength(delta) {
    config.paintStrength = clamp(config.paintStrength + delta, 0.01, 1.0);
  }

  function adjustScrollSpeed(delta) {
    config.scrollScreenPxPerSec = clamp(config.scrollScreenPxPerSec + delta, 0, 600);
  }

  function toggleMotionBoost() {
    config.useMotionBoost = !config.useMotionBoost;
    if (config.useMotionBoost) {
      config.motionOnly = false;
    }
  }

  function toggleMotionOnly() {
    config.motionOnly = !config.motionOnly;
    if (config.motionOnly) {
      config.useMotionBoost = false;
    }
  }

  const keyActions = new Map([
    ['Space', () => {
      if (state.started) {
        togglePlay();
      }
    }],
    ['Digit1', () => adjustHalfLife(-10)],
    ['Digit2', () => adjustHalfLife(10)],
    ['Minus', () => adjustPaintStrength(-0.05)],
    ['NumpadSubtract', () => adjustPaintStrength(-0.05)],
    ['Equal', () => adjustPaintStrength(0.05)],
    ['NumpadAdd', () => adjustPaintStrength(0.05)],
    ['BracketLeft', () => adjustScrollSpeed(-20)],
    ['BracketRight', () => adjustScrollSpeed(20)],
    ['KeyV', () => toggleMotionBoost()],
    ['KeyX', () => toggleMotionOnly()],
    ['KeyS', () => saveSnapshot()],
    ['KeyR', () => clearBuild()],
    ['KeyF', () => toggleFullscreen()],
  ]);

  const handledKeyCodes = new Set(keyActions.keys());

  function handleKeydown(event) {
    if (handledKeyCodes.has(event.code)) {
      event.preventDefault();
    }

    const action = keyActions.get(event.code);
    if (action) {
      action();
    }
  }

  function handleResize() {
    resizeDisplayCanvas();
    if (state.started) {
      resetProcessingBuffers();
    } else {
      renderCtx.fillStyle = '#020304';
      renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
    }
  }

  function bindEvents() {
    renderCanvas.addEventListener('pointerdown', startExperience);
    window.addEventListener('beforeunload', stopCameraStream);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeydown);
  }

  bindEvents();
  handleResize();
  startExperience();
})();
