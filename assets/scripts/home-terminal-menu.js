(() => {
  const markup = "    <details class=\"site-menu\" aria-label=\"Otras salas\">\n      <summary aria-controls=\"site-menu-panel\" aria-expanded=\"false\">\n        <span class=\"site-menu-label\">menú </span>\n      </summary>\n      <nav class=\"site-menu-panel\" id=\"site-menu-panel\" aria-label=\"Otras salas\">\n        <p class=\"site-menu-caption\">SCROLLING LIFE :: NAVEGACIÓN</p>\n        <div class=\"site-menu-links\">\n          <div class=\"submenu-container\">\n            <a class=\"site-menu-link\" href=\"/pages/infinito/\"><span>Infinito</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"https://thescrollingdrawing.scrollinglife.com/\" target=\"_blank\" rel=\"noopener\"><span>The Scrolling Drawing</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/logic-dream/\"><span>The Logic Dream</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/manifiesto-escrolleo/\"><span>Manifiesto Escrolleo</span></a>\n          </div>\n          <div class=\"submenu-container\">\n            <a class=\"site-menu-link\" href=\"/pages/pausa/\"><span>Pausa</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/pausa/in-case-you-come-back/intro.html\"><span>In Case You Come Back</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/pausa/ascii/\"><span>ASCII</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/el-ojo/\"><span>El ojo que todo lo ve</span></a>\n          </div>\n          <div class=\"submenu-container\">\n            <a class=\"site-menu-link\" href=\"/pages/ruido/\"><span>Ruido</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/ruido/ecos/\"><span>Ecos</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/ruido/mosquito-caos/\"><span>Caos</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/aaaaaa/\"><span>aaaaaa.txt</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/consulta-imagenes/\"><span>maquina-aprendiendo</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/lluvia_imagenes2/\"><span>Ruido</span></a>\n          </div>\n          <div class=\"submenu-container\">\n            <a class=\"site-menu-link\" href=\"/pages/archivo/\"><span>Archivo</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/archivo/inteligencias-colectivas/\"><span>Inteligencias Colectivas</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/archivo/precipitacion-critica/\"><span>Precipitación crítica</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/archivo/copiloto-BOT/\"><span>copiloto-BOT</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/scroll-vertical/\"><span>Sedimento visual</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/archivo/portapapeles/\"><span>Portapapeles</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/input.sh/\" data-input-link><span>input.sh</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/ensayo-de-proximidad/\"><span>Ensayo de proximidad</span></a>\n          </div>\n          <div class=\"submenu-container\">\n            <a class=\"site-menu-link\" href=\"/pages/cuerpo/\"><span>Cuerpo</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/game_scroll/\"><span>El Mounstro del Scroll</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/npc/\"><span>NPC</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/fantasmagorias/\"><span>Materia Inestable</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/pages/video-texto/\"><span>Apuntes de color</span></a>\n            <a class=\"site-menu-link submenu-item\" href=\"/contacto-command/\"><span>contacto.command</span></a>\n          </div>\n            <a class=\"site-menu-link\" href=\"/pages/creditos/\"><span>Créditos</span></a>\n        </div>\n        <p class=\"terminal-prompt\">Selecciona una sala <span aria-hidden=\"true\">█</span></p>\n      </nav>\n    </details>";
  document.body.insertAdjacentHTML("beforeend", markup);
  const menu = document.querySelector(".site-menu");
  const summary = menu.querySelector("summary");
  const sync = () => summary.setAttribute("aria-expanded", String(menu.open));
  menu.addEventListener("toggle", sync);
  document.addEventListener("click", event => { if (!menu.contains(event.target)) menu.open = false; });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.open) { menu.open = false; summary.focus(); }
  });
  menu.querySelectorAll('.submenu-container').forEach((group, index) => {
    const link = group.querySelector('.site-menu-link');
    const children = document.createElement('div');
    children.className = 'terminal-children';
    children.id = `terminal-branch-${index}`;
    group.querySelectorAll('.submenu-item').forEach(child => children.append(child));
    const row = document.createElement('div');
    row.className = 'terminal-row';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'terminal-toggle';
    toggle.setAttribute('aria-label', `Proyectos de ${link.textContent.trim()}`);
    toggle.setAttribute('aria-controls', children.id);
    const setOpen = open => {
      children.hidden = !open;
      toggle.textContent = open ? '[-]' : '[+]';
      toggle.setAttribute('aria-expanded', String(open));
      group.classList.toggle('branch-open', open);
    };
    const current = new URL(link.href).pathname === location.pathname;
    if (current) link.setAttribute("aria-current", "page");
    setOpen(current || (location.pathname === "/" && index === 0));
    toggle.addEventListener('click', () => setOpen(children.hidden));
    row.append(toggle, link);
    group.prepend(row);
    group.append(children);
  });
})();
