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
- `pages/sala-3d/`
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
python -m http.server 8080
```

Luego, entra desde tu navegador a: [http://localhost:8080](http://localhost:8080)

## Idea base

La pagina trabaja el scroll como:

- coreografia minima del cuerpo,
- promesa de hallazgo infinito,
- archivo afectivo,
- y forma de fatiga contemporanea.
