"""Imprime los comentarios NUEVOS de input.sh en una XP-58 instalada en Windows."""
import argparse
import json
import os
from pathlib import Path
import sys
import textwrap
import time
import unicodedata
import urllib.request
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATE = ROOT / '.local-backup' / 'input-print' / 'state.json'


def ticket(text, columns=32):
    # Igual que en la referencia: transliterar tildes y omitir emojis.
    # Quitar TODOS los controles del texto público, especialmente ESC/POS.
    clean = ''.join(c for c in text.replace('\r\n', '\n').replace('\r', '\n')
                    if c == '\n' or not unicodedata.category(c).startswith('C'))
    clean = unicodedata.normalize('NFKD', clean).encode('ascii', 'ignore').decode('ascii')
    lines = []
    for line in clean.split('\n'):
        lines.extend(textwrap.wrap(line, columns, replace_whitespace=True) or [''])
    if not clean.strip():
        lines = ['[Comentario sin texto imprimible]']
    # ASCII evita depender de la tabla de caracteres particular del firmware.
    return b'\x1b@\x1ba\x00\x1b!\x00' + ('\n'.join(lines)+'\n\n\n').encode('ascii')


def print_ticket(api, printer, text):
    handle = api.OpenPrinter(printer)
    started = False
    try:
        job_id = api.StartDocPrinter(handle, 1, ('input.sh - comentario', None, 'RAW'))
        started = True
        api.StartPagePrinter(handle)
        data = ticket(text)
        if api.WritePrinter(handle, data) != len(data):
            raise OSError('El spooler no aceptó todos los bytes del comentario.')
        api.EndPagePrinter(handle)
        api.EndDocPrinter(handle)
        started = False
        return job_id
    finally:
        if started:
            try:
                api.AbortPrinter(handle)
            except Exception:
                pass
        api.ClosePrinter(handle)


