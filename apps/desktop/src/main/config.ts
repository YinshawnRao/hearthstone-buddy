import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { legacyUserDataDirs, mergeLegacySettings } from '../shared/migrate';
import type { CompanionMode } from '../shared/bubble';
import { findCharacter } from '../shared/characters';
import type { TtsBackend } from '../shared/tts';
import type { ProviderId, Settings } from '../shared/types';

export const defaultSettings: Settings = {
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

export function configFile(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function asProvider(value: unknown): ProviderId {
  if (value === 'anthropic' || value === 'ollama' || value === 'openai') return value;
  return 'openai';
}

export function sanitizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const source = input ?? {};
  const text = (value: unknown, fallback: string): string => (typeof value === 'string' ? value : fallback);
  const mode: CompanionMode = source.companionMode === 'companion' || source.companionMode === 'quiet' ? source.companionMode : 'coach';
  const backend: TtsBackend = source.ttsBackend === 'command' || source.ttsBackend === 'os-speech' ? source.ttsBackend : 'off';
  const args = Array.isArray(source.ttsArgs) ? source.ttsArgs.filter((item): item is string => typeof item === 'string').slice(0, 12) : defaultSettings.ttsArgs;
  return {
    provider: asProvider(source.provider),
    openaiBaseUrl: text(source.openaiBaseUrl, defaultSettings.openaiBaseUrl).trim() || defaultSettings.openaiBaseUrl,
    openaiApiKey: text(source.openaiApiKey, ''),
    openaiModel: text(source.openaiModel, defaultSettings.openaiModel).trim() || defaultSettings.openaiModel,
    anthropicBaseUrl: text(source.anthropicBaseUrl, defaultSettings.anthropicBaseUrl).trim() || defaultSettings.anthropicBaseUrl,
    anthropicApiKey: text(source.anthropicApiKey, ''),
    anthropicModel: text(source.anthropicModel, defaultSettings.anthropicModel).trim() || defaultSettings.anthropicModel,
    ollamaBaseUrl: text(source.ollamaBaseUrl, defaultSettings.ollamaBaseUrl).trim() || defaultSettings.ollamaBaseUrl,
    ollamaModel: text(source.ollamaModel, defaultSettings.ollamaModel).trim() || defaultSettings.ollamaModel,
    logPath: text(source.logPath, '').trim(),
    gameExecutable: text(source.gameExecutable, '').trim(),
    demoMode: Boolean(source.demoMode),
    autoAnalyze: Boolean(source.autoAnalyze),
    characterId: findCharacter(text(source.characterId, 'cheng')).id,
    companionMode: mode,
    lowMotion: Boolean(source.lowMotion),
    ttsEnabled: Boolean(source.ttsEnabled),
    ttsBackend: backend,
    ttsCommand: text(source.ttsCommand, '').trim(),
    ttsArgs: args.length > 0 ? args : ['{{text}}']
  };
}

function readPartial(file: string): Partial<Settings> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Settings>;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  const own = readPartial(configFile());
  if (own) return sanitizeSettings(own);
  const dirs = legacyUserDataDirs(os.homedir(), process.platform, process.env.APPDATA);
  for (const dir of dirs) {
    const legacy = readPartial(path.join(dir, 'config.json'));
    if (!legacy) continue;
    const merged = mergeLegacySettings({ ...defaultSettings }, legacy);
    saveSettings(merged);
    return merged;
  }
  return { ...defaultSettings };
}

export function saveSettings(settings: Settings): void {
  const file = configFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

export function isConfigured(settings: Settings): boolean {
  if (settings.provider === 'ollama') {
    return Boolean(settings.ollamaBaseUrl.trim() && settings.ollamaModel.trim());
  }
  if (settings.provider === 'anthropic') {
    return Boolean(settings.anthropicApiKey.trim() && settings.anthropicModel.trim() && settings.anthropicBaseUrl.trim());
  }
  return Boolean(
    settings.openaiBaseUrl.trim() &&
      settings.openaiModel.trim() &&
      (settings.openaiApiKey.trim() || isLocalBaseUrl(settings.openaiBaseUrl))
  );
}

export function modelLabel(settings: Settings): string {
  if (settings.provider === 'ollama') return settings.ollamaModel || 'Ollama';
  if (settings.provider === 'anthropic') return settings.anthropicModel || 'Claude';
  return settings.openaiModel || 'OpenAI';
}
