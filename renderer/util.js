const MS_PER_DAY = 86400000;

export function todayISO() {
  const d = new Date();
  return toISO(d);
}

export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(iso) {
  return new Date(iso + 'T00:00:00');
}

export function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function daysBetween(aIso, bIso) {
  return Math.round((parseISO(bIso) - parseISO(aIso)) / MS_PER_DAY);
}

export function formatFullDate(iso) {
  return parseISO(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function formatShortDate(iso) {
  return parseISO(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });
}

export function fmtWeight(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
}

export function fmtSignedWeight(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(decimals)}`;
}

export function avg(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function entriesInRange(entries, startIso, endIso) {
  return entries.filter((e) => e.date >= startIso && e.date <= endIso);
}

export function rollingAverageWindow(entries, endIso, windowDays) {
  const start = addDays(endIso, -(windowDays - 1));
  const filtered = entriesInRange(entries, start, endIso);
  return avg(filtered.map((e) => e.weight));
}

export function estimateWeightAt(entries, targetIso) {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const exact = sorted.find((e) => e.date === targetIso);
  if (exact) return exact.weight;
  let before = null;
  let after = null;
  for (const e of sorted) {
    if (e.date < targetIso) before = e;
    else if (e.date > targetIso) { after = e; break; }
  }
  if (before && after) return (before.weight + after.weight) / 2;
  if (before) return before.weight;
  if (after) return after.weight;
  return null;
}

export function projectGoalDate(entries, goal, windowDays = 30) {
  if (goal == null || entries.length < 3) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const windowStart = addDays(latest.date, -(windowDays - 1));
  const points = sorted.filter((e) => e.date >= windowStart);
  if (points.length < 3) return null;

  const x0 = parseISO(points[0].date).getTime();
  const xs = points.map((p) => (parseISO(p.date).getTime() - x0) / MS_PER_DAY);
  const ys = points.map((p) => p.weight);
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumXX = xs.reduce((s, x) => s + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  if (slope === 0) return null;

  const latestX = (parseISO(latest.date).getTime() - x0) / MS_PER_DAY;
  const currentProj = slope * latestX + intercept;
  const needed = goal - currentProj;
  if (Math.sign(slope) !== Math.sign(needed)) return null;

  const targetX = (goal - intercept) / slope;
  const daysFromLatest = targetX - latestX;
  if (daysFromLatest <= 0) return latest.date;
  if (daysFromLatest > 365 * 5) return null;
  return addDays(latest.date, Math.round(daysFromLatest));
}

export function formatEstDate(iso) {
  return parseISO(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function weightChangePastDays(entries, days) {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const target = addDays(latest.date, -days);
  const estimate = estimateWeightAt(sorted.slice(0, -1), target);
  if (estimate == null) return null;
  return latest.weight - estimate;
}

export function progressPct(current, start, goal) {
  if (current == null || start == null || goal == null) return null;
  if (goal === start) return current === goal ? 100 : 0;
  const raw = ((current - start) / (goal - start)) * 100;
  return Math.max(0, Math.min(100, raw));
}

export function movingTowardGoal(delta, start, goal) {
  if (delta == null || start == null || goal == null) return null;
  if (goal === start) return delta === 0;
  const goalDirection = goal - start;
  return (goalDirection > 0 && delta > 0) || (goalDirection < 0 && delta < 0);
}

export function signClass(delta) {
  if (delta == null) return 'delta-none';
  if (delta > 0) return 'delta-pos';
  if (delta < 0) return 'delta-neg';
  return 'delta-zero';
}
