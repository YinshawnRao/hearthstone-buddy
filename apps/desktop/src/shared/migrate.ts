import type { Settings } from './types';

export function legacyUserDataDirs(home: string, platform: NodeJS.Platform, appData?: string): string[] {
  if (platform === 'win32') {
    const root = appData || `${home}\\AppData\\Roaming`;
    return [`${root}\\hs-coach`];
  }
  if (platform === 'darwin') return [`${home}/Library/Application Support/hs-coach`];
  return [`${home}/.config/hs-coach`];
}

export function mergeLegacySettings(current: Settings, legacy: Partial<Settings> | null): Settings {
  if (!legacy) return current;
  const emptyKey = !current.openaiApiKey && !current.anthropicApiKey;
  if (!emptyKey && current.logPath) return current;
  return {
    ...current,
    provider: legacy.provider ?? current.provider,
    openaiBaseUrl: current.openaiBaseUrl || legacy.openaiBaseUrl || current.openaiBaseUrl,
    openaiApiKey: current.openaiApiKey || legacy.openaiApiKey || '',
    openaiModel: current.openaiModel || legacy.openaiModel || current.openaiModel,
    anthropicBaseUrl: current.anthropicBaseUrl || legacy.anthropicBaseUrl || current.anthropicBaseUrl,
    anthropicApiKey: current.anthropicApiKey || legacy.anthropicApiKey || '',
    anthropicModel: current.anthropicModel || legacy.anthropicModel || current.anthropicModel,
    ollamaBaseUrl: current.ollamaBaseUrl || legacy.ollamaBaseUrl || current.ollamaBaseUrl,
    ollamaModel: current.ollamaModel || legacy.ollamaModel || current.ollamaModel,
    logPath: current.logPath || legacy.logPath || '',
    demoMode: current.demoMode || Boolean(legacy.demoMode),
    autoAnalyze: current.autoAnalyze || Boolean(legacy.autoAnalyze)
  };
}
