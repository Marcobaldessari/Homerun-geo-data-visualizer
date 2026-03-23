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

// trailLength = arcDuration + arcFadeDelay keeps the full arc in the window during hold
const TRAIL_LENGTH = 400;

// Pre-compute bezier curve waypoints for an arc (cached on arc object to avoid per-frame recompute)
function computeArcWaypoints(arc) {
  if (arc._tripWaypoints) return arc._tripWaypoints;
  const { customerLng, customerLat, proLng, proLat, arcDuration, emittedAt } = arc;
  // Arc peak altitude in metres — only Z arches, X/Y stay on a straight line
  const MAX_ALT_M = 3000;
  const N = 20;
  const path = [];
  const timestamps = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const alt = 4 * MAX_ALT_M * t * (1 - t); // parabola: 0 at endpoints, MAX_ALT_M at midpoint
    path.push([
      customerLng + t * (proLng - customerLng), // straight line in X
      customerLat + t * (proLat - customerLat), // straight line in Y
      alt,
    ]);
    timestamps.push(emittedAt + t * arcDuration);
  }
  arc._tripWaypoints = { path, timestamps };
  return arc._tripWaypoints;
}

// ── Pulse helpers ──────────────────────────────────────────────────────────

const PULSE_DURATION = 1000;

// Quintic ease-out: fast start, decelerates sharply at the end
function easeOutQuint(t) { return 1 - Math.pow(1 - t, 5); }

function sourcePulseRadius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE_DURATION) return 0;
  return 4 + easeOutQuint(age / PULSE_DURATION) * 32;
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
  return 4 + easeOutQuint(t / PULSE_DURATION) * 32;
}
function destPulseAlpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const t = age - arc.arcDuration;
  if (t < 0 || t > PULSE_DURATION) return 0;
  return Math.round((1 - t / PULSE_DURATION) * 220);
}

export function buildLayers(activeArcs, virtualTime) {
  const { TripsLayer, ScatterplotLayer } = deck;

  // Main arc — comet draws source→dest, comet tail fades as it erases
  const tripsLayer = new TripsLayer({
    id: 'arcs-trips',
    data: activeArcs,
    getPath: d => computeArcWaypoints(d).path,
    getTimestamps: d => computeArcWaypoints(d).timestamps,
    getColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, 220];
    },
    positionFormat: 'XYZ',
    currentTime: virtualTime,
    trailLength: TRAIL_LENGTH,
    widthMinPixels: 3,
    fadeTrail: true,
  });

  // Glow layer
  const glowLayer = new TripsLayer({
    id: 'arcs-trips-glow',
    data: activeArcs,
    getPath: d => computeArcWaypoints(d).path,
    getTimestamps: d => computeArcWaypoints(d).timestamps,
    getColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, 40];
    },
    positionFormat: 'XYZ',
    currentTime: virtualTime,
    trailLength: TRAIL_LENGTH,
    widthMinPixels: 10,
    fadeTrail: true,
  });

  // Source pulse — radiates when arc starts (outline ring, no fill)
  const sourcePulseLayer = new ScatterplotLayer({
    id: 'source-pulse',
    data: activeArcs,
    getPosition: d => [d.customerLng, d.customerLat],
    getRadius: d => sourcePulseRadius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, sourcePulseAlpha(d, virtualTime)];
    },
    stroked: true,
    filled: false,
    getLineWidth: 1.5,
    lineWidthUnits: 'pixels',
    radiusUnits: 'pixels',
    updateTriggers: { getRadius: virtualTime, getLineColor: virtualTime },
  });

  // Destination pulse — radiates when line arrives (outline ring, no fill)
  const destPulseLayer = new ScatterplotLayer({
    id: 'dest-pulse',
    data: activeArcs,
    getPosition: d => [d.proLng, d.proLat],
    getRadius: d => destPulseRadius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      return [...col, destPulseAlpha(d, virtualTime)];
    },
    stroked: true,
    filled: false,
    getLineWidth: 1.5,
    lineWidthUnits: 'pixels',
    radiusUnits: 'pixels',
    updateTriggers: { getRadius: virtualTime, getLineColor: virtualTime },
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

  return [glowLayer, tripsLayer, originLayer, sourcePulseLayer, destPulseLayer];
}
