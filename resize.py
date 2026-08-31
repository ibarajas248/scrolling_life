import os
import glob
from PIL import Image
import json

directory = r"c:\Users\ibara\vscproyects\scrolling_Life\assets\images\netart-cache"
files = glob.glob(os.path.join(directory, "*.jpg"))

total_bytes = 0

for i, file in enumerate(files):
    try:
        with Image.open(file) as img:
            img.thumbnail((400, 400))
            img.save(file, "JPEG", quality=60, optimize=True)
        total_bytes += os.path.getsize(file)
        if (i+1) % 100 == 0:
            print(f"Processed {i+1} / {len(files)} images...")
    except Exception as e:
        print(f"Error with {file}: {e}")

manifest_path = os.path.join(directory, "manifest.json")
if os.path.exists(manifest_path):
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    manifest['totalBytes'] = total_bytes
    manifest['targetMb'] = total_bytes / (1024 * 1024)
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)

print(f"Resized {len(files)} images. New total size: {total_bytes / (1024*1024):.2f} MB")
