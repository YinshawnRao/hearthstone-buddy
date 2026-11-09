import path from 'node:path';

const ALLOWED_EXECUTABLES = new Set(['hearthstone.exe', 'battle.net.exe']);
const BLOCKED_EXECUTABLES = new Set(['cmd.exe', 'powershell.exe', 'pwsh.exe', 'bash.exe', 'wscript.exe', 'cscript.exe']);

export interface DiscoverInput {
  platform: NodeJS.Platform;
  programFiles?: string;
  programFilesX86?: string;
  /** Install-location strings already read from known registry keys. Not a disk scan. */
  registryLocations?: string[];
  exists: (file: string) => boolean;
}

export interface GameTarget {
  kind: 'hearthstone' | 'battlenet';
  executable: string;
  label: string;
}

export interface DiscoverResult {
  verifiedPlatform: boolean;
  note: string;
  candidates: GameTarget[];
}

export type LaunchPlan =
  | { ok: true; method: 'spawn'; command: string; args: string[] }
  | { ok: true; method: 'uri'; uri: 'battlenet://hs' }
  | { ok: false; reason: string };

function winPath(...parts: string[]): string {
  return path.win32.join(...parts);
}

function baseName(file: string): string {
  return path.win32.basename(file).toLowerCase();
}

export function discoverGameTargets(input: DiscoverInput): DiscoverResult {
  if (input.platform === 'darwin') {
    return {
      verifiedPlatform: false,
      note: 'macOS 启动尚未在真机验证。可以只开陪伴，或之后手动选择安装位置。',
      candidates: []
    };
  }
  if (input.platform !== 'win32') {
    return {
      verifiedPlatform: false,
      note: '当前不是 Windows。不会假装已经找到或启动了炉石。',
      candidates: []
    };
  }
  const pf = input.programFiles || 'C:\\Program Files';
  const pfx = input.programFilesX86 || 'C:\\Program Files (x86)';
  const seeds = [
    winPath(pfx, 'Hearthstone', 'Hearthstone.exe'),
    winPath(pf, 'Hearthstone', 'Hearthstone.exe'),
    winPath(pfx, 'Battle.net', 'Battle.net.exe'),
    winPath(pf, 'Battle.net', 'Battle.net.exe')
  ];
  for (const location of input.registryLocations ?? []) {
    const trimmed = location.trim().replace(/^"|"$/g, '');
    if (!trimmed || trimmed.includes('\0')) continue;
    const lower = trimmed.toLowerCase();
    if (lower.endsWith('hearthstone.exe') || lower.endsWith('battle.net.exe')) seeds.push(trimmed);
    else if (lower.includes('hearthstone')) seeds.push(winPath(trimmed, 'Hearthstone.exe'));
    else if (lower.includes('battle.net')) seeds.push(winPath(trimmed, 'Battle.net.exe'));
  }
  const seen = new Set<string>();
  const candidates: GameTarget[] = [];
  for (const executable of seeds) {
    const key = executable.toLowerCase();
    if (seen.has(key) || !input.exists(executable)) continue;
    seen.add(key);
    const name = baseName(executable);
    if (!ALLOWED_EXECUTABLES.has(name)) continue;
    candidates.push({
      kind: name === 'hearthstone.exe' ? 'hearthstone' : 'battlenet',
      executable,
      label: name === 'hearthstone.exe' ? 'Hearthstone.exe' : 'Battle.net'
    });
  }
  candidates.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'hearthstone' ? -1 : 1));
  return {
    verifiedPlatform: true,
    note: candidates.length > 0 ? '找到可交接的程序。启动成功只表示系统接受了启动请求。' : '没有在默认安装位置找到炉石或 Battle.net。',
    candidates
  };
}

export function validateManualGamePath(
  filePath: string,
  exists: (file: string) => boolean
): { ok: true; target: GameTarget } | { ok: false; reason: string } {
  const trimmed = filePath.trim();
  if (!trimmed || trimmed.includes('\0') || trimmed.includes('\n') || trimmed.includes('\r')) {
    return { ok: false, reason: '路径无效。' };
  }
  if (!path.win32.isAbsolute(trimmed) && !path.posix.isAbsolute(trimmed)) {
    return { ok: false, reason: '请选择绝对路径。' };
  }
  const name = path.win32.basename(trimmed.replaceAll('/', '\\')).toLowerCase();
  if (BLOCKED_EXECUTABLES.has(name)) return { ok: false, reason: '不能把系统命令程序当作炉石启动。' };
  if (!ALLOWED_EXECUTABLES.has(name)) return { ok: false, reason: '请选择 Hearthstone.exe 或 Battle.net.exe。' };
  if (!exists(trimmed)) return { ok: false, reason: '这个文件不存在。' };
  return {
    ok: true,
    target: {
      kind: name === 'hearthstone.exe' ? 'hearthstone' : 'battlenet',
      executable: trimmed,
      label: name === 'hearthstone.exe' ? 'Hearthstone.exe' : 'Battle.net'
    }
  };
}

export function planLaunch(target: GameTarget, platform: NodeJS.Platform): LaunchPlan {
  if (platform !== 'win32') {
    return { ok: false, reason: '这个系统上的炉石启动还没有真机验证，所以不会报告启动成功。' };
  }
  if (target.kind === 'hearthstone') {
    return { ok: true, method: 'spawn', command: target.executable, args: [] };
  }
  return { ok: true, method: 'uri', uri: 'battlenet://hs' };
}

export function isApprovedBattleNetUri(uri: string): uri is 'battlenet://hs' {
  return uri === 'battlenet://hs';
}

export function windowPlanAfterLaunch(ok: boolean): { hideLauncher: boolean; showCompanion: boolean } {
  return ok ? { hideLauncher: true, showCompanion: true } : { hideLauncher: false, showCompanion: false };
}

/** Fixed registry queries. Values are never taken from the model or from a free-form UI string. */
export const KNOWN_REGISTRY_QUERIES = [
  { key: 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Hearthstone', value: 'InstallLocation' },
  { key: 'HKLM\\SOFTWARE\\WOW6432Node\\Blizzard Entertainment\\Battle.net', value: 'InstallPath' }
] as const;

export function parseRegQueryOutput(text: string, valueName: string): string | null {
  const wanted = valueName.toLowerCase();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([^\s]+)\s+REG_\w+\s+(.+)$/.exec(line);
    if (!match) continue;
    if (match[1].toLowerCase() !== wanted) continue;
    const location = match[2].trim().replace(/^"|"$/g, '');
    if (!location || location.includes('\0')) return null;
    return location;
  }
  return null;
}
