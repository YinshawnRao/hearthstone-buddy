import type { Advice, BoardSnapshot } from '@hearthstone-buddy/parser';

export type CompanionMode = 'coach' | 'companion' | 'quiet';
export type Expression = 'idle' | 'thinking' | 'advice' | 'uncertain' | 'encouragement' | 'error';

export interface BubbleInput {
  mode: CompanionMode;
  boardKey: string;
  advice: Advice | null;
  thinking: boolean;
  now: number;
  last?: { signature: string; at: number };
  cooldownMs?: number;
}

export interface BubbleDecision {
  show: boolean;
  expression: Expression;
  text: string;
  detail: string;
  speak: boolean;
  signature: string;
  reason: string;
}

const ENCOURAGEMENT: Record<Expression, string> = {
  idle: '我在。你准备好了，我们就看下一手。',
  thinking: '我在看这一手。',
  advice: '这一手我帮你看过了。',
  uncertain: '这里还有没看清的地方，我们保守一点。',
  encouragement: '慢慢来，看清了再出。',
  error: '模型没接上。我先按本地规则说，不猜看不见的牌。'
};

function expressionFor(input: BubbleInput): Expression {
  if (input.thinking) return 'thinking';
  if (!input.advice) return 'idle';
  if (input.advice.fallback) return 'error';
  if (input.advice.warnings?.length || input.advice.uncertainty) return 'uncertain';
  return 'advice';
}

function tacticalText(advice: Advice): string {
  const step = advice.steps.find((item) => item.actionId && !item.illegal) ?? advice.steps[0];
  return [advice.summary, step?.text].filter(Boolean).join(' ');
}

export function decideBubble(input: BubbleInput): BubbleDecision {
  const expression = expressionFor(input);
  const cooldown = input.cooldownMs ?? 20_000;
  if (!input.advice || input.thinking) {
    return {
      show: input.thinking || input.mode !== 'quiet',
      expression,
      text: ENCOURAGEMENT[expression],
      detail: '',
      speak: false,
      signature: `${input.boardKey}|${expression}`,
      reason: input.thinking ? '分析中，不重复播报。' : '还没有建议。'
    };
  }
  const tactical = tacticalText(input.advice);
  const text = input.mode === 'companion' ? `${ENCOURAGEMENT[expression]} ${tactical}` : tactical;
  const detail = [input.advice.steps.map((step) => step.text).join('\n'), input.advice.risk, input.advice.uncertainty]
    .filter(Boolean)
    .join('\n');
  const signature = `${input.boardKey}|${input.mode}|${text}`;
  if (input.mode === 'quiet') {
    return { show: false, expression, text, detail, speak: false, signature, reason: '安静模式不主动开口。' };
  }
  if (input.last && input.last.signature === signature && input.now - input.last.at < cooldown) {
    return { show: true, expression, text, detail, speak: false, signature, reason: '同一局面的同一句还在冷却。' };
  }
  return { show: true, expression, text, detail, speak: true, signature, reason: '新的建议。' };
}

export function adviceStale(previousKey: string, nextKey: string): boolean {
  return previousKey !== nextKey;
}

export function boardSignature(board: BoardSnapshot, advice: Advice | null): string {
  return `${board.turn}|${board.mana.available}|${board.legalActions.map((action) => action.id).join(',')}|${advice?.summary ?? ''}`;
}
