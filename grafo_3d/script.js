import * as THREE from '../assets/vendor/three.module.js';

const SEED_GRAPH_URL = '../data/grafo-3d.seed.json';
const LOCAL_STORAGE_KEY = 'scrolling-life-graph-3d';
const IS_LOCALHOST = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
const API_CANDIDATES = [
  window.location.origin && window.location.origin !== 'null' ? window.location.origin : null,
  IS_LOCALHOST ? 'http://localhost:8091' : null,
  IS_LOCALHOST ? 'http://localhost:8092' : null
].filter(Boolean);
const MAX_RENDER_NODES = 420;

const canvas = document.getElementById('graphCanvas');
const backendState = document.getElementById('backendState');
const nodePanel = document.getElementById('nodePanel');
const nodeIndex = document.getElementById('nodeIndex');
const nodeDegree = document.getElementById('nodeDegree');
const nodePhrase = document.getElementById('nodePhrase');
const nodeForm = document.getElementById('nodeForm');
const nodeInput = document.getElementById('nodeInput');
const statusToast = document.getElementById('statusToast');

const fallbackGraph = {
  version: 1,
  updatedAt: new Date().toISOString(),
  nodes: [
    { id: 'n_scroll', text: 'El scroll no avanza: nos absorbe.' },
    { id: 'n_cuerpo', text: 'El dedo empuja una superficie que nunca termina.', parentId: 'n_scroll' },
    { id: 'n_ruido', text: 'El ruido no interrumpe la imagen: la vuelve habitable.', parentId: 'n_scroll' },
    { id: 'n_archivo', text: 'El archivo no guarda el pasado: lo deja seguir moviendose.', parentId: 'n_scroll' }
  ],
  edges: [
    { source: 'n_scroll', target: 'n_cuerpo', relation: 'gesto' },
    { source: 'n_scroll', target: 'n_ruido', relation: 'senal' },
    { source: 'n_scroll', target: 'n_archivo', relation: 'memoria' }
  ]
};

let graph = fallbackGraph;
let apiBase = null;
let selectedId = null;
let scene;
let camera;
let renderer;
let rootGroup;
let nodeGroup;
let edgeGroup;
let pulseGroup;
let raycaster;
let pointer;
let nodeMeshes = new Map();
let nodePositions = new Map();
let rafId = null;
let toastTimer = null;
let isDragging = false;
let dragStart = null;
let targetRotation = { x: -0.48, y: 0.54 };
let currentRotation = { x: -0.48, y: 0.54 };
let targetZoom = window.innerWidth < 760 ? 11.2 : 8.6;
let layoutExtent = 8;
let nodeDepths = new Map();
let nodeClusters = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getOverviewZoom = (nodeCount) => {
  const countZoom = 7 + Math.sqrt(Math.max(1, nodeCount)) * 0.34;
  const layoutZoom = layoutExtent * 1.22 + 2.1;
  const desktopZoom = clamp(Math.max(countZoom, layoutZoom), 8.8, 24);
  return window.innerWidth < 760 ? desktopZoom * 1.2 : desktopZoom;
};

const normalizeGraph = (rawGraph) => {
  const safeNodes = Array.isArray(rawGraph?.nodes)
    ? rawGraph.nodes
        .filter((node) => node && typeof node.id === 'string' && typeof node.text === 'string')
        .map((node) => ({
          id: node.id,
          text: node.text.trim().slice(0, 260),
          parentId: typeof node.parentId === 'string' ? node.parentId : undefined,
          createdAt: node.createdAt || new Date().toISOString()
        }))
    : [];
  const nodeIds = new Set(safeNodes.map((node) => node.id));
  const safeEdges = Array.isArray(rawGraph?.edges)
    ? rawGraph.edges
        .filter((edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge) => ({
          source: edge.source,
          target: edge.target,
          relation: typeof edge.relation === 'string' ? edge.relation : 'relacion'
        }))
    : [];

  return {
    version: Number(rawGraph?.version) || 1,
    updatedAt: rawGraph?.updatedAt || new Date().toISOString(),
    nodes: safeNodes.length ? safeNodes : fallbackGraph.nodes,
    edges: safeEdges.length ? safeEdges : fallbackGraph.edges
  };
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options?.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

const loadSeedGraph = async () => {
  try {
    return normalizeGraph(await fetchJson(`${SEED_GRAPH_URL}?ts=${Date.now()}`));
  } catch (error) {
    console.warn('No se pudo leer el grafo semilla.', error);
    return normalizeGraph(fallbackGraph);
  }
};

const loadLocalGraph = () => {
  try {
    const savedGraph = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return savedGraph ? normalizeGraph(JSON.parse(savedGraph)) : null;
  } catch (error) {
    console.warn('No se pudo leer el grafo local.', error);
    return null;
  }
};

const saveLocalGraph = (nextGraph) => {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextGraph));
  } catch (error) {
    console.warn('No se pudo guardar el grafo local.', error);
  }
};

