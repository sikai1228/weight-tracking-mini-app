import {
  todayISO, toISO, parseISO, addDays, daysBetween,
  formatFullDate, formatShortDate, formatEstDate,
  avg, rollingAverageWindow, weightChangePastDays,
  progressPct, signClass, entriesInRange,
} from './util.js';
import { progressRing, sparkline, trendChart } from './chart.js';
import { estimateGoalDate, regressionLinePoints } from './projections.js';
import { createDatePicker } from './datepicker.js';
import {
  formatWeight, formatSignedWeight, unitLabel, toBase, fromBase, axisStep,
} from './units.js';

const api = window.api;

const state = {
  view: 'today',
  meta: null,
  entries: [],
  sparklineRange: 'All',
  trendsRange: 'All',
};

const views = {
  today: renderToday,
  trends: renderTrends,
  history: renderHistory,
};

async function boot() {
  await refresh();
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });
  const bottomMount = document.getElementById('sidebar-bottom');
  if (bottomMount) {
    bottomMount.appendChild(buildUnitToggle());
    updateUnitToggle();
  }
  if (!state.meta.isConfigured) {
    showSetupModal();
  }
  render();
}

function buildUnitToggle() {
  const wrap = document.createElement('div');
  wrap.className = 'unit-toggle';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Unit');
  for (const key of ['lb', 'kg']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'unit-seg';
    btn.dataset.unit = key;
    btn.textContent = key;
    btn.addEventListener('click', async () => {
      if (state.meta.unit === key) return;
      await api.meta.setUnit(key);
      await refresh();
      updateUnitToggle();
      render();
    });
    wrap.appendChild(btn);
  }
  return wrap;
}

function updateUnitToggle() {
  document.querySelectorAll('.unit-seg').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.unit === state.meta.unit);
  });
}

async function refresh() {
  const data = await api.stats.all();
  state.meta = data.meta;
  state.entries = data.entries;
}

function setView(name) {
  state.view = name;
  render();
}

function render() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
  const root = document.getElementById('view');
  root.replaceChildren();
  const fn = views[state.view] || renderToday;
  fn(root);
}

/* ---------- Confirm modal ---------- */

function confirmDialog({ title, message, confirmLabel = 'Confirm', destructive = false }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');

    const heading = document.createElement('h2');
    heading.textContent = title;
    dialog.appendChild(heading);

    if (message) {
      const body = document.createElement('p');
      body.className = 'subtitle';
      body.textContent = message;
      dialog.appendChild(body);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-ghost';
    cancelBtn.textContent = 'Cancel';
    const confirmBtn = document.createElement('button');
    confirmBtn.className = destructive ? 'btn-danger' : 'btn-primary';
    confirmBtn.textContent = confirmLabel;
    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(actions);

    backdrop.appendChild(dialog);
    root.appendChild(backdrop);

    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      root.removeChild(backdrop);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
    document.addEventListener('keydown', onKey);
    confirmBtn.focus();
  });
}

/* ---------- First-launch setup ---------- */

