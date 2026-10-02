#!/usr/bin/env python3
"""Read-only game regression collection; no automatic coding or deployment."""
from __future__ import annotations
import argparse, hashlib, json, os, platform, shutil, signal, subprocess, sys, tempfile, time
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
VERSION = 1
MODES = 'original,clone,finalCap,runtimeFinalCap,runtimeFresh'
SCOPES = {
 'force_ledger': 'Native force/momentum/energy calibration and instrumentation trace invariance.',
 'grip_reaction': 'Actual offHand free-body fixtures, paired wrench/power and timestep convergence.',
 'cut_reaction': 'Native cutting impulse/energy, real manifold and runtime/clone phase fixtures.',
 'arm_capacity': 'Source guards, actual accumulators, prepared original/clone trace and callback failure reporting.',
 'arm_duel': 'Actual two-AI 10s duels, seed7, sabre/zwei versus longsword; original/clone and finalCap/runtime parity.',
 'build': 'Existing Vite build with output outside repository; no browser or deployment check.'
}

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def utc(): return datetime.now(timezone.utc).isoformat()
def git(*args): return subprocess.check_output(['git',*args],cwd=REPO,text=True).strip()
def dump(path, data): path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def external(path):
 path = Path(path).expanduser().resolve()
 if path == Path('/') or path == REPO or REPO in path.parents:
  raise ValueError('Output/cache must be outside repository')
 return path

def hashes():
 files=set()
 for name in ['src','public','tools','.github/workflows']:
  directory=REPO/name
  if directory.exists():
   files.update(p for p in directory.rglob('*') if p.is_file() and not p.is_symlink()
                and '__pycache__' not in p.parts and not p.name.endswith('.pyc'))
 for name in git('ls-files').splitlines():
  p=REPO/name
  if len(Path(name).parts)==1 and p.is_file() and p.suffix in {'.js','.mjs','.cjs','.ts','.json','.html','.css','.yml','.yaml'}: files.add(p)
 return {str(p.relative_to(REPO)):sha(p) for p in sorted(files)}

def fingerprint():
 source=hashes()
 runtime={'node':subprocess.check_output(['node','--version'],text=True).strip(),
          'npm':subprocess.check_output(['npm','--version'],text=True).strip(),
          'python':platform.python_version(),'system':platform.system(),'machine':platform.machine()}
 config={'schemaVersion':VERSION,'scopes':SCOPES,'duelSeconds':10,'duelSeeds':[7],'duelModes':MODES,'timeoutSecondsPerCommand':{'arm_duel':180,'others':90}}
 value={'sourceHashes':source,'runtime':runtime,'suite':config}
 value['key']=hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 return value

def specs(out):
 rows=[]
 for name,script in [
  ('force_ledger','tools/sim/force_ledger.test.mjs'),
  ('grip_reaction','tools/sim/grip_reaction.test.mjs'),
  ('cut_reaction','tools/sim/experiments/cut_reaction_candidate.test.mjs'),
  ('arm_capacity','tools/sim/experiments/arm_capacity_candidate.test.mjs')]:
  rows.append((name,['node',script,str(out/(name+'.json'))],out/(name+'.json')))
 rows.append(('arm_duel',['node','tools/sim/experiments/arm_capacity_duel_probe.mjs','--seconds=10','--prepare=3','--seeds=7','--modes='+MODES,'--out='+str(out/'arm_duel.json')],out/'arm_duel.json'))
 rows.append(('build',['npm','run','build','--','--outDir',str(out/'build')],None))
 return rows

