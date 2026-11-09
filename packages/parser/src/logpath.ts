import fs from 'node:fs';
import path from 'node:path';

export interface LogEnv {
  home: string;
  localAppData?: string;
  programFiles?: string;
  programFilesX86?: string;
}

const LOG_NAMES = ['Power.log', 'power.log'];

function pathFor(platform: NodeJS.Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * Directories that may contain Power.log or a session folder with Power.log inside.
 * Windows prefers %LOCALAPPDATA%\\Blizzard\\Hearthstone\\Logs, then the install Logs folder.
 * macOS prefers /Applications/Hearthstone/Logs (what HSTracker reads). Unity Player.log is not used.
 */
export function defaultLogRoots(platform: NodeJS.Platform, env: LogEnv): string[] {
  const p = pathFor(platform);
  if (platform === 'win32') {
    const local = env.localAppData || p.join(env.home, 'AppData', 'Local');
    const pf = env.programFiles || 'C:\\Program Files';
    const pfx = env.programFilesX86 || 'C:\\Program Files (x86)';
    return [
      p.join(local, 'Blizzard', 'Hearthstone', 'Logs'),
      p.join(pfx, 'Hearthstone', 'Logs'),
      p.join(pf, 'Hearthstone', 'Logs')
    ];
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Hearthstone/Logs',
      p.join(env.home, 'Library', 'Logs', 'Blizzard', 'Hearthstone')
    ];
  }
  return [
    p.join(env.home, '.local', 'share', 'Blizzard', 'Hearthstone', 'Logs'),
    p.join(env.home, '.wine', 'drive_c', 'users', path.basename(env.home), 'AppData', 'Local', 'Blizzard', 'Hearthstone', 'Logs')
  ];
}

function consider(file: string, found: { file: string; mtime: number }[]): void {
  try {
    const stat = fs.statSync(file);
    if (stat.isFile()) found.push({ file, mtime: stat.mtimeMs });
  } catch {
    // missing files are expected while probing
  }
}

export function findNewestPowerLog(roots: string[]): { file: string | null; searched: string[] } {
  const searched: string[] = [];
  const found: { file: string; mtime: number }[] = [];
  for (const root of roots) {
    if (!root) continue;
    searched.push(root);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(root);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      if (path.basename(root).toLowerCase() === 'power.log') found.push({ file: root, mtime: stat.mtimeMs });
      continue;
    }
    if (!stat.isDirectory()) continue;
    for (const name of LOG_NAMES) consider(path.join(root, name), found);
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(root, entry.name);
      searched.push(dir);
      for (const name of LOG_NAMES) consider(path.join(dir, name), found);
    }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return { file: found[0]?.file ?? null, searched };
}

export function resolvePowerLog(
  explicit: string,
  platform: NodeJS.Platform,
  env: LogEnv
): { file: string | null; searched: string[] } {
  const target = explicit.trim();
  if (target) {
    try {
      const stat = fs.statSync(target);
      if (stat.isFile()) return { file: target, searched: [target] };
      if (stat.isDirectory()) return findNewestPowerLog([target]);
    } catch {
      return { file: null, searched: [target] };
    }
  }
  return findNewestPowerLog(defaultLogRoots(platform, env));
}