const discoverGraph = async () => {
  for (const base of API_CANDIDATES) {
    try {
      const candidate = normalizeGraph(await fetchJson(`${base}/api/graph`));
      apiBase = base;
      if (backendState) backendState.textContent = 'backend activo';
      return candidate;
    } catch (error) {
      console.warn(`Backend no disponible en ${base}.`, error);
    }
  }

  apiBase = null;
  if (backendState) backendState.textContent = 'modo local';
  return loadLocalGraph() || await loadSeedGraph();
};

const showToast = (message) => {
  if (!statusToast) return;
  window.clearTimeout(toastTimer);
  statusToast.textContent = message;
  statusToast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    statusToast.classList.remove('is-visible');
  }, 2600);
};

const hashString = (text) => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pseudoRandom = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) / 4294967295);
  };
};

const makeVector = (x = 0, y = 0, z = 0) => ({ x, y, z });

const getDepthMap = (currentGraph) => {
  const depthMap = new Map();
  const nodeIds = new Set(currentGraph.nodes.map((node) => node.id));
  const parentMap = new Map();

  currentGraph.nodes.forEach((node) => {
    if (node.parentId && nodeIds.has(node.parentId) && node.parentId !== node.id) {
      parentMap.set(node.id, node.parentId);
    }
  });

  const depthOf = (id, guard = new Set()) => {
    if (depthMap.has(id)) return depthMap.get(id);
    if (guard.has(id)) {
      depthMap.set(id, 0);
      return 0;
    }
    guard.add(id);
    const parentId = parentMap.get(id);
    const depth = parentId && nodeIds.has(parentId) ? depthOf(parentId, guard) + 1 : 0;
    depthMap.set(id, depth);
    return depth;
  };

  currentGraph.nodes.forEach((node) => depthOf(node.id));
  return depthMap;
};

