import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverGameTargets, isApprovedBattleNetUri, KNOWN_REGISTRY_QUERIES, parseRegQueryOutput, planLaunch, validateManualGamePath, windowPlanAfterLaunch, type GameTarget } from '../shared/launch';
import { allowIpc, redactView, type WindowRole } from '../shared/privacy';
import { SpeechGate } from '../shared/presenter';
import type { Settings, ViewState } from '../shared/types';
import { CoachApp } from './controller';
import { cancelSpeech, speakText } from './speech';

app.setName('hearthstone-buddy');

if (process.env.HS_COACH_SCREENSHOT || process.env.HS_COACH_NO_SANDBOX === '1') {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('no-sandbox');
}

if (process.env.HS_COACH_SCREENSHOT) {
  app.setPath('userData', path.join(os.tmpdir(), 'hearthstone-buddy-screenshot'));
}

let coach: CoachApp | null = null;
let launcher: BrowserWindow | null = null;
let companion: BrowserWindow | null = null;
let tray: Tray | null = null;
const speechGate = new SpeechGate();
const windowRoles = new Map<number, WindowRole>();

function roleOf(id: number): WindowRole | null {
  return windowRoles.get(id) ?? null;
}

function remember(win: BrowserWindow, role: WindowRole): void {
  windowRoles.set(win.webContents.id, role);
  win.on('closed', () => windowRoles.delete(win.webContents.id));
}

function sharedWebPreferences() {
  return {
    preload: path.join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  };
}

