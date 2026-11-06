import { fallbackAdvice, parseAdvice, toModelInput, type Advice, type BoardSnapshot } from '@hs-coach/parser';
import type { Settings } from '../shared/types';
import { isConfigured, isLocalBaseUrl } from './config';

const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `你是炉石传说的对局参谋。你只给出建议，绝不代替玩家点击、拖拽或结束回合。
你会收到当前场面 JSON，其中 legal_actions 是目前估计可执行的动作。
只输出一个 JSON 对象，不要使用 Markdown。格式必须是：
{"summary":"一句话结论","steps":[{"actionId":"legal_actions 里的 id，对不上就用 null","text":"这一步做什么"}],"risk":"主要风险"}
要求：
- 使用简体中文。
- steps 最多 4 步，按建议的出手顺序。
- 能对应到 legal_actions 时必须填写 actionId。
- 如果 our_turn 为 false，或 legal_actions 为空，说明为什么现在不该操作。
- 不要编造场面 JSON 里没有的随从、手牌或奥秘。
- 嘲讽只强制攻击，法术和指向性英雄技能不一定要打在嘲讽上。`;

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

function setupGuidance(settings: Settings): string {
  if (settings.provider === 'ollama') {
    return 'Ollama 不需要密钥。填写本机地址（默认 http://127.0.0.1:11434/v1）和已经拉取的模型名，然后保存。';
  }
  if (settings.provider === 'anthropic') {
    return '填写 Anthropic 的 API Key 和模型名。密钥只保存在本机用户目录，不会写入仓库。';
  }
  return '填写 OpenAI 兼容接口的地址、密钥和模型名。DeepSeek、本地代理，以及 Codex 风格网关都用这一项。地址一般以 /v1 结尾。指向本机地址时可以不填密钥。';
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
      return '模型返回的内容不是约定的 JSON（需要 summary、steps、risk）。可以再分析一次，或换一个更遵循格式的模型。';
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

function mockAdvice(board: BoardSnapshot): Advice {
  const id = (exact: string) => board.legalActions.find((action) => action.id === exact)?.id ?? null;
  return {
    summary: '先处理嘲讽。火球先别打在有圣盾的石拳上。',
    steps: [
      {
        actionId: id('atk-10-t-30'),
        text: '用水元素攻击银背族长。嘲讽还剩 1 点生命，但已经压住了这一侧的攻击。'
      },
      {
        actionId: id('play-41-t-30'),
        text: '寒冰箭可以补掉银背。火球先留着，石拳的圣盾会白白吃掉这一发。'
      },
      {
        actionId: id('end-turn'),
        text: '奥术智慧先不急。对面的奥秘还没翻开，拆场之前不要打脸。'
      }
    ],
    risk: '银背还活着时，其他攻击都会被嘲讽拦住。奥秘没翻开，直接打英雄可能触发陷阱。',
    fallback: false
  };
}

export async function requestAdvice(settings: Settings, board: BoardSnapshot): Promise<Advice> {
  if (process.env.HS_COACH_MOCK_LLM === '1') return mockAdvice(board);
  if (!isConfigured(settings)) {
    return fallbackAdvice('先接上一个模型', setupGuidance(settings));
  }
  const payload = JSON.stringify(toModelInput(board));
  try {
    const text =
      settings.provider === 'anthropic'
        ? await anthropicComplete(settings, payload)
        : await openAiComplete(settings, payload, settings.provider === 'openai' && !isLocalBaseUrl(settings.openaiBaseUrl), 'max_tokens');
    return parseAdvice(text);
  } catch (error) {
    return fallbackAdvice('模型没有返回可用建议', describeError(error, settings));
  }
}
