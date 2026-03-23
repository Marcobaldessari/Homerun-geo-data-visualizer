// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION SETTINGS — tweak these to adjust the visual behaviour
// ═══════════════════════════════════════════════════════════════════════════

// ── Comet ──────────────────────────────────────────────────────────────────
const COMET_WIDTH_PX        = 5; // core line thickness in pixels (desktop)
const COMET_WIDTH_PX_MOBILE = 3; // core line thickness in pixels (mobile)
const COMET_ALPHA = 220; // core brightness (0–255)
const TRAIL_LENGTH = 1100; // tail length in ms — shorter = faster fade-out
//   also controls how much of the arc is visible at once

// ── Glow ───────────────────────────────────────────────────────────────────
const GLOW_WIDTH_PX = 16; // glow halo thickness in pixels
const GLOW_ALPHA = 40; // glow brightness (0–255), keep well below COMET_ALPHA

// ── Arc shape ──────────────────────────────────────────────────────────────
const MAX_ALT_M = 3000; // peak altitude of the arch in metres
const ARC_WAYPOINTS = 20; // number of points along the arc (more = smoother curve)

// ── Pulse rings ────────────────────────────────────────────────────────────
const PULSE_DURATION = 800; // how long the ring expands, in ms
const PULSE_MIN_RADIUS = 4; // starting radius in pixels
const PULSE_MAX_RADIUS = 20; // ending radius in pixels
const PULSE_ALPHA = 250; // peak brightness of the ring (0–255)
const PULSE_WIDTH_PX = 2; // ring stroke thickness in pixels

// ── Blob circles ───────────────────────────────────────────────────────────
const BLOB_MAX_RADIUS = 5; // peak radius of the filled circle in pixels
const BLOB_EXPAND_MS = 900; // duration of the elastic expand phase in ms
const BLOB_SHRINK_MS = 1000; // duration of the shrink + fade-out phase in ms
const BLOB_ALPHA = 220; // peak fill opacity (0–255)

// ═══════════════════════════════════════════════════════════════════════════
// Draw speed (arcDuration) and hold time (arcFadeDelay) are per-dataset:
//   js/data-istanbul.js  ~line 1165
//   js/data-milano.js    ~line 570
// ═══════════════════════════════════════════════════════════════════════════

const IS_MOBILE = window.innerWidth <= 768;

// Color palette per service category
export const CATEGORY_COLORS = {
  cleaning: { source: [0, 212, 255], target: [0, 102, 255] },
  repair: { source: [255, 107, 53], target: [255, 23, 68] },
  beauty: { source: [224, 64, 251], target: [255, 64, 129] },
  moving: { source: [105, 240, 174], target: [0, 188, 212] },
  education: { source: [255, 234, 0], target: [255, 145, 0] },
  events: { source: [255, 110, 64], target: [245, 0, 87] },
  other: { source: [176, 190, 197], target: [96, 125, 139] },
};

function categoryColor(category, type) {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return type === "source" ? c.source : c.target;
}

// ── Arc waypoints ──────────────────────────────────────────────────────────

function computeArcWaypoints(arc) {
  if (arc._tripWaypoints) return arc._tripWaypoints;
  const { customerLng, customerLat, proLng, proLat, arcDuration, emittedAt } =
    arc;
  const path = [];
  const timestamps = [];
  for (let i = 0; i < ARC_WAYPOINTS; i++) {
    const t = i / (ARC_WAYPOINTS - 1);
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

// Quintic ease-out: fast start, decelerates sharply at the end
function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

// Elastic ease-out: overshoots then settles — used for blob expand
function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function blobRadius(age) {
  if (age < 0) return 0;
  if (age < BLOB_EXPAND_MS)
    return easeOutElastic(age / BLOB_EXPAND_MS) * BLOB_MAX_RADIUS;
  const t = (age - BLOB_EXPAND_MS) / BLOB_SHRINK_MS;
  if (t > 1) return 0;
  return (1 - easeOutQuint(t)) * BLOB_MAX_RADIUS;
}

function blobAlpha(age) {
  if (age < 0) return 0;
  if (age < BLOB_EXPAND_MS) return BLOB_ALPHA;
  const t = (age - BLOB_EXPAND_MS) / BLOB_SHRINK_MS;
  if (t > 1) return 0;
  return Math.round((1 - t) * BLOB_ALPHA);
}

function sourcePulseRadius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE_DURATION) return 0;
  return (
    PULSE_MIN_RADIUS +
    easeOutQuint(age / PULSE_DURATION) * (PULSE_MAX_RADIUS - PULSE_MIN_RADIUS)
  );
}
function sourcePulseAlpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE_DURATION) return 0;
  return Math.round((1 - age / PULSE_DURATION) * PULSE_ALPHA);
}

