/**
 * Playlist TikTok — ecosistema heterogéneo (no 1 cuenta = 1 caja).
 * La emoción del NPC se decide en runtime vía npcReaction.js
 */

import { getCachedMeta, setCachedMeta, mergeCached } from './metaCache.js?v=20260917';
import {
  expressionFromCatalog,
  expressionFromVideo,
  catalogLabel,
  withCatalogExpression,
  watchDurationMs,
} from './catalog.js?v=20260917';
import sourcesConfig from './sources.js?v=20260917';

const AUTHOR_META = new Map(
  (sourcesConfig.accounts || []).map((a) => [
    (a.author || '').replace(/^@/, '').toLowerCase(),
    { catalogo: a.catalogo, tags: a.tags || [], authorName: a.authorName },
  ]),
);

function enrichFromSources(video) {
  const handle = (video.author || '').replace(/^@/, '').toLowerCase();
  const meta = AUTHOR_META.get(handle);
  if (!meta) {
    return {
      ...video,
      tags: Array.isArray(video.tags) ? video.tags : [],
    };
  }
  return {
    ...video,
    catalogo: video.catalogo || meta.catalogo,
    tags: Array.isArray(video.tags) && video.tags.length ? video.tags : meta.tags,
    authorName: video.authorName || meta.authorName,
  };
}

