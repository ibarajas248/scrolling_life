(() => {
  const graph = document.querySelector('.archive-subpages');
  const svg = graph.querySelector('.circuit-traces');
  const input = graph.querySelector('[data-input-link]');

  function connectInput() {
    const canvas = svg.getBoundingClientRect();
    if (!canvas.width || !canvas.height) return;
    const point = (node, side) => {
      const box = node.getBoundingClientRect();
      return {
        x: (box[side] - canvas.left) * 1200 / canvas.width,
        y: (box.top + box.height / 2 - canvas.top) * 560 / canvas.height,
      };
    };
    graph.querySelectorAll('[data-input-circuit]').forEach((path) => {
      const target = graph.querySelector(`.archive-node--${path.dataset.inputCircuit}`);
      const leftRoute = path.dataset.inputCircuit === 'a';
      const start = point(input, leftRoute ? 'left' : 'right');
      const end = point(target, leftRoute ? 'left' : 'right');
      // Route through the outer gutter so wires meet the side terminals
      // without passing through the other cards, including on mobile.
      const gutter = 10 * 1200 / canvas.width;
      const bend = leftRoute
        ? Math.max(gutter / 2, Math.min(start.x, end.x) - gutter)
        : Math.min(1200 - gutter / 2, Math.max(start.x, end.x) + gutter);
      path.setAttribute('d', `M${start.x} ${start.y} H${bend} V${end.y} H${end.x}`);
    });
  }

  const observer = new ResizeObserver(connectInput);
  observer.observe(graph);
  graph.querySelectorAll('.archive-node').forEach((node) => observer.observe(node));
  document.fonts.ready.then(connectInput);
  connectInput();
})();
