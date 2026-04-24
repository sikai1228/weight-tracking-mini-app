'use strict';

const { ipcMain } = require('electron');

const CHANNELS = {
  'entries:list': (api) => () => api.entries.list(),
  'entries:upsert': (api) => (_e, payload) => api.entries.upsert(payload),
  'entries:delete': (api) => (_e, date) => api.entries.remove(date),

  'meta:get': (api) => () => api.meta.get(),
  'meta:setup': (api) => (_e, payload) => api.meta.setup(payload),
  'meta:setStartWeight': (api) => (_e, value) => api.meta.updateStartWeight(value),
  'meta:setGoal': (api) => (_e, value) => api.meta.updateGoal(value),
  'meta:setUnit': (api) => (_e, value) => api.meta.updateUnit(value),
  'meta:setMode': (api) => (_e, value) => api.meta.updateMode(value),
  'meta:getReminder': (api) => () => api.meta.getReminder(),
  'meta:setRemindersEnabled': (api) => (_e, value) => api.meta.setRemindersEnabled(value),
  'meta:setReminderTime': (api) => (_e, value) => api.meta.setReminderTime(value),

  'stats:all': (api) => () => api.stats.all(),
  'stats:exportCsv': (api) => (_e, unit) => api.stats.exportCsv(unit),
};

function registerIpc(api) {
  for (const [channel, factory] of Object.entries(CHANNELS)) {
    ipcMain.handle(channel, factory(api));
  }
}

module.exports = { registerIpc };
