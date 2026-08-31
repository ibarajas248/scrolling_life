# Escritura colectiva

Servicio independiente para el scroll literario colectivo de Scrolling Life.

- Backend: Python HTTP server + SQLite.
- Base de datos: `/data/scroll_literario.sqlite3`.
- Puerto interno: `8080`.
- Ruta publica prevista: `https://test.scrollinglife.com/escritura-colectiva/`.

## Docker local

```bash
docker build -t escritura-colectiva:local .
docker run --rm -p 8080:8080 -v escritura_colectiva_data:/data escritura-colectiva:local
```

## API

- `GET /api/fragments`
- `POST /api/fragments`
- `PATCH /api/fragments/:id`
- `DELETE /api/fragments/:id`
- `GET /api/events`
- `GET /healthz`
