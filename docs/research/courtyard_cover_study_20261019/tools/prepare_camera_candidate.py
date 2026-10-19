"""Run in the extracted/patched experiment root; prepares the separately tested camera module."""
from pathlib import Path
p=Path('src/arena_obstacle.js');s=p.read_text()
a='if (need[side] == null || (need[-side] != null && need[-side] + (G.sideBias * Math.PI) / 180 < need[side])) side = -side;'
b='if (need[side] == null) side = -side; // Research: keep chosen shoulder while its route remains feasible'
assert a in s
Path('src/arena_obstacle_camera_candidate.js').write_text(s.replace(a,b))
