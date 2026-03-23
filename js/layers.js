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
const TRAIL_LENGTH = 6500;

// Pre-compute bezier curve waypoints for an arc (cached on arc object to avoid per-frame recompute)
function computeArcWaypoints(arc) {
  if (arc._tripWaypoints) return arc._tripWaypoints;
  const { customerLng, customerLat, proLng, proLat, arcDuration, emittedAt } = arc;
  const dLng = proLng - customerLng;
  const dLat = proLat - customerLat;
  const dist = Math.sqrt(dLng * dLng + dLat * dLat) || 1e-9;
  const elevate = dist * 0.35;
  // Control point: midpoint offset perpendicular to source→dest vector
  const ctrlLng = (customerLng + proLng) / 2 - (dLat / dist) * elevate;
  const ctrlLat = (customerLat + proLat) / 2 + (dLng / dist) * elevate;
  // Arc peak altitude in metres
  const MAX_ALT_M = 3000;
  const N = 20;
  const path = [];
  const timestamps = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const alt = 4 * MAX_ALT_M * t * (1 - t); // parabola: 0 at endpoints, MAX_ALT_M at midpoint
    path.push([
      (1 - t) * (1 - t) * customerLng + 2 * (1 - t) * t * ctrlLng + t * t * proLng,
      (1 - t) * (1 - t) * customerLat + 2 * (1 - t) * t * ctrlLat + t * t * proLat,
      alt,
    ]);
    timestamps.push(emittedAt + t * arcDuration);
  }
  arc._tripWaypoints = { path, timestamps };
  return arc._tripWaypoints;
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

  return [glowLayer, tripsLayer, originLayer, sourcePulseLayer, destPulseLayer];
}
