// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION SETTINGS — tweak these to adjust the visual behaviour
// ═══════════════════════════════════════════════════════════════════════════

// ── Comet ──────────────────────────────────────────────────────────────────
const COMET_WIDTH_PX = 7; // core line thickness in pixels (desktop)
const COMET_WIDTH_PX_MOBILE = 3; // core line thickness in pixels (mobile)
const COMET_ALPHA = 255; // core brightness (0–255)
export const TRAIL_LENGTH = 900; // tail length in ms — must be ≤ arcDuration for a
//   true comet look; if larger than arcDuration the whole arc is always visible

// ── Glow ───────────────────────────────────────────────────────────────────
const GLOW_WIDTH_PX = 16; // glow halo thickness in pixels
const GLOW_ALPHA = 40; // glow brightness (0–255), keep well below COMET_ALPHA

// ── Arc shape ──────────────────────────────────────────────────────────────
const ALT_SCALE = 0.19; // peak altitude as a fraction of arc length (longer arc → higher arch)
const ARC_WAYPOINTS = 20; // number of points along the arc (more = smoother curve)

// ── Pulse rings ────────────────────────────────────────────────────────────
const PULSE_DURATION = 800; // how long the ring expands, in ms
const PULSE_MIN_RADIUS = 4; // starting radius in pixels
const PULSE_MAX_RADIUS = 20; // ending radius in pixels
const PULSE_ALPHA = 250; // peak brightness of the ring (0–255)
const PULSE_WIDTH_PX = 2; // ring stroke thickness in pixels

// Second pulse ring — faster, reaches further, softer
const PULSE2_DURATION = 480; // expands quicker
const PULSE2_MAX_RADIUS = 30; // goes further out
const PULSE2_ALPHA = 110; // dimmer
const PULSE2_WIDTH_PX = 1; // thinner stroke

// ── Blob circles ───────────────────────────────────────────────────────────
const BLOB_MAX_RADIUS = 7; // peak radius of the filled circle in pixels
const BLOB_EXPAND_MS = TRAIL_LENGTH; // duration of the elastic expand phase in ms
const BLOB_SHRINK_MS = 200; // duration of the shrink + fade-out phase in ms
const BLOB_ALPHA = 220; // peak fill opacity (0–255)

// ── Light flash ────────────────────────────────────────────────────────────
// Three concentric white circles (outer → core) faked radial gradient,
// rendered with additive blending so they brighten the map underneath.
const FLASH_ENABLED = false; // set to false to disable the flash entirely
const FLASH_DURATION = 300; // total lifetime of the flash in ms
const FLASH_RISE_MS = 60; // how quickly it reaches peak brightness
const FLASH_OUTER_R = 16; // outermost ring radius in pixels
const FLASH_MID_R = 12; // mid ring radius in pixels
const FLASH_CORE_R = 9; // bright core radius in pixels
const FLASH_OUTER_A = 60; // peak alpha of outer ring  (0–255)
const FLASH_MID_A = 130; // peak alpha of mid ring    (0–255)
const FLASH_CORE_A = 220; // peak alpha of core        (0–255)

// ═══════════════════════════════════════════════════════════════════════════
// Draw speed (arcDuration) and hold time (arcFadeDelay) are per-dataset:
//   js/data-istanbul.js  ~line 1165
//   js/data-milano.js    ~line 570
// ═══════════════════════════════════════════════════════════════════════════

const IS_MOBILE = window.innerWidth <= 768;

