(() => {
  const field = document.querySelector('.noise-graph');
  const canvas = field.querySelector('.ascii-field');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, frame = 0, last = 0, visible = true;
  let links = [];
  const cellX = 7, cellY = 10;
  function measure() {
    const bounds = field.getBoundingClientRect();
    width = bounds.width; height = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    links = [...field.querySelectorAll('.ascii-node')].map(node => {
      const r = node.getBoundingClientRect();
      const left = r.left - bounds.left < width / 2;
      return { x: (left ? r.right : r.left) - bounds.left, y: r.top - bounds.top + r.height / 2, left };
    });
    draw(0);
  }
  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const points = new Map();
    const phase = reduced.matches ? 0 : time * .00012;
    const cx = width / 2, cy = height / 2;
    function glyph(x, y, char, strength) {
      const col = Math.round(x / cellX), row = Math.round(y / cellY);
      if (col < 1 || row < 1 || col * cellX > width - 7 || row * cellY > height - 7) return;
      if (Math.abs(col * cellX - cx) < 80 && Math.abs(row * cellY - cy) < 36) return;
      const key = col + ':' + row;
      if (!points.has(key) || points.get(key).strength < strength) points.set(key, { x: col * cellX, y: row * cellY, char, strength });
    }
    // Magnetic field contours, rendered entirely as individual ASCII glyphs.
    for (let ring = 0; ring < 30; ring++) {
      const u = ring / 29;
      const rx = width * (.13 + .32 * u);
      const ry = height * (.09 + .34 * u);
      for (let step = 0; step < 210; step++) {
        const a = step / 210 * Math.PI * 2;
        const drift = Math.sin(a * 5 + phase + ring * .24) * 1.5;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry * (.42 + .58 * Math.abs(Math.cos(a))) + drift;
        const light = .24 + .52 * (1 - u) + .12 * Math.sin(step * .2 + phase);
        glyph(x, y, (step + ring) % 19 === 0 ? '+' : (step + ring) % 5 === 0 ? ':' : '.', light);
      }
    }
    for (let row = 2; row < height / cellY - 2; row++) {
      for (let band = -2; band <= 2; band++) {
        glyph(cx + band * cellX * 2, row * cellY, (row + band) % 4 === 0 ? '#' : ':', .25 + .25 * Math.sin(row * .3 + phase) ** 2);
      }
    }
    links.forEach((end, index) => {
      const startX = cx + (end.left ? -1 : 1) * width * .15;
      const startY = cy + (end.y < cy ? -1 : 1) * height * .09;
      for (let step = 0; step <= 90; step++) {
        const t = step / 90, ease = t * t * (3 - 2 * t);
        const x = startX + (end.x - startX) * t;
        const y = startY + (end.y - startY) * ease;
        const braid = Math.sin(t * 30 + phase + index) * 5;
        glyph(x, y + braid, ':', .85);
        glyph(x, y - braid, '.', .6);
      }
      glyph(end.x, end.y, '+', 1);
    });
    for (const p of points.values()) {
      ctx.fillStyle = `rgba(164, 241, 146, ${Math.max(.12, p.strength)})`;
      ctx.fillText(p.char, p.x, p.y);
    }
  }
  function tick(time) {
    if (visible && !document.hidden && !reduced.matches && time - last >= 100) { draw(time); last = time; }
    frame = requestAnimationFrame(tick);
  }
  const resize = new ResizeObserver(measure); resize.observe(field);
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); observer.observe(field);
  reduced.addEventListener('change', () => draw(0));
  document.fonts.ready.then(measure);
  measure(); frame = requestAnimationFrame(tick);
  addEventListener('pagehide', () => cancelAnimationFrame(frame));
  addEventListener('pageshow', event => { if (event.persisted) frame = requestAnimationFrame(tick); });
})();
