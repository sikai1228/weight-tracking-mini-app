'use strict';

const fs = require('fs').promises;
const path = require('path');

function emptyState() {
  return { unit: 'lb', goal: null, startWeight: null, startDate: null, entries: [] };
}

function createStorage(dataDir) {
  const filePath = path.join(dataDir, 'data.json');
  let cache = null;
  let writeChain = Promise.resolve();

  async function ensureDir() {
    await fs.mkdir(dataDir, { recursive: true });
  }

  async function load() {
    if (cache) return cache;
    await ensureDir();
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      cache = {
        unit: parsed.unit === 'kg' ? 'kg' : 'lb',
        goal: parsed.goal ?? null,
        startWeight: parsed.startWeight ?? null,
        startDate: parsed.startDate ?? null,
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      };
    } catch (err) {
      if (err.code === 'ENOENT') {
        cache = emptyState();
      } else {
        throw err;
      }
    }
    return cache;
  }

  async function persist(state) {
    await ensureDir();
    const tmp = filePath + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tmp, filePath);
  }

  async function update(mutator) {
    const state = await load();
    const result = mutator(state);
    writeChain = writeChain.then(() => persist(state)).catch((err) => {
      cache = null;
      throw err;
    });
    await writeChain;
    return result;
  }

  function fileExists() {
    return fs.access(filePath).then(() => true, () => false);
  }

  return { load, update, fileExists, filePath };
}

module.exports = { createStorage };
