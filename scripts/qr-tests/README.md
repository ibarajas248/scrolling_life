# Pruebas del generador QR

Desde esta carpeta, con Node.js 22 o posterior:

```sh
npm ci --ignore-scripts
npm test
```

El lector independiente jsQR comprueba que la matriz dibujada se decodifica
al enlace esperado en las cuatro paletas y niveles de corrección. Las otras
pruebas cubren URL Unicode, parámetros, validación, quiet zone, dimensiones,
SVG, descargas y estados del controlador (sin navegador).

La página de producción es estática y no necesita Node.js ni estas dependencias.
La biblioteca QR se aloja en `generadorqr/vendor/`, fijada a la versión 2.0.4
y con su licencia incluida. No se envían las URL introducidas a ninguna API.

Prueba el QR final con una cámara real antes de usarlo en impresión.
