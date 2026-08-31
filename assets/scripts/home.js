const progressBar = document.getElementById('progressBar');
const revealNodes = document.querySelectorAll('.reveal');
const kineticNodes = document.querySelectorAll('[data-speed]');
const bgLayers = document.querySelectorAll('.bg-image');
const netArtLayer = document.querySelector('.netart-layer');
const pageContent = document.querySelector('.page-content');
const siteMenu = document.querySelector('.site-menu');
const siteMenuSummary = siteMenu?.querySelector('summary');
const radioFloat = document.querySelector('.radio-float');
const radioFrame = document.querySelector('.radio-button-frame');
const radioSignal = document.querySelector('[data-radio-signal]');
const radioName = document.querySelector('[data-radio-name]');
const mosquitoLink = document.querySelector('.mosquito-link');
const hero = document.querySelector('.hero');
const heroArchive = document.querySelector('.hero-archive');
const netArtItems = [];

const MOSQUITO_CYCLE_MS = 60000;
const MOSQUITO_ACTIVE_MS = 20000;
const RAIN_PHASE_MS = 3000;
const MOSQUITO_SOUND_ENABLED = false;
const MOSQUITO_AUDIO_SRC = './assets/audio/mosquito-buzz.mp3';
const NETART_CACHE_MANIFEST = './assets/images/netart-cache/manifest.json';

let netArtStartTime = performance.now();
let mosquitoCycleTimer = null;
let mosquitoHideTimer = null;
let mosquitoSoundPlaying = false;
let mosquitoAudioUnlocked = false;
let mosquitoPlayRequested = false;
let scrollRainDistance = 0;
let scrollRainEnergy = 0;
let lastScrollY = window.scrollY;

const mosquitoAudio = mosquitoLink && MOSQUITO_SOUND_ENABLED ? new Audio(MOSQUITO_AUDIO_SRC) : null;

if (mosquitoAudio) {
  mosquitoAudio.preload = 'auto';
  mosquitoAudio.loop = true;
  mosquitoAudio.volume = 0.48;
  mosquitoAudio.playsInline = true;
  mosquitoAudio.load();
}

let netArtImages = [
  './assets/images/scroll-strips/strip_000001.jpg',
  './assets/images/scroll-strips/strip_000002.jpg',
  './assets/images/scroll-strips/strip_000003.jpg',
  './assets/images/scroll-strips/strip_000004.jpg',
  './assets/images/netart/Screenshot_20250108-144156.jpg'
];

