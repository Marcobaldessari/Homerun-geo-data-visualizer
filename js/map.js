export function initMap() {
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          ],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
          maxzoom: 19,
        },
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 22,
        },
      ],
    },
    center: [28.97, 41.01], // Istanbul
    zoom: 11,
    minZoom: 9,
    maxZoom: 14,
    pitch: 45,
    bearing: 0,
    antialias: true,
  });

  // Disable panning — camera is fixed in X/Y
  map.dragPan.disable();

  // Remap left-drag → rotate bearing + adjust pitch
  const canvas = map.getCanvas();
  let rotating = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    rotating = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!rotating) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    map.setBearing(map.getBearing() + dx * 0.4);
    map.setPitch(Math.max(0, Math.min(80, map.getPitch() - dy * 0.3)));
  });

  window.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    rotating = false;
    canvas.style.cursor = 'grab';
  });

  // Touch: single finger drag → rotate bearing + pitch (same as mouse)
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      rotating = true;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
    }
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!rotating || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastX;
    const dy = e.touches[0].clientY - lastY;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
    map.setBearing(map.getBearing() + dx * 0.4);
    map.setPitch(Math.max(0, Math.min(80, map.getPitch() - dy * 0.3)));
  }, { passive: false });

  window.addEventListener('touchend', () => {
    rotating = false;
  });

  canvas.style.cursor = 'grab';

  return map;
}
