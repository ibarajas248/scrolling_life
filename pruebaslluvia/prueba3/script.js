const CACHE_MANIFEST = '../../assets/images/netart-cache/manifest.json';
const THREE_URL = '../../assets/vendor/three.module.js';
const THREE_TIMEOUT_MS = 4200;
const FALLBACK_IMAGES = [
  '../../assets/images/archive-sides/paper-strips-installation.png',
  '../../assets/images/archive-sides/dense-text-column.png',
  '../../assets/images/archive-sides/vertical-contact-strips.png',
  '../../assets/images/archive-sides/sepia-contact-sheet.png',
  '../../assets/images/archive-sides/folded-paper-floor.png'
];
const MAX_TEXTURES = 112;
const MOBILE_TEXTURES = 62;

const canvas = document.getElementById('sculptureCanvas');
const fallback = document.getElementById('fallbackSculpture');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let cleanupThree = null;

const randomBetween = (min, max) => min + Math.random() * (max - min);

const shuffle = (items) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const normalizeImagePath = (src) => {
  if (typeof src !== 'string' || !src.trim()) return null;
  const clean = src.trim();

  if (clean.startsWith('./assets/')) return `../../${clean.slice(2)}`;
  if (clean.startsWith('assets/')) return `../../${clean}`;
  if (clean.startsWith('../../') || clean.startsWith('http')) return clean;
  return clean;
};