/** Entradas base: solo catalogo; categoria se deriva en runtime. */
const RAW_VIDEOS = [
  // —— Política ——
  {
    id: 'tt-pol-01',
    tiktokId: '7678202247016156423',
    author: '@senadocolombia',
    authorName: 'Senado Colombia',
    catalogo: 'politica',
    texto: 'El Congreso elige a los 9 magistrados de la Corte Constitucional',
    likes: '124K',
    comments: '8.2K',
    shares: '15K',
    saves: '4.1K',
    music: 'sonido original - Senado Colombia',
  },
  {
    id: 'tt-pol-02',
    tiktokId: '7677771001379261714',
    author: '@senadocolombia',
    authorName: 'Senado Colombia',
    catalogo: 'politica',
    texto: 'Estudiar técnica y maestría sin pasar 5 años en la universidad',
    likes: '89K',
    comments: '5.4K',
    shares: '9.8K',
    saves: '2.3K',
    music: 'sonido original - Senado Colombia',
  },
  {
    id: 'tt-pol-03',
    tiktokId: '7676276293154934034',
    author: '@senadocolombia',
    authorName: 'Senado Colombia',
    catalogo: 'politica',
    texto: 'El Caribe en riesgo de apagón — crisis de liquidez en Afinia',
    likes: '210K',
    comments: '18K',
    shares: '42K',
    saves: '6.8K',
    music: 'sonido original - Senado Colombia',
  },
  {
    id: 'tt-pol-04',
    tiktokId: '7678068928379161876',
    author: '@mindefensa',
    authorName: 'Ministerio de Defensa',
    catalogo: 'politica',
    texto: 'Tener a la familia pasando por un momento difícil y aun así salir adelante',
    likes: '156K',
    comments: '9.1K',
    shares: '22K',
    saves: '5.5K',
    music: 'sonido original - Mindefensa',
  },
  {
    id: 'tt-pol-05',
    tiktokId: '7677651455410507028',
    author: '@mindefensa',
    authorName: 'Ministerio de Defensa',
    catalogo: 'politica',
    texto: 'Gobierno pone en marcha nuevas medidas de seguridad',
    likes: '98K',
    comments: '6.2K',
    shares: '11K',
    saves: '3.1K',
    music: 'sonido original - Mindefensa',
  },

  // —— Deporte ——
  {
    id: 'tt-dep-01',
    tiktokId: '7239178104135011589',
    author: '@ligabetplay',
    authorName: 'Liga BetPlay',
    catalogo: 'deporte',
    texto: 'Tabla de posiciones — ¿tu equipo está en los 6?',
    likes: '420K',
    comments: '12K',
    shares: '28K',
    saves: '35K',
    music: 'sonido original - Liga BetPlay',
  },
  {
    id: 'tt-dep-02',
    tiktokId: '7239090938121948422',
    author: '@ligabetplay',
    authorName: 'Liga BetPlay',
    catalogo: 'deporte',
    texto: '¿Tu equipo está dentro de los 6? Déjalo en comentarios',
    likes: '380K',
    comments: '15K',
    shares: '24K',
    saves: '31K',
    music: 'sonido original - Liga BetPlay',
  },
  {
    id: 'tt-dep-03',
    tiktokId: '7678814186155150613',
    author: '@nacionaloficial',
    authorName: 'Atl. Nacional',
    catalogo: 'deporte',
    texto: '¡La hinchada y los jugadores! Debut en casa',
    likes: '890K',
    comments: '8.4K',
    shares: '52K',
    saves: '68K',
    music: 'sonido original - Atl. Nacional',
  },
  {
    id: 'tt-dep-04',
    tiktokId: '7678756091647233300',
    author: '@nacionaloficial',
    authorName: 'Atl. Nacional',
    catalogo: 'deporte',
    texto: '¡Qué gran ser humano sos, René! Feliz cumpleaños',
    likes: '720K',
    comments: '6.8K',
    shares: '41K',
    saves: '55K',
    music: 'sonido original - Atl. Nacional',
  },
  {
    id: 'tt-dep-05',
    tiktokId: '7678756351635459349',
    author: '@nacionaloficial',
    authorName: 'Atl. Nacional',
    catalogo: 'deporte',
    texto: 'Un golazo de crack — Marlos Moreno en acción',
    likes: '650K',
    comments: '5.2K',
    shares: '38K',
    saves: '48K',
    music: 'sonido original - Atl. Nacional',
  },

  // —— Cultura ——
  {
    id: 'tt-cul-01',
    tiktokId: '7678799459068808466',
    author: '@idartes',
    authorName: 'Idartes Bogotá',
    catalogo: 'cultura',
    texto: 'Lanzamiento oficial de los 30 años de Rock al Parque',
    likes: '45K',
    comments: '2.1K',
    shares: '8.4K',
    saves: '12K',
    music: 'sonido original - Idartes',
  },
  {
    id: 'tt-cul-02',
    tiktokId: '7678709239686106375',
    author: '@idartes',
    authorName: 'Idartes Bogotá',
    catalogo: 'cultura',
    texto: 'La danza también es una forma de crear y contar historias',
    likes: '38K',
    comments: '1.8K',
    shares: '6.2K',
    saves: '9.5K',
    music: 'sonido original - Idartes',
  },

  // —— Música ——
  {
    id: 'tt-mus-01',
    tiktokId: '7677650189368200461',
    author: '@karolg',
    authorName: 'KAROL G',
    catalogo: 'musica',
    texto: 'JUst Like Karolina',
    likes: '4.2M',
    comments: '42K',
    shares: '280K',
    saves: '520K',
    music: 'sonido original - KAROL G',
  },
  {
    id: 'tt-mus-02',
    tiktokId: '7672172145031531790',
    author: '@karolg',
    authorName: 'KAROL G',
    catalogo: 'musica',
    texto: 'Listening party de mi disco en Colombia',
    likes: '2.8M',
    comments: '28K',
    shares: '190K',
    saves: '410K',
    music: 'sonido original - KAROL G',
  },
  {
    id: 'tt-mus-05',
    tiktokId: '7678447426906164494',
    author: '@camilo',
    authorName: 'Camilo',
    catalogo: 'musica',
    texto: 'Supe que tú eres mi casa — no es DÓNDE, sino QUIÉN te abraza',
    likes: '1.9M',
    comments: '22K',
    shares: '145K',
    saves: '290K',
    music: 'sonido original - Camilo',
  },
  {
    id: 'tt-mus-06',
    tiktokId: '7678026784222235918',
    author: '@camilo',
    authorName: 'Camilo',
    catalogo: 'musica',
    texto: 'No he podido concentrarme a trabajar',
    likes: '980K',
    comments: '14K',
    shares: '88K',
    saves: '120K',
    music: 'sonido original - Camilo',
  },
  {
    id: 'tt-mus-09',
    tiktokId: '7665424394541452574',
    author: '@shakira',
    authorName: 'Shakira',
    catalogo: 'musica',
    texto: 'This moment will live on forever — Triplets Ghetto Kids',
    likes: '8.2M',
    comments: '62K',
    shares: '510K',
    saves: '890K',
    music: 'sonido original - Shakira',
  },
  {
    id: 'tt-mus-10',
    tiktokId: '7665087473344662814',
    author: '@shakira',
    authorName: 'Shakira',
    catalogo: 'musica',
    texto: 'The secret behind my hair? @isima',
    likes: '3.8M',
    comments: '28K',
    shares: '240K',
    saves: '450K',
    music: 'sonido original - Shakira',
  },
  {
    id: 'tt-mus-11',
    tiktokId: '6977881895816154373',
    author: '@ferxxo44',
    authorName: 'Feid',
    catalogo: 'musica',
    texto: 'Me llama solo pa vernos',
    likes: '6.1M',
    comments: '55K',
    shares: '380K',
    saves: '720K',
    music: 'sonido original - Feid',
  },

  // —— Ocio / trends ——
  {
    id: 'tt-oci-01',
    tiktokId: '7678127401242610965',
    author: '@gemelasabello2',
    authorName: 'Gemelas Abello',
    catalogo: 'ocio',
    texto: 'Sin pelear dijimos',
    likes: '2.1M',
    comments: '18K',
    shares: '95K',
    saves: '180K',
    music: 'sonido original - Gemelas Abello',
  },
  {
    id: 'tt-oci-02',
    tiktokId: '7676608374959656213',
    author: '@gemelasabello2',
    authorName: 'Gemelas Abello',
    catalogo: 'ocio',
    texto: 'Haz lo tuyo',
    likes: '1.8M',
    comments: '14K',
    shares: '82K',
    saves: '155K',
    music: 'sonido original - Gemelas Abello',
  },
  {
    id: 'tt-oci-03',
    tiktokId: '7677386124767005959',
    author: '@malejasantosss',
    authorName: 'Maleja Santos',
    catalogo: 'ocio',
    texto: 'Sustooo',
    likes: '890K',
    comments: '9.2K',
    shares: '48K',
    saves: '92K',
    music: 'sonido original - Maleja Santos',
  },
  {
    id: 'tt-oci-04',
    tiktokId: '7677339978065546514',
    author: '@malejasantosss',
    authorName: 'Maleja Santos',
    catalogo: 'ocio',
    texto: 'Nunca existirá una sesión tan icónica como esa',
    likes: '1.2M',
    comments: '11K',
    shares: '65K',
    saves: '110K',
    music: 'sonido original - Maleja Santos',
  },
  {
    id: 'tt-oci-05',
    tiktokId: '7678389938898980116',
    author: '@karensevillano7',
    authorName: 'Karen Sevillano',
    catalogo: 'ocio',
    texto: 'Alguien en Francia que me invite a un sudado de pollo?',
    likes: '3.4M',
    comments: '28K',
    shares: '210K',
    saves: '380K',
    music: 'sonido original - Karen Sevillano',
  },
  {
    id: 'tt-oci-06',
    tiktokId: '7677643062830501127',
    author: '@karensevillano7',
    authorName: 'Karen Sevillano',
    catalogo: 'ocio',
    texto: 'Saliendo',
    likes: '2.8M',
    comments: '22K',
    shares: '165K',
    saves: '290K',
    music: 'sonido original - Karen Sevillano',
  },
  {
    id: 'tt-oci-07',
    tiktokId: '7678824228409462024',
    author: '@deiryvargas',
    authorName: 'Deiry Vargas',
    catalogo: 'ocio',
    texto: 'Temporada de Spiderman — siempre me sigue la cuerda',
    likes: '1.5M',
    comments: '16K',
    shares: '88K',
    saves: '145K',
    music: 'sonido original - Deiry Vargas',
  },
  {
    id: 'tt-oci-08',
    tiktokId: '7677832392731561234',
    author: '@deiryvargas',
    authorName: 'Deiry Vargas',
    catalogo: 'ocio',
    texto: '¿A quién más le encantó esta rola? #karolg',
    likes: '980K',
    comments: '12K',
    shares: '62K',
    saves: '98K',
    music: 'sonido original - Deiry Vargas',
  },
  {
    id: 'tt-oci-09',
    tiktokId: '7678449066480585985',
    author: '@donandres0410',
    authorName: 'Don Andrés',
    catalogo: 'ocio',
    texto: 'Historias de tiendas — ¿te ha pasado?',
    likes: '420K',
    comments: '8.4K',
    shares: '35K',
    saves: '52K',
    music: 'sonido original - Don Andrés',
  },
  {
    id: 'tt-oci-10',
    tiktokId: '7677698551069101328',
    author: '@donandres0410',
    authorName: 'Don Andrés',
    catalogo: 'ocio',
    texto: 'Con razón estaba tan AMABLE',
    likes: '380K',
    comments: '7.2K',
    shares: '28K',
    saves: '45K',
    music: 'sonido original - Don Andrés',
  },
  {
    id: 'tt-oci-11',
    tiktokId: '7678780839714376978',
    author: '@stiward',
    authorName: 'Stiward',
    catalogo: 'ocio',
    texto: '¿A qué hora te apareció este video? #spiderman',
    likes: '2.2M',
    comments: '19K',
    shares: '120K',
    saves: '210K',
    music: 'sonido original - Stiward',
  },
  {
    id: 'tt-oci-12',
    tiktokId: '7678482710133820680',
    author: '@stiward',
    authorName: 'Stiward',
    catalogo: 'ocio',
    texto: '#fyp #viral',
    likes: '1.9M',
    comments: '15K',
    shares: '98K',
    saves: '175K',
    music: 'sonido original - Stiward',
  },
  {
    id: 'tt-oci-13',
    tiktokId: '7672914872270638357',
    author: '@la_lerma',
    authorName: 'La Lerma',
    catalogo: 'ocio',
    texto: 'Incentivar a ayudar con lo que sea',
    likes: '890K',
    comments: '10K',
    shares: '55K',
    saves: '88K',
    music: 'sonido original - La Lerma',
  },
  {
    id: 'tt-oci-14',
    tiktokId: '7678163896255008018',
    author: '@jeison_giraldo',
    authorName: 'Jeison Giraldo',
    catalogo: 'ocio',
    texto: 'Oración del día',
    likes: '5.2M',
    comments: '38K',
    shares: '280K',
    saves: '490K',
    music: 'sonido original - Jeison Giraldo',
  },
  {
    id: 'tt-oci-15',
    tiktokId: '7677786450120772872',
    author: '@jeison_giraldo',
    authorName: 'Jeison Giraldo',
    catalogo: 'ocio',
    texto: 'Demosle el lugar a Dios',
    likes: '4.8M',
    comments: '35K',
    shares: '260K',
    saves: '450K',
    music: 'sonido original - Jeison Giraldo',
  },

  // —— Viajes ——
  {
    id: 'tt-via-01',
    tiktokId: '7668920909947964693',
    author: '@colombia.travel',
    authorName: 'Colombia Travel',
    catalogo: 'viajes',
    texto: 'Terminas visitando los lugares que tanto veías en internet',
    likes: '320K',
    comments: '4.2K',
    shares: '28K',
    saves: '65K',
    music: 'sonido original - Colombia Travel',
  },
  {
    id: 'tt-via-02',
    tiktokId: '7668162636692966677',
    author: '@colombia.travel',
    authorName: 'Colombia Travel',
    catalogo: 'viajes',
    texto: 'A veces basta mirar por la ventana para encontrar magia',
    likes: '280K',
    comments: '3.8K',
    shares: '24K',
    saves: '58K',
    music: 'sonido original - Colombia Travel',
  },
  {
    id: 'tt-via-03',
    tiktokId: '7667724871287311636',
    author: '@colombia.travel',
    authorName: 'Colombia Travel',
    catalogo: 'viajes',
    texto: 'Nada como cumplir años en la montaña',
    likes: '410K',
    comments: '5.1K',
    shares: '32K',
    saves: '72K',
    music: 'sonido original - Colombia Travel',
  },
];

