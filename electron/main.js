'use strict';

const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { createApi } = require('../backend');
const { registerIpc } = require('./ipc');
const { registerReminder } = require('./reminder');

let mainWindow = null;
let tray = null;
let isQuitting = false;

function migrateLegacyData(userDataDir) {
  const target = path.join(userDataDir, 'data.json');
  if (fs.existsSync(target)) return;
  const legacy = path.join(app.getPath('appData'), 'weight-tracking-mini-app', 'data.json');
  if (!fs.existsSync(legacy)) return;
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.copyFileSync(legacy, target);
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }
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
  return win;
}

function createTray() {
  if (tray) return tray;

  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  let image = null;
  if (fs.existsSync(iconPath)) {
    try {
      image = nativeImage.createFromPath(iconPath);
      if (image.isEmpty()) image = null;
    } catch (err) {
      console.error('[tray] failed to load icon:', err);
      image = null;
    }
  }

  // Menu-bar icons on macOS read better as template images (monochrome,
  // tinted automatically for light/dark mode). The sidebar and dock stay
  // full color from assets/logo.png.
  if (image && process.platform === 'darwin') {
    image.setTemplateImage(true);
  }

  tray = new Tray(image || nativeImage.createEmpty());
  if (!image && process.platform === 'darwin') {
    tray.setTitle('WT');
  }
  tray.setToolTip('Weight Tracker');
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Weight Tracker',
      click: () => createWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  return tray;
}

function setupAutoLaunch() {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  }
}

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData');
  migrateLegacyData(userDataDir);
  const api = createApi({ dataDir: userDataDir });
  registerIpc(api);
  const reminder = registerReminder({ api, getMainWindow: () => mainWindow });
  reminder.start();

  setupAutoLaunch();
  if (process.platform === 'darwin' && app.dock) {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
      try {
        const dockImage = nativeImage.createFromPath(logoPath);
        if (!dockImage.isEmpty()) app.dock.setIcon(dockImage);
      } catch (err) {
        console.error('[dock] failed to set icon:', err);
      }
    }
  }
  createTray();

  const loginSettings = app.getLoginItemSettings();
  const startedHidden =
    loginSettings.wasOpenedAtLogin && loginSettings.wasOpenedAsHidden;
  if (!startedHidden) createWindow();

  app.on('activate', () => {
    createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep running in the background (tray is alive). Do not quit on
  // window close; the user must choose Quit from the tray menu.
});
