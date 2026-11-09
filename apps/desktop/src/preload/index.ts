import { contextBridge, ipcRenderer } from 'electron';
import type { Settings, ViewState } from '../shared/types';

const api = {
  getState: (): Promise<ViewState> => ipcRenderer.invoke('state:get'),
  onState: (listener: (state: ViewState) => void): (() => void) => {
    const channel = (_event: unknown, state: ViewState): void => listener(state);
    ipcRenderer.on('state', channel);
    return () => ipcRenderer.removeListener('state', channel);
  },
  onOpenSettings: (listener: () => void): (() => void) => {
    const channel = (): void => listener();
    ipcRenderer.on('ui:openSettings', channel);
    return () => ipcRenderer.removeListener('ui:openSettings', channel);
  },
  onInspect: (listener: (cardId: string) => void): (() => void) => {
    const channel = (_event: unknown, cardId: string): void => listener(cardId);
    ipcRenderer.on('ui:inspect', channel);
    return () => ipcRenderer.removeListener('ui:inspect', channel);
  },
  saveSettings: (settings: Settings): Promise<ViewState> => ipcRenderer.invoke('settings:save', settings),
  analyze: (): Promise<ViewState> => ipcRenderer.invoke('analyze'),
  chooseLog: (): Promise<ViewState> => ipcRenderer.invoke('log:choose'),
  useAutoLog: (): Promise<ViewState> => ipcRenderer.invoke('log:auto'),
  chooseGame: (): Promise<ViewState> => ipcRenderer.invoke('game:choose'),
  discoverGame: (): Promise<{ note: string; candidates: { executable: string; label: string }[] }> => ipcRenderer.invoke('game:discover'),
  launchGame: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('game:launch'),
  openCompanionOnly: (): Promise<{ ok: boolean; message: string }> => ipcRenderer.invoke('companion:only'),
  setClickThrough: (ignore: boolean): Promise<void> => ipcRenderer.invoke('companion:click-through', ignore),
  cycleMode: (): Promise<ViewState> => ipcRenderer.invoke('companion:cycle-mode'),
  replayAdvice: (): Promise<void> => ipcRenderer.invoke('companion:replay'),
  showLauncher: (): Promise<void> => ipcRenderer.invoke('launcher:show'),
  hideCompanion: (): Promise<void> => ipcRenderer.invoke('companion:hide'),
  quit: (): Promise<void> => ipcRenderer.invoke('app:quit')
};

contextBridge.exposeInMainWorld('hsCoach', api);
contextBridge.exposeInMainWorld('buddy', api);
