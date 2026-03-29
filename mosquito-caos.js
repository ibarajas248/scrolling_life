const stage = document.getElementById('chaosStage');
const field = document.getElementById('frameField');
const shockField = document.getElementById('shockField');
const reshuffleButton = document.getElementById('reshuffleButton');
const cursorGlow = document.getElementById('cursorGlow');
const metricFrames = document.getElementById('metricFrames');
const metricSpeed = document.getElementById('metricSpeed');
const metricPressure = document.getElementById('metricPressure');
const metricMode = document.getElementById('metricMode');

const YOUTUBE_IDS = [
  'M7lc1UVf-VE',
  'jNQXAC9IVRw',
  'aqz-KE-bpKQ',
  'ysz5S6PUM-U',
  '21X5lGlDOfg',
  'dQw4w9WgXcQ',
  'ScMzIvxBSi4',
  'M7FIvfx5J10'
];

const LABELS = [
  'enjambre',
  'ruido',
  'loop',
  'clickbait',
  'pantalla',
  'interferencia',
  'glitch',
  'feed',
  'deriva',
  'reload',
  'loop feed',
  'mosquito tv',
  'watch later',
  'buffer',
  'autoplay',
  'doomscroll'
];

const CHAOS_MODES = [
  { id: 'enjambre', label: 'enjambre basal', speed: 1, jitter: 1, glitch: 0.34, teleport: 0.2 },
  { id: 'colision', label: 'modo colision', speed: 1.34, jitter: 1.1, glitch: 0.42, teleport: 0.28 },
  { id: 'latencia', label: 'latencia toxica', speed: 0.78, jitter: 0.82, glitch: 0.18, teleport: 0.1 },
  { id: 'deriva', label: 'deriva magnetica', speed: 1.06, jitter: 1.5, glitch: 0.3, teleport: 0.24 },
  { id: 'autoplay', label: 'fiebre autoplay', speed: 1.18, jitter: 1.22, glitch: 0.72, teleport: 0.34 }
];

