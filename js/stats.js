let jobCount = 0;
let reviewCount = 0;

const elJobs    = document.getElementById('stat-jobs');
const elReviews = document.getElementById('stat-reviews');

export function incrementJobs() {
  elJobs.textContent = ++jobCount;
}

export function incrementReviews() {
  elReviews.textContent = ++reviewCount;
}

export function resetStats() {
  jobCount = 0;
  reviewCount = 0;
  elJobs.textContent = '0';
  elReviews.textContent = '0';
}
