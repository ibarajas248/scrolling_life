# Deriva por Wikipedia — /bot

Una sola instancia de Chromium recorre artículos reales de Wikipedia en español con Playwright. El público ve su viewport; no se crea un navegador por visitante. La página de la obra contiene únicamente un canvas, sin controles, marcos, cursor añadido ni scripts compartidos de Scrolling Life.

## Arranque y parada

### Vista local con el sitio estático en 8080

Desde la raíz del proyecto, ejecuta `./scripts/serve-bot.ps1` en PowerShell y deja el proceso abierto. Inicia la transmisión en `127.0.0.1:8096`, separado del servicio input.sh en 8094. La vista `http://localhost:8080/bot/` se conecta automáticamente a ese puerto; necesita acceso a internet para navegar por Wikipedia. Detén el bot con Ctrl+C. En el despliegue se mantiene la conexión de mismo origen mediante Nginx.

El sitio estático necesita este servicio persistente para transmitir la navegación. Abrir los HTML o usar `python -m http.server` no ejecuta el bot.

En el `.env` privado del despliegue, añade:

```dotenv
BOT_CONTACT=ivanbarajashurtado@gmail.com
BOT_PROJECT_URL=https://scrollinglife.com
BOT_PUBLIC_ORIGIN=https://scrollinglife.com
```

El contacto fue indicado por el responsable del proyecto. Es público en el User-Agent enviado a Wikimedia. Si falta o es inválido, el proceso sirve la vista neutra pero no hace consultas a Wikipedia; los registros indican `contact-required`. No se inventa una identidad.

Desde la raíz:

```sh
docker compose up --build -d wikipedia-bot web
docker compose logs --tail=80 -f wikipedia-bot
docker compose stop wikipedia-bot
docker compose start wikipedia-bot
```

Abrir `http://localhost:8080/bot`. Para pruebas locales, deja `BOT_PUBLIC_ORIGIN` vacío o usa `http://localhost:8080`; debe coincidir con el origen del visitante. `docker compose down` detiene el stack; no uses `down -v` si quieres conservar la caché, el historial y los tiempos de espera.

Los dos archivos Compose y los dos scripts de despliegue incluyen `wikipedia-bot`. El timer del VPS seguirá reconstruyéndolo desde el release de Git, usando `BOT_CONTEXT`. Añade las variables a `/opt/scrollinglife/.env` antes de desplegar. No se ha hecho push ni desplegado desde esta implementación.

Nginx sirve `/bot`, `/bot/` y sus dos assets y reenvía exclusivamente `/bot/stream`. Si existe otro proxy HTTPS delante de este Nginx, debe admitir WebSocket (`Upgrade`/`Connection`), desactivar buffering para esta ruta y permitir al menos 75 segundos de inactividad. No publiques 8094 ni un puerto de depuración. El servicio utiliza CDP por la conexión privada de Playwright, sin puerto de debugging TCP.

Ejecución directa (Node 22 o posterior):

```sh
cd bot-service
npm ci
npx playwright install chromium
# Exportar BOT_CONTACT y BOT_PROJECT_URL antes de iniciar.
npm start
```

Abrir `http://127.0.0.1:8094/bot`; detener con Ctrl+C. En PowerShell, por ejemplo, `$env:BOT_CONTACT='ivanbarajashurtado@gmail.com'`. En Docker, Nginx sirve los archivos de `bot/`; para ejecutar Node con archivos en otra ubicación, configurar `BOT_PUBLIC_DIR`.