const computeLayout = (currentGraph) => {
  const nodes = currentGraph.nodes.slice(0, MAX_RENDER_NODES);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const depthMap = getDepthMap(currentGraph);
  nodeDepths = depthMap;
  nodeClusters = new Map();
  const positions = new Map();
  const parentMap = new Map();
  const children = new Map(nodes.map((node) => [node.id, []]));
  const byId = new Map(nodes.map((node) => [node.id, node]));

  nodes.forEach((node) => {
    if (node.parentId && nodeIds.has(node.parentId) && node.parentId !== node.id) {
      parentMap.set(node.id, node.parentId);
      children.get(node.parentId)?.push(node.id);
    }
  });

  children.forEach((childIds) => {
    childIds.sort((a, b) => {
      const depthDiff = (depthMap.get(a) || 0) - (depthMap.get(b) || 0);
      return depthDiff || hashString(a) - hashString(b);
    });
  });

  const rootCandidates = nodes
    .filter((node) => !parentMap.has(node.id))
    .sort((a, b) => {
      const childrenDiff = (children.get(b.id)?.length || 0) - (children.get(a.id)?.length || 0);
      return childrenDiff || hashString(a.id) - hashString(b.id);
    });
  const structuralRoot = rootCandidates[0] || nodes[0];
  const directBranches = structuralRoot
    ? (children.get(structuralRoot.id) || []).filter((id) => nodeIds.has(id))
    : [];
  const extraRootBranches = rootCandidates
    .map((node) => node.id)
    .filter((id) => id !== structuralRoot?.id);
  const candidateClusters = directBranches.length
    ? [...directBranches, ...extraRootBranches]
    : extraRootBranches;
  const highDegreeIds = [...nodes]
    .sort((a, b) => {
      const degreeA = (children.get(a.id)?.length || 0) + (parentMap.has(a.id) ? 1 : 0);
      const degreeB = (children.get(b.id)?.length || 0) + (parentMap.has(b.id) ? 1 : 0);
      return degreeB - degreeA || hashString(a.id) - hashString(b.id);
    })
    .map((node) => node.id);
  const clusterIds = [...new Set([
    ...candidateClusters,
    ...(structuralRoot ? [structuralRoot.id] : []),
    ...highDegreeIds
  ])].slice(0, Math.min(12, Math.max(5, nodes.length)));
  const clusterSet = new Set(clusterIds);
  const clusterIndexes = new Map(clusterIds.map((id, index) => [id, index]));

  if (!nodes.length || !clusterIds.length) {
    layoutExtent = 8;
    return positions;
  }

  const findCluster = (id) => {
    if (clusterSet.has(id)) return id;
    let currentId = id;
    const guard = new Set();

    while (parentMap.has(currentId) && !guard.has(currentId)) {
      guard.add(currentId);
      const parentId = parentMap.get(currentId);
      if (clusterSet.has(parentId)) return parentId;
      if (parentId === structuralRoot?.id && clusterSet.has(currentId)) return currentId;
      currentId = parentId;
    }

    return clusterIds[hashString(id) % clusterIds.length];
  };

  const clusterBuckets = new Map(clusterIds.map((id) => [id, []]));
  nodes.forEach((node) => {
    const clusterId = findCluster(node.id);
    nodeClusters.set(node.id, clusterIndexes.get(clusterId) ?? 0);
    clusterBuckets.get(clusterId)?.push(node.id);
  });

  clusterBuckets.forEach((ids) => {
    ids.sort((a, b) => {
      const depthDiff = (depthMap.get(a) || 0) - (depthMap.get(b) || 0);
      const parentDiff = hashString(parentMap.get(a) || a) - hashString(parentMap.get(b) || b);
      return depthDiff || parentDiff || hashString(a) - hashString(b);
    });
  });

  const normalize = (vector) => {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z) || 1;
    return makeVector(vector.x / length, vector.y / length, vector.z / length);
  };
  const cross = (a, b) => makeVector(
    a.y * b.z - a.z * b.y,
    a.z * b.x - a.x * b.z,
    a.x * b.y - a.y * b.x
  );
  const addScaled = (base, vector, scale) => makeVector(
    base.x + vector.x * scale,
    base.y + vector.y * scale,
    base.z + vector.z * scale
  );
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const clusterRadius = clamp(3.4 + Math.sqrt(nodes.length) * 0.085, 4.1, 6.2);
  const clusterAnchors = new Map();
  const clusterBases = new Map();
  const clusterCount = Math.max(1, clusterIds.length);

  clusterIds.forEach((clusterId, index) => {
    const yUnit = clusterCount === 1 ? 0 : 1 - ((index + 0.5) / clusterCount) * 2;
    const ring = Math.sqrt(Math.max(0.08, 1 - yUnit * yUnit));
    const angle = index * goldenAngle + 0.42;
    const anchor = makeVector(
      Math.cos(angle) * ring * clusterRadius,
      yUnit * clusterRadius * 0.82,
      Math.sin(angle) * ring * clusterRadius
    );
    const normal = normalize(anchor);
    const up = Math.abs(normal.y) > 0.78 ? makeVector(1, 0, 0) : makeVector(0, 1, 0);
    const tangentA = normalize(cross(up, normal));
    const tangentB = normalize(cross(normal, tangentA));
    clusterAnchors.set(clusterId, anchor);
    clusterBases.set(clusterId, { normal, tangentA, tangentB });
  });

  clusterBuckets.forEach((ids, clusterId) => {
    const anchor = clusterAnchors.get(clusterId);
    const basis = clusterBases.get(clusterId);
    if (!anchor || !basis || !ids.length) return;
    const clusterIndex = clusterIndexes.get(clusterId) || 0;
    const clusterSpread = clamp(Math.sqrt(ids.length) * 0.42, 1.35, 4.8);

    ids.forEach((id, localIndex) => {
      const node = byId.get(id);
      if (!node) return;
      const depth = depthMap.get(id) || 0;
      const t = ids.length <= 1 ? 0.5 : localIndex / (ids.length - 1);
      const seed = hashString(`${id}:${node.text}`);
      const rand = pseudoRandom(seed);
      const angle = localIndex * goldenAngle + depth * 0.78 + rand() * 0.42 + clusterIndex * 0.31;
      const orbit = 0.58
        + Math.sqrt(localIndex + 1) * 0.24
        + (depth % 6) * 0.045
        + rand() * 0.32;
      const axial = (t - 0.5) * clusterSpread + (rand() - 0.5) * 1.08 + depth * 0.035;
      const coil = Math.sin(depth * 0.74 + localIndex * 0.29) * 0.38;
      let position = addScaled(anchor, basis.tangentA, Math.cos(angle) * orbit);
      position = addScaled(position, basis.tangentB, Math.sin(angle) * orbit * 0.92 + coil);
      position = addScaled(position, basis.normal, axial);
      positions.set(id, position);
    });
  });

  nodes.forEach((node, index) => {
    if (positions.has(node.id)) return;
    const seed = hashString(`${node.id}:${node.text}`);
    const rand = pseudoRandom(seed);
    const theta = index * goldenAngle + rand() * 0.8;
    const phi = Math.acos(1 - 2 * ((index + 0.5) / nodes.length));
    const radius = clusterRadius + (rand() - 0.5) * 3.6;
    positions.set(node.id, makeVector(
      Math.cos(theta) * Math.sin(phi) * radius,
      Math.cos(phi) * radius,
      Math.sin(theta) * Math.sin(phi) * radius
    ));
  });

  if (!positions.size) {
    layoutExtent = 8;
    return positions;
  }

  let maxDistance = 0;
  positions.forEach((position) => {
    maxDistance = Math.max(
      maxDistance,
      Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z)
    );
  });

  layoutExtent = clamp(maxDistance + 1.8, 8, 18);

  return positions;
};

