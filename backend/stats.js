'use strict';

function createStatsApi(storage) {
  async function all() {
    const state = await storage.load();
    return {
      meta: {
        unit: state.unit ?? 'lb',
        mode: state.mode ?? 'bulk',
        goal: state.goal,
        startWeight: state.startWeight,
        startDate: state.startDate,
        isConfigured: state.goal != null && state.startWeight != null,
      },
      entries: [...state.entries].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async function exportCsv(unit = 'lb') {
    const state = await storage.load();
    const rows = [...state.entries].sort((a, b) => a.date.localeCompare(b.date));
    const factor = unit === 'kg' ? 1 / 2.20462 : 1;
    const lines = [`date,weight_${unit}`];
    for (const r of rows) {
      const value = r.weight * factor;
      lines.push(`${r.date},${value.toFixed(2)}`);
    }
    return lines.join('\n') + '\n';
  }

  return { all, exportCsv };
}

module.exports = { createStatsApi };
