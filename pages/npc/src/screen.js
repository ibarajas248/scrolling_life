import {
  emotionLabel,
  catalogLabel,
  tiktokAvatarUrl,
  PLAYLIST,
  mergeCached,
  expressionFromVideo,
} from './feed.js?v=20260917';
import { createSlideVideo, ensureWarming, warmAhead, silenceWarmPool } from './warmPool.js?v=20260917';
import { watchDurationMs, randomStartSeconds } from './catalog.js?v=20260917';

const CATALOG_TINT = {
  politica: '#3a1a1a',
  politica_izquierda: '#4a1520',
  politica_derecha: '#1a2040',
  extrema_izquierda: '#5a1020',
  extrema_derecha: '#102040',
  libertarios: '#2a2840',
  indignacion: '#4a1010',
  violencia: '#3a0a0a',
  peleas: '#4a0c0c',
  injusticia: '#3a1a28',
  guerra: '#1a1820',
  analisis_politico: '#2a1a30',
  noticias: '#1a2838',
  drama: '#1a1828',
  conspiraciones: '#1a1a2a',
  animales: '#1a3a28',
  memes: '#3a2a1a',
  musica: '#1a3a2a',
  deporte: '#1a2a3a',
  cultura: '#2a1a3a',
  viajes: '#1a2a2a',
  salud: '#1a3238',
  skincare: '#2a2a3a',
  belleza: '#3a2430',
  comida: '#3a2818',
  exceso_comida: '#3a2010',
  hambre: '#2a1818',
  delgadez_extrema: '#1a1a28',
  religion: '#2a2438',
  humor: '#3a2a1a',
  ocio: '#3a2a1a',
  fake_news: '#3a1218',
  ia: '#1a2438',
  trends: '#2a1a28',
};

/**
 * Feed local 1080×1920: <video> + UI TikTok.
 * Loop infinito = scroller que regenera la cola + doble buffer precargado.
 */