const disposeObject = (object) => {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
};

const clearGroup = (group) => {
  while (group.children.length) {
    const child = group.children.pop();
    disposeObject(child);
  }
};

const getDegrees = (currentGraph) => {
  const degrees = new Map(currentGraph.nodes.map((node) => [node.id, 0]));
  currentGraph.edges.forEach((edge) => {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1);
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1);
  });
  return degrees;
};

const getNodePalette = (depth, clusterIndex = 0) => {
  const palettes = [
    { color: 0x80e9ff, emissive: 0x0b5f8f, glow: 0x80e9ff },
    { color: 0x9eff71, emissive: 0x347a35, glow: 0x9eff71 },
    { color: 0x2f78ff, emissive: 0x123785, glow: 0x80e9ff },
    { color: 0xa6fff0, emissive: 0x0c756c, glow: 0x80e9ff },
    { color: 0x6fb0ff, emissive: 0x17396d, glow: 0x9eff71 },
    { color: 0x4affb5, emissive: 0x10724a, glow: 0x4affb5 }
  ];
  const palette = palettes[Math.abs(clusterIndex) % palettes.length];
  const distanceFade = clamp(0.92 - depth * 0.012, 0.52, 0.92);

  return {
    color: palette.color,
    emissive: palette.emissive,
    emissiveIntensity: clamp(0.76 - depth * 0.01, 0.36, 0.76),
    opacity: distanceFade,
    glow: palette.glow,
    glowOpacity: clamp(0.24 - depth * 0.004, 0.08, 0.24),
    scale: clamp(1.04 - depth * 0.01, 0.78, 1.04)
  };
};

