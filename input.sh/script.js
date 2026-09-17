(() => {
  const form = document.querySelector('#console-form');
  const input = document.querySelector('#input');
  const feed = document.querySelector('#feed');
  const status = document.querySelector('#status');
  const button = form.querySelector('button');
  const terminal = document.querySelector('#terminal-scroll');
  const latest = document.querySelector('#latest');
  let initialized = false;
  const atBottom = () => terminal.scrollHeight - terminal.clientHeight - terminal.scrollTop < 70;
  const toBottom = () => { terminal.scrollTop = terminal.scrollHeight; latest.hidden = true; };
  latest.addEventListener('click', toBottom);
  terminal.addEventListener('scroll', () => { latest.hidden = atBottom(); }, { passive: true });
  let pending = null, sending = false, requestVersion = 0, rendered = '';
  const timeFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  function render(entries) {
    const signature = entries.map(entry => entry.id).join(',');
    if (signature === rendered && feed.childNodes.length) return;
    const follow = !initialized || atBottom();
    const anchor = [...feed.children].find(node => node.dataset.id && node.getBoundingClientRect().bottom > terminal.getBoundingClientRect().top);
    const oldTop = anchor?.getBoundingClientRect().top;
    const nodes = [...entries].reverse().map(entry => {
      const article = document.createElement('article');
      article.className = 'entry';
      article.dataset.id = entry.id;
      const text = document.createElement('p');
      text.className = 'entry-text';
      text.textContent = entry.text;
      const prompt = document.createElement('p');
      prompt.className = 'prompt';
      const user = document.createElement('span');
      user.className = 'user'; user.textContent = 'anónimo@scrollinglife';
      const path = document.createElement('span');
      path.className = 'path'; path.textContent = ' ~/input.sh';
      const time = document.createElement('time');
      time.dateTime = entry.createdAt;
      time.textContent = timeFormat.format(new Date(entry.createdAt));
      prompt.append(user, path, time);
      article.append(prompt, text);
      return article;
    });
    if (!nodes.length) { const empty = document.createElement('p'); empty.className = 'entry muted'; empty.textContent = 'sin historial. escribe la primera línea.'; nodes.push(empty); }
    feed.replaceChildren(...nodes);
    rendered = signature;
    initialized = true;
    if (follow) toBottom();
    else if (anchor) {
      const replacement = [...feed.children].find(node => node.dataset.id === anchor.dataset.id);
      if (replacement) terminal.scrollTop += replacement.getBoundingClientRect().top - oldTop;
    }
    latest.hidden = atBottom();
  }
  async function refresh() {
    const version = ++requestVersion;
    try {
      const response = await fetch('/api/input', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (version !== requestVersion) return;
      render(data.entries);
      if (!sending) status.textContent = 'consola conectada';
    } catch { if (version === requestVersion && !sending) status.textContent = 'sin conexión. tu texto permanece aquí; volveremos a intentar.'; }
  }
  input.addEventListener('input', () => {
    const follow = atBottom();
    document.querySelector('#count').textContent = `${input.value.length} / 2000`;
    input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`;
    if (follow) toBottom();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const text = input.value.trim();
    if (sending || !text) return;
    if (!pending || pending.text !== text) pending = { id: crypto.randomUUID(), text };
    sending = true; button.disabled = true; input.readOnly = true; status.textContent = 'guardando…';
    ++requestVersion;
    try {
      const response = await fetch('/api/input', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending), signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar.');
      pending = null; input.value = ''; input.dispatchEvent(new Event('input'));
      await refresh(); toBottom(); status.textContent = 'línea guardada';
    } catch (error) { status.textContent = `${error.message} Tu texto sigue aquí. Puedes reintentar.`; }
    finally { sending = false; button.disabled = false; input.readOnly = false; input.focus({ preventScroll: true }); }
  });
  refresh();
  setInterval(() => { if (!document.hidden && !sending) refresh(); }, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !sending) refresh(); });
})();
