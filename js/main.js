import { initMap }          from './map.js';
import { buildLayers }      from './layers.js';
import { Playback }         from './playback.js';
import { emitReviewCard, updateReviewCards, clearReviewCards } from './reviews.js';
import { incrementJobs, incrementReviews, resetStats } from './stats.js';
import { TURKEY_EVENTS, TURKEY_SIM_START, TURKEY_SIM_END, TURKEY_CENTER, TURKEY_ZOOM } from './data-turkey.js';
import { MILANO_EVENTS, MILANO_SIM_DURATION, MILANO_SIM_START, MILANO_SIM_END, MILANO_CENTER, MILANO_ZOOM } from './data-milano.js';

const isMobile = window.innerWidth <= 768;

// Derive per-city event streams from the shared Turkey dataset.
// For city views, quotes are limited to same-province arcs (no cross-city).
// Province codes: Istanbul=34, Ankara=6, İzmir=35, Bursa=16, Antalya=7, Kocaeli=41
function cityEvents(provinceCode) {
  return TURKEY_EVENTS.filter(e =>
    e.province === provinceCode &&
    (e.type !== 'quote' || e.proProvince === provinceCode) &&
    (e.type !== 'job'   || e.customerProvince === provinceCode)
  );
}

const CITIES = {
  turkey:   { events: TURKEY_EVENTS,           simDuration: 600000,             simStart: TURKEY_SIM_START, simEnd: TURKEY_SIM_END, center: TURKEY_CENTER, zoom: isMobile ? 5 : TURKEY_ZOOM, minZoom: isMobile ? 4 : 5,  label: 'Turkey'   },
  istanbul: { events: cityEvents(34),           simDuration: 600000,             simStart: TURKEY_SIM_START, simEnd: TURKEY_SIM_END, center: [28.97, 41.01], zoom: isMobile ? 9 : 11,         minZoom: isMobile ? 7 : 9,  label: 'Istanbul' },
  ankara:   { events: cityEvents(6),            simDuration: 600000,             simStart: TURKEY_SIM_START, simEnd: TURKEY_SIM_END, center: [32.86, 39.93], zoom: isMobile ? 9 : 11,         minZoom: isMobile ? 7 : 9,  label: 'Ankara'   },
  izmir:    { events: cityEvents(35),           simDuration: 600000,             simStart: TURKEY_SIM_START, simEnd: TURKEY_SIM_END, center: [27.14, 38.42], zoom: isMobile ? 9 : 11,         minZoom: isMobile ? 7 : 9,  label: 'İzmir'    },
  bursa:    { events: cityEvents(16),           simDuration: 600000,             simStart: TURKEY_SIM_START, simEnd: TURKEY_SIM_END, center: [29.06, 40.19], zoom: isMobile ? 9 : 11,         minZoom: isMobile ? 7 : 9,  label: 'Bursa'    },
  antalya:  { events: cityEvents(7),            simDuration: 600000,             simStart: TURKEY_SIM_START, simEnd: TURKEY_SIM_END, center: [30.71, 36.90], zoom: isMobile ? 9 : 11,         minZoom: isMobile ? 7 : 9,  label: 'Antalya'  },
  kocaeli:  { events: cityEvents(41),           simDuration: 600000,             simStart: TURKEY_SIM_START, simEnd: TURKEY_SIM_END, center: [29.96, 40.77], zoom: isMobile ? 9 : 11,         minZoom: isMobile ? 7 : 9,  label: 'Kocaeli'  },
  milano:   { events: MILANO_EVENTS,            simDuration: MILANO_SIM_DURATION, simStart: MILANO_SIM_START, simEnd: MILANO_SIM_END, center: MILANO_CENTER, zoom: isMobile ? 9 : MILANO_ZOOM, minZoom: isMobile ? 7 : 9,  label: 'Milano'   },
};

let currentCity = 'istanbul';

// Layer visibility state
const layerVis = { showRequests: true, showQuotes: true, showReviews: false };

// ── 1. Initialise map ──────────────────────────────────────────────────────
const map = initMap();