const shuffleImages = (images) => {
  const shuffled = [...images];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const loadLocalNetArtImages = async () => {
  try {
    const response = await fetch(`${NETART_CACHE_MANIFEST}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return null;

    const manifest = await response.json();
    const images = Array.isArray(manifest.images) ? manifest.images : [];
    const validImages = images.filter((image) => typeof image === 'string' && image.length > 0);

    return validImages.length > 0 ? shuffleImages(validImages) : null;
  } catch (error) {
    console.warn('Cache local de imagenes no disponible, usando fallback.', error);
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
    } else {
      const remoteImages = await loadRemoteNetArtImages();
      if (remoteImages.length > 0) {
        netArtImages = remoteImages;
      }
    }
  } catch (e) {
    console.warn('API de imágenes falló, usando imágenes locales de respaldo.', e);
  }

  // Reiniciar el contador para que la ráfaga dure sus 3 segundos completos después de cargar la API
  netArtStartTime = performance.now();

  for (let i = 0; i < count; i++) {
    const item = document.createElement('div');
    item.className = 'netart-item';

    const image = netArtImages[i % netArtImages.length];
    item.style.backgroundImage = `url(${image})`;

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

const updateProgress = () => {
  if (!progressBar) return;
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = scrollable <= 0 ? 0 : (window.scrollY / scrollable) * 100;
  progressBar.style.height = `${Math.min(100, Math.max(0, ratio))}%`;
};

const setRadioState = (state) => {
  if (!radioFloat || !radioSignal || !radioName) return;

  radioFloat.dataset.radioState = state;

  if (state === 'live') {
    radioSignal.textContent = 'señal en vivo';
    radioName.textContent = 'radio scroll';
    radioFloat.setAttribute('aria-label', 'Señal en vivo Radio Scroll');
    return;
  }

  radioSignal.textContent = 'no signal';
  radioName.textContent = '';
  radioFloat.setAttribute('aria-label', 'Radio Scroll sin señal');
};

const initRadioSignal = () => {
  if (!radioFrame || !radioFloat) return;

  let frameLoaded = false;
  const signalTimeout = window.setTimeout(() => {
    if (!frameLoaded) {
      setRadioState('no-signal');
    }
  }, 6500);

  radioFrame.addEventListener('load', () => {
    frameLoaded = true;
    window.clearTimeout(signalTimeout);
    setRadioState('live');
  });

  radioFrame.addEventListener('error', () => {
    frameLoaded = false;
    window.clearTimeout(signalTimeout);
    setRadioState('no-signal');
  });
};

const initHeroArchiveSpotlight = () => {
  if (!hero || !heroArchive) return;

  const canTrackPointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? true;
  if (!canTrackPointer) return;

  let pendingPointer = null;
  let rafId = null;

  const updateSpotlight = () => {
    rafId = null;
    if (!pendingPointer) return;

    const rect = heroArchive.getBoundingClientRect();
    const x = ((pendingPointer.clientX - rect.left) / rect.width) * 100;
    const y = ((pendingPointer.clientY - rect.top) / rect.height) * 100;

    heroArchive.style.setProperty('--archive-cursor-x', `${Math.min(100, Math.max(0, x)).toFixed(2)}%`);
    heroArchive.style.setProperty('--archive-cursor-y', `${Math.min(100, Math.max(0, y)).toFixed(2)}%`);
  };

  const requestSpotlightUpdate = (event) => {
    pendingPointer = event;
    if (!rafId) {
      rafId = window.requestAnimationFrame(updateSpotlight);
    }
  };

  hero.addEventListener('pointerenter', (event) => {
    heroArchive.classList.add('is-pointer-active');
    requestSpotlightUpdate(event);
  }, { passive: true });

  hero.addEventListener('pointermove', requestSpotlightUpdate, { passive: true });

  hero.addEventListener('pointerleave', () => {
    heroArchive.classList.remove('is-pointer-active');
    pendingPointer = null;

    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }, { passive: true });
};

const terminalSequences = document.querySelectorAll('[data-terminal-sequence]');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotionEnabled = prefersReducedMotion.matches;
const canAnimateReveals = !reducedMotionEnabled && 'IntersectionObserver' in window;

if (canAnimateReveals) {
  document.body.classList.add('js-motion-ready');
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const prepareTerminalSequence = (sequence) => {
  sequence.querySelectorAll('[data-terminal-copy]').forEach((node) => {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    node.dataset.terminalText = text;

    if (!prefersReducedMotion.matches) {
      node.textContent = '';
    }
  });
};

const revealTerminalSequence = (sequence) => {
  const setupPanel = sequence.querySelector('[data-setup-panel]');

  if (setupPanel) {
    const progress = setupPanel.querySelector('[data-setup-progress]');
    const percent = setupPanel.querySelector('[data-setup-percent]');
    const status = setupPanel.querySelector('[data-setup-status]');

    if (progress instanceof HTMLElement) {
      progress.style.width = '100%';
    }

    if (percent) {
      percent.textContent = '100%';
    }

    if (status) {
      status.textContent = 'Setup complete. Starting BIOS console...';
    }

    setupPanel.querySelectorAll('[data-setup-step]').forEach((step) => {
      step.classList.add('is-complete');
      const stepStatus = step.querySelector('[data-step-status]');

      if (stepStatus) {
        stepStatus.textContent = 'Completed';
      }
    });

    sequence.classList.add('setup-complete');
  }

  sequence.querySelectorAll('[data-terminal-copy]').forEach((node) => {
    node.textContent = node.dataset.terminalText || '';
    node.closest('.terminal-line')?.classList.add('is-complete');
  });

  sequence.classList.add('terminal-complete');
};

let terminalRunId = 0;

const typeTerminalLine = async (node, baseSpeed, runId) => {
  const text = node.dataset.terminalText || '';
  const line = node.closest('.terminal-line');

  if (!text) {
    return;
  }

  line?.classList.add('is-typing');
  node.textContent = '';

  for (const char of text) {
    if (Number(node.closest('[data-terminal-sequence]').dataset.currentRunId) !== runId) return;
    node.textContent += char;
    const delay = char === ' ' ? baseSpeed * 0.35 : baseSpeed + Math.random() * baseSpeed * 0.45;
    await wait(delay);
  }

  if (Number(node.closest('[data-terminal-sequence]').dataset.currentRunId) !== runId) return;
  line?.classList.remove('is-typing');
  line?.classList.add('is-complete');
};

const playSetupPanel = async (sequence, runId) => {
  const setupPanel = sequence.querySelector('[data-setup-panel]');

  if (!setupPanel) {
    return;
  }

  const progress = setupPanel.querySelector('[data-setup-progress]');
  const percent = setupPanel.querySelector('[data-setup-percent]');
  const status = setupPanel.querySelector('[data-setup-status]');
  const steps = Array.from(setupPanel.querySelectorAll('[data-setup-step]'));
  const messages = [
    'Checking visual memory...',
    'Copying scroll files...',
    'Installing verticality module...',
    'Preparing BIOS console...',
    'Setup complete. Starting BIOS console...',
  ];

  sequence.classList.add('setup-running');

  for (let value = 0; value <= 100; value += 2) {
    if (Number(sequence.dataset.currentRunId) !== runId) return;

    if (progress instanceof HTMLElement) {
      progress.style.width = `${value}%`;
    }

    if (percent) {
      percent.textContent = `${value}%`;
    }

    const activeIndex = Math.min(steps.length - 1, Math.floor(value / 25));

    steps.forEach((step, index) => {
      const stepStatus = step.querySelector('[data-step-status]');
      const complete = value >= (index + 1) * 25;
      const active = index === activeIndex && !complete;

      step.classList.toggle('is-active', active);
      step.classList.toggle('is-complete', complete);

      if (stepStatus) {
        stepStatus.textContent = complete ? 'Completed' : active ? 'Running' : 'Pending';
      }
    });

    if (status) {
      status.textContent = messages[Math.min(messages.length - 1, Math.floor(value / 25))];
    }

    await wait(value < 88 ? 42 : 72);
  }

  if (Number(sequence.dataset.currentRunId) !== runId) return;
  steps.forEach((step) => {
    step.classList.remove('is-active');
    step.classList.add('is-complete');
    const stepStatus = step.querySelector('[data-step-status]');

    if (stepStatus) {
      stepStatus.textContent = 'Completed';
    }
  });

  await wait(520);
  if (Number(sequence.dataset.currentRunId) !== runId) return;
  sequence.classList.add('setup-complete');
  await wait(420);
};

const playTerminalSequence = async (sequence) => {
  if (sequence.dataset.terminalPlayed === 'true' && !sequence.dataset.forceReplay) {
    return;
  }

  sequence.dataset.terminalPlayed = 'true';
  sequence.dataset.forceReplay = '';

  terminalRunId++;
  const runId = terminalRunId;
  sequence.dataset.currentRunId = runId;

  if (prefersReducedMotion.matches) {
    revealTerminalSequence(sequence);
    return;
  }

  const lines = Array.from(sequence.querySelectorAll('[data-terminal-copy]'));
  const baseSpeed = Number(sequence.dataset.terminalSpeed || 22);

  await playSetupPanel(sequence, runId);
  if (Number(sequence.dataset.currentRunId) !== runId) return;
  await wait(140);
  if (Number(sequence.dataset.currentRunId) !== runId) return;

  for (let index = 0; index < lines.length; index++) {
    await typeTerminalLine(lines[index], baseSpeed, runId);
    if (Number(sequence.dataset.currentRunId) !== runId) return;
    await wait(index === 0 ? 180 : 240);
    if (Number(sequence.dataset.currentRunId) !== runId) return;
  }

  sequence.classList.add('terminal-complete');
};
const revealObserver = canAnimateReveals
  ? new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');

          if (entry.target.hasAttribute('data-terminal-sequence')) {
            playTerminalSequence(entry.target);
          }

          revealObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.16,
      rootMargin: '0px 0px -40px 0px',
    }
  )
  : null;

const revealViewportNodes = () => {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  revealNodes.forEach((node) => {
    if (node.classList.contains('is-visible')) return;

    const rect = node.getBoundingClientRect();
    const startsInViewport = rect.top < viewportHeight * 0.92 && rect.bottom > 0;

    if (!startsInViewport) return;

    node.classList.add('is-visible');

    if (node.hasAttribute('data-terminal-sequence')) {
      playTerminalSequence(node);
    }

    revealObserver?.unobserve(node);
  });
};

const startMosquitoSound = async () => {
  if (!mosquitoAudio) {
    return;
  }

  mosquitoPlayRequested = true;

  if (!mosquitoAudioUnlocked || mosquitoSoundPlaying) {
    return;
  }

  try {
    mosquitoAudio.pause();
    mosquitoAudio.currentTime = 0;
    mosquitoAudio.volume = 0.48;
    await mosquitoAudio.play();
    mosquitoSoundPlaying = true;
  } catch (error) {
    mosquitoSoundPlaying = false;
  }
};

const stopMosquitoSound = () => {
  if (!mosquitoAudio) {
    return;
  }

  mosquitoPlayRequested = false;
  mosquitoAudio.pause();
  mosquitoAudio.currentTime = 0;
  mosquitoSoundPlaying = false;
};

const unlockMosquitoAudio = async () => {
  if (!mosquitoAudio || mosquitoAudioUnlocked) {
    if (mosquitoPlayRequested && mosquitoLink?.classList.contains('is-active')) {
      startMosquitoSound();
    }
    return;
  }

  try {
    mosquitoAudio.muted = true;
    mosquitoAudio.volume = 0;
    mosquitoAudio.currentTime = 0;
    await mosquitoAudio.play();
    mosquitoAudio.pause();
    mosquitoAudio.currentTime = 0;
    mosquitoAudioUnlocked = true;
  } catch (error) {
    mosquitoAudioUnlocked = false;
  } finally {
    mosquitoAudio.muted = false;
    mosquitoAudio.volume = 0.48;
  }

  if (mosquitoAudioUnlocked && mosquitoPlayRequested && mosquitoLink?.classList.contains('is-active')) {
    startMosquitoSound();
  }
};

const registerMosquitoAudioUnlock = () => {
  if (!mosquitoLink || !mosquitoAudio) return;

  const onUnlock = async () => {
    await unlockMosquitoAudio();

    if (mosquitoAudioUnlocked) {
      window.removeEventListener('pointerdown', onUnlock);
      window.removeEventListener('touchstart', onUnlock);
      window.removeEventListener('keydown', onUnlock);
    }
  };

  window.addEventListener('pointerdown', onUnlock, { passive: true });
  window.addEventListener('touchstart', onUnlock, { passive: true });
  window.addEventListener('keydown', onUnlock);
};

const syncSiteMenuState = () => {
  if (!(siteMenuSummary instanceof HTMLElement) || !siteMenu) return;
  siteMenuSummary.setAttribute('aria-expanded', String(siteMenu.hasAttribute('open')));
};

const initSiteMenu = () => {
  if (!siteMenu || !(siteMenuSummary instanceof HTMLElement)) return;

  syncSiteMenuState();
  siteMenu.addEventListener('toggle', syncSiteMenuState);

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Node) || siteMenu.contains(event.target)) {
      return;
    }

    siteMenu.removeAttribute('open');
    syncSiteMenuState();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      siteMenu.removeAttribute('open');
      syncSiteMenuState();
      siteMenuSummary.focus();
    }
  });
};

const setMosquitoActive = (active) => {
  if (!mosquitoLink) return;

  mosquitoLink.classList.toggle('is-active', active);
  mosquitoLink.setAttribute('aria-hidden', String(!active));
  mosquitoLink.tabIndex = active ? 0 : -1;

  if (active) {
    startMosquitoSound();
  } else {
    stopMosquitoSound();
  }
};

const showMosquito = () => {
  if (!mosquitoLink) return;

  setMosquitoActive(true);
  window.clearTimeout(mosquitoHideTimer);
  mosquitoHideTimer = window.setTimeout(() => {
    setMosquitoActive(false);
  }, MOSQUITO_ACTIVE_MS);
};

const startMosquitoCycle = () => {
  if (!mosquitoLink) return;

  setMosquitoActive(false);

  window.setTimeout(() => {
    showMosquito();
    mosquitoCycleTimer = window.setInterval(showMosquito, MOSQUITO_CYCLE_MS);
  }, RAIN_PHASE_MS + 400);
};

terminalSequences.forEach((sequence) => prepareTerminalSequence(sequence));
initSiteMenu();

if (!canAnimateReveals) {
  revealNodes.forEach((node) => node.classList.add('is-visible'));
  terminalSequences.forEach((sequence) => revealTerminalSequence(sequence));

  if (pageContent) {
    pageContent.classList.remove('hidden');
  }

  if (netArtLayer) {
    netArtLayer.style.opacity = '0';
  }
} else {
  revealNodes.forEach((node) => revealObserver.observe(node));
  window.requestAnimationFrame(revealViewportNodes);
  initNetArt();
  registerMosquitoAudioUnlock();
  startMosquitoCycle();
}

const updateKinetic = () => {
  const offset = window.scrollY;
  const scrollDelta = offset - lastScrollY;
  lastScrollY = offset;

  if (scrollDelta > 0) {
    scrollRainDistance += scrollDelta;
    scrollRainEnergy = Math.min(1, scrollRainEnergy + scrollDelta * 0.012);
  } else {
    scrollRainEnergy *= 0.92;
  }

  scrollRainEnergy = Math.max(0, scrollRainEnergy - 0.005);

  kineticNodes.forEach((node) => {
    const speed = Number(node.dataset.speed || 0);
    const movement = offset * speed;
    node.style.transform = `translate3d(0, ${movement}px, 0)`;
  });

  bgLayers.forEach((layer) => {
    const speed = Number(layer.dataset.speed || 0);
    const movement = offset * speed;
    layer.style.transform = `translate3d(0, ${movement}px, 0)`;
  });

  const elapsed = performance.now() - netArtStartTime;
  const rainPhase = elapsed < RAIN_PHASE_MS;

  if (pageContent) {
    if (rainPhase) {
      pageContent.classList.add('hidden');
      if (netArtLayer) {
        netArtLayer.style.opacity = '1';
      }
    } else {
      pageContent.classList.remove('hidden');
      if (netArtLayer) {
        netArtLayer.style.opacity = `${0.02 + scrollRainEnergy * 0.12}`;
      }
    }
  } else if (netArtLayer) {
    netArtLayer.style.opacity = rainPhase ? '1' : `${0.12 + scrollRainEnergy * 0.12}`;
  }

  netArtItems.forEach((item) => {
    const base = Number(item.dataset.baseY || 0);
    const rainSpeed = Number(item.dataset.rain || 1.4);
    const scrollRainSpeed = Number(item.dataset.scrollRain || 0.12);
    const phase = Number(item.dataset.phase || 0);
    const idleOpacity = Number(item.dataset.idleOpacity || 0.06);

    let y = base;
    let x = 0;
    let scale = 1;
    let opacity = idleOpacity;

    if (rainPhase) {
      const rawY = base + elapsed * rainSpeed * 1.35;
      const wrapTop = -window.innerHeight * 2.4;
      const wrapBottom = window.innerHeight + 220;
      const wrapRange = wrapBottom - wrapTop;
      const introCycle = Math.floor((rawY - wrapTop) / wrapRange);

      if (introCycle !== Number(item.dataset.introCycle || 0)) {
        item.dataset.introCycle = String(introCycle);
        randomizeNetArtItem(item, false);
      }

      y = wrapValue(rawY, wrapTop, wrapBottom);
      scale = 1 + Math.sin(elapsed * 0.012 + rainSpeed + phase) * 0.08;
      opacity = 0.28 + Math.abs(Math.sin(elapsed * 0.022 + rainSpeed + phase)) * 0.22;
    } else {
      const rawY = base + scrollRainDistance * scrollRainSpeed + Math.sin(elapsed * 0.0011 + phase) * 12;
      const wrapTop = -window.innerHeight * 0.95;
      const wrapBottom = window.innerHeight + 180;
      const wrapRange = wrapBottom - wrapTop;
      const scrollCycle = Math.floor((rawY - wrapTop) / wrapRange);

      if (scrollCycle !== Number(item.dataset.scrollCycle || 0)) {
        item.dataset.scrollCycle = String(scrollCycle);
        randomizeNetArtItem(item, true);
      }

      y = wrapValue(rawY, wrapTop, wrapBottom);
      x = Math.sin(elapsed * 0.0008 + phase) * (5 + scrollRainSpeed * 18);
      scale = 0.98 + Math.sin(elapsed * 0.0009 + phase) * 0.04 + scrollRainEnergy * 0.05;
      opacity = 0.42 + Math.abs(Math.sin(elapsed * 0.02 + rainSpeed + phase)) * 0.24;
    }

    item.style.opacity = `${opacity}`;
    item.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  });
};

const animate = () => {
  updateProgress();
  updateKinetic();
  requestAnimationFrame(animate);
};

updateProgress();
initRadioSignal();
initHeroArchiveSpotlight();

if (!reducedMotionEnabled) {
  updateKinetic();
  requestAnimationFrame(animate);
}

window.addEventListener('scroll', updateProgress, { passive: true });
window.addEventListener('resize', updateProgress);

const resetTerminalSequence = (sequence) => {
  sequence.dataset.forceReplay = 'true';
  sequence.dataset.terminalPlayed = 'false';
  
  terminalRunId++;
  sequence.dataset.currentRunId = terminalRunId;

  sequence.classList.remove('setup-complete', 'terminal-complete', 'setup-running');
  
  const setupPanel = sequence.querySelector('[data-setup-panel]');
  if (setupPanel) {
    const progress = setupPanel.querySelector('[data-setup-progress]');
    const percent = setupPanel.querySelector('[data-setup-percent]');
    const status = setupPanel.querySelector('[data-setup-status]');
    if (progress) progress.style.width = '0%';
    if (percent) percent.textContent = '0%';
    if (status) status.textContent = 'Initializing setup...';
    setupPanel.querySelectorAll('[data-setup-step]').forEach((step, index) => {
      step.classList.remove('is-active', 'is-complete');
      const stepStatus = step.querySelector('[data-step-status]');
      if (stepStatus) {
        stepStatus.textContent = index === 0 ? 'Waiting' : 'Pending';
      }
    });
  }

  sequence.querySelectorAll('.terminal-line').forEach(line => {
    line.classList.remove('is-complete', 'is-typing');
  });
  
  sequence.querySelectorAll('[data-terminal-copy]').forEach(node => {
    if (!prefersReducedMotion.matches) {
      node.textContent = '';
    }
  });
};

const restartButton = document.querySelector('.hero-actions .button-solid[href="#manifiesto"]');
if (restartButton) {
  restartButton.addEventListener('click', (e) => {
    const sequence = document.querySelector('[data-terminal-sequence]');
    if (sequence) {
      resetTerminalSequence(sequence);
      setTimeout(() => playTerminalSequence(sequence), 50);
    }
  });
}

const paintFullscreenButton = document.getElementById('btnFullscreenPaint');
const paintContainer = document.getElementById('paintContainer');

const getFullscreenElement = () => (
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.msFullscreenElement ||
  null
);

const requestPaintFullscreen = () => {
  if (!paintContainer) return Promise.resolve(false);

  const request =
    paintContainer.requestFullscreen ||
    paintContainer.webkitRequestFullscreen ||
    paintContainer.msRequestFullscreen;

  if (!request) {
    paintContainer.classList.add('is-fake-fullscreen');
    document.body.classList.add('paint-fullscreen-lock');
    return Promise.resolve(true);
  }

  return Promise.resolve(request.call(paintContainer)).then(() => true);
};

const exitPaintFullscreen = () => {
  if (paintContainer?.classList.contains('is-fake-fullscreen')) {
    paintContainer.classList.remove('is-fake-fullscreen');
    document.body.classList.remove('paint-fullscreen-lock');
    return Promise.resolve(true);
  }

  const exit =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen;

  return exit ? Promise.resolve(exit.call(document)).then(() => true) : Promise.resolve(false);
};

const syncPaintFullscreenButton = () => {
  if (!paintFullscreenButton || !paintContainer) return;
  const active = getFullscreenElement() === paintContainer || paintContainer.classList.contains('is-fake-fullscreen');

  paintFullscreenButton.textContent = active ? 'Salir de Pantalla Completa' : 'Pantalla Completa';
  paintFullscreenButton.setAttribute('aria-pressed', String(active));
};

if (paintFullscreenButton && paintContainer) {
  paintFullscreenButton.setAttribute('aria-pressed', 'false');

  paintFullscreenButton.addEventListener('click', async () => {
    const active = getFullscreenElement() === paintContainer || paintContainer.classList.contains('is-fake-fullscreen');

    try {
      if (active) {
        await exitPaintFullscreen();
      } else {
        try {
          await requestPaintFullscreen();
        } catch {
          paintContainer.classList.add('is-fake-fullscreen');
          document.body.classList.add('paint-fullscreen-lock');
        }
      }
    } finally {
      syncPaintFullscreenButton();
    }
  });

  document.addEventListener('fullscreenchange', syncPaintFullscreenButton);
  document.addEventListener('webkitfullscreenchange', syncPaintFullscreenButton);
  document.addEventListener('msfullscreenchange', syncPaintFullscreenButton);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !paintContainer.classList.contains('is-fake-fullscreen')) return;
    exitPaintFullscreen().then(syncPaintFullscreenButton);
  });
}

/* =========================================================================
   WINDOWS 98 DESKTOP SIMULATOR LOGIC
   ========================================================================= */
const desktopContainer = document.getElementById('win98Desktop');
const draggableWindows = document.querySelectorAll('.win-draggable');
const taskbarTabs = document.querySelectorAll('.taskbar-tab');
const taskbarTime = document.getElementById('taskbarTime');

let highestZIndex = 10;

// Reloj de la barra de tareas
const updateTaskbarTime = () => {
  if (!taskbarTime) return;
  const now = new Date();
  let hours = now.getHours();
  let minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  taskbarTime.textContent = `${hours}:${minutes} ${ampm}`;
};
setInterval(updateTaskbarTime, 1000);
updateTaskbarTime();

// Lógica de arrastre y z-index
draggableWindows.forEach(win => {
  const titlebar = win.querySelector('.win-titlebar');
  if (!titlebar) return;

  let isDragging = false;
  let startX, startY, initialX, initialY;

  const bringToFront = () => {
    highestZIndex++;
    win.style.zIndex = highestZIndex;
    draggableWindows.forEach(w => w.classList.remove('is-active'));
    win.classList.add('is-active');

    taskbarTabs.forEach(tab => {
      tab.classList.toggle('is-active', tab.dataset.target === win.id);
    });
  };

  win.addEventListener('mousedown', bringToFront);
  win.addEventListener('touchstart', bringToFront, {passive: true});

  titlebar.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = win.offsetLeft;
    initialY = win.offsetTop;
    bringToFront();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    let newX = initialX + (e.clientX - startX);
    let newY = initialY + (e.clientY - startY);
    
    // Evitar que se pierda la barra de título por arriba
    if (newY < 0) newY = 0;
    
    win.style.left = `${newX}px`;
    win.style.top = `${newY}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });
});

// Botones de la barra de tareas
taskbarTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetId = tab.dataset.target;
    const targetWin = document.getElementById(targetId);
    if (targetWin) {
      highestZIndex++;
      targetWin.style.zIndex = highestZIndex;
      
      draggableWindows.forEach(w => w.classList.remove('is-active'));
      targetWin.classList.add('is-active');
      
      taskbarTabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
    }
  });
});
