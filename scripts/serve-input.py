"""Local preview with the same shared JSON API used in Docker."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'escritura-colectiva'))
os.environ.setdefault('COLLECTIVE_SCROLL_DATA', str(ROOT / '.local-backup' / 'input-data'))
import app


class Handler(app.CollectiveScrollHandler):
    def serve_static(self, path):
        if self.path.split('?', 1)[0] in ('/', '/input.sh'):
            self.send_response(302)
            self.send_header('Location', '/input.sh/')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        if path in ('/', '/input.sh'):
            path = '/input.sh/index.html'
        target = (ROOT / path.lstrip('/')).resolve()
        if not target.is_relative_to(ROOT / 'input.sh') or not target.is_file():
            self.send_error(404)
            return
        data = target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', app.mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    app.init_db()
    print('input.sh: http://localhost:8094/input.sh/', flush=True)
    app.ThreadingHTTPServer(('127.0.0.1', 8094), Handler).serve_forever()
