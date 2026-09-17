"""Local static site with the same clean HTML routes as nginx."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        url = urlsplit(self.path)
        if url.path.endswith('.html'):
            path = url.path[:-10] if url.path.endswith('/index.html') else url.path[:-5]
            self.send_response(301)
            self.send_header('Location', urlunsplit(('', '', path, url.query, '')))
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        target = Path(self.translate_path(url.path))
        if not target.exists() and Path(str(target) + '.html').is_file():
            self.path = urlunsplit(('', '', url.path + '.html', url.query, ''))
        return super().send_head()


if __name__ == '__main__':
    print('Scrolling Life: http://localhost:8080', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8080), Handler).serve_forever()
