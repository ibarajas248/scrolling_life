import{P as U,e as ct,c as lt,a as ut,t as Y}from"./index-DeIiI3_E.js";const f=new Map;function D(){const o=document.createElement("video");return o.muted=!0,o.playsInline=!0,o.preload="auto",o.loop=!1,o.setAttribute("playsinline",""),o.setAttribute("webkit-playsinline",""),Object.assign(o.style,{position:"absolute",inset:"0",width:"100%",height:"100%",objectFit:"cover",background:"#000"}),o}function K(o,{priority:p=!1}={}){if(!o||f.has(o))return f.get(o)||null;const c=D();if(c.src=o,c.muted=!0,c.volume=0,c.load(),f.set(o,c),f.size>12){const v=f.keys().next().value;if(v&&v!==o){const i=f.get(v);i==null||i.removeAttribute("src"),i==null||i.load(),f.delete(v)}}return c}function G(o=[]){o.forEach((p,c)=>{p!=null&&p.src&&K(p.src,{priority:c===0})})}function dt(){return D()}const pt="sl-meta-v1";function vt(){try{return JSON.parse(sessionStorage.getItem(pt)||"{}")}catch{return{}}}function ht(o){return vt()[o]||null}function R(o){const p=ht(o.id);return p?{...o,...p}:o}const ft={politica:"#3a1a1a",deporte:"#1a2a3a",cultura:"#2a1a3a",musica:"#1a3a2a",ocio:"#3a2a1a",viajes:"#1a2a2a"};function gt({mount:o=document.body,playlist:p=U}={}){const c=p!=null&&p.length?p:U,v=document.createElement("div");v.id="feed-overlay",Object.assign(v.style,{position:"absolute",inset:"0",zIndex:"2",opacity:"0.5",overflow:"hidden",background:"transparent",pointerEvents:"none"});const i=document.createElement("div");Object.assign(i.style,{position:"absolute",inset:"0",width:"100%",height:"200%",willChange:"transform"}),v.appendChild(i);function T(){const t=document.createElement("div");Object.assign(t.style,{position:"relative",width:"100%",height:"50%",overflow:"hidden",background:"#0a0a0a"});const e=document.createElement("div");Object.assign(e.style,{position:"absolute",inset:"0",zIndex:"2",background:"#111 center/cover no-repeat",transition:"opacity 0.2s ease",opacity:"1",pointerEvents:"none"});const a=dt();return a.muted=!0,a.volume=0,a.style.zIndex="1",t.appendChild(a),t.appendChild(e),{el:t,video:a,poster:e,itemId:null,src:null}}const r=[T(),T()];i.appendChild(r[0].el),i.appendChild(r[1].el);const l={liveTv:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 8V6.5A1.5 1.5 0 019.5 5h5A1.5 1.5 0 0116 6.5V8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 4l2-2M17 4l-2-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',heart:'<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round" d="M24 41.5S6 30.2 6 17.8C6 12.1 10.6 8 15.4 8c3.1 0 5.9 1.5 7.6 3.9C24.7 9.5 27.5 8 30.6 8 35.4 8 40 12.1 40 17.8 40 30.2 24 41.5 24 41.5z"/></svg>',comment:'<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M24 4C12.4 4 3 12.8 3 23.5c0 3.9 1.1 7.5 3 10.7L3 44l10.8-2.8c2.9 1.6 6.2 2.5 10.2 2.5 11.6 0 21-8.8 21-19.5S35.6 4 24 4zm0 34.5c-3.2 0-6.2-.9-8.7-2.4l-.6-.4-6.4 1.7 1.7-6.2-.4-.6A16.2 16.2 0 016 23.5C6 14.4 14 7 24 7s18 7.4 18 16.5S34 38.5 24 38.5z"/><circle cx="16" cy="23.5" r="2.2"/><circle cx="24" cy="23.5" r="2.2"/><circle cx="32" cy="23.5" r="2.2"/></svg>',bookmark:'<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" d="M12 6h24v36l-12-8-12 8V6z"/></svg>',share:'<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M32 8l8 8-8 8M40 16H22c-8.8 0-16 7.2-16 16v4"/></svg>',search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',chevron:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',verified:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#20a4ff"/><path d="M7 12.5l3 3 7-7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3l9 8h-3v10h-5v-6H11v6H6V11H3l9-8z"/></svg>',friends:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2 20v-1.2c0-2.8 3.1-4.8 7-4.8s7 2 7 4.8V20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17.5" cy="9" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15 20v-.8c0-1.8 1.8-3.2 4.5-3.2.8 0 1.5.1 2.2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',messages:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M4 5h16a1 1 0 011 1v10a1 1 0 01-1 1H8l-4 3V6a1 1 0 011-1z"/></svg>',profile:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20v-1.5c0-3 3.1-5.5 7-5.5s7 2.5 7 5.5V20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',bluetooth:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.5 3.5L7 10h4l-3.5 3.5L7 17l7.5-7.5V21l5.5-5.5-4-4 4-4L14.5 3.5z"/></svg>',signal:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 22h2V10H2v12zm4 0h2V6H6v16zm4 0h2V2h-2v20zm4 0h2V8h-2v14zm4 0h2v-8h-2v8z"/></svg>',wifi:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 18.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4.95-2.12 1.41 1.41A5.98 5.98 0 0112 16.5c1.4 0 2.68.48 3.71 1.29l1.41-1.41A7.97 7.97 0 0012 14.5a8 8 0 00-5.32 2.02zm-2.83-2.83 1.41 1.41A9.96 9.96 0 0112 12.5c2.54 0 4.85.95 6.64 2.51l1.41-1.41A11.95 11.95 0 0012 10.5a12 12 0 00-8.13 3.17z"/></svg>',battery:'<svg viewBox="0 0 36 16" aria-hidden="true"><rect x="1" y="2" width="30" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3.5" y="4.5" width="22" height="7" rx="1.5" fill="currentColor"/><rect x="32" y="5.5" width="2.5" height="5" rx="1" fill="currentColor"/></svg>'},n=document.createElement("div");n.id="phone-ui",n.innerHTML=`
    <div class="phone-status">
      <span data-clock>9:41</span>
      <span class="phone-status-right">
        <span class="st-ico st-bt">${l.bluetooth}</span>
        <span class="st-ico">${l.wifi}</span>
        <span class="st-ico">${l.signal}</span>
        <span class="st-battery-wrap">
          <span class="st-ico st-bat">${l.battery}</span>
          <span class="st-battery-pct" data-battery>49</span>
        </span>
      </span>
    </div>
    <div class="tt-top">
      <div class="tt-live-wrap">
        <span class="tt-live-ico">${l.liveTv}</span>
        <span class="tt-live-txt">LIVE</span>
      </div>
      <div class="tt-tabs">
        <span>Comunidad</span>
        <span>Siguiendo</span>
        <span class="tt-tab-active">Para ti</span>
      </div>
      <div class="tt-search-top">${l.search}</div>
    </div>
    <div class="tt-emotion" data-emotion aria-hidden="true"></div>
    <div class="tt-rail">
      <div class="tt-avatar-wrap">
        <div class="tt-avatar" data-avatar></div>
        <div class="tt-follow">+</div>
      </div>
      <div class="tt-action"><div class="tt-ico">${l.heart}</div><div class="tt-count" data-likes>0</div></div>
      <div class="tt-action"><div class="tt-ico">${l.comment}</div><div class="tt-count" data-comments>0</div></div>
      <div class="tt-action"><div class="tt-ico">${l.bookmark}</div><div class="tt-count" data-saves>0</div></div>
      <div class="tt-action"><div class="tt-ico">${l.share}</div><div class="tt-count" data-shares>0</div></div>
      <div class="tt-disc" data-disc>
        <div class="tt-disc-ring"></div>
        <div class="tt-disc-core" data-disc-core></div>
      </div>
    </div>
    <div class="tt-subtitle" data-subtitle></div>
    <div class="tt-bottom">
      <div class="tt-author-row">
        <span class="tt-author" data-author>Latinus</span>
        <span class="tt-verified" data-verified>${l.verified}</span>
      </div>
      <div class="tt-caption" data-caption></div>
    </div>
    <div class="tt-search-pill">
      <span class="tt-search-pill-ico">${l.search}</span>
      <span class="tt-search-pill-txt" data-search-pill>Búsqueda · trends Colombia</span>
      <span class="tt-search-pill-chev">${l.chevron}</span>
    </div>
    <nav class="tt-nav">
      <div class="tt-nav-item tt-nav-active"><span class="tt-nav-ico">${l.home}</span><span>Inicio</span></div>
      <div class="tt-nav-item"><span class="tt-nav-ico">${l.friends}</span><span>Amigos</span></div>
      <div class="tt-nav-item tt-nav-create"><div class="tt-create-btn"><span></span></div></div>
      <div class="tt-nav-item"><span class="tt-nav-ico">${l.messages}</span><span>Mensajes</span><i class="tt-badge">8</i></div>
      <div class="tt-nav-item"><span class="tt-nav-ico">${l.profile}</span><span>Perfil</span></div>
    </nav>
  `,Object.assign(n.style,{position:"absolute",inset:"0",zIndex:"4",pointerEvents:"none"}),o.appendChild(n);const $=document.createElement("style");$.textContent=`
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

    #phone-ui .tt-subtitle {
      position: absolute; left: 50%; transform: translateX(-50%);
      bottom: calc(148px * var(--u)); max-width: calc(100% - 120px * var(--u));
      padding: calc(6px * var(--u)) calc(12px * var(--u)); border-radius: calc(6px * var(--u));
      background: rgba(0,0,0,.55); text-align: center;
      font: 500 calc(13px * var(--u))/1.35 system-ui, sans-serif;
      text-shadow: 0 1px 2px rgba(0,0,0,.4); z-index: 4;
      display: none;
    }
    #phone-ui .tt-subtitle:not(:empty) { display: block; }

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
  `,document.head.appendChild($),o.appendChild(v);const s={author:n.querySelector("[data-author]"),caption:n.querySelector("[data-caption]"),subtitle:n.querySelector("[data-subtitle]"),searchPill:n.querySelector("[data-search-pill]"),likes:n.querySelector("[data-likes]"),comments:n.querySelector("[data-comments]"),saves:n.querySelector("[data-saves]"),shares:n.querySelector("[data-shares]"),emotion:n.querySelector("[data-emotion]"),verified:n.querySelector("[data-verified]"),avatar:n.querySelector("[data-avatar]"),discCore:n.querySelector("[data-disc-core]"),clock:n.querySelector("[data-clock]"),battery:n.querySelector("[data-battery]")},X=new Set(["karolg","jbalvin","maluma","shakira","camilo","ferxxo44","gemelasabello2","karensevillano7","senadocolombia","nacionaloficial"]),j=["trends Colombia","Karol G nuevo","Liga BetPlay","Gemelas Abello","Maluma trend","Atl Nacional","Jeison Giraldo","Feid remix"];function B(){const t=new Date;s.clock.textContent=t.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}B(),setInterval(B,3e4);let I=!0,m=!1,x=!1,y=null,M=null,z=null,L=null,V=c[0],E=null;const g=document.createElement("div");g.id="tiktok-start",g.innerHTML="Toca para iniciar<span>Trends TikTok Colombia · loop infinito · NPC por catálogo</span>",o.appendChild(g);function _(t,e){const a=R(e),d=ft[e.catalogo]||"#111",u=a.avatar||Y(e.author);t.poster.style.opacity="1",t.poster.style.backgroundColor=d,a.thumbnail?(t.poster.style.backgroundImage=`url("${a.thumbnail}")`,t.poster.style.backgroundSize="cover"):u?(t.poster.style.backgroundImage=`linear-gradient(180deg, ${d}bb, ${d}), url("${u}")`,t.poster.style.backgroundSize="cover, 42%",t.poster.style.backgroundPosition="center, center 38%"):t.poster.style.backgroundImage="none"}function q(t){t.poster.style.opacity="0"}function w(t){if(t==null||t===""||t==="—")return"0";const e=String(t),a=e.match(/^([\d.]+)\s*K$/i);if(a){const u=parseFloat(a[1]);return u>=10?`${Math.round(u*10)/10} mil`.replace(".0 mil"," mil"):`${Math.round(u*1e3)}`}const d=e.match(/^([\d.]+)\s*M$/i);if(d){const u=parseFloat(d[1]);if(u>=1)return`${Math.round(u*10)/10} M`.replace(".0 M"," M")}return e}function J(t,e){return e.authorName||t.authorName||(t.author||"").replace(/^@/,"")||"TikTok"}function W(t){const e=(t||"").replace(/^@/,"").toLowerCase();return X.has(e)}function Q(t){if(!t)return"";const e=t.replace(/\s+/g," ").trim();if(e.length<=72)return e;const a=e.slice(0,72),d=a.lastIndexOf(" ");return`${(d>40?a.slice(0,d):a).trim()}…`}function Z(t){var C;const e=(t.author||"").replace(/^@/,""),a=j[Math.abs([...e].reduce((h,S)=>h+S.charCodeAt(0),0))%j.length];return`Búsqueda · ${((C=(t.texto||"").split(/\s+/).filter(h=>h.length>4)[0])==null?void 0:C.replace(/[^\wáéíóúñÁÉÍÓÚÑ#@]/g,""))||a||a}`}function b(t){const e=t.video;e.pause(),e.muted=!0,e.volume=0}function tt(t){r.forEach(e=>{e!==t&&b(e)})}async function O(t,{audible:e=!1}={}){tt(t);const a=t.video;a.muted=!e,a.volume=e?1:0;try{await a.play(),q(t)}catch{a.muted=!0,a.volume=0;try{await a.play(),q(t)}catch{}}}function et(t){b(t)}function k(t,e){_(t,e);const a=e.src||`./videos/${e.id}.mp4`;return(t.itemId!==e.id||t.src!==a)&&(t.itemId=e.id,t.src=a,b(t),t.video.src=a,t.video.load()),K(a),t}function A(t){const e=R(t),a=t.categoria||ct(t.catalogo),d=J(t,e),u=e.texto||t.texto||"";s.author.textContent=d;const C=u.length>85?`${u.slice(0,82).trim()} ...más`:u;s.caption.textContent=C,s.subtitle.textContent=Q(u),s.searchPill.textContent=Z(t),s.likes.textContent=w(t.likes),s.comments.textContent=w(t.comments),s.saves.textContent=w(t.saves),s.shares.textContent=w(t.shares),s.emotion.textContent=`${lt(t.catalogo)} → ${ut(a)}`,s.verified.classList.toggle("is-on",W(t.author||e.author));const h=e.avatar||Y(t.author)||e.thumbnail;if(h)s.avatar.style.backgroundColor="transparent",s.avatar.style.backgroundImage=`url("${h}")`,s.discCore.style.backgroundImage=`url("${h}")`;else{const S=[...t.author||""].reduce((nt,st)=>nt+st.charCodeAt(0),0)%360;s.avatar.style.backgroundImage="none",s.avatar.style.backgroundColor=`hsl(${S} 55% 42%)`,s.discCore.style.backgroundImage="none",s.discCore.style.backgroundColor=`hsl(${S} 55% 42%)`}}function H(t,e){V=t,A(t),L=t.id,typeof e=="function"&&e(t)}function at(){const t=r[0],e=r[1];i.appendChild(t.el),r[0]=e,r[1]=t,i.style.transition="none",i.style.transform="translateY(0)"}function P(t){r.forEach(e=>{e!==t&&(e.video.onended=null)}),t.video.onended=()=>{t!==r[0]||!m||typeof E=="function"&&E()}}function ot(t){!t||x||(k(r[1],t),et(r[1]),G([t]))}function rt(t,e={}){if(y=t,M=e,!m){A(t);return}x||F(t,e.onVisible)}function F(t,e){x=!0;const a=c.findIndex(u=>u.id===t.id),d=c[(a>=0?a+1:0)%c.length];if(G([t,d]),I){i.style.transition="none",i.style.transform="translateY(0)",k(r[0],t),P(r[0]),H(t,e),O(r[0],{audible:!0}),I=!1,x=!1,N();return}k(r[1],t),b(r[0]),i.style.transition="none",i.style.transform="translateY(0)",i.offsetHeight,i.style.transition="transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",i.style.transform="translateY(-50%)",setTimeout(()=>{b(r[0]),at(),P(r[0]),O(r[0],{audible:!0}),H(t,e),x=!1,N()},290)}function N(){if(!y||x||!m)return;const t=y,e=M||{};if(t.id===L&&!I){y=null;return}y=null,M=null,F(t,e.onVisible)}k(r[0],c[0]),k(r[1],c[1]||c[0]),r.forEach(b),A(c[0]),g.addEventListener("click",()=>{m=!0,g.remove(),z&&z()});function it(){r.forEach(t=>{t.video.pause(),t.video.removeAttribute("src")}),v.remove(),n.remove(),$.remove(),g.remove()}return{showVideo:rt,preload:ot,dispose:it,root:v,getCurrentItem:()=>V,onVideoEnded(t){E=t},whenUnlocked(t){z=t,m&&t()}}}export{gt as createFeedOverlay};
