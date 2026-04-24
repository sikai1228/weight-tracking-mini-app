import {
  todayISO, toISO, parseISO, addDays, daysBetween,
  formatFullDate, formatShortDate, fmtWeight, fmtSignedWeight,
  avg, rollingAverageWindow, weightChangePastDays, progressPct, signClass, entriesInRange,
} from './util.js';
import { progressRing, sparkline, trendChart } from './chart.js';

const api = window.api;

const state = {
  view: 'today',
  meta: null,
  entries: [],
  sparklineDays: 30,
  trendsRange: '1M',
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
  if (!state.meta.isConfigured) {
    showSetupModal();
  }
  render();
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
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Welcome</h2>
      <p class="subtitle">Set your starting weight and goal to begin tracking.</p>
      <div class="field">
        <label for="setup-start">Starting weight (lbs)</label>
        <input id="setup-start" type="number" step="0.1" min="1" inputmode="decimal" />
      </div>
      <div class="field">
        <label for="setup-goal">Goal weight (lbs)</label>
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
    const startWeight = Number(startInput.value);
    const goal = Number(goalInput.value);
    if (!(startWeight > 0) || !(goal > 0)) return;
    saveBtn.disabled = true;
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
  container.className = 'view';

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

  if (display != null) {
    const weight = document.createElement('div');
    weight.className = 'hero-weight';
    weight.innerHTML = `<span class="hero-number">${fmtWeight(display)}</span><span class="hero-unit">lbs</span>`;
    left.appendChild(weight);

    const delta = document.createElement('div');
    delta.className = 'hero-delta';
    if (weeklyDelta == null) {
      delta.classList.add('delta-none');
      delta.textContent = 'Not enough data yet';
    } else {
      delta.classList.add(signClass(weeklyDelta));
      delta.textContent = `${fmtSignedWeight(weeklyDelta)} lbs the past seven days`;
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
  card.innerHTML = `
    <div class="card-header">
      <div class="card-label">Log weight</div>
    </div>
    <div class="log-row">
      <div class="field">
        <label for="log-weight">Weight</label>
        <div class="weight-input">
          <input id="log-weight" type="number" step="0.1" min="1" inputmode="decimal" placeholder="0.0" />
          <span class="suffix">lbs</span>
        </div>
      </div>
      <div class="field">
        <label for="log-date">Date</label>
        <input id="log-date" type="date" />
      </div>
      <button class="btn-primary" id="log-save">Save entry</button>
    </div>
  `;

  const dateInput = card.querySelector('#log-date');
  const weightInput = card.querySelector('#log-weight');
  const saveBtn = card.querySelector('#log-save');
  dateInput.value = todayISO();
  dateInput.max = todayISO();

  const existingToday = state.entries.find((e) => e.date === dateInput.value);
  if (existingToday) weightInput.value = existingToday.weight;

  dateInput.addEventListener('change', () => {
    const existing = state.entries.find((e) => e.date === dateInput.value);
    weightInput.value = existing ? existing.weight : '';
  });

  const submit = async () => {
    const w = Number(weightInput.value);
    const d = dateInput.value;
    if (!(w > 0) || !d) return;
    saveBtn.disabled = true;
    try {
      await api.entries.upsert({ date: d, weight: w });
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

  const latest = state.entries.length ? state.entries[state.entries.length - 1].weight : null;

  row.appendChild(buildStatCard({
    label: 'Start',
    value: state.meta.startWeight,
    editable: true,
    onSave: async (v) => {
      await api.meta.setStartWeight(v);
      await refresh();
      render();
    },
  }));

  row.appendChild(buildStatCard({
    label: 'Current',
    value: latest,
    editable: false,
  }));

  row.appendChild(buildStatCard({
    label: 'Goal',
    value: state.meta.goal,
    editable: true,
    onSave: async (v) => {
      await api.meta.setGoal(v);
      await refresh();
      render();
    },
  }));

  return row;
}

function buildStatCard({ label, value, editable, onSave }) {
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

  card.appendChild(header);

  const valueEl = document.createElement('div');
  valueEl.className = 'stat-value';

  const numEl = document.createElement('span');
  numEl.textContent = value == null ? '—' : fmtWeight(value);
  valueEl.appendChild(numEl);

  const unit = document.createElement('span');
  unit.className = 'unit';
  unit.textContent = 'lbs';
  valueEl.appendChild(unit);

  card.appendChild(valueEl);

  if (editable) {
    editBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = '0.1';
      input.min = '1';
      input.className = 'stat-edit-input';
      input.value = value ?? '';
      numEl.replaceWith(input);
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);

      let cleared = false;
      input.addEventListener('beforeinput', (e) => {
        if (cleared) return;
        if (e.inputType === 'insertText' || e.inputType === 'insertFromPaste') {
          input.value = '';
          cleared = true;
        } else if (e.inputType && e.inputType.startsWith('delete')) {
          cleared = true;
        }
      });

      let finished = false;
      const finalize = async (commit) => {
        if (finished) return;
        finished = true;
        const parsed = Number(input.value);
        if (commit && parsed > 0 && parsed !== value) {
          await onSave(parsed);
        } else {
          render();
        }
      };
      input.addEventListener('blur', () => finalize(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { finished = true; render(); }
      });
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

function buildSparklineCard() {
  const card = document.createElement('section');
  card.className = 'card sparkline-card';

  const today = todayISO();
  const startIso = addDays(today, -(state.sparklineDays - 1));
  const points = entriesInRange(state.entries, startIso, today);
  const delta = points.length >= 2
    ? points[points.length - 1].weight - points[0].weight
    : null;

  const header = document.createElement('div');
  header.className = 'sparkline-header';
  header.innerHTML = `
    <div class="sparkline-title">
      <span>Last</span>
      <select class="range-select" id="spark-range">
        ${[30, 60, 90, 180].map((n) =>
          `<option value="${n}" ${n === state.sparklineDays ? 'selected' : ''}>${n}</option>`
        ).join('')}
      </select>
      <span>days</span>
    </div>
    <div class="sparkline-delta ${signClass(delta)}">${delta == null ? '—' : fmtSignedWeight(delta) + ' lbs'}</div>
  `;
  card.appendChild(header);

  header.querySelector('#spark-range').addEventListener('change', (e) => {
    state.sparklineDays = Number(e.target.value);
    render();
  });

  const chartWrap = document.createElement('div');
  chartWrap.style.height = '120px';
  chartWrap.appendChild(sparkline({ points, goal: state.meta.goal }));
  card.appendChild(chartWrap);

  return card;
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

  const windowPoints = rangedPoints();
  const delta = windowPoints.length >= 2
    ? windowPoints[windowPoints.length - 1].weight - windowPoints[0].weight
    : null;
  const meta = document.createElement('div');
  meta.className = `trend-delta ${signClass(delta)}`;
  meta.textContent = delta == null ? '' : `${fmtSignedWeight(delta)} lbs`;

  header.appendChild(segmented);
  header.appendChild(meta);
  card.appendChild(header);

  const chartWrap = document.createElement('div');
  chartWrap.style.height = '360px';
  const rolling = rollingSeries(windowPoints, 7);
  chartWrap.appendChild(trendChart({
    points: windowPoints,
    goal: state.meta.goal,
    rolling,
    xBounds: rangedBounds(),
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

function rollingSeries(points, windowDays) {
  if (!points.length) return [];
  const result = [];
  for (const p of points) {
    const start = addDays(p.date, -(windowDays - 1));
    const win = points.filter((x) => x.date >= start && x.date <= p.date);
    const a = avg(win.map((x) => x.weight));
    if (a != null) result.push({ date: p.date, weight: a });
  }
  return result;
}

/* ---------- History ---------- */

function renderHistory(root) {
  const container = document.createElement('div');
  container.className = 'view';

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
      weightTd.textContent = `${fmtWeight(entry.weight)} lbs`;
      tr.appendChild(weightTd);

      const deltaTd = document.createElement('td');
      deltaTd.className = 'delta ' + (delta == null ? 'delta-none' : signClass(delta));
      deltaTd.textContent = delta == null ? '—' : `${fmtSignedWeight(delta)} lbs`;
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
          message: `This will remove the ${fmtWeight(entry.weight)} lb entry for ${formatShortDate(entry.date)}.`,
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
  exportBtn.textContent = 'Export CSV';
  exportBtn.addEventListener('click', async () => {
    const csv = await api.stats.exportCsv();
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