// Color palette per service category — sourced from Homerun Olympus Design System
// https://www.figma.com/design/gWdvUQKkgSaV1sHX5QjbCG/Homerun---Olympus-Design-System?node-id=3289-90
export const CATEGORY_COLORS = {
  cleaning: { source: [115, 198, 255] }, // PoseidonBlue/600   #73C6FF
  repair: { source: [236, 112, 44] }, // NotificationOrange/300  #EC702C
  beauty: { source: [255, 135, 114] }, // AphroditePink/600  #FF8772
  moving: { source: [211, 237, 113] }, // DemeterGreen/300   #D3ED71
  education: { source: [255, 195, 45] }, // ApolloYellow/600   #FFC32D
  events: { source: [153, 160, 255] }, // DionysusPurple/600 #99A0FF
  other: { source: [106, 116, 130] }, // Grey/300           #6A7482
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
  const dLng = proLng - customerLng;
  const dLat = proLat - customerLat;
  const distM = Math.sqrt(dLng * dLng + dLat * dLat) * 111000; // approx metres (1° ≈ 111 km)
  const peakAlt = distM * ALT_SCALE;
  const path = [];
  const timestamps = [];
  for (let i = 0; i < ARC_WAYPOINTS; i++) {
    const t = i / (ARC_WAYPOINTS - 1); // position along arc (0→1)
    const timeFraction = t; // linear — the parabolic altitude already provides organic rhythm
    const alt = 4 * peakAlt * t * (1 - t); // parabola: 0 at endpoints, peakAlt at midpoint
    path.push([
      customerLng + t * (proLng - customerLng), // straight line in X
      customerLat + t * (proLat - customerLat), // straight line in Y
      alt,
    ]);
    timestamps.push(emittedAt + timeFraction * arcDuration);
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
  return (1 - t * (2 - t)) * BLOB_MAX_RADIUS; // easeOutQuad: fast start, gentle finish
}

function blobAlpha(age) {
  if (age < 0) return 0;
  const total = BLOB_EXPAND_MS + BLOB_SHRINK_MS;
  if (age > total) return 0;
  return BLOB_ALPHA;
}

function flashAlpha(age, peakAlpha) {
  if (age < 0 || age > FLASH_DURATION) return 0;
  const t = age / FLASH_DURATION;
  const rise = Math.min(age / FLASH_RISE_MS, 1);
  return Math.round(rise * (1 - t) * peakAlpha);
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

function sourcePulse2Radius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE2_DURATION) return 0;
  return (
    PULSE_MIN_RADIUS +
    easeOutQuint(age / PULSE2_DURATION) * (PULSE2_MAX_RADIUS - PULSE_MIN_RADIUS)
  );
}
function sourcePulse2Alpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE2_DURATION) return 0;
  return Math.round((1 - age / PULSE2_DURATION) * PULSE2_ALPHA);
}

function destPulse2Radius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const t = age - arc.arcDuration;
  if (t < 0 || t > PULSE2_DURATION) return 0;
  return (
    PULSE_MIN_RADIUS +
    easeOutQuint(t / PULSE2_DURATION) * (PULSE2_MAX_RADIUS - PULSE_MIN_RADIUS)
  );
}
function destPulse2Alpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const t = age - arc.arcDuration;
  if (t < 0 || t > PULSE2_DURATION) return 0;
  return Math.round((1 - t / PULSE2_DURATION) * PULSE2_ALPHA);
}