export const ALL_VIDEOS = RAW_VIDEOS.map(withCatalogExpression);

/** Pool vivo: primero library.json (auto-refresh), luego manifest + RAW. */
let livePool = ALL_VIDEOS.slice();
/** IDs con MP4 confirmado en manifest.json (+ entradas de library.json). */
let playableIds = new Set();
let libraryUpdatedAt = null;
let manifestUpdatedAt = null;

function filterPlayable(pool) {
  if (!playableIds.size) return filterBlockedAuthors(pool);
  const ok = pool.filter((v) => playableIds.has(v.id));
  return filterBlockedAuthors(ok.length ? ok : pool);
}

const BLOCKED_AUTHORS = new Set(['maluma', 'jbalvin']);

function authorHandle(video) {
  return (video?.author || '').replace(/^@/, '').toLowerCase();
}

function filterBlockedAuthors(pool) {
  return pool.filter((v) => !BLOCKED_AUTHORS.has(authorHandle(v)));
}

export function getPlayableIds() {
  return playableIds;
}

export function getVideos() {
  const base = livePool.length ? livePool : ALL_VIDEOS;
  return filterPlayable(base);
}

async function fetchManifestOk() {
  try {
    const res = await fetch('./videos/manifest.json', { cache: 'no-store' });
    if (!res.ok) return { ok: [], updatedAt: null };
    const data = await res.json();
    return { ok: data.ok || [], updatedAt: data.updatedAt || null };
  } catch {
    return { ok: [], updatedAt: null };
  }
}

