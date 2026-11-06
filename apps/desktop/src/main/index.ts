import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Settings } from '../shared/types';
import { CoachApp } from './controller';

app.setName('hs-coach');

if (process.env.HS_COACH_SCREENSHOT || process.env.HS_COACH_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}

if (process.env.HS_COACH_SCREENSHOT) {
  app.setPath('userData', path.join(os.tmpdir(), 'hs-coach-screenshot'));
}

let coach: CoachApp | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#12100e',
    title: 'hs-coach',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return win;
}

async function captureShots(win: BrowserWindow, coachApp: CoachApp): Promise<void> {
  const dir = process.env.HS_COACH_SCREENSHOT;
  if (!dir) return;
  if (process.env.HS_COACH_MOCK_LLM === '1') await coachApp.analyze();
  await new Promise((resolve) => setTimeout(resolve, 900));
  fs.mkdirSync(dir, { recursive: true });
  const board = await win.capturePage();
  fs.writeFileSync(path.join(dir, 'board.png'), board.toPNG());
  win.webContents.send('ui:openSettings');
  await new Promise((resolve) => setTimeout(resolve, 700));
  const settings = await win.capturePage();
  fs.writeFileSync(path.join(dir, 'settings.png'), settings.toPNG());
  app.quit();
}

app.whenReady().then(() => {
  coach = new CoachApp();
  const coachApp = coach;

  ipcMain.handle('state:get', () => coachApp.view());
  ipcMain.handle('settings:save', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') return coachApp.view();
    return coachApp.save(input as Partial<Settings>);
  });
  ipcMain.handle('analyze', () => coachApp.analyze());
  ipcMain.handle('log:choose', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择 Power.log',
      properties: ['openFile'],
      filters: [{ name: 'Power.log', extensions: ['log', 'txt'] }]
    });
    if (result.canceled || !result.filePaths[0]) return coachApp.view();
    return coachApp.save({ logPath: result.filePaths[0], demoMode: false });
  });
  ipcMain.handle('log:auto', () => coachApp.save({ logPath: '' }));

  const win = createWindow();
  win.webContents.once('did-finish-load', () => {
    coachApp.publish();
    if (process.env.HS_COACH_SCREENSHOT) void captureShots(win, coachApp);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
