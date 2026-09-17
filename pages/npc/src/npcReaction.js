/**
 * Reacción subjetiva del NPC.
 * El contenido no fija la emoción: solo desplaza probabilidades
 * junto con personalidad, estado acumulado, memoria e inercia.
 */

export const EXPRESSIONS = ['enojado', 'triste', 'sorprendido', 'feliz', 'neutral'];

/** Parámetros centralizados (sin magic numbers repartidos). */
export const REACTION_CONFIG = {
  randomnessAmount: 0.18,
  emotionInertia: 0.22,
  reactionMemoryLength: 8,
  stateDecayRate: 0.04,
  stateInfluence: 0.35,
  personalityInfluence: 0.28,
  analysisInfluence: 0.55,
  catalogPriorInfluence: 0.22,
  repetitionPenalty: 0.12,
  exposureStep: 0.055,
  stateClamp: 1,
  debug: false,
};

/** Sesgos suaves — no determinan emoción, solo pesos. */
export const NPC_PERSONALITY = {
  conflictSensitivity: 0.72,
  positivityBias: 0.42,
  negativityBias: 0.55,
  surpriseSensitivity: 0.62,
  sadnessSensitivity: 0.38,
  politicalSensitivity: 0.7,
  humorSensitivity: 0.55,
  violenceSensitivity: 0.68,
  absurdSensitivity: 0.5,
};

/** Disposición momentánea (−1…1). */
export const NPC_STATE = {
  mood: 0,
  arousal: 0.15,
  tension: 0.1,
  optimism: 0.2,
  curiosity: 0.35,
};

const reactionHistory = [];
let lastEmotion = 'neutral';
let lastDebug = null;

