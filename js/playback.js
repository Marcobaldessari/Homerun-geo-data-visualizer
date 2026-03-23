import { ISTANBUL_EVENTS, ISTANBUL_SIM_DURATION } from './data-istanbul.js';

export class Playback {
  constructor({ events, simDuration, simStart, simEnd, onFrame, onJobEmit, onReviewEmit, onEnd, onSeek }) {
    this.events = events || ISTANBUL_EVENTS;
    this.simDuration = simDuration || ISTANBUL_SIM_DURATION;
    this.simStart = simStart || 0;
    this.simEnd   = simEnd   || 0;
    this.onFrame = onFrame;
    this.onJobEmit = onJobEmit;
    this.onReviewEmit = onReviewEmit;
    this.onEnd = onEnd;
    this.onSeek = onSeek || (() => {});

    this.isPlaying = false;
    this.speedFactor = 1;
    this.virtualTime = 0;    // current simulated ms
    this.wallStart = null;   // wall clock when play was last pressed
    this.pausedAt = 0;       // virtualTime at last pause

    this.eventPointer = 0;
    this.activeArcs = [];
    this.rafId = null;

    this._bindControls();
    this._renderFrame(0);    // initial static frame
  }

  _bindControls() {
    const btnPlay = document.getElementById('btn-play');
    const speedSel = document.getElementById('speed-select');
    const scrubber = document.getElementById('scrubber');

    btnPlay.addEventListener('click', () => {
      if (this.isPlaying) this.pause();
      else this.play();
    });

    speedSel.addEventListener('change', e => {
      const wasPaused = !this.isPlaying;
      if (this.isPlaying) {
        // Recalibrate wallStart so virtualTime is continuous
        this.pausedAt = this.virtualTime;
        this.wallStart = performance.now();
      }
      this.speedFactor = Number(e.target.value);
      if (!wasPaused) {
        this.wallStart = performance.now();
      }
    });

    scrubber.addEventListener('input', e => {
      const newTime = Number(e.target.value);
      this._seekTo(newTime);
    });
  }

  loadData(events, simDuration, simStart, simEnd) {
    this.pause();
    this.events = events;
    this.simDuration = simDuration;
    this.simStart = simStart || 0;
    this.simEnd   = simEnd   || 0;
    this._seekTo(0);
  }

  play() {
    if (this.virtualTime >= this.simDuration) {
      this._seekTo(0);
    }
    this.isPlaying = true;
    this.wallStart = performance.now();
    document.getElementById('btn-play').textContent = '⏸';
    this._tick();
  }

  pause() {
    this.isPlaying = false;
    this.pausedAt = this.virtualTime;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    document.getElementById('btn-play').textContent = '▶';
  }

  _seekTo(newVirtualTime) {
    // Reset everything and fast-forward to requested time
    this.virtualTime = Math.max(0, Math.min(newVirtualTime, this.simDuration));
    this.pausedAt = this.virtualTime;
    this.wallStart = performance.now();

    // Rebuild active arcs by replaying from beginning
    this.activeArcs = [];
    this.eventPointer = 0;
    this.onSeek(this.virtualTime);
    const FADE_OUT_BUFFER = 2000; // ms: keep arcs that started within this window

    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i];
      if (ev.timestamp > this.virtualTime) break;
      this.eventPointer = i + 1;

      if (ev.type === 'job') {
        const endTime = ev.timestamp + ev.arcDuration + 500;
        if (endTime >= this.virtualTime - FADE_OUT_BUFFER) {
          this.activeArcs.push({ ...ev, emittedAt: ev.timestamp });
        }
      }
    }

    this._renderFrame(this.virtualTime);
  }

  _tick() {
    if (!this.isPlaying) return;

    const elapsed = performance.now() - this.wallStart;
    this.virtualTime = Math.min(
      this.pausedAt + elapsed * this.speedFactor,
      this.simDuration
    );

    // Emit new events
    while (
      this.eventPointer < this.events.length &&
      this.events[this.eventPointer].timestamp <= this.virtualTime
    ) {
      const ev = this.events[this.eventPointer++];
      if (ev.type === 'job') {
        const arc = { ...ev, emittedAt: ev.timestamp };
        this.activeArcs.push(arc);
        this.onJobEmit(ev);
      } else if (ev.type === 'review') {
        this.onReviewEmit(ev);
      }
    }

    // Cull expired arcs
    this.activeArcs = this.activeArcs.filter(arc => {
      const age = this.virtualTime - arc.emittedAt;
      return age < arc.arcDuration + 1500;
    });

    this._renderFrame(this.virtualTime);

    if (this.virtualTime >= this.simDuration) {
      this.pause();
      this.onEnd();
      return;
    }

    this.rafId = requestAnimationFrame(() => this._tick());
  }

  _renderFrame(virtualTime) {
    this._updateScrubber(virtualTime);
    this._updateTimeDisplay(virtualTime);
    this.onFrame(this.activeArcs, virtualTime);
  }

  _updateScrubber(vt) {
    const scrubber = document.getElementById('scrubber');
    // Only update if user isn't dragging
    if (document.activeElement !== scrubber) {
      scrubber.value = Math.round(vt);
    }
  }

  _updateTimeDisplay(vt) {
    let text;
    if (this.simStart && this.simEnd) {
      // Map virtualTime → real wall-clock time and show HH:MM
      const realMs = this.simStart + (vt / this.simDuration) * (this.simEnd - this.simStart);
      const d = new Date(realMs);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      text = `${hh}:${mm}`;
    } else {
      const elapsed = Math.floor(vt / 1000);
      const total = Math.floor(this.simDuration / 1000);
      const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      text = `${fmt(elapsed)} / ${fmt(total)}`;
    }
    document.getElementById('time-display').textContent = text;
  }
}