def save(path, state):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    with temp.open('w', encoding='utf-8') as stream:
        json.dump(state, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(temp, path)


def load(path, url, printer):
    if not path.exists():
        return {'url': url, 'printer': printer, 'initialized': False,
                'seen': [], 'pending': [], 'inflight': None}
    state = json.loads(path.read_text(encoding='utf-8'))
    if state.get('url') != url or state.get('printer') != printer:
        raise ValueError('El estado pertenece a otra URL o impresora. Usa otro --state.')
    if not isinstance(state.get('seen'), list) or not isinstance(state.get('pending'), list):
        raise ValueError('Archivo de estado inválido; no se reinicia para evitar duplicados.')
    return state


def discover(state, entries):
    """API newest-first; queue oldest-first. First successful poll is baseline."""
    if not state['initialized']:
        state['seen'] = [entry['id'] for entry in entries]
        state['initialized'] = True
        return 0
    known = set(state['seen'])
    added = 0
    for entry in reversed(entries):
        if entry['id'] not in known:
            state['pending'].append(entry)
            state['seen'].append(entry['id'])
            known.add(entry['id'])
            added += 1
    # Feed retains 500; retain substantially more IDs plus all pending jobs.
    state['seen'] = list(dict.fromkeys(state['seen'][-20000:] +
                                     [entry['id'] for entry in state['pending']]))
    return added


def fetch_entries(url):
    request = urllib.request.Request(url, headers={
        'Cache-Control': 'no-cache', 'User-Agent': 'ScrollingLifeInputPrinter/1.0'})
    with urllib.request.urlopen(request, timeout=10) as response:
        data = json.load(response)
    entries = data.get('entries')
    if not isinstance(entries, list) or not all(
            isinstance(e, dict) and isinstance(e.get('id'), str) and
            isinstance(e.get('text'), str) for e in entries):
        raise ValueError('La API no devolvió comentarios válidos.')
    return entries


def process_one(state, path, printer_api):
    if state['inflight']:
        raise RuntimeError('Impresión interrumpida. Revisa papel y cola; usa --resolve sent o --resolve retry.')
    if not state['pending']:
        return False
    entry = state['pending'][0]
    state['inflight'] = entry['id']
    save(path, state)  # A crash after here must NOT trigger automatic duplicate paper.
    job_id = print_ticket(printer_api, state['printer'], entry['text'])
    state['pending'].pop(0)
    state['inflight'] = None
    save(path, state)
    print(f"Enviado a {state['printer']}: {entry['id']} (trabajo Windows {job_id})", flush=True)
    return True


def resolve(state, decision):
    if not state['inflight'] or not state['pending'] or state['pending'][0]['id'] != state['inflight']:
        raise ValueError('No hay un trabajo interrumpido que resolver.')
    if decision == 'sent':
        state['pending'].pop(0)
    state['inflight'] = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--printer', default='XP-58')
    parser.add_argument('--url', default='https://scrollinglife.com/api/input')
    parser.add_argument('--state', type=Path, default=DEFAULT_STATE)
    parser.add_argument('--interval', type=float, default=1)
    parser.add_argument('--list-printers', action='store_true')
    parser.add_argument('--test', action='store_true', help='Imprime una prueba local, sin publicar comentarios')
    parser.add_argument('--resolve', choices=['sent', 'retry'])
    args = parser.parse_args()
    if sys.platform != 'win32':
        parser.error('Este script usa la cola de impresión de Windows.')
    try:
        import win32print
    except ImportError:
        parser.error('Instala la dependencia: python -m pip install pywin32')
    printers = [p[2] for p in win32print.EnumPrinters(
        win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
    if args.list_printers:
        print('\n'.join(printers) or 'No hay impresoras instaladas.')
        return
    if args.printer not in printers:
        parser.error(f'No se encontró "{args.printer}". Instaladas: '+', '.join(printers))
    if args.test:
        print_ticket(win32print, args.printer, 'Scrolling Life - input.sh\nPrueba USB\náéíóú ñ\nImpresión de comentarios nuevos')
        print('Prueba enviada al spooler. Verifica la salida de papel.')
        return
    parsed = urlparse(args.url)
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and parsed.hostname in ('localhost', '127.0.0.1')):
        parser.error('Usa HTTPS; HTTP solo está permitido para localhost.')
    # One local process per state file. Windows releases this lock on exit/crash.
    import msvcrt
    args.state.parent.mkdir(parents=True, exist_ok=True)
    lock = args.state.with_suffix('.lock').open('a+b')
    lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
    try:
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        parser.error('Ya hay otro script usando este archivo de estado.')
    state = load(args.state, args.url, args.printer)
    if args.resolve:
        resolve(state, args.resolve)
        save(args.state, state)
    print(f'Escuchando {args.url} cada {max(1, args.interval):g}s. Impresora: {args.printer}. Ctrl+C termina.', flush=True)
    if not state['initialized']:
        print('La primera consulta omite el historial. Espera "Listo" antes de escribir la prueba.', flush=True)
    while True:
        if state['inflight']:
            raise RuntimeError('Trabajo interrumpido: revisa la cola/papel y usa --resolve sent o --resolve retry.')
        while process_one(state, args.state, win32print):
            pass
        try:
            entries = fetch_entries(args.url)
        except (OSError, ValueError) as error:
            print(f'Sin conexión: {error}. Reintento en 5 segundos.', flush=True)
            time.sleep(5)
            continue
        first = not state['initialized']
        if not first and entries and state['seen'] and not set(state['seen']).intersection(e['id'] for e in entries):
            print('AVISO: el historial cambió completamente; podrían faltar comentarios antiguos (límite API: 500).', flush=True)
        count = discover(state, entries)
        save(args.state, state)
        if first:
            print(f'Listo. {len(entries)} comentarios anteriores omitidos. Ya puedes enviar uno nuevo.', flush=True)
        elif count:
            print(f'{count} comentario(s) nuevo(s) en cola.', flush=True)
        while process_one(state, args.state, win32print):
            pass
        time.sleep(max(1, args.interval))


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nScript detenido. El estado se conserva para el siguiente inicio.')
    except Exception as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
