"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildLayers = buildLayers;
exports.CATEGORY_COLORS = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION SETTINGS — tweak these to adjust the visual behaviour
// ═══════════════════════════════════════════════════════════════════════════
// ── Comet ──────────────────────────────────────────────────────────────────
var COMET_WIDTH_PX = 5; // core line thickness in pixels

var COMET_ALPHA = 220; // core brightness (0–255)

var TRAIL_LENGTH = 400; // tail length in ms — shorter = faster fade-out
//   also controls how much of the arc is visible at once
// ── Glow ───────────────────────────────────────────────────────────────────

var GLOW_WIDTH_PX = 16; // glow halo thickness in pixels

var GLOW_ALPHA = 40; // glow brightness (0–255), keep well below COMET_ALPHA
// ── Arc shape ──────────────────────────────────────────────────────────────

var MAX_ALT_M = 3000; // peak altitude of the arch in metres

var ARC_WAYPOINTS = 20; // number of points along the arc (more = smoother curve)
// ── Pulse rings ────────────────────────────────────────────────────────────

var PULSE_DURATION = 800; // how long the ring expands, in ms

var PULSE_MIN_RADIUS = 4; // starting radius in pixels

var PULSE_MAX_RADIUS = 20; // ending radius in pixels

var PULSE_ALPHA = 250; // peak brightness of the ring (0–255)

var PULSE_WIDTH_PX = 2; // ring stroke thickness in pixels
// ═══════════════════════════════════════════════════════════════════════════
// Draw speed (arcDuration) and hold time (arcFadeDelay) are per-dataset:
//   js/data-istanbul.js  ~line 1165
//   js/data-milano.js    ~line 570
// ═══════════════════════════════════════════════════════════════════════════
// Color palette per service category

var CATEGORY_COLORS = {
  cleaning: {
    source: [0, 212, 255],
    target: [0, 102, 255]
  },
  repair: {
    source: [255, 107, 53],
    target: [255, 23, 68]
  },
  beauty: {
    source: [224, 64, 251],
    target: [255, 64, 129]
  },
  moving: {
    source: [105, 240, 174],
    target: [0, 188, 212]
  },
  education: {
    source: [255, 234, 0],
    target: [255, 145, 0]
  },
  events: {
    source: [255, 110, 64],
    target: [245, 0, 87]
  },
  other: {
    source: [176, 190, 197],
    target: [96, 125, 139]
  }
};
exports.CATEGORY_COLORS = CATEGORY_COLORS;

function categoryColor(category, type) {
  var c = CATEGORY_COLORS[category] || CATEGORY_COLORS.other;
  return type === "source" ? c.source : c.target;
} // ── Arc waypoints ──────────────────────────────────────────────────────────


function computeArcWaypoints(arc) {
  if (arc._tripWaypoints) return arc._tripWaypoints;
  var customerLng = arc.customerLng,
      customerLat = arc.customerLat,
      proLng = arc.proLng,
      proLat = arc.proLat,
      arcDuration = arc.arcDuration,
      emittedAt = arc.emittedAt;
  var path = [];
  var timestamps = [];

  for (var i = 0; i < ARC_WAYPOINTS; i++) {
    var t = i / (ARC_WAYPOINTS - 1);
    var alt = 4 * MAX_ALT_M * t * (1 - t); // parabola: 0 at endpoints, MAX_ALT_M at midpoint

    path.push([customerLng + t * (proLng - customerLng), // straight line in X
    customerLat + t * (proLat - customerLat), // straight line in Y
    alt]);
    timestamps.push(emittedAt + t * arcDuration);
  }

  arc._tripWaypoints = {
    path: path,
    timestamps: timestamps
  };
  return arc._tripWaypoints;
} // ── Pulse helpers ──────────────────────────────────────────────────────────
// Quintic ease-out: fast start, decelerates sharply at the end


function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5);
}

function sourcePulseRadius(arc, virtualTime) {
  var age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE_DURATION) return 0;
  return PULSE_MIN_RADIUS + easeOutQuint(age / PULSE_DURATION) * (PULSE_MAX_RADIUS - PULSE_MIN_RADIUS);
}

