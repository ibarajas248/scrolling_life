import concurrent.futures
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from input_store import InputStore


class InputStoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'feed.json'
        self.store = InputStore(self.path, limit=3)

    def payload(self, text):
        return {'id': str(uuid.uuid4()), 'text': text}

    def test_retention_order_and_restart(self):
        for text in ['uno', 'dos', 'tres', 'cuatro']:
            self.store.add(self.payload(text))
        restored = InputStore(self.path, limit=3).snapshot()['entries']
        self.assertEqual([entry['text'] for entry in restored], ['cuatro', 'tres', 'dos'])
        self.assertEqual(json.loads(self.path.read_text()), restored)

    def test_retry_is_not_duplicated(self):
        payload = self.payload('texto')
        first = self.store.add(payload)
        self.assertEqual(self.store.add(payload), first)
        self.assertEqual(len(self.store.snapshot()['entries']), 1)

    def test_simultaneous_writes_do_not_lose_entries(self):
        self.store.limit = 100
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(self.store.add, [self.payload(str(i)) for i in range(40)]))
        entries = self.store.snapshot()['entries']
        self.assertEqual(len(entries), 40)
        self.assertEqual(len({entry['id'] for entry in entries}), 40)

    def test_invalid_input_does_not_replace_file(self):
        self.store.add(self.payload('original'))
        before = self.path.read_bytes()
        for text in ['', '   ', None, 'x' * 2001]:
            with self.assertRaises(ValueError):
                self.store.add(self.payload(text))
        self.assertEqual(self.path.read_bytes(), before)

    def test_corrupt_file_is_not_silently_erased(self):
        self.path.write_text('{broken')
        with self.assertRaises(ValueError):
            self.store.add(self.payload('nuevo'))
        self.assertEqual(self.path.read_text(), '{broken')


if __name__ == '__main__':
    unittest.main()