function showSetupModal() {
  const root = document.getElementById('modal-root');
  root.replaceChildren();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const unit = state.meta.unit;
  const label = unitLabel(unit);
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Welcome</h2>
      <p class="subtitle">Set your starting weight and goal to begin tracking.</p>
      <div class="field">
        <label for="setup-start">Starting weight (${label})</label>
        <input id="setup-start" type="number" step="0.1" min="1" inputmode="decimal" />
      </div>
      <div class="field">
        <label for="setup-goal">Goal weight (${label})</label>
        <input id="setup-goal" type="number" step="0.1" min="1" inputmode="decimal" />
      </div>
      <div class="actions">
        <button class="btn-primary" id="setup-save">Save</button>
      </div>
    </div>
  `;
  root.appendChild(backdrop);

  const startInput = backdrop.querySelector('#setup-start');
  const goalInput = backdrop.querySelector('#setup-goal');
  const saveBtn = backdrop.querySelector('#setup-save');

  startInput.focus();

  const submit = async () => {
    const startEntered = Number(startInput.value);
    const goalEntered = Number(goalInput.value);
    if (!(startEntered > 0) || !(goalEntered > 0)) return;
    saveBtn.disabled = true;
    const startWeight = toBase(startEntered, unit);
    const goal = toBase(goalEntered, unit);
    await api.meta.setup({ startWeight, goal, startDate: todayISO() });
    await refresh();
    root.replaceChildren();
    render();
  };

  saveBtn.addEventListener('click', submit);
  [startInput, goalInput].forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });
}

/* ---------- Today ---------- */

function renderToday(root) {
  const container = document.createElement('div');
  container.className = 'view view-centered';

  container.appendChild(buildHeroCard());
  container.appendChild(buildLogCard());
  container.appendChild(buildStatsRow());
  container.appendChild(buildSparklineCard());

  root.appendChild(container);
}

function buildHeroCard() {
  const card = document.createElement('section');
  card.className = 'card hero';

  const today = todayISO();
  const sevenDay = rollingAverageWindow(state.entries, today, 7);
  const latest = state.entries.length ? state.entries[state.entries.length - 1].weight : null;
  const display = sevenDay ?? latest;
  const weeklyDelta = weightChangePastDays(state.entries, 7);

  const left = document.createElement('div');
  const dateEl = document.createElement('div');
  dateEl.className = 'hero-date';
  dateEl.textContent = formatFullDate(today);
  left.appendChild(dateEl);

  const unit = state.meta.unit;
  if (display != null) {
    const weight = document.createElement('div');
    weight.className = 'hero-weight';
    weight.innerHTML = `<span class="hero-number">${formatWeight(display, unit)}</span><span class="hero-unit">${unitLabel(unit)}</span>`;
    left.appendChild(weight);

    const delta = document.createElement('div');
    delta.className = 'hero-delta';
    if (weeklyDelta == null) {
      delta.classList.add('delta-none');
      delta.textContent = 'Not enough data yet';
    } else {
      delta.classList.add(signClass(weeklyDelta));
      delta.textContent = `${formatSignedWeight(weeklyDelta, unit)} ${unitLabel(unit)} in the past seven days`;
    }
    left.appendChild(delta);
  } else {
    const empty = document.createElement('div');
    empty.className = 'hero-empty';
    empty.textContent = 'Log your first entry to see your average here.';
    left.appendChild(empty);
  }

  const right = document.createElement('div');
  right.className = 'ring-wrap';
  const current = latest;
  const pct = progressPct(current, state.meta.startWeight, state.meta.goal);
  right.appendChild(progressRing({ percent: pct ?? 0 }));
  const ringText = document.createElement('div');
  ringText.className = 'ring-text';
  ringText.textContent = pct == null ? '—' : `${Math.round(pct)}%`;
  right.appendChild(ringText);

  card.appendChild(left);
  card.appendChild(right);
  return card;
}

function buildLogCard() {
  const card = document.createElement('section');
  card.className = 'card';
  const unit = state.meta.unit;
  const label = unitLabel(unit);
  card.innerHTML = `
    <div class="card-header">
      <div class="card-label">Log weight</div>
    </div>
    <div class="log-row">
      <div class="field">
        <label for="log-weight">Weight</label>
        <div class="weight-input">
          <input id="log-weight" type="number" step="0.1" min="1" inputmode="decimal" placeholder="0.0" />
          <span class="suffix">${label}</span>
        </div>
      </div>
      <div class="field">
        <label>Date</label>
        <div id="log-date-mount"></div>
      </div>
      <button class="btn-primary" id="log-save">Save entry</button>
    </div>
  `;

  const weightInput = card.querySelector('#log-weight');
  const saveBtn = card.querySelector('#log-save');
  const dateMount = card.querySelector('#log-date-mount');

  const today = todayISO();
  const picker = createDatePicker({
    value: today,
    maxDate: new Date(),
    onChange: (iso) => {
      const existing = state.entries.find((e) => e.date === iso);
      weightInput.value = existing ? formatWeight(existing.weight, unit) : '';
    },
  });
  dateMount.appendChild(picker.element);

  const existingToday = state.entries.find((e) => e.date === today);
  if (existingToday) weightInput.value = formatWeight(existingToday.weight, unit);

  const submit = async () => {
    const entered = Number(weightInput.value);
    const d = picker.getValue();
    if (!(entered > 0) || !d) return;
    saveBtn.disabled = true;
    try {
      const weightInBase = toBase(entered, unit);
      await api.entries.upsert({ date: d, weight: weightInBase });
      await refresh();
      render();
    } catch (err) {
      console.error(err);
      saveBtn.disabled = false;
    }
  };

  saveBtn.addEventListener('click', submit);
  weightInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });

  return card;
}

function buildStatsRow() {
  const row = document.createElement('div');
  row.className = 'stats-row';
  const unit = state.meta.unit;

  row.appendChild(buildStatCard({
    label: 'Start',
    value: state.meta.startWeight,
    unit,
    editable: true,
    onSave: async (v) => {
      await api.meta.setStartWeight(v);
      await refresh();
      render();
    },
  }));

  row.appendChild(buildStatCard({
    label: 'Goal',
    value: state.meta.goal,
    unit,
    editable: true,
    onSave: async (v) => {
      await api.meta.setGoal(v);
      await refresh();
      render();
    },
  }));

  const estimate = estimateGoalDate(state.entries, state.meta.goal);
  row.appendChild(buildStatCard({
    label: 'Estimated time',
    value: estimate.date,
    kind: 'date',
    editable: false,
    info: {
      onClick: (anchor) => showProjectionInfo(estimate, state.meta.goal, state.meta.unit, anchor),
    },
  }));

  return row;
}

function buildStatCard({ label, value, kind = 'weight', unit = 'lb', editable, onSave, info }) {
  const card = document.createElement('div');
  card.className = 'stat-card';

  const header = document.createElement('div');
  header.className = 'stat-card-header';

  const labelEl = document.createElement('div');
  labelEl.className = 'stat-label';
  labelEl.textContent = label;
  header.appendChild(labelEl);

  let editBtn = null;
  if (editable) {
    editBtn = document.createElement('button');
    editBtn.className = 'stat-edit-btn';
    editBtn.setAttribute('aria-label', `Edit ${label.toLowerCase()}`);
    editBtn.innerHTML = editIcon();
    header.appendChild(editBtn);
  }

  if (info) {
    const infoBtn = document.createElement('button');
    infoBtn.className = 'stat-info-btn';
    infoBtn.setAttribute('aria-label', `About ${label.toLowerCase()}`);
    infoBtn.innerHTML = infoIcon();
    infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      info.onClick(infoBtn);
    });
    header.appendChild(infoBtn);
  }

  card.appendChild(header);

  const valueEl = document.createElement('div');
  valueEl.className = 'stat-value';

  const numEl = document.createElement('span');
  numEl.className = 'stat-primary';
  if (kind === 'date') {
    numEl.textContent = value == null ? '—' : formatEstDate(value);
  } else {
    numEl.textContent = value == null ? '—' : formatWeight(value, unit);
  }
  valueEl.appendChild(numEl);

  if (kind !== 'date') {
    const unitEl = document.createElement('span');
    unitEl.className = 'stat-unit';
    unitEl.textContent = unitLabel(unit);
    valueEl.appendChild(unitEl);
  }

  card.appendChild(valueEl);

  if (editable) {
    editBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.min = '1';
      input.className = 'stat-edit-input';
      input.value = value == null ? '' : formatWeight(value, unit);
      numEl.replaceWith(input);
      input.focus();
      input.select();

      let finished = false;
      const onOutsideMouseDown = (e) => {
        if (!input.contains(e.target)) input.blur();
      };
      const finalize = async (commit) => {
        if (finished) return;
        finished = true;
        document.removeEventListener('mousedown', onOutsideMouseDown, true);
        const parsedDisplay = Number(input.value);
        const originalDisplay = value == null ? null : Number(formatWeight(value, unit));
        if (commit && parsedDisplay > 0 && parsedDisplay !== originalDisplay) {
          await onSave(toBase(parsedDisplay, unit));
        } else {
          render();
        }
      };
      input.addEventListener('blur', () => finalize(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') {
          finished = true;
          document.removeEventListener('mousedown', onOutsideMouseDown, true);
          render();
        }
      });
      document.addEventListener('mousedown', onOutsideMouseDown, true);
    });
  }

  return card;
}

function editIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="none"/>
    <path d="M10 4l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}

function infoIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
    <path d="M8 7.2v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="8" cy="5.2" r="0.6" fill="currentColor"/>
  </svg>`;
}

