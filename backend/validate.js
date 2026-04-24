'use strict';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDate(value, field = 'date') {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new Error(`${field} must be in YYYY-MM-DD format`);
  }
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) {
    throw new Error(`${field} is not a valid date`);
  }
}

function assertPositiveNumber(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number`);
  }
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

module.exports = { assertDate, assertPositiveNumber, todayISO };
