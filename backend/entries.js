'use strict';

const { assertDate, assertPositiveNumber } = require('./validate');

function createEntriesApi(storage) {
  async function list() {
    const state = await storage.load();
    return [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
  }

  async function upsert({ date, weight }) {
    assertDate(date);
    assertPositiveNumber(weight, 'weight');
    return storage.update((state) => {
      const existing = state.entries.find((e) => e.date === date);
      if (existing) {
        existing.weight = weight;
        return existing;
      }
      const entry = { date, weight };
      state.entries.push(entry);
      return entry;
    });
  }

  async function remove(date) {
    assertDate(date);
    return storage.update((state) => {
      const idx = state.entries.findIndex((e) => e.date === date);
      if (idx === -1) return false;
      state.entries.splice(idx, 1);
      return true;
    });
  }

  return { list, upsert, remove };
}

module.exports = { createEntriesApi };
