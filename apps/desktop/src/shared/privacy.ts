import type { Settings, ViewState } from './types';

export type WindowRole = 'launcher' | 'companion';

const COMPANION_CHANNELS = new Set([
  'state:get',
  'analyze',
  'companion:click-through',
  'companion:cycle-mode',
  'companion:replay',
  'launcher:show',
  'companion:hide',
  'app:quit'
]);

const LAUNCHER_CHANNELS = new Set([
  ...COMPANION_CHANNELS,
  'settings:save',
  'log:choose',
  'log:auto',
  'game:discover',
  'game:choose',
  'game:launch',
  'companion:only'
]);

export function allowIpc(role: WindowRole, channel: string): boolean {
  if (role === 'companion') return COMPANION_CHANNELS.has(channel);
  return LAUNCHER_CHANNELS.has(channel);
}

export function redactSettings(settings: Settings): Settings {
  return {
    ...settings,
    openaiApiKey: '',
    anthropicApiKey: ''
  };
}

export function redactView(state: ViewState): ViewState {
  return { ...state, settings: redactSettings(state.settings) };
}

export function shouldCommitAnalysis(token: number, latestToken: number, capturedKey: string, currentKey: string): boolean {
  return token === latestToken && capturedKey === currentKey;
}