const CATALOG_PRIORS = {
  politica: { enojado: 0.28, triste: 0.18, sorprendido: 0.28, feliz: 0.08, neutral: 0.18 },
  politica_izquierda: { enojado: 0.26, triste: 0.2, sorprendido: 0.26, feliz: 0.1, neutral: 0.18 },
  politica_derecha: { enojado: 0.26, triste: 0.18, sorprendido: 0.28, feliz: 0.1, neutral: 0.18 },
  extrema_izquierda: { enojado: 0.3, triste: 0.2, sorprendido: 0.25, feliz: 0.08, neutral: 0.17 },
  extrema_derecha: { enojado: 0.3, triste: 0.2, sorprendido: 0.25, feliz: 0.08, neutral: 0.17 },
  libertarios: { enojado: 0.22, triste: 0.12, sorprendido: 0.32, feliz: 0.14, neutral: 0.2 },
  indignacion: { enojado: 0.34, triste: 0.18, sorprendido: 0.24, feliz: 0.06, neutral: 0.18 },
  violencia: { enojado: 0.36, triste: 0.28, sorprendido: 0.22, feliz: 0.04, neutral: 0.1 },
  peleas: { enojado: 0.34, triste: 0.14, sorprendido: 0.28, feliz: 0.12, neutral: 0.12 },
  injusticia: { enojado: 0.28, triste: 0.34, sorprendido: 0.18, feliz: 0.06, neutral: 0.14 },
  guerra: { enojado: 0.28, triste: 0.36, sorprendido: 0.22, feliz: 0.04, neutral: 0.1 },
  analisis_politico: { enojado: 0.18, triste: 0.14, sorprendido: 0.28, feliz: 0.1, neutral: 0.3 },
  noticias: { enojado: 0.2, triste: 0.22, sorprendido: 0.28, feliz: 0.12, neutral: 0.18 },
  drama: { enojado: 0.18, triste: 0.34, sorprendido: 0.22, feliz: 0.1, neutral: 0.16 },
  conspiraciones: { enojado: 0.22, triste: 0.16, sorprendido: 0.36, feliz: 0.08, neutral: 0.18 },
  animales: { enojado: 0.06, triste: 0.14, sorprendido: 0.22, feliz: 0.42, neutral: 0.16 },
  memes: { enojado: 0.12, triste: 0.08, sorprendido: 0.28, feliz: 0.36, neutral: 0.16 },
  humor: { enojado: 0.1, triste: 0.08, sorprendido: 0.26, feliz: 0.4, neutral: 0.16 },
  musica: { enojado: 0.08, triste: 0.16, sorprendido: 0.2, feliz: 0.36, neutral: 0.2 },
  deporte: { enojado: 0.16, triste: 0.12, sorprendido: 0.24, feliz: 0.34, neutral: 0.14 },
  cultura: { enojado: 0.1, triste: 0.14, sorprendido: 0.28, feliz: 0.24, neutral: 0.24 },
  viajes: { enojado: 0.06, triste: 0.1, sorprendido: 0.26, feliz: 0.38, neutral: 0.2 },
  salud: { enojado: 0.12, triste: 0.2, sorprendido: 0.22, feliz: 0.18, neutral: 0.28 },
  skincare: { enojado: 0.08, triste: 0.1, sorprendido: 0.2, feliz: 0.28, neutral: 0.34 },
  belleza: { enojado: 0.08, triste: 0.12, sorprendido: 0.22, feliz: 0.34, neutral: 0.24 },
  comida: { enojado: 0.1, triste: 0.08, sorprendido: 0.24, feliz: 0.36, neutral: 0.22 },
  exceso_comida: { enojado: 0.16, triste: 0.18, sorprendido: 0.34, feliz: 0.18, neutral: 0.14 },
  hambre: { enojado: 0.22, triste: 0.4, sorprendido: 0.18, feliz: 0.06, neutral: 0.14 },
  delgadez_extrema: { enojado: 0.18, triste: 0.36, sorprendido: 0.26, feliz: 0.06, neutral: 0.14 },
  religion: { enojado: 0.12, triste: 0.18, sorprendido: 0.2, feliz: 0.22, neutral: 0.28 },
  ocio: { enojado: 0.1, triste: 0.1, sorprendido: 0.24, feliz: 0.34, neutral: 0.22 },
  fake_news: { enojado: 0.28, triste: 0.14, sorprendido: 0.32, feliz: 0.08, neutral: 0.18 },
  ia: { enojado: 0.14, triste: 0.1, sorprendido: 0.38, feliz: 0.18, neutral: 0.2 },
  trends: { enojado: 0.12, triste: 0.1, sorprendido: 0.3, feliz: 0.32, neutral: 0.16 },
  finanzas: { enojado: 0.16, triste: 0.14, sorprendido: 0.26, feliz: 0.2, neutral: 0.24 },
  educacion: { enojado: 0.08, triste: 0.1, sorprendido: 0.28, feliz: 0.22, neutral: 0.32 },
  liminal: { enojado: 0.12, triste: 0.18, sorprendido: 0.4, feliz: 0.1, neutral: 0.2 },
  fitness: { enojado: 0.12, triste: 0.1, sorprendido: 0.22, feliz: 0.32, neutral: 0.24 },
  tech: { enojado: 0.12, triste: 0.1, sorprendido: 0.34, feliz: 0.2, neutral: 0.24 },
};

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeWeights(weights) {
  const out = { ...weights };
  let sum = 0;
  for (const e of EXPRESSIONS) {
    out[e] = Math.max(0.001, out[e] || 0);
    sum += out[e];
  }
  for (const e of EXPRESSIONS) out[e] /= sum;
  return out;
}

function uniformWeights() {
  const w = {};
  for (const e of EXPRESSIONS) w[e] = 1 / EXPRESSIONS.length;
  return w;
}

function debugEnabled() {
  if (REACTION_CONFIG.debug) return true;
  try {
    return globalThis?.localStorage?.getItem('npcDebug') === '1';
  } catch {
    return false;
  }
}

/**
 * Características ambiguas del clip (no una sola emoción).
 * `keywordScores` viene de catalog.js (conteos por emoción léxica).
 */
