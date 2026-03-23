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
// Draw phase:  target slides from customer → pro over arcDuration
// Hold phase:  full arc visible for arcFadeDelay
// Erase phase: source slides from customer → pro over arcDuration

function getArcPositions(arc, virtualTime) {
  const { arcDuration, arcFadeDelay,
          customerLat, customerLng, proLat, proLng } = arc;
  const age = virtualTime - arc.emittedAt;

  let srcLng = customerLng, srcLat = customerLat;
  let dstLng = proLng,      dstLat = proLat;

  if (age < arcDuration) {
    const t = Math.max(0, age) / arcDuration;
    dstLng = customerLng + t * (proLng - customerLng);
    dstLat = customerLat + t * (proLat - customerLat);
  } else if (age > arcDuration + arcFadeDelay) {
    const t = Math.min((age - arcDuration - arcFadeDelay) / arcDuration, 1.0);
    srcLng = customerLng + t * (proLng - customerLng);
    srcLat = customerLat + t * (proLat - customerLat);
  }

  return { src: [srcLng, srcLat], dst: [dstLng, dstLat] };
}

// ── Pulse helpers ──────────────────────────────────────────────────────────

const PULSE_DURATION = 1200;

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

  // Main arc — ArcLayer computes elevation in its own shader (getHeight × distance),
  // bypassing the altitude-projection pipeline that doesn't work with MapboxOverlay.
  const arcLayer = new ArcLayer({
    id: 'arcs-main',
    data: activeArcs,
    getSourcePosition: d => getArcPositions(d, virtualTime).src,
    getTargetPosition: d => getArcPositions(d, virtualTime).dst,
    getHeight: 0.5,
    getWidth: 3,
    widthUnits: 'pixels',
    getSourceColor: d => [...categoryColor(d.serviceCategory, 'source'), 220],
    getTargetColor: d => [...categoryColor(d.serviceCategory, 'target'), 220],
    updateTriggers: {
      getSourcePosition: virtualTime,
      getTargetPosition: virtualTime,
    },
  });

  // Glow layer — wider, low-alpha version of the same arc
  const glowLayer = new ArcLayer({
    id: 'arcs-glow',
    data: activeArcs,
    getSourcePosition: d => getArcPositions(d, virtualTime).src,
    getTargetPosition: d => getArcPositions(d, virtualTime).dst,
    getHeight: 0.5,
    getWidth: 10,
    widthUnits: 'pixels',
    getSourceColor: d => [...categoryColor(d.serviceCategory, 'source'), 40],
    getTargetColor: d => [...categoryColor(d.serviceCategory, 'target'), 40],
    updateTriggers: {
      getSourcePosition: virtualTime,
      getTargetPosition: virtualTime,
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
    updateTriggers: { getRadius: virtualTime, getFillColor: virtualTime },
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
    updateTriggers: { getRadius: virtualTime, getFillColor: virtualTime },
  });

  // Static origin dot at customer location
  const originLayer = new ScatterplotLayer({
    id: 'origin-dots',
    data: activeArcs,
    getPosition: d => [d.customerLng, d.customerLat],
    getRadius: 5,
    getFillColor: d => [...categoryColor(d.serviceCategory, 'source'), 180],
    radiusUnits: 'pixels',
  });

  return [glowLayer, arcLayer, originLayer, sourcePulseLayer, destPulseLayer];
}