function showProjectionInfo(estimate, goalWeight, unit, anchorEl) {
  const root = document.getElementById('modal-root');
  root.replaceChildren();

  const popover = document.createElement('div');
  popover.className = 'projection-popover';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'projection-popover-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '×';
  popover.appendChild(closeBtn);

  const content = document.createElement('div');
  content.className = 'projection-popover-content';
  content.innerHTML = projectionInfoHtml(estimate, goalWeight, unit);
  popover.appendChild(content);

  root.appendChild(popover);

  const anchorRect = anchorEl.getBoundingClientRect();
  const popWidth = popover.offsetWidth;
  const viewportW = window.innerWidth;
  let left = anchorRect.right - popWidth;
  if (left < 16) left = 16;
  if (left + popWidth > viewportW - 16) left = viewportW - popWidth - 16;
  const top = anchorRect.bottom + 8;
  popover.style.position = 'fixed';
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;

  const close = () => {
    root.replaceChildren();
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey);
  };
  const onOutside = (e) => {
    if (!popover.contains(e.target) && e.target !== anchorEl) close();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  closeBtn.addEventListener('click', close);
  document.addEventListener('mousedown', onOutside, true);
  document.addEventListener('keydown', onKey);
}

function projectionInfoHtml(estimate, goalWeight, unit) {
  const windowDays = estimate.windowDays ?? 30;
  const label = unitLabel(unit);
  if (estimate.reason === 'insufficient_data') {
    return `Log at least <strong>14 days</strong> of weights to see a projection.`;
  }
  if (estimate.reason === 'plateau') {
    return `Your weight has been steady over the past <strong>${windowDays} days</strong>. Log more entries to see a projection.`;
  }
  const direction = estimate.slope > 0 ? 'gaining' : 'losing';
  const rate = Math.abs(fromBase(estimate.weeklyRate, unit)).toFixed(2);
  const goalStr = `${formatWeight(goalWeight, unit)} ${label}`;
  if (estimate.reason === 'wrong_direction') {
    return `You've been <strong>${direction} ${rate} ${label}/week</strong> over the past <strong>${windowDays} days</strong>, which is moving away from your <strong>${goalStr} goal</strong>.`;
  }
  if (estimate.reason === 'too_far') {
    return `At your current rate, reaching <strong>${goalStr}</strong> would take more than <strong>2 years</strong>. Consider adjusting your goal or your rate.`;
  }
  const days = Math.round(estimate.daysToGoal);
  let confidence = 'low confidence';
  if (estimate.rSquared >= 0.7) confidence = 'high confidence';
  else if (estimate.rSquared >= 0.4) confidence = 'moderate confidence';
  return `You've been <strong>${direction} ${rate} ${label}/week</strong> over the past <strong>${windowDays} days</strong>. At this rate, you'll reach your <strong>${goalStr} goal</strong> in about <strong>${days} more days</strong>, with <strong>${confidence}</strong>.`;
}