export function analyzeVideo(video = {}, keywordScores = null) {
  const catalogo = video.catalogo || 'ocio';
  const tags = Array.isArray(video.tags) ? video.tags : [];
  const scores = keywordScores || {
    enojado: 0,
    triste: 0,
    feliz: 0,
    sorprendido: 0,
    neutral: 0,
  };
  const total =
    scores.enojado + scores.triste + scores.feliz + scores.sorprendido + scores.neutral || 1;

  const conflict =
    clamp((scores.enojado / total) * 1.2 + (tags.includes('conflicto') ? 0.15 : 0), 0, 1);
  const sadness = clamp(scores.triste / total, 0, 1);
  const humor = clamp(
    (scores.feliz / total) * 0.7 +
      (tags.includes('humor') || catalogo === 'humor' || catalogo === 'memes' ? 0.25 : 0),
    0,
    1,
  );
  const surprise = clamp(
    (scores.sorprendido / total) * 1.1 + (tags.includes('trends') ? 0.12 : 0),
    0,
    1,
  );
  const political = clamp(
    /politica|extrema_|indignacion|libertarios|analisis_politico|fake_news/.test(catalogo) ||
      tags.includes('politica')
      ? 0.55 + conflict * 0.25
      : conflict * 0.15,
    0,
    1,
  );
  const violent = clamp(
    /violencia|peleas|guerra/.test(catalogo) || tags.includes('violencia')
      ? 0.55 + scores.enojado * 0.08
      : scores.enojado * 0.05,
    0,
    1,
  );
  const absurd = clamp(
    tags.includes('liminal') || tags.includes('absurdo') || catalogo === 'liminal'
      ? 0.55
      : surprise * 0.35 + humor * 0.2,
    0,
    1,
  );
  const hopeful = clamp(
    (scores.feliz / total) * 0.5 +
      (tags.includes('inspiracion') || catalogo === 'religion' ? 0.2 : 0),
    0,
    1,
  );
  const alarming = clamp(conflict * 0.5 + violent * 0.4 + sadness * 0.25, 0, 1);
  const celebratory = clamp(
    (scores.feliz / total) * 0.6 +
      (catalogo === 'deporte' || catalogo === 'musica' || tags.includes('celebracion')
        ? 0.2
        : 0),
    0,
    1,
  );
  const informative = clamp(
    (scores.neutral / total) * 0.8 +
      (catalogo === 'noticias' || catalogo === 'educacion' || catalogo === 'analisis_politico'
        ? 0.35
        : 0),
    0,
    1,
  );

  const valence = clamp(
    celebratory * 0.55 +
      humor * 0.35 +
      hopeful * 0.35 -
      conflict * 0.45 -
      sadness * 0.5 -
      violent * 0.4 -
      alarming * 0.25,
    -1,
    1,
  );
  const intensity = clamp(
    Math.max(conflict, sadness, surprise, humor, violent, absurd) * 0.85 +
      Math.abs(valence) * 0.2,
    0,
    1,
  );

  return {
    valence,
    intensity,
    conflict,
    sadness,
    humor,
    surprise,
    absurd,
    political,
    violent,
    hopeful,
    alarming,
    celebratory,
    informative,
    catalogo,
    tags,
    keywordScores: scores,
  };
}

function baseWeightsFromAnalysis(analysis) {
  const w = uniformWeights();
  const a = analysis;

  w.enojado += a.conflict * 0.55 + a.violent * 0.45 + a.alarming * 0.2 + a.political * 0.12;
  w.triste += a.sadness * 0.65 + a.alarming * 0.2 + a.hopeful * -0.05 + (a.valence < 0 ? 0.15 : 0);
  w.sorprendido += a.surprise * 0.55 + a.absurd * 0.4 + a.intensity * 0.15;
  w.feliz += a.humor * 0.5 + a.celebratory * 0.55 + a.hopeful * 0.35 + (a.valence > 0 ? 0.2 : 0);
  w.neutral += a.informative * 0.55 + (1 - a.intensity) * 0.25;

  // Ambigüedad: señales cruzadas diluyen el dominio de una sola etiqueta
  const strong = [a.conflict, a.sadness, a.humor, a.surprise, a.absurd].filter((x) => x > 0.35)
    .length;
  if (strong >= 2) {
    for (const e of EXPRESSIONS) w[e] += 0.08;
  }

  return normalizeWeights(w);
}

function applyCatalogPrior(weights, catalogo) {
  const prior = CATALOG_PRIORS[catalogo] || CATALOG_PRIORS.ocio;
  const mix = REACTION_CONFIG.catalogPriorInfluence;
  const out = {};
  for (const e of EXPRESSIONS) {
    out[e] = weights[e] * (1 - mix) + (prior[e] || 0.2) * mix;
  }
  return normalizeWeights(out);
}