export function createFeedOverlay({
  mount = document.body,
  playlist = PLAYLIST,
} = {}) {
  const LIST = playlist?.length ? playlist : PLAYLIST;
  const root = document.createElement('div');
  root.id = 'feed-overlay';
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '2',
    opacity: '0.5',
    overflow: 'hidden',
    background: 'transparent',
    pointerEvents: 'none',
  });

  const track = document.createElement('div');
  Object.assign(track.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '200%',
    willChange: 'transform',
  });
  root.appendChild(track);

  function makeSlide() {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'relative',
      width: '100%',
      height: '50%',
      overflow: 'hidden',
      background: '#0a0a0a',
    });
    const poster = document.createElement('div');
    Object.assign(poster.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '2',
      background: '#111 center/cover no-repeat',
      transition: 'opacity 0.2s ease',
      opacity: '1',
      pointerEvents: 'none',
    });
    const video = createSlideVideo();
    video.muted = true;
    video.volume = 0;
    video.style.zIndex = '1';
    el.appendChild(video);
    el.appendChild(poster);
    return { el, video, poster, itemId: null, src: null };
  }

  const slides = [makeSlide(), makeSlide()];
  track.appendChild(slides[0].el);
  track.appendChild(slides[1].el);

  const ICO = {
    liveTv: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8V6.5A1.5 1.5 0 019.5 5h5A1.5 1.5 0 0116 6.5V8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 4l2-2M17 4l-2-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    heart: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" d="M24 41.5S6 30.2 6 17.8C6 12.1 10.6 8 15.4 8c3.1 0 5.9 1.5 7.6 3.9C24.7 9.5 27.5 8 30.6 8 35.4 8 40 12.1 40 17.8 40 30.2 24 41.5 24 41.5z"/></svg>`,
    comment: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M24 4C12.4 4 3 12.8 3 23.5c0 3.9 1.1 7.5 3 10.7L3 44l10.8-2.8c2.9 1.6 6.2 2.5 10.2 2.5 11.6 0 21-8.8 21-19.5S35.6 4 24 4zm0 34.5c-3.2 0-6.2-.9-8.7-2.4l-.6-.4-6.4 1.7 1.7-6.2-.4-.6A16.2 16.2 0 016 23.5C6 14.4 14 7 24 7s18 7.4 18 16.5S34 38.5 24 38.5z"/><circle cx="16" cy="23.5" r="2.2"/><circle cx="24" cy="23.5" r="2.2"/><circle cx="32" cy="23.5" r="2.2"/></svg>`,
    bookmark: `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M12 6h24v36l-12-8-12 8V6z"/></svg>`,
    share: `<img src="./img/share.png" alt="" aria-hidden="true" style="display:block;width:100%;height:100%;object-fit:contain" />`,
    search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    verified: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#20a4ff"/><path d="M7 12.5l3 3 7-7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3l9 8h-3v10h-5v-6H11v6H6V11H3l9-8z"/></svg>`,
    homeOutline: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"/></svg>`,
    friends: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2 20v-1.2c0-2.8 3.1-4.8 7-4.8s7 2 7 4.8V20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17.5" cy="9" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 20v-.8c0-1.8 1.8-3.2 4.5-3.2.8 0 1.5.1 2.2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    messages: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 3V6a1 1 0 011-1z"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20v-1.5c0-3 3.1-5.5 7-5.5s7 2.5 7 5.5V20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    bluetooth: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.5 3.5L7 10h4l-3.5 3.5L7 17l7.5-7.5V21l5.5-5.5-4-4 4-4L14.5 3.5z"/></svg>`,
    signal: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 22h2V10H2v12zm4 0h2V6H6v16zm4 0h2V2h-2v20zm4 0h2V8h-2v14zm4 0h2v-8h-2v8z"/></svg>`,
    wifi: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 18.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4.95-2.12 1.41 1.41A5.98 5.98 0 0112 16.5c1.4 0 2.68.48 3.71 1.29l1.41-1.41A7.97 7.97 0 0012 14.5a8 8 0 00-5.32 2.02zm-2.83-2.83 1.41 1.41A9.96 9.96 0 0112 12.5c2.54 0 4.85.95 6.64 2.51l1.41-1.41A11.95 11.95 0 0012 10.5a12 12 0 00-8.13 3.17z"/></svg>`,
    battery: `<svg viewBox="0 0 36 16" aria-hidden="true"><rect x="1" y="2" width="30" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3.5" y="4.5" width="22" height="7" rx="1.5" fill="currentColor"/><rect x="32" y="5.5" width="2.5" height="5" rx="1" fill="currentColor"/></svg>`,
  };

  const chrome = document.createElement('div');
  chrome.id = 'phone-ui';
  chrome.innerHTML = `
    <div class="phone-status">
      <span data-clock>9:41</span>
      <span class="phone-status-right">
        <span class="st-ico st-bt">${ICO.bluetooth}</span>
        <span class="st-ico">${ICO.wifi}</span>
        <span class="st-ico">${ICO.signal}</span>
        <span class="st-battery-wrap">
          <span class="st-ico st-bat">${ICO.battery}</span>
          <span class="st-battery-pct" data-battery>49</span>
        </span>
      </span>
    </div>
    <div class="tt-top">
      <div class="tt-live-wrap">
        <span class="tt-live-ico">${ICO.liveTv}</span>
        <span class="tt-live-txt">LIVE</span>
      </div>
      <div class="tt-tabs">
        <span>Comunidad</span>
        <span>Siguiendo</span>
        <span class="tt-tab-active">Para ti</span>
      </div>
      <div class="tt-search-top">${ICO.search}</div>
    </div>
    <div class="tt-emotion" data-emotion aria-hidden="true"></div>
    <div class="tt-rail">
      <div class="tt-avatar-wrap">
        <div class="tt-avatar" data-avatar></div>
        <div class="tt-follow">+</div>
      </div>
      <div class="tt-action"><div class="tt-ico">${ICO.heart}</div><div class="tt-count" data-likes>0</div></div>
      <div class="tt-action"><div class="tt-ico">${ICO.comment}</div><div class="tt-count" data-comments>0</div></div>
      <div class="tt-action"><div class="tt-ico">${ICO.bookmark}</div><div class="tt-count" data-saves>0</div></div>
      <div class="tt-action"><div class="tt-ico">${ICO.share}</div><div class="tt-count" data-shares>0</div></div>
      <div class="tt-disc" data-disc>
        <div class="tt-disc-ring"></div>
        <div class="tt-disc-core" data-disc-core></div>
      </div>
    </div>
    <div class="tt-bottom">
      <div class="tt-author-row">
        <span class="tt-author" data-author>Latinus</span>
        <span class="tt-verified" data-verified>${ICO.verified}</span>
      </div>
      <div class="tt-caption" data-caption></div>
    </div>
    <div class="tt-search-pill">
      <span class="tt-search-pill-ico">${ICO.search}</span>
      <span class="tt-search-pill-txt" data-search-pill>Búsqueda · trends Colombia</span>
      <span class="tt-search-pill-chev">${ICO.chevron}</span>
    </div>
    <nav class="tt-nav">
      <div class="tt-nav-item tt-nav-active"><span class="tt-nav-ico">${ICO.home}</span><span>Inicio</span></div>
      <div class="tt-nav-item"><span class="tt-nav-ico">${ICO.friends}</span><span>Amigos</span></div>
      <div class="tt-nav-item tt-nav-create"><div class="tt-create-btn"><span></span></div></div>
      <div class="tt-nav-item"><span class="tt-nav-ico">${ICO.messages}</span><span>Mensajes</span><i class="tt-badge">8</i></div>
      <div class="tt-nav-item"><span class="tt-nav-ico">${ICO.profile}</span><span>Perfil</span></div>
    </nav>
  `;
  Object.assign(chrome.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '4',
    pointerEvents: 'none',
  });
  mount.appendChild(chrome);

  const style = document.createElement('style');
  style.textContent = `
    #phone-ui {
      font-family: "TikTok Sans", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #fff; -webkit-font-smoothing: antialiased; --u: var(--ui-scale, 2.51);
    }
    #phone-ui svg { display: block; width: 100%; height: 100%; }
    #phone-ui .phone-status {
      position: absolute; top: calc(8px * var(--u)); left: calc(20px * var(--u)); right: calc(16px * var(--u));
      display: flex; justify-content: space-between; align-items: center;
      font: 600 calc(14px * var(--u))/1 system-ui, sans-serif;
      text-shadow: 0 1px 2px rgba(0,0,0,.35); z-index: 6;
    }
    #phone-ui .phone-status-right { display: flex; align-items: center; gap: calc(4px * var(--u)); }
    #phone-ui .st-ico { width: calc(14px * var(--u)); height: calc(14px * var(--u)); opacity: .98; }
    #phone-ui .st-bt { width: calc(12px * var(--u)); height: calc(12px * var(--u)); }
    #phone-ui .st-battery-wrap { display: flex; align-items: center; gap: calc(2px * var(--u)); margin-left: calc(2px * var(--u)); }
    #phone-ui .st-bat { width: calc(24px * var(--u)); height: calc(12px * var(--u)); }
    #phone-ui .st-battery-pct { font: 600 calc(11px * var(--u))/1 system-ui, sans-serif; opacity: .95; }

    #phone-ui .tt-top {
      position: absolute; top: calc(42px * var(--u)); left: 0; right: 0;
      display: flex; align-items: flex-start; justify-content: center;
      padding: 0 calc(10px * var(--u)); z-index: 5;
    }
    #phone-ui .tt-live-wrap {
      position: absolute; left: calc(12px * var(--u)); top: calc(2px * var(--u));
      display: flex; flex-direction: column; align-items: center; gap: calc(1px * var(--u));
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.5));
    }
    #phone-ui .tt-live-ico { width: calc(22px * var(--u)); height: calc(22px * var(--u)); }
    #phone-ui .tt-live-txt {
      font: 700 calc(9px * var(--u))/1 system-ui, sans-serif; letter-spacing: .02em;
    }
    #phone-ui .tt-tabs {
      display: flex; justify-content: center; align-items: center; gap: calc(18px * var(--u));
      padding-top: calc(4px * var(--u));
      font: 600 calc(16px * var(--u))/1.1 system-ui, sans-serif;
      text-shadow: 0 1px 3px rgba(0,0,0,.55);
    }
    #phone-ui .tt-tabs span { opacity: .65; white-space: nowrap; color: rgba(255,255,255,.92); }
    #phone-ui .tt-tab-active {
      opacity: 1 !important; font-weight: 700; position: relative; color: #fff !important;
    }
    #phone-ui .tt-tab-active::after {
      content: ""; position: absolute; left: 50%; transform: translateX(-50%);
      bottom: calc(-8px * var(--u)); width: calc(22px * var(--u)); height: calc(3px * var(--u));
      border-radius: calc(2px * var(--u)); background: #fff;
    }
    #phone-ui .tt-search-top {
      position: absolute; right: calc(12px * var(--u)); top: calc(4px * var(--u));
      width: calc(26px * var(--u)); height: calc(26px * var(--u));
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.55));
    }

    #phone-ui .tt-emotion {
      position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0);
      white-space: nowrap; opacity: 0; pointer-events: none;
    }

    #phone-ui .tt-rail {
      position: absolute; right: calc(8px * var(--u)); bottom: calc(168px * var(--u));
      display: flex; flex-direction: column; align-items: center; gap: calc(18px * var(--u));
      filter: drop-shadow(0 1px 3px rgba(0,0,0,.45)); z-index: 4;
    }
    #phone-ui .tt-avatar-wrap { position: relative; margin-bottom: calc(2px * var(--u)); }
    #phone-ui .tt-avatar {
      width: calc(46px * var(--u)); height: calc(46px * var(--u)); border-radius: 50%;
      border: calc(2px * var(--u)) solid #fff; background: center/cover no-repeat #222;
    }
    #phone-ui .tt-follow {
      position: absolute; left: 50%; bottom: calc(-8px * var(--u)); transform: translateX(-50%);
      width: calc(18px * var(--u)); height: calc(18px * var(--u)); border-radius: 50%;
      background: #fe2c55; color: #fff;
      font: 700 calc(14px * var(--u))/calc(16px * var(--u)) system-ui, sans-serif; text-align: center;
      border: calc(1.5px * var(--u)) solid #fff;
    }
    #phone-ui .tt-action { text-align: center; color: #fff; }
    #phone-ui .tt-ico { width: calc(34px * var(--u)); height: calc(34px * var(--u)); margin: 0 auto; }
    #phone-ui .tt-count {
      font: 600 calc(12px * var(--u))/1.1 system-ui, sans-serif; margin-top: calc(4px * var(--u));
      text-shadow: 0 1px 2px rgba(0,0,0,.55);
    }
    #phone-ui .tt-disc {
      position: relative; width: calc(44px * var(--u)); height: calc(44px * var(--u)); border-radius: 50%;
      margin-top: calc(2px * var(--u)); animation: spin 4s linear infinite;
      background: #111; border: calc(4px * var(--u)) solid #222; box-shadow: 0 0 0 1px #555;
    }
    #phone-ui .tt-disc-ring {
      position: absolute; inset: 0; border-radius: 50%;
      background: repeating-radial-gradient(circle at center, #333 0 1px, #111 1px 3px); opacity: .95;
    }
    #phone-ui .tt-disc-core {
      position: absolute; inset: calc(9px * var(--u)); border-radius: 50%;
      background: center/cover no-repeat #333; border: 1px solid #666;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    #phone-ui .tt-bottom {
      position: absolute; left: calc(12px * var(--u)); right: calc(72px * var(--u));
      bottom: calc(108px * var(--u)); text-shadow: 0 1px 3px rgba(0,0,0,.65); z-index: 4;
    }
    #phone-ui .tt-author-row {
      display: flex; align-items: center; gap: calc(5px * var(--u)); margin-bottom: calc(6px * var(--u));
    }
    #phone-ui .tt-author { font: 700 calc(16px * var(--u))/1.2 system-ui, sans-serif; }
    #phone-ui .tt-verified {
      width: calc(14px * var(--u)); height: calc(14px * var(--u)); flex: 0 0 auto;
      display: none;
    }
    #phone-ui .tt-verified.is-on { display: block; }
    #phone-ui .tt-caption {
      font: 400 calc(14px * var(--u))/1.35 system-ui, sans-serif; max-height: 2.7em; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    #phone-ui .tt-search-pill {
      position: absolute; left: calc(10px * var(--u)); right: calc(10px * var(--u));
      bottom: calc(52px * var(--u)); height: calc(34px * var(--u));
      display: flex; align-items: center; gap: calc(8px * var(--u));
      padding: 0 calc(12px * var(--u)); border-radius: calc(6px * var(--u));
      background: rgba(38,38,38,.72); z-index: 5;
    }
    #phone-ui .tt-search-pill-ico {
      width: calc(14px * var(--u)); height: calc(14px * var(--u)); flex: 0 0 auto; opacity: .85;
    }
    #phone-ui .tt-search-pill-txt {
      flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font: 500 calc(13px * var(--u))/1 system-ui, sans-serif; color: rgba(255,255,255,.92);
    }
    #phone-ui .tt-search-pill-chev {
      width: calc(14px * var(--u)); height: calc(14px * var(--u)); flex: 0 0 auto; opacity: .7;
    }

    #phone-ui .tt-nav {
      position: absolute; left: 0; right: 0; bottom: 0; height: calc(52px * var(--u));
      display: grid; grid-template-columns: repeat(5, 1fr); align-items: end;
      padding: calc(4px * var(--u)) calc(2px * var(--u)) calc(8px * var(--u));
      background: #000; box-sizing: border-box; z-index: 5;
    }
    #phone-ui .tt-nav-item {
      position: relative; display: flex; flex-direction: column; align-items: center; gap: calc(2px * var(--u));
      font: 600 calc(10px * var(--u))/1 system-ui, sans-serif; color: rgba(255,255,255,.55);
    }
    #phone-ui .tt-nav-active { color: #fff; }
    #phone-ui .tt-nav-ico { width: calc(26px * var(--u)); height: calc(26px * var(--u)); }
    #phone-ui .tt-nav-create { transform: translateY(calc(-1px * var(--u))); }
    #phone-ui .tt-create-btn {
      width: calc(48px * var(--u)); height: calc(30px * var(--u)); border-radius: calc(8px * var(--u));
      background: #fff; position: relative; overflow: visible;
      display: flex; align-items: center; justify-content: center;
    }
    #phone-ui .tt-create-btn::before,
    #phone-ui .tt-create-btn::after {
      content: ""; position: absolute; top: 0; bottom: 0; width: calc(4px * var(--u)); border-radius: calc(3px * var(--u));
    }
    #phone-ui .tt-create-btn::before { left: calc(-5px * var(--u)); background: #25f4ee; }
    #phone-ui .tt-create-btn::after { right: calc(-5px * var(--u)); background: #fe2c55; }
    #phone-ui .tt-create-btn span {
      width: calc(14px * var(--u)); height: calc(2.5px * var(--u)); background: #111; border-radius: calc(2px * var(--u)); position: relative;
    }
    #phone-ui .tt-create-btn span::before {
      content: ""; position: absolute; left: 50%; top: 50%;
      width: calc(2.5px * var(--u)); height: calc(14px * var(--u)); background: #111; border-radius: calc(2px * var(--u));
      transform: translate(-50%, -50%);
    }
    #phone-ui .tt-badge {
      position: absolute; top: calc(-4px * var(--u)); right: calc(50% - 20px * var(--u));
      min-width: calc(15px * var(--u)); height: calc(15px * var(--u)); padding: 0 calc(4px * var(--u));
      border-radius: calc(8px * var(--u)); background: #fe2c55; color: #fff;
      font: 700 calc(9px * var(--u))/calc(15px * var(--u)) system-ui, sans-serif; text-align: center; font-style: normal;
    }
    #phone-stage #tiktok-start {
      position: absolute; inset: 0; z-index: 20;
      display: flex; align-items: center; justify-content: center; flex-direction: column;
      background: rgba(0,0,0,.72); color: #fff; cursor: pointer; pointer-events: auto;
      font: 700 calc(18px * var(--ui-scale, 2.51))/1.4 system-ui, sans-serif; text-align: center;
      padding: calc(24px * var(--ui-scale, 2.51)); border-radius: inherit;
    }
    #phone-stage #tiktok-start span {
      opacity: .75; font-weight: 500; font-size: calc(14px * var(--ui-scale, 2.51));
      display: block; margin-top: calc(10px * var(--ui-scale, 2.51));
    }
  `;
  document.head.appendChild(style);
  mount.appendChild(root);

  const els = {
    author: chrome.querySelector('[data-author]'),
    caption: chrome.querySelector('[data-caption]'),
    searchPill: chrome.querySelector('[data-search-pill]'),
    likes: chrome.querySelector('[data-likes]'),
    comments: chrome.querySelector('[data-comments]'),
    saves: chrome.querySelector('[data-saves]'),
    shares: chrome.querySelector('[data-shares]'),
    emotion: chrome.querySelector('[data-emotion]'),
    verified: chrome.querySelector('[data-verified]'),
    avatar: chrome.querySelector('[data-avatar]'),
    discCore: chrome.querySelector('[data-disc-core]'),
    clock: chrome.querySelector('[data-clock]'),
    battery: chrome.querySelector('[data-battery]'),
  };

  const VERIFIED_AUTHORS = new Set([
    'karolg', 'shakira', 'camilo', 'ferxxo44',
    'gemelasabello2', 'karensevillano7', 'senadocolombia', 'nacionaloficial',
  ]);

  const SEARCH_SUGGESTIONS = [
    'trends Colombia', 'Karol G nuevo', 'Liga BetPlay', 'Gemelas Abello',
    'fake news', 'AI generated', 'Atl Nacional', 'Feid remix',
  ];

  function tickClock() {
    const d = new Date();
    els.clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  tickClock();
  setInterval(tickClock, 30000);

  let first = true;
  let unlocked = true;
  let busy = false;
  let pendingItem = null;
  let pendingOpts = null;
  let onUnlock = null;
  let currentVisibleId = null;
  let currentItem = LIST[0];
  let onEndedAdvance = null;
  let onClipReady = null;
  let onPlaybackFail = null;
  let playToken = 0;
  let soundEnabled = false;
  const soundButton = document.createElement('button');
  soundButton.type = 'button';
  soundButton.textContent = 'Activar sonido';
  soundButton.setAttribute('aria-pressed', 'false');
  Object.assign(soundButton.style, {
    position: 'absolute', top: '210px', left: '32px', zIndex: '15',
    padding: '18px 24px', borderRadius: '40px', border: '1px solid #ffffff66',
    background: '#000a', color: '#fff', font: '32px Arial, sans-serif', cursor: 'pointer',
  });
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundButton.textContent = soundEnabled ? 'Silenciar' : 'Activar sonido';
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    const video = slides[0].video;
    video.muted = !soundEnabled;
    video.volume = soundEnabled ? 1 : 0;
    if (video.paused) void video.play().catch(() => {});
  });
  mount.appendChild(soundButton);

  function hardSilenceVideo(v) {
    if (!v) return;
    v.pause();
    v.muted = true;
    v.volume = 0;
  }

  function stopAllAudio(exceptVideo = null) {
    slides.forEach((s) => {
      if (s.video !== exceptVideo) hardSilenceVideo(s.video);
    });
    silenceWarmPool();
    document.querySelectorAll('#feed-overlay video').forEach((v) => {
      if (v !== exceptVideo) hardSilenceVideo(v);
    });
  }

  function paintPoster(slide, item) {
    const rich = mergeCached(item);
    const tint = CATALOG_TINT[item.catalogo] || '#111';
    const avatar = rich.avatar || tiktokAvatarUrl(item.author);
    slide.poster.style.opacity = '1';
    slide.poster.style.backgroundColor = tint;
    if (rich.thumbnail) {
      slide.poster.style.backgroundImage = `url("${rich.thumbnail}")`;
      slide.poster.style.backgroundSize = 'cover';
    } else if (avatar) {
      slide.poster.style.backgroundImage = `linear-gradient(180deg, ${tint}bb, ${tint}), url("${avatar}")`;
      slide.poster.style.backgroundSize = 'cover, 42%';
      slide.poster.style.backgroundPosition = 'center, center 38%';
    } else {
      slide.poster.style.backgroundImage = 'none';
    }
  }

  function hidePoster(slide) {
    slide.poster.style.opacity = '0';
  }

  function stat(n) {
    if (n == null || n === '' || n === '—') return '0';
    if (typeof n === 'number' && Number.isFinite(n)) {
      if (n >= 1_000_000) {
        const m = Math.round((n / 1_000_000) * 10) / 10;
        return `${String(m).replace(/\.0$/, '')} M`;
      }
      if (n >= 10_000) return `${Math.round(n / 1000)} mil`;
      if (n >= 1000) return `${Math.round(n / 100) * 100}`;
      return String(Math.round(n));
    }
    const s = String(n);
    const m = s.match(/^([\d.]+)\s*K$/i);
    if (m) {
      const num = parseFloat(m[1]);
      if (num >= 10) return `${Math.round(num * 10) / 10} mil`.replace('.0 mil', ' mil');
      return `${Math.round(num * 1000)}`;
    }
    const m2 = s.match(/^([\d.]+)\s*M$/i);
    if (m2) {
      const num = parseFloat(m2[1]);
      if (num >= 1) return `${Math.round(num * 10) / 10} M`.replace('.0 M', ' M');
    }
    return s;
  }

  function displayName(item, rich) {
    return rich.authorName || item.authorName || (item.author || '').replace(/^@/, '') || 'TikTok';
  }

  function isVerified(author) {
    const handle = (author || '').replace(/^@/, '').toLowerCase();
    return VERIFIED_AUTHORS.has(handle);
  }

  function searchSuggestion(item) {
    const handle = (item.author || '').replace(/^@/, '');
    const pick = SEARCH_SUGGESTIONS[Math.abs([...handle].reduce((a, c) => a + c.charCodeAt(0), 0)) % SEARCH_SUGGESTIONS.length];
    const words = (item.texto || '').split(/\s+/).filter((w) => w.length > 4);
    const term = words[0]?.replace(/[^\wáéíóúñÁÉÍÓÚÑ#@]/g, '') || pick;
    return `Búsqueda · ${term || pick}`;
  }

  function silenceSlide(slide) {
    hardSilenceVideo(slide?.video);
  }

  function silenceAllExcept(activeSlide) {
    stopAllAudio(activeSlide?.video ?? null);
  }

  async function playSlide(slide, { audible = false } = {}) {
    if (slide !== slides[0]) {
      silenceSlide(slide);
      return false;
    }

    const token = ++playToken;
    const v = slide.video;
    stopAllAudio(v);

    v.muted = !(audible && soundEnabled);
    v.volume = audible && soundEnabled ? 1 : 0;

    let played = false;
    try {
      await v.play();
      played = !v.paused;
    } catch {
      v.muted = true;
      v.volume = 0;
      try {
        await v.play();
        played = !v.paused;
      } catch {
        /* autoplay bloqueado */
      }
    }

    // Cancelar si hubo otro cambio de clip mientras await v.play()
    if (token !== playToken || slide !== slides[0]) {
      hardSilenceVideo(v);
      return false;
    }

    if (played) hidePoster(slide);

    if (played && typeof onClipReady === 'function') {
      const durSec = v.duration;
      const durMs = Number.isFinite(durSec) && durSec > 0 ? durSec * 1000 : null;
      const watchMs = watchDurationMs(durMs);
      if (durMs && durMs > 12000) {
        const start = randomStartSeconds(durSec, watchMs);
        if (start > 0.4) {
          try {
            v.currentTime = start;
          } catch {
            /* ignore seek */
          }
        }
      }
      onClipReady(watchMs);
    }
    return played;
  }

  function pauseSlide(slide) {
    silenceSlide(slide);
  }

  function mountSlide(slide, item) {
    paintPoster(slide, item);
    const src = item.src || `./videos/${item.id}.mp4`;
    if (slide.itemId !== item.id || slide.src !== src) {
      slide.itemId = item.id;
      slide.src = src;
      silenceSlide(slide);
      slide.video.src = src;
      slide.video.load();
    }
    ensureWarming(src);
    return slide;
  }

  function paintUi(item) {
    const rich = mergeCached(item);
    const categoria = item.categoria || expressionFromVideo(item);
    const name = displayName(item, rich);
    const caption = rich.texto || item.texto || '';

    els.author.textContent = name;
    els.caption.textContent = caption;
    els.searchPill.textContent = searchSuggestion(item);
    els.likes.textContent = stat(item.likes);
    els.comments.textContent = stat(item.comments);
    els.saves.textContent = stat(item.saves);
    els.shares.textContent = stat(item.shares);
    els.emotion.textContent = `${catalogLabel(item.catalogo)} → ${emotionLabel(categoria)}`;
    els.verified.classList.toggle('is-on', isVerified(item.author || rich.author));

    const avatarUrl = rich.avatar || tiktokAvatarUrl(item.author) || rich.thumbnail;
    if (avatarUrl) {
      els.avatar.style.backgroundColor = 'transparent';
      els.avatar.style.backgroundImage = `url("${avatarUrl}")`;
      els.discCore.style.backgroundImage = `url("${avatarUrl}")`;
    } else {
      const hue = [...(item.author || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
      els.avatar.style.backgroundImage = 'none';
      els.avatar.style.backgroundColor = `hsl(${hue} 55% 42%)`;
      els.discCore.style.backgroundImage = 'none';
      els.discCore.style.backgroundColor = `hsl(${hue} 55% 42%)`;
    }
  }

  function reveal(item, onVisible) {
    currentItem = item;
    paintUi(item);
    currentVisibleId = item.id;
    if (typeof onVisible === 'function') onVisible(item);
  }

  function swapSlides() {
    const old = slides[0];
    const next = slides[1];
    track.appendChild(old.el);
    slides[0] = next;
    slides[1] = old;
    track.style.transition = 'none';
    track.style.transform = 'translateY(0)';
  }

  function bindVideoEvents(slide) {
    slides.forEach((s) => {
      if (s !== slide) {
        s.video.onended = null;
        s.video.onerror = null;
      }
    });
    slide.video.onended = () => {
      if (slide !== slides[0] || !unlocked) return;
      if (typeof onEndedAdvance === 'function') onEndedAdvance();
    };
    slide.video.onerror = () => {
      if (slide !== slides[0] || !unlocked) return;
      if (typeof onPlaybackFail === 'function') {
        setTimeout(onPlaybackFail, 1800);
      }
    };
  }

  function preload(item) {
    if (!item || busy) return;
    mountSlide(slides[1], item);
    pauseSlide(slides[1]);
    warmAhead([item]);
  }

  function showVideo(item, opts = {}) {
    pendingItem = item;
    pendingOpts = opts;
    if (!unlocked) {
      paintUi(item);
      return;
    }
    if (busy) return;
    runShow(item, opts.onVisible);
  }

  function runShow(item, onVisible) {
    playToken += 1;
    stopAllAudio();
    busy = true;
    warmAhead([item]);

    if (first) {
      track.style.transition = 'none';
      track.style.transform = 'translateY(0)';
      mountSlide(slides[0], item);
      bindVideoEvents(slides[0]);
      reveal(item, onVisible);
      void playSlide(slides[0], { audible: true });
      first = false;
      busy = false;
      flushPending();
      return;
    }

    mountSlide(slides[1], item);
    silenceSlide(slides[0]);
    silenceSlide(slides[1]);

    track.style.transition = 'none';
    track.style.transform = 'translateY(0)';
    void track.offsetHeight;
    track.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
    track.style.transform = 'translateY(-50%)';

    setTimeout(() => {
      playToken += 1;
      stopAllAudio();
      swapSlides();
      bindVideoEvents(slides[0]);
      void playSlide(slides[0], { audible: true });
      reveal(item, onVisible);
      busy = false;
      flushPending();
    }, 290);
  }

  function flushPending() {
    if (!pendingItem || busy || !unlocked) return;
    const item = pendingItem;
    const opts = pendingOpts || {};
    if (item.id === currentVisibleId && !first) {
      pendingItem = null;
      return;
    }
    pendingItem = null;
    pendingOpts = null;
    runShow(item, opts.onVisible);
  }

  // Boot: vídeos en silencio hasta el gesto del usuario
  mountSlide(slides[0], LIST[0]);
  mountSlide(slides[1], LIST[1] || LIST[0]);
  slides.forEach(silenceSlide);
  paintUi(LIST[0]);

  function stopPlayback() {
    playToken += 1;
    stopAllAudio();
  }

  function resumePlayback() {
    if (!unlocked || busy) return;
    void playSlide(slides[0], { audible: true });
  }

  function dispose() {
    slides.forEach((s) => {
      s.video.pause();
      s.video.removeAttribute('src');
    });
    root.remove();
    soundButton.remove();
    chrome.remove();
    style.remove();
  }

  return {
    showVideo,
    preload,
    dispose,
    stopPlayback,
    resumePlayback,
    root,
    getCurrentItem: () => currentItem,
    onVideoEnded(cb) {
      onEndedAdvance = cb;
    },
    onClipReady(cb) {
      onClipReady = cb;
    },
    onPlaybackFail(cb) {
      onPlaybackFail = cb;
    },
    whenUnlocked(cb) {
      onUnlock = cb;
      if (unlocked) cb();
    },
  };
}