const createGlowTexture = () => {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 96;
  textureCanvas.height = 96;
  const context = textureCanvas.getContext('2d');
  const gradient = context.createRadialGradient(48, 48, 5, 48, 48, 47);
  gradient.addColorStop(0, 'rgba(158,255,113,0.9)');
  gradient.addColorStop(0.22, 'rgba(128,233,255,0.48)');
  gradient.addColorStop(1, 'rgba(158,255,113,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const glowTexture = createGlowTexture();

const setSelectedNode = (id) => {
  selectedId = id;
  const selectedNode = graph.nodes.find((node) => node.id === selectedId) || graph.nodes[0];
  selectedId = selectedNode?.id || null;

  nodeMeshes.forEach((mesh, meshId) => {
    const isSelected = meshId === selectedId;
    const palette = getNodePalette(mesh.userData.depth || 0, mesh.userData.cluster || 0);
    mesh.material.color.setHex(isSelected ? 0x9eff71 : palette.color);
    mesh.material.emissive.setHex(isSelected ? 0x5dff4f : palette.emissive);
    mesh.material.emissiveIntensity = isSelected ? 1.28 : palette.emissiveIntensity;
    mesh.material.opacity = isSelected ? 1 : palette.opacity;
    mesh.userData.targetScale = isSelected ? 1.82 : 1;
  });

  if (!selectedNode) return;

  const degree = graph.edges.filter((edge) => edge.source === selectedId || edge.target === selectedId).length;
  const index = graph.nodes.findIndex((node) => node.id === selectedId) + 1;
  if (nodeIndex) nodeIndex.textContent = `nodo ${String(index).padStart(2, '0')}`;
  if (nodeDegree) nodeDegree.textContent = `${degree} ${degree === 1 ? 'relacion' : 'relaciones'}`;
  nodePhrase.textContent = selectedNode.text;
  nodePanel.hidden = false;
  nodePanel.classList.add('is-active');
  nodeInput.value = '';
  nodeInput.focus({ preventScroll: true });
};

const refreshScene = (nextGraph) => {
  graph = normalizeGraph(nextGraph);
  const renderNodes = graph.nodes.slice(0, MAX_RENDER_NODES);
  const renderNodeIds = new Set(renderNodes.map((node) => node.id));
  const degrees = getDegrees(graph);
  nodePositions = computeLayout(graph);
  targetZoom = getOverviewZoom(renderNodes.length);
  if (camera) {
    camera.far = Math.max(120, targetZoom + layoutExtent * 5);
    camera.updateProjectionMatrix();
  }
  nodeMeshes = new Map();

  if (scene?.fog) {
    scene.fog.density = clamp(0.036 - Math.sqrt(renderNodes.length) * 0.00075, 0.018, 0.026);
  }

  clearGroup(nodeGroup);
  clearGroup(edgeGroup);
  clearGroup(pulseGroup);

  const parentById = new Map(graph.nodes.map((node) => [node.id, node.parentId]));
  const lineageEdgePoints = [];
  const crossEdgePoints = [];
  graph.edges.forEach((edge) => {
    const source = nodePositions.get(edge.source);
    const target = nodePositions.get(edge.target);
    if (!source || !target || !renderNodeIds.has(edge.source) || !renderNodeIds.has(edge.target)) return;
    const points = parentById.get(edge.target) === edge.source ? lineageEdgePoints : crossEdgePoints;
    points.push(source.x, source.y, source.z, target.x, target.y, target.z);
  });

  const lineageEdgeGeometry = new THREE.BufferGeometry();
  lineageEdgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineageEdgePoints, 3));
  const lineageEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0x80e9ff,
    transparent: true,
    opacity: renderNodes.length > 220 ? 0.15 : 0.22,
    blending: THREE.AdditiveBlending
  });
  edgeGroup.add(new THREE.LineSegments(lineageEdgeGeometry, lineageEdgeMaterial));

  const crossEdgeGeometry = new THREE.BufferGeometry();
  crossEdgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(crossEdgePoints, 3));
  const crossEdgeMaterial = new THREE.LineBasicMaterial({
    color: 0x9eff71,
    transparent: true,
    opacity: renderNodes.length > 220 ? 0.11 : 0.17,
    blending: THREE.AdditiveBlending
  });
  edgeGroup.add(new THREE.LineSegments(crossEdgeGeometry, crossEdgeMaterial));

  const isLargeGraph = renderNodes.length > 220;
  const nodeGeometry = new THREE.SphereGeometry(
    isLargeGraph ? 0.092 : 0.112,
    isLargeGraph ? 14 : 24,
    isLargeGraph ? 10 : 16
  );

  renderNodes.forEach((node, index) => {
    const position = nodePositions.get(node.id);
    const degree = degrees.get(node.id) || 0;
    const depth = nodeDepths.get(node.id) || 0;
    const cluster = nodeClusters.get(node.id) || 0;
    const palette = getNodePalette(depth, cluster);
    const material = new THREE.MeshStandardMaterial({
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: palette.emissiveIntensity,
      roughness: 0.36,
      metalness: 0.28,
      transparent: true,
      opacity: palette.opacity
    });
    const mesh = new THREE.Mesh(nodeGeometry.clone(), material);
    const scale = palette.scale * (1 + Math.min(0.42, degree * 0.045));
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.setScalar(scale);
    mesh.renderOrder = 20 - Math.min(depth, 19);
    mesh.userData = {
      id: node.id,
      index,
      depth,
      cluster,
      baseScale: scale,
      targetScale: 1,
      jitter: hashString(node.id) % 1000
    };

    nodeGroup.add(mesh);
    nodeMeshes.set(node.id, mesh);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: palette.glow,
      transparent: true,
      opacity: palette.glowOpacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(mesh.position);
    sprite.scale.setScalar(0.62 + scale * 0.48 + degree * 0.026);
    sprite.userData = { baseOpacity: palette.glowOpacity };
    pulseGroup.add(sprite);
  });

  if (selectedId && nodeMeshes.has(selectedId)) {
    setSelectedNode(selectedId);
  } else {
    selectedId = null;
    nodePanel.hidden = true;
    nodePanel.classList.remove('is-active');
  }
};

