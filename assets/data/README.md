# Datos del catalogo GIF

- `commons_gif_index_sample.csv`: muestra local para validar la pagina.
- `commons_gif_index.csv`: CSV principal esperado por la pagina cuando se genere con miles de URLs.

Para generar el CSV principal sin descargar GIFs:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-commons-gif-url-index.ps1 -MaxItems 5000 -ThumbWidth 260
```

La pagina intenta cargar primero `commons_gif_index.csv`. Si no existe, usa la muestra local.