function buildSparklineCard() {
  const card = document.createElement('section');
  card.className = 'card sparkline-card';

  const unit = state.meta.unit;
  const today = todayISO();
  const days = RANGE_DAYS[state.sparklineRange];
  let points;
  if (days == null) {
    points = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
  } else {
    const startIso = addDays(today, -(days - 1));
    points = entriesInRange(state.entries, startIso, today);
  }
  const deltaBase = points.length >= 2
    ? points[points.length - 1].weight - points[0].weight
    : null;

  const header = document.createElement('div');
  header.className = 'sparkline-header';

  const title = document.createElement('div');
  title.className = 'sparkline-title';
  const beforeWord = document.createElement('span');
  beforeWord.textContent = 'Last';
  title.appendChild(beforeWord);
  title.appendChild(buildRangeDropdown({
    options: Object.keys(RANGE_DAYS),
    value: state.sparklineRange,
    onChange: (v) => {
      state.sparklineRange = v;
      render();
    },
  }));
  header.appendChild(title);

  const deltaEl = document.createElement('div');
  deltaEl.className = `sparkline-delta ${signClass(deltaBase)}`;
  deltaEl.textContent = deltaBase == null ? '—' : `${formatSignedWeight(deltaBase, unit)} ${unitLabel(unit)}`;
  header.appendChild(deltaEl);

  card.appendChild(header);

  const chartWrap = document.createElement('div');
  chartWrap.style.height = '120px';
  const displayPoints = points.map((p) => ({ date: p.date, weight: fromBase(p.weight, unit) }));
  chartWrap.appendChild(sparkline({ points: displayPoints }));
  card.appendChild(chartWrap);

  return card;
}