const initThree = () => {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010205);
  scene.fog = new THREE.FogExp2(0x010205, 0.026);

  camera = new THREE.PerspectiveCamera(48, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 120);
  camera.position.set(0, 0, targetZoom);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  rootGroup = new THREE.Group();
  nodeGroup = new THREE.Group();
  edgeGroup = new THREE.Group();
  pulseGroup = new THREE.Group();
  rootGroup.add(edgeGroup, pulseGroup, nodeGroup);
  scene.add(rootGroup);

  const ambient = new THREE.HemisphereLight(0xdfeaff, 0x030712, 1.42);
  const greenLight = new THREE.PointLight(0x9eff71, 2.4, 18, 1.35);
  const blueLight = new THREE.PointLight(0x80e9ff, 1.7, 22, 1.6);
  greenLight.position.set(-4.2, 2.6, 5.8);
  blueLight.position.set(4.8, -2.8, 6.4);
  scene.add(ambient, greenLight, blueLight);

  raycaster = new THREE.Raycaster();
  raycaster.params.Points.threshold = 0.12;
  pointer = new THREE.Vector2();

  window.addEventListener('resize', handleResize);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
};

const handleResize = () => {
  camera.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  camera.updateProjectionMatrix();
  targetZoom = clamp(targetZoom, window.innerWidth < 760 ? 10 : 7, window.innerWidth < 760 ? 38 : 32);
  camera.position.z = targetZoom;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
};

const setPointerFromEvent = (event) => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
};

const pickNode = (event) => {
  setPointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects([...nodeMeshes.values()], false);
  if (!intersects.length) return false;
  setSelectedNode(intersects[0].object.userData.id);
  return true;
};

const handlePointerDown = (event) => {
  isDragging = true;
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    rotationX: targetRotation.x,
    rotationY: targetRotation.y
  };
  canvas.classList.add('is-dragging');
  canvas.setPointerCapture?.(event.pointerId);
};

const handlePointerMove = (event) => {
  if (!isDragging || !dragStart) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  targetRotation.y = dragStart.rotationY + dx * 0.006;
  targetRotation.x = clamp(dragStart.rotationX + dy * 0.004, -1.1, 1.1);
};

const handlePointerUp = (event) => {
  if (!isDragging || !dragStart) return;
  const dx = Math.abs(event.clientX - dragStart.x);
  const dy = Math.abs(event.clientY - dragStart.y);
  isDragging = false;
  canvas.classList.remove('is-dragging');
  canvas.releasePointerCapture?.(event.pointerId);
  if (dx + dy < 9) {
    pickNode(event);
  }
};

const handlePointerLeave = () => {
  isDragging = false;
  dragStart = null;
  canvas.classList.remove('is-dragging');
};