const loadImages = async () => {
  try {
    const response = await fetch(`${CACHE_MANIFEST}?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return shuffle(FALLBACK_IMAGES);

    const manifest = await response.json();
    const localImages = Array.isArray(manifest.images)
      ? manifest.images.map(normalizeImagePath).filter(Boolean)
      : [];

    return localImages.length ? shuffle(localImages) : shuffle(FALLBACK_IMAGES);
  } catch (error) {
    console.warn('No se pudo cargar el manifest de la escultura.', error);
    return shuffle(FALLBACK_IMAGES);
  }
};

const importThree = async () => Promise.race([
  import(THREE_URL),
  new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error('three timeout')), THREE_TIMEOUT_MS);
  })
]);

const buildFallback = (images) => {
  if (!fallback) return;

  const nodes = images.slice(0, 72).map((src, index) => {
    const node = document.createElement('span');
    const image = document.createElement('img');
    const ring = index / 72;
    const orbit = index * 137.5;
    const radius = 230 + Math.sin(index * 0.71) * 110 + ring * 220;
    const y = Math.sin(index * 0.37) * 220;
    const width = randomBetween(76, 142);
    const height = width * randomBetween(1.12, 1.52);

    node.className = 'fallback-node';
    node.style.setProperty('--orbit', `${orbit.toFixed(2)}deg`);
    node.style.setProperty('--face', `${(-orbit + 180).toFixed(2)}deg`);
    node.style.setProperty('--radius', `${radius.toFixed(2)}px`);
    node.style.setProperty('--y', `${y.toFixed(2)}px`);
    node.style.setProperty('--tilt', `${randomBetween(-11, 11).toFixed(2)}deg`);
    node.style.setProperty('--w', `${width.toFixed(0)}px`);
    node.style.setProperty('--h', `${height.toFixed(0)}px`);
    node.style.setProperty('--opacity', `${randomBetween(0.46, 0.82).toFixed(2)}`);
    node.style.setProperty('--float-speed', `${randomBetween(4.8, 10.5).toFixed(2)}s`);
    image.src = src;
    image.alt = '';
    image.decoding = 'async';
    image.loading = index < 16 ? 'eager' : 'lazy';
    node.append(image);
    return node;
  });

  fallback.replaceChildren(...nodes);
  fallback.classList.add('is-active');
};

const buildThreeSculpture = async (THREE, images) => {
  if (!canvas) throw new Error('missing canvas');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010204);
  scene.fog = new THREE.FogExp2(0x010204, 0.034);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 120);
  camera.position.set(0, 1.2, 15);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const root = new THREE.Group();
  const imageGroup = new THREE.Group();
  const lineGroup = new THREE.Group();
  scene.add(root);
  root.add(imageGroup, lineGroup);

  const ambient = new THREE.HemisphereLight(0xdcecff, 0x031020, 1.7);
  const keyLight = new THREE.DirectionalLight(0x9eff71, 1.15);
  const fillLight = new THREE.PointLight(0x73e9ff, 1.4, 42, 1.8);
  keyLight.position.set(-4, 8, 7);
  fillLight.position.set(4, -2, 8);
  scene.add(ambient, keyLight, fillLight);

  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x9eff71,
    transparent: true,
    opacity: 0.16
  });
  const spineMaterial = new THREE.LineBasicMaterial({
    color: 0x73e9ff,
    transparent: true,
    opacity: 0.2
  });
  const textureLoader = new THREE.TextureLoader();
  const limit = window.innerWidth < 720 ? MOBILE_TEXTURES : MAX_TEXTURES;
  const selected = images.slice(0, limit);
  const planes = [];
  const points = [];

  for (let ring = 0; ring < 5; ring += 1) {
    const radius = 2.2 + ring * 1.35;
    const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.72, 0, Math.PI * 2, false, 0);
    const ringPoints = curve.getPoints(140).map((point) => new THREE.Vector3(point.x, -2.8 + ring * 1.25, point.y));
    const geometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
    const ringLine = new THREE.LineLoop(geometry, ringMaterial);
    ringLine.rotation.x = Math.PI * 0.5;
    lineGroup.add(ringLine);
  }

  const spinePoints = [];
  for (let index = 0; index < 180; index += 1) {
    const t = index / 179;
    const angle = t * Math.PI * 9;
    const radius = 1.2 + t * 4.8;
    spinePoints.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      -3.6 + t * 7.2,
      Math.sin(angle) * radius
    ));
  }
  lineGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(spinePoints), spineMaterial));

  selected.forEach((src, index) => {
    const t = index / Math.max(1, selected.length - 1);
    const angle = index * 0.58;
    const radius = 2.1 + Math.sin(index * 0.37) * 0.9 + t * 4.8;
    const height = -3.9 + t * 7.8 + Math.sin(index * 0.23) * 0.9;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const width = randomBetween(0.72, 1.22);
    const planeHeight = width * randomBetween(1.05, 1.62);
    const geometry = new THREE.PlaneGeometry(width, planeHeight, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xdce6dc,
      roughness: 0.88,
      metalness: 0.04,
      transparent: true,
      opacity: randomBetween(0.72, 0.96),
      side: THREE.DoubleSide,
      emissive: new THREE.Color(index % 3 === 0 ? 0x081a10 : 0x030b16),
      emissiveIntensity: 0.32
    });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, height, z);
    mesh.lookAt(0, height * 0.24, 0);
    mesh.rotation.z += randomBetween(-0.22, 0.22);
    mesh.userData = {
      base: mesh.position.clone(),
      angle,
      radius,
      speed: randomBetween(0.12, 0.36),
      wave: randomBetween(0.16, 0.48),
      spin: randomBetween(-0.18, 0.18),
      height
    };

    textureLoader.load(src, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      material.map = texture;
      material.needsUpdate = true;
    });

    imageGroup.add(mesh);
    planes.push(mesh);
    points.push(mesh.position.clone());
  });

  const connectorMaterial = new THREE.LineBasicMaterial({
    color: 0x9eff71,
    transparent: true,
    opacity: 0.09
  });
  const connector = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points.filter((_, index) => index % 3 === 0)),
    connectorMaterial
  );
  lineGroup.add(connector);

  const pointer = { x: 0, y: 0, active: false };
  let targetRotX = -0.1;
  let targetRotY = 0.3;
  let rotX = targetRotX;
  let rotY = targetRotY;
  let rafId = null;

  const onPointerMove = (event) => {
    pointer.active = true;
    pointer.x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
    pointer.y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    targetRotY = pointer.x * 0.46;
    targetRotX = -0.1 + pointer.y * 0.22;
  };

  const onPointerLeave = () => {
    pointer.active = false;
    targetRotX = -0.1;
    targetRotY = 0.3;
  };

  const onResize = () => {
    camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.position.z = window.innerWidth < 720 ? 18 : 15;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerleave', onPointerLeave, { passive: true });
  window.addEventListener('resize', onResize);
  onResize();

  const animate = (now) => {
    const time = now * 0.001;
    rotX += (targetRotX - rotX) * 0.06;
    rotY += (targetRotY - rotY) * 0.06;

    root.rotation.x = rotX;
    root.rotation.y = rotY + time * (prefersReducedMotion.matches ? 0.015 : 0.04);
    root.rotation.z = Math.sin(time * 0.18) * 0.025;
    imageGroup.position.y = Math.sin(time * 0.22) * 0.16;
    lineGroup.rotation.y = -time * 0.026;

    planes.forEach((mesh, index) => {
      const data = mesh.userData;
      const localTime = time * data.speed + index * 0.031;
      const angle = data.angle + Math.sin(localTime) * 0.05;
      mesh.position.x = Math.cos(angle) * (data.radius + Math.sin(time * data.wave + index) * 0.12);
      mesh.position.z = Math.sin(angle) * (data.radius + Math.cos(time * data.wave + index) * 0.12);
      mesh.position.y = data.height + Math.sin(time * data.wave + index * 0.2) * 0.18;
      mesh.lookAt(0, mesh.position.y * 0.18, 0);
      mesh.rotation.z += data.spin * 0.002;
    });

    camera.position.x += ((pointer.active ? pointer.x * 1.2 : 0) - camera.position.x) * 0.04;
    camera.position.y += ((pointer.active ? -pointer.y * 0.7 + 1.2 : 1.2) - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    rafId = window.requestAnimationFrame(animate);
  };

  rafId = window.requestAnimationFrame(animate);

  cleanupThree = () => {
    window.cancelAnimationFrame(rafId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerleave', onPointerLeave);
    window.removeEventListener('resize', onResize);
    planes.forEach((mesh) => {
      mesh.geometry.dispose();
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
    });
    renderer.dispose();
  };
};

const boot = async () => {
  const images = await loadImages();

  try {
    const THREE = await importThree();
    await buildThreeSculpture(THREE, images);
  } catch (error) {
    console.warn('Three.js no disponible, usando escultura CSS 3D.', error);
    if (canvas) canvas.style.display = 'none';
    buildFallback(images);
  }
};

window.addEventListener('pagehide', () => {
  cleanupThree?.();
});

boot();
