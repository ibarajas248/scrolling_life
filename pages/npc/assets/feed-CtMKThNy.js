/**
 * Playlist TikTok — trends de Colombia.
 * catalogo → expresión NPC vía src/catalog.js
 */

import { getCachedMeta, setCachedMeta, mergeCached } from './metaCache.js';
import {
  expressionFromCatalog,
  catalogLabel,
  withCatalogExpression,
} from './catalog.js';

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
    id: 'tt-mus-03',
    tiktokId: '7669164299062955278',
    author: '@jbalvin',
    authorName: 'J Balvin',
    catalogo: 'musica',
    texto: 'Dalmation — en honor a mi perro que en paz descanse',
    likes: '3.1M',
    comments: '35K',
    shares: '210K',
    saves: '380K',
    music: 'sonido original - J Balvin',
  },
  {
    id: 'tt-mus-04',
    tiktokId: '7662405605465918733',
    author: '@jbalvin',
    authorName: 'J Balvin',
    catalogo: 'musica',
    texto: 'MI GENTE',
    likes: '5.6M',
    comments: '48K',
    shares: '420K',
    saves: '610K',
    music: 'sonido original - J Balvin',
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
    id: 'tt-mus-07',
    tiktokId: '7678769465928125704',
    author: '@maluma',
    authorName: 'Maluma',
    catalogo: 'musica',
    texto: 'No me mires así ome',
    likes: '2.4M',
    comments: '31K',
    shares: '175K',
    saves: '340K',
    music: 'sonido original - Maluma',
  },
  {
    id: 'tt-mus-08',
    tiktokId: '7678130332285160712',
    author: '@maluma',
    authorName: 'Maluma',
    catalogo: 'musica',
    texto: 'Bueno… ¿La saco o no la saco?',
    likes: '1.6M',
    comments: '19K',
    shares: '98K',
    saves: '210K',
    music: 'sonido original - Maluma',
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
let availableIds = null;
let libraryUpdatedAt = null;

export function getVideos() {
  return livePool.length ? livePool : ALL_VIDEOS;
}

function applyLibraryVideos(entries) {
  if (!Array.isArray(entries) || !entries.length) return false;
  const rawById = new Map(ALL_VIDEOS.map((v) => [v.id, v]));
  const libraryIds = new Set(entries.map((v) => v.id));
  const fromLibrary = entries.map((v) => {
    const base = rawById.get(v.id) || {};
    return withCatalogExpression({
      ...v,
      ...base,
      id: v.id,
      src: v.src || base.src || `./videos/${v.id}.mp4`,
    });
  });
  // Mantener catálogo estático descargado aunque library.json use IDs dinámicos
  const staticExtra = ALL_VIDEOS.filter((v) => !libraryIds.has(v.id)).map(withCatalogExpression);
  livePool = [...fromLibrary, ...staticExtra];
  availableIds = new Set(livePool.map((v) => v.id));
  return true;
}

export async function loadLocalManifest() {
  // 1) Librería dinámica (prioridad para instalación larga)
  try {
    const res = await fetch('./videos/library.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      libraryUpdatedAt = data.updatedAt || null;
      if (applyLibraryVideos(data.videos)) {
        return getVideos();
      }
    }
  } catch {
    /* sin library aún */
  }

  // 2) Fallback: manifest de IDs del feed estático
  try {
    const res = await fetch('./videos/manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    availableIds = new Set(data.ok || []);
    const local = ALL_VIDEOS.filter((v) => availableIds.has(v.id));
    livePool = local.length ? local : ALL_VIDEOS.slice();
  } catch {
    availableIds = null;
    livePool = ALL_VIDEOS.slice();
  }
  return getVideos();
}

/**
 * Relee library.json. Si hay cambios, actualiza el pool y devuelve { changed, videos }.
 */
export async function refreshLibraryFromDisk() {
  try {
    const res = await fetch('./videos/library.json', { cache: 'no-store' });
    if (!res.ok) return { changed: false, videos: getVideos() };
    const data = await res.json();
    const stamp = data.updatedAt || '';
    if (stamp && stamp === libraryUpdatedAt) {
      return { changed: false, videos: getVideos() };
    }
    const prevIds = new Set(livePool.map((v) => v.id));
    if (!applyLibraryVideos(data.videos)) {
      return { changed: false, videos: getVideos() };
    }
    libraryUpdatedAt = stamp || libraryUpdatedAt;
    const nextIds = new Set(livePool.map((v) => v.id));
    let changed = prevIds.size !== nextIds.size;
    if (!changed) {
      for (const id of nextIds) {
        if (!prevIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) rebuildPlaylist(livePool);
    return { changed, videos: getVideos(), updatedAt: libraryUpdatedAt };
  } catch {
    return { changed: false, videos: getVideos() };
  }
}

/** Polling suave para instalaciones 24/7 (default 30 min). */
export function watchLibrary({ intervalMs = 30 * 60 * 1000, onUpdate } = {}) {
  const tick = async () => {
    const result = await refreshLibraryFromDisk();
    if (result.changed && typeof onUpdate === 'function') onUpdate(result);
  };
  const id = setInterval(tick, intervalMs);
  // primera pasada en idle
  setTimeout(tick, 15_000);
  return () => clearInterval(id);
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

/** Varias pasadas mezcladas → base del scroll infinito. */
function buildInfinitePlaylist(pool = ALL_VIDEOS, cycles = 2) {
  const out = [];
  for (let c = 0; c < cycles; c += 1) {
    out.push(...shuffle(pool));
  }
  return out;
}

export let PLAYLIST = buildInfinitePlaylist();

export function rebuildPlaylist(pool = getVideos()) {
  PLAYLIST = buildInfinitePlaylist(pool, 3);
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

export { catalogLabel, expressionFromCatalog, mergeCached };

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
    const endpoint = import.meta.env.DEV
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
      categoria: expressionFromCatalog(base.catalogo),
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

export function createFeedScroller({ intervalMs = 9000, onChange, onPreload }) {
  let index = 0;
  let timerId = null;
  let queue = PLAYLIST.slice();

  function extendQueue() {
    queue = queue.concat(shuffle(getVideos()));
  }

  function at(i) {
    while (i >= queue.length) extendQueue();
    return queue[i];
  }

  function emit() {
    const video = at(index);
    onChange(video, index);
    if (onPreload) {
      const next = at(index + 1);
      // Evitar pisar el slide entrante mientras anima el feed
      setTimeout(() => onPreload(next, index + 1), 320);
    }
  }

  function advance() {
    index += 1;
    if (index >= queue.length - 2) extendQueue();
    emit();
  }

  return {
    start() {
      queue = PLAYLIST.slice();
      index = 0;
      emit();
      timerId = setInterval(advance, intervalMs);
    },
    stop() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
    },
    /** Avanza al siguiente clip (p. ej. cuando termina el MP4). Reinicia el timer. */
    next() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = setInterval(advance, intervalMs);
      }
      advance();
    },
    /** Inyecta el pool nuevo en la cola (sin cortar el clip actual). */
    refreshPool() {
      const fresh = shuffle(getVideos());
      // Sustituye el futuro; conserva lo ya emitido
      queue = queue.slice(0, index + 1).concat(fresh);
    },
    getCurrent: () => at(index),
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
