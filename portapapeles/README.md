# Portapapeles

Página pública: `/portapapeles/`. Vacía y negra: clic en el lienzo y Ctrl+V pega imágenes en ese lugar. Arrastrar mueve una imagen; acercarla al borde superior o inferior desplaza la página. El desplazamiento añade espacio para seguir pegando. Sin selección de lugar se pega en la zona visible.

## Local

Al abrir, se centra la última imagen subida. Se puede desplazar hacia arriba para recorrer las anteriores; las sincronizaciones posteriores no cambian la posición de lectura.

Ctrl+Z (Cmd+Z en Mac) elimina la última imagen propia; se puede repetir para deshacer más subidas. Cada subida entrega una clave privada guardada en este navegador. El servidor verifica esa clave y solo conserva su hash; el listado público no la expone. Si se borran los datos del navegador, se pierde la posibilidad de deshacer esas subidas. Las imágenes anteriores a esta función no tienen autoría verificable y no pueden deshacerse.

`python scripts/serve-lienzo.py` (requiere Pillow 11.3.0). Abrir `http://localhost:8080/portapapeles/` con el servidor estático habitual, o `http://localhost:8095/portapapeles/` directamente.

Imágenes: `.local-backup/lienzo/images/`. Posiciones: `.local-backup/lienzo/positions.json`. Los datos sobreviven al reinicio. El lienzo es compartido entre visitantes, como la consola input.sh.

## Almacenamiento

El cliente reduce la imagen antes de enviarla. El servidor verifica el contenido, vuelve a codificar WebP, elimina metadatos y limita el lado mayor a 1600 px. Objetivo: 180 KB por imagen; reduce dimensiones cuando hace falta. GIFs y otros formatos animados se guardan como imagen fija. Las posiciones horizontales son proporcionales para adaptarse a distintas pantallas.

La carpeta de imágenes tiene un máximo de **50 000 000 bytes (50 MB)**. Antes de guardar, elimina las imágenes más antiguas necesarias para mantenerse dentro del límite. Mover una imagen no cambia su antigüedad. Las imágenes eliminadas desaparecen de los navegadores al sincronizar. El índice de posiciones se guarda separado de la carpeta de imágenes. Escrituras serializadas y reemplazo atómico del índice; ejecutar una instancia del backend.

## Producción

El backend existente `escritura-colectiva` sirve `/api/lienzo` y almacena `/data/lienzo/images` en su volumen persistente. Reconstruir `web` y `escritura-colectiva` al desplegar. El frontend usa la misma procedencia en producción y el puerto 8095 en localhost. No se añade al menú automáticamente.

Pruebas: `python -m unittest discover -s escritura-colectiva -p test_image_store.py`.
