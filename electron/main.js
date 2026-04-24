'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { createApi } = require('../backend');
const { registerIpc } = require('./ipc');
const { registerReminder } = require('./reminder');

let mainWindow = null;

function migrateLegacyData(userDataDir) {
  const target = path.join(userDataDir, 'data.json');
  if (fs.existsSync(target)) return;
  const legacy = path.join(app.getPath('appData'), 'weight-tracking-mini-app', 'data.json');
  if (!fs.existsSync(legacy)) return;
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.copyFileSync(legacy, target);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#0b0d10',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = win;
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  migrateLegacyData(userDataDir);
  const api = createApi({ dataDir: userDataDir });
  registerIpc(api);
  const reminder = registerReminder({ api, getMainWindow: () => mainWindow });
  reminder.start();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
