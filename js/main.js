import { initMap }          from './map.js';
import { buildLayers }      from './layers.js';
import { Playback }         from './playback.js';
import { emitReviewCard, updateReviewCards, clearReviewCards } from './reviews.js';
import { incrementJobs, incrementReviews, resetStats } from './stats.js';

// ── 1. Initialise map ──────────────────────────────────────────────────────
const map = initMap();

// ── 2. Initialise Deck.gl overlay ─────────────────────────────────────────
const deckOverlay = new deck.MapboxOverlay({
  interleaved: false,
  layers: [],
});

map.on('load', () => {
  map.addControl(deckOverlay);

  // ── 3. Start playback engine ─────────────────────────────────────────────
  const playback = new Playback({
    onFrame(activeArcs, virtualTime) {
      // Rebuild Deck.gl layers every frame
      deckOverlay.setProps({ layers: buildLayers(activeArcs, virtualTime) });
      // Reposition any visible review cards
      updateReviewCards(map);
    },

    onJobEmit(ev) {
      incrementJobs();
    },

    onReviewEmit(ev) {
      incrementReviews();
      emitReviewCard(ev, map);
    },

    onEnd() {
      // Replay button text handled by pause() inside Playback
    },

    onSeek(virtualTime) {
      clearReviewCards();
      resetStats();
    },
  });

  // Auto-play on load
  playback.play();

  // Keep review cards repositioned on map move/zoom
  map.on('move', () => updateReviewCards(map));
});
