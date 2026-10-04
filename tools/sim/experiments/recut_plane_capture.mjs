// Read-only sink for the archived generated Fighter; no controller state.
let sink = null;
export function setRecutPlaneSink(next) { sink = next; }
export function recordRecutPlane(fighter, stage, values) {
  if (sink) sink(fighter, stage, values);
}
