'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { createApi } = require('../backend');

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-smoke-'));
  const api = createApi({ dataDir });

  const initial = await api.meta.get();
  assert.equal(initial.isConfigured, false);

  await api.meta.setup({ startWeight: 115, goal: 145, startDate: '2025-09-01' });
  const configured = await api.meta.get();
  assert.equal(configured.isConfigured, true);
  assert.equal(configured.goal, 145);
  assert.equal(configured.startWeight, 115);

  await api.entries.upsert({ date: '2026-04-20', weight: 117.8 });
  await api.entries.upsert({ date: '2026-04-21', weight: 118.1 });
  await api.entries.upsert({ date: '2026-04-22', weight: 118.3 });
  await api.entries.upsert({ date: '2026-04-23', weight: 118.5 });
  await api.entries.upsert({ date: '2026-04-24', weight: 118.4 });

  const overwritten = await api.entries.upsert({ date: '2026-04-24', weight: 118.6 });
  assert.equal(overwritten.weight, 118.6);

  const list = await api.entries.list();
  assert.equal(list.length, 5);
  assert.deepEqual(list.map((e) => e.date), [
    '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24'
  ]);

  await api.meta.updateGoal(140);
  await api.meta.updateStartWeight(116);
  const updated = await api.meta.get();
  assert.equal(updated.goal, 140);
  assert.equal(updated.startWeight, 116);

  const csv = await api.stats.exportCsv();
  assert.ok(csv.startsWith('date,weight\n'));
  assert.ok(csv.includes('2026-04-24,118.6\n'));

  const removed = await api.entries.remove('2026-04-20');
  assert.equal(removed, true);
  assert.equal((await api.entries.list()).length, 4);

  const api2 = createApi({ dataDir });
  const reloaded = await api2.stats.all();
  assert.equal(reloaded.meta.goal, 140);
  assert.equal(reloaded.entries.length, 4);

  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('smoke test passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
