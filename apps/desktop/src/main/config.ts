import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
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
  demoMode: false,
  autoAnalyze: false
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
    demoMode: Boolean(source.demoMode),
    autoAnalyze: Boolean(source.autoAnalyze)
  };
}

export function loadSettings(): Settings {
  try {
    const raw = fs.readFileSync(configFile(), 'utf8');
    return sanitizeSettings(JSON.parse(raw) as Partial<Settings>);
  } catch {
    return { ...defaultSettings };
  }
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
