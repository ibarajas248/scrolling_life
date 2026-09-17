/**
 * Catálogos del feed + señales léxicas del clip.
 * La emoción final del NPC NO se decide aquí: ver npcReaction.js.
 */

export const CATALOGOS = [
  'politica',
  'politica_izquierda',
  'politica_derecha',
  'extrema_izquierda',
  'extrema_derecha',
  'libertarios',
  'indignacion',
  'violencia',
  'peleas',
  'injusticia',
  'guerra',
  'analisis_politico',
  'noticias',
  'drama',
  'conspiraciones',
  'animales',
  'memes',
  'humor',
  'musica',
  'deporte',
  'cultura',
  'viajes',
  'salud',
  'skincare',
  'belleza',
  'comida',
  'exceso_comida',
  'hambre',
  'delgadez_extrema',
  'religion',
  'ocio',
  'fake_news',
  'ia',
  'trends',
  'finanzas',
  'educacion',
  'liminal',
  'fitness',
  'tech',
];

/** Referencia documental; no fija la emoción del NPC. */
export const CATALOGO_EXPRESION = {
  politica: 'sorprendido',
  politica_izquierda: 'sorprendido',
  politica_derecha: 'sorprendido',
  extrema_izquierda: 'sorprendido',
  extrema_derecha: 'sorprendido',
  libertarios: 'sorprendido',
  indignacion: 'enojado',
  violencia: 'triste',
  peleas: 'sorprendido',
  injusticia: 'triste',
  guerra: 'triste',
  analisis_politico: 'neutral',
  noticias: 'sorprendido',
  drama: 'triste',
  conspiraciones: 'sorprendido',
  animales: 'feliz',
  memes: 'feliz',
  humor: 'feliz',
  musica: 'feliz',
  deporte: 'feliz',
  cultura: 'sorprendido',
  viajes: 'feliz',
  salud: 'neutral',
  skincare: 'neutral',
  belleza: 'feliz',
  comida: 'feliz',
  exceso_comida: 'sorprendido',
  hambre: 'triste',
  delgadez_extrema: 'triste',
  religion: 'neutral',
  ocio: 'feliz',
  fake_news: 'sorprendido',
  ia: 'sorprendido',
  trends: 'feliz',
  finanzas: 'neutral',
  educacion: 'neutral',
  liminal: 'sorprendido',
  fitness: 'feliz',
  tech: 'sorprendido',
};

export const CATALOGO_LABEL = {
  politica: 'Política',
  politica_izquierda: 'Política izquierda',
  politica_derecha: 'Política derecha',
  extrema_izquierda: 'Extrema izquierda',
  extrema_derecha: 'Extrema derecha',
  libertarios: 'Libertarios',
  indignacion: 'Indignación viral',
  violencia: 'Violencia',
  peleas: 'Peleas',
  injusticia: 'Injusticia',
  guerra: 'Guerra',
  analisis_politico: 'Análisis político',
  noticias: 'Noticias',
  drama: 'Drama',
  conspiraciones: 'Conspiraciones',
  animales: 'Animales',
  memes: 'Humor / memes',
  humor: 'Humor',
  musica: 'Música',
  deporte: 'Deporte',
  cultura: 'Cultura',
  viajes: 'Viajes',
  salud: 'Salud',
  skincare: 'Skincare',
  belleza: 'Belleza',
  comida: 'Comida',
  exceso_comida: 'Exceso de comida',
  hambre: 'Hambre en el mundo',
  delgadez_extrema: 'Delgadez extrema',
  religion: 'Religión',
  ocio: 'Ocio',
  fake_news: 'Fake news',
  ia: 'IA / deepfake',
  trends: 'Trends',
  finanzas: 'Dinero / trabajo',
  educacion: 'Educación',
  liminal: 'Extraño / liminal',
  fitness: 'Fitness',
  tech: 'Tecnología',
};