function syncPlayableIds({ manifestOk = [], libraryIds = [] } = {}) {
  playableIds = new Set([...manifestOk, ...libraryIds]);
}

function applyLibraryVideos(entries) {
  if (!Array.isArray(entries) || !entries.length) return false;
  const rawById = new Map(ALL_VIDEOS.map((v) => [v.id, v]));
  const libraryIds = new Set(entries.map((v) => v.id));
  // Solo librería dinámica: stats reales de TikTok (sin inventar ni mezclar el catálogo estático).
  livePool = entries.map((v) => {
    const base = rawById.get(v.id) || {};
    return withCatalogExpression(
      enrichFromSources({
        ...base,
        ...v,
        catalogo: v.catalogo || base.catalogo || 'ocio',
        id: v.id,
        likes: v.likes,
        comments: v.comments,
        saves: v.saves,
        shares: v.shares,
        src: v.src || base.src || `./videos/${v.id}.mp4`,
      }),
    );
  });
  syncPlayableIds({ manifestOk: [...playableIds], libraryIds: [...libraryIds] });
  return true;
}

export async function loadLocalManifest() {
  const manifest = await fetchManifestOk();
  manifestUpdatedAt = manifest.updatedAt;

  // 1) Librería dinámica (prioridad para instalación larga)
  try {
    const res = await fetch('./videos/library.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      libraryUpdatedAt = data.updatedAt || null;
      if (applyLibraryVideos(data.videos)) {
        syncPlayableIds({
          manifestOk: manifest.ok,
          libraryIds: (data.videos || []).map((v) => v.id),
        });
        rebuildPlaylist(getVideos());
        return getVideos();
      }
    }
  } catch {
    /* sin library aún */
  }

  // 2) Fallback: manifest de IDs del feed estático
  syncPlayableIds({ manifestOk: manifest.ok });
  if (manifest.ok.length) {
    const local = ALL_VIDEOS.filter((v) => playableIds.has(v.id));
    livePool = local.length ? local : ALL_VIDEOS.slice();
  } else {
    livePool = ALL_VIDEOS.slice();
  }
  rebuildPlaylist(getVideos());
  return getVideos();
}

