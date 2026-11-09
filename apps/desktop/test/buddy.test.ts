import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { decideBubble } from '../src/shared/bubble.ts';
import { defaultCharacter, findCharacter } from '../src/shared/characters.ts';
import { discoverGameTargets, planLaunch, validateManualGamePath, windowPlanAfterLaunch } from '../src/shared/launch.ts';
import { mergeLegacySettings, legacyUserDataDirs } from '../src/shared/migrate.ts';
import { planCommandTts, planOsSpeech, sanitizeSpeechText } from '../src/shared/tts.ts';
import { cancelSpeech, speakText } from '../src/main/speech.ts';
import type { Advice } from '@hs-coach/parser';
import type { Settings } from '../src/shared/types.ts';

const blankSettings: Settings = {
  provider: 'openai',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  anthropicBaseUrl: 'https://api.anthropic.com',
  anthropicApiKey: '',
  anthropicModel: 'claude-3-5-haiku-latest',
  ollamaBaseUrl: 'http://127.0.0.1:11434/v1',
  ollamaModel: 'llama3.1',
  logPath: '',
  gameExecutable: '',
  demoMode: false,
  autoAnalyze: false,
  characterId: 'cheng',
  companionMode: 'coach',
  lowMotion: false,
  ttsEnabled: false,
  ttsBackend: 'off',
  ttsCommand: '',
  ttsArgs: ['{{text}}']
};

const advice: Advice = {
  summary: '先解嘲讽。',
  steps: [{ actionId: 'atk-10-t-30', text: '用水元素攻击银背族长。' }],
  risk: '奥秘未知。',
  uncertainty: '不知道对手手牌。',
  fallback: false,
  source: 'offline'
};

test('default companion is the original character 澄', () => {
  assert.equal(defaultCharacter().id, 'cheng');
  assert.equal(defaultCharacter().adult, true);
  assert.equal(findCharacter('missing').id, 'cheng');
  assert.equal(findCharacter('cheng').renderer, 'svg-cheng');
});

test('Windows discovery checks known paths only and prefers Hearthstone.exe', () => {
  const hearth = 'C:\\Program Files (x86)\\Hearthstone\\Hearthstone.exe';
  const battle = 'D:\\Games\\Battle.net\\Battle.net.exe';
  const found = discoverGameTargets({
    platform: 'win32',
    programFilesX86: 'C:\\Program Files (x86)',
    registryLocations: ['D:\\Games\\Battle.net'],
    exists: (file) => file === hearth || file === battle
  });
  assert.equal(found.verifiedPlatform, true);
  assert.equal(found.candidates[0]?.kind, 'hearthstone');
  assert.equal(found.candidates.some((item) => item.kind === 'battlenet'), true);
  const mac = discoverGameTargets({ platform: 'darwin', exists: () => true });
  assert.equal(mac.verifiedPlatform, false);
  assert.equal(mac.candidates.length, 0);
  assert.match(mac.note, /尚未在真机验证/);
});

test('manual game path rejects shells and missing files', () => {
  const blocked = validateManualGamePath('C:\\Windows\\System32\\cmd.exe', () => true);
  assert.equal(blocked.ok, false);
  const missing = validateManualGamePath('C:\\Games\\Hearthstone\\Hearthstone.exe', () => false);
  assert.equal(missing.ok, false);
  const ok = validateManualGamePath('C:\\Games\\Hearthstone\\Hearthstone.exe', () => true);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    const plan = planLaunch(ok.target, 'win32');
    assert.equal(plan.ok, true);
    if (plan.ok && plan.method === 'spawn') assert.deepEqual(plan.args, []);
    assert.equal(planLaunch(ok.target, 'linux').ok, false);
  }
});

test('launcher stays visible when launch fails and hides only after success', () => {
  assert.deepEqual(windowPlanAfterLaunch(false), { hideLauncher: false, showCompanion: false });
  assert.deepEqual(windowPlanAfterLaunch(true), { hideLauncher: true, showCompanion: true });
});

test('bubble dedup, quiet mode, and a new snapshot', () => {
  const first = decideBubble({ mode: 'coach', boardKey: 'a', advice, thinking: false, now: 1_000 });
  assert.equal(first.speak, true);
  assert.match(first.text, /解嘲讽/);
  const again = decideBubble({ mode: 'coach', boardKey: 'a', advice, thinking: false, now: 2_000, last: { signature: first.signature, at: 1_000 } });
  assert.equal(again.speak, false);
  assert.match(again.reason, /冷却/);
  const quiet = decideBubble({ mode: 'quiet', boardKey: 'a', advice, thinking: false, now: 5_000 });
  assert.equal(quiet.show, false);
  const next = decideBubble({ mode: 'coach', boardKey: 'b', advice, thinking: false, now: 3_000, last: { signature: first.signature, at: 1_000 } });
  assert.equal(next.speak, true);
  assert.equal(next.signature === first.signature, false);
});

test('legacy hs-coach settings can seed an empty Buddy config', () => {
  assert.equal(legacyUserDataDirs('/Users/ada', 'darwin')[0], '/Users/ada/Library/Application Support/hs-coach');
  const merged = mergeLegacySettings(blankSettings, {
    provider: 'openai',
    openaiApiKey: 'sk-test',
    openaiModel: 'gpt-4o-mini',
    logPath: 'D:\\Power.log'
  });
  assert.equal(merged.openaiApiKey, 'sk-test');
  assert.equal(merged.logPath, 'D:\\Power.log');
  assert.equal(merged.characterId, 'cheng');
});

test('open-source TTS command rejects shells and keeps text out of the OS speech command', async () => {
  const bad = planCommandTts({ enabled: true, backend: 'command', command: 'powershell.exe', args: ['{{text}}'] }, '你好');
  assert.equal(bad.ok, false);
  const relative = planCommandTts({ enabled: true, backend: 'command', command: 'espeak-ng', args: ['{{text}}'] }, '你好');
  assert.equal(relative.ok, false);
  const planned = planCommandTts(
    { enabled: true, backend: 'command', command: 'C:\\Tools\\espeak-ng\\espeak-ng.exe', args: ['-v', 'zh', '{{text}}'] },
    '先解嘲讽'
  );
  assert.equal(planned.ok, true);
  if (planned.ok) assert.equal(planned.args[2], '先解嘲讽');
  const osSpeech = planOsSpeech();
  assert.equal(osSpeech.label.includes('不是随应用打包'), true);
  assert.equal(osSpeech.args.join(' ').includes('先解嘲讽'), false);
  assert.equal(sanitizeSpeechText('你好\0世界'), '你好世界');
  const missing = await speakText({ enabled: true, backend: 'command', command: 'C:\\missing\\espeak-ng.exe', args: ['{{text}}'] }, '你好');
  assert.equal(missing.ok, false);
});

test('TTS cancel stops a running adapter process', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'buddy-tts-'));
  const script = path.join(directory, 'sleep.js');
  fs.writeFileSync(script, 'setTimeout(() => process.exit(0), 30000);\n');
  const pending = speakText(
    { enabled: true, backend: 'command', command: process.execPath, args: [script, '{{text}}'] },
    '取消我'
  );
  await new Promise((resolve) => setTimeout(resolve, 150));
  cancelSpeech();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.match(result.message, /取消/);
});
