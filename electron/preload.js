'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  entries: {
    list: () => invoke('entries:list'),
    upsert: (payload) => invoke('entries:upsert', payload),
    delete: (date) => invoke('entries:delete', date),
  },
  meta: {
    get: () => invoke('meta:get'),
    setup: (payload) => invoke('meta:setup', payload),
    setStartWeight: (value) => invoke('meta:setStartWeight', value),
    setGoal: (value) => invoke('meta:setGoal', value),
    setUnit: (value) => invoke('meta:setUnit', value),
  },
  stats: {
    all: () => invoke('stats:all'),
    exportCsv: (unit) => invoke('stats:exportCsv', unit),
  },
});
