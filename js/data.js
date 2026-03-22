// Dummy data: 10 minutes of simulated Istanbul activity
// ~75 job requests + ~24 reviews, sorted by timestamp (ms from simulation start)

const DISTRICT_CENTROIDS = [
  { name: 'Kadıköy',   lat: 40.982, lng: 29.027, weight: 14 },
  { name: 'Beşiktaş',  lat: 41.043, lng: 29.007, weight: 12 },
  { name: 'Şişli',     lat: 41.062, lng: 28.987, weight: 11 },
  { name: 'Ataşehir',  lat: 40.985, lng: 29.118, weight: 10 },
  { name: 'Üsküdar',   lat: 41.023, lng: 29.015, weight: 9  },
  { name: 'Fatih',     lat: 41.013, lng: 28.940, weight: 8  },
  { name: 'Bakırköy',  lat: 40.981, lng: 28.876, weight: 7  },
  { name: 'Maltepe',   lat: 40.934, lng: 29.130, weight: 7  },
  { name: 'Sarıyer',   lat: 41.167, lng: 29.057, weight: 5  },
  { name: 'Pendik',    lat: 40.877, lng: 29.233, weight: 5  },
  { name: 'Avcılar',   lat: 41.001, lng: 28.721, weight: 4  },
  { name: 'Kağıthane', lat: 41.089, lng: 28.975, weight: 4  },
];

const SERVICE_CATEGORIES = [
  { name: 'Ev Temizliği',    category: 'cleaning',  weight: 22 },
  { name: 'Tadilat & Boya',  category: 'repair',    weight: 18 },
  { name: 'Kombi Bakımı',    category: 'repair',    weight: 8  },
  { name: 'Güzellik & Bakım',category: 'beauty',    weight: 10 },
  { name: 'Nakliyat',        category: 'moving',    weight: 9  },
  { name: 'Özel Ders',       category: 'education', weight: 8  },
  { name: 'Organizasyon',    category: 'events',    weight: 5  },
  { name: 'Elektrik',        category: 'repair',    weight: 7  },
  { name: 'Su Tesisatı',     category: 'repair',    weight: 6  },
  { name: 'Diğer',           category: 'other',     weight: 7  },
];

const PRO_NAMES = [
  'Ahmet U.', 'Mehmet K.', 'Mustafa Y.', 'Ali D.', 'Hasan T.',
  'İbrahim S.', 'Ömer A.', 'Yusuf B.', 'Can E.', 'Emre C.',
  'Fatma N.', 'Ayşe M.', 'Zeynep K.', 'Elif R.', 'Emine G.',
  'Serkan P.', 'Burak L.', 'Tolga Ö.', 'Kemal A.', 'Barış F.',
];

const REVIEW_TEXTS = [
  'Çok memnun kaldım, zamanında geldi.',
  'İşini çok iyi yapıyor, tavsiye ederim.',
  'Dakik ve güler yüzlüydü.',
  'Fiyat-performans açısından mükemmeldi.',
  'Profesyonel ve özenliydi.',
  'Temiz ve düzenli çalıştı.',
  'Kesinlikle tekrar tercih ederim.',
  'Beklentilerimin üzerinde bir hizmet.',
  'Hızlı ve kaliteli iş çıkardı.',
  'Çok nazik ve anlayışlıydı.',
  'Her şeyi eksiksiz yaptı.',
  'Gerçekten güvenilir bir profesyonel.',
  'İşini severek yaptığı belliydi.',
  'Süper bir deneyimdi, teşekkürler.',
  'Vakit kaybetmeden işe koyuldu.',
  'Harika iş çıkardı, çok teşekkürler!',
  'Çok titiz ve özenli bir çalışma.',
  'Tam zamanında geldi, harikasınız.',
  'Arkadaşlarıma mutlaka önereceğim.',
  'Ev tertemiz oldu, çok memnunum.',
  'Sorunumu kısa sürede çözdü.',
  'Güven veren bir profesyonel.',
  'İletişim çok iyiydi, teşekkürler.',
  'Her detaya dikkat etti.',
  'Bütçeme uygun, kaliteli hizmet.',
];

// Seeded pseudo-random for reproducible dummy data
function seededRng(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function weightedSample(items, rng) {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = rng() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function gaussianJitter(rng, sigma = 0.008) {
  // Box-Muller
  const u1 = rng(), u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return z * sigma;
}

function generateData() {
  const rng = seededRng(42);
  const SIM_DURATION = 600000; // 10 minutes in ms
  const events = [];

  // Generate job timestamps via exponential inter-arrival
  let t = rng() * 3000; // start within first 3 seconds
  while (t < SIM_DURATION) {
    const customerDistrict = weightedSample(DISTRICT_CENTROIDS, rng);
    const proDistrict = weightedSample(DISTRICT_CENTROIDS, rng);
    const service = weightedSample(SERVICE_CATEGORIES, rng);
    const proName = PRO_NAMES[Math.floor(rng() * PRO_NAMES.length)];

    events.push({
      id: `job_${events.length + 1}`,
      type: 'job',
      timestamp: Math.round(t),
      customerLat: customerDistrict.lat + gaussianJitter(rng, 0.009),
      customerLng: customerDistrict.lng + gaussianJitter(rng, 0.012),
      proLat: proDistrict.lat + gaussianJitter(rng, 0.007),
      proLng: proDistrict.lng + gaussianJitter(rng, 0.010),
      serviceName: service.name,
      serviceCategory: service.category,
      proName,
      arcDuration: 1800 + Math.floor(rng() * 1400),
      arcFadeDelay: 3500 + Math.floor(rng() * 2000),
    });

    // Exponential inter-arrival: mean ~7.5s
    t += -Math.log(rng() + 1e-10) * 7500;
  }

  // Generate review timestamps
  let rt = 15000 + rng() * 10000;
  while (rt < SIM_DURATION) {
    const district = weightedSample(DISTRICT_CENTROIDS, rng);
    const service = weightedSample(SERVICE_CATEGORIES, rng);
    const proName = PRO_NAMES[Math.floor(rng() * PRO_NAMES.length)];
    const text = REVIEW_TEXTS[Math.floor(rng() * REVIEW_TEXTS.length)];
    // Ratings skewed positive (3-5)
    const rating = Math.min(5, 3 + Math.floor(rng() * 3));

    events.push({
      id: `rev_${events.length + 1}`,
      type: 'review',
      timestamp: Math.round(rt),
      lat: district.lat + gaussianJitter(rng, 0.008),
      lng: district.lng + gaussianJitter(rng, 0.011),
      rating,
      reviewText: text,
      proName,
      serviceName: service.name,
      serviceCategory: service.category,
      popDuration: 4500 + Math.floor(rng() * 2000),
    });

    rt += -Math.log(rng() + 1e-10) * 24000;
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}

export const EVENTS = generateData();
export const SIM_DURATION = 600000;