async function reloadManifestIfChanged() {
  const manifest = await fetchManifestOk();
  const stamp = manifest.updatedAt || [...manifest.ok].sort().join(',');
  if (stamp && stamp === manifestUpdatedAt) return false;
  manifestUpdatedAt = stamp;
  syncPlayableIds({
    manifestOk: manifest.ok,
    libraryIds: livePool.map((v) => v.id).filter((id) => !manifest.ok.includes(id)),
  });
  rebuildPlaylist(getVideos());
  return true;
}

/**
 * Relee library.json + manifest.json. Si hay cambios, actualiza el pool.
 */
export async function refreshLibraryFromDisk() {
  let changed = false;
  try {
    if (await reloadManifestIfChanged()) changed = true;

    const res = await fetch('./videos/library.json', { cache: 'no-store' });
    if (!res.ok) {
      return { changed, videos: getVideos() };
    }
    const data = await res.json();
    const stamp = data.updatedAt || '';
    if (stamp && stamp === libraryUpdatedAt && !changed) {
      return { changed: false, videos: getVideos() };
    }
    const prevIds = new Set(getVideos().map((v) => v.id));
    if (!applyLibraryVideos(data.videos)) {
      return { changed, videos: getVideos() };
    }
    libraryUpdatedAt = stamp || libraryUpdatedAt;
    const manifest = await fetchManifestOk();
    syncPlayableIds({
      manifestOk: manifest.ok,
      libraryIds: (data.videos || []).map((v) => v.id),
    });
    const nextIds = new Set(getVideos().map((v) => v.id));
    if (!changed) {
      changed = prevIds.size !== nextIds.size;
      if (!changed) {
        for (const id of nextIds) {
          if (!prevIds.has(id)) {
            changed = true;
            break;
          }
        }
      }
    }
    if (changed) rebuildPlaylist(getVideos());
    return { changed, videos: getVideos(), updatedAt: libraryUpdatedAt };
  } catch {
    return { changed: false, videos: getVideos() };
  }
}

