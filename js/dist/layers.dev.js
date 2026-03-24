"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildLayers = buildLayers;
exports.CATEGORY_COLORS = exports.TRAIL_LENGTH = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION SETTINGS — tweak these to adjust the visual behaviour
// ═══════════════════════════════════════════════════════════════════════════
// ── Comet ──────────────────────────────────────────────────────────────────
var COMET_WIDTH_PX = 7; // core line thickness in pixels (desktop)

var COMET_WIDTH_PX_MOBILE = 3; // core line thickness in pixels (mobile)

var COMET_ALPHA = 220; // core brightness (0–255)

var TRAIL_LENGTH = 900; // tail length in ms — must be ≤ arcDuration for a
//   true comet look; if larger than arcDuration the whole arc is always visible
// ── Glow ───────────────────────────────────────────────────────────────────

exports.TRAIL_LENGTH = TRAIL_LENGTH;
var GLOW_WIDTH_PX = 16; // glow halo thickness in pixels

var GLOW_ALPHA = 40; // glow brightness (0–255), keep well below COMET_ALPHA
// ── Arc shape ──────────────────────────────────────────────────────────────

var ALT_SCALE = 0.19; // peak altitude as a fraction of arc length (longer arc → higher arch)

var ARC_WAYPOINTS = 20; // number of points along the arc (more = smoother curve)
// ── Pulse rings ────────────────────────────────────────────────────────────

var PULSE_DURATION = 800; // how long the ring expands, in ms

var PULSE_MIN_RADIUS = 4; // starting radius in pixels

var PULSE_MAX_RADIUS = 20; // ending radius in pixels

var PULSE_ALPHA = 250; // peak brightness of the ring (0–255)

var PULSE_WIDTH_PX = 2; // ring stroke thickness in pixels
// ── Blob circles ───────────────────────────────────────────────────────────

var BLOB_MAX_RADIUS = 7; // peak radius of the filled circle in pixels

var BLOB_EXPAND_MS = TRAIL_LENGTH; // duration of the elastic expand phase in ms

var BLOB_SHRINK_MS = 200; // duration of the shrink + fade-out phase in ms

var BLOB_ALPHA = 220; // peak fill opacity (0–255)
// ── Light flash ────────────────────────────────────────────────────────────
// Three concentric white circles (outer → core) faked radial gradient,
// rendered with additive blending so they brighten the map underneath.

var FLASH_ENABLED = false; // set to false to disable the flash entirely

var FLASH_DURATION = 300; // total lifetime of the flash in ms

var FLASH_RISE_MS = 60; // how quickly it reaches peak brightness

var FLASH_OUTER_R = 16; // outermost ring radius in pixels

var FLASH_MID_R = 12; // mid ring radius in pixels

var FLASH_CORE_R = 9; // bright core radius in pixels

var FLASH_OUTER_A = 60; // peak alpha of outer ring  (0–255)

var FLASH_MID_A = 130; // peak alpha of mid ring    (0–255)

var FLASH_CORE_A = 220; // peak alpha of core        (0–255)
// ═══════════════════════════════════════════════════════════════════════════
// Draw speed (arcDuration) and hold time (arcFadeDelay) are per-dataset:
//   js/data-istanbul.js  ~line 1165
//   js/data-milano.js    ~line 570
// ═══════════════════════════════════════════════════════════════════════════

var IS_MOBILE = window.innerWidth <= 768; // Color palette per service category — sourced from Homerun Olympus Design System
// https://www.figma.com/design/gWdvUQKkgSaV1sHX5QjbCG/Homerun---Olympus-Design-System?node-id=3289-90

