import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultLogRoots, findNewestPowerLog, resolvePowerLog } from '../src/index.js';

test('Windows default root is under LOCALAPPDATA, then the install Logs folder', () => {
  const roots = defaultLogRoots('win32', {
    home: 'C:\\Users\\ada',
    localAppData: 'C:\\Users\\ada\\AppData\\Local',
    programFiles: 'C:\\Program Files',
    programFilesX86: 'C:\\Program Files (x86)'
  });
  assert.equal(roots[0], 'C:\\Users\\ada\\AppData\\Local\\Blizzard\\Hearthstone\\Logs');
  assert.equal(roots[1], 'C:\\Program Files (x86)\\Hearthstone\\Logs');
  assert.equal(roots[2], 'C:\\Program Files\\Hearthstone\\Logs');
});

test('Mac roots are the Hearthstone Logs folder, not Unity Player.log', () => {
  const roots = defaultLogRoots('darwin', { home: '/Users/ada' });
  assert.deepEqual(roots, [
    '/Applications/Hearthstone/Logs',
    '/Users/ada/Library/Logs/Blizzard/Hearthstone'
  ]);
  assert.equal(roots.some((root) => root.includes('Player.log') || root.includes('Unity')), false);
});

test('newest session Power.log wins over an older Logs/Power.log', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-coach-logs-'));
  const direct = path.join(root, 'Power.log');
  fs.writeFileSync(direct, 'old');
  const session = path.join(root, 'Hearthstone_2026_04_01_12_00_00');
  fs.mkdirSync(session);
  const latest = path.join(session, 'Power.log');
  fs.writeFileSync(latest, 'new');
  const old = new Date(Date.now() - 60_000);
  fs.utimesSync(direct, old, old);
  const found = findNewestPowerLog([root]);
  assert.equal(found.file, latest);
  assert.ok(found.searched.includes(session));
});

test('an explicit missing file does not fall through to the defaults', () => {
  const missing = path.join(os.tmpdir(), 'hs-coach-missing-power.log');
  const found = resolvePowerLog(missing, 'linux', { home: os.homedir() });
  assert.equal(found.file, null);
  assert.deepEqual(found.searched, [missing]);
});
