export const TIER_BY_RANK = ['None', 'Tier 3', 'Tier 2', 'Tier 1', 'Dream'];

export function pay(type, v) {
  if (v == null) return '—';
  return type === 'Full-time' ? `₹${(v / 100000).toFixed(1)} LPA` : `₹${(v / 1000).toFixed(0)}k / month`;
}