## Variables

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `BOT_CONTACT` | vacío | Correo o URL de contacto real, obligatorio para navegar |
| `BOT_PROJECT_URL` | `https://scrollinglife.com` | Identificación del proyecto |
| `BOT_PUBLIC_ORIGIN` | vacío | Origen admitido para espectadores; vacío permite cualquier origen |
| `BOT_FPS` | 12 | Máximo de envíos durante movimiento, limitado a 4–20 |
| `BOT_JPEG_QUALITY` | 70 | Calidad JPEG, limitada a 40–85 |
| `BOT_MAX_VIEWERS` | 80 | Límite de espectadores simultáneos, hasta 200 |
| `BOT_DATA_DIR` | `bot-service/.data` o `/data` en Docker | Caché HTTP, 24 URLs recientes y cooldown |
| `BOT_HOST` | `127.0.0.1` o `0.0.0.0` en Docker | Dirección del servicio |
| `BOT_PORT` | 8094 | Puerto del servicio; cambiar requiere ajustar proxy/healthcheck en Docker |
| `BOT_CHROMIUM_PATH` | navegador de Playwright | Ejecutable alternativo para pruebas locales |
| `BOT_PUBLIC_DIR` | `../bot` | HTML/CSS/JS para el servidor local |
| `BOT_CONTEXT` | `./bot-service` | Contexto de construcción en Compose |
| `BOT_LOG_RESOURCES` | desactivado | `1` registra recursos y decisiones de filtrado, solo para diagnóstico |

## Navegación y transmisión

Al arrancar por primera vez se elige Arte, Internet, Archivo, Imagen o Conocimiento. Después se eligen enlaces existentes del cuerpo del artículo, preferentemente visibles; los enlaces fuera de pantalla se alcanzan mediante scroll antes del clic real. Se excluyen URLs externas, parámetros, namespaces, descargas y enlaces inexistentes. La lista de 24 artículos evita ciclos cortos. La recuperación usa un artículo anterior o las semillas, no una secuencia artística predefinida.

Cada visita programa aproximadamente 25–70 segundos de desplazamientos suaves, pausas variables y retrocesos ocasionales. La carga, los clics, la recuperación y las pausas de Wikimedia pueden prolongar ese tiempo. La presencia visual de una imagen o un encabezado puede motivar una pausa; no implica comprensión del contenido.

CDP captura únicamente el viewport de 1280×800, JPEG calidad 70. WebSocket distribuye el mismo buffer a todos. Máximo nominal 12 fps y 1 MiB/s por espectador durante movimiento, más una actualización ocasional de imagen quieta. El rendimiento real depende del navegador y servidor. No se envían PNG repetidos; JPEG evita esa carga y no exige FFmpeg, TURN ni transcodificación de video. Sigue siendo una solución de banda moderada para una audiencia pequeña, no un CDN de video: 20 espectadores a 4 Mbps implican unos 80 Mbps de salida. Medir en el VPS antes de aumentar aforo o calidad; para audiencias grandes conviene migrar a video/WebRTC con distribución dedicada.

Cada cliente confirma la imagen después de decodificarla; mantiene como máximo una en vuelo y recibe la más reciente después, descartando retrasos. Los clientes inactivos se eliminan por heartbeat. Sin espectadores se detiene la captura, pero continúa la deriva. La página libera conexiones al ocultarse/cerrarse y reconecta con backoff sin borrar el último fotograma. Clics y teclado no se envían al servidor; solo se admite el mensaje `ack`.

El canvas ocupa toda la ventana y conserva la proporción con `object-fit: contain`, sin scroll del contenedor. En pantallas verticales aparecen bandas neutras: es la misma sesión de escritorio completa, reducida y sin deformación. No se cambia el tamaño del navegador cuando entra un móvil.

## Acceso a Wikimedia y reutilización

