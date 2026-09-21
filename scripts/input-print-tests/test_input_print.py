import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('printer', Path(__file__).parents[1]/'input-print.py')
printer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(printer)


class FakePrinter:
    def __init__(self, fail=False):
        self.fail = fail
        self.writes = []
        self.closed = False
    def OpenPrinter(self, name): return 1
    def StartDocPrinter(self, *args): return 123
    def StartPagePrinter(self, *args): pass
    def EndPagePrinter(self, *args): pass
    def EndDocPrinter(self, *args): pass
    def AbortPrinter(self, *args): pass
    def ClosePrinter(self, *args): self.closed = True
    def WritePrinter(self, handle, data):
        if self.fail: raise OSError('USB desconectado')
        self.writes.append(data)
        return len(data)


class PrinterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)/'state.json'
        self.state = printer.load(self.path, 'https://scrollinglife.com/api/input', 'XP-58')
    def test_baseline_then_new_entries_are_chronological_and_deduplicated(self):
        old = {'id': 'old', 'text': 'anterior'}
        self.assertEqual(printer.discover(self.state, [old]), 0)
        new = [{'id': 'b', 'text': 'segundo'}, {'id': 'a', 'text': 'primero'}, old]
        self.assertEqual(printer.discover(self.state, new), 2)
        self.assertEqual(printer.discover(self.state, new), 0)
        api = FakePrinter()
        while printer.process_one(self.state, self.path, api): pass
        self.assertIn(b'primero', api.writes[0])
        self.assertIn(b'segundo', api.writes[1])
        restored = printer.load(self.path, self.state['url'], 'XP-58')
        self.assertEqual(printer.discover(restored, new), 0)
    def test_failed_print_is_retained_and_not_retried_automatically(self):
        printer.discover(self.state, [])
        printer.discover(self.state, [{'id': 'a', 'text': 'pendiente'}])
        api = FakePrinter(fail=True)
        with self.assertRaises(OSError): printer.process_one(self.state, self.path, api)
        self.assertTrue(api.closed)
        restored = printer.load(self.path, self.state['url'], 'XP-58')
        with self.assertRaises(RuntimeError): printer.process_one(restored, self.path, FakePrinter())
        printer.resolve(restored, 'retry')
        self.assertEqual(len(restored['pending']), 1)
        self.assertTrue(printer.process_one(restored, self.path, FakePrinter()))
    def test_manual_sent_resolution_does_not_reprint(self):
        self.state.update(pending=[{'id': 'a', 'text': 'ya salió'}], inflight='a')
        printer.resolve(self.state, 'sent')
        self.assertFalse(printer.process_one(self.state, self.path, FakePrinter()))
    def test_public_control_bytes_cannot_become_printer_commands(self):
        data = printer.ticket('áéíóú ñ 😀\x1b\x1d\x00' + 'x'*80)
        self.assertTrue(data.startswith(b'\x1b@\x1ba\x00\x1b!\x00'))
        body = data[8:]
        self.assertNotIn(b'\x1b', body)
        self.assertNotIn(b'\x1d', body)
        self.assertIn(b'aeiou n', body)
        self.assertTrue(all(len(line) <= 32 for line in body.splitlines()))
    def test_corrupt_state_is_not_silently_reset(self):
        self.path.write_text('{broken')
        with self.assertRaises(ValueError): printer.load(self.path, self.state['url'], 'XP-58')


if __name__ == '__main__': unittest.main()
