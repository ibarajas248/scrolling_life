(() => {
  const renderCanvas = document.getElementById('renderCanvas');
  const renderCtx = renderCanvas.getContext('2d', { alpha: false });
  const video = document.getElementById('cameraFeed');

  const gate = document.getElementById('gate');
  const gateNote = document.getElementById('gateNote');
  const statusToast = document.getElementById('statusToast');
  const startButton = document.getElementById('startButton');
  const fullscreenButton = document.getElementById('fullscreenButton');
  const toggleButton = document.getElementById('toggleButton');
  const saveButton = document.getElementById('saveButton');
  const resetButton = document.getElementById('resetButton');

  const sourceLabel = document.getElementById('sourceLabel');
  const sequenceLabel = document.getElementById('sequenceLabel');
  const modeLabel = document.getElementById('modeLabel');
  const halfLifeLabel = document.getElementById('halfLifeLabel');
  const strengthLabel = document.getElementById('strengthLabel');
  const scrollLabel = document.getElementById('scrollLabel');
  const bodyLabel = document.getElementById('bodyLabel');
  const motionLabel = document.getElementById('motionLabel');
  const playLabel = document.getElementById('playLabel');
  const stateLabel = document.getElementById('stateLabel');

  renderCtx.imageSmoothingEnabled = false;

  const SOURCE_IMAGES = [
    '../images/netart/Screenshot_20250108-144156.jpg',
    '../scroll_strips/strip_000001.jpg',
    '../scroll_strips/strip_000002.jpg',
    '../scroll_strips/strip_000003.jpg',
    '../scroll_strips/strip_000004.jpg',
  ];

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
    overlayTimer: 0,
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

  function setToast(message, duration = 900) {
    statusToast.textContent = message;
    statusToast.classList.add('is-visible');
    clearTimeout(state.overlayTimer);
    state.overlayTimer = window.setTimeout(() => {
      statusToast.classList.remove('is-visible');
    }, duration);
  }

  function setGateMessage(message) {
    gateNote.textContent = message;
  }

  function sourceName(path) {
    return path.split('/').pop() || path;
  }

  function currentModeLabel() {
    if (config.motionOnly) {
      return 'solo movimiento';
    }
    return config.useMotionBoost ? 'motion boost' : 'solo silueta';
  }

  function updateUi() {
    const total = state.sourceFrames.length;
    const safeIndex = total ? state.sourceIndex + 1 : 0;

    sourceLabel.textContent = total ? sourceName(SOURCE_IMAGES[state.sourceIndex]) : '--';
    sequenceLabel.textContent = `${safeIndex} / ${total}`;
    modeLabel.textContent = currentModeLabel();
    halfLifeLabel.textContent = `${config.halfLifeSec.toFixed(0)}s`;
    strengthLabel.textContent = config.paintStrength.toFixed(2);
    scrollLabel.textContent = `${config.scrollScreenPxPerSec.toFixed(0)} px/s`;
    bodyLabel.textContent = `${(state.activeArea * 100).toFixed(1)}%`;
    motionLabel.textContent = state.motionLevel.toFixed(2);
    playLabel.textContent = state.play ? 'PLAY' : 'PAUSE';
    toggleButton.textContent = state.play ? 'Pause' : 'Play';
    stateLabel.textContent = state.started
      ? 'Camara activa, build generativo corriendo.'
      : 'Esperando activacion de camara y segmentacion.';
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

  function clearBuild(showToast = true) {
    if (!state.buildCtx) {
      return;
    }
    state.buildCtx.clearRect(0, 0, state.procW, state.procH);
    state.prevGray = null;
    if (showToast) {
      setToast('build limpio', 800);
    }
  }

  function saveSnapshot() {
    if (!state.started) {
      return;
    }

    renderCanvas.toBlob((blob) => {
      if (!blob) {
        setToast('no pude guardar', 900);
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `scroll_fantasmagorias_${Date.now()}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      setToast('snapshot guardado', 900);
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
      setToast(sourceName(SOURCE_IMAGES[state.sourceIndex]), 700);
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
    updateUi();
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
      setGateMessage('La segmentacion fallo durante la ejecucion. Revisa permisos, red o recarga la pagina.');
      gate.hidden = false;
      state.started = false;
      updateUi();
      return;
    }

    if (state.started) {
      requestAnimationFrame(pumpSegmentation);
    }
  }

  async function initCamera() {
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
      setGateMessage('Este navegador no soporta getUserMedia.');
      return;
    }

    state.loading = true;
    setGateMessage('Cargando imagenes, camara y segmentacion...');
    startButton.disabled = true;

    try {
      if (!state.sourceImages.length) {
        const loaded = await preloadImages();
        state.sourceImages = loaded.filter((entry) => entry.ok).map((entry) => entry.image);

        if (!state.sourceImages.length) {
          throw new Error('No pude cargar imagenes fuente locales.');
        }

        if (state.sourceImages.length < SOURCE_IMAGES.length) {
          setToast('algunas imagenes no cargaron', 1200);
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
      gate.hidden = true;
      setToast('camara activa', 900);
      updateUi();
      requestAnimationFrame(pumpSegmentation);
    } catch (error) {
      console.error(error);
      setGateMessage(error.message || 'No se pudo iniciar la experiencia.');
      gate.hidden = false;
    } finally {
      state.loading = false;
      startButton.disabled = false;
      updateUi();
    }
  }

  function togglePlay() {
    if (!state.started) {
      return;
    }
    state.play = !state.play;
    setToast(state.play ? 'play' : 'pause', 700);
    updateUi();
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
    setToast(`half-life ${config.halfLifeSec.toFixed(0)}s`, 800);
    updateUi();
  }

  function adjustPaintStrength(delta) {
    config.paintStrength = clamp(config.paintStrength + delta, 0.01, 1.0);
    setToast(`strength ${config.paintStrength.toFixed(2)}`, 800);
    updateUi();
  }

  function adjustScrollSpeed(delta) {
    config.scrollScreenPxPerSec = clamp(config.scrollScreenPxPerSec + delta, 0, 600);
    setToast(`scroll ${config.scrollScreenPxPerSec.toFixed(0)} px/s`, 800);
    updateUi();
  }

  function toggleMotionBoost() {
    config.useMotionBoost = !config.useMotionBoost;
    if (config.useMotionBoost) {
      config.motionOnly = false;
    }
    setToast(config.useMotionBoost ? 'motion boost on' : 'motion boost off', 900);
    updateUi();
  }

  function toggleMotionOnly() {
    config.motionOnly = !config.motionOnly;
    if (config.motionOnly) {
      config.useMotionBoost = false;
    }
    setToast(config.motionOnly ? 'solo movimiento' : 'modo silueta', 900);
    updateUi();
  }

  function handleKeydown(event) {
    const handled = new Set([
      'Space',
      'Digit1',
      'Digit2',
      'Minus',
      'Equal',
      'BracketLeft',
      'BracketRight',
      'KeyV',
      'KeyX',
      'KeyS',
      'KeyR',
      'KeyF',
      'NumpadAdd',
      'NumpadSubtract',
    ]);

    if (handled.has(event.code)) {
      event.preventDefault();
    }

    switch (event.code) {
      case 'Space':
        if (state.started) {
          togglePlay();
        }
        break;
      case 'Digit1':
        adjustHalfLife(-10);
        break;
      case 'Digit2':
        adjustHalfLife(10);
        break;
      case 'Minus':
      case 'NumpadSubtract':
        adjustPaintStrength(-0.05);
        break;
      case 'Equal':
      case 'NumpadAdd':
        adjustPaintStrength(0.05);
        break;
      case 'BracketLeft':
        adjustScrollSpeed(-20);
        break;
      case 'BracketRight':
        adjustScrollSpeed(20);
        break;
      case 'KeyV':
        toggleMotionBoost();
        break;
      case 'KeyX':
        toggleMotionOnly();
        break;
      case 'KeyS':
        saveSnapshot();
        break;
      case 'KeyR':
        clearBuild();
        break;
      case 'KeyF':
        toggleFullscreen();
        break;
      default:
        break;
    }
  }

  function handleResize() {
    resizeDisplayCanvas();
    if (state.started) {
      resetProcessingBuffers();
      setToast('superficie reajustada', 700);
    } else {
      renderCtx.fillStyle = '#020304';
      renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
    }
  }

  startButton.addEventListener('click', startExperience);
  fullscreenButton.addEventListener('click', toggleFullscreen);
  toggleButton.addEventListener('click', togglePlay);
  saveButton.addEventListener('click', saveSnapshot);
  resetButton.addEventListener('click', () => clearBuild());
  window.addEventListener('resize', handleResize);
  window.addEventListener('keydown', handleKeydown);

  handleResize();
  updateUi();
})();