function applyPersonality(weights, analysis, personality = NPC_PERSONALITY) {
  const p = personality;
  const k = REACTION_CONFIG.personalityInfluence;
  const out = { ...weights };

  out.enojado *= 1 + k * (p.conflictSensitivity - 0.5) * (0.4 + analysis.conflict);
  out.enojado *= 1 + k * (p.violenceSensitivity - 0.5) * analysis.violent;
  out.enojado *= 1 + k * (p.politicalSensitivity - 0.5) * analysis.political * 0.5;

  out.triste *= 1 + k * (p.sadnessSensitivity - 0.5) * (0.4 + analysis.sadness);
  out.triste *= 1 + k * (p.negativityBias - 0.5) * Math.max(0, -analysis.valence);

  out.feliz *= 1 + k * (p.positivityBias - 0.5) * (0.4 + Math.max(0, analysis.valence));
  out.feliz *= 1 + k * (p.humorSensitivity - 0.5) * analysis.humor;

  out.sorprendido *= 1 + k * (p.surpriseSensitivity - 0.5) * (0.4 + analysis.surprise);
  out.sorprendido *= 1 + k * (p.absurdSensitivity - 0.5) * analysis.absurd;

  out.neutral *= 1 + k * (0.5 - p.conflictSensitivity) * 0.3;

  return normalizeWeights(out);
}

function applyState(weights, state = NPC_STATE) {
  const k = REACTION_CONFIG.stateInfluence;
  const out = { ...weights };

  out.enojado *= 1 + k * state.tension * 0.9;
  out.triste *= 1 + k * (Math.max(0, -state.mood) * 0.7 + state.tension * 0.25);
  out.feliz *= 1 + k * (state.optimism * 0.8 + Math.max(0, state.mood) * 0.5);
  out.sorprendido *= 1 + k * (state.curiosity * 0.7 + state.arousal * 0.35);
  out.neutral *= 1 + k * (1 - Math.abs(state.mood)) * 0.25 * (1 - state.tension);

  // Estado alto ≠ emoción fija: solo sesgo
  return normalizeWeights(out);
}

function applyHistoryAndInertia(weights) {
  const out = { ...weights };
  const mem = reactionHistory;
  const pen = REACTION_CONFIG.repetitionPenalty;
  if (mem.length) {
    const counts = Object.fromEntries(EXPRESSIONS.map((e) => [e, 0]));
    for (const e of mem) counts[e] += 1;
    const n = mem.length;
    for (const e of EXPRESSIONS) {
      // Penaliza repetición leve solo si hay alternativas plausibles
      if (counts[e] / n >= 0.5 && out[e] < 0.55) {
        out[e] *= 1 - pen * (counts[e] / n);
      }
    }
  }

  const inertia = REACTION_CONFIG.emotionInertia;
  if (lastEmotion && out[lastEmotion] != null) {
    // Continuidad suave; un estímulo fuerte (peso alto en otra) puede romperla
    out[lastEmotion] *= 1 + inertia;
  }

  return normalizeWeights(out);
}

function applyControlledRandomness(weights) {
  const r = REACTION_CONFIG.randomnessAmount;
  const out = {};
  for (const e of EXPRESSIONS) {
    const jitter = 1 + (Math.random() * 2 - 1) * r;
    out[e] = weights[e] * jitter;
  }
  return normalizeWeights(out);
}

export function calculateEmotionWeights(
  videoAnalysis,
  npcState = NPC_STATE,
  personality = NPC_PERSONALITY,
  _reactionHistory = reactionHistory,
) {
  let w = baseWeightsFromAnalysis(videoAnalysis);
  w = applyCatalogPrior(w, videoAnalysis.catalogo);
  w = applyPersonality(w, videoAnalysis, personality);
  w = applyState(w, npcState);
  w = applyHistoryAndInertia(w);
  // Aleatoriedad al final, acotada
  w = applyControlledRandomness(w);
  return w;
}

function weightedPick(weights) {
  const w = normalizeWeights(weights);
  let r = Math.random();
  for (const e of EXPRESSIONS) {
    r -= w[e];
    if (r <= 0) return e;
  }
  return 'neutral';
}