function destPulseRadius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const t = age - arc.arcDuration;
  if (t < 0 || t > PULSE_DURATION) return 0;
  return (
    PULSE_MIN_RADIUS +
    easeOutQuint(t / PULSE_DURATION) * (PULSE_MAX_RADIUS - PULSE_MIN_RADIUS)
  );
}
function destPulseAlpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const t = age - arc.arcDuration;
  if (t < 0 || t > PULSE_DURATION) return 0;
  return Math.round((1 - t / PULSE_DURATION) * PULSE_ALPHA);
}

export function buildLayers(activeArcs, virtualTime) {
  const { TripsLayer, ScatterplotLayer } = deck;

  // Main arc — comet draws source→dest, comet tail fades as it erases
  const tripsLayer = new TripsLayer({
    id: "arcs-trips",
    data: activeArcs,
    getPath: (d) => computeArcWaypoints(d).path,
    getTimestamps: (d) => computeArcWaypoints(d).timestamps,
    getColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      COMET_ALPHA,
    ],
    positionFormat: "XYZ",
    currentTime: virtualTime,
    trailLength: TRAIL_LENGTH,
    widthMinPixels: IS_MOBILE ? COMET_WIDTH_PX_MOBILE : COMET_WIDTH_PX,
    fadeTrail: true,
  });

  // Glow layer
  const glowLayer = new TripsLayer({
    id: "arcs-trips-glow",
    data: activeArcs,
    getPath: (d) => computeArcWaypoints(d).path,
    getTimestamps: (d) => computeArcWaypoints(d).timestamps,
    getColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      GLOW_ALPHA,
    ],
    positionFormat: "XYZ",
    currentTime: virtualTime,
    trailLength: TRAIL_LENGTH,
    widthMinPixels: GLOW_WIDTH_PX,
    fadeTrail: true,
  });

  // Source pulse — radiates when arc starts (outline ring, no fill)
  const sourcePulseLayer = new ScatterplotLayer({
    id: "source-pulse",
    data: activeArcs,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: (d) => sourcePulseRadius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      sourcePulseAlpha(d, virtualTime),
    ],
    stroked: true,
    filled: false,
    getLineWidth: PULSE_WIDTH_PX,
    lineWidthUnits: "pixels",
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getLineColor: virtualTime },
  });

  // Destination pulse — radiates when line arrives (outline ring, no fill)
  const destPulseLayer = new ScatterplotLayer({
    id: "dest-pulse",
    data: activeArcs,
    getPosition: (d) => [d.proLng, d.proLat],
    getRadius: (d) => destPulseRadius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      destPulseAlpha(d, virtualTime),
    ],
    stroked: true,
    filled: false,
    getLineWidth: PULSE_WIDTH_PX,
    lineWidthUnits: "pixels",
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getLineColor: virtualTime },
  });

  // Source blob — filled circle that elastically expands then shrinks+fades at arc origin
  const sourceBlobLayer = new ScatterplotLayer({
    id: "source-blob",
    data: activeArcs,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: (d) => blobRadius(virtualTime - d.emittedAt),
    getFillColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      blobAlpha(virtualTime - d.emittedAt),
    ],
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getFillColor: virtualTime },
  });

  // Dest blob — same effect, triggered when the comet arrives
  const destBlobLayer = new ScatterplotLayer({
    id: "dest-blob",
    data: activeArcs,
    getPosition: (d) => [d.proLng, d.proLat],
    getRadius: (d) => blobRadius(virtualTime - d.emittedAt - d.arcDuration),
    getFillColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      blobAlpha(virtualTime - d.emittedAt - d.arcDuration),
    ],
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getFillColor: virtualTime },
  });

  return [
    glowLayer,
    tripsLayer,
    sourceBlobLayer,
    destBlobLayer,
    sourcePulseLayer,
    destPulseLayer,
  ];
}
