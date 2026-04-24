'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  onDataUpdated: (cb) => {
    const handler = () => { try { cb(); } catch (err) { console.error(err); } };
    ipcRenderer.on('data-updated', handler);
    return () => ipcRenderer.removeListener('data-updated', handler);
  },
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
    setMode: (value) => invoke('meta:setMode', value),
    getReminder: () => invoke('meta:getReminder'),
    setRemindersEnabled: (value) => invoke('meta:setRemindersEnabled', value),
    setReminderTime: (value) => invoke('meta:setReminderTime', value),
  },
  stats: {
    all: () => invoke('stats:all'),
    exportCsv: (unit) => invoke('stats:exportCsv', unit),
  },
});
