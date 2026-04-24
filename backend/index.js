'use strict';

const { createStorage } = require('./storage');
const { createEntriesApi } = require('./entries');
const { createMetaApi } = require('./meta');
const { createStatsApi } = require('./stats');

function createApi({ dataDir }) {
  if (!dataDir) throw new Error('dataDir is required');
  const storage = createStorage(dataDir);
  const entries = createEntriesApi(storage);
  const meta = createMetaApi(storage);
  const stats = createStatsApi(storage);
  return { entries, meta, stats, _storage: storage };
}

module.exports = { createApi };
