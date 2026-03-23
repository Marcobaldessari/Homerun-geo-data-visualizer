// Color palette per service category
export const CATEGORY_COLORS = {
  cleaning:  { source: [0,   212, 255], target: [0,   102, 255] },
  repair:    { source: [255, 107,  53], target: [255,  23,  68] },
  beauty:    { source: [224,  64, 251], target: [255,  64, 129] },
  moving:    { source: [105, 240, 174], target: [0,   188, 212] },
  education: { source: [255, 234,   0], target: [255, 145,   0] },
  events:    { source: [255, 110,  64], target: [245,   0,  87] },
  other:     { source: [176, 190, 197], target: [ 96, 125, 139] },
};

function categoryColor(category, type) {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return type === 'source' ? c.source : c.target;
}

// ── Arc position animation ─────────────────────────────────────────────────
// Draw phase: target moves src→dst. Erase phase: source moves src→dst.

function arcSourcePos(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const { arcDuration, arcFadeDelay } = arc;
  const src = [arc.customerLng, arc.customerLat];
  const dst = [arc.proLng, arc.proLat];

  const eraseStart = arcDuration + arcFadeDelay;
  if (age < eraseStart) return src;

  const t = Math.min((age - eraseStart) / 500, 1);
  return [src[0] + (dst[0] - src[0]) * t, src[1] + (dst[1] - src[1]) * t];
}

function arcTargetPos(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const { arcDuration } = arc;
  const src = [arc.customerLng, arc.customerLat];
  const dst = [arc.proLng, arc.proLat];

  if (age <= 0) return src;
  if (age >= arcDuration) return dst;

  const t = age / arcDuration;
  return [src[0] + (dst[0] - src[0]) * t, src[1] + (dst[1] - src[1]) * t];
}

// Full opacity during draw + hold; fades out during erase (500ms)
function arcOpacity(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const { arcDuration, arcFadeDelay } = arc;

  if (age < 0) return 0;
  if (age <= arcDuration + arcFadeDelay) return 1;

  const fadeOut = (age - arcDuration - arcFadeDelay) / 500;
  return Math.max(0, 1 - fadeOut);
}

// ── Pulse helpers ──────────────────────────────────────────────────────────

const PULSE_DURATION = 1200; // ms each pulse lasts

// Source pulse: radiates when arc first appears (age 0)
function sourcePulseRadius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE_DURATION) return 0;
  return 6 + (age / PULSE_DURATION) * 28;
}
function sourcePulseAlpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE_DURATION) return 0;
  return Math.round((1 - age / PULSE_DURATION) * 220);
}

// Destination pulse: radiates when the line arrives (age = arcDuration)
function destPulseRadius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const t = age - arc.arcDuration;
  if (t < 0 || t > PULSE_DURATION) return 0;
  return 6 + (t / PULSE_DURATION) * 28;
}
function destPulseAlpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const t = age - arc.arcDuration;
  if (t < 0 || t > PULSE_DURATION) return 0;
  return Math.round((1 - t / PULSE_DURATION) * 220);
}

export function buildLayers(activeArcs, virtualTime) {
  const { ArcLayer, ScatterplotLayer } = deck;

  const HEIGHT = d => {
    const crossesBosphorus = (d.customerLng < 28.97) !== (d.proLng < 28.97);
    return crossesBosphorus ? 1.0 : 0.35;
  };

  // Main arc layer — positions animated each frame
  const arcLayer = new ArcLayer({
    id: 'arcs',
    data: activeArcs,
    getSourcePosition: d => arcSourcePos(d, virtualTime),
    getTargetPosition: d => arcTargetPos(d, virtualTime),
    getSourceColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, Math.round(arcOpacity(d, virtualTime) * 220)];
    },
    getTargetColor: d => {
      const col = categoryColor(d.serviceCategory, 'target');
      return [...col, Math.round(arcOpacity(d, virtualTime) * 220)];
    },
    getWidth: 3,
    getHeight: HEIGHT,
    updateTriggers: {
      getSourcePosition: virtualTime,
      getTargetPosition: virtualTime,
      getSourceColor: virtualTime,
      getTargetColor: virtualTime,
    },
  });

  // Glow layer
  const glowLayer = new ArcLayer({
    id: 'arcs-glow',
    data: activeArcs,
    getSourcePosition: d => arcSourcePos(d, virtualTime),
    getTargetPosition: d => arcTargetPos(d, virtualTime),
    getSourceColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, Math.round(arcOpacity(d, virtualTime) * 45)];
    },
    getTargetColor: d => {
      const col = categoryColor(d.serviceCategory, 'target');
      return [...col, Math.round(arcOpacity(d, virtualTime) * 45)];
    },
    getWidth: 12,
    getHeight: HEIGHT,
    updateTriggers: {
      getSourcePosition: virtualTime,
      getTargetPosition: virtualTime,
      getSourceColor: virtualTime,
      getTargetColor: virtualTime,
    },
  });

  // Source pulse — radiates when arc starts
  const sourcePulseLayer = new ScatterplotLayer({
    id: 'source-pulse',
    data: activeArcs,
    getPosition: d => [d.customerLng, d.customerLat],
    getRadius: d => sourcePulseRadius(d, virtualTime),
    getFillColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, sourcePulseAlpha(d, virtualTime)];
    },
    radiusUnits: 'pixels',
    updateTriggers: {
      getRadius: virtualTime,
      getFillColor: virtualTime,
    },
  });

  // Destination pulse — radiates when line arrives
  const destPulseLayer = new ScatterplotLayer({
    id: 'dest-pulse',
    data: activeArcs,
    getPosition: d => [d.proLng, d.proLat],
    getRadius: d => destPulseRadius(d, virtualTime),
    getFillColor: d => {
      const col = categoryColor(d.serviceCategory, 'target');
      return [...col, destPulseAlpha(d, virtualTime)];
    },
    radiusUnits: 'pixels',
    updateTriggers: {
      getRadius: virtualTime,
      getFillColor: virtualTime,
    },
  });

  // Static origin dot at customer location
  const originLayer = new ScatterplotLayer({
    id: 'origin-dots',
    data: activeArcs,
    getPosition: d => [d.customerLng, d.customerLat],
    getRadius: 5,
    getFillColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, Math.round(arcOpacity(d, virtualTime) * 200)];
    },
    radiusUnits: 'pixels',
    updateTriggers: {
      getFillColor: virtualTime,
    },
  });

  return [glowLayer, arcLayer, originLayer, sourcePulseLayer, destPulseLayer];
}
