import { METRICS } from '../frontend/src/lib/core.js';

// Each metric appears alone and in mixed optional records, including all 14 together.
export const fixtures = Array.from({ length: 128 }, (_, index) => {
  const chosen = index < METRICS.length ? [METRICS[index]] : METRICS.filter((_, i) => (index + i) % 3 !== 0);
  return {
    body_weight: 45 + index % 40 * 2,
    reference_sex: index % 2 ? 'f' : 'm',
    entries: chosen.map((metric, i) => ({
      code: metric.code,
      value: metric.lift ? 10 + (index * 7 + i * 5) % 190 :
        Math.round(metric.min + ((index * 17 + i * 13) % 101) / 100 * (Math.min(metric.max, metric.ref * 1.5) - metric.min)),
      reps: metric.lift ? 1 + index % 12 : 1,
    })),
  };
});
fixtures.push({
  body_weight: 75, reference_sex: 'm',
  entries: METRICS.map(metric => ({ code: metric.code, value: metric.lift ? metric.ref * 75 : metric.ref, reps: 1 })),
});
