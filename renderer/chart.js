import { parseISO, daysBetween, toISO, addDays, formatShortDate } from './util.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, String(v));
  }
  return node;
}

export function progressRing({ percent, size = 96, stroke = 6 }) {
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - pct / 100);

  const svg = el('svg', {
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
  });
  svg.appendChild(el('circle', {
    cx, cy, r,
    fill: 'none',
    stroke: 'var(--track)',
    'stroke-width': stroke,
  }));
  svg.appendChild(el('circle', {
    cx, cy, r,
    fill: 'none',
    stroke: 'var(--accent)',
    'stroke-width': stroke,
    'stroke-linecap': 'round',
    'stroke-dasharray': C.toFixed(2),
    'stroke-dashoffset': offset.toFixed(2),
    transform: `rotate(-90 ${cx} ${cy})`,
  }));
  return svg;
}

function computeScales(points, width, height, padding, goal) {
  const values = points.map((p) => p.weight);
  if (goal != null) values.push(goal);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
  const range = max - min || 1;
  const pad = range * 0.1;
  min -= pad;
  max += pad;

  const dates = points.map((p) => parseISO(p.date).getTime());
  const tMin = Math.min(...dates);
  const tMax = Math.max(...dates);
  const tRange = tMax - tMin || 1;

  const x = (iso) => {
    const t = parseISO(iso).getTime();
    return padding.left + ((t - tMin) / tRange) * (width - padding.left - padding.right);
  };
  const y = (w) =>
    padding.top + (1 - (w - min) / (max - min)) * (height - padding.top - padding.bottom);
  return { x, y, min, max };
}

export function sparkline({ points, goal, width = 560, height = 120 }) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height });
  if (!points.length) {
    const text = el('text', {
      x: width / 2, y: height / 2,
      'text-anchor': 'middle',
      class: 'axis-label',
    });
    text.textContent = 'No entries in this range';
    svg.appendChild(text);
    return svg;
  }
  const padding = { top: 12, right: 8, bottom: 12, left: 8 };
  const { x, y } = computeScales(points, width, height, padding, goal);

  if (goal != null) {
    svg.appendChild(el('line', {
      x1: padding.left, x2: width - padding.right,
      y1: y(goal), y2: y(goal),
      class: 'goal-line',
    }));
  }

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(2)},${y(p.weight).toFixed(2)}`).join(' ');
  svg.appendChild(el('path', { d, class: 'chart-line' }));
  return svg;
}

export function trendChart({ points, goal, rolling, width = 800, height = 360 }) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height });
  if (!points.length) {
    const text = el('text', {
      x: width / 2, y: height / 2,
      'text-anchor': 'middle',
      class: 'axis-label',
    });
    text.textContent = 'No entries in this range';
    svg.appendChild(text);
    return svg;
  }
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const allPoints = [...points];
  if (rolling) allPoints.push(...rolling);
  const { x, y, min, max } = computeScales(allPoints, width, height, padding, goal);

  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const v = min + ((max - min) * i) / gridCount;
    const yy = y(v);
    svg.appendChild(el('line', {
      x1: padding.left, x2: width - padding.right,
      y1: yy, y2: yy,
      class: 'grid-line',
    }));
    const label = el('text', {
      x: padding.left - 6, y: yy + 3,
      'text-anchor': 'end',
      class: 'axis-label',
    });
    label.textContent = v.toFixed(1);
    svg.appendChild(label);
  }

  const firstDate = points[0].date;
  const lastDate = points[points.length - 1].date;
  const totalDays = daysBetween(firstDate, lastDate) || 1;
  const stepDays = Math.max(1, Math.round(totalDays / 5));
  for (let i = 0; i <= 5; i++) {
    const d = addDays(firstDate, Math.min(totalDays, i * stepDays));
    const label = el('text', {
      x: x(d), y: height - padding.bottom + 16,
      'text-anchor': 'middle',
      class: 'axis-label',
    });
    label.textContent = formatShortDate(d);
    svg.appendChild(label);
  }

  if (goal != null) {
    svg.appendChild(el('line', {
      x1: padding.left, x2: width - padding.right,
      y1: y(goal), y2: y(goal),
      class: 'goal-line',
    }));
  }

  for (const p of points) {
    svg.appendChild(el('circle', {
      cx: x(p.date), cy: y(p.weight),
      r: 2.5,
      class: 'chart-dot',
    }));
  }

  if (rolling && rolling.length > 1) {
    const d = rolling.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(2)},${y(p.weight).toFixed(2)}`).join(' ');
    svg.appendChild(el('path', { d, class: 'chart-line' }));
  }

  return svg;
}
