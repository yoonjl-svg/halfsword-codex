import concurrent.futures, hashlib, json, subprocess, sys, time
from pathlib import Path
root, out = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
commands = {
    'fights12': ['node', 'tools/sim/fights12.mjs'],
    'live_battery': ['node', 'tools/sim/live_battery.mjs'],
    'finish_thrust': ['node', 'tools/sim/finish_thrust.mjs', '1', '--stand'],
    'corr_s0': ['node', 'tools/sim/corr_s0.mjs', '--limits=off,on', '--scenes=a,b'],
    'weapon_smoke': ['node', 'tools/sim/weapon_smoke.mjs'],
}
def run(item):
    name, cmd = item; start = time.monotonic()
    p = subprocess.run(cmd, cwd=root, capture_output=True, timeout=240)
    (out/(name+'.stdout')).write_bytes(p.stdout)
    (out/(name+'.stderr')).write_bytes(p.stderr)
    data = b'\n'.join(x for x in p.stdout.splitlines() if b'deprecated parameters' not in x)+b'\n'
    r = dict(name=name, command=cmd, code=p.returncode, seconds=round(time.monotonic()-start,2), sha256=hashlib.sha256(data).hexdigest())
    print(json.dumps(r), flush=True)
    return r
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    results = list(pool.map(run, commands.items()))
(out/'summary.json').write_text(json.dumps(results,indent=2)+'\n')
if any(r['code'] for r in results): raise SystemExit(1)
