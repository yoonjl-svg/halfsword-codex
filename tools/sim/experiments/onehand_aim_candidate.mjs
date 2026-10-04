// Optional manual onehand input mapping, not a change to physical inertia or
// muscle limits. Match the old elevation and slope outside the chest-height
// band; preserve the horizontal point at y=.1 inside it.
export function continuousOnehandElevation(y, ordinaryElevation) {
  const delta = y - 0.1;
  const band = 0.08;
  if (Math.abs(delta) >= band) return ordinaryElevation;
  const u = Math.abs(delta) / band;
  // Smooth |delta| with value0/slope0 at its centre and value/slope/curvature
  // matching |delta| at the band boundary. Its derivative briefly reaches1.25;
  // the elevation slope stays .825..3.575 rather than jumping1.1→3.3.
  const rounded = band * u * u * (3 - 3 * u + u * u);
  return 2.2 * delta + 1.1 * rounded;
}