const frameCount = window.innerWidth < 640 ? 16 : window.innerWidth < 960 ? 24 : 32;
const frames = [];
let bounds = { width: window.innerWidth, height: window.innerHeight };
let lastTick = performance.now();
let zCounter = 40;
let clearChaosTimer = 0;
let currentMode = CHAOS_MODES[0];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildSrc(videoId) {
  const start = Math.floor(Math.random() * 180);
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&start=${start}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1`;
}

function setCursorPosition(x, y) {
  if (!cursorGlow) return;
  cursorGlow.style.left = `${x}px`;
  cursorGlow.style.top = `${y}px`;
}

function spawnShockwave(x, y) {
  if (!shockField) return;
  const shockwave = document.createElement('span');
  shockwave.className = 'shockwave';
  shockwave.style.left = `${x}px`;
  shockwave.style.top = `${y}px`;
  shockField.append(shockwave);
  window.setTimeout(() => shockwave.remove(), 680);
}

function markFrame(frame, glitch = false) {
  frame.wrapper.classList.add('is-hot');
  frame.wrapper.classList.toggle('is-glitch', glitch);
  frame.wrapper.style.zIndex = String(++zCounter);
}

function clearChaosFlagsSoon(delay = 650) {
  window.clearTimeout(clearChaosTimer);
  clearChaosTimer = window.setTimeout(() => {
    frames.forEach((frame) => frame.wrapper.classList.remove('is-hot', 'is-glitch'));
  }, delay);
}

function applyFrameSize(frame) {
  frame.height = frame.width * frame.aspect;
  frame.wrapper.style.width = `${frame.width}px`;
  frame.wrapper.style.height = `${frame.height}px`;
}

function teleportFrame(frame) {
  frame.x = randomBetween(-80, Math.max(60, bounds.width - frame.width + 48));
  frame.y = randomBetween(94, Math.max(130, bounds.height - frame.height + 36));
  markFrame(frame, false);
}

function createFrame(index) {
  const wrapper = document.createElement('div');
  const iframe = document.createElement('iframe');

  wrapper.className = 'frame-wrapper';
  wrapper.dataset.label = pick(LABELS);
  wrapper.style.zIndex = String(zCounter + index);

  iframe.src = buildSrc(pick(YOUTUBE_IDS));
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.loading = 'eager';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.allowFullscreen = true;
  iframe.title = `Video caotico ${index + 1}`;

  wrapper.append(iframe);
  field.append(wrapper);

  const frame = {
    wrapper,
    iframe,
    width: randomBetween(98, 236),
    height: 0,
    aspect: randomBetween(0.54, 0.76),
    x: 0,
    y: 0,
    vx: randomBetween(-180, 180),
    vy: randomBetween(-140, 140),
    rotation: randomBetween(-24, 24),
    spin: randomBetween(-34, 34),
    scale: randomBetween(0.76, 1.22),
    pulse: randomBetween(0.9, 1.18),
    pulseSpeed: randomBetween(0.8, 3.2),
    wobble: randomBetween(10, 56),
    wobbleSpeed: randomBetween(0.0012, 0.0042),
    wobbleOffset: Math.random() * Math.PI * 2,
    jitter: randomBetween(3, 22),
    jitterSpeed: randomBetween(0.01, 0.024),
    driftOffset: Math.random() * Math.PI * 2
  };

  applyFrameSize(frame);
  teleportFrame(frame);
  frames.push(frame);
  return frame;
}

function placeFrame(frame, now) {
  const wobbleX = Math.sin(now * frame.wobbleSpeed + frame.wobbleOffset) * frame.wobble;
  const wobbleY = Math.cos(now * frame.wobbleSpeed * 1.26 + frame.wobbleOffset) * frame.wobble * 0.58;
  const jitterX = Math.sin(now * frame.jitterSpeed + frame.driftOffset) * frame.jitter;
  const jitterY = Math.cos(now * frame.jitterSpeed * 1.8 + frame.driftOffset) * frame.jitter * 0.72;
  const pulse = 1 + Math.sin(now * 0.001 * frame.pulseSpeed + frame.wobbleOffset) * (frame.pulse - 1);

  frame.wrapper.style.transform = `translate3d(${frame.x + wobbleX + jitterX}px, ${frame.y + wobbleY + jitterY}px, 0) rotate(${frame.rotation}deg) scale(${frame.scale * pulse})`;
}

function bounceFrame(frame, dt) {
  frame.x += frame.vx * dt;
  frame.y += frame.vy * dt;
  frame.rotation += frame.spin * dt;

  const minX = -90;
  const maxX = bounds.width - frame.width + 60;
  const minY = 86;
  const maxY = bounds.height - frame.height + 42;

  if (frame.x <= minX || frame.x >= maxX) {
    frame.vx *= -1;
    frame.x = clamp(frame.x, minX, maxX);
    markFrame(frame, false);
  }

  if (frame.y <= minY || frame.y >= maxY) {
    frame.vy *= -1;
    frame.y = clamp(frame.y, minY, maxY);
    markFrame(frame, false);
  }
}

function randomizeFrame(frame, hard = false) {
  const mode = currentMode;

  frame.vx = clamp(frame.vx + randomBetween(-170, 170) * mode.speed, -340, 340);
  frame.vy = clamp(frame.vy + randomBetween(-150, 150) * mode.speed, -280, 280);
  frame.spin = clamp(frame.spin + randomBetween(-22, 22) * mode.speed, -58, 58);
  frame.scale = clamp(frame.scale + randomBetween(-0.24, 0.26), 0.62, 1.62);
  frame.wobble = clamp(frame.wobble + randomBetween(-14, 18) * mode.jitter, 6, 72);
  frame.pulse = clamp(frame.pulse + randomBetween(-0.06, 0.12), 0.86, 1.24);
  frame.jitter = clamp(frame.jitter + randomBetween(-6, 12) * mode.jitter, 2, 34);
  frame.rotation += randomBetween(-18, 18);
  frame.x = clamp(frame.x + randomBetween(-150, 150), -90, Math.max(60, bounds.width - frame.width + 60));
  frame.y = clamp(frame.y + randomBetween(-120, 140), 72, Math.max(130, bounds.height - frame.height + 42));
  frame.wrapper.dataset.label = pick(LABELS);
  frame.wrapper.classList.toggle('is-ghost', !hard && Math.random() < 0.16);

  if (hard || Math.random() < 0.56) {
    frame.aspect = clamp(frame.aspect + randomBetween(-0.08, 0.08), 0.5, 0.84);
    frame.width = clamp(frame.width + randomBetween(-60, 68), 88, 292);
    applyFrameSize(frame);
  }

  let shouldGlitch = false;
  if (hard || Math.random() < mode.glitch) {
    frame.iframe.src = buildSrc(pick(YOUTUBE_IDS));
    shouldGlitch = true;
  }

  if (hard && Math.random() < mode.teleport) {
    teleportFrame(frame);
  }

  markFrame(frame, shouldGlitch);
}

function chaosBurst(count = 6, hard = false) {
  for (let index = 0; index < count; index += 1) {
    const frame = pick(frames);
    if (frame) {
      randomizeFrame(frame, hard);
    }
  }

  clearChaosFlagsSoon(hard ? 860 : 620);
}

function reshuffleAll(hard = true) {
  frames.forEach((frame) => randomizeFrame(frame, hard));
  clearChaosFlagsSoon(1000);
}

function stirFromPointer(event) {
  const pointerX = event.clientX;
  const pointerY = event.clientY;

  setCursorPosition(pointerX, pointerY);

  frames.forEach((frame) => {
    const centerX = frame.x + frame.width * 0.5;
    const centerY = frame.y + frame.height * 0.5;
    const dx = centerX - pointerX;
    const dy = centerY - pointerY;
    const distance = Math.hypot(dx, dy);

    if (distance < 240) {
      const force = (240 - distance) / 240;
      frame.vx = clamp(frame.vx + (dx / Math.max(distance, 20)) * 150 * force, -340, 340);
      frame.vy = clamp(frame.vy + (dy / Math.max(distance, 20)) * 120 * force, -280, 280);
      markFrame(frame, false);
    }
  });

  clearChaosFlagsSoon(420);
}

function updateDashboard() {
  if (metricFrames) {
    metricFrames.textContent = String(frames.length).padStart(2, '0');
  }

  const averageSpeed = frames.reduce((sum, frame) => sum + Math.hypot(frame.vx, frame.vy), 0) / Math.max(frames.length, 1);
  const hotFrames = frames.reduce((count, frame) => count + (frame.wrapper.classList.contains('is-hot') ? 1 : 0), 0);
  const pressure = clamp(Math.round((hotFrames / Math.max(frames.length, 1)) * 100 + averageSpeed / 8), 0, 99);

  if (metricSpeed) {
    metricSpeed.textContent = `${Math.round(averageSpeed)} px/s`;
  }

  if (metricPressure) {
    metricPressure.textContent = `${pressure}%`;
  }

  if (metricMode) {
    metricMode.textContent = currentMode.label;
  }
}

function cycleMode() {
  const options = CHAOS_MODES.filter((mode) => mode.id !== currentMode.id);
  currentMode = pick(options);
  document.body.dataset.chaosMode = currentMode.id;

  frames.forEach((frame) => {
    frame.vx = clamp(frame.vx * currentMode.speed + randomBetween(-40, 40), -340, 340);
    frame.vy = clamp(frame.vy * currentMode.speed + randomBetween(-34, 34), -280, 280);
    frame.wobble = clamp(frame.wobble * currentMode.jitter, 6, 72);
    frame.jitter = clamp(frame.jitter * currentMode.jitter, 2, 34);
  });

  const pulseCount = currentMode.id === 'autoplay' ? Math.max(10, Math.floor(frameCount * 0.5)) : Math.max(6, Math.floor(frameCount * 0.24));
  chaosBurst(pulseCount, currentMode.id !== 'latencia');
}

function animate(now) {
  const dt = Math.min((now - lastTick) / 1000, 0.04);
  lastTick = now;

  frames.forEach((frame) => {
    bounceFrame(frame, dt);
    placeFrame(frame, now);
  });

  requestAnimationFrame(animate);
}

function rebuildLayout() {
  bounds = { width: window.innerWidth, height: window.innerHeight };
  frames.forEach((frame) => {
    frame.x = clamp(frame.x, -90, Math.max(60, bounds.width - frame.width + 60));
    frame.y = clamp(frame.y, 72, Math.max(130, bounds.height - frame.height + 42));
  });
}

function init() {
  document.body.dataset.chaosMode = currentMode.id;
  setCursorPosition(window.innerWidth * 0.5, window.innerHeight * 0.52);

  for (let index = 0; index < frameCount; index += 1) {
    createFrame(index);
  }

  frames.forEach((frame) => placeFrame(frame, performance.now()));
  updateDashboard();
  requestAnimationFrame(animate);

  window.setTimeout(() => reshuffleAll(true), 420);
  window.setInterval(() => {
    chaosBurst(window.innerWidth < 700 ? 4 : 6, false);
    updateDashboard();
  }, 900);

  window.setInterval(() => {
    chaosBurst(window.innerWidth < 700 ? 8 : 12, true);
    updateDashboard();
  }, 3200);

  window.setInterval(() => {
    const teleports = window.innerWidth < 700 ? 2 : 4;
    for (let index = 0; index < teleports; index += 1) {
      const frame = pick(frames);
      if (frame) {
        teleportFrame(frame);
      }
    }
    clearChaosFlagsSoon(520);
    updateDashboard();
  }, 1700);

  window.setInterval(() => {
    cycleMode();
    updateDashboard();
  }, 5600);

  reshuffleButton?.addEventListener('click', () => {
    reshuffleAll(true);
    updateDashboard();
  });

  stage?.addEventListener('pointermove', stirFromPointer);
  stage?.addEventListener('pointerdown', (event) => {
    spawnShockwave(event.clientX, event.clientY);
    chaosBurst(Math.max(10, Math.floor(frameCount * 0.72)), true);
    updateDashboard();
  });

  window.addEventListener('resize', rebuildLayout);
  document.addEventListener('visibilitychange', () => {
    lastTick = performance.now();
  });
}

init();
