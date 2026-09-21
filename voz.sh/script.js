(() => {
  const $ = id => document.getElementById(id);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let wanted = false, recognition = null, sending = false, restartTimer;
  const pending = [];
  const status = text => { $('status').textContent = text; };
  const buttons = () => { $('start').disabled = wanted; $('stop').disabled = !wanted; };
  async function flush() {
    if (sending || !pending.length) return;
    sending = true;
    try {
      while (pending.length) {
        const item = pending[0];
        $('delivery').textContent = `Enviando… ${pending.length} frase(s) pendiente(s).`;
        const response = await fetch('/api/voz', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id, text: item.text }), signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.entry?.id !== item.id) throw new Error('Respuesta inesperada');
        pending.shift();
        item.node.textContent = item.text + ' ✓ enviado';
      }
      $('delivery').textContent = 'Todas las frases enviadas para impresión.';
    } catch {
      $('delivery').textContent = `Sin conexión: ${pending.length} frase(s) pendiente(s). Reintentando; mantén esta página abierta.`;
    } finally { sending = false; }
  }
  function enqueue(text) {
    // API accepts up to 2000 characters; do not truncate long utterances.
    const characters = Array.from(text.trim());
    while (characters.length) {
      const chunk = characters.splice(0, 2000).join('');
      const node = document.createElement('p'); node.textContent = chunk + ' · pendiente';
      $('feed').append(node);
      pending.push({ id: crypto.randomUUID(), text: chunk, node });
    }
    flush();
  }
  function startRecognition() {
    if (!wanted) return;
    const current = new Recognition(); recognition = current;
    current.lang = 'es-CO'; current.continuous = true; current.interimResults = true;
    const finalized = new Set();
    current.onstart = () => status('Micrófono activo. Habla; haz una pausa entre frases.');
    current.onresult = event => {
      let draft = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          if (!finalized.has(i)) { finalized.add(i); enqueue(result[0].transcript); }
        } else draft += result[0].transcript + ' ';
      }
      $('interim').textContent = draft || '…';
    };
    current.onerror = event => {
      if (event.error === 'no-speech') return;
      wanted = false; buttons();
      const errors = {
        'not-allowed': 'Permite el micrófono en el navegador y vuelve a activarlo.',
        'audio-capture': 'No se detectó un micrófono disponible.',
        'network': 'El servicio de voz no responde. Revisa internet y vuelve a activar el micrófono.',
        'service-not-allowed': 'El navegador no permite reconocimiento de voz. Prueba en Chrome.'
      };
      status(errors[event.error] || `Reconocimiento detenido: ${event.error}. Vuelve a activar el micrófono.`);
    };
    current.onend = () => {
      if (recognition === current) recognition = null;
      if (wanted) { status('Reconectando micrófono…'); restartTimer = setTimeout(startRecognition, 750); }
    };
    try { current.start(); }
    catch { wanted = false; recognition = null; buttons(); status('No se pudo iniciar. Vuelve a activar el micrófono.'); }
  }
  if (!Recognition) {
    $('start').disabled = true;
    status('Este navegador no admite reconocimiento de voz. Abre esta página en Chrome.');
    return;
  }
  $('start').onclick = () => { wanted = true; buttons(); status('Solicitando micrófono…'); startRecognition(); };
  $('stop').onclick = () => {
    wanted = false; clearTimeout(restartTimer); recognition?.stop(); buttons();
    status('Micrófono detenido. Se enviarán las frases ya confirmadas.');
  };
  window.addEventListener('beforeunload', event => {
    if (pending.length) { event.preventDefault(); event.returnValue = ''; }
  });
  setInterval(flush, 3000);
})();