Consultado el 16 de septiembre de 2026: [Robot policy](https://wikitech.wikimedia.org/wiki/Robot_policy), [User-Agent](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy), [robots de es.wikipedia.org](https://es.wikipedia.org/robots.txt) y [robots de upload.wikimedia.org](https://upload.wikimedia.org/robots.txt).

El servicio consulta robots de cada origen antes de descargar sus recursos y renueva la decisión cada hora, usando la caché HTTP cuando es válida. Sigue hasta cinco redirecciones de robots dentro de los hosts permitidos. Un 404/410 se interpreta como ausencia de reglas según [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html); si hay bloqueo o no puede verificar la respuesta, detiene esas peticiones. Un robots malformado bloquea ese origen durante una hora y registra `robots-unverifiable`; no impide continuar por artículos autorizados de otros orígenes. Usa URL `/wiki/Título` sin parámetros y User-Agent `ScrollingLifeBot/1.0 (https://scrollinglife.com; CONTACTO) Playwright/1.58.2`. Mantiene una sola petición externa en vuelo, separación mínima de un segundo y lectura limitada a aproximadamente 1 MiB/s, globalmente para HTML, estilos, scripts e imágenes. Se solicita gzip. Solo se permiten recursos necesarios en una lista cerrada de hosts; no se precargan artículos ni se consultan APIs, ni se reproducen medios o se envía telemetría de Wikipedia. Algunos gadgets o iconos de rutas excluidas por robots pueden no cargar; no se eluden esas exclusiones.

Una respuesta 429 pausa todo el acceso y respeta `Retry-After` tanto en segundos como fecha, sin recortar esperas largas. 403 y 5xx imponen como mínimo 15 minutos; fallos repetidos aumentan la espera. El cooldown se guarda en disco y sobrevive reinicios; no se rota identidad ni se eluden bloqueos. Los límites locales son deliberadamente conservadores; el operador debe revisar futuras políticas y compartir el presupuesto con otros bots que use desde el mismo servidor.

La interceptación de Playwright desactiva la caché interna del navegador. Por eso hay caché HTTP explícita en disco con `http-cache-semantics`: caducidad, `Vary`, revalidación, `no-store` y límites de 192 MiB/3000 entradas. No se persiste ni reproduce `Set-Cookie` desde la caché; el cuerpo se almacena cuando su política HTTP lo permite. Los recursos individuales se limitan a 8 MiB y las peticiones pendientes a 128. El navegador se cierra y se recupera ante fallos; el contenedor tiene `init`, límites de procesos/memoria y apagado con SIGTERM.

La interfaz, los créditos y el pie de licencia propios de Wikipedia permanecen en el documento original, aunque no siempre están dentro del viewport. Los enlaces visibles forman parte de la imagen y el público no puede pulsarlos. Para acceder a autores e historial se puede abrir la URL canónica de cada evento `article` en el registro del servidor. No se afirma autoría sobre los artículos ni se sustituye el contenido por una copia diseñada localmente.

Según los [Términos de uso, sección 7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use), la reutilización de texto debe conservar atribución, enlace a licencia y los requisitos aplicables de compartir igual e indicar modificaciones. El texto suele estar bajo [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); consulta cada artículo. Las imágenes y otros medios tienen licencias individuales en sus páginas de archivo: no asumir una única licencia para toda la transmisión. El operador debe conservar la atribución al reutilizar capturas o grabaciones fuera de esta obra, junto con las URL de origen y las licencias pertinentes. La captura y reducción JPEG no alteran editorialmente el contenido. No hay afiliación con Wikimedia.

## Comprobaciones

Consulta [el informe de verificación real y sus limitaciones](VERIFICATION.md). Durante estas pruebas varias miniaturas de `thumb.wikimedia.org` no cargaron porque su robots redirigió a una página HTML sin reglas verificables. El servicio conserva esa restricción y continúa la navegación.

```sh
cd bot-service
npm test
# Con el servicio ya en ejecución; dura varios minutos, sin acelerar el bot:
node test/verify-live.mjs
```

`BOT_TEST_URL` permite otro puerto. La aceptación observa tres clics entre artículos, compara hashes de dos feeds reales, abre dos vistas en tamaños escritorio/móvil, prueba desconexiones y guarda capturas y métricas locales en `artifacts/` (ignoradas por Git). Las pruebas unitarias usan datos explícitos de prueba para política, caché y transporte; nunca se usan para mostrar la obra.

El endpoint `/health` es interno y de solo lectura: informa estado, espectadores y transiciones. No está publicado por Nginx. Una pausa respetuosa de Wikipedia mantiene el proceso sano; `running` describe el navegador, no garantiza que el upstream esté disponible. Revisar también los eventos `upstream-pause`, `request-error` y `browser-recovery`.
