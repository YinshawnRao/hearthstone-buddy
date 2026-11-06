import { PowerParser } from './parser.js';
import { SAMPLE_POWER_LOG } from './sampleLog.js';
import { emptyBoard, snapshotFromRaw } from './snapshot.js';
import type { BoardSnapshot } from './types.js';

export { PowerParser } from './parser.js';
export { parseAdvice, fallbackAdvice } from './advice.js';
export { defaultLogRoots, findNewestPowerLog, resolvePowerLog } from './logpath.js';
export { SAMPLE_POWER_LOG } from './sampleLog.js';
export { boardKey, emptyBoard, snapshotFromRaw, toModelInput } from './snapshot.js';
export { cardName, CARD_NAMES } from './cards.js';
export type { LogEnv } from './logpath.js';
export type {
  Advice,
  AdviceStep,
  ActionType,
  BoardSnapshot,
  CardView,
  HeroView,
  LegalAction,
  MinionView
} from './types.js';

export function parsePowerLog(text: string, source: BoardSnapshot['source'] = 'log'): BoardSnapshot {
  const parser = new PowerParser();
  parser.push(text);
  return snapshotFromRaw(parser.raw(), source);
}

export function demoBoard(): BoardSnapshot {
  const board = parsePowerLog(SAMPLE_POWER_LOG, 'demo');
  if (!board.inGame) return emptyBoard();
  return board;
}