/** Polling para instalaciones 24/7 — detecta library/manifest nuevos sin reiniciar. */
export function watchLibrary({ intervalMs = 5 * 60 * 1000, onUpdate } = {}) {
  let busy = false;
  const tick = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const result = await refreshLibraryFromDisk();
      if (result.changed && typeof onUpdate === 'function') onUpdate(result);
    } finally {
      busy = false;
    }
  };
  const id = setInterval(tick, intervalMs);
  setTimeout(tick, 8000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', tick);
  };
}

/** @deprecated usar getVideos() */
export const VIDEOS = ALL_VIDEOS;

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** Semilla del día UTC → recorridos distintos cada jornada sin secuencias fijas. */
function daySeed() {
  const d = new Date();
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(list, seed) {
  const a = list.slice();
  const rnd = mulberry32(seed >>> 0);
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

function worldKey(video) {
  return video?.catalogo || 'ocio';
}

/**
 * Mezcla por “mundos” (catálogo), no por emoción.
 * Permite rachas ocasionales (exposición acumulativa) y cambios bruscos.
 */
function interleaveByWorld(pool) {
  if (!pool?.length) return [];
  const seed = daySeed() ^ (pool.length * 2654435761);
  const buckets = new Map();
  seededShuffle(pool, seed).forEach((v) => {
    const k = worldKey(v);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(v);
  });
  const keys = seededShuffle([...buckets.keys()], seed + 17);
  const ptr = Object.fromEntries(keys.map((k) => [k, 0]));
  const out = [];
  let last = null;
  let streak = 0;
  const total = pool.length;
  const rnd = mulberry32(seed + 99);

  while (out.length < total) {
    const remaining = keys.filter((k) => ptr[k] < buckets.get(k).length);
    if (!remaining.length) break;

    // ~18% de probabilidad de repetir mundo (racha) si queda contenido
    let pick = null;
    if (last && ptr[last] < buckets.get(last).length && rnd() < 0.18 && streak < 3) {
      pick = last;
    } else {
      const candidates = remaining.filter((k) => k !== last);
      const poolKeys = candidates.length ? candidates : remaining;
      pick = poolKeys[Math.floor(rnd() * poolKeys.length)];
    }

    out.push(buckets.get(pick)[ptr[pick]]);
    ptr[pick] += 1;
    streak = pick === last ? streak + 1 : 1;
    last = pick;
  }
  return out.length ? out : seededShuffle(pool, seed);
}

function buildInfinitePlaylist(pool = ALL_VIDEOS) {
  return interleaveByWorld(pool);
}

export let PLAYLIST = buildInfinitePlaylist();

export function rebuildPlaylist(pool = getVideos()) {
  PLAYLIST = buildInfinitePlaylist(pool);
  return PLAYLIST;
}

const EMOTION_LABEL = {
  feliz: '😊 Feliz',
  triste: '😢 Triste',
  enojado: '😠 Enojado',
  sorprendido: '😮 Sorprendido',
  neutral: '😐 Neutral',
};

export function emotionLabel(categoria) {
  return EMOTION_LABEL[categoria] || categoria;
}

export { catalogLabel, expressionFromCatalog, expressionFromVideo, watchDurationMs, mergeCached };

export function handleFromAuthor(author) {
  return (author || '@tiktok').replace(/^@/, '');
}

export function tiktokAvatarUrl(author) {
  const handle = handleFromAuthor(author);
  return handle ? `https://unavatar.io/tiktok/${encodeURIComponent(handle)}` : null;
}

export function tiktokPageUrl(video) {
  return `https://www.tiktok.com/@${handleFromAuthor(video.author)}/video/${video.tiktokId}`;
}

const oembedCache = new Map();
const avatarPrefetch = new Set();

export function prefetchAvatar(video) {
  const url = video?.avatar || tiktokAvatarUrl(video?.author);
  if (!url || avatarPrefetch.has(url)) return;
  avatarPrefetch.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

export async function enrichVideoMeta(video) {
  const base = withCatalogExpression(video);
  const avatar = tiktokAvatarUrl(base.author);
  const withAvatar = { ...base, avatar };

  if (oembedCache.has(video.id)) {
    return { ...withAvatar, ...oembedCache.get(video.id), avatar };
  }

  const cached = getCachedMeta(video.id);
  if (cached) {
    oembedCache.set(video.id, cached);
    return { ...withAvatar, ...cached, avatar: tiktokAvatarUrl(cached.author || base.author) };
  }

  prefetchAvatar(withAvatar);

  try {
    const page = tiktokPageUrl(base);
    const endpoint = import.meta.env?.DEV
      ? `/api/oembed?url=${encodeURIComponent(page)}`
      : `https://www.tiktok.com/oembed?url=${encodeURIComponent(page)}`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const author = data.author_unique_id
      ? `@${data.author_unique_id}`
      : base.author;
    const extra = {
      texto: data.title || base.texto,
      authorName: data.author_name || base.authorName,
      author,
      thumbnail: data.thumbnail_url || null,
      music: base.music,
      catalogo: base.catalogo,
      tags: base.tags,
    };
    oembedCache.set(video.id, extra);
    setCachedMeta(video.id, extra);
    return { ...base, ...extra, avatar: tiktokAvatarUrl(author) };
  } catch {
    return withAvatar;
  }
}

/** oEmbed en idle — no usar en el arranque. */
export function enrichWhenIdle(video, cb) {
  const run = () => {
    enrichVideoMeta(video).then((rich) => {
      if (typeof cb === 'function') cb(rich);
    });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 200);
  }
}

export function createFeedScroller({
  onChange,
  onPreload,
  onEmpty,
} = {}) {
  let index = 0;
  let watchdogId = null;
  let queue = PLAYLIST.slice();
  const recentIds = [];

  function pool() {
    return getVideos();
  }

  function remember(id) {
    if (!id) return;
    recentIds.push(id);
    const cap = Math.max(6, Math.min(pool().length - 1, 14));
    while (recentIds.length > cap) recentIds.shift();
  }

  function freshBatch() {
    const all = pool();
    if (!all.length) return [];
    const blocked = new Set(recentIds);
    const unused = all.filter((v) => !blocked.has(v.id));
    return interleaveByWorld(unused.length ? unused : all);
  }

  function extendQueue() {
    const fresh = freshBatch();
    if (!fresh.length) return;
    queue = queue.concat(fresh);
  }

  function at(i) {
    while (i >= queue.length) extendQueue();
    return queue[i];
  }

  function clearWatchdog() {
    if (watchdogId !== null) {
      clearTimeout(watchdogId);
      watchdogId = null;
    }
  }

  function armWatchdog(ms) {
    clearWatchdog();
    watchdogId = setTimeout(() => advance(), ms);
  }

  function emit() {
    if (!pool().length) {
      onEmpty?.();
      armWatchdog(8000);
      return;
    }
    const video = at(index);
    remember(video?.id);
    onChange(video, index);
    armWatchdog(watchDurationMs(null));
    if (onPreload) {
      const next = at(index + 1);
      setTimeout(() => onPreload(next, index + 1), 320);
    }
  }

  function advance() {
    clearWatchdog();
    index += 1;
    if (index >= queue.length - 2) extendQueue();
    emit();
  }

  return {
    start() {
      queue = PLAYLIST.slice();
      index = 0;
      recentIds.length = 0;
      if (!queue.length) extendQueue();
      emit();
    },
    stop() {
      clearWatchdog();
    },
    next() {
      advance();
    },
    /** Timer según el recorte ya calculado en screen.js. */
    armFromMedia(watchMs) {
      if (!Number.isFinite(watchMs) || watchMs <= 0) return;
      armWatchdog(watchMs);
    },
    refreshPool() {
      const fresh = freshBatch();
      if (!fresh.length) return;
      queue = queue.slice(0, index + 1).concat(fresh);
    },
    getCurrent: () => (pool().length ? at(index) : null),
    getIndex: () => index,
  };
}

export function tiktokPlayerUrl(tiktokId, { muted = true } = {}) {
  const params = new URLSearchParams({
    autoplay: '1',
    loop: '1',
    muted: muted ? '1' : '0',
    rel: '0',
    music_info: '0',
    description: '0',
    controls: '0',
    progress_bar: '0',
    play_button: '0',
    volume_control: '1',
    fullscreen_button: '0',
    timestamp: '0',
    closed_caption: '0',
  });
  return `https://www.tiktok.com/player/v1/${tiktokId}?${params.toString()}`;
}

/** Fallback si player/v1 no arranca (misma ratio 9:16). */
export function tiktokEmbedUrl(tiktokId) {
  return `https://www.tiktok.com/embed/${tiktokId}`;
}
