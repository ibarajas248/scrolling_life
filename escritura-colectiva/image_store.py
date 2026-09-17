from __future__ import annotations
import io
import json
import math
import re
import threading
import uuid
import warnings
import hashlib
import secrets
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from PIL import Image, ImageOps

LIMIT = 50_000_000
MAX_UPLOAD = 2_000_000

class ImageStore:
    def __init__(self, root, limit=LIMIT):
        self.root = Path(root)
        self.images = self.root / 'images'
        self.index = self.root / 'positions.json'
        self.limit = limit
        self.lock = threading.RLock()

    def _read(self):
        self.images.mkdir(parents=True, exist_ok=True)
        rows = json.loads(self.index.read_text('utf-8')) if self.index.exists() else []
        return [r for r in rows if (self.images / (r['id'] + '.webp')).is_file()]

    def _write(self, rows):
        temp = self.index.with_suffix('.tmp')
        temp.write_text(json.dumps(rows), encoding='utf-8')
        temp.replace(self.index)

    @staticmethod
    def position(x, y):
        x, y = float(x), float(y)
        if not math.isfinite(x) or not math.isfinite(y) or not 0 <= x <= 1 or not 0 <= y <= 100_000_000:
            raise ValueError('Posición inválida.')
        return x, y

    def snapshot(self):
        with self.lock:
            rows = self._read()
            return {'images': [self.public(r) for r in rows], 'bytes': sum(r['bytes'] for r in rows), 'limit': self.limit}

    @staticmethod
    def public(row):
        return {key: value for key, value in row.items() if key != 'delete_hash'}

    def delete(self, identifier, token):
        if not isinstance(token, str) or not 20 <= len(token) <= 128:
            raise PermissionError('Solo puedes deshacer tus propias imágenes.')
        with self.lock:
            rows = self._read()
            row = next((r for r in rows if r['id'] == identifier), None)
            if row is None:
                raise KeyError(identifier)
            digest = hashlib.sha256(token.encode()).hexdigest()
            if not row.get('delete_hash') or not secrets.compare_digest(row['delete_hash'], digest):
                raise PermissionError('Solo puedes deshacer tus propias imágenes.')
            (self.images / (row['id'] + '.webp')).unlink()
            self._write([r for r in rows if r['id'] != identifier])

    def add(self, raw, x, y):
        x, y = self.position(x, y)
        if not raw or len(raw) > MAX_UPLOAD:
            raise ValueError('Imagen demasiado grande.')
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            try:
                with Image.open(io.BytesIO(raw)) as source:
                    if source.width * source.height > 30_000_000:
                        raise ValueError('Imagen demasiado grande.')
                    source.seek(0)
                    im = ImageOps.exif_transpose(source).convert('RGBA')
                    im.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
                    out = io.BytesIO()
                    im.save(out, 'WEBP', quality=62, method=5)
                    while out.tell() > 180_000 and max(im.size) > 256:
                        im.thumbnail((int(im.width*.8), int(im.height*.8)), Image.Resampling.LANCZOS)
                        out = io.BytesIO()
                        im.save(out, 'WEBP', quality=55, method=5)
                    encoded = out.getvalue()
                    width, height = im.size
            except (OSError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
                raise ValueError('No se pudo leer la imagen.') from exc
        if len(encoded) > self.limit:
            raise ValueError('Imagen supera la capacidad del archivo.')
        with self.lock:
            rows = self._read()
            # Remove abandoned files left by interrupted writes before enforcing quota.
            known = {r['id'] + '.webp' for r in rows}
            for orphan in self.images.glob('*.webp'):
                if orphan.name not in known:
                    orphan.unlink()
            total = sum((self.images / (r['id']+'.webp')).stat().st_size for r in rows)
            while rows and total + len(encoded) > self.limit:
                oldest = rows.pop(0)
                file = self.images / (oldest['id']+'.webp')
                total -= file.stat().st_size
                self._write(rows)
                file.unlink()
            item = {'id': uuid.uuid4().hex, 'x': x, 'y': y, 'width': width, 'height': height, 'bytes': len(encoded)}
            token = secrets.token_urlsafe(32)
            item['delete_hash'] = hashlib.sha256(token.encode()).hexdigest()
            target = self.images / (item['id']+'.webp')
            target.write_bytes(encoded)
            try:
                self._write(rows + [item])
            except OSError:
                target.unlink(missing_ok=True)
                raise
            return {**self.public(item), 'deleteToken': token}

    def move(self, identifier, x, y):
        x, y = self.position(x, y)
        with self.lock:
            rows = self._read()
            for row in rows:
                if row['id'] == identifier:
                    row.update(x=x, y=y)
                    self._write(rows)
                    return self.public(row)
            raise KeyError(identifier)


def dispatch(handler, store, method):
    parsed = urlparse(handler.path)
    path = parsed.path.rstrip('/')
    if path != '/api/lienzo' and not path.startswith('/api/lienzo/'):
        return False
    try:
        if method == 'GET' and path == '/api/lienzo':
            handler.send_json(store.snapshot())
        elif method == 'GET' and re.fullmatch(r'/api/lienzo/images/[a-f0-9]{32}\.webp', path):
            with store.lock:
                raw = (store.images / path.rsplit('/', 1)[1]).read_bytes()
            handler.send_response(200)
            handler.send_header('Content-Type', 'image/webp')
            handler.send_header('Content-Length', str(len(raw)))
            handler.send_header('X-Content-Type-Options', 'nosniff')
            handler.send_header('Cache-Control', 'no-store')
            handler.end_headers()
            handler.wfile.write(raw)
        elif method in ('POST', 'PATCH', 'DELETE') and path == '/api/lienzo':
            length = int(handler.headers.get('Content-Length', '0'))
            if not 0 < length <= (MAX_UPLOAD if method == 'POST' else 4096):
                handler.close_connection = True
                handler.send_json({'error': 'Tamaño no permitido.'}, 413)
                return True
            handler.connection.settimeout(30)
            raw = handler.rfile.read(length)
            if len(raw) != length:
                raise ValueError('Carga incompleta.')
            if method == 'POST':
                query = parse_qs(parsed.query)
                item = store.add(raw, query.get('x', ['0'])[0], query.get('y', ['0'])[0])
                handler.send_json({'image': item}, 201)
            else:
                data = json.loads(raw)
                if not isinstance(data, dict):
                    raise ValueError('Posición inválida.')
                if method == 'DELETE':
                    store.delete(data['id'], data.get('token'))
                    handler.send_json({'deleted': data['id']})
                else:
                    item = store.move(data['id'], data['x'], data['y'])
                    handler.send_json({'image': item})
        else:
            handler.send_json({'error': 'No encontrado.'}, 404)
    except (ValueError, TypeError, UnicodeError) as error:
        handler.send_json({'error': str(error)}, 400)
    except (FileNotFoundError, KeyError):
        handler.send_json({'error': 'La imagen ya no está en el archivo.'}, 404)
    except PermissionError as error:
        handler.send_json({'error': str(error)}, 403)
    except OSError:
        handler.send_json({'error': 'No se pudo guardar o leer el archivo.'}, 503)
    return True
