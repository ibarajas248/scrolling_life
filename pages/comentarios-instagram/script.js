const cloud = document.getElementById('commentCloud');
const scrollSpace = document.getElementById('scrollSpace');
const intro = document.getElementById('intro');
const visibleCount = document.getElementById('visibleCount');
const densityLabel = document.getElementById('densityLabel');
const archiveCount = document.getElementById('archiveCount');

const numberFormatter = new Intl.NumberFormat('es-CO');
const rawComments = Array.isArray(window.COMENTARIOS_DATA) ? window.COMENTARIOS_DATA : [];
const comments = shuffle(
  rawComments
    .map((entry) => {
      const text = sanitizeComment(entry && entry.text);

      if (!text) {
        return null;
      }

      return {
        sentiment: normalizeSentiment(entry.sentiment),
        text,
        flatText: text.replace(/\n+/g, ' '),
      };
    })
    .filter(Boolean)
);

const densityStates = [
  'incipiente',
  'friccion',
  'murmullo',
  'saturacion',
  'colapso',
  'ilegible',
];

const waveMap = [1, 1, 2, 3, 4, 6];
const nodes = [];

const BASE_SCROLL_SCREENS = 10;
const EXTEND_SCROLL_SCREENS = 5;
const STEP_SIZE = 96;
const MAX_VISIBLE = 420;
const INITIAL_WAVES = 4;
const MAX_WAVES_PER_FRAME = 4;

