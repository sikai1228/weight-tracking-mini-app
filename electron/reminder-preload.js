'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reminderApi', {
  getUnit: () => ipcRenderer.invoke('reminder:getUnit'),
  save: (payload) => ipcRenderer.invoke('reminder:save', payload),
  snooze: (minutes) => ipcRenderer.invoke('reminder:snooze', minutes),
  dismiss: () => ipcRenderer.invoke('reminder:dismiss'),
  close: () => ipcRenderer.invoke('reminder:close'),
});
