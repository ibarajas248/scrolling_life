# input.sh

Consola pública y anónima. Enter publica; Shift + Enter añade una línea.
Las entradas nuevas aparecen al final, como en una terminal. Al abrir se muestra
lo último; subir con scroll permite leer el historial sin que los nuevos envíos
te devuelvan al final. Se consulta el servidor cada tres segundos.

## Vista local con escritura compartida

Desde la raíz del proyecto:

```powershell
python scripts/serve-input.py
```

Abrir http://localhost:8094/input.sh/ en una o varias pestañas.
El archivo se guarda en `.local-backup/input-data/input-sh.json`, fuera de Git.
Un servidor estático como `python -m http.server` no puede guardar los envíos.

## Servidor Docker

La página se publica en `/input.sh/`. Nginx envía `/api/input` al servicio
existente `escritura-colectiva`, que guarda `/data/input-sh.json` en su volumen
persistente. Al desplegar deben reconstruirse tanto `web` como
`escritura-colectiva`. No se requieren paquetes adicionales.

Límites: 500 entradas y 2000 caracteres por entrada. Se ajustan en los valores
predeterminados de `InputStore`, en `escritura-colectiva/input_store.py`, y en
las indicaciones y el maxlength de la página. Al insertar una entrada se eliminan
del JSON las que excedan el límite, comenzando por la más antigua.

La escritura se serializa y el archivo se reemplaza de forma atómica. Los IDs
evitan duplicados al reintentar un envío. Ejecutar una sola instancia del backend
escritor sobre ese volumen. Los textos se muestran como texto, nunca como HTML.

Pruebas:

```powershell
python -m unittest discover -s escritura-colectiva -p test_input_store.py
```

## Imprimir comentarios nuevos en una XP-58 USB (Windows)

Dejar abierto este script local en el equipo donde está conectada e instalada
la impresora. Reutiliza la API pública `https://scrollinglife.com/api/input`;
no necesita una API adicional, Excel, un servicio instalado ni abrir puertos.

Desde la raíz del proyecto, con Python 3.10 o posterior:

```powershell
python -m pip install -r scripts/input-print-requirements.txt
python scripts/input-print.py --list-printers
python scripts/input-print.py --printer "XP-58" --test
python scripts/input-print.py --printer "XP-58"
```

Esperar el mensaje **Listo** y enviar un comentario con Enter desde `/input.sh/`.
Consulta cada segundo; imprime mediante `win32print` en modo RAW ESC/POS, con
líneas de 32 caracteres para papel de 58 mm. Translitera tildes y elimina emojis
y controles. El texto llega como datos, nunca como comandos de impresora.
La impresión depende de la conexión, del spooler, del papel y del controlador.

La primera ejecución omite los comentarios anteriores. El estado se conserva
fuera de Git, en `.local-backup/input-print/state.json`, para evitar duplicados
al reiniciar y guardar la cola local pendiente. Ctrl+C detiene el script.
Los comentarios que se publiquen mientras está cerrado se recuperan al volver
a abrirlo **si todavía están en las últimas 500 entradas de la API**. No es un
archivo ilimitado; deja el script abierto durante la instalación.

Si se interrumpe una impresión, el script se detiene para no repetir papel.
Revisa la cola de Windows y el papel. Si el trabajo ya fue enviado:

```powershell
python scripts/input-print.py --printer "XP-58" --resolve sent
```

Si no llegó a enviarse, usa `--resolve retry`. No borres el estado para resolver
un fallo. Ejecuta solo una copia con el mismo archivo de estado. Un trabajo
aceptado por Windows no confirma que el papel haya salido físicamente.

Pruebas automáticas sin usar papel:

```powershell
python -m unittest discover -s scripts/input-print-tests -v
```
