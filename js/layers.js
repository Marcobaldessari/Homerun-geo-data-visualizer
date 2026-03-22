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

// Compute per-arc opacity based on its age in virtual time
function arcOpacity(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  const { arcDuration, arcFadeDelay } = arc;

  if (age < 0) return 0;

  // Fade in
  if (age < arcDuration) {
    return age / arcDuration;
  }

  // Hold
  const holdEnd = arcDuration + arcFadeDelay;
  if (age < holdEnd) return 1;

  // Fade out (500ms)
  const fadeOut = (age - holdEnd) / 500;
  return Math.max(0, 1 - fadeOut);
}

// Compute pulse radius for pro arrival dots
function pulseRadius(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0 || age > arc.arcDuration + 1500) return 0;
  const t = Math.min(age / arc.arcDuration, 1);
  // 12 → 36px as t goes 0 → 1
  return 12 + t * 24;
}

function pulseAlpha(arc, virtualTime) {
  const age = virtualTime - arc.emittedAt;
  if (age < 0) return 0;
  const t = Math.min(age / (arc.arcDuration + 200), 1);
  // Fade out as t approaches 1
  return Math.max(0, 1 - t) * 200;
}

export function buildLayers(activeArcs, virtualTime) {
  const { ArcLayer, ScatterplotLayer } = deck;

  // Main arc layer
  const arcLayer = new ArcLayer({
    id: 'arcs',
    data: activeArcs,
    getSourcePosition: d => [d.customerLng, d.customerLat],
    getTargetPosition: d => [d.proLng, d.proLat],
    getSourceColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      const alpha = arcOpacity(d, virtualTime);
      return [...col, Math.round(alpha * 220)];
    },
    getTargetColor: d => {
      const col = categoryColor(d.serviceCategory, 'target');
      const alpha = arcOpacity(d, virtualTime);
      return [...col, Math.round(alpha * 220)];
    },
    getWidth: 3,
    getHeight: d => {
      // Taller arc for cross-Bosphorus (European ↔ Asian side threshold ~28.97°E)
      const crossesBosphorus =
        (d.customerLng < 28.97) !== (d.proLng < 28.97);
      return crossesBosphorus ? 1.0 : 0.35;
    },
    updateTriggers: {
      getSourceColor: virtualTime,
      getTargetColor: virtualTime,
    },
  });

  // Glow layer (wide, semi-transparent copy)
  const glowLayer = new ArcLayer({
    id: 'arcs-glow',
    data: activeArcs,
    getSourcePosition: d => [d.customerLng, d.customerLat],
    getTargetPosition: d => [d.proLng, d.proLat],
    getSourceColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      const alpha = arcOpacity(d, virtualTime);
      return [...col, Math.round(alpha * 45)];
    },
    getTargetColor: d => {
      const col = categoryColor(d.serviceCategory, 'target');
      const alpha = arcOpacity(d, virtualTime);
      return [...col, Math.round(alpha * 45)];
    },
    getWidth: 12,
    getHeight: d => {
      const crossesBosphorus = (d.customerLng < 28.97) !== (d.proLng < 28.97);
      return crossesBosphorus ? 1.0 : 0.35;
    },
    updateTriggers: {
      getSourceColor: virtualTime,
      getTargetColor: virtualTime,
    },
  });

  // Pulsing dot at pro destination
  const pulseLayer = new ScatterplotLayer({
    id: 'pulse-dots',
    data: activeArcs,
    getPosition: d => [d.proLng, d.proLat],
    getRadius: d => pulseRadius(d, virtualTime),
    getFillColor: d => {
      const col = categoryColor(d.serviceCategory, 'target');
      return [...col, pulseAlpha(d, virtualTime)];
    },
    radiusUnits: 'pixels',
    updateTriggers: {
      getRadius: virtualTime,
      getFillColor: virtualTime,
    },
  });

  // Customer origin dot
  const originLayer = new ScatterplotLayer({
    id: 'origin-dots',
    data: activeArcs,
    getPosition: d => [d.customerLng, d.customerLat],
    getRadius: 5,
    getFillColor: d => {
      const col = categoryColor(d.serviceCategory, 'source');
      const alpha = arcOpacity(d, virtualTime);
      return [...col, Math.round(alpha * 200)];
    },
    radiusUnits: 'pixels',
    updateTriggers: {
      getFillColor: virtualTime,
    },
  });

  return [glowLayer, arcLayer, originLayer, pulseLayer];
}
