import type { Settings, ViewState } from '../../shared/types';

export interface HsCoachApi {
  getState(): Promise<ViewState>;
  onState(listener: (state: ViewState) => void): () => void;
  onOpenSettings(listener: () => void): () => void;
  onInspect(listener: (cardId: string) => void): () => void;
  saveSettings(settings: Settings): Promise<ViewState>;
  analyze(): Promise<ViewState>;
  chooseLog(): Promise<ViewState>;
  useAutoLog(): Promise<ViewState>;
  chooseGame(): Promise<ViewState>;
  discoverGame(): Promise<{ note: string; candidates: { executable: string; label: string }[] }>;
  launchGame(): Promise<{ ok: boolean; message: string }>;
  openCompanionOnly(): Promise<{ ok: boolean; message: string }>;
  setClickThrough(ignore: boolean): Promise<void>;
  cycleMode(): Promise<ViewState>;
  replayAdvice(): Promise<void>;
  showLauncher(): Promise<void>;
  hideCompanion(): Promise<void>;
  quit(): Promise<void>;
}

declare global {
  interface Window {
    hsCoach?: HsCoachApi;
  }
}

export {};
