'use strict';

function createStatsApi(storage) {
  async function all() {
    const state = await storage.load();
    return {
      meta: {
        goal: state.goal,
        startWeight: state.startWeight,
        startDate: state.startDate,
        isConfigured: state.goal != null && state.startWeight != null,
      },
      entries: [...state.entries].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async function exportCsv() {
    const state = await storage.load();
    const rows = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
    const lines = ['date,weight'];
    for (const r of rows) lines.push(`${r.date},${r.weight}`);
    return lines.join('\n') + '\n';
  }

  return { all, exportCsv };
}

module.exports = { createStatsApi };
