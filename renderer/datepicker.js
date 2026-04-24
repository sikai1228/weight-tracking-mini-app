const MONTH_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LETTERS = ['S','M','T','W','T','F','S'];

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromISO(iso) {
  return new Date(iso + 'T00:00:00');
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDisplay(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function chevronLeftIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>`;
}

function chevronRightIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;
}

export function createDatePicker({ value, onChange, maxDate } = {}) {
  const today = stripTime(new Date());
  const max = maxDate ? stripTime(maxDate) : null;

  let selected = value
    ? (typeof value === 'string' ? stripTime(fromISO(value)) : stripTime(value))
    : today;
  let viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  let isOpen = false;

  const wrapper = document.createElement('div');
  wrapper.className = 'datepicker';

  const trigger = document.createElement('input');
  trigger.type = 'text';
  trigger.readOnly = true;
  trigger.className = 'datepicker-input';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.value = formatDisplay(selected);
  wrapper.appendChild(trigger);

  const popover = document.createElement('div');
  popover.className = 'datepicker-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Select date');
  popover.style.display = 'none';
  wrapper.appendChild(popover);

  function isDisabled(d) {
    return max != null && d > max;
  }

  function renderCalendar() {
    popover.replaceChildren();

    const header = document.createElement('div');
    header.className = 'dp-header';

    const title = document.createElement('div');
    title.className = 'dp-title';
    title.textContent = `${MONTH_FULL[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
    header.appendChild(title);

    const nav = document.createElement('div');
    nav.className = 'dp-nav';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'dp-nav-btn';
    prevBtn.setAttribute('aria-label', 'Previous month');
    prevBtn.innerHTML = chevronLeftIcon();
    prevBtn.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
      renderCalendar();
    });
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'dp-nav-btn';
    nextBtn.setAttribute('aria-label', 'Next month');
    nextBtn.innerHTML = chevronRightIcon();
    nextBtn.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
      renderCalendar();
    });
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    header.appendChild(nav);
    popover.appendChild(header);

    const dow = document.createElement('div');
    dow.className = 'dp-dow';
    for (const letter of DAY_LETTERS) {
      const span = document.createElement('span');
      span.textContent = letter;
      dow.appendChild(span);
    }
    popover.appendChild(dow);

    const grid = document.createElement('div');
    grid.className = 'dp-grid';

    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const dow0 = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(1 - dow0);

    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'dp-day';
      cell.textContent = String(d.getDate());

      const inMonth = d.getMonth() === viewMonth.getMonth();
      const isToday = sameDay(d, today);
      const isSelected = sameDay(d, selected);
      const disabled = isDisabled(d);

      if (!inMonth) cell.classList.add('dp-day-out');
      if (isToday && !isSelected) cell.classList.add('dp-day-today');
      if (isSelected) {
        cell.classList.add('dp-day-selected');
        cell.setAttribute('aria-pressed', 'true');
      }
      if (disabled) cell.classList.add('dp-day-disabled');

      cell.setAttribute('aria-label', d.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      }));

      if (disabled) {
        cell.disabled = true;
      } else {
        cell.addEventListener('click', () => selectDate(d));
      }

      grid.appendChild(cell);
    }
    popover.appendChild(grid);

    const footer = document.createElement('div');
    footer.className = 'dp-footer';
    const todayBtn = document.createElement('button');
    todayBtn.type = 'button';
    todayBtn.className = 'dp-today-btn';
    todayBtn.textContent = 'Today';
    todayBtn.addEventListener('click', () => {
      const now = stripTime(new Date());
      viewMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      selectDate(now);
    });
    footer.appendChild(todayBtn);
    popover.appendChild(footer);
  }

  function selectDate(d) {
    const picked = stripTime(d);
    if (isDisabled(picked)) return;
    selected = picked;
    viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    trigger.value = formatDisplay(selected);
    closePopover();
    if (typeof onChange === 'function') onChange(toISO(selected));
  }

  function positionPopover() {
    const rect = trigger.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    const popRect = popover.getBoundingClientRect();
    if (popRect.bottom > window.innerHeight - 8 && rect.top > popRect.height + 8) {
      popover.style.top = `${rect.top - popRect.height - 4}px`;
    }
    if (popRect.right > window.innerWidth - 8) {
      const shifted = Math.max(8, window.innerWidth - popRect.width - 8);
      popover.style.left = `${shifted}px`;
    }
  }

  function openPopover() {
    if (isOpen) return;
    isOpen = true;
    popover.style.display = 'block';
    trigger.setAttribute('aria-expanded', 'true');
    renderCalendar();
    positionPopover();
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusMove);
    window.addEventListener('resize', positionPopover);
  }

  function closePopover() {
    if (!isOpen) return;
    isOpen = false;
    popover.style.display = 'none';
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('focusin', onFocusMove);
    window.removeEventListener('resize', positionPopover);
  }

  function onOutside(e) {
    if (!wrapper.contains(e.target)) closePopover();
  }

  function onFocusMove(e) {
    if (!wrapper.contains(e.target)) closePopover();
  }

  function onKey(e) {
    if (e.key === 'Escape') { closePopover(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      selectDate(selected);
      return;
    }
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const candidate = new Date(selected);
      if (e.key === 'ArrowLeft') candidate.setDate(candidate.getDate() - 1);
      if (e.key === 'ArrowRight') candidate.setDate(candidate.getDate() + 1);
      if (e.key === 'ArrowUp') candidate.setDate(candidate.getDate() - 7);
      if (e.key === 'ArrowDown') candidate.setDate(candidate.getDate() + 7);
      const next = stripTime(candidate);
      if (isDisabled(next)) return;
      selected = next;
      viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
      renderCalendar();
    }
  }

  trigger.addEventListener('click', () => { isOpen ? closePopover() : openPopover(); });
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPopover();
    }
  });

  function setValue(iso) {
    selected = stripTime(fromISO(iso));
    viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    trigger.value = formatDisplay(selected);
    if (isOpen) renderCalendar();
  }

  function getValue() {
    return toISO(selected);
  }

  return { element: wrapper, trigger, setValue, getValue };
}