const EMOTION_KEYWORDS = {
  enojado: [
    'pelea', 'pelear', 'peleando', 'riña', 'golpes', 'golpeo', 'paliza',
    'violencia', 'violento', 'agresion', 'agredir', 'agresivo',
    'corrupto', 'corrupcion', 'indignante', 'indignacion', 'injusto', 'ilegal',
    'fraude', 'estafa', 'asesino', 'asesinato', 'mataron', 'crimen', 'delincuente',
    'protesta', 'manifestacion', 'odio', 'rabia', 'represion', 'impunidad',
    'ataque', 'atacaron', 'terrorismo', 'dictadura', 'abuso',
    'mentira', 'mentiroso', 'ladron', 'robo', 'denuncia',
    'fake news', 'deepfake', 'te estan mintiendo',
    'street fight', 'fight', 'knockout', 'ko ', 'mma', 'boxe',
    'traidor', 'vendido', 'guerra sucia', 'escandalo', 'polemica',
  ],
  triste: [
    'muerte', 'muerto', 'murio', 'fallecio', 'fallecimiento', 'llorar', 'lloro',
    'triste', 'tristeza', 'dolor', 'tragedia', 'victima', 'victimas', 'funeral',
    'despedida', 'perdi', 'perdimos', 'sufrimiento', 'depresion', 'horror',
    'luto', 'bombardeo', 'masacre', 'refugiado', 'desplazado',
    'hambre', 'hambruna', 'desnutricion', 'desnutrido', 'famine', 'starving',
    'pobreza', 'abandono', 'soledad', 'duelo', 'llanto',
    'anorexia', 'bulimia', 'delgadez', 'demasiado flaco', 'bajo peso',
    'eating disorder', 'trastorno aliment', 'skin and bones',
    'ruptura', 'corazon roto', 'nunca mas',
  ],
  feliz: [
    'feliz', 'felicidad', 'te amo', 'gracias', 'celebr', 'fiesta', 'ganamos',
    'jaja', 'jajaja', 'risa', 'divertido', 'adorable', 'cute', 'cumpleanos',
    'me encanta', 'felicit', 'bailar', 'perreo', 'party', 'gozando',
    'makeup', 'maquillaje', 'glow', 'receta', 'delicioso', 'rico', 'viaje',
    'champion', 'campeon', 'victoria', 'orgullo',
  ],
  sorprendido: [
    'no lo vas a creer', 'plot twist', 'revelacion', 'al descubierto',
    'ultima hora', 'breaking', 'urgente', 'exclusiva', 'que acaba de pasar',
    'inteligencia artificial', 'hecho con ia', 'ai generated', 'conspiracion',
    'secreto', 'impactante', 'mukbang', 'cheat day', 'challenge comida',
    'comida challenge', 'ate everything', 'binge', 'all you can eat',
    'wtf', 'que es eso', 'inexplicable', 'glitch', 'liminal',
  ],
  neutral: [
    'informamos', 'agenda', 'sesion plenaria', 'tutorial', 'tips de',
    'convocatoria', 'comunicado oficial', 'skincare routine',
    'paso a paso', 'resumen', 'dato',
  ],
};

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s#@]/gu, ' ');
}

function hashId(id) {
  const s = String(id || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** Conteo léxico por emoción (señales, no decisión final). */
export function scoreEmotions(text) {
  const t = normalizeText(text);
  const scores = { enojado: 0, triste: 0, feliz: 0, sorprendido: 0, neutral: 0 };
  if (!t.trim()) return scores;
  for (const [emotion, words] of Object.entries(EMOTION_KEYWORDS)) {
    for (const word of words) {
      if (t.includes(word)) scores[emotion] += 1;
    }
  }
  return scores;
}

export function catalogLabel(catalogo) {
  return CATALOGO_LABEL[catalogo] || catalogo;
}

/**
 * Estimación ligera SIN mutar el estado del NPC.
 * Preferir reactToVideo() en el momento de visualización.
 */
export function expressionFromVideo(video = {}) {
  if (video.categoria) return video.categoria;
  const scores = scoreEmotions([video.texto, video.title].filter(Boolean).join(' '));
  const order = ['enojado', 'triste', 'sorprendido', 'feliz', 'neutral'];
  let best = null;
  let bestScore = 0;
  for (const e of order) {
    if ((scores[e] || 0) > bestScore) {
      bestScore = scores[e];
      best = e;
    }
  }
  if (best && bestScore >= 2) return best;
  return CATALOGO_EXPRESION[video.catalogo] || 'neutral';
}

export function expressionFromCatalog(catalogo) {
  return CATALOGO_EXPRESION[catalogo] || 'neutral';
}

/** Prepara el clip para el pool: no congela la emoción del NPC. */
export function withCatalogExpression(video) {
  const catalogo = video.catalogo || 'noticias';
  const tags = Array.isArray(video.tags) ? video.tags : [];
  return {
    ...video,
    catalogo,
    tags,
    likes: video.likes,
    comments: video.comments,
    saves: video.saves,
    shares: video.shares,
    src: video.src || `./videos/${video.id}.mp4`,
  };
}

const SHORT_FULL_MS = 12000;

export function shouldPlayFull(durationMs) {
  return Number.isFinite(durationMs) && durationMs > 0 && durationMs <= SHORT_FULL_MS;
}

export function watchDurationMs(durationMs = null) {
  if (shouldPlayFull(durationMs)) return Math.round(durationMs + 180);
  const min = 4000;
  const maxCap = Number.isFinite(durationMs) && durationMs > SHORT_FULL_MS
    ? Math.min(22000, Math.max(9000, durationMs * 0.7))
    : 18000;
  const max = Math.max(min + 2500, maxCap);
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function randomStartSeconds(durationSec, watchMs) {
  if (!Number.isFinite(durationSec) || durationSec <= 12.5) return 0;
  const watchSec = Math.min(watchMs / 1000, durationSec - 0.4);
  const maxStart = durationSec - watchSec;
  if (maxStart < 1.2) return 0;
  return 0.15 + Math.random() * maxStart;
}

export { hashId };
