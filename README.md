# Scrolling Life

Proyecto web de net art sobre el scroll como gesto cultural, archivo visual y materia artistica.

## Estructura

- `index.html`: portada principal y menu de salas.
- `assets/`: recursos compartidos del sitio.
- `assets/fonts/`: fuentes locales para no depender de proveedores externos.
- `assets/images/`: imagenes locales y tiras verticales usadas por las salas.
- `assets/audio/`: audio compartido.
- `assets/styles/home.css`: estilos de la portada.
- `assets/scripts/home.js`: logica de la portada.
- `pages/`: rutas principales de cada experiencia.
- `archive/`: backups y piezas legacy que no se cargan en produccion.

## Rutas

- `pages/scroll-vertical/`
- `pages/game_scroll/`
- `pages/ruido/`
- `pages/ruido/comentarios-instagram/`
- `pages/fantasmagorias/`
- `pages/consulta-imagenes/`
- `pages/embedding-rain/`
- `pages/terminal-scroll/`
- `pages/ruido/mosquito-caos/`

Los HTML antiguos de la raiz siguen existiendo como redirecciones para no romper enlaces previos.

## Uso

Abre `index.html` o sirve la carpeta con cualquier servidor estático.

Para ejecutar un servidor local rápidamente en tu máquina y evitar problemas con rutas (como errores de CORS), abre una terminal en la carpeta raíz del proyecto y ejecuta:

```bash
python scripts/serve-site.py
```

Luego, entra desde tu navegador a: [http://localhost:8080](http://localhost:8080)

## Docker

El proyecto completo de Scrolling Life corre como un stack de contenedores:

- `web`: sitio estatico principal.
- `graph-backend`: API del grafo 3D.
- `traffic-tracker`: API de medicion de trafico.
- `traffic-dashboard`: dashboard Streamlit de trafico.
- `server-metrics`: API de rendimiento del VPS.
- `escritura-colectiva`: backend de escritura colectiva.
- `cath-review`: revisión privada.
- `wikipedia-bot`: navegador compartido para la pieza `/bot`.

En local:

```bash
docker compose up --build -d
```

Luego abre [http://localhost:8080](http://localhost:8080).

Para detenerlo:

```bash
docker compose down
```

El despliegue automatico al VPS se ejecuta desde el propio servidor: un timer de systemd revisa GitHub cada minuto y, si `master` tiene un commit nuevo, descarga esa version y reconstruye los servicios del stack.
Los secretos de servidor no van en Git: el VPS mantiene sus `.env` privados en `/opt/scrollinglife/.env` y en las rutas configuradas alli.

En el VPS, el timer instalado es:

```bash
systemctl status scrollinglife-autodeploy.timer
journalctl -u scrollinglife-autodeploy.service -n 80 --no-pager
```

## Bot de Wikipedia

La pieza `/bot` transmite una única navegación real de Chromium por Wikipedia en español. Requiere el servicio `wikipedia-bot` incluido en Docker Compose; un servidor exclusivamente estático no puede ejecutarla. Configura `BOT_CONTACT` y consulta [inicio, despliegue, políticas y verificación](bot-service/README.md).

## Idea base

La pagina trabaja el scroll como:

- coreografia minima del cuerpo,
- promesa de hallazgo infinito,
- archivo afectivo,
- y forma de fatiga contemporanea.
