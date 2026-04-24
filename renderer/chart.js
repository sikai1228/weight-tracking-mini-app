import { parseISO, daysBetween, toISO, addDays, formatShortDate, formatEstDate, fmtWeight, fmtSignedWeight, signClass } from './util.js';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

function computeScales(points, width, height, padding, goal, yBounds, xBounds) {
  let min, max;
  if (yBounds) {
    min = yBounds.min;
    max = yBounds.max;
  } else {
    const values = points.map((p) => p.weight);
    if (goal != null) values.push(goal);
    min = Math.min(...values);
    max = Math.max(...values);
    if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
    const range = max - min || 1;
    const pad = range * 0.1;
    min -= pad;
    max += pad;
  }

  let tMin, tMax;
  if (xBounds) {
    tMin = parseISO(xBounds.start).getTime();
    tMax = parseISO(xBounds.end).getTime();
  } else {
    const dates = points.map((p) => parseISO(p.date).getTime());
    tMin = Math.min(...dates);
    tMax = Math.max(...dates);
  }
  const tRange = tMax - tMin || 1;

  const x = (iso) => {
    const t = parseISO(iso).getTime();
    return padding.left + ((t - tMin) / tRange) * (width - padding.left - padding.right);
  };
  const y = (w) =>
    padding.top + (1 - (w - min) / (max - min)) * (height - padding.top - padding.bottom);
  return { x, y, min, max };
}

function chooseTickStrategy(spanDays) {
  if (spanDays <= 14) return 'daily';
  if (spanDays <= 100) return 'weekly';
  return 'monthly';
}

function generateTicks(startIso, endIso, strategy) {
  const ticks = [];
  if (strategy === 'daily') {
    let iso = startIso;
    while (iso <= endIso) {
      ticks.push(iso);
      iso = addDays(iso, 1);
    }
    return ticks;
  }
  if (strategy === 'weekly') {
    const d = parseISO(startIso);
    const dayOfWeek = d.getDay();
    const offset = (1 - dayOfWeek + 7) % 7;
    d.setDate(d.getDate() + offset);
    let iso = toISO(d);
    if (iso > endIso) return [startIso, endIso];
    while (iso <= endIso) {
      ticks.push(iso);
      iso = addDays(iso, 7);
    }
    return ticks;
  }
  const d = parseISO(startIso);
  let cursor = new Date(d.getFullYear(), d.getMonth(), 1);
  if (cursor < d) cursor = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  let iso = toISO(cursor);
  while (iso <= endIso) {
    ticks.push(iso);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    iso = toISO(cursor);
  }
  if (ticks.length < 2) return [startIso, endIso];
  return ticks;
}

function formatTick(iso, strategy, crossesYears) {
  const d = parseISO(iso);
  if (strategy === 'monthly') {
    const label = MONTH_SHORT[d.getMonth()];
    return crossesYears && d.getMonth() === 0 ? `${label} '${String(d.getFullYear()).slice(2)}` : label;
  }
  return formatShortDate(iso);
}

function trendYBounds(points, goal) {
  const weights = points.map((p) => p.weight);
  const lowest = Math.min(...weights);
  const highest = Math.max(...weights);
  const lowBase = Math.floor(lowest / 5) * 5;
  const yMin = lowBase === lowest ? lowBase - 5 : lowBase;
  const fromData = Math.ceil((highest + 5) / 5) * 5;
  const fromGoal = goal != null ? Math.ceil(goal / 5) * 5 : fromData;
  const yMax = Math.max(fromData, fromGoal);
  return { min: yMin, max: yMax };
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

export function trendChart({ points, goal, rolling, xBounds, width = 800, height = 360 }) {
  const wrap = document.createElement('div');
  wrap.className = 'trend-chart-wrap';
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height });
  wrap.appendChild(svg);
  if (!points.length) {
    const text = el('text', {
      x: width / 2, y: height / 2,
      'text-anchor': 'middle',
      class: 'axis-label',
    });
    text.textContent = 'No entries in this range';
    svg.appendChild(text);
    return wrap;
  }
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const yBounds = trendYBounds(points, goal);
  const { x, y, min, max } = computeScales(points, width, height, padding, goal, yBounds, xBounds);

  for (let v = min; v <= max + 0.001; v += 5) {
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
    label.textContent = String(Math.round(v));
    svg.appendChild(label);
  }

  const firstDate = xBounds ? xBounds.start : points[0].date;
  const lastDate = xBounds ? xBounds.end : points[points.length - 1].date;
  const spanDays = Math.max(1, daysBetween(firstDate, lastDate));
  const strategy = chooseTickStrategy(spanDays);
  const ticks = generateTicks(firstDate, lastDate, strategy);
  const crossesYears = parseISO(firstDate).getFullYear() !== parseISO(lastDate).getFullYear();
  for (const iso of ticks) {
    const label = el('text', {
      x: x(iso), y: height - padding.bottom + 16,
      'text-anchor': 'middle',
      class: 'axis-label',
    });
    label.textContent = formatTick(iso, strategy, crossesYears);
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
      r: 3,
      class: 'chart-dot',
    }));
  }

  if (rolling && rolling.length > 1) {
    const d = rolling.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(2)},${y(p.weight).toFixed(2)}`).join(' ');
    svg.appendChild(el('path', { d, class: 'chart-line' }));
  }

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const prev = i > 0 ? points[i - 1] : null;
    const hit = el('circle', {
      cx: x(p.date), cy: y(p.weight),
      r: 12,
      class: 'chart-dot-hit',
      'data-iso': p.date,
      'data-weight': String(p.weight),
    });
    if (prev) hit.setAttribute('data-prev-weight', String(prev.weight));
    svg.appendChild(hit);
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.style.display = 'none';
  wrap.appendChild(tooltip);

  let activeIso = null;

  function hide() {
    tooltip.style.display = 'none';
    activeIso = null;
  }

  function showFor(dot) {
    const iso = dot.getAttribute('data-iso');
    if (activeIso === iso) { hide(); return; }
    activeIso = iso;
    const weight = parseFloat(dot.getAttribute('data-weight'));
    const prevAttr = dot.getAttribute('data-prev-weight');
    const change = prevAttr ? weight - parseFloat(prevAttr) : null;
    tooltip.innerHTML = `
      <div class="tt-date">${formatEstDate(iso)}</div>
      <div class="tt-weight">${fmtWeight(weight)} lbs</div>
      <div class="tt-change ${signClass(change)}">${change == null ? '' : fmtSignedWeight(change) + ' lbs'}</div>
    `;
    const dotRect = dot.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    tooltip.style.left = `${dotRect.left - wrapRect.left + dotRect.width / 2}px`;
    tooltip.style.top = `${dotRect.top - wrapRect.top}px`;
    tooltip.style.display = 'block';
  }

  svg.addEventListener('click', (e) => {
    const dot = e.target.closest ? e.target.closest('.chart-dot-hit') : null;
    if (dot) showFor(dot);
    else hide();
  });

  const onDocClick = (e) => {
    if (!wrap.isConnected) {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (!svg.contains(e.target)) hide();
  };
  const onKey = (e) => {
    if (!wrap.isConnected) {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === 'Escape') hide();
  };
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);

  return wrap;
}
