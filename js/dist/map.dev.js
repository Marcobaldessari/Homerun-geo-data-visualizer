"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.initMap = initMap;
// ═══════════════════════════════════════════════════════════════════════════
// CAMERA SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
var DEFAULT_CENTER = [28.97, 41.01]; // [lng, lat] — Istanbul

var DEFAULT_ZOOM = 11; // desktop starting zoom

var DEFAULT_ZOOM_MOBILE = 9;
var DEFAULT_PITCH = 50; // tilt in degrees (0 = flat, 85 = near-horizontal)

var DEFAULT_BEARING = 0; // rotation in degrees (0 = north up)

var MAX_PITCH = 85; // how far the user can tilt

var MIN_ZOOM_DESKTOP = 9;
var MIN_ZOOM_MOBILE = 7;
var MAX_ZOOM_DESKTOP = 14;
var MAX_ZOOM_MOBILE = 14; // ── Rotation sensitivity ────────────────────────────────────────────────────

var BEARING_SENSITIVITY = 0.4; // px → degrees for horizontal drag

var PITCH_SENSITIVITY = 0.3; // px → degrees for vertical drag

var ZOOM_SENSITIVITY = 220; // wheel delta divisor — higher = slower zoom

function initMap() {
  var isMobile = window.innerWidth <= 768;
  var map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        "carto-dark": {
          type: "raster",
          tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
          maxzoom: 19
        }
      },
      layers: [{
        id: "carto-dark-layer",
        type: "raster",
        source: "carto-dark",
        minzoom: 0,
        maxzoom: 22
      }]
    },
    center: DEFAULT_CENTER,
    zoom: isMobile ? DEFAULT_ZOOM_MOBILE : DEFAULT_ZOOM,
    minZoom: isMobile ? MIN_ZOOM_MOBILE : MIN_ZOOM_DESKTOP,
    maxZoom: isMobile ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP,
    pitch: DEFAULT_PITCH,
    maxPitch: MAX_PITCH,
    bearing: DEFAULT_BEARING,
    antialias: true
  }); // Disable panning and built-in zoom handlers

  map.dragPan.disable();
  map.scrollZoom.disable();
  map.touchZoomRotate.disable(); // Clamp zoom to map limits

  function clampZoom(z) {
    return Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z));
  } // Desktop scroll → centre-anchored zoom with brief easing


  var canvas = map.getCanvas();
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 30;
    if (e.deltaMode === 2) delta *= 300;
    map.setZoom(clampZoom(map.getZoom() - delta / ZOOM_SENSITIVITY));
  }, {
    passive: false
  }); // Left-drag → rotate bearing + adjust pitch

  var rotating = false;
  var lastX = 0;
  var lastY = 0;
  var lastPinchDist = 0;
  canvas.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    rotating = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grabbing";
  });
  window.addEventListener("mousemove", function (e) {
    if (!rotating) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    map.setBearing(map.getBearing() + dx * 0.4);
    map.setPitch(Math.max(0, Math.min(85, map.getPitch() - dy * 0.3)));
  });
  window.addEventListener("mouseup", function (e) {
    if (e.button !== 0) return;
    rotating = false;
    canvas.style.cursor = "grab";
  }); // Touch: 1 finger → rotate bearing + pitch; 2 fingers → centre-anchored pinch zoom

  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();

    if (e.touches.length === 1) {
      rotating = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      rotating = false;
      var dx = e.touches[1].clientX - e.touches[0].clientX;
      var dy = e.touches[1].clientY - e.touches[0].clientY;
      lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, {
    passive: false
  });
  window.addEventListener("touchmove", function (e) {
    e.preventDefault();

    if (e.touches.length === 2) {
      var _dx = e.touches[1].clientX - e.touches[0].clientX;

      var _dy = e.touches[1].clientY - e.touches[0].clientY;

      var dist = Math.sqrt(_dx * _dx + _dy * _dy);
      if (lastPinchDist > 0) map.setZoom(clampZoom(map.getZoom() + Math.log2(dist / lastPinchDist)));
      lastPinchDist = dist;
      return;
    }

    if (!rotating || e.touches.length !== 1) return;
    var dx = e.touches[0].clientX - lastX;
    var dy = e.touches[0].clientY - lastY;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    map.setBearing(map.getBearing() + dx * 0.4);
    map.setPitch(Math.max(0, Math.min(85, map.getPitch() - dy * 0.3)));
  }, {
    passive: false
  });
  window.addEventListener("touchend", function () {
    rotating = false;
    lastPinchDist = 0;
  });
  canvas.style.cursor = "grab";
  return map;
}