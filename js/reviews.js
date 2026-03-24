const overlay = document.getElementById('review-overlay');
const activeCards = []; // { el, ev, expiresAt }

function starsHtml(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export function emitReviewCard(ev, map) {
  const el = document.createElement('div');
  el.className = 'review-card';
  el.style.borderLeftColor = getCategoryColor(ev.serviceCategory);

  el.innerHTML = `
    <button class="review-card-close" aria-label="Hide reviews">
      <span class="review-card-close-label">Hide reviews</span>✕
    </button>
    <div class="review-card-stars">${starsHtml(ev.rating)}</div>
    <div class="review-card-text">${ev.reviewText}</div>
    <div class="review-card-meta"><strong>${ev.proName}</strong> · ${ev.serviceName}</div>
  `;

  el.querySelector('.review-card-close').addEventListener('click', e => {
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('toggle-reviews'));
  });

  overlay.appendChild(el);

  const card = {
    el,
    ev,
    expiresAt: performance.now() + ev.popDuration,
    lat: ev.lat,
    lng: ev.lng,
  };
  activeCards.push(card);

  // Position immediately
  repositionCard(card, map);
}

function repositionCard(card, map) {
  const point = map.project([card.lng, card.lat]);
  card.el.style.left = `${Math.round(point.x)}px`;
  card.el.style.top  = `${Math.round(point.y)}px`;
}

export function updateReviewCards(map) {
  const now = performance.now();
  for (let i = activeCards.length - 1; i >= 0; i--) {
    const card = activeCards[i];
    repositionCard(card, map);

    const remaining = card.expiresAt - now;

    if (remaining <= 0 && !card.removed) {
      card.removed = true;
      card.el.classList.add('fading');
      setTimeout(() => {
        if (card.el.parentNode) card.el.parentNode.removeChild(card.el);
      }, 520);
      activeCards.splice(i, 1);
    } else if (remaining < 500 && !card.fadingStarted) {
      card.fadingStarted = true;
      card.el.classList.add('fading');
    }
  }
}

export function clearReviewCards() {
  for (const card of activeCards) {
    if (card.el.parentNode) card.el.parentNode.removeChild(card.el);
  }
  activeCards.length = 0;
}

function getCategoryColor(category) {
  const map = {
    cleaning:  '#00d4ff',
    repair:    '#ff6b35',
    beauty:    '#e040fb',
    moving:    '#69f0ae',
    education: '#ffea00',
    events:    '#ff6e40',
    other:     '#b0bec5',
  };
  return map[category] || map.other;
}