// ── 2. Initialise Deck.gl overlay ─────────────────────────────────────────
const deckOverlay = new deck.MapboxOverlay({
  interleaved: true,
  layers: [],
});

map.on('load', () => {
  map.addControl(deckOverlay);
  map.setMinZoom(CITIES[currentCity].minZoom);

  // ── 3. Start playback engine ─────────────────────────────────────────────
  const city = CITIES[currentCity];
  const playback = new Playback({
    events: city.events,
    simDuration: city.simDuration,
    simStart: city.simStart,
    simEnd: city.simEnd,
    onFrame(activeArcs, activeQuotes, virtualTime) {
      deckOverlay.setProps({ layers: buildLayers(activeArcs, activeQuotes, virtualTime, layerVis) });
      updateReviewCards(map);
    },
    onJobEmit(ev) { incrementJobs(); },
    onReviewEmit(ev) { incrementReviews(); if (layerVis.showReviews) emitReviewCard(ev, map); },
    onEnd() {},
    onSeek(virtualTime) { clearReviewCards(); resetStats(); },
  });

  // Start scrubber at 10 AM (10/24 × simDuration) then auto-play
  playback._seekTo(Math.round(10 / 24 * city.simDuration));
  playback.play();

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (playback.isPlaying) playback.pause();
      else playback.play();
    }
    if (e.code === 'KeyF') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    }
    if (e.code === 'KeyH') toggleHud();
    if (e.code === 'KeyR') {
      layerVis.showReviews = !layerVis.showReviews;
      if (!layerVis.showReviews) clearReviewCards();
      syncReviewsBtn();
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      const keys = Object.keys(CITIES);
      const idx = keys.indexOf(currentCity);
      const next = e.code === 'ArrowRight'
        ? keys[(idx + 1) % keys.length]
        : keys[(idx - 1 + keys.length) % keys.length];
      document.querySelector(`.city-btn[data-city="${next}"]`).click();
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault();
      const speedSel = document.getElementById('speed-select');
      const idx = speedSel.selectedIndex;
      const next = e.code === 'ArrowUp'
        ? Math.min(idx + 1, speedSel.options.length - 1)
        : Math.max(idx - 1, 0);
      speedSel.selectedIndex = next;
      speedSel.dispatchEvent(new Event('change'));
    }
  });

  // Keep review cards repositioned on map move/zoom
  map.on('move', () => updateReviewCards(map));

  function toggleHud() {
    const hidden = document.getElementById('hud').classList.toggle('hidden');
    document.body.classList.toggle('hud-hidden', hidden);
    document.getElementById('btn-toggle-hud').classList.toggle('active', !hidden);
  }

  // Click on clock or Controls button toggles the HUD
  document.getElementById('time-display').addEventListener('click', toggleHud);
  document.getElementById('btn-toggle-hud').addEventListener('click', toggleHud);

  // ── 5. Layer toggles ────────────────────────────────────────────────────
  function syncReviewsBtn() {
    document.querySelectorAll('.layer-btn[data-layer="showReviews"]').forEach(btn => {
      btn.classList.toggle('active', layerVis.showReviews);
    });
  }

  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const layer = btn.dataset.layer;
      layerVis[layer] = !layerVis[layer];
      btn.classList.toggle('active', layerVis[layer]);
      if (layer === 'showReviews' && !layerVis.showReviews) clearReviewCards();
    });
  });

  document.addEventListener('toggle-reviews', () => {
    layerVis.showReviews = !layerVis.showReviews;
    if (!layerVis.showReviews) clearReviewCards();
    syncReviewsBtn();
  });

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

      // Update zoom limits and fly to new city
      map.setMinZoom(next.minZoom);
      map.flyTo({ center: next.center, zoom: next.zoom, duration: 1200 });

      // Load new city data at the current time (loadData calls onSeek which resets cards/stats)
      playback.loadData(next.events, next.simDuration, next.simStart, next.simEnd);
      playback.play();
    });
  });
});