function sourcePulseAlpha(arc, virtualTime) {
  var age = virtualTime - arc.emittedAt;
  if (age < 0 || age > PULSE_DURATION) return 0;
  return Math.round((1 - age / PULSE_DURATION) * PULSE_ALPHA);
}

function destPulseRadius(arc, virtualTime) {
  var age = virtualTime - arc.emittedAt;
  var t = age - arc.arcDuration;
  if (t < 0 || t > PULSE_DURATION) return 0;
  return PULSE_MIN_RADIUS + easeOutQuint(t / PULSE_DURATION) * (PULSE_MAX_RADIUS - PULSE_MIN_RADIUS);
}

function destPulseAlpha(arc, virtualTime) {
  var age = virtualTime - arc.emittedAt;
  var t = age - arc.arcDuration;
  if (t < 0 || t > PULSE_DURATION) return 0;
  return Math.round((1 - t / PULSE_DURATION) * PULSE_ALPHA);
}

function buildLayers(activeArcs, virtualTime) {
  var _deck = deck,
      TripsLayer = _deck.TripsLayer,
      ScatterplotLayer = _deck.ScatterplotLayer; // Main arc — comet draws source→dest, comet tail fades as it erases

  var tripsLayer = new TripsLayer({
    id: "arcs-trips",
    data: activeArcs,
    getPath: function getPath(d) {
      return computeArcWaypoints(d).path;
    },
    getTimestamps: function getTimestamps(d) {
      return computeArcWaypoints(d).timestamps;
    },
    getColor: function getColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [COMET_ALPHA]);
    },
    positionFormat: "XYZ",
    currentTime: virtualTime,
    trailLength: TRAIL_LENGTH,
    widthMinPixels: COMET_WIDTH_PX,
    fadeTrail: true
  }); // Glow layer

  var glowLayer = new TripsLayer({
    id: "arcs-trips-glow",
    data: activeArcs,
    getPath: function getPath(d) {
      return computeArcWaypoints(d).path;
    },
    getTimestamps: function getTimestamps(d) {
      return computeArcWaypoints(d).timestamps;
    },
    getColor: function getColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [GLOW_ALPHA]);
    },
    positionFormat: "XYZ",
    currentTime: virtualTime,
    trailLength: TRAIL_LENGTH,
    widthMinPixels: GLOW_WIDTH_PX,
    fadeTrail: true
  }); // Source pulse — radiates when arc starts (outline ring, no fill)

  var sourcePulseLayer = new ScatterplotLayer({
    id: "source-pulse",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.customerLng, d.customerLat];
    },
    getRadius: function getRadius(d) {
      return sourcePulseRadius(d, virtualTime);
    },
    getFillColor: [0, 0, 0, 0],
    getLineColor: function getLineColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [sourcePulseAlpha(d, virtualTime)]);
    },
    stroked: true,
    filled: false,
    getLineWidth: PULSE_WIDTH_PX,
    lineWidthUnits: "pixels",
    radiusUnits: "pixels",
    updateTriggers: {
      getRadius: virtualTime,
      getLineColor: virtualTime
    }
  }); // Destination pulse — radiates when line arrives (outline ring, no fill)

  var destPulseLayer = new ScatterplotLayer({
    id: "dest-pulse",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.proLng, d.proLat];
    },
    getRadius: function getRadius(d) {
      return destPulseRadius(d, virtualTime);
    },
    getFillColor: [0, 0, 0, 0],
    getLineColor: function getLineColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [destPulseAlpha(d, virtualTime)]);
    },
    stroked: true,
    filled: false,
    getLineWidth: PULSE_WIDTH_PX,
    lineWidthUnits: "pixels",
    radiusUnits: "pixels",
    updateTriggers: {
      getRadius: virtualTime,
      getLineColor: virtualTime
    }
  });
  return [glowLayer, tripsLayer, sourcePulseLayer, destPulseLayer];
}