function decayAndExpose(analysis, emotion) {
  const cfg = REACTION_CONFIG;
  const s = NPC_STATE;
  const step = cfg.exposureStep;
  const decay = cfg.stateDecayRate;
  const lim = cfg.stateClamp;

  // Recuperación gradual hacia baseline suave
  s.mood *= 1 - decay;
  s.tension = Math.max(0, s.tension * (1 - decay) - decay * 0.15);
  s.arousal *= 1 - decay * 0.8;
  s.optimism = s.optimism * (1 - decay) + 0.15 * decay;
  s.curiosity = s.curiosity * (1 - decay) + 0.3 * decay;

  // Exposición acumulativa (pasos pequeños)
  s.mood = clamp(s.mood + analysis.valence * step * 1.2, -lim, lim);
  s.tension = clamp(
    s.tension + (analysis.conflict * 0.9 + analysis.violent * 0.7 + analysis.alarming * 0.5) * step,
    0,
    lim,
  );
  s.arousal = clamp(s.arousal + analysis.intensity * step * 0.9, 0, lim);
  s.optimism = clamp(s.optimism + (analysis.hopeful + analysis.celebratory - analysis.sadness) * step, -lim, lim);
  s.curiosity = clamp(
    s.curiosity + (analysis.surprise + analysis.absurd + analysis.informative * 0.4) * step,
    0,
    lim,
  );

  // La emoción expresada también deja huella leve
  if (emotion === 'enojado') s.tension = clamp(s.tension + step * 0.25, 0, lim);
  if (emotion === 'triste') s.mood = clamp(s.mood - step * 0.3, -lim, lim);
  if (emotion === 'feliz') s.mood = clamp(s.mood + step * 0.25, -lim, lim);
  if (emotion === 'sorprendido') s.curiosity = clamp(s.curiosity + step * 0.2, 0, lim);
}

function pushHistory(emotion) {
  reactionHistory.push(emotion);
  while (reactionHistory.length > REACTION_CONFIG.reactionMemoryLength) {
    reactionHistory.shift();
  }
  lastEmotion = emotion;
}

/**
 * Punto de entrada: interpreta un clip y actualiza el sujeto.
 * @returns {{ emotion: string, weights: object, analysis: object, state: object }}
 */
export function reactToVideo(video, keywordScores = null) {
  const analysis = analyzeVideo(video, keywordScores);
  const weights = calculateEmotionWeights(analysis, NPC_STATE, NPC_PERSONALITY, reactionHistory);
  const emotion = weightedPick(weights);

  decayAndExpose(analysis, emotion);
  pushHistory(emotion);

  lastDebug = {
    videoId: video?.id,
    catalogo: analysis.catalogo,
    tags: analysis.tags,
    analysis: {
      valence: +analysis.valence.toFixed(2),
      conflict: +analysis.conflict.toFixed(2),
      surprise: +analysis.surprise.toFixed(2),
      humor: +analysis.humor.toFixed(2),
      sadness: +analysis.sadness.toFixed(2),
      political: +analysis.political.toFixed(2),
      violent: +analysis.violent.toFixed(2),
    },
    state: {
      mood: +NPC_STATE.mood.toFixed(2),
      tension: +NPC_STATE.tension.toFixed(2),
      optimism: +NPC_STATE.optimism.toFixed(2),
      curiosity: +NPC_STATE.curiosity.toFixed(2),
      arousal: +NPC_STATE.arousal.toFixed(2),
    },
    weights: Object.fromEntries(
      EXPRESSIONS.map((e) => [e, +weights[e].toFixed(3)]),
    ),
    selected: emotion,
    history: reactionHistory.slice(),
  };

  if (debugEnabled()) {
    // eslint-disable-next-line no-console
    console.info('[npcReaction]', lastDebug);
  }

  try {
    globalThis.__lastNpcReaction = lastDebug;
  } catch {
    /* ignore */
  }

  return {
    emotion,
    weights,
    analysis,
    state: { ...NPC_STATE },
    debug: lastDebug,
  };
}

export function getNpcState() {
  return { ...NPC_STATE };
}

export function getReactionHistory() {
  return reactionHistory.slice();
}

export function getLastReactionDebug() {
  return lastDebug;
}

export function resetNpcReaction(seedState = null) {
  reactionHistory.length = 0;
  lastEmotion = 'neutral';
  lastDebug = null;
  Object.assign(NPC_STATE, {
    mood: 0,
    arousal: 0.15,
    tension: 0.1,
    optimism: 0.2,
    curiosity: 0.35,
    ...(seedState || {}),
  });
}
