const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const PERIODS = ['AM', 'PM'];

function parseTime(iso) {
  const [h24s = '8', ms = '0'] = String(iso || '08:00').split(':');
  let h24 = parseInt(h24s, 10);
  if (!Number.isFinite(h24)) h24 = 8;
  let m = parseInt(ms, 10);
  if (!Number.isFinite(m)) m = 0;
  const period = h24 >= 12 ? 'PM' : 'AM';
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  const minute = Math.min(55, Math.round(m / 5) * 5);
  return { hour, minute, period };
}

function toISO(hour, minute, period) {
  let h24 = hour % 12;
  if (period === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatDisplay(iso) {
  const { hour, minute, period } = parseTime(iso);
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function createTimePicker({ value, onChange, disabled = false } = {}) {
  let current = parseTime(value);
  let isOpen = false;

  const wrapper = document.createElement('div');
  wrapper.className = 'time-picker';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'time-picker-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.textContent = formatDisplay(value);
  if (disabled) {
    trigger.disabled = true;
    trigger.classList.add('disabled');
  }
  wrapper.appendChild(trigger);

  const popover = document.createElement('div');
  popover.className = 'time-picker-popover';
  popover.style.display = 'none';
  wrapper.appendChild(popover);

  function commit() {
    const iso = toISO(current.hour, current.minute, current.period);
    trigger.textContent = formatDisplay(iso);
    if (typeof onChange === 'function') onChange(iso);
  }

  function buildScrollColumn(label, values, getSelected, onSelect, formatter) {
    const col = document.createElement('div');
    col.className = 'time-column';
    col.setAttribute('role', 'listbox');
    col.setAttribute('aria-label', label);

    const inner = document.createElement('div');
    inner.className = 'time-column-inner';
    col.appendChild(inner);

    values.forEach((v) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'time-column-item';
      item.setAttribute('role', 'option');
      item.textContent = formatter ? formatter(v) : String(v);
      item.dataset.value = String(v);
      const selected = getSelected() === v;
      if (selected) item.classList.add('selected');
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.tabIndex = selected ? 0 : -1;

      item.addEventListener('click', () => {
        onSelect(v);
        col.querySelectorAll('.time-column-item').forEach((el) => {
          const isMatch = String(el.dataset.value) === String(v);
          el.classList.toggle('selected', isMatch);
          el.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          el.tabIndex = isMatch ? 0 : -1;
        });
        item.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });

      item.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const items = Array.from(col.querySelectorAll('.time-column-item'));
        const idx = items.indexOf(item);
        const nextIdx =
          e.key === 'ArrowDown'
            ? Math.min(items.length - 1, idx + 1)
            : Math.max(0, idx - 1);
        const nextItem = items[nextIdx];
        if (nextItem) {
          nextItem.focus();
          nextItem.click();
        }
      });

      inner.appendChild(item);
    });

    return col;
  }

  function buildStaticColumn(label, values, getSelected, onSelect) {
    const col = document.createElement('div');
    col.className = 'time-column-static';
    col.setAttribute('role', 'listbox');
    col.setAttribute('aria-label', label);

    values.forEach((v) => {
      const selected = getSelected() === v;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'time-column-item' + (selected ? ' selected' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.textContent = v;
      item.dataset.value = v;
      item.tabIndex = selected ? 0 : -1;
      item.addEventListener('click', () => {
        onSelect(v);
        col.querySelectorAll('.time-column-item').forEach((el) => {
          const isMatch = el.dataset.value === v;
          el.classList.toggle('selected', isMatch);
          el.setAttribute('aria-selected', isMatch ? 'true' : 'false');
          el.tabIndex = isMatch ? 0 : -1;
        });
      });
      col.appendChild(item);
    });

    return col;
  }

  function render() {
    popover.replaceChildren();

    const columns = document.createElement('div');
    columns.className = 'time-columns';
    columns.appendChild(
      buildScrollColumn('Hour', HOURS, () => current.hour, (h) => {
        current = { ...current, hour: h };
        commit();
      })
    );
    columns.appendChild(
      buildScrollColumn(
        'Minute',
        MINUTES,
        () => current.minute,
        (m) => {
          current = { ...current, minute: m };
          commit();
        },
        (v) => String(v).padStart(2, '0')
      )
    );
    columns.appendChild(
      buildStaticColumn('AM or PM', PERIODS, () => current.period, (p) => {
        current = { ...current, period: p };
        commit();
      })
    );
    popover.appendChild(columns);

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'time-picker-done';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', close);
    popover.appendChild(doneBtn);
  }

  function positionPopover() {
    const rect = trigger.getBoundingClientRect();
    popover.style.position = 'fixed';
    const popRect = popover.getBoundingClientRect();
    const width = popRect.width || 240;
    let left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    popover.style.left = `${left}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    const afterRect = popover.getBoundingClientRect();
    if (afterRect.bottom > window.innerHeight - 8 && rect.top > afterRect.height + 8) {
      popover.style.top = `${rect.top - afterRect.height - 4}px`;
    }
  }

  function scrollColumnsToSelected() {
    popover.querySelectorAll('.time-column').forEach((col) => {
      const sel = col.querySelector('.time-column-item.selected');
      if (!sel) return;
      const colRect = col.getBoundingClientRect();
      const itemRect = sel.getBoundingClientRect();
      const offset = itemRect.top - colRect.top;
      col.scrollTop += offset - (col.clientHeight - sel.offsetHeight) / 2;
    });
  }

  function open() {
    if (isOpen || disabled) return;
    isOpen = true;
    popover.style.display = 'block';
    trigger.setAttribute('aria-expanded', 'true');
    render();
    positionPopover();
    requestAnimationFrame(scrollColumnsToSelected);
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', positionPopover);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    popover.style.display = 'none';
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', positionPopover);
  }

  function onOutside(e) {
    if (!wrapper.contains(e.target)) close();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  trigger.addEventListener('click', () => {
    if (isOpen) close();
    else open();
  });

  function setValue(iso) {
    current = parseTime(iso);
    trigger.textContent = formatDisplay(iso);
    if (isOpen) {
      render();
      requestAnimationFrame(scrollColumnsToSelected);
    }
  }

  function getValue() {
    return toISO(current.hour, current.minute, current.period);
  }

  return { element: wrapper, trigger, setValue, getValue };
}
