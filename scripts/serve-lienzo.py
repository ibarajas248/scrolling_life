"""Local canvas server: python scripts/serve-lienzo.py"""
import json
import mimetypes
import sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'escritura-colectiva'))
from image_store import ImageStore, dispatch
store=ImageStore(ROOT/'.local-backup'/'lienzo')
class Handler(BaseHTTPRequestHandler):
    def end_headers(self):
        origin=self.headers.get('Origin','')
        parsed=urlparse(origin)
        if parsed.hostname in ('localhost','127.0.0.1','::1'):
            self.send_header('Access-Control-Allow-Origin',origin)
            self.send_header('Vary','Origin')
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def send_json(self,body,status=200):
        raw=json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type')
        self.end_headers()
    def do_GET(self):
        if dispatch(self,store,'GET'): return
        route=urlparse(self.path).path
        if route in ('/','/portapapeles','/portapapeles/'): route='/portapapeles/index.html'
        if route in ('/lienzo','/lienzo/'): route='/lienzo/index.html'
        target=(ROOT/route.lstrip('/')).resolve()
        if not any(target.is_relative_to(ROOT/folder) for folder in ('lienzo','portapapeles')) or not target.is_file():
            self.send_error(404); return
        raw=target.read_bytes()
        self.send_response(200)
        self.send_header('Content-Type',mimetypes.guess_type(str(target))[0] or 'application/octet-stream')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers(); self.wfile.write(raw)
    def do_POST(self):
        if not dispatch(self,store,'POST'): self.send_error(404)
    def do_PATCH(self):
        if not dispatch(self,store,'PATCH'): self.send_error(404)
    def do_DELETE(self):
        if not dispatch(self,store,'DELETE'): self.send_error(404)
if __name__=='__main__':
    print('Portapapeles: http://localhost:8095/portapapeles/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8095),Handler).serve_forever()
