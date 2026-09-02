# AAAAAAAAAAAA.txt

Pieza de Carmen y Javi, incorporada en Scrolling Life > Ruido.
Ruta: `/pages/spam-98/`. HTML, CSS y JavaScript estaticos, sin compilacion.

## Material original

`assets/AAAAAAAAAAAA.txt/` conserva los 87 archivos y la estructura del ZIP
`AAAAAAAAAAAA.txt-20260902T172055Z-1-001.zip`. Los archivos URL.txt son datos:
solo sus enlaces HTTPS forman parte de la pieza. No se ejecuta contenido del ZIP.

- INICIO: `inicio.jpg` es el fondo persistente de toda la pieza, tal como fue
  entregado. La imagen se muestra completa, sin recortes ni deformacion; las
  proporciones de pantalla diferentes dejan margenes oscuros.
- C1-C8: recorrido estricto en el orden del inventario. Cada imagen avanza a
  la siguiente subcarpeta al pulsarla o cerrarla. Solo al completar una carpeta
  se abre la siguiente; C6 -Mid- va despues de C5 y antes de C7.
- ALEATORIO: 32 ventanas independientes, barajadas sin repeticion hasta agotar
  la tanda. Cada WAV permanece asociado a la imagen de su carpeta y suena al
  aparecer y al pulsarla, despues del primer gesto que activa el audio.
  Se superponen desde C3, sin avanzar ni saltarse los pasos de los clusters.
- Seis URL originales, al final de sus recorridos. Se muestran en una ventana
  con enlace real; solo se abre otra pestana cuando se pulsa "Abrir enlace".
- FINAL: pelicula original de Notepad (39,9 s), convertida de MOV/HEVC a
  MP4/H.264 con el audio original para compatibilidad web. El MOV se conserva.

## Ritmo e interaccion

C1 aparece tras 1,8 segundos sobre INICIO. No hay temporizadores que avancen
las carpetas: C1 muestra `1.Preparing setup.gif`; un clic abre
`2.BlackCore/1.Iluvbc.gif` y otro abre su URL final. Al continuar se inicia C2.
El mismo encadenamiento se aplica hasta C8. Cada nuevo paso se coloca delante
del spam para que el resultado del clic sea visible.

Desde C3, las ventanas aleatorias aceleran con el tiempo y las interacciones.
Cerrar o pulsar provoca nuevas apariciones. Las ventanas se arrastran,
minimizan y maximizan; el menu Opciones
de la pagina permite recuperarlas. Los botones dibujados en los assets forman
parte de una superficie interactiva que avanza el recorrido.

El final aparece al completar C8, despues de recorrer los ocho clusters.
No hay limite de tiempo que interrumpa el recorrido. Opciones > Finalizar
sesion permite ver el final directamente. Al llegar al final se retiran todos los anuncios,
cesan las apariciones y sus sonidos, y se reproduce el Notepad de FINAL sobre
el mismo fondo de INICIO. Reiniciar limpia ventanas y recorridos.

La barra inferior mantiene sonido, pausa y salida accesibles. Escape pausa
las apariciones y el sonido; los GIF originales conservan su animacion.
Al ocultar la pestana se detiene el tiempo de la pieza y su audio.
Se mantienen hasta 24 ventanas en escritorio o 12 en movil, retirando las
aleatorias mas antiguas sin perder los recorridos de los clusters.

`assets.js` contiene el inventario con rutas, dimensiones y asociaciones.
No se necesitan dependencias externas en tiempo de ejecucion.
Los iconos locales son de Lucide; su licencia esta en `icons/LICENSE`.

## Verificacion

`scripts/spam-98-tests/` prueba en Chromium el orden de los 22 pasos,
la espera sin saltos, ALEATORIO desde C3, pausa, reinicio y FINAL, en escritorio
y movil. Con el servidor local en el puerto 8080, ejecutar `npm install`,
`npx playwright install chromium` y `npm test` desde esa carpeta.
`BASE_URL` permite comprobar la misma ruta en el servidor publicado.
