// ═══════════════════════════════════════════════════════════════════════════
// CAMERA SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CENTER = [28.97, 41.01]; // [lng, lat] — Istanbul
const DEFAULT_ZOOM = 11; // desktop starting zoom
const DEFAULT_ZOOM_MOBILE = 9;
const DEFAULT_PITCH = 50; // tilt in degrees (0 = flat, 85 = near-horizontal)
const DEFAULT_BEARING = 0; // rotation in degrees (0 = north up)
const MAX_PITCH = 85; // how far the user can tilt

const MIN_ZOOM_DESKTOP = 9;
const MIN_ZOOM_MOBILE = 7;
const MAX_ZOOM_DESKTOP = 14;
const MAX_ZOOM_MOBILE = 14;

// ── Rotation sensitivity ────────────────────────────────────────────────────
const BEARING_SENSITIVITY = 0.4; // px → degrees for horizontal drag
const PITCH_SENSITIVITY = 0.3; // px → degrees for vertical drag
const ZOOM_SENSITIVITY = 220; // wheel delta divisor — higher = slower zoom

export function initMap() {
  const isMobile = window.innerWidth <= 768;

  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        "carto-dark": {
          type: "raster",
          tiles: [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          ],
          tileSize: 256,
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: "carto-dark-layer",
          type: "raster",
          source: "carto-dark",
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
    center: DEFAULT_CENTER,
    zoom: isMobile ? DEFAULT_ZOOM_MOBILE : DEFAULT_ZOOM,
    minZoom: isMobile ? MIN_ZOOM_MOBILE : MIN_ZOOM_DESKTOP,
    maxZoom: isMobile ? MAX_ZOOM_MOBILE : MAX_ZOOM_DESKTOP,
    pitch: DEFAULT_PITCH,
    maxPitch: MAX_PITCH,
    bearing: DEFAULT_BEARING,
    antialias: true,
  });

  // Disable panning and built-in zoom/keyboard handlers
  map.dragPan.disable();
  map.scrollZoom.disable();
  map.touchZoomRotate.disable();
  map.keyboard.disable();

  // Clamp zoom to map limits
  function clampZoom(z) {
    return Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z));
  }

  // Desktop scroll → centre-anchored zoom with brief easing
  const canvas = map.getCanvas();
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 30;
      if (e.deltaMode === 2) delta *= 300;
      map.setZoom(clampZoom(map.getZoom() - delta / ZOOM_SENSITIVITY));
    },
    { passive: false },
  );

  // Left-drag → rotate bearing + adjust pitch
  let rotating = false;
  let lastX = 0;
  let lastY = 0;
  let lastPinchDist = 0;

  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    rotating = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!rotating) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    map.setBearing(map.getBearing() + dx * BEARING_SENSITIVITY);
    map.setPitch(Math.max(0, Math.min(MAX_PITCH, map.getPitch() - dy * PITCH_SENSITIVITY)));
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return;
    rotating = false;
    canvas.style.cursor = "grab";
  });

  // Touch: 1 finger → rotate bearing + pitch; 2 fingers → centre-anchored pinch zoom
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        rotating = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        rotating = false;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    },
    { passive: false },
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist > 0)
          map.setZoom(
            clampZoom(map.getZoom() + Math.log2(dist / lastPinchDist)),
          );
        lastPinchDist = dist;
        return;
      }
      if (!rotating || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      map.setBearing(map.getBearing() + dx * BEARING_SENSITIVITY);
      map.setPitch(Math.max(0, Math.min(MAX_PITCH, map.getPitch() - dy * PITCH_SENSITIVITY)));
    },
    { passive: false },
  );

  window.addEventListener("touchend", () => {
    rotating = false;
    lastPinchDist = 0;
  });

  canvas.style.cursor = "grab";

  return map;
}
