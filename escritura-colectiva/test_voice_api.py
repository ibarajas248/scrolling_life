import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

import app
from input_store import InputStore


class VoiceApiTests(unittest.TestCase):
    def test_voice_is_separate_and_retries_are_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            original = app.input_store, app.voice_store
            app.input_store = InputStore(Path(directory) / 'input.json')
            app.voice_store = InputStore(Path(directory) / 'voice.json')
            server = ThreadingHTTPServer(('127.0.0.1', 0), app.CollectiveScrollHandler)
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            base = f'http://127.0.0.1:{server.server_port}'
            payload = {'id': '9f56ab78-301d-4511-91c0-e76bbbe65d20', 'text': 'Prueba de voz'}
            try:
                for _ in range(2):
                    request = urllib.request.Request(base + '/api/voz', json.dumps(payload).encode(),
                                                     {'Content-Type': 'application/json'})
                    with urllib.request.urlopen(request) as response:
                        self.assertEqual(response.status, 201)
                with urllib.request.urlopen(base + '/api/voz') as response:
                    self.assertEqual(len(json.load(response)['entries']), 1)
                with urllib.request.urlopen(base + '/api/input') as response:
                    self.assertEqual(json.load(response)['entries'], [])
            finally:
                server.shutdown()
                worker.join()
                server.server_close()
                app.input_store, app.voice_store = original
