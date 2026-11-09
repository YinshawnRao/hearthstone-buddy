import {
  adviseOffline,
  buildAnalysisPayload,
  buildSystemPrompt,
  fallbackAdvice,
  KNOWLEDGE_VERSION,
  parseAdvice,
  reviewModelAdvice,
  type Advice,
  type BoardSnapshot,
  type CatalogCard,
  type CardSourceInfo
} from '@hearthstone-buddy/parser';
import fs from 'node:fs';
import path from 'node:path';
import type { Settings } from '../shared/types';
import { isConfigured, isLocalBaseUrl } from './config';

const TIMEOUT_MS = 30_000;
const SYSTEM_PROMPT = buildSystemPrompt();

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

function joinUrl(base: string, suffix: string): string {
  return `${base.trim().replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

function anthropicUrl(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? `${trimmed}/messages` : `${trimmed}/v1/messages`;
}

function activeKey(settings: Settings): string {
  if (settings.provider === 'anthropic') return settings.anthropicApiKey.trim();
  if (settings.provider === 'openai') return settings.openaiApiKey.trim();
  return '';
}

function scrub(text: string, settings: Settings): string {
  const key = activeKey(settings);
  return key ? text.split(key).join('***') : text;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await response.text();
  if (!response.ok) throw new HttpError(response.status, text.slice(0, 600));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SyntaxError('接口没有返回 JSON');
  }
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('');
}

function openAiText(data: unknown): string {
  if (!data || typeof data !== 'object') throw new Error('响应为空');
  const choices = (data as { choices?: unknown }).choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message =
    first && typeof first === 'object' ? (first as { message?: { content?: unknown } }).message : undefined;
  const text = messageText(message?.content);
  if (!text.trim()) throw new Error('响应里没有文本内容');
  return text;
}

function anthropicText(data: unknown): string {
  if (!data || typeof data !== 'object') throw new Error('响应为空');
  const text = messageText((data as { content?: unknown }).content);
  if (!text.trim()) throw new Error('响应里没有文本内容');
  return text;
}

function describeError(error: unknown, settings: Settings): string {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return '请求超过 30 秒还没有返回。检查接口地址，或确认 Ollama 已经启动。';
  }
  if (error instanceof HttpError) {
    if (error.status === 401 || error.status === 403) return '密钥被拒绝。请核对 API Key，或确认这个接口是否需要密钥。';
    if (error.status === 404) return '接口返回 404。OpenAI 兼容地址通常要以 /v1 结尾，模型名也要和供应商一致。';
    const snippet = scrub(error.body, settings).replace(/\s+/g, ' ').slice(0, 180);
    return snippet ? `服务返回 HTTP ${error.status}：${snippet}` : `服务返回 HTTP ${error.status}。`;
  }
  if (error instanceof SyntaxError) {
    return '模型返回的内容不是约定的 JSON（需要 summary、steps、risk）。可以再分析一次，或换一个更遵循格式的模型。';
  }
  if (error instanceof Error) {
    const message = scrub(error.message, settings);
    if (/缺少 summary|缺少 steps|缺少 risk|JSON|Unexpected token/i.test(message)) {
      return '模型返回的内容不是约定的 JSON（需要 summary、steps、risk，以及可选的 alternatives 和 uncertainty）。';
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network|getaddrinfo/i.test(message)) {
      return '连不上这个接口。如果用的是 Ollama，请确认 ollama serve 已启动，地址是 http://127.0.0.1:11434/v1 。';
    }
    return message || '模型调用失败。';
  }
  return '模型调用失败。';
}

async function openAiComplete(settings: Settings, user: string, jsonMode: boolean, tokenField: 'max_tokens' | 'max_completion_tokens'): Promise<string> {
  const baseUrl = settings.provider === 'ollama' ? settings.ollamaBaseUrl : settings.openaiBaseUrl;
  const model = settings.provider === 'ollama' ? settings.ollamaModel : settings.openaiModel;
  const apiKey = settings.provider === 'openai' ? settings.openaiApiKey.trim() : '';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    stream: false,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: user }
    ]
  };
  body[tokenField] = 800;
  if (jsonMode) body.response_format = { type: 'json_object' };
  try {
    const data = await postJson(joinUrl(baseUrl, 'chat/completions'), body, headers);
    return openAiText(data);
  } catch (error) {
    if (error instanceof HttpError && error.status === 400) {
      const blob = error.body.toLowerCase();
      if (jsonMode && (blob.includes('response_format') || blob.includes('json_object'))) {
        return openAiComplete(settings, user, false, tokenField);
      }
      if (tokenField === 'max_tokens' && blob.includes('max_tokens')) {
        return openAiComplete(settings, user, jsonMode, 'max_completion_tokens');
      }
    }
    throw error;
  }
}

async function anthropicComplete(settings: Settings, user: string): Promise<string> {
  const data = await postJson(
    anthropicUrl(settings.anthropicBaseUrl),
    {
      model: settings.anthropicModel,
      max_tokens: 800,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: user }]
    },
    {
      'content-type': 'application/json',
      'x-api-key': settings.anthropicApiKey.trim(),
      'anthropic-version': '2023-06-01'
    }
  );
  return anthropicText(data);
}

let cardCache: { cards: CatalogCard[]; source: CardSourceInfo } | null = null;

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function loadCards(): { cards: CatalogCard[]; source: CardSourceInfo } {
  if (cardCache) return cardCache;
  const candidates = [
    path.join(__dirname, '../renderer/cards/catalog.json'),
    path.join(process.cwd(), 'src/renderer/public/cards/catalog.json'),
    path.join(process.cwd(), 'apps/desktop/src/renderer/public/cards/catalog.json')
  ];
  const catalogFile = candidates.find((file) => fs.existsSync(file));
  const cards = catalogFile ? (readJson(catalogFile) as CatalogCard[]) : [];
  const sourceFile = catalogFile ? path.join(path.dirname(catalogFile), 'source.json') : '';
  const meta = sourceFile && fs.existsSync(sourceFile) ? (readJson(sourceFile) as { provider?: string; refreshedAt?: string; count?: number }) : {};
  cardCache = {
    cards,
    source: {
      provider: meta.provider ?? '未加载',
      refreshedAt: meta.refreshedAt ?? null,
      count: meta.count ?? cards.length
    }
  };
  return cardCache;
}

export async function requestAdvice(settings: Settings, board: BoardSnapshot): Promise<Advice> {
  const { cards, source } = loadCards();
  const offline = !isConfigured(settings) || process.env.HS_COACH_MOCK_LLM === '1';
  if (offline) {
    const advice = adviseOffline(board, cards, source);
    if (!isConfigured(settings) && process.env.HS_COACH_MOCK_LLM !== '1') {
      advice.detail = `${advice.detail ?? ''} 配置接口后，模型也只能引用这些合法动作。`.trim();
    }
    return advice;
  }
  const payload = JSON.stringify(buildAnalysisPayload(board, cards, source));
  try {
    const text =
      settings.provider === 'anthropic'
        ? await anthropicComplete(settings, payload)
        : await openAiComplete(settings, payload, settings.provider === 'openai' && !isLocalBaseUrl(settings.openaiBaseUrl), 'max_tokens');
    const reviewed = reviewModelAdvice(parseAdvice(text), new Set(board.legalActions.map((action) => action.id)));
    reviewed.knowledgeVersion = KNOWLEDGE_VERSION;
    return reviewed;
  } catch (error) {
    return fallbackAdvice('模型没有返回可用建议', describeError(error, settings));
  }
}
