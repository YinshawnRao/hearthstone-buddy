import { boardKey, type BoardSnapshot } from '@hearthstone-buddy/parser';
import { decideBubble, type BubbleDecision } from './bubble';
import type { ViewState } from './types';

export interface SpokenMark {
  signature: string;
  at: number;
  boardKey: string;
}

export interface PresentResult {
  decision: BubbleDecision;
  speak: boolean;
  cancel: boolean;
  text: string;
}

/** Remembers when a line was actually spoken. Cooldown uses that time, not the current clock. */
export class SpeechGate {
  private last: SpokenMark | null = null;

  decide(state: ViewState, now: number, replay = false): PresentResult {
    const key = boardKey(state.board);
    const boardChanged = this.last != null && this.last.boardKey !== key;
    const decision = decideBubble({
      mode: state.settings.companionMode,
      boardKey: key,
      advice: state.advice,
      thinking: state.status.llm === 'thinking',
      now,
      last: replay || this.last == null ? undefined : { signature: this.last.signature, at: this.last.at }
    });
    if (state.advice == null) {
      if (this.last) this.last = { ...this.last, boardKey: key };
      return { decision, speak: false, cancel: true, text: '' };
    }
    if (decision.speak) this.last = { signature: decision.signature, at: now, boardKey: key };
    else if (boardChanged && this.last) this.last = { ...this.last, boardKey: key };
    return { decision, speak: decision.speak, cancel: boardChanged, text: decision.text };
  }

  replay(): void {
    this.last = null;
  }
}

export function snapshotIdentity(board: BoardSnapshot): string {
  return boardKey(board);
}
