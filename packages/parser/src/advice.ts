import type { Advice, AdviceStep } from './types.js';

export function parseAdvice(text: string): Advice {
  let raw = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced?.[1]) raw = fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') throw new Error('模型返回不是 JSON 对象');
  const record = data as Record<string, unknown>;
  if (typeof record.summary !== 'string' || !record.summary.trim()) {
    throw new Error('缺少 summary');
  }
  if (!Array.isArray(record.steps)) throw new Error('缺少 steps');
  if (typeof record.risk !== 'string') throw new Error('缺少 risk');
  const steps: AdviceStep[] = [];
  for (const step of record.steps) {
    if (!step || typeof step !== 'object') continue;
    const item = step as Record<string, unknown>;
    const textValue = typeof item.text === 'string' ? item.text.trim() : '';
    if (!textValue) continue;
    steps.push({
      actionId: typeof item.actionId === 'string' && item.actionId.trim() ? item.actionId.trim() : null,
      text: textValue
    });
  }
  return {
    summary: record.summary.trim(),
    steps: steps.slice(0, 6),
    risk: record.risk.trim(),
    fallback: false
  };
}

export function fallbackAdvice(summary: string, detail: string): Advice {
  return {
    summary,
    steps: [],
    risk: '',
    fallback: true,
    detail
  };
}
