'use strict';

const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

const CHECK_INTERVAL_MS = 60 * 1000;
const LB_PER_KG = 2.20462;

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseHHMM(str) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(str || '');
  if (!match) return [8, 0];
  return [Number(match[1]), Number(match[2])];
}

function registerReminder({ api, getMainWindow }) {
  let reminderWindow = null;
  let snoozeUntil = null;
  let interval = null;

  function createReminderWindow() {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.focus();
      return;
    }
    const primary = screen.getPrimaryDisplay();
    const { width: sw, height: sh } = primary.workAreaSize;
    const W = 440;
    const H = 320;

    reminderWindow = new BrowserWindow({
      width: W,
      height: H,
      x: Math.round((sw - W) / 2) + primary.workArea.x,
      y: Math.round((sh - H) / 2) + primary.workArea.y,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'reminder-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    reminderWindow.loadFile(path.join(__dirname, '..', 'reminder', 'index.html'));
    reminderWindow.once('ready-to-show', () => {
      reminderWindow.show();
      reminderWindow.focus();
    });
    reminderWindow.on('closed', () => {
      reminderWindow = null;
    });
  }

  async function checkAndFire() {
    try {
      const reminder = await api.meta.getReminder();
      if (!reminder.remindersEnabled) return;
      if (snoozeUntil && Date.now() < snoozeUntil) return;

      const today = todayISO();
      if (reminder.lastReminderDate === today) return;

      const entries = await api.entries.list();
      if (entries.some((e) => e.date === today)) return;

      const now = new Date();
      const [h, m] = parseHHMM(reminder.reminderTime);
      const past =
        now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
      if (!past) return;

      if (reminderWindow && !reminderWindow.isDestroyed()) return;
      createReminderWindow();
    } catch (err) {
      console.error('[reminder] check failed', err);
    }
  }

  function notifyMainUpdated() {
    const main = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (main && !main.isDestroyed()) {
      main.webContents.send('data-updated');
    }
  }

  ipcMain.handle('reminder:getUnit', async () => {
    const meta = await api.meta.get();
    return meta.unit ?? 'lb';
  });

  ipcMain.handle('reminder:save', async (_e, payload) => {
    const weight = Number(payload?.weight);
    const unit = payload?.unit === 'kg' ? 'kg' : 'lb';
    if (!(weight > 0)) return;
    const weightInLb = unit === 'kg' ? weight * LB_PER_KG : weight;
    const date = todayISO();
    await api.entries.upsert({ date, weight: weightInLb });
    await api.meta.setLastReminderDate(date);
    notifyMainUpdated();
  });

  ipcMain.handle('reminder:snooze', async (_e, minutes) => {
    const mins = Number(minutes) || 60;
    snoozeUntil = Date.now() + mins * 60 * 1000;
  });

  ipcMain.handle('reminder:dismiss', async () => {
    const date = todayISO();
    await api.meta.setLastReminderDate(date);
    notifyMainUpdated();
  });

  ipcMain.handle('reminder:close', async () => {
    if (reminderWindow && !reminderWindow.isDestroyed()) {
      reminderWindow.close();
    }
  });

  function start() {
    if (interval) return;
    interval = setInterval(checkAndFire, CHECK_INTERVAL_MS);
    checkAndFire();
  }

  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  return { start, stop, checkAndFire, createReminderWindow };
}

module.exports = { registerReminder };
