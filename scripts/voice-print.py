"""Escucha /api/voz e imprime las frases nuevas en la XP-58 USB."""
from pathlib import Path
import runpy
import sys

if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    sys.argv[1:1] = ['--url', 'https://scrollinglife.com/api/voz',
                     '--state', str(root / '.local-backup/input-print/voice-state.json')]
    runpy.run_path(str(root / 'scripts/input-print.py'), run_name='__main__')
