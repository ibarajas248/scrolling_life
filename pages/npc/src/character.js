import {
  Group,
  TextureLoader,
  SRGBColorSpace,
  LinearFilter,
  MeshBasicMaterial,
  Mesh,
  PlaneGeometry,
  PointLight,
} from '../assets/three.module-BtCAaDxU.js';

/**
 * NPC = ilustraciones intactas.
 * Cada expresión es un PNG completo (sin retocar píxeles).
 */
const EXPRESSION_FILES = {
  neutral: './img/neutral.png',
  feliz: './img/feliz.png',
  triste: './img/triste.png',
  enojado: './img/enojado.png',
  sorprendido: './img/sorprendido.png',
};

function prepareTex(tex) {
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

export function createCharacter() {
  const group = new Group();
  const loader = new TextureLoader();
  const textures = {};

  // Neutral primero (arranque); el resto en paralelo sin bloquear
  textures.neutral = prepareTex(loader.load(EXPRESSION_FILES.neutral));
  for (const [key, path] of Object.entries(EXPRESSION_FILES)) {
    if (key === 'neutral') continue;
    textures[key] = prepareTex(loader.load(path));
  }

  const aspect = 819 / 1024;
  const planeH = 2.7;
  const planeW = planeH * aspect;

  const mat = new MeshBasicMaterial({
    map: textures.neutral,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new Mesh(new PlaneGeometry(planeW, planeH), mat);
  group.add(mesh);

  const faceParts = {
    material: mat,
    textures,
    current: 'neutral',
  };

  const phoneLight = new PointLight(0xffe6b8, 1.2, 5, 2);
  phoneLight.position.set(0, -0.15, 1.2);
  group.add(phoneLight);

  const phoneScreen = { material: { emissiveIntensity: 1.8 } };

  return { group, faceParts, phoneLight, phoneScreen };
}
