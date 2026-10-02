(() => {
  'use strict';
  const endpoint = 'https://radio.scrollinglife.com/api/latencia-event';
  const visuals = 'https://radio.scrollinglife.com/visuales';
  const liveMix = 'https://radio.scrollinglife.com/api/live-mix.mp3';
  let layer = null, phase = 'idle', visualAt = null, hadEventLayer = false, accessGranted = false, eventAudio = null;
  const pad = n => String(n).padStart(2, '0');
  const left = () => Math.max(0, new Date(visualAt).getTime() - Date.now());
  const format = ms => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; };
  const stopEventAudio = () => { if (!eventAudio) return; eventAudio.pause(); eventAudio.removeAttribute('src'); eventAudio.load(); eventAudio = null; };
  const startEventAudio = () => {
    stopEventAudio();
    eventAudio = new Audio(liveMix);
    eventAudio.preload = 'auto';
    eventAudio.playsInline = true;
    eventAudio.play().catch(() => {});
  };
  const remove = () => { stopEventAudio(); layer?.remove(); layer = null; };
  const render = () => {
    if (phase === 'idle' || phase === 'home') {
      if (hadEventLayer && phase === 'idle') { window.location.reload(); return; }
      return remove();
    }
    hadEventLayer = true;
    if (!layer) { layer = document.createElement('main'); layer.className = 'latencia-layer'; document.body.append(layer); }
    if (phase === 'countdown') { layer.classList.remove('is-live'); layer.innerHTML = `<section class="latencia-card"><p>SCROLLING LIFE</p><h1>LATENCIA</h1><h2>Deriva sonora · sesión de escucha</h2><div class="latencia-terminal"><span>&gt;</span><span>Iniciando transmisión en</span><strong data-latencia-clock>${format(left())}</strong></div><b>scrollinglife.com</b></section>`; }
    if (phase === 'visuals' && !layer.classList.contains('is-live') && !layer.classList.contains('is-form')) {
      if (accessGranted) showVisuals(); else showAccessForm();
    }
  };
  const showVisuals = () => { layer.classList.add('is-live'); layer.classList.remove('is-form'); layer.replaceChildren(Object.assign(document.createElement('iframe'), { src: visuals, title: 'Latencia · visuales en vivo', allow: 'autoplay; fullscreen' })); };
  const showAccessForm = () => {
    layer.classList.add('is-form');
    layer.innerHTML = `<section class="latencia-access"><p>SCROLLING LIFE · LATENCIA</p><h1>Registro</h1><form><label>Nombre<input name="firstName" autocomplete="given-name" required></label><label>Apellido<input name="lastName" autocomplete="family-name" required></label><label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label><button>Ingresar a visuales</button><small>Estos datos se usan para registrar la asistencia de la sesión.</small></form></section>`;
    layer.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); startEventAudio(); const data = Object.fromEntries(new FormData(event.currentTarget));
      const details = { firstName: String(data.firstName).trim(), lastName: String(data.lastName).trim(), email: String(data.email).trim().toLowerCase(), source: 'latencia' };
      const payload = { eventType: 'latencia_access', eventTime: new Date().toISOString(), visitorId: crypto.randomUUID?.() || `${Date.now()}visitor`, sessionId: crypto.randomUUID?.() || `${Date.now()}session`, url: location.href, title: document.title, details };
      try { if (window.ScrollingLifeTrack) window.ScrollingLifeTrack('latencia_access', details); else await fetch('/traffic/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }); } catch {}
      accessGranted = true; showVisuals();
    });
  };
  async function sync() { try { const r = await fetch(endpoint, { cache: 'no-store' }); if (!r.ok) return; const data = await r.json(); phase = data.phase || 'idle'; visualAt = data.event?.visualAt; render(); } catch {} }
  setInterval(() => { const clock = layer?.querySelector('[data-latencia-clock]'); if (clock && phase === 'countdown') clock.textContent = format(left()); }, 250);
  window.addEventListener('pagehide', stopEventAudio);
  sync(); setInterval(sync, 2000);
})();
