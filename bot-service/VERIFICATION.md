# Verificación de /bot

Pruebas realizadas el 16 de septiembre de 2026, hora de Bogotá (registros UTC del 17 de septiembre). Entorno: Windows, Node 24.15.0, Playwright 1.58.2 y Chromium local preinstalado, revisión 1223. El Dockerfile utiliza el navegador correspondiente a la imagen oficial de Playwright 1.58.2; esa imagen no se ejecutó aquí.

## Resultados comprobados

- **Navegación real:** se ejecutó el servicio contra Wikipedia en español, con el contacto indicado por el responsable. No se inyectaron artículos de prueba, videos ni imágenes simuladas.
- **Tres cambios de artículo mediante enlaces:** primera pasada: Internet → National Center for Supercomputing Applications → Sigla → Atentados del 11 de marzo de 2004. Segunda pasada: International Standard Serial Number → Revista → Anuncio → Audiovisual. Los eventos `article` identificaron los cambios como `via: link`.
- **Sesión compartida:** segunda aceptación, 227,892 segundos incluyendo una espera inicial persistida: dos receptores acumularon 412 y 449 fotogramas, con 399 hashes distintos coincidentes. Recibieron aproximadamente 57,7 y 62,7 MB. Dos páginas visibles de prueba y esos dos receptores compartieron un solo navegador del bot.
- **Desconexión independiente:** se cerró un receptor y su página; el otro continuó recibiendo imágenes.
- **Vista:** inspección de capturas a 1440×900 y 390×844. La página tiene solo un canvas; sin interfaz añadida ni scroll del contenedor. En vertical se conserva la proporción del viewport remoto con bandas neutras.
- **Pérdida de red:** la imagen se conservó durante la interrupción. Una prueba adicional cerró el WebSocket nativo del espectador y comprobó una nueva conexión (2 conexiones en total) y recepción posterior de imágenes.
- **Recuperación de Chromium:** se cerró deliberadamente solo el navegador del bot. El bucle lo abrió de nuevo con un contexto y una pestaña. Después siguió un enlace real de Audiovisual a Sonido. El espectador siguió conectado al servicio.
- **Caché real:** se observaron respuestas HTTP 304 para artículos/robots y reutilización de recursos; el directorio persistente se pobló correctamente. Se corrigió el tratamiento de `Set-Cookie` para almacenar representaciones permitidas sin persistir esas cabeceras.
- **Pruebas automatizadas:** 8 pruebas de política, caché y transporte aprobadas. Incluyen `Retry-After`, rechazo de enlaces externos/namespaces, robots con redirecciones, origen con robots malformado, caché tras reinicio, `no-store`, eliminación de cookies de la caché y cola de espectador lento.
- **Páginas anteriores:** `/`, `/pages/archivo/`, `/pages/infinito/`, `/pages/scroll-vertical/` y `/pages/ruido/` respondieron HTTP 200, con sus títulos originales y sin errores de JavaScript durante la prueba local. Los servicios externos se bloquearon en esta comprobación; no verifica sus integraciones remotas.
- **Configuración:** ambos Compose se parsearon y resultaron idénticos, con 8 servicios, `init` y sin publicación del puerto del bot. Revisión del diff de Nginx y los scripts de despliegue. Comprobaciones de sintaxis JavaScript aprobadas.
- **Apagado:** el último harness cerró espectador, navegador y servidor y terminó con código 0. Las pruebas no quedaron navegando en segundo plano.

## Limitaciones observadas y verificaciones pendientes

**Miniaturas:** durante la prueba, `https://thumb.wikimedia.org/robots.txt` respondió 301 hacia `https://commons.wikimedia.org/`, que redirigió a `https://commons.wikimedia.org/wiki/Main_Page`. La respuesta final era HTML, no instrucciones de robots verificables. La implementación bloquea ese origen durante una hora y vuelve a comprobarlo después. Como resultado, varias miniaturas quedan sin cargar en las capturas. La navegación y la interfaz original continúan, y los recursos permitidos de otros orígenes pueden cargar. No se sustituyeron las imágenes ni se ignoró el control de robots. Algunas rutas `/w/` de iconos/gadgets también quedan excluidas. Esta limitación visual sigue pendiente de que el origen permita una comprobación válida de sus reglas.

**Infraestructura:** este equipo no tiene Docker ni Nginx instalados. No se ejecutaron `docker compose build/up`, `nginx -t`, la imagen Linux ni el proxy HTTPS del VPS. No se hizo push, despliegue o cambio del `.env` del VPS. Se creó únicamente un `.env` local ignorado por Git con el contacto y la URL autorizados; hay que incorporar esas variables al archivo privado del servidor al desplegar.

**Alcance:** no se hizo prueba de carga con decenas de visitantes ni prueba de continuidad durante días. La prueba móvil usa un viewport de Chromium, no un teléfono físico/Safari. Las respuestas 429/503 y las esperas largas se verifican con pruebas controladas; no se provocaron bloqueos en Wikimedia. El recorrido real sí respetó un cooldown persistido tras un fallo de red observado.

## Repetición

Desde `bot-service/`, con las variables descritas en README:

```sh
npm test
node test/site-smoke.mjs
# Requiere el servicio ya iniciado; verifica tres transiciones:
node test/verify-live.mjs
# Requiere que el servicio anterior esté detenido; inicia y cierra su propio servicio:
node test/recovery-live.mjs
```

`BOT_TEST_URL` configura la URL de `verify-live.mjs`; `BOT_PORT` configura el servicio del harness de recuperación. `BOT_CHROMIUM_PATH` es opcional si está instalado el navegador de la versión fijada de Playwright.

Los resultados y capturas se guardaron localmente en `artifacts/live-report.json`, `artifacts/recovery-report.json`, `artifacts/site-smoke.json`, `artifacts/desktop.png` y `artifacts/mobile.png`. Esos artefactos y la caché se ignoran en Git para no publicar datos de ejecución ni almacenar copias de Wikipedia en el repositorio.