def run_one(name, command, artifact, out, timeout=180):
 begin=time.monotonic(); log=out/(name+'.log'); error=None; code=None
 with log.open('w') as stream:
  try:
   process=subprocess.Popen(command,cwd=REPO,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
   try:
    code=process.wait(timeout=timeout)
   except subprocess.TimeoutExpired:
    try:os.killpg(process.pid,signal.SIGTERM)
    except ProcessLookupError:pass
    try:process.wait(timeout=2)
    except subprocess.TimeoutExpired:pass
    try:os.killpg(process.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    process.wait()
    raise
  except (subprocess.TimeoutExpired,OSError) as exc: error=str(exc); stream.write('\nRUNNER ERROR: '+error+'\n')
 row={'id':name,'command':command,'wallSeconds':time.monotonic()-begin,'exitCode':code,'error':error,
      'log':log.name,'artifact':artifact.name if artifact else None,'scope':SCOPES.get(name,'Runner guard fixture'),'pass':False}
 if artifact is not None:
  try:
   data=json.loads(artifact.read_text())
   row['resultPass']=data.get('pass') is True
   row['sourceStable']=data.get('sourceStable')
   row['sourceStabilityRequired']=name in {'force_ledger','cut_reaction','arm_capacity','arm_duel'}
   stable_ok=row['sourceStable'] is True if row['sourceStabilityRequired'] else ('sourceStable' not in data or row['sourceStable'] is True)
   row['individualPass']=all(t.get('pass') is True for t in data.get('tests',[]))
   row['executionPass']=data.get('executionPass',True) is True and all(t.get('executionPass') is True for t in data.get('runs',[]))
   row['pass']=code==0 and error is None and row['resultPass'] and stable_ok and row['individualPass'] and row['executionPass']
   row['observedCounts']={key:len(data[key]) if isinstance(data[key],list) else data[key]
                           for key in ['tests','fixtures','runs','newFailureReview'] if key in data}
  except (OSError,ValueError,AttributeError,TypeError) as exc: row['resultError']=str(exc)
 else:
  files=sorted(p for p in (out/'build').rglob('*') if p.is_file())
  built={'pass':code==0 and error is None and (out/'build/index.html').is_file(),
         'files':{str(p.relative_to(out/'build')):sha(p) for p in files}}
  artifact=out/'build.json'; dump(artifact,built); row['artifact']=artifact.name
  row['resultPass']=built['pass']; row['pass']=built['pass']
 return row

def artifact_hashes(out):
 return {p.name:sha(p) for p in sorted(out.iterdir()) if p.is_file()
         and p.suffix in ['.json','.log'] and p.name not in ['result.json','fingerprint.json']}

def valid_cache(folder, key, ids):
 try:
  data=json.loads((folder/'result.json').read_text())
  if data['schemaVersion']!=VERSION or data['fingerprint']!=key or data['sourceStable'] is not True: return None
  if [t['id'] for t in data['tests']]!=ids: return None
  if data['pass'] is not all(t['pass'] is True for t in data['tests']): return None
  evidence=data['artifactHashes']
  if not evidence or any(sha(folder/name)!=digest for name,digest in evidence.items()): return None
  for row in data['tests']:
   if row['log'] not in evidence: return None
   if row['pass'] is True and row['artifact'] not in evidence: return None
  return data
 except (OSError,ValueError,KeyError,TypeError): return None

def run_context():
 run_id=os.environ.get('GITHUB_RUN_ID')
 return {'runId':run_id,'attempt':os.environ.get('GITHUB_RUN_ATTEMPT'),
         'url':('https://github.com/yoonjl-svg/halfsword-codex/actions/runs/'+run_id) if run_id else None}

def run_suite(out, cache, force=False):
 begin=time.monotonic(); out.mkdir(parents=True,exist_ok=False)
 start_sha=git('rev-parse','HEAD'); before=fingerprint(); dump(out/'fingerprint.json',before)
 expected=specs(out); key=before['key']; cached=valid_cache(cache/key,key,[x[0] for x in expected]) if cache and not force else None
 if cached:
  for name in cached['artifactHashes']: shutil.copy2(cache/key/name,out/name)
  after=hashes(); end_sha=git('rev-parse','HEAD'); stable=before['sourceHashes']==after and start_sha==end_sha
  report=dict(cached)
  report.update({'createdUTC':utc(),'checkoutSHA':start_sha,'endingCheckoutSHA':end_sha,'headStable':start_sha==end_sha,'sourceBefore':before['sourceHashes'],'sourceAfter':after,'sourceStable':stable,'evidenceResultPass':cached['pass'],'pass':cached['pass'] and stable,'cacheUsed':True,'currentRun':run_context(),
                 'evidenceCheckoutSHA':cached.get('evidenceCheckoutSHA',cached['checkoutSHA']),
                 'cachedResultSHA256':sha(cache/key/'result.json'),'forced':force,'evidenceForced':cached.get('evidenceForced',cached.get('forced',False)),'wallSeconds':time.monotonic()-begin})
 else:
  rows=[run_one(*row,out,timeout=180 if row[0]=='arm_duel' else 90) for row in expected]
  after=hashes(); end_sha=git('rev-parse','HEAD'); stable=before['sourceHashes']==after and start_sha==end_sha
  report={'schemaVersion':VERSION,'createdUTC':utc(),'checkoutSHA':start_sha,'endingCheckoutSHA':end_sha,'headStable':start_sha==end_sha,'fingerprint':key,
          'cacheUsed':False,'originRun':run_context(),'currentRun':run_context(),'forced':force,'tests':rows,'sourceBefore':before['sourceHashes'],'sourceAfter':after,
          'runtime':before['runtime'],'suite':before['suite'],'sourceStable':stable,
          'pass':stable and all(row['pass'] for row in rows),'wallSeconds':time.monotonic()-begin,
          'artifactHashes':artifact_hashes(out),
          'limitations':['Automated regression and evidence collection, not AI code generation or automatic improvement implementation.',
                        'No human naturalness, whole-body force-transfer or recovery-completion claim.',
                        'No automatic source changes, merge, deployment, messaging or peer contact.']}
 dump(out/'result.json',report)
 if cache and not cached:
  destination=cache/key; destination.mkdir(parents=True,exist_ok=True)
  for name in [*report['artifactHashes'],'result.json']:shutil.copy2(out/name,destination/name)
 if os.environ.get('GITHUB_OUTPUT'):
  with open(os.environ['GITHUB_OUTPUT'],'a') as stream: stream.write('cache_used='+str(report['cacheUsed']).lower()+'\n')
 if os.environ.get('GITHUB_STEP_SUMMARY'):
  with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as stream:
   stream.write(f"### Development regression checks\n\nCheckout `{report['checkoutSHA']}`; fingerprint `{key}`.\n\n")
   stream.write(f"Result: {'PASS' if report['pass'] else 'FAIL'}; cached={report['cacheUsed']}; wall={report['wallSeconds']:.2f}s.\n\n")
   for row in report['tests']:stream.write(f"- {row['id']}: {'PASS' if row['pass'] else 'FAIL'} (exit {row['exitCode']}, measured command wall {row['wallSeconds']:.2f}s)\n")
   stream.write('\nRegression checks only; no AI coding, automatic fixes or realism-completion claim.\n')
 print(json.dumps({'result':str(out/'result.json'),'pass':report['pass'],'cacheUsed':report['cacheUsed'],'wallSeconds':report['wallSeconds'],'tests':len(report['tests'])}))
 return 0 if report['pass'] else 1

def self_test():
 with tempfile.TemporaryDirectory(prefix='halfsword-check-guards-') as directory:
  out=Path(directory); rows=[]
  cases=[('exit_failure',{'pass':True},1),('json_failure',{'pass':False},0),('source_failure',{'pass':True,'sourceStable':False},0),('null_tests',{'pass':True,'tests':None},0),('null_runs',{'pass':True,'runs':None},0),('later_success',{'pass':True,'sourceStable':True},0)]
  for name,data,code in cases:
   artifact=out/(name+'.json');command=[sys.executable,'-c',f'import json,sys;json.dump({data!r},open({str(artifact)!r},"w"));sys.exit({code})']
   rows.append(run_one(name,command,artifact,out))
  missing=run_one('missing_json',[sys.executable,'-c','pass'],out/'absent.json',out); rows.append(missing)
  timeout_row=run_one('timeout',[sys.executable,'-c','import time;time.sleep(5)'],out/'timeout.json',out,timeout=.03);rows.append(timeout_row)
  assert timeout_row['error'] and timeout_row['pass'] is False
  assert [r['pass'] for r in rows]==[False,False,False,False,False,True,False,False]
  assert not all(r['pass'] for r in rows) # Final failing suite must return nonzero.
  # Same failed cached receipt is accepted as failure, never promoted to PASS.
  evidence=artifact_hashes(out); cache_rows=rows
  report={'schemaVersion':VERSION,'fingerprint':'guard','sourceStable':True,'tests':cache_rows,'pass':False,'artifactHashes':evidence}
  dump(out/'result.json',report)
  cached=valid_cache(out,'guard',[r['id'] for r in cache_rows]);assert cached and cached['pass'] is False
  (out/'later_success.log').write_text('tampered');assert valid_cache(out,'guard',[r['id'] for r in cache_rows]) is None
  child_out=out/'child-suite'
  child=subprocess.run([sys.executable,str(Path(__file__)), '--guard-fixture-child','--out',str(child_out)],capture_output=True,text=True)
  assert child.returncode==1
  child_report=json.loads((child_out/'result.json').read_text())
  assert child_report['pass'] is False and [x['pass'] for x in child_report['tests']]==[False,True]
  print(json.dumps({'pass':True,'guards':['exitCode','JSON pass','sourceStable','missingJSON','continueAfterFailure','cachedFailureStaysFailure','cacheArtifactHash','actualNonzeroSuiteExit','timeoutGroupCleanup','malformedTestsOrRunsContinue']}))
 return 0

def guard_fixture_child(out):
 out.mkdir(parents=True,exist_ok=False);rows=[]
 for name,code in [('failure',1),('after_failure',0)]:
  artifact=out/(name+'.json'); command=[sys.executable,'-c',f'import json,sys;json.dump({{"pass":True}},open({str(artifact)!r},"w"));sys.exit({code})']
  rows.append(run_one(name,command,artifact,out))
 report={'pass':all(row['pass'] for row in rows),'tests':rows};dump(out/'result.json',report)
 return 0 if report['pass'] else 1

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--out',default='/tmp/halfsword-development-checks-'+str(os.getpid()))
 parser.add_argument('--cache-dir');parser.add_argument('--force',action='store_true')
 parser.add_argument('--guard-fixture-child',action='store_true',help=argparse.SUPPRESS)
 parser.add_argument('--fingerprint',action='store_true');parser.add_argument('--self-test-guards',action='store_true')
 args=parser.parse_args()
 if args.guard_fixture_child:return guard_fixture_child(external(args.out))
 if args.self_test_guards:return self_test()
 if args.fingerprint:print(fingerprint()['key']);return 0
 return run_suite(external(args.out),external(args.cache_dir) if args.cache_dir else None,args.force)

if __name__=='__main__':
 try:sys.exit(main())
 except Exception as exc:
  print(json.dumps({'pass':False,'runnerError':str(exc)}),file=sys.stderr);sys.exit(1)
