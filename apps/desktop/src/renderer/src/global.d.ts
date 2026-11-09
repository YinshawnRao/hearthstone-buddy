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
}

declare global {
  interface Window {
    hsCoach?: HsCoachApi;
  }
}

export {};
