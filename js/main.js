import { initMap }          from './map.js';
import { buildLayers }      from './layers.js';
import { Playback }         from './playback.js';
import { emitReviewCard, updateReviewCards, clearReviewCards } from './reviews.js';
import { incrementJobs, incrementReviews, resetStats } from './stats.js';
import { ISTANBUL_EVENTS, ISTANBUL_SIM_DURATION, ISTANBUL_SIM_START, ISTANBUL_SIM_END, ISTANBUL_CENTER, ISTANBUL_ZOOM } from './data-istanbul.js';
import { ISTANBUL_QUOTE_EVENTS } from './data-istanbul-quotes.js';
import { MILANO_EVENTS, MILANO_SIM_DURATION, MILANO_SIM_START, MILANO_SIM_END, MILANO_CENTER, MILANO_ZOOM } from './data-milano.js';
import { ANKARA_EVENTS, ANKARA_SIM_DURATION, ANKARA_SIM_START, ANKARA_SIM_END, ANKARA_CENTER, ANKARA_ZOOM } from './data-ankara.js';
import { IZMIR_EVENTS, IZMIR_SIM_DURATION, IZMIR_SIM_START, IZMIR_SIM_END, IZMIR_CENTER, IZMIR_ZOOM } from './data-izmir.js';
import { ANTALYA_EVENTS, ANTALYA_SIM_DURATION, ANTALYA_SIM_START, ANTALYA_SIM_END, ANTALYA_CENTER, ANTALYA_ZOOM } from './data-antalya.js';
import { KOCAELI_EVENTS, KOCAELI_SIM_DURATION, KOCAELI_SIM_START, KOCAELI_SIM_END, KOCAELI_CENTER, KOCAELI_ZOOM } from './data-kocaeli.js';

const isMobile = window.innerWidth <= 768;

// Merge Istanbul requests + quotes into one sorted event stream
const ISTANBUL_ALL_EVENTS = [...ISTANBUL_EVENTS, ...ISTANBUL_QUOTE_EVENTS]
  .sort((a, b) => a.timestamp - b.timestamp);

const CITIES = {
  istanbul: { events: ISTANBUL_ALL_EVENTS, simDuration: ISTANBUL_SIM_DURATION, simStart: ISTANBUL_SIM_START, simEnd: ISTANBUL_SIM_END, center: ISTANBUL_CENTER, zoom: isMobile ? 9 : ISTANBUL_ZOOM, label: 'Istanbul' },
  ankara:   { events: ANKARA_EVENTS,       simDuration: ANKARA_SIM_DURATION,   simStart: ANKARA_SIM_START,   simEnd: ANKARA_SIM_END,   center: ANKARA_CENTER,   zoom: isMobile ? 9 : ANKARA_ZOOM,   label: 'Ankara'   },
  izmir:    { events: IZMIR_EVENTS,         simDuration: IZMIR_SIM_DURATION,    simStart: IZMIR_SIM_START,    simEnd: IZMIR_SIM_END,    center: IZMIR_CENTER,    zoom: isMobile ? 9 : IZMIR_ZOOM,    label: 'İzmir'    },
  antalya:  { events: ANTALYA_EVENTS,       simDuration: ANTALYA_SIM_DURATION,  simStart: ANTALYA_SIM_START,  simEnd: ANTALYA_SIM_END,  center: ANTALYA_CENTER,  zoom: isMobile ? 9 : ANTALYA_ZOOM,  label: 'Antalya'  },
  kocaeli:  { events: KOCAELI_EVENTS,       simDuration: KOCAELI_SIM_DURATION,  simStart: KOCAELI_SIM_START,  simEnd: KOCAELI_SIM_END,  center: KOCAELI_CENTER,  zoom: isMobile ? 9 : KOCAELI_ZOOM,  label: 'Kocaeli'  },
  milano:   { events: MILANO_EVENTS,        simDuration: MILANO_SIM_DURATION,   simStart: MILANO_SIM_START,   simEnd: MILANO_SIM_END,   center: MILANO_CENTER,   zoom: isMobile ? 9 : MILANO_ZOOM,   label: 'Milano'   },
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

  // Auto-play on load
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
