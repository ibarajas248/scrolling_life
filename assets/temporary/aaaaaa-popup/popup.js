/* Temporary home overlay for AAAA.txt. Kept isolated from the regular home scripts. */
(() => {
  const works = [
    {
      title: 'Libertinaje y desorden',
      author: 'Carlos Correa',
      year: 'ca. 1960',
      image: 'hs39.png',
      details: 'Carlos Correa (1912-1985) / Taller de grabado La Estampa, ca. 1960. Aguafuerte, punta seca y buril; 38 x 56 cm. Reg. 5777. Donado por la Asociación de Amigos del Museo Nacional de Colombia (27.1.2006).',
    },
    { title: 'La nueva bandera colombiana y sus autores', author: 'Augusto Rendón Sierra', year: '1972', image: 'hs40.png' },
    { title: 'La muerte de un desconocido', author: 'Pedro Alcántara Herrán Martínez', year: '1973', image: 'hs41.png' },
    { title: 'Gran Pisco No. 2', author: 'Luis Paz', year: '1978', image: 'hs42.png' },
    { title: 'La cosecha de los violentos', author: 'Alfonso Quijano Acero', year: '1968', image: 'hs43.jpg' },
    { title: 'El juicio', author: 'Carlos Granada Arango', year: '1972', image: 'hs44.png' },
    { title: 'Espacios vecinos', author: 'Umberto Giangrandi', year: '1968', image: 'hs45.png' },
    { title: 'La séptima papeleta', author: 'Documento histórico', year: '1990', image: 'hs07.png' },
    { title: 'Cartas desde la cárcel', author: 'Diana Navarro', year: '2002', image: 'hs33.png' },
    { title: 'Marcha de la ciudadanía plena LGBT', author: 'Germán Humberto Rincón Perfetti', year: '2004', image: 'hs34.png' },
    { title: 'Camiseta Museo Q', author: 'Fabricante desconocido', year: '2016', image: 'hs35.png' },
  ];

  const basePath = './assets/temporary/aaaaaa-popup/obras/';
  const maxWindows = 45;
  let createdWindows = 0;

  const removeWindow = (node) => {
    node.classList.add('is-closing');
    window.setTimeout(() => node.remove(), 180);
  };

  const spawnWindow = (layer, selectedWork) => {
    if (createdWindows >= maxWindows) return;

    const work = selectedWork || works[Math.floor(Math.random() * works.length)];
    const details = work.details || `${work.author}<br>${work.year}`;
    createdWindows += 1;
    const node = document.createElement('aside');
    const width = Math.min(window.innerWidth - 16, 280 + Math.floor(Math.random() * 220));
    const left = Math.max(4, Math.floor(Math.random() * Math.max(1, window.innerWidth - width - 8)));
    const top = Math.max(4, Math.floor(Math.random() * Math.max(1, window.innerHeight - 195)));
    node.className = 'aaaaaa-spam-popup aaaaaa-spam-popup--flood';
    node.style.cssText = `width:${width}px;left:${left}px;top:${top}px;z-index:${10010 + createdWindows};`;
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-label', `Referencia abierta: ${work.title}`);
    node.innerHTML = `
      <div class="aaaaaa-spam-popup__bar">
        <span>PELIGRO OBRA CENSURADA</span>
        <button class="aaaaaa-spam-popup__close" type="button" aria-label="Cerrar ${work.title}">×</button>
      </div>
      <div class="aaaaaa-spam-popup__mini-content">
        <img src="${basePath}${work.image}" alt="${work.title}" />
        <p><strong>${work.title}</strong>${details}</p>
      </div>
      <div class="aaaaaa-spam-popup__mini-actions"><button class="aaaaaa-spam-popup__accept" type="button">Aceptar</button></div>
    `;
    node.querySelector('.aaaaaa-spam-popup__close').addEventListener('click', () => removeWindow(node));
    node.querySelector('.aaaaaa-spam-popup__accept').addEventListener('click', () => {
      const accept = node.querySelector('.aaaaaa-spam-popup__accept');
      if (accept.disabled) return;

      accept.disabled = true;
      accept.textContent = 'Abriendo...';
      window.setTimeout(() => removeWindow(node), 80);
      for (let index = 0; index < 3; index += 1) {
        window.setTimeout(() => spawnWindow(layer), 100 + (index * 140));
      }
    });
    layer.append(node);
  };

  const startInvasion = () => {
    if (document.querySelector('.aaaaaa-spam-popup__layer')) return;

    const layer = document.createElement('div');
    layer.className = 'aaaaaa-spam-popup__layer';
    document.body.append(layer);

    for (let index = 0; index < 3; index += 1) {
      const work = index === 0 ? works[0] : undefined;
      window.setTimeout(() => spawnWindow(layer, work), 120 + (index * 150));
    }
  };

  window.setTimeout(startInvasion, 900);
})();
