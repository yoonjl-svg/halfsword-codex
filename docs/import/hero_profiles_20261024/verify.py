"""Validate the approved portrait bundle without changing game or image files."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / 'art/hero-profiles-20261024'
manifest = json.loads((ART / 'manifest.json').read_text())
spec = json.loads((ART / 'sprites.json').read_text())
for item in manifest['assets']:
    p = ROOT / item['path']
    assert hashlib.sha256(p.read_bytes()).hexdigest() == item['sha256'], p
    assert p.stat().st_size == item['bytes'], p
frame = Image.open(ART / 'frame1.png').convert('RGBA')
assert hashlib.sha256((ART / 'frame1.png').read_bytes()).hexdigest() == manifest['frameSha256']
overlay = Image.new('RGBA', (1254, 1254))
draw = ImageDraw.Draw(overlay)
for i in range(23):
    v = 77 + 50 * i
    draw.line([(v, 77), (v, 1177)], fill=(141, 216, 221, 122), width=2)
    draw.line([(77, v), (1177, v)], fill=(141, 216, 221, 122), width=2)
overlay.paste((0, 0, 0, 0), (0, 0), frame.getchannel('A').point(lambda a: 255 if a else 0))
results = []
for char in manifest['characters']:
    cid = char['sourceId']
    for kind in ['original', 'low', 'grid']:
        img = Image.open(ART / cid / f'{kind}.png')
        assert img.size == (1254, 1254) and img.mode == 'RGBA', (cid, kind)
    rec = spec['characters'][cid]
    assert len(rec['cells']) == 22 and all(len(row) == 22 for row in rec['cells'])
    colors = [tuple(rec['palette'][n]) for row in rec['cells'] for n in row]
    assert {c[3] for c in colors} == {0, 255}, cid
    sprite = Image.new('RGBA', (22, 22))
    sprite.putdata(colors)
    low = Image.new('RGBA', (1254, 1254))
    low.alpha_composite(sprite.resize((1100, 1100), Image.Resampling.NEAREST), (77, 77))
    low.alpha_composite(frame)
    assert low.tobytes() == Image.open(ART / cid / 'low.png').tobytes(), cid
    grid = Image.alpha_composite(low, overlay)
    assert grid.tobytes() == Image.open(ART / cid / 'grid.png').tobytes(), cid
    original = Image.open(ART / cid / 'original.png')
    mask = frame.getchannel('A').point(lambda a: 255 if a == 255 else 0)
    difference = ImageChops.difference(original, frame)
    assert all(ImageChops.multiply(channel, mask).getbbox() is None for channel in difference.split()), cid
    results.append({'sourceId': cid, 'receiverId': char['receiverId'], 'hashesAndReconstruction': True})
portraits = (ROOT / 'src/portraits.js').read_text()
for char in manifest['characters']:
    assert repr(char['receiverId']) in portraits, char['receiverId']
base = manifest['receiverBase']
preserved = subprocess.check_output(['git', 'diff', base, '--', 'src', 'public/ui/portraits', 'art/portraits-temp-20261023'], cwd=ROOT)
assert not preserved, 'Receiver game or current UI images were modified'
print(json.dumps({'status': 'passed', 'receiverBase': base, 'assetHashes': len(manifest['assets']),
                  'portraitFiles': 9, 'fixedGridAndFrame': True, 'receiverGameAndCurrentImagesPreserved': True,
                  'characters': results}, ensure_ascii=False, indent=2))
