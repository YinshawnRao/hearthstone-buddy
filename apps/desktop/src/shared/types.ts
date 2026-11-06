import type { Advice, BoardSnapshot } from '@hs-coach/parser';

export type ProviderId = 'openai' | 'anthropic' | 'ollama';

export interface Settings {
  provider: ProviderId;
  openaiBaseUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  anthropicBaseUrl: string;
  anthropicApiKey: string;
  anthropicModel: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  logPath: string;
  demoMode: boolean;
  autoAnalyze: boolean;
}

export interface AppStatus {
  mode: 'demo' | 'live';
  watching: boolean;
  logPath: string | null;
  logFound: boolean;
  searched: string[];
  logError: string | null;
  lastUpdate: string | null;
  linesParsed: number;
  llm: 'unconfigured' | 'ready' | 'thinking' | 'ok' | 'error';
  llmDetail: string;
  modelLabel: string;
}

export interface ViewState {
  board: BoardSnapshot;
  status: AppStatus;
  advice: Advice | null;
  settings: Settings;
}
