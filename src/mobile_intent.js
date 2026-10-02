/** Input distance compensation only: never adds forces, energy, or sword steering. */
export const MOBILE_VERTICAL_GAIN = Object.freeze({ default: 1.35, min: 1, max: 1.8 });

function validGain(value) {
  return Number.isFinite(value) && value >= MOBILE_VERTICAL_GAIN.min && value <= MOBILE_VERTICAL_GAIN.max;
}

/** URL override is session-local; 1 restores the original touch mapping. */
export function configureMobileIntent(params, fallback = MOBILE_VERTICAL_GAIN.default) {
  const defaultGain = validGain(fallback) ? fallback : MOBILE_VERTICAL_GAIN.default;
  const raw = params.get('mobileVerticalGain');
  const text = typeof raw === 'string' ? raw.trim() : '';
  const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN;
  const override = validGain(number);
  return { verticalGain: override ? number : defaultGain, source: override ? 'url' : 'default' };
}

/**
 * Convert the unlocked pointer path from screen pixels to relative hand intent (m).
 * Touch alone gets the bounded Y gain; mouse fallback and pen retain legacy scaling.
 * Constant gain preserves event partitioning and stops exactly when input stops.
 * Tap distance and visual touch trails must continue using original client pixels.
 */
export function mapMobileHandDelta({ dx, dy, height, sensitivity, pointerType, verticalGain = MOBILE_VERTICAL_GAIN.default }) {
  const scale = sensitivity / Math.max(320, height);
  const gain = pointerType === 'touch' && validGain(verticalGain) ? verticalGain : 1;
  return { x: dx * scale, y: -dy * scale * gain };
}
