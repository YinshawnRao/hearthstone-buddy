import { boardKey, demoBoard, emptyBoard, type Advice, type BoardSnapshot } from '@hs-coach/parser';
import { BrowserWindow } from 'electron';
import { isConfigured, loadSettings, modelLabel, saveSettings, sanitizeSettings } from './config';
import { requestAdvice } from './llm';
import type { AppStatus, Settings, ViewState } from '../shared/types';
import { LogWatcher, type LogUpdate } from './watcher';

/**
 * Owns settings, the log tail, and advice requests.
 * Advice is text only. This process does not send mouse, keyboard, or game input.
 */
export class CoachApp {
  private settings: Settings;
  private board: BoardSnapshot;
  private advice: Advice | null = null;
  private boardSignature = '';
  private linesParsed = 0;
  private searched: string[] = [];
  private activeLog: string | null = null;
  private logError: string | null = null;
  private lastUpdate: string | null = null;
  private llm: AppStatus['llm'] = 'unconfigured';
  private llmDetail = '';
  private autoTimer: NodeJS.Timeout | null = null;
  private requestId = 0;
  private readonly watcher: LogWatcher;

  constructor() {
    this.settings = loadSettings();
    if (process.env.HS_COACH_DEMO === '1') this.settings.demoMode = true;
    this.llm = isConfigured(this.settings) || process.env.HS_COACH_MOCK_LLM === '1' ? 'ready' : 'unconfigured';
    this.board = this.settings.demoMode ? demoBoard() : emptyBoard();
    this.boardSignature = boardKey(this.board);
    if (this.settings.demoMode) this.lastUpdate = new Date().toISOString();
    this.watcher = new LogWatcher(
      () => this.settings.logPath,
      (update) => this.onLog(update)
    );
    if (!this.settings.demoMode) this.watcher.start();
  }

  currentSettings(): Settings {
    return this.settings;
  }

  view(): ViewState {
    const demo = this.settings.demoMode;
    return {
      board: this.board,
      advice: this.advice,
      settings: this.settings,
      status: {
        mode: demo ? 'demo' : 'live',
        watching: !demo && Boolean(this.activeLog),
        logPath: demo ? null : this.activeLog,
        logFound: !demo && Boolean(this.activeLog),
        searched: this.searched,
        logError: demo ? null : this.logError,
        lastUpdate: this.lastUpdate,
        linesParsed: demo ? 0 : this.linesParsed,
        llm: this.llm,
        llmDetail: this.llmDetail,
        modelLabel: process.env.HS_COACH_MOCK_LLM === '1' ? '样例' : modelLabel(this.settings)
      }
    };
  }

  publish(): void {
    const state = this.view();
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('state', state);
    }
  }

  save(input: Partial<Settings>): ViewState {
    const previous = this.settings;
    const next = sanitizeSettings({ ...previous, ...input });
    const demoChanged = next.demoMode !== previous.demoMode;
    const pathChanged = next.logPath !== previous.logPath;
    const autoTurnedOn = next.autoAnalyze && !previous.autoAnalyze;
    this.settings = next;
    saveSettings(next);
    this.refreshLlmFlag();
    if (demoChanged) {
      this.advice = null;
      this.llmDetail = '';
      if (next.demoMode) {
        this.watcher.stop();
        this.board = demoBoard();
        this.boardSignature = boardKey(this.board);
        this.lastUpdate = new Date().toISOString();
      } else {
        this.board = emptyBoard();
        this.boardSignature = boardKey(this.board);
        this.activeLog = null;
        this.watcher.start();
      }
    } else if (!next.demoMode && pathChanged) {
      this.activeLog = null;
      this.watcher.start();
    }
    if (autoTurnedOn) this.scheduleAuto();
    this.publish();
    return this.view();
  }

  async analyze(): Promise<ViewState> {
    const token = ++this.requestId;
    const board = this.board;
    const signature = this.boardSignature;
    if (!isConfigured(this.settings) && process.env.HS_COACH_MOCK_LLM !== '1') {
      this.advice = await requestAdvice(this.settings, board);
      this.llm = 'unconfigured';
      this.llmDetail = this.advice.detail ?? '';
      this.publish();
      return this.view();
    }
    this.llm = 'thinking';
    this.llmDetail = '';
    this.publish();
    const advice = await requestAdvice(this.settings, board);
    if (token !== this.requestId || signature !== this.boardSignature) return this.view();
    this.advice = advice;
    this.llm = advice.fallback ? 'error' : 'ok';
    this.llmDetail = advice.detail ?? '';
    this.publish();
    return this.view();
  }

  private refreshLlmFlag(): void {
    if (this.llm === 'thinking') return;
    if (this.advice && !this.advice.fallback) {
      this.llm = 'ok';
      return;
    }
    if (this.advice?.fallback && isConfigured(this.settings)) {
      this.llm = 'error';
      return;
    }
    this.llm = isConfigured(this.settings) || process.env.HS_COACH_MOCK_LLM === '1' ? 'ready' : 'unconfigured';
  }

  private scheduleAuto(): void {
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = null;
    if (!this.settings.autoAnalyze) return;
    if (!isConfigured(this.settings) && process.env.HS_COACH_MOCK_LLM !== '1') return;
    if (!this.board.inGame || !this.board.ourTurn) return;
    this.autoTimer = setTimeout(() => {
      this.autoTimer = null;
      void this.analyze();
    }, 1200);
  }

  private onLog(update: LogUpdate): void {
    if (this.settings.demoMode) return;
    const previousFile = this.activeLog;
    const previousLines = this.linesParsed;
    this.searched = update.searched;
    this.activeLog = update.file;
    this.linesParsed = update.lines;
    this.logError = update.error;

    if (!update.file || !update.board) {
      if (previousFile !== update.file || update.error) {
        if (!update.file) {
          this.board = emptyBoard();
          this.boardSignature = boardKey(this.board);
          this.advice = null;
        }
        this.publish();
      }
      return;
    }

    const nextKey = boardKey(update.board);
    if (nextKey !== this.boardSignature) {
      this.board = update.board;
      this.boardSignature = nextKey;
      this.advice = null;
      this.lastUpdate = new Date().toISOString();
      if (this.llm !== 'thinking') {
        this.llm = isConfigured(this.settings) || process.env.HS_COACH_MOCK_LLM === '1' ? 'ready' : 'unconfigured';
        this.llmDetail = '';
      }
      this.scheduleAuto();
      this.publish();
      return;
    }
    if (previousLines !== update.lines || previousFile !== update.file) this.publish();
  }
}
