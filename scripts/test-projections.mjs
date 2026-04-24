import assert from 'node:assert/strict';
import {
  linearRegression,
  computeRollingAverage,
  estimateGoalDate,
} from '../renderer/projections.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    if (err.stack) console.log(err.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }
}

function isoAfter(startIso, i) {
  const d = new Date(startIso + 'T00:00:00');
  d.setDate(d.getDate() + i);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(aIso, bIso) {
  const a = new Date(aIso + 'T00:00:00');
  const b = new Date(bIso + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

// Deterministic pseudo-noise so tests don't flake.
function noise(i) {
  return Math.sin(i * 1.37) * 0.4 + Math.cos(i * 0.81) * 0.25;
}

function generateEntries(startIso, count, startWeight, dailyChange, noiseAmp = 0) {
  const entries = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      date: isoAfter(startIso, i),
      weight: startWeight + dailyChange * i + noise(i) * noiseAmp,
    });
  }
  return entries;
}

console.log('linearRegression');

test('perfect line recovers slope and intercept', () => {
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push({ x: i, y: 2 * i + 5 });
  const { slope, intercept, rSquared } = linearRegression(pts);
  assert.ok(Math.abs(slope - 2) < 1e-9, `slope ${slope}`);
  assert.ok(Math.abs(intercept - 5) < 1e-9, `intercept ${intercept}`);
  assert.ok(Math.abs(rSquared - 1) < 1e-9, `rSquared ${rSquared}`);
});

test('flat series gives zero slope and full variance explained', () => {
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push({ x: i, y: 7 });
  const { slope, rSquared } = linearRegression(pts);
  assert.equal(slope, 0);
  assert.equal(rSquared, 1);
});

console.log('computeRollingAverage');

test('rolling average equals raw weights when window has just started', () => {
  const entries = [
    { date: '2026-01-01', weight: 100 },
    { date: '2026-01-02', weight: 102 },
    { date: '2026-01-03', weight: 104 },
  ];
  const rolling = computeRollingAverage(entries, 7);
  assert.equal(rolling.length, 3);
  assert.equal(rolling[0].value, 100);
  assert.equal(rolling[1].value, 101);
  assert.equal(rolling[2].value, 102);
});

console.log('estimateGoalDate');

test('clean linear gain returns date close to expected', () => {
  const entries = generateEntries('2026-01-01', 30, 110, 0.1);
  const result = estimateGoalDate(entries, 125);
  assert.ok(result.date != null, `expected a date, got reason=${result.reason}`);
  // Rolling-average transient at the start reduces fit slightly below 1.
  assert.ok(result.rSquared > 0.99, `expected near-perfect fit, got rSquared=${result.rSquared}`);
  assert.ok(result.weeklyRate > 0.6 && result.weeklyRate < 0.8, `weeklyRate=${result.weeklyRate}`);
  // Result must be internally consistent: slope * days + currentTrend ≈ goal
  const implied = result.slope * result.daysToGoal + 112.6;
  assert.ok(Math.abs(implied - 125) < 0.5, `implied=${implied}`);
  // Projected ~100–160 days past the last entry for this slope.
  const anchor = '2026-01-30';
  const days = daysBetween(anchor, result.date);
  assert.ok(days > 100 && days < 160, `expected 100-160 days past anchor, got ${days}`);
});

test('noisy upward trend still returns a reasonable date with lower R²', () => {
  const entries = generateEntries('2026-01-01', 30, 110, 0.1, 2);
  const result = estimateGoalDate(entries, 125);
  assert.ok(result.date != null, `expected a date, got reason=${result.reason}`);
  assert.ok(result.rSquared < 1 && result.rSquared > 0.3, `rSquared=${result.rSquared}`);
  assert.ok(result.weeklyRate > 0, `weeklyRate=${result.weeklyRate}`);
  const anchor = '2026-01-30';
  const days = daysBetween(anchor, result.date);
  assert.ok(days > 30 && days < 400, `days=${days}`);
});

test('flat data returns plateau', () => {
  const entries = generateEntries('2026-01-01', 30, 118, 0);
  const result = estimateGoalDate(entries, 125);
  assert.equal(result.date, null);
  assert.equal(result.reason, 'plateau');
});

test('trending wrong way returns wrong_direction', () => {
  const entries = generateEntries('2026-01-01', 30, 120, 0.1); // gaining
  const result = estimateGoalDate(entries, 110); // but goal is lower
  assert.equal(result.date, null);
  assert.equal(result.reason, 'wrong_direction');
});

test('fewer than 14 entries returns insufficient_data', () => {
  const entries = generateEntries('2026-01-01', 13, 110, 0.1);
  const result = estimateGoalDate(entries, 125);
  assert.equal(result.date, null);
  assert.equal(result.reason, 'insufficient_data');
});

test('projection more than 2 years out returns too_far', () => {
  // Very slow progress: gain 0.01 lb/day, goal 25 lbs away
  const entries = generateEntries('2026-01-01', 30, 110, 0.01);
  const result = estimateGoalDate(entries, 145);
  assert.equal(result.date, null, `got date=${result.date}, rate=${result.weeklyRate}`);
  assert.equal(result.reason, 'too_far');
});

test('cut mode with losing trend projects a date', () => {
  const entries = generateEntries('2026-01-01', 30, 180, -0.2);
  const result = estimateGoalDate(entries, 160, { mode: 'cut' });
  assert.ok(result.date != null, `reason=${result.reason}`);
  assert.ok(result.weeklyRate < 0);
});

test('bulk mode explicit with losing trend returns wrong_direction', () => {
  const entries = generateEntries('2026-01-01', 30, 130, -0.1);
  const result = estimateGoalDate(entries, 145, { mode: 'bulk' });
  assert.equal(result.date, null);
  assert.equal(result.reason, 'wrong_direction');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
