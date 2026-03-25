import { ISTANBUL_EVENTS, ISTANBUL_SIM_DURATION } from './data-istanbul.js';
import { TRAIL_LENGTH } from './layers.js';

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
    this.speedFactor = Number(document.getElementById('speed-select').value);
    this.virtualTime = 0;    // current simulated ms
    this.wallStart = null;   // wall clock when play was last pressed
    this.pausedAt = 0;       // virtualTime at last pause

    this.eventPointer = 0;
    this.activeArcs = [];
    this.activeQuotes = [];
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
      this.speedFactor = Number(e.target.value);
    });

    scrubber.addEventListener('input', e => {
      const newTime = Number(e.target.value);
      this._seekTo(newTime);
    });
  }

  loadData(events, simDuration, simStart, simEnd) {
    const preservedVt = this.virtualTime;
    this.pause();
    this.events = events;
    this.simDuration = simDuration;
    this.simStart = simStart || 0;
    this.simEnd   = simEnd   || 0;
    // Keep the current time so city switches don't restart the clock
    this._seekTo(preservedVt);
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
    this.activeQuotes = [];
    this.eventPointer = 0;
    this.onSeek(this.virtualTime);
    for (let i = 0; i < this.events.length; i++) {
      const ev = this.events[i];
      if (ev.timestamp > this.virtualTime) break;
      this.eventPointer = i + 1;

      if (ev.type === 'job') {
        const endTime = ev.timestamp + ev.arcDuration + TRAIL_LENGTH + 500;
        if (endTime >= this.virtualTime) {
          this.activeArcs.push({ ...ev, emittedAt: ev.timestamp });
        }
      } else if (ev.type === 'quote') {
        const endTime = ev.timestamp + ev.arcDuration + TRAIL_LENGTH + 500;
        if (endTime >= this.virtualTime) {
          this.activeQuotes.push({ ...ev, emittedAt: ev.timestamp });
        }
      }
    }

    this._renderFrame(this.virtualTime);
  }

  _tick() {
    if (!this.isPlaying) return;

    const now = performance.now();
    // Cap per-frame delta to 150 ms real time — prevents event bursts after
    // browser pauses (e.g. parsing large data files on first load).
    const delta = Math.min(now - this.wallStart, 150);
    this.wallStart = now;
    this.pausedAt = Math.min(this.pausedAt + delta * this.speedFactor, this.simDuration);
    this.virtualTime = this.pausedAt;

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
      } else if (ev.type === 'quote') {
        const arc = { ...ev, emittedAt: ev.timestamp };
        this.activeQuotes.push(arc);
      }
    }

    // Cull expired arcs — keep alive for full trail fade (arcDuration + TRAIL_LENGTH + 500)
    this.activeArcs = this.activeArcs.filter(arc => {
      const age = this.virtualTime - arc.emittedAt;
      return age < arc.arcDuration + TRAIL_LENGTH + 500;
    });
    this.activeQuotes = this.activeQuotes.filter(arc => {
      const age = this.virtualTime - arc.emittedAt;
      return age < arc.arcDuration + TRAIL_LENGTH + 500;
    });

    this._renderFrame(this.virtualTime);

    if (this.virtualTime >= this.simDuration) {
      // Loop: reset to midnight inline — avoids a recursive play() call
      this.onEnd();
      this.activeArcs   = [];
      this.activeQuotes = [];
      this.eventPointer = 0;
      this.pausedAt     = 0;
      this.virtualTime  = 0;
      this.onSeek(0);
      this._renderFrame(0);
      this.wallStart = performance.now();
    }

    this.rafId = requestAnimationFrame(() => this._tick());
  }

  _renderFrame(virtualTime) {
    this._updateScrubber(virtualTime);
    this._updateTimeDisplay(virtualTime);
    this.onFrame(this.activeArcs, this.activeQuotes, virtualTime);
  }

  _updateScrubber(vt) {
    const scrubber = document.getElementById('scrubber');
    // Only update if user isn't dragging
    if (document.activeElement !== scrubber) {
      scrubber.value = Math.round(vt);
    }
  }

  _updateTimeDisplay(vt) {
    // Proportional 24-hour display: vt=0 → 12:00 AM, vt=simDuration → 12:00 AM (next day)
    const totalMinutes = Math.floor((vt / this.simDuration) * 24 * 60);
    const hours   = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    const h    = hours % 12 || 12;
    const mm   = String(minutes).padStart(2, '0');
    const ampm = hours < 12 ? 'AM' : 'PM';
    document.getElementById('time-display').textContent = `${h}:${mm} ${ampm}`;
  }
}