function buildRangeDropdown({ options, value, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'range-dropdown';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'range-trigger';
  trigger.innerHTML = `<span class="range-value">${value}</span><span class="range-caret">${caretDownIcon()}</span>`;
  wrap.appendChild(trigger);

  const menu = document.createElement('div');
  menu.className = 'range-menu';
  menu.style.display = 'none';
  wrap.appendChild(menu);

  options.forEach((opt) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'range-item' + (opt === value ? ' active' : '');
    item.textContent = opt;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      if (opt !== value) onChange(opt);
    });
    menu.appendChild(item);
  });

  let open = false;
  const onOutside = (e) => {
    if (!wrap.contains(e.target)) close();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  const close = () => {
    if (!open) return;
    open = false;
    menu.style.display = 'none';
    wrap.classList.remove('open');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey);
  };
  const openMenu = () => {
    if (open) return;
    open = true;
    menu.style.display = 'flex';
    wrap.classList.add('open');
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey);
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    open ? close() : openMenu();
  });

  return wrap;
}

function caretDownIcon() {
  return `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M2 3.8l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ---------- Trends ---------- */

const RANGE_DAYS = { '7D': 7, '1M': 30, '3M': 90, '1Y': 365, 'All': null };

function renderTrends(root) {
  const container = document.createElement('div');
  container.className = 'view';

  const title = document.createElement('h1');
  title.className = 'view-title';
  title.textContent = 'Trends';
  container.appendChild(title);

  const card = document.createElement('section');
  card.className = 'card trend-card';

  const header = document.createElement('div');
  header.className = 'trend-header';

  const segmented = document.createElement('div');
  segmented.className = 'segmented';
  for (const key of Object.keys(RANGE_DAYS)) {
    const btn = document.createElement('button');
    btn.textContent = key;
    if (key === state.trendsRange) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.trendsRange = key;
      render();
    });
    segmented.appendChild(btn);
  }

  const unit = state.meta.unit;
  const windowPoints = rangedPoints();
  const deltaBase = windowPoints.length >= 2
    ? windowPoints[windowPoints.length - 1].weight - windowPoints[0].weight
    : null;
  const meta = document.createElement('div');
  meta.className = `trend-delta ${signClass(deltaBase)}`;
  meta.textContent = deltaBase == null ? '' : `${formatSignedWeight(deltaBase, unit)} ${unitLabel(unit)}`;

  header.appendChild(segmented);
  header.appendChild(meta);
  card.appendChild(header);

  const chartWrap = document.createElement('div');
  chartWrap.style.height = '360px';
  const bounds = rangedBounds();
  const regression = state.trendsRange === '7D'
    ? null
    : regressionLinePoints(state.entries, bounds);
  const displayWindow = windowPoints.map((p) => ({ date: p.date, weight: fromBase(p.weight, unit) }));
  const displayGoal = state.meta.goal != null ? fromBase(state.meta.goal, unit) : null;
  const displayRegression = regression
    ? regression.points.map((p) => ({ date: p.date, weight: fromBase(p.weight, unit) }))
    : null;
  chartWrap.appendChild(trendChart({
    points: displayWindow,
    goal: displayGoal,
    regression: displayRegression,
    xBounds: bounds,
    unitLabel: unitLabel(unit),
    yStep: axisStep(unit),
  }));
  card.appendChild(chartWrap);

  container.appendChild(card);
  root.appendChild(container);
}

function rangedPoints() {
  const days = RANGE_DAYS[state.trendsRange];
  if (days == null) return state.entries.slice();
  const today = todayISO();
  const startIso = addDays(today, -(days - 1));
  return entriesInRange(state.entries, startIso, today);
}

function rangedBounds() {
  const days = RANGE_DAYS[state.trendsRange];
  const today = todayISO();
  if (days == null) {
    if (!state.entries.length) return { start: today, end: today };
    return { start: state.entries[0].date, end: state.entries[state.entries.length - 1].date };
  }
  return { start: addDays(today, -(days - 1)), end: today };
}


/* ---------- History ---------- */

function renderHistory(root) {
  const container = document.createElement('div');
  container.className = 'view';
  const unit = state.meta.unit;

  const title = document.createElement('h1');
  title.className = 'view-title';
  title.textContent = 'History';
  container.appendChild(title);

  const card = document.createElement('section');
  card.className = 'card';

  if (!state.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No entries yet. Log your first weight on the Today view.';
    card.appendChild(empty);
  } else {
    const rows = [...state.entries].sort((a, b) => b.date.localeCompare(a.date));
    const table = document.createElement('table');
    table.className = 'history-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Weight</th>
          <th>Change</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    rows.forEach((entry, idx) => {
      const prev = rows[idx + 1];
      const delta = prev ? entry.weight - prev.weight : null;
      const tr = document.createElement('tr');

      const dateTd = document.createElement('td');
      dateTd.textContent = formatShortDate(entry.date) + ', ' + parseISO(entry.date).getFullYear();
      tr.appendChild(dateTd);

      const weightTd = document.createElement('td');
      weightTd.textContent = `${formatWeight(entry.weight, unit)} ${unitLabel(unit)}`;
      tr.appendChild(weightTd);

      const deltaTd = document.createElement('td');
      deltaTd.className = 'delta ' + (delta == null ? 'delta-none' : signClass(delta));
      deltaTd.textContent = delta == null ? '—' : `${formatSignedWeight(delta, unit)} ${unitLabel(unit)}`;
      tr.appendChild(deltaTd);

      const actionTd = document.createElement('td');
      actionTd.style.textAlign = 'right';
      const del = document.createElement('button');
      del.className = 'btn-danger-ghost';
      del.setAttribute('aria-label', `Delete entry for ${entry.date}`);
      del.innerHTML = trashIcon();
      del.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Delete entry?',
          message: `This will remove the ${formatWeight(entry.weight, unit)} ${unitLabel(unit)} entry for ${formatShortDate(entry.date)}.`,
          confirmLabel: 'Delete',
          destructive: true,
        });
        if (!ok) return;
        await api.entries.delete(entry.date);
        await refresh();
        render();
      });
      actionTd.appendChild(del);
      tr.appendChild(actionTd);

      tbody.appendChild(tr);
    });
    card.appendChild(table);
  }

  container.appendChild(card);

  const footer = document.createElement('div');
  footer.className = 'history-footer';
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-ghost';
  exportBtn.textContent = 'Export to CSV';
  exportBtn.addEventListener('click', async () => {
    const csv = await api.stats.exportCsv(state.meta.unit);
    downloadCsv(csv);
  });
  footer.appendChild(exportBtn);
  container.appendChild(footer);

  root.appendChild(container);
}

function downloadCsv(text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `weight-tracker-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function trashIcon() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4 4.5l.7 8.6A1 1 0 0 0 5.7 14h4.6a1 1 0 0 0 1-.9l.7-8.6M7 7v4M9 7v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------- Boot ---------- */

boot().catch((err) => {
  console.error('boot failed', err);
  document.getElementById('view').textContent = 'Failed to load: ' + err.message;
});
