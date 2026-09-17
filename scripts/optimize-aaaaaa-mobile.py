"""Build smaller mobile images, retaining original files and animation timing."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageSequence

root = Path(__file__).resolve().parents[1] / 'pages' / 'aaaaaa'
manifest = json.loads((root / 'assets.js').read_text(encoding='utf-8').split('=', 1)[1].strip().rstrip(';'))
items = [step for cluster in manifest['clusters'] for step in cluster['steps']] + manifest['random']
output = root / 'assets' / 'mobile'
output.mkdir(exist_ok=True)
mapping = {}
before = after = 0
for item in items:
    if 'src' not in item:
        continue
    source = root / item['src']
    target = output / (hashlib.sha256(item['src'].encode()).hexdigest()[:16] + '.webp')
    with Image.open(source) as original:
        frames, durations = [], []
        for frame in ImageSequence.Iterator(original):
            durations.append(frame.info.get('duration', 100))
            frame = frame.convert('RGBA')
            frame.thumbnail((640, 640), Image.Resampling.LANCZOS)
            frames.append(frame)
        options = dict(format='WEBP', quality=80, method=4)
        if len(frames) > 1:
            options.update(save_all=True, append_images=frames[1:], duration=durations,
                           loop=original.info.get('loop', 1))
        frames[0].save(target, **options)
    if target.stat().st_size < source.stat().st_size:
        mapping[item['src']] = target.relative_to(root).as_posix()
        before += source.stat().st_size
        after += target.stat().st_size
    else:
        target.unlink()
(root / 'mobile-assets.js').write_text('window.SPAM_MOBILE_ASSETS = ' + json.dumps(mapping, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
print(json.dumps(dict(images=len(mapping), original_bytes=before, mobile_bytes=after, reduction_percent=round(100 * (1 - after / before), 1))))
