# Revisión de rendimiento — 20 de septiembre de 2026

## Adaptación automática de la portada — 21 de septiembre

La portada decide su calidad en el navegador, antes de iniciar los efectos. No usa un test de velocidad que consuma datos. Activa el modo ligero con ahorro de datos, red 2G/3G, ancho de banda estimado inferior a 1.5 Mbps, RTT estimado desde 450 ms, o demora de respuesta del documento superior a 1200 ms. Esta última incluye tiempo del servidor y no equivale a latencia de red pura. También lo activa en dispositivos táctiles/pantallas hasta 1024 px, o con memoria/concurrencia declaradas de hasta 2 GB/hilos.

Si no existen estas APIs, conserva la detección por pantalla y observa la fluidez: dos ventanas consecutivas de tres segundos con más del 30 % de cuadros separados por más de 50 ms reducen la calidad. La observación empieza después del arranque, excluye pestañas ocultas y termina tras 30 segundos visibles. La reducción por conexión o rendimiento se mantiene durante esa visita para evitar oscilaciones; una nueva carga evalúa de nuevo. No se almacena ni envía esta información.

Modo ligero: seis imágenes decorativas locales, sin precarga del dataset; bloques del póster estáticos; menos filtros y animación JavaScript limitada a 30 fps. Las secciones fuera de pantalla pausan sus animaciones CSS y su movimiento de paralaje. El contenido, la navegación y la radio permanecen disponibles. Las cargas ya iniciadas antes de detectar mala fluidez no se pueden ahorrar retroactivamente. El script de adaptación solo se añade al home.

Prueba reproducible: `node scripts/home-performance-tests.cjs` con Playwright y el servidor local activos. Incluye señales rápidas/lentas/desconocidas, lentitud breve frente a sostenida y comprobaciones de navegador en escritorio y móvil. Estas son simulaciones, no mediciones de redes físicas.

## Alcance y método

Revisión del código compartido y una muestra de 22 rutas locales. Chromium con pantalla táctil emulada de 820 × 900, DPR 2 y CPU ralentizada 4 veces. Cada navegación se observó durante cinco segundos después de DOMContentLoaded, con contexto nuevo. Las solicitudes externas se bloquearon deliberadamente para comparar el trabajo local: estos resultados **no miden el rendimiento completo del servidor público, la conexión móvil ni un dispositivo físico**.

Rutas revisadas: portada; Cuerpo, Infinito, Ruido, Archivo, Pausa; AAAA.txt/pieza; Embedding Rain; Caos; Consulta Imágenes; NPC; Game Scroll; Fantasmagorías; Precipitación Crítica; Scroll Vertical; Ochentas; Ecos; Manifiesto; Materialidad; Video Texto; Scrolling Life; Lluvia Imágenes 2. No constituye una certificación de todas las interacciones del sitio.

## Causas verificadas y cambios

- Imágenes decorativas grandes: generadas versiones WebP de hasta 1024 píxeles, conservando los originales. El conjunto convertido pasa de 10.71 MB a 1.07 MB (90 % menos). Portada y respaldos de las lluvias usan estas versiones.
- Portada: se comprobaban hasta 70 imágenes simultáneamente y el tiempo de espera de 650 ms podía descartar imágenes válidas en conexiones lentas. Ahora se comprueban grupos de cuatro, con límite de 12 en dispositivos táctiles y 36 en escritorio. La introducción no reinicia su reloj después de esperar las imágenes. Los manifiestos usan versiones estables para permitir caché.
- Varias tablets recibían la carga de escritorio. Los presupuestos de animación ahora incluyen pantallas de hasta 1024 píxeles o dispositivos de puntero grueso. Menos elementos simultáneos en AAAA.txt, Caos, las lluvias, el collage de Ochentas y el campo ASCII de Ruido.
- Canvas y WebGL: menor resolución y frecuencia de dibujo en dispositivos táctiles para Embedding Rain y Caos. Se omite trabajo de dibujo cuando la pestaña está oculta. El grafo de Cuerpo omite animación fuera de pantalla y respeta movimiento reducido.
- Ochentas: los cambios de altura de la barra del navegador móvil ya no reconstruyen el collage; los cambios de ancho se agrupan antes de reconstruirlo. Se evita acumular intervalos al reiniciar.

## Comparación local, tablet

Una ejecución por versión; valores orientativos, con variación por imágenes aleatorias y carga del equipo.

| Página / medida | Antes | Después |
| --- | ---: | ---: |
| Portada: recursos decodificados | 11.43 MB | 1.93 MB |
| Portada: entradas de recursos | 104 | 56 |
| Portada: tiempo acumulado en tareas largas | 4711 ms | 1677 ms |
| Ruido: tiempo de JavaScript | 2820 ms | 1585 ms |
| Caos: tiempo de JavaScript | 2027 ms | 1099 ms |
| Embedding Rain: recursos decodificados | 15.50 MB | 2.06 MB |
| Consulta Imágenes: recursos decodificados | 9.29 MB | 1.60 MB |

Los MB son la suma de `decodedBodySize`, no una medición exacta de descarga: pueden incluir recursos repetidos o cacheados. La bajada del peso no garantiza la misma mejora en fluidez. Por ejemplo, Consulta Imágenes no mejoró su tiempo de JavaScript en esta ejecución (921 → 1078 ms), y Ruido todavía genera tareas largas. No se atribuyen mejoras a las páginas sin cambios específicos.

## Validación

- Comparación de las diez rutas principales después de los cambios, sin errores JavaScript observados.
- Comprobación adicional a 390 píxeles de portada, Ruido, Ochentas y Lluvia Imágenes 2, sin errores JavaScript observados.
- Suite `scripts/spam-98-tests/test.cjs`: 22 pasos, orden C1–C8 y video en escritorio y móvil; pasó en ambos tamaños.
- Sintaxis de los scripts modificados y revisión visual de la portada en tablet; ninguna imagen HTML rota en esa comprobación.

## Límites y trabajo posterior

Los modelos de IA de CDN, las imágenes remotas, la radio, Vimeo y YouTube no están incluidos en los números anteriores. Tampoco se activaron cámara, todas las interacciones 3D ni sesiones largas. Falta una prueba física en Safari/iOS y Android con conexión móvil y una medición del servidor público (compresión, caché y tiempos de respuesta). NPC y las piezas con IA/WebGL siguen siendo candidatas a revisión específica. El CSS compartido ronda 85 KB sin comprimir: separar estilos puede ayudar, pero no fue el principal coste observado.

Los cambios de esta revisión están guardados en el proyecto local; no se ha hecho un nuevo despliegue.

## Reproducir

Arrancar `python scripts/serve-site.py`. Con Node, Playwright y Chromium disponibles, ejecutar `node scripts/audit-mobile.cjs`. Variables opcionales: `CHROMIUM_PATH`, `NODE_PATH`, `BASE_URL`, `AUDIT_WIDTH`, `AUDIT_PAGES` (rutas separadas por comas), `AUDIT_OUTPUT`.

Resultados locales de esta sesión: `tmp/performance-before.json`, `tmp/performance-other-pages.json`, `tmp/performance-after.json` y `tmp/performance-phone.json`. Son archivos de trabajo, no necesarios para servir el sitio. La conversión se reproduce con `python scripts/optimize-home-images.py` y Pillow.
