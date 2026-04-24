const MS_PER_DAY = 86400000;

function parseISO(iso) {
  return new Date(iso + 'T00:00:00');
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(iso, days) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function linearRegression(points) {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0, rSquared: 0 };
  if (n === 1) return { slope: 0, intercept: points[0].y, rSquared: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) {
    return { slope: 0, intercept: sumY / n, rSquared: 0 };
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  let ssTotal = 0;
  let ssResidual = 0;
  for (const p of points) {
    ssTotal += (p.y - meanY) ** 2;
    const predicted = slope * p.x + intercept;
    ssResidual += (p.y - predicted) ** 2;
  }
  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;

  return { slope, intercept, rSquared };
}

export function computeRollingAverage(entries, windowDays = 7) {
  if (!entries.length) return [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const result = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const windowStart = addDays(current.date, -(windowDays - 1));
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (sorted[j].date < windowStart) break;
      sum += sorted[j].weight;
      count++;
    }
    result.push({ date: current.date, value: sum / count });
  }
  return result;
}

export function estimateGoalDate(entries, goalWeight, options = {}) {
  const {
    rollingWindowDays = 7,
    regressionWindowPoints = 30,
    minPoints = 14,
    slopeThreshold = 0.005,
    maxDaysOut = 730,
  } = options;

  if (goalWeight == null || !Array.isArray(entries) || entries.length === 0) {
    return { date: null, reason: 'insufficient_data' };
  }

  const rolling = computeRollingAverage(entries, rollingWindowDays);
  const window = rolling.slice(-regressionWindowPoints);
  const windowDays = window.length;
  if (windowDays < minPoints) {
    return { date: null, reason: 'insufficient_data', windowDays };
  }

  const x0 = parseISO(window[0].date).getTime();
  const regPoints = window.map((p) => ({
    x: (parseISO(p.date).getTime() - x0) / MS_PER_DAY,
    y: p.value,
  }));
  const { slope, intercept, rSquared } = linearRegression(regPoints);

  if (Math.abs(slope) < slopeThreshold) {
    return { date: null, reason: 'plateau', windowDays, slope, weeklyRate: slope * 7, rSquared };
  }

  const currentTrendWeight = window[window.length - 1].value;
  const isGaining = goalWeight > currentTrendWeight;
  if ((isGaining && slope <= 0) || (!isGaining && slope >= 0)) {
    return { date: null, reason: 'wrong_direction', windowDays, slope, weeklyRate: slope * 7, rSquared };
  }

  const daysToGoal = (goalWeight - currentTrendWeight) / slope;
  if (daysToGoal > maxDaysOut) {
    return { date: null, reason: 'too_far', windowDays, slope, weeklyRate: slope * 7, rSquared, daysToGoal };
  }

  const anchorIso = window[window.length - 1].date;
  const estimatedDate =
    daysToGoal <= 0 ? anchorIso : addDays(anchorIso, Math.round(daysToGoal));

  return {
    date: estimatedDate,
    slope,
    intercept,
    weeklyRate: slope * 7,
    rSquared,
    daysToGoal: Math.max(0, daysToGoal),
    windowDays,
  };
}

export function regressionLinePoints(entries, xBounds, options = {}) {
  const {
    rollingWindowDays = 7,
    minPoints = 14,
  } = options;
  if (!entries.length) return null;
  const rolling = computeRollingAverage(entries, rollingWindowDays);
  let window = rolling;
  if (xBounds) {
    window = rolling.filter(
      (p) => p.date >= xBounds.start && p.date <= xBounds.end
    );
  }
  if (window.length < minPoints) return null;

  const x0 = parseISO(window[0].date).getTime();
  const regPoints = window.map((p) => ({
    x: (parseISO(p.date).getTime() - x0) / MS_PER_DAY,
    y: p.value,
  }));
  const { slope, intercept, rSquared } = linearRegression(regPoints);

  const firstIso = window[0].date;
  const lastIso = window[window.length - 1].date;
  const firstX = 0;
  const lastX = regPoints[regPoints.length - 1].x;
  return {
    points: [
      { date: firstIso, weight: slope * firstX + intercept },
      { date: lastIso, weight: slope * lastX + intercept },
    ],
    slope,
    intercept,
    rSquared,
  };
}
