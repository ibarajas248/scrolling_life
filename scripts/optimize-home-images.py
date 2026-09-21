"""Generate WebP display assets; originals remain available for editing."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
images = root / 'assets/images'
before = after = 0
for source in sorted([*images.glob('*.png'), *(images / 'archive-sides').glob('*.png'), *(images / 'scroll-strips').glob('*.jpg')]):
    with Image.open(source) as image:
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        target = source.with_suffix('.webp')
        image.save(target, 'WEBP', quality=85, method=6)
    before += source.stat().st_size
    after += target.stat().st_size
print(f'{before} bytes -> {after} bytes ({(1-after/before)*100:.1f}% smaller)')
