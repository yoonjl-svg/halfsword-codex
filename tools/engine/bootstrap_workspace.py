#!/usr/bin/env python3
import os
"""Create official workspace manifest skeletons so the committed lock resolves.
The official prepare_builds subsequently replaces these generated files.
"""
from pathlib import Path
import re
_research_root=Path(os.environ.get('ENGINE_RESEARCH_ROOT','/tmp/halfsword-engine-research')).resolve()
_game_root=Path(__file__).resolve().parents[2]
if _research_root == Path('/') or _research_root == _game_root or _game_root in _research_root.parents:
 raise RuntimeError('ENGINE_RESEARCH_ROOT must be outside the game repository')
root=Path(os.environ.get('ENGINE_RESEARCH_ROOT','/tmp/halfsword-engine-research')).resolve()/'rapier.js'
template=(root/'builds/prepare_builds/templates/Cargo.toml.tera').read_text()
for dim in ['2','3']:
 for suffix,features,flags in [('',[],[]),('-deterministic',['enhanced-determinism'],[]),('-simd',['simd-stable'],['--enable-simd'])]:
  name=f'rapier{dim}d{suffix}'
  s=template.replace('{% if dimension == "2" %}3{% else %}2{% endif %}', '3' if dim=='2' else '2')
  s=re.sub(r'{%- for feature in additional_features %}.*?{%- endfor %}', ''.join(f'\n    "{x}",' for x in features), s, flags=re.S)
  s=re.sub(r'{%- for flag in additional_wasm_opt_flags %}.*?{%- endfor %}', ''.join(f"\n    '{x}'," for x in flags), s, flags=re.S)
  s=s.replace('{{ js_package_name }}',name).replace('{{ dimension }}',dim)
  # Upstream tag template is newer than its committed lock. Preserve all
  # registry versions: match workspace metadata and omit new direct parry pin.
  s=s.replace('version = "0.19.3"', 'version = "0.19.2"')
  s='\n'.join(line for line in s.split('\n') if not line.startswith('parry') and not line.startswith('# The explicit dependency'))
  assert '{{' not in s and '{%' not in s
  folder=root/'builds'/name
  folder.mkdir(exist_ok=True)
  (folder/'Cargo.toml').write_text(s)
  for filename in ['README.md.tera','LICENSE']:
   content=(root/'builds/prepare_builds/templates'/filename).read_text().replace('{{ dimension }}',dim)
   (folder/filename.removesuffix('.tera')).write_text(content)
