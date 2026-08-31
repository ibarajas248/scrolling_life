import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendSeedPath = path.join(projectRoot, 'graph-backend', 'seed', 'grafo-3d.seed.json');
const publicSeedPath = path.join(projectRoot, 'data', 'grafo-3d.seed.json');
const targetNodeCount = 340;
const generatedPrefix = 'n_exp_';
const generatedAt = '2026-08-29T02:00:00.000Z';

const subjects = [
  'Una imagen sin origen',
  'El archivo que respira',
  'La pantalla nocturna',
  'Cada gesto detenido',
  'Un fragmento de memoria',
  'La sombra de un píxel',
  'El cuerpo frente al flujo',
  'La señal más débil',
  'Una ventana abandonada',
  'El ruido del presente',
  'La pausa entre dos imágenes',
  'El brillo que queda',
  'Una huella anónima',
  'El borde de la interfaz',
  'La mirada que regresa',
  'Un dato sin dueño',
  'La noche del dispositivo',
  'El pulso de la red',
  'Una superficie infinita',
  'El fantasma de la conexión',
  'La memoria de la máquina',
  'Un movimiento casi invisible',
  'La luz detrás del vidrio',
  'El tiempo acumulado'
];

const actions = [
  'atraviesa',
  'rodea',
  'desordena',
  'recorre',
  'interrumpe',
  'duplica',
  'roza',
  'oculta',
  'ilumina',
  'deforma',
  'escucha',
  'prolonga',
  'divide',
  'contamina',
  'desplaza',
  'convoca',
  'repite',
  'abre'
];

const objects = [
  'la memoria de quien mira',
  'un borde todavía sin nombre',
  'la distancia entre dos pulsos',
  'el silencio de la siguiente pantalla',
  'una pregunta que no termina',
  'los restos de una navegación anterior',
  'la forma secreta del cansancio',
  'un paisaje construido con latencia',
  'la promesa de otra imagen',
  'el espacio que deja el dedo',
  'una órbita de señales dispersas',
  'el archivo común de la noche',
  'la respiración escondida del sistema',
  'un mapa hecho de interrupciones',
  'la sombra de todos los enlaces',
  'el deseo de seguir desplazándose',
  'una pequeña reserva de ruido',
  'la geometría incierta del recuerdo',
  'el ritmo incompleto de la espera',
  'la profundidad azul de la interfaz',
  'un presente dividido en ventanas',
  'la textura de una ausencia digital',
  'el eco de cuerpos conectados',
  'una salida que vuelve a empezar'
];

const relations = [
  'deriva',
  'eco',
  'memoria',
  'pulso',
  'latencia',
  'resonancia',
  'desvío',
  'contacto',
  'repetición',
  'interferencia'
];

const rawSeed = JSON.parse(await readFile(backendSeedPath, 'utf8'));
const baseNodes = rawSeed.nodes.filter((node) => !node.id.startsWith(generatedPrefix));
const baseNodeIds = new Set(baseNodes.map((node) => node.id));
const baseEdges = rawSeed.edges.filter(
  (edge) => baseNodeIds.has(edge.source) && baseNodeIds.has(edge.target)
);
const generatedNodes = [];
const generatedEdges = [];

for (let index = 0; baseNodes.length + generatedNodes.length < targetNodeCount; index += 1) {
  const id = `${generatedPrefix}${String(index + 1).padStart(3, '0')}`;
  const parentId = index < baseNodes.length
    ? baseNodes[(index * 11 + 7) % baseNodes.length].id
    : generatedNodes[Math.floor((index - baseNodes.length) / 2)].id;
  const subject = subjects[index % subjects.length];
  const action = actions[Math.floor(index / subjects.length) % actions.length];
  const object = objects[(index * 7 + Math.floor(index / subjects.length)) % objects.length];
  const createdAt = new Date(Date.parse(generatedAt) + index * 1000).toISOString();

  generatedNodes.push({
    id,
    text: `${subject} ${action} ${object}.`,
    parentId,
    createdAt
  });
  generatedEdges.push({
    source: parentId,
    target: id,
    relation: relations[index % relations.length]
  });

  if (index >= 9 && index % 2 === 0) {
    generatedEdges.push({
      source: id,
      target: generatedNodes[(index * 17 + 3) % index].id,
      relation: relations[(index + 3) % relations.length]
    });
  }

  if (index >= 15 && index % 5 === 0) {
    generatedEdges.push({
      source: id,
      target: baseNodes[(index * 5 + 1) % baseNodes.length].id,
      relation: relations[(index + 6) % relations.length]
    });
  }
}

const edgeKeys = new Set();
const edges = [...baseEdges, ...generatedEdges].filter((edge) => {
  const key = `${edge.source}\u0000${edge.target}\u0000${edge.relation}`;
  if (edgeKeys.has(key)) return false;
  edgeKeys.add(key);
  return true;
});

const expandedGraph = {
  version: 2,
  updatedAt: new Date(
    Date.parse(generatedAt) + Math.max(0, generatedNodes.length - 1) * 1000
  ).toISOString(),
  nodes: [...baseNodes, ...generatedNodes],
  edges
};

const json = `${JSON.stringify(expandedGraph, null, 2)}\n`;
await Promise.all([
  writeFile(backendSeedPath, json, 'utf8'),
  writeFile(publicSeedPath, json, 'utf8')
]);

console.log(`Grafo expandido: ${expandedGraph.nodes.length} nodos, ${expandedGraph.edges.length} conexiones.`);
