(() => {
  'use strict';

  const assets = window.SPAM_ASSETS;
  const $ = (selector) => document.querySelector(selector);
  const stage = $('#popup-stage');
  const layer = $('#windows');
  const windows = new Map();
  const launched = new Set();
  const completed = new Set();
  const audioCache = new Map();
  const voices = new Set();
  const initialDelay = 1800;
  let elapsed = 0;
  let lastTick = performance.now();
  let nextSpam = Infinity;
  let serial = 0;
  let topZ = 0;
  let interactions = 0;
  let epoch = 0;
  let mode = 'running';
  let soundEnabled = false;
  let soundChosen = false;
  let audioContext;
  let bag = [];
  let finalVideo;
  let videoWasPlaying = false;
  const narrow = () => stage.clientWidth < 600;

  function icon(name) {
    const img = document.createElement('img');
    img.src = `./icons/${name}.svg`;
    img.alt = '';
    img.draggable = false;
    return img;
  }

  function button(label, iconName, action, className = 'raised window-control') {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    node.title = label;
    node.setAttribute('aria-label', label);
    if (iconName) node.append(icon(iconName));
    else node.textContent = label;
    node.addEventListener('click', action);
    return node;
  }

  function stopSounds() {
    voices.forEach((voice) => { try { voice.stop(); } catch { /* Already ended. */ } });
    voices.clear();
  }

  async function setSound(enabled) {
    soundChosen = true;
    soundEnabled = enabled;
    if (enabled) {
      try {
        audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
      } catch {
        soundEnabled = false;
        $('#status').textContent = 'El sonido no esta disponible en este navegador.';
      }
    } else stopSounds();
    if (finalVideo) finalVideo.muted = !soundEnabled;
    const label = soundEnabled ? 'Silenciar' : 'Activar sonido';
    $('#sound').title = label;
    $('#sound').setAttribute('aria-label', label);
    $('#sound').setAttribute('aria-pressed', String(soundEnabled));
    $('#sound').replaceChildren(icon(soundEnabled ? 'volume-2' : 'volume-x'));
  }

  async function playSound(path) {
    if (!path || !soundEnabled || !audioContext || mode !== 'running' || document.hidden) return;
    const requestEpoch = epoch;
    try {
      if (!audioCache.has(path)) {
        audioCache.set(path, fetch(path).then((response) => {
          if (!response.ok) throw new Error('Audio unavailable');
          return response.arrayBuffer();
        }).then((buffer) => audioContext.decodeAudioData(buffer)));
      }
      const buffer = await audioCache.get(path);
      if (!soundEnabled || mode !== 'running' || requestEpoch !== epoch || document.hidden) return;
      if (voices.size >= 6) voices.values().next().value.stop();
      const voice = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      gain.gain.value = 0.24;
      voice.buffer = buffer;
      voice.connect(gain).connect(audioContext.destination);
      voices.add(voice);
      voice.onended = () => { voices.delete(voice); voice.disconnect(); gain.disconnect(); };
      voice.start();
    } catch {
      audioCache.delete(path);
    }
  }

  function focusWindow(record, keyboard = false) {
    if (!record || !windows.has(record.id)) return;
    record.node.hidden = false;
    record.node.style.zIndex = String(++topZ);
    windows.forEach((other) => {
      other.node.classList.toggle('is-active', other === record);
      other.tab.setAttribute('aria-pressed', String(other === record));
    });
    if (keyboard) record.node.querySelector('button, a, video')?.focus({ preventScroll: true });
  }

  function updateCount() {
    $('#window-count').textContent = String(windows.size).padStart(2, '0');
  }

  function removeWindow(record) {
    const hadFocus = record.node.contains(document.activeElement);
    record.node.remove();
    record.tab.remove();
    windows.delete(record.id);
    updateCount();
    if (hadFocus) $('#session').focus({ preventScroll: true });
  }

  function positionWindow(record, near) {
    // Layout dimensions stay stable while the arrival animation is scaled.
    const rect = { width: record.node.offsetWidth, height: record.node.offsetHeight };
    const maxX = Math.max(6, stage.clientWidth - rect.width - 6);
    const maxY = Math.max(6, stage.clientHeight - rect.height - 6);
    let x = near ? near.x + 24 : 12 + Math.random() * Math.max(0, maxX - 20);
    let y = near ? near.y + 24 : 38 + Math.random() * Math.max(0, maxY - 45);
    if (record.kind === 'final') {
      x = (stage.clientWidth - rect.width) / 2;
      y = (stage.clientHeight - rect.height) / 2;
    } else if (record.cluster === 'C1' && record.step === 0) {
      x = stage.clientWidth * .2;
      y = stage.clientHeight * .16;
    }
    record.node.style.left = `${Math.max(6, Math.min(maxX, x))}px`;
    record.node.style.top = `${Math.max(6, Math.min(maxY, y))}px`;
  }

  function makeDraggable(record, handle) {
    let drag;
    handle.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button') || record.node.classList.contains('is-maximized') || event.button !== 0) return;
      const rect = record.node.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      handle.setPointerCapture(event.pointerId);
      focusWindow(record);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag) return;
      record.node.style.left = `${Math.max(0, Math.min(stage.clientWidth - record.node.offsetWidth, event.clientX - drag.x))}px`;
      record.node.style.top = `${Math.max(0, Math.min(stage.clientHeight - record.node.offsetHeight, event.clientY - drag.y))}px`;
    });
    const endDrag = () => { drag = null; };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', endDrag);
  }

  function createWindow(item, options = {}) {
    const limit = narrow() ? 12 : 24;
    if (windows.size >= limit) {
      const oldest = [...windows.values()].find((record) => record.kind === 'random' && !record.node.contains(document.activeElement));
      if (oldest) removeWindow(oldest);
      else if (!options.cluster && options.kind !== 'final') return null;
    }
    const record = { id: `popup-${++serial}`, item, kind: 'random', step: 0, ...options };
    if (record.kind !== 'final') stage.dataset.phase = 'invasion';
    const node = document.createElement('section');
    record.node = node;
    node.id = record.id;
    node.className = `art-window is-new${record.kind === 'final' ? ' is-final' : ''}`;
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-labelledby', `${record.id}-title`);
    if (record.cluster) { node.dataset.cluster = record.cluster; node.dataset.step = record.step; }
    node.dataset.asset = item.id || item.title;
    const naturalWidth = Math.min(item.width || 400, 490);
    const maxHeight = stage.clientHeight - 125;
    const scaledWidth = item.height ? Math.min(naturalWidth, maxHeight * item.width / item.height) : naturalWidth;
    const width = record.kind === 'final' ? 760 : Math.max(200, scaledWidth);
    node.style.width = `${Math.min(width + 8, stage.clientWidth - 18)}px`;

    const titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    const title = document.createElement('span');
    title.id = `${record.id}-title`;
    title.className = 'window-title';
    title.textContent = item.title;
    const controls = document.createElement('div');
    controls.className = 'window-controls';
    controls.append(
      button('Minimizar', 'minus', () => { node.hidden = true; $('#session').focus(); }),
      button('Maximizar / restaurar', 'square', () => node.classList.toggle('is-maximized')),
      button('Cerrar', 'x', () => record.kind === 'final' ? closeFinal(record) : activate(record))
    );
    titlebar.append(icon(record.kind === 'final' ? 'file-text' : 'app-window'), title, controls);
    const body = document.createElement('div');
    body.className = 'window-body';
    node.append(titlebar, body);

    if (item.src && record.kind !== 'final') {
      const art = document.createElement('button');
      art.type = 'button';
      art.className = 'artwork-button';
      art.setAttribute('aria-label', `Abrir ${item.title}`);
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = item.title;
      image.width = item.width;
      image.height = item.height;
      image.draggable = false;
      image.addEventListener('error', () => { image.alt = `${item.title} - archivo no disponible`; });
      art.append(image);
      art.addEventListener('click', () => activate(record));
      body.append(art);
    } else if (item.url) {
      body.append(linkContent(item, record));
    }

    const status = document.createElement('div');
    status.className = 'window-status sunken';
    const message = document.createElement('span');
    message.textContent = record.kind === 'final' ? 'AAAAAAAAAAAA.txt' : item.url ? 'Internet' : 'Listo';
    const connection = document.createElement('span');
    connection.className = 'connection';
    connection.textContent = record.kind === 'final' ? 'Fin' : '56 Kbps';
    status.append(message, connection);
    node.append(status);
    const tab = button(item.title, 'app-window', () => {
      setMenu(false);
      focusWindow(record, true);
    }, 'window-tab');
    const tabTitle = document.createElement('span');
    tabTitle.textContent = item.title;
    tab.append(tabTitle);
    record.tab = tab;
    $('#window-tabs').append(tab);
    windows.set(record.id, record);
    layer.append(node);
    node.addEventListener('pointerdown', () => focusWindow(record));
    node.addEventListener('focusin', () => focusWindow(record));
    node.addEventListener('animationend', () => node.classList.remove('is-new'), { once: true });
    makeDraggable(record, titlebar);
    focusWindow(record);
    positionWindow(record, options.near);
    updateCount();
    playSound(item.audio);
    return record;
  }

  function linkContent(item, record) {
    const content = document.createElement('div');
    content.className = 'link-page';
    const heading = document.createElement('p');
    heading.textContent = 'Conexion establecida.';
    const address = document.createElement('p');
    address.className = 'link-address';
    address.textContent = item.url;
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const link = document.createElement('a');
    link.className = 'raised';
    link.textContent = 'Abrir enlace';
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.addEventListener('click', () => activate(record));
    actions.append(button('Continuar', null, () => activate(record), 'raised'), link);
    content.append(icon('globe'), heading, address, actions);
    return content;
  }

  function nextCluster() {
    // Only a completed folder can release the next root in the manifest.
    if (mode !== 'running' || launched.size !== completed.size) return;
    const cluster = assets.clusters[completed.size];
    if (!cluster) return;
    launched.add(cluster.id);
    if (cluster.id === 'C3') {
      nextSpam = elapsed + 3200;
      $('[data-command="inbox"]').disabled = false;
    }
    return createWindow(cluster.steps[0], { kind: 'cluster', cluster: cluster.id, step: 0 });
  }

  function randomItem() {
    if (!bag.length) {
      bag = [...assets.random];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function spawnRandom(near) {
    if (mode === 'running' && launched.has('C3')) createWindow(randomItem(), { near });
  }

  function activate(record) {
    if (mode !== 'running' || !windows.has(record.id)) return;
    const keyboard = record.node.contains(document.activeElement);
    const near = { x: record.node.offsetLeft, y: record.node.offsetTop };
    const item = record.item;
    playSound(item.audio);
    interactions++;
    removeWindow(record);
    let next;
    if (record.cluster) {
      const cluster = assets.clusters.find((entry) => entry.id === record.cluster);
      const step = record.step + 1;
      if (step < cluster.steps.length) {
        next = createWindow(cluster.steps[step], { kind: 'cluster', cluster: record.cluster, step, near });
      } else {
        completed.add(record.cluster);
        if (completed.size === assets.clusters.length) return finish();
        next = nextCluster();
      }
    } else if (item.links?.length) {
      next = createWindow(item.links[0], { kind: 'link', near });
    }
    spawnRandom(next ? undefined : near);
    if (interactions % 2 === 0) spawnRandom();
    if (next) focusWindow(next, keyboard);
  }

  function finish() {
    if (mode === 'finished') return;
    mode = 'finished';
    stage.dataset.phase = 'final';
    epoch++;
    stopSounds();
    [...windows.values()].forEach(removeWindow);
    $('#paused').hidden = true;
    $('#pause').disabled = true;
    $('[data-command="inbox"]').disabled = true;
    $('#pause').setAttribute('aria-pressed', 'false');
    const record = createWindow({ title: 'AAAAAAAAAAAA.txt - Bloc de notas' }, { kind: 'final' });
    const body = record.node.querySelector('.window-body');
    // The supplied film already contains the Notepad writing and menu.
    const video = document.createElement('video');
    video.className = 'notepad-video';
    video.src = assets.final.src;
    video.poster = assets.final.poster;
    video.controls = true;
    video.playsInline = true;
    video.muted = !soundEnabled;
    video.setAttribute('aria-label', 'Notepad final original de Carmen y Javi');
    finalVideo = video;
    const footer = document.createElement('div');
    footer.className = 'notepad-footer';
    const back = document.createElement('a');
    back.href = '../ruido/';
    back.className = 'raised';
    back.textContent = 'Salir';
    footer.append(button('Reiniciar', null, restart, 'raised'), back);
    body.append(video, footer);
    video.addEventListener('error', () => {
      const fallback = document.createElement('a');
      fallback.href = assets.final.original;
      fallback.textContent = 'Abrir el Notepad original';
      body.append(fallback);
    }, { once: true });
    positionWindow(record);
    focusWindow(record, true);
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => { /* Native controls remain available. */ });
    });
    $('#status').textContent = 'Fin de la sesion. AAAAAAAAAAAA.txt, Bloc de notas.';
  }

  function closeFinal(record) {
    finalVideo?.pause();
    record.node.hidden = true;
    $('#session').focus();
  }

  function restart() {
    finalVideo?.pause();
    finalVideo = null;
    epoch++;
    stopSounds();
    [...windows.values()].forEach(removeWindow);
    launched.clear();
    completed.clear();
    elapsed = 0;
    interactions = 0;
    nextSpam = Infinity;
    topZ = 0;
    bag = [];
    mode = 'running';
    stage.dataset.phase = 'inicio';
    lastTick = performance.now();
    $('#pause').disabled = false;
    $('[data-command="inbox"]').disabled = true;
    updatePause();
    $('#status').textContent = 'Nueva sesion.';
  }

  function updatePause() {
    const paused = mode === 'paused';
    $('#paused').hidden = !paused;
    const label = paused ? 'Continuar' : 'Pausar';
    $('#pause').setAttribute('aria-label', label);
    $('#pause').title = label;
    $('#pause').setAttribute('aria-pressed', String(paused));
    $('#pause').replaceChildren(icon(paused ? 'play' : 'pause'));
  }

  function togglePause() {
    if (mode === 'finished') return;
    mode = mode === 'paused' ? 'running' : 'paused';
    if (mode === 'paused') { epoch++; stopSounds(); }
    lastTick = performance.now();
    updatePause();
  }

  function setMenu(open) {
    $('#start-menu').hidden = !open;
    $('#start').setAttribute('aria-expanded', String(open));
  }

  function inbox(amount = 3) {
    if (mode !== 'running') return;
    for (let i = 0; i < amount; i++) spawnRandom();
  }

  $('#start').addEventListener('click', () => setMenu($('#start-menu').hidden));
  $('#sound').addEventListener('click', () => setSound(!soundEnabled));
  $('#pause').addEventListener('click', togglePause);
  $('#session').addEventListener('click', () => {
    const records = [...windows.values()];
    focusWindow(records.find((record) => record.node.hidden) || records.at(-1), true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!soundChosen && !event.target.closest('#sound')) setSound(true);
    if (!event.target.closest('#start, #start-menu')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (!soundChosen && ['Enter', ' '].includes(event.key) && !event.target.closest('#sound')) setSound(true);
    if (event.key === 'Escape') {
      if (!$('#start-menu').hidden) { setMenu(false); $('#start').focus(); }
      else togglePause();
    }
  });
  document.querySelectorAll('[data-command]').forEach((node) => node.addEventListener('click', () => {
    setMenu(false);
    if (node.dataset.command === 'restart') restart();
    else if (node.dataset.command === 'finish') finish();
    else inbox();
  }));

  window.addEventListener('resize', () => windows.forEach((record) => {
    if (record.node.classList.contains('is-maximized')) return;
    const wasHidden = record.node.hidden;
    record.node.hidden = false;
    positionWindow(record, { x: record.node.offsetLeft - 24, y: record.node.offsetTop - 24 });
    record.node.hidden = wasHidden;
  }));
  document.addEventListener('visibilitychange', () => {
    lastTick = performance.now();
    if (document.hidden) {
      epoch++;
      stopSounds();
      videoWasPlaying = finalVideo && !finalVideo.paused;
      finalVideo?.pause();
    } else if (videoWasPlaying) finalVideo?.play().catch(() => {});
  });
  window.addEventListener('pagehide', () => { epoch++; stopSounds(); finalVideo?.pause(); });

  setInterval(() => {
    const now = performance.now();
    const delta = Math.min(now - lastTick, 1000);
    lastTick = now;
    if (mode !== 'running' || document.hidden || !$('#start-menu').hidden) return;
    elapsed += delta;
    if (!launched.size && elapsed >= initialDelay) nextCluster();
    if (launched.has('C3') && elapsed >= nextSpam) {
      spawnRandom();
      const minimum = narrow() ? 1800 : 1100;
      nextSpam = elapsed + Math.max(minimum, 4800 - elapsed / 70 - interactions * 85) + Math.random() * 700;
    }
  }, 250);
})();