function loadRenderer(win: BrowserWindow, view?: 'companion'): void {
  const preview = process.env.HS_COACH_SCREENSHOT ? '&preview=1' : '';
  if (process.env.ELECTRON_RENDERER_URL) {
    const suffix = view === 'companion' ? `?view=companion${preview}` : '';
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${suffix}`);
    return;
  }
  void win.loadFile(path.join(__dirname, '../renderer/index.html'), {
    query: view === 'companion' ? { view: 'companion', ...(process.env.HS_COACH_SCREENSHOT ? { preview: '1' } : {}) } : {}
  });
}

function createLauncher(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#100c09',
    title: '炉石 Buddy',
    autoHideMenuBar: true,
    show: false,
    webPreferences: sharedWebPreferences()
  });
  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());
  remember(win, 'launcher');
  win.on('closed', () => {
    if (launcher === win) launcher = null;
  });
  loadRenderer(win);
  return win;
}

function createCompanion(): BrowserWindow {
  if (companion && !companion.isDestroyed()) {
    companion.showInactive();
    return companion;
  }
  const win = new BrowserWindow({
    width: 460,
    height: 700,
    minWidth: 320,
    minHeight: 480,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    show: false,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    title: '澄',
    webPreferences: sharedWebPreferences()
  });
  win.setAlwaysOnTop(true, 'floating');
  win.once('ready-to-show', () => win.showInactive());
  remember(win, 'companion');
  win.on('closed', () => {
    if (companion === win) companion = null;
  });
  loadRenderer(win, 'companion');
  companion = win;
  return win;
}

function ensureTray(): void {
  if (tray) return;
  const image = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAARklEQVQ4T2NkoBAwUqifgYGB4T8DAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAA0QAwMAw0kG8n8n1kQAAAAASUVORK5CYII='
  );
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('炉石 Buddy');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示澄', click: () => createCompanion() },
    { label: '显示启动器', click: () => { if (!launcher || launcher.isDestroyed()) launcher = createLauncher(); else launcher.show(); } },
    { label: '停止朗读', click: () => cancelSpeech() },
    { label: '退出', click: () => app.quit() }
  ]));
}

function existsFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function chosenTarget(settings: Settings): GameTarget | null {
  if (settings.gameExecutable) {
    const checked = validateManualGamePath(settings.gameExecutable, existsFile);
    if (checked.ok) return checked.target;
  }
  const found = discoverGameTargets({
    platform: process.platform,
    programFiles: process.env.ProgramFiles,
    programFilesX86: process.env['ProgramFiles(x86)'],
    exists: existsFile
  });
  return found.candidates[0] ?? null;
}

async function executeLaunch(settings: Settings): Promise<{ ok: boolean; message: string }> {
  const target = chosenTarget(settings);
  if (!target) return { ok: false, message: '没有可用的 Hearthstone.exe 或 Battle.net.exe。请手动选择，启动器会留在屏幕上。' };
  const plan = planLaunch(target, process.platform);
  if (!plan.ok) return { ok: false, message: plan.reason };
  if (plan.method === 'uri') {
    if (!isApprovedBattleNetUri(plan.uri)) return { ok: false, message: '拒绝了未允许的链接。' };
    try {
      await shell.openExternal(plan.uri);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : 'Battle.net 链接没有被系统接受。' };
    }
    return { ok: true, message: '已请求 Battle.net 打开炉石。若要登录，请在 Battle.net 自己的窗口完成。Buddy 不收集密码，也不表示对局已经开始。' };
  }
  return await new Promise((resolve) => {
    const child = spawn(plan.command, plan.args, { shell: false, detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', (error) => resolve({ ok: false, message: error.message }));
    child.once('spawn', () => {
      child.unref();
      resolve({ ok: true, message: `已请求启动 Hearthstone.exe（进程 ${child.pid ?? '未知'}）。这只表示进程被拉起，不表示已经进入对局。` });
    });
  });
}

function openCompanionAndHideLauncher(ok: boolean): void {
  const plan = windowPlanAfterLaunch(ok);
  if (plan.showCompanion) createCompanion();
  if (plan.hideLauncher) launcher?.hide();
}

async function captureShots(win: BrowserWindow, coachApp: CoachApp): Promise<void> {
  const dir = process.env.HS_COACH_SCREENSHOT;
  if (!dir) return;
  await coachApp.analyze();
  await new Promise((resolve) => setTimeout(resolve, 900));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'launcher.png'), (await win.capturePage()).toPNG());
  const overlay = createCompanion();
  await new Promise((resolve) => setTimeout(resolve, 1800));
  fs.writeFileSync(path.join(dir, 'companion.png'), (await overlay.capturePage()).toPNG());
  app.exit(0);
}

function present(state: ViewState, replay = false): void {
  const result = speechGate.decide(state, Date.now(), replay);
  if (result.cancel || state.advice == null) cancelSpeech();
  if (!result.speak || !state.settings.ttsEnabled) return;
  void speakText(
    {
      enabled: state.settings.ttsEnabled,
      backend: state.settings.ttsBackend,
      command: state.settings.ttsCommand,
      args: state.settings.ttsArgs
    },
    result.text
  );
}

async function readRegistryLocations(): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  const found: string[] = [];
  for (const query of KNOWN_REGISTRY_QUERIES) {
    const text = await new Promise<string>((resolve) => {
      const child = spawn('reg.exe', ['query', query.key, '/v', query.value], { shell: false, windowsHide: true });
      let out = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        out += chunk.toString('utf8');
      });
      child.once('error', () => resolve(''));
      child.once('exit', () => resolve(out));
    });
    const location = parseRegQueryOutput(text, query.value);
    if (location) found.push(location);
  }
  return found;
}

app.whenReady().then(() => {
  coach = new CoachApp();
  const coachApp = coach;
  coachApp.setPresenter((state) => present(state));
  coachApp.setRoleLookup((id) => roleOf(id));
  ensureTray();

  const permitted = (id: number, channel: string): boolean => {
    const role = roleOf(id);
    return role != null && allowIpc(role, channel);
  };
  ipcMain.handle('state:get', (event) => {
    const role = roleOf(event.sender.id);
    if (!role || !allowIpc(role, 'state:get')) return null;
    const state = coachApp.view();
    return role === 'companion' ? redactView(state) : state;
  });
  ipcMain.handle('settings:save', (event, input: unknown) => {
    if (!permitted(event.sender.id, 'settings:save') || !input || typeof input !== 'object') return coachApp.view();
    return coachApp.save(input as Partial<Settings>);
  });
  ipcMain.handle('analyze', (event) => (permitted(event.sender.id, 'analyze') ? coachApp.analyze() : coachApp.view()));
  ipcMain.handle('log:choose', async (event) => {
    if (!permitted(event.sender.id, 'log:choose')) return coachApp.view();
    const result = await dialog.showOpenDialog({ title: '选择 Power.log', properties: ['openFile'], filters: [{ name: 'Power.log', extensions: ['log', 'txt'] }] });
    if (result.canceled || !result.filePaths[0]) return coachApp.view();
    return coachApp.save({ logPath: result.filePaths[0], demoMode: false });
  });
  ipcMain.handle('log:auto', (event) => (permitted(event.sender.id, 'log:auto') ? coachApp.save({ logPath: '' }) : coachApp.view()));
  ipcMain.handle('game:discover', async (event) => {
    if (!permitted(event.sender.id, 'game:discover')) return { note: '拒绝。', candidates: [] };
    const registryLocations = await readRegistryLocations();
    const found = discoverGameTargets({
      platform: process.platform,
      programFiles: process.env.ProgramFiles,
      programFilesX86: process.env['ProgramFiles(x86)'],
      registryLocations,
      exists: existsFile
    });
    return { note: found.note, candidates: found.candidates.map((item) => ({ executable: item.executable, label: item.label })) };
  });
  ipcMain.handle('game:choose', async (event) => {
    if (!permitted(event.sender.id, 'game:choose')) return coachApp.view();
    const result = await dialog.showOpenDialog({ title: '选择 Hearthstone.exe 或 Battle.net.exe', properties: ['openFile'], filters: [{ name: 'Executable', extensions: ['exe'] }] });
    if (result.canceled || !result.filePaths[0]) return coachApp.view();
    const checked = validateManualGamePath(result.filePaths[0], existsFile);
    if (!checked.ok) return coachApp.view();
    return coachApp.save({ gameExecutable: checked.target.executable });
  });
  ipcMain.handle('game:launch', async (event) => {
    if (!permitted(event.sender.id, 'game:launch')) return { ok: false, message: '拒绝。' };
    const result = await executeLaunch(coachApp.currentSettings());
    openCompanionAndHideLauncher(result.ok);
    return result;
  });
  ipcMain.handle('companion:only', (event) => {
    if (!permitted(event.sender.id, 'companion:only')) return { ok: false, message: '拒绝。' };
    createCompanion();
    launcher?.hide();
    return { ok: true, message: '只打开了陪伴窗口，没有启动炉石。这不是对局已经开始。' };
  });
  ipcMain.handle('companion:click-through', (event, ignore: unknown) => {
    if (!permitted(event.sender.id, 'companion:click-through') || typeof ignore !== 'boolean') return;
    const owner = BrowserWindow.fromWebContents(event.sender);
    owner?.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.handle('companion:cycle-mode', (event) => {
    if (!permitted(event.sender.id, 'companion:cycle-mode')) return coachApp.view();
    const order = ['coach', 'companion', 'quiet'] as const;
    const current = coachApp.currentSettings().companionMode;
    const next = order[(order.indexOf(current) + 1) % order.length];
    return coachApp.save({ companionMode: next });
  });
  ipcMain.handle('companion:replay', (event) => {
    if (!permitted(event.sender.id, 'companion:replay')) return;
    speechGate.replay();
    present(coachApp.view(), true);
  });
  ipcMain.handle('launcher:show', (event) => {
    if (!permitted(event.sender.id, 'launcher:show')) return;
    if (!launcher || launcher.isDestroyed()) launcher = createLauncher();
    else launcher.show();
  });
  ipcMain.handle('companion:hide', (event) => {
    if (!permitted(event.sender.id, 'companion:hide')) return;
    BrowserWindow.fromWebContents(event.sender)?.hide();
  });
  ipcMain.handle('app:quit', (event) => {
    if (permitted(event.sender.id, 'app:quit')) app.quit();
  });

  launcher = createLauncher();
  launcher.webContents.once('did-finish-load', () => {
    coachApp.publish();
    if (process.env.HS_COACH_SCREENSHOT && launcher) void captureShots(launcher, coachApp);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) launcher = createLauncher();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
