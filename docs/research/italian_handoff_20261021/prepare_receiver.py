"""Build an isolated trial on the receiving revision; historical prepares stay pinned."""
import argparse, hashlib, io, json, pathlib, shutil, subprocess, tarfile

here = pathlib.Path(__file__).resolve().parent
repo = next(p for p in here.parents if (p / '.git').exists())
manifest = json.loads((here / 'source-manifest.json').read_text())
ap = argparse.ArgumentParser()
ap.add_argument('output', type=pathlib.Path)
ap.add_argument('--dependencies', type=pathlib.Path, default=repo / 'node_modules')
args = ap.parse_args()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=False)
base = manifest['receiver_base']
archive = subprocess.check_output(['git', 'archive', base, 'src', 'public', 'index.html', 'package.json', 'package-lock.json'], cwd=repo)
with tarfile.open(fileobj=io.BytesIO(archive)) as tf:
    tf.extractall(out, filter='data')
layers = ['italian_four_playtest_20261020', 'italian_body_playtest_20261021',
          'italian_step_playtest_20261021', 'italian_press_playtest_20261021',
          'italian_press_v2_20261021']
for name in layers:
    shutil.copytree(here.parent / name / 'overlay', out, dirs_exist_ok=True)
(out / 'node_modules').symlink_to(args.dependencies.resolve(), target_is_directory=True)
(out / 'receiver-base.txt').write_text(base + '\n')
print(out)
