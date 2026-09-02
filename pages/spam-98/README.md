# AAAAAAAAAAAA.txt

Pieza de Carmen y Javi, incorporada en Scrolling Life > Ruido.
Ruta: `/pages/spam-98/`. HTML, CSS y JavaScript estaticos, sin compilacion.

## Material original

`assets/AAAAAAAAAAAA.txt/` conserva los 87 archivos y la estructura del ZIP
`AAAAAAAAAAAA.txt-20260902T172055Z-1-001.zip`. Los archivos URL.txt son datos:
solo sus enlaces HTTPS forman parte de la pieza. No se ejecuta contenido del ZIP.

- INICIO: imagen original conservada como fuente, sin mostrarse como fondo.
  A peticion del usuario, el fondo es una pagina web HTML de 1998, con enlaces
  subrayados, publicidad, GIF, contador de visitas y un directorio. Los anuncios
  y enlaces de esta pagina disparan nuevos pop-ups.
- C1-C8: cada imagen avanza a la siguiente subcarpeta al pulsarla o cerrarla.
  C6 -Mid- aparece al completar cuatro clusters o a los 90 segundos.
- ALEATORIO: 32 ventanas independientes, barajadas sin repeticion hasta agotar
  la tanda. Cada WAV permanece asociado a la imagen de su carpeta y suena al
  aparecer y al pulsarla, despues del primer gesto que activa el audio.
- Seis URL originales, al final de sus recorridos. Se muestran en una ventana
  con enlace real; solo se abre otra pestana cuando se pulsa "Abrir enlace".
- FINAL: pelicula original de Notepad (39,9 s), convertida de MOV/HEVC a
  MP4/H.264 con el audio original para compatibilidad web. El MOV se conserva.

## Ritmo e interaccion

Las apariciones programadas estan en `schedule`, en `app.js`. Los clusters
tambien se encadenan al completar sus recorridos. Las ventanas aleatorias
aceleran con el tiempo y las interacciones. Cerrar o pulsar provoca nuevas
apariciones. Las ventanas se arrastran, minimizan y maximizan; el menu Opciones
de la pagina permite recuperarlas. Los botones dibujados en los assets forman
parte de una superficie interactiva que avanza el recorrido.

El final aparece al completar los ocho clusters o a los 210 segundos de
actividad visible. Este limite y el ritmo son decisiones de esta primera
version, no indicaciones incluidas en el ZIP. Opciones > Finalizar sesion permite
ver el final directamente. Reiniciar limpia ventanas y recorridos.

La barra inferior mantiene sonido, pausa y salida accesibles. Escape pausa
las apariciones y el sonido; los GIF originales conservan su animacion.
Al ocultar la pestana se detiene el tiempo de la pieza y su audio.
Se mantienen hasta 24 ventanas en escritorio o 12 en movil, retirando las
aleatorias mas antiguas sin perder los recorridos de los clusters.

`assets.js` contiene el inventario con rutas, dimensiones y asociaciones.
No se necesitan dependencias externas en tiempo de ejecucion.
Los iconos locales son de Lucide; su licencia esta en `icons/LICENSE`.