export function buildLayers(
  activeArcs,
  activeQuotes,
  virtualTime,
  { showRequests = true, showQuotes = true } = {},
) {
  const { TripsLayer, ScatterplotLayer } = deck;
  const ADDITIVE = { blend: true, blendFunc: [770, 1] }; // SRC_ALPHA + ONE

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

  const sourcePulse2Layer = new ScatterplotLayer({
    id: "source-pulse-2",
    data: activeArcs,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: (d) => sourcePulse2Radius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      sourcePulse2Alpha(d, virtualTime),
    ],
    stroked: true,
    filled: false,
    getLineWidth: PULSE2_WIDTH_PX,
    lineWidthUnits: "pixels",
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getLineColor: virtualTime },
  });

  const destPulse2Layer = new ScatterplotLayer({
    id: "dest-pulse-2",
    data: activeArcs,
    getPosition: (d) => [d.proLng, d.proLat],
    getRadius: (d) => destPulse2Radius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      destPulse2Alpha(d, virtualTime),
    ],
    stroked: true,
    filled: false,
    getLineWidth: PULSE2_WIDTH_PX,
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

  // Source flash — 3 concentric white circles at arc origin, additive blend
  const srcFlashOuter = new ScatterplotLayer({
    id: "src-flash-outer",
    data: activeArcs,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: () => FLASH_OUTER_R,
    getFillColor: (d) => [
      255,
      255,
      255,
      flashAlpha(virtualTime - d.emittedAt, FLASH_OUTER_A),
    ],
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: { getFillColor: virtualTime },
  });
  const srcFlashMid = new ScatterplotLayer({
    id: "src-flash-mid",
    data: activeArcs,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: () => FLASH_MID_R,
    getFillColor: (d) => [
      255,
      255,
      255,
      flashAlpha(virtualTime - d.emittedAt, FLASH_MID_A),
    ],
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: { getFillColor: virtualTime },
  });
  const srcFlashCore = new ScatterplotLayer({
    id: "src-flash-core",
    data: activeArcs,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: () => FLASH_CORE_R,
    getFillColor: (d) => [
      255,
      255,
      255,
      flashAlpha(virtualTime - d.emittedAt, FLASH_CORE_A),
    ],
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: { getFillColor: virtualTime },
  });

  // Dest flash — same 3 circles at arc destination, triggered at arcDuration
  const dstFlashOuter = new ScatterplotLayer({
    id: "dst-flash-outer",
    data: activeArcs,
    getPosition: (d) => [d.proLng, d.proLat],
    getRadius: () => FLASH_OUTER_R,
    getFillColor: (d) => [
      255,
      255,
      255,
      flashAlpha(virtualTime - d.emittedAt - d.arcDuration, FLASH_OUTER_A),
    ],
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: { getFillColor: virtualTime },
  });
  const dstFlashMid = new ScatterplotLayer({
    id: "dst-flash-mid",
    data: activeArcs,
    getPosition: (d) => [d.proLng, d.proLat],
    getRadius: () => FLASH_MID_R,
    getFillColor: (d) => [
      255,
      255,
      255,
      flashAlpha(virtualTime - d.emittedAt - d.arcDuration, FLASH_MID_A),
    ],
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: { getFillColor: virtualTime },
  });
  const dstFlashCore = new ScatterplotLayer({
    id: "dst-flash-core",
    data: activeArcs,
    getPosition: (d) => [d.proLng, d.proLat],
    getRadius: () => FLASH_CORE_R,
    getFillColor: (d) => [
      255,
      255,
      255,
      flashAlpha(virtualTime - d.emittedAt - d.arcDuration, FLASH_CORE_A),
    ],
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: { getFillColor: virtualTime },
  });

  // ── Quote arcs (pro → job location) ─────────────────────────────────────
  const quoteTripsLayer = new TripsLayer({
    id: "quotes-trips",
    data: activeQuotes,
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

  const quoteGlowLayer = new TripsLayer({
    id: "quotes-trips-glow",
    data: activeQuotes,
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

  const quoteSourcePulse = new ScatterplotLayer({
    id: "quote-source-pulse",
    data: activeQuotes,
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

  const quoteDestPulse = new ScatterplotLayer({
    id: "quote-dest-pulse",
    data: activeQuotes,
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

  const quoteSourcePulse2 = new ScatterplotLayer({
    id: "quote-source-pulse-2",
    data: activeQuotes,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: (d) => sourcePulse2Radius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      sourcePulse2Alpha(d, virtualTime),
    ],
    stroked: true,
    filled: false,
    getLineWidth: PULSE2_WIDTH_PX,
    lineWidthUnits: "pixels",
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getLineColor: virtualTime },
  });

  const quoteDestPulse2 = new ScatterplotLayer({
    id: "quote-dest-pulse-2",
    data: activeQuotes,
    getPosition: (d) => [d.proLng, d.proLat],
    getRadius: (d) => destPulse2Radius(d, virtualTime),
    getFillColor: [0, 0, 0, 0],
    getLineColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      destPulse2Alpha(d, virtualTime),
    ],
    stroked: true,
    filled: false,
    getLineWidth: PULSE2_WIDTH_PX,
    lineWidthUnits: "pixels",
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getLineColor: virtualTime },
  });

  const quoteSourceBlob = new ScatterplotLayer({
    id: "quote-source-blob",
    data: activeQuotes,
    getPosition: (d) => [d.customerLng, d.customerLat],
    getRadius: (d) => blobRadius(virtualTime - d.emittedAt),
    getFillColor: (d) => [
      ...categoryColor(d.serviceCategory, "source"),
      blobAlpha(virtualTime - d.emittedAt),
    ],
    radiusUnits: "pixels",
    updateTriggers: { getRadius: virtualTime, getFillColor: virtualTime },
  });

  const quoteDestBlob = new ScatterplotLayer({
    id: "quote-dest-blob",
    data: activeQuotes,
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
    ...(showRequests ? [glowLayer, tripsLayer] : []),
    ...(showRequests && FLASH_ENABLED
      ? [
          srcFlashOuter,
          srcFlashMid,
          srcFlashCore,
          dstFlashOuter,
          dstFlashMid,
          dstFlashCore,
        ]
      : []),
    ...(showRequests
      ? [
          sourceBlobLayer,
          destBlobLayer,
          sourcePulse2Layer,
          destPulse2Layer,
          sourcePulseLayer,
          destPulseLayer,
        ]
      : []),
    ...(showQuotes
      ? [
          quoteGlowLayer,
          quoteTripsLayer,
          quoteSourceBlob,
          quoteDestBlob,
          quoteSourcePulse2,
          quoteDestPulse2,
          quoteSourcePulse,
          quoteDestPulse,
        ]
      : []),
  ];
}
