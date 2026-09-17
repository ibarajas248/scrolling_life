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
