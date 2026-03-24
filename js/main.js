import { initMap }          from './map.js';
import { buildLayers }      from './layers.js';
import { Playback }         from './playback.js';
import { emitReviewCard, updateReviewCards, clearReviewCards } from './reviews.js';
import { incrementJobs, incrementReviews, resetStats } from './stats.js';
import { ISTANBUL_EVENTS, ISTANBUL_SIM_DURATION, ISTANBUL_SIM_START, ISTANBUL_SIM_END, ISTANBUL_CENTER, ISTANBUL_ZOOM } from './data-istanbul.js';
import { MILANO_EVENTS, MILANO_SIM_DURATION, MILANO_SIM_START, MILANO_SIM_END, MILANO_CENTER, MILANO_ZOOM } from './data-milano.js';

const isMobile = window.innerWidth <= 768;

const CITIES = {
  istanbul: { events: ISTANBUL_EVENTS, simDuration: ISTANBUL_SIM_DURATION, simStart: ISTANBUL_SIM_START, simEnd: ISTANBUL_SIM_END, center: ISTANBUL_CENTER, zoom: isMobile ? 9 : ISTANBUL_ZOOM, label: 'Istanbul' },
  milano:   { events: MILANO_EVENTS,   simDuration: MILANO_SIM_DURATION,   simStart: MILANO_SIM_START,   simEnd: MILANO_SIM_END,   center: MILANO_CENTER,   zoom: isMobile ? 9 : MILANO_ZOOM,   label: 'Milano'   },
};

let currentCity = 'istanbul';

// ── 1. Initialise map ──────────────────────────────────────────────────────
const map = initMap();

// ── 2. Initialise Deck.gl overlay ─────────────────────────────────────────
const deckOverlay = new deck.MapboxOverlay({
  interleaved: true,
  layers: [],
});

map.on('load', () => {
  map.addControl(deckOverlay);

  // ── 3. Start playback engine ─────────────────────────────────────────────
  const city = CITIES[currentCity];
  const playback = new Playback({
    events: city.events,
    simDuration: city.simDuration,
    simStart: city.simStart,
    simEnd: city.simEnd,
    onFrame(activeArcs, virtualTime) {
      deckOverlay.setProps({ layers: buildLayers(activeArcs, virtualTime) });
      updateReviewCards(map);
    },
    onJobEmit(ev) { incrementJobs(); },
    onReviewEmit(ev) { incrementReviews(); emitReviewCard(ev, map); },
    onEnd() {},
    onSeek(virtualTime) { clearReviewCards(); resetStats(); },
  });

  // Auto-play on load
  playback.play();

  // Keep review cards repositioned on map move/zoom
  map.on('move', () => updateReviewCards(map));

  // ── 4. City toggle ──────────────────────────────────────────────────────
  document.querySelectorAll('.city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cityKey = btn.dataset.city;
      if (cityKey === currentCity) return;

      currentCity = cityKey;
      const next = CITIES[cityKey];

      // Update active state
      document.querySelectorAll('.city-btn').forEach(b => b.classList.toggle('active', b.dataset.city === cityKey));

      // Update branding
      document.title = `Homerun · ${next.label} Live`;

      // Fly map to new city
      map.flyTo({ center: next.center, zoom: next.zoom, duration: 1200 });

      // Reset and load new data
      clearReviewCards();
      resetStats();
      playback.loadData(next.events, next.simDuration, next.simStart, next.simEnd);
      playback.play();
    });
  });
});