var CATEGORY_COLORS = {
  cleaning: {
    source: [115, 198, 255]
  },
  // PoseidonBlue/600   #73C6FF
  repair: {
    source: [236, 112, 44]
  },
  // NotificationOrange/300  #EC702C
  beauty: {
    source: [255, 135, 114]
  },
  // AphroditePink/600  #FF8772
  moving: {
    source: [211, 237, 113]
  },
  // DemeterGreen/300   #D3ED71
  education: {
    source: [255, 195, 45]
  },
  // ApolloYellow/600   #FFC32D
  events: {
    source: [153, 160, 255]
  },
  // DionysusPurple/600 #99A0FF
  other: {
    source: [106, 116, 130]
  } // Grey/300           #6A7482

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
  var dLng = proLng - customerLng;
  var dLat = proLat - customerLat;
  var distM = Math.sqrt(dLng * dLng + dLat * dLat) * 111000; // approx metres (1° ≈ 111 km)

  var peakAlt = distM * ALT_SCALE;
  var path = [];
  var timestamps = [];

  for (var i = 0; i < ARC_WAYPOINTS; i++) {
    var t = i / (ARC_WAYPOINTS - 1); // position along arc (0→1)

    var timeFraction = t; // linear — the parabolic altitude already provides organic rhythm

    var alt = 4 * peakAlt * t * (1 - t); // parabola: 0 at endpoints, peakAlt at midpoint

    path.push([customerLng + t * (proLng - customerLng), // straight line in X
    customerLat + t * (proLat - customerLat), // straight line in Y
    alt]);
    timestamps.push(emittedAt + timeFraction * arcDuration);
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
} // Elastic ease-out: overshoots then settles — used for blob expand


function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  var c4 = 2 * Math.PI / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function blobRadius(age) {
  if (age < 0) return 0;
  if (age < BLOB_EXPAND_MS) return easeOutElastic(age / BLOB_EXPAND_MS) * BLOB_MAX_RADIUS;
  var t = (age - BLOB_EXPAND_MS) / BLOB_SHRINK_MS;
  if (t > 1) return 0;
  return (1 - t * (2 - t)) * BLOB_MAX_RADIUS; // easeOutQuad: fast start, gentle finish
}

function blobAlpha(age) {
  if (age < 0) return 0;
  var total = BLOB_EXPAND_MS + BLOB_SHRINK_MS;
  if (age > total) return 0;
  return BLOB_ALPHA;
}

function flashAlpha(age, peakAlpha) {
  if (age < 0 || age > FLASH_DURATION) return 0;
  var t = age / FLASH_DURATION;
  var rise = Math.min(age / FLASH_RISE_MS, 1);
  return Math.round(rise * (1 - t) * peakAlpha);
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

function buildLayers(activeArcs, activeQuotes, virtualTime) {
  var _ref = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {},
      _ref$showRequests = _ref.showRequests,
      showRequests = _ref$showRequests === void 0 ? true : _ref$showRequests,
      _ref$showQuotes = _ref.showQuotes,
      showQuotes = _ref$showQuotes === void 0 ? true : _ref$showQuotes;

  var _deck = deck,
      TripsLayer = _deck.TripsLayer,
      ScatterplotLayer = _deck.ScatterplotLayer;
  var ADDITIVE = {
    blend: true,
    blendFunc: [770, 1]
  }; // SRC_ALPHA + ONE
  // Main arc — comet draws source→dest, comet tail fades as it erases

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
    widthMinPixels: IS_MOBILE ? COMET_WIDTH_PX_MOBILE : COMET_WIDTH_PX,
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
  }); // Source blob — filled circle that elastically expands then shrinks+fades at arc origin

  var sourceBlobLayer = new ScatterplotLayer({
    id: "source-blob",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.customerLng, d.customerLat];
    },
    getRadius: function getRadius(d) {
      return blobRadius(virtualTime - d.emittedAt);
    },
    getFillColor: function getFillColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [blobAlpha(virtualTime - d.emittedAt)]);
    },
    radiusUnits: "pixels",
    updateTriggers: {
      getRadius: virtualTime,
      getFillColor: virtualTime
    }
  }); // Dest blob — same effect, triggered when the comet arrives

  var destBlobLayer = new ScatterplotLayer({
    id: "dest-blob",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.proLng, d.proLat];
    },
    getRadius: function getRadius(d) {
      return blobRadius(virtualTime - d.emittedAt - d.arcDuration);
    },
    getFillColor: function getFillColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [blobAlpha(virtualTime - d.emittedAt - d.arcDuration)]);
    },
    radiusUnits: "pixels",
    updateTriggers: {
      getRadius: virtualTime,
      getFillColor: virtualTime
    }
  }); // Source flash — 3 concentric white circles at arc origin, additive blend

  var srcFlashOuter = new ScatterplotLayer({
    id: "src-flash-outer",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.customerLng, d.customerLat];
    },
    getRadius: function getRadius() {
      return FLASH_OUTER_R;
    },
    getFillColor: function getFillColor(d) {
      return [255, 255, 255, flashAlpha(virtualTime - d.emittedAt, FLASH_OUTER_A)];
    },
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: {
      getFillColor: virtualTime
    }
  });
  var srcFlashMid = new ScatterplotLayer({
    id: "src-flash-mid",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.customerLng, d.customerLat];
    },
    getRadius: function getRadius() {
      return FLASH_MID_R;
    },
    getFillColor: function getFillColor(d) {
      return [255, 255, 255, flashAlpha(virtualTime - d.emittedAt, FLASH_MID_A)];
    },
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: {
      getFillColor: virtualTime
    }
  });
  var srcFlashCore = new ScatterplotLayer({
    id: "src-flash-core",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.customerLng, d.customerLat];
    },
    getRadius: function getRadius() {
      return FLASH_CORE_R;
    },
    getFillColor: function getFillColor(d) {
      return [255, 255, 255, flashAlpha(virtualTime - d.emittedAt, FLASH_CORE_A)];
    },
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: {
      getFillColor: virtualTime
    }
  }); // Dest flash — same 3 circles at arc destination, triggered at arcDuration

  var dstFlashOuter = new ScatterplotLayer({
    id: "dst-flash-outer",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.proLng, d.proLat];
    },
    getRadius: function getRadius() {
      return FLASH_OUTER_R;
    },
    getFillColor: function getFillColor(d) {
      return [255, 255, 255, flashAlpha(virtualTime - d.emittedAt - d.arcDuration, FLASH_OUTER_A)];
    },
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: {
      getFillColor: virtualTime
    }
  });
  var dstFlashMid = new ScatterplotLayer({
    id: "dst-flash-mid",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.proLng, d.proLat];
    },
    getRadius: function getRadius() {
      return FLASH_MID_R;
    },
    getFillColor: function getFillColor(d) {
      return [255, 255, 255, flashAlpha(virtualTime - d.emittedAt - d.arcDuration, FLASH_MID_A)];
    },
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: {
      getFillColor: virtualTime
    }
  });
  var dstFlashCore = new ScatterplotLayer({
    id: "dst-flash-core",
    data: activeArcs,
    getPosition: function getPosition(d) {
      return [d.proLng, d.proLat];
    },
    getRadius: function getRadius() {
      return FLASH_CORE_R;
    },
    getFillColor: function getFillColor(d) {
      return [255, 255, 255, flashAlpha(virtualTime - d.emittedAt - d.arcDuration, FLASH_CORE_A)];
    },
    radiusUnits: "pixels",
    parameters: ADDITIVE,
    updateTriggers: {
      getFillColor: virtualTime
    }
  }); // ── Quote arcs (pro → job location) ─────────────────────────────────────

  var quoteTripsLayer = new TripsLayer({
    id: "quotes-trips",
    data: activeQuotes,
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
    widthMinPixels: IS_MOBILE ? COMET_WIDTH_PX_MOBILE : COMET_WIDTH_PX,
    fadeTrail: true
  });
  var quoteGlowLayer = new TripsLayer({
    id: "quotes-trips-glow",
    data: activeQuotes,
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
  });
  var quoteSourcePulse = new ScatterplotLayer({
    id: "quote-source-pulse",
    data: activeQuotes,
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
  });
  var quoteDestPulse = new ScatterplotLayer({
    id: "quote-dest-pulse",
    data: activeQuotes,
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
  var quoteSourceBlob = new ScatterplotLayer({
    id: "quote-source-blob",
    data: activeQuotes,
    getPosition: function getPosition(d) {
      return [d.customerLng, d.customerLat];
    },
    getRadius: function getRadius(d) {
      return blobRadius(virtualTime - d.emittedAt);
    },
    getFillColor: function getFillColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [blobAlpha(virtualTime - d.emittedAt)]);
    },
    radiusUnits: "pixels",
    updateTriggers: {
      getRadius: virtualTime,
      getFillColor: virtualTime
    }
  });
  var quoteDestBlob = new ScatterplotLayer({
    id: "quote-dest-blob",
    data: activeQuotes,
    getPosition: function getPosition(d) {
      return [d.proLng, d.proLat];
    },
    getRadius: function getRadius(d) {
      return blobRadius(virtualTime - d.emittedAt - d.arcDuration);
    },
    getFillColor: function getFillColor(d) {
      return [].concat(_toConsumableArray(categoryColor(d.serviceCategory, "source")), [blobAlpha(virtualTime - d.emittedAt - d.arcDuration)]);
    },
    radiusUnits: "pixels",
    updateTriggers: {
      getRadius: virtualTime,
      getFillColor: virtualTime
    }
  });
  return [].concat(_toConsumableArray(showRequests ? [glowLayer, tripsLayer] : []), _toConsumableArray(showRequests && FLASH_ENABLED ? [srcFlashOuter, srcFlashMid, srcFlashCore, dstFlashOuter, dstFlashMid, dstFlashCore] : []), _toConsumableArray(showRequests ? [sourceBlobLayer, destBlobLayer, sourcePulseLayer, destPulseLayer] : []), _toConsumableArray(showQuotes ? [quoteGlowLayer, quoteTripsLayer, quoteSourceBlob, quoteDestBlob, quoteSourcePulse, quoteDestPulse] : []));
}