const handleWheel = (event) => {
  event.preventDefault();
  targetZoom = clamp(targetZoom + event.deltaY * 0.008, 6.4, window.innerWidth < 760 ? 38 : 32);
};

const saveRelatedNode = async (parentId, text) => {
  const payload = { parentId, text };

  if (apiBase) {
    const response = await fetchJson(`${apiBase}/api/graph/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return {
      graph: normalizeGraph(response.graph),
      nodeId: response.node?.id
    };
  }

  const now = new Date().toISOString();
  const newNode = {
    id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    parentId,
    createdAt: now
  };
  const nextGraph = normalizeGraph({
    ...graph,
    updatedAt: now,
    nodes: [...graph.nodes, newNode],
    edges: [...graph.edges, { source: parentId, target: newNode.id, relation: 'respuesta' }]
  });
  saveLocalGraph(nextGraph);
  return { graph: nextGraph, nodeId: newNode.id };
};

const handleSubmit = async (event) => {
  event.preventDefault();
  const text = nodeInput.value.replace(/\s+/g, ' ').trim();
  if (!selectedId) {
    showToast('selecciona un nodo primero');
    return;
  }
  if (!text) {
    nodeInput.focus({ preventScroll: true });
    return;
  }

  nodeInput.disabled = true;

  try {
    const result = await saveRelatedNode(selectedId, text.slice(0, 260));
    selectedId = result.nodeId || selectedId;
    refreshScene(result.graph);
    setSelectedNode(selectedId);
  } catch (error) {
    console.error('No se pudo guardar el nodo.', error);
    apiBase = null;
    if (backendState) backendState.textContent = 'modo local';
    const result = await saveRelatedNode(selectedId, text.slice(0, 260));
    selectedId = result.nodeId || selectedId;
    refreshScene(result.graph);
    setSelectedNode(selectedId);
  } finally {
    nodeInput.disabled = false;
  }
};

const animate = (time = 0) => {
  rafId = window.requestAnimationFrame(animate);
  const t = time * 0.001;

  currentRotation.x += (targetRotation.x - currentRotation.x) * 0.065;
  currentRotation.y += (targetRotation.y - currentRotation.y) * 0.065;
  rootGroup.rotation.x = currentRotation.x + Math.sin(t * 0.21) * 0.07;
  rootGroup.rotation.y = currentRotation.y + t * 0.024;
  rootGroup.rotation.z = Math.sin(t * 0.17) * 0.038;
  camera.position.z += (targetZoom - camera.position.z) * 0.08;

  nodeMeshes.forEach((mesh) => {
    const pulse = 1 + Math.sin(t * 2.1 + mesh.userData.jitter) * 0.055;
    const targetScale = mesh.userData.baseScale * mesh.userData.targetScale * pulse;
    mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.11);
  });

  pulseGroup.children.forEach((sprite, index) => {
    const baseOpacity = sprite.userData.baseOpacity ?? 0.14;
    sprite.material.opacity = clamp(baseOpacity + Math.sin(t * 1.7 + index * 0.41) * 0.035, 0.04, 0.45);
  });

  renderer.render(scene, camera);
};

const boot = async () => {
  initThree();
  refreshScene(loadLocalGraph() || normalizeGraph(fallbackGraph));
  nodeForm.addEventListener('submit', handleSubmit);
  animate();

  let serverGraphLoaded = false;

  loadSeedGraph()
    .then((seedGraph) => {
      if (!serverGraphLoaded && !apiBase && graph.nodes.length <= fallbackGraph.nodes.length) {
        refreshScene(seedGraph);
      }
    })
    .catch((error) => {
      console.warn('No se pudo precargar el grafo semilla.', error);
    });

  discoverGraph()
    .then((serverGraph) => {
      serverGraphLoaded = true;
      refreshScene(serverGraph);
    })
    .catch((error) => {
      console.warn('No se pudo sincronizar el grafo con el backend.', error);
    });
};

boot().catch((error) => {
  console.error('No se pudo iniciar el grafo 3D.', error);
  if (backendState) backendState.textContent = 'error de render';
});

window.addEventListener('beforeunload', () => {
  if (rafId) window.cancelAnimationFrame(rafId);
  if (renderer) renderer.dispose();
});
