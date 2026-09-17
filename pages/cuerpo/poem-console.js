(() => {
  const poem = document.querySelector('.cuerpo-poem, .archivo-poem, .ruido-poem');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!poem || reduced.matches) return;

  const text = poem.textContent;
  const accessible = document.createElement('span');
  accessible.className = 'sr-only';
  accessible.textContent = text;
  const visual = document.createElement('span');
  visual.setAttribute('aria-hidden', 'true');
  const typed = document.createElement('span');
  typed.className = 'poem-typing';
  const pending = document.createElement('span');
  pending.className = 'poem-pending';
  pending.textContent = text;
  visual.append(typed, pending);
  poem.replaceChildren(accessible, visual);

  let position = 0;
  let timer;
  let finished = false;

  function finish() {
    finished = true;
    clearTimeout(timer);
    typed.textContent = text;
    typed.classList.remove('poem-typing');
    pending.remove();
    removeEventListener('scroll', resume);
    document.removeEventListener('visibilitychange', resume);
    reduced.removeEventListener('change', finish);
  }

  function write() {
    timer = undefined;
    if (finished || document.hidden) return;
    // Wait for the reader to scroll to the next lines, without moving the page.
    const line = document.createRange();
    line.selectNodeContents(typed);
    line.collapse(false);
    const cursor = line.getBoundingClientRect();
    if (cursor.top > innerHeight - 48) return;
    const start = position;
    position++;
    // Indentation is layout, not keystrokes: reveal it in a single update.
    while (position < text.length && /\s/.test(text[position])) position++;
    typed.textContent = text.slice(0, position);
    pending.textContent = text.slice(position);
    if (position >= text.length) { finish(); return; }
    const lineBreak = text.slice(start, position).includes('\n');
    timer = setTimeout(write, lineBreak ? 180 : 26);
  }

  function resume() {
    if (!finished && !timer && !document.hidden) timer = setTimeout(write, 80);
  }

  addEventListener('scroll', resume, { passive: true });
  document.addEventListener('visibilitychange', resume);
  reduced.addEventListener('change', finish);
  timer = setTimeout(write, 400);
})();