let virtualHeight = 0;
let commentCursor = 0;
let spawnedSteps = 0;
let reuseCursor = 0;
let ticking = false;
let lastPressureBucket = -1;
let lastDensityIndex = -1;
let lastVisibleCount = -1;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function shuffle(list) {
  const copy = [...list];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function groupedPercent() {
  return ((Math.random() + Math.random() + Math.random() + Math.random()) / 4) * 100;
}

function sanitizeComment(text) {
  if (typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\bme gusta\b/gi, '')
    .replace(/\bresponder\b/gi, '')
    .replace(/\beditado\b/gi, '')
    .replace(/\b\d+\s*sem\b/gi, '')
    .replace(/\b\d+\s*h\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeSentiment(sentiment) {
  const value = String(sentiment || '').trim().toLowerCase();

  if (value.includes('nega')) {
    return 'negative';
  }

  if (value.includes('posi')) {
    return 'positive';
  }

  return 'neutral';
}

function formatComment(entry, pressure, isShout) {
  let output = pressure < 0.3 ? entry.text : entry.flatText;

  if (pressure < 0.18 && output.length > 170) {
    output = `${output.slice(0, 166).trim()}...`;
  }

  if (pressure > 0.82 && output.length > 180) {
    output = output.slice(0, 180);
  }

  if (isShout && pressure > 0.72 && Math.random() < 0.3) {
    output = output.toUpperCase();
  }

  return output;
}

function getPressure() {
  return clamp(window.scrollY / (window.innerHeight * 8), 0, 1);
}

function getDensityIndex(pressure) {
  return clamp(Math.floor(pressure * densityStates.length), 0, densityStates.length - 1);
}

function setVirtualHeight(nextHeight) {
  virtualHeight = Math.max(nextHeight, window.innerHeight * BASE_SCROLL_SCREENS);
  scrollSpace.style.height = `${Math.round(virtualHeight)}px`;
}

function ensureInfiniteScroll() {
  const threshold = virtualHeight - window.innerHeight * 2;

  if (window.scrollY + window.innerHeight > threshold) {
    setVirtualHeight(virtualHeight + window.innerHeight * EXTEND_SCROLL_SCREENS);
  }
}

function updateInterface(pressure) {
  const densityIndex = getDensityIndex(pressure);
  const pressureBucket = Math.round(pressure * 16) / 16;

  if (pressureBucket !== lastPressureBucket) {
    document.documentElement.style.setProperty('--pressure', pressureBucket.toFixed(3));
    lastPressureBucket = pressureBucket;
  }

  if (nodes.length !== lastVisibleCount) {
    visibleCount.textContent = numberFormatter.format(nodes.length);
    lastVisibleCount = nodes.length;
  }

  if (densityIndex !== lastDensityIndex) {
    densityLabel.textContent = densityStates[densityIndex];
    lastDensityIndex = densityIndex;
  }

  const introOpacity = clamp(1 - window.scrollY / (window.innerHeight * 1.4), 0.08, 1);
  const introTranslate = Math.min(window.scrollY * 0.05, 28);
  intro.style.opacity = introOpacity.toFixed(3);
  intro.style.transform = `translate3d(0, ${introTranslate}px, 0)`;
}

function createNode() {
  const node = document.createElement('p');
  node.className = 'comment';
  cloud.append(node);
  nodes.push(node);
  return node;
}

function getReusableNode() {
  if (nodes.length < MAX_VISIBLE) {
    return createNode();
  }

  const node = nodes[reuseCursor];
  reuseCursor = (reuseCursor + 1) % nodes.length;
  cloud.append(node);
  return node;
}

function paintNode(node, entry, pressure, isShout) {
  const densityIndex = getDensityIndex(pressure);
  const centerPull = clamp(0.24 + pressure * 0.7 + (isShout ? 0.06 : 0), 0.24, 0.92);
  const x = clamp(4, 96, lerp(Math.random() * 100, groupedPercent(), centerPull));
  const y = clamp(8, 92, lerp(Math.random() * 100, groupedPercent(), centerPull * 0.94));
  const sizeFloor = 14 + densityIndex * 2;
  const sizeCeil = 20 + densityIndex * 8 + (isShout ? 18 : 0);
  const fontSize = lerp(sizeFloor, sizeCeil, Math.random());
  const maxWidth = lerp(34, 20, pressure) + (isShout ? 14 : 0);
  const rotation = lerp(-6 - densityIndex * 2, 6 + densityIndex * 2, Math.random());
  const opacity = clamp(0.34 + pressure * 0.34 + Math.random() * 0.18, 0.34, 0.9);
  const scale = 0.96 + Math.random() * 0.1 + pressure * 0.08;
  const softChance = pressure > 0.68 ? 0.08 : 0;
  const bandChance = pressure > 0.42 ? 0.12 : 0;

  node.className = `comment is-${entry.sentiment}`;

  if (Math.random() < bandChance) {
    node.classList.add('is-band');
  }

  if (Math.random() < softChance) {
    node.classList.add('is-soft');
  }

  if (isShout) {
    node.classList.add('is-shout');
  }

  node.textContent = formatComment(entry, pressure, isShout);
  node.style.left = `${x}%`;
  node.style.top = `${y}%`;
  node.style.fontSize = `${fontSize.toFixed(2)}px`;
  node.style.maxWidth = `${maxWidth.toFixed(2)}vw`;
  node.style.opacity = opacity.toFixed(3);
  node.style.zIndex = String(commentCursor);
  node.style.transform =
    `translate3d(-50%, -50%, 0) rotate(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
}

function createCommentNode(pressure, isShout = false) {
  const entry = comments[commentCursor % comments.length];
  commentCursor += 1;

  const node = getReusableNode();
  paintNode(node, entry, pressure, isShout);
}

function spawnWave(pressure) {
  const densityIndex = getDensityIndex(pressure);
  const count = waveMap[densityIndex] + Math.floor(Math.random() * (densityIndex + 1));

  for (let index = 0; index < count; index += 1) {
    const shoutChance = 0.02 + densityIndex * 0.04;
    createCommentNode(pressure, Math.random() < shoutChance);
  }
}

function seedInitialState() {
  for (let wave = 0; wave < INITIAL_WAVES; wave += 1) {
    spawnWave(wave / (INITIAL_WAVES * 10));
  }
}

function syncFromScroll() {
  ticking = false;
  ensureInfiniteScroll();

  const pressure = getPressure();
  const targetSteps = Math.floor(window.scrollY / STEP_SIZE);
  let processedWaves = 0;

  while (spawnedSteps < targetSteps && processedWaves < MAX_WAVES_PER_FRAME) {
    spawnedSteps += 1;
    processedWaves += 1;
    spawnWave(pressure);
  }

  updateInterface(pressure);

  if (spawnedSteps < targetSteps) {
    requestTick();
  }
}

function requestTick() {
  if (ticking) {
    return;
  }

  ticking = true;
  window.requestAnimationFrame(syncFromScroll);
}

function handleResize() {
  if (virtualHeight < window.innerHeight * BASE_SCROLL_SCREENS) {
    setVirtualHeight(window.innerHeight * BASE_SCROLL_SCREENS);
  } else {
    scrollSpace.style.height = `${Math.round(virtualHeight)}px`;
  }

  requestTick();
}

function renderEmptyState() {
  densityLabel.textContent = 'sin datos';
  archiveCount.textContent = '0';
  intro.insertAdjacentHTML(
    'beforeend',
    '<p class="lead">No se encontraron comentarios para construir la pieza.</p>'
  );
}

function init() {
  if (!comments.length) {
    renderEmptyState();
    return;
  }

  archiveCount.textContent = numberFormatter.format(comments.length);
  setVirtualHeight(window.innerHeight * BASE_SCROLL_SCREENS);
  seedInitialState();
  updateInterface(0);

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', handleResize);
}

init();
