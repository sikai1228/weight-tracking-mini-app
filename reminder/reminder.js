const api = window.reminderApi;

const weightInput = document.getElementById('weight-input');
const saveBtn = document.getElementById('save-btn');
const remindLaterBtn = document.getElementById('remind-later-btn');
const dismissBtn = document.getElementById('dismiss-btn');
const dateEl = document.querySelector('.reminder-date');
const unitEl = document.querySelector('.unit-label');

let unit = 'lb';

const today = new Date();
dateEl.textContent = today.toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

(async () => {
  try {
    unit = await api.getUnit();
    unitEl.textContent = unit === 'kg' ? 'kg' : 'lbs';
  } catch (err) {
    console.error('[reminder] getUnit failed', err);
  }
})();

function isValid() {
  const v = Number(weightInput.value);
  return Number.isFinite(v) && v > 0;
}

function syncSaveState() {
  saveBtn.disabled = !isValid();
}

weightInput.addEventListener('input', syncSaveState);

weightInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!saveBtn.disabled) save();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    dismiss();
  }
});

async function save() {
  if (!isValid()) return;
  saveBtn.disabled = true;
  try {
    await api.save({ weight: Number(weightInput.value), unit });
  } finally {
    await api.close();
  }
}

async function snooze() {
  try {
    await api.snooze(60);
  } finally {
    await api.close();
  }
}

async function dismiss() {
  try {
    await api.dismiss();
  } finally {
    await api.close();
  }
}

saveBtn.addEventListener('click', save);
remindLaterBtn.addEventListener('click', snooze);
dismissBtn.addEventListener('click', dismiss);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.activeElement !== weightInput) {
    dismiss();
  }
});

syncSaveState();
