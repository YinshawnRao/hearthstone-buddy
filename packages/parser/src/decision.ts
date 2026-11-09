import general from '../knowledge/general.json';
import supplements from '../knowledge/supplements.json';
import { RULES_MANIFEST } from './rules.js';
import type { Advice, AdviceStep, BoardSnapshot, CardView, LegalAction, MinionView } from './types.js';

export interface CatalogCard {
  id: string;
  dbfId?: number | null;
  name?: string;
  cost?: number | null;
  attack?: number | null;
  health?: number | null;
  type?: string | null;
  text?: string;
  mechanics?: string[];
  rarity?: string | null;
  set?: string | null;
  collectible?: boolean;
}

export interface CardSourceInfo {
  provider: string;
  refreshedAt: string | null;
  count: number;
}

export interface PrintedCard {
  id: string;
  dbfId: number | null;
  name: string;
  cost: number | null;
  attack: number | null;
  health: number | null;
  type: string | null;
  text: string;
  mechanics: string[];
  collectible: boolean;
}

export interface ComparedCard {
  entityId: number;
  cardId: string | null;
  name: string;
  missingMetadata: boolean;
  printed: PrintedCard | null;
  runtime: { cost: number | null; attack: number | null; health: number | null };
  costModified: boolean | null;
  attackModified: boolean | null;
  healthModified: boolean | null;
}

export interface AnalysisPayload {
  knowledge: {
    id: string;
    version: string;
    updated: string;
    card_source: CardSourceInfo;
    heuristics: typeof general.principles;
    heuristics_note: string;
    archetype: { id: string; principles: typeof general.principles } | null;
    supported: string[];
    not_simulated: string[];
  };
  hidden: {
    opponent_hand_cards: null;
    opponent_hand_count: number;
    opponent_secret_ids: null;
    opponent_secret_count: number;
    future_draws: null;
  };
  warnings: string[];
  lethal_check: BoardSnapshot['assessment']['lethal'];
  our_turn: boolean;
  mana: BoardSnapshot['mana'];
  hero: ReturnType<typeof publicHero>;
  opponent_hero: ReturnType<typeof publicHero>;
  board: ComparedCard[];
  opponent_board: ComparedCard[];
  hand: ComparedCard[];
  legal_actions: LegalAction[];
}

interface ArchetypeFile {
  id?: string;
  principles?: typeof general.principles;
}

export function normalizeCardText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?b>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\$(\d+)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function indexCatalog(cards: CatalogCard[]): Map<string, CatalogCard> {
  const map = new Map<string, CatalogCard>();
  for (const card of supplements.cards) map.set(card.id, card);
  for (const card of cards) map.set(card.id, card);
  return map;
}

function printedFrom(card: CatalogCard): PrintedCard {
  return {
    id: card.id,
    dbfId: card.dbfId ?? null,
    name: card.name ?? card.id,
    cost: card.cost ?? null,
    attack: card.attack ?? null,
    health: card.health ?? null,
    type: card.type ?? null,
    text: normalizeCardText(card.text ?? ''),
    mechanics: card.mechanics ?? [],
    collectible: card.collectible !== false
  };
}

function changed(runtime: number | null, printed: number | null): boolean | null {
  if (runtime == null || printed == null) return null;
  return runtime !== printed;
}

export function compareCard(
  entityId: number,
  cardId: string | undefined,
  fallbackName: string,
  runtime: { cost: number | null; attack: number | null; health: number | null },
  catalog: Map<string, CatalogCard>
): ComparedCard {
  const found = cardId ? catalog.get(cardId) : undefined;
  const printed = found ? printedFrom(found) : null;
  return {
    entityId,
    cardId: cardId ?? null,
    name: printed?.name ?? fallbackName,
    missingMetadata: Boolean(cardId) && !printed,
    printed,
    runtime,
    costModified: changed(runtime.cost, printed?.cost ?? null),
    attackModified: changed(runtime.attack, printed?.attack ?? null),
    healthModified: changed(runtime.health, printed?.health ?? null)
  };
}

function fromMinion(minion: MinionView, catalog: Map<string, CatalogCard>): ComparedCard {
  return compareCard(minion.entityId, minion.cardId, minion.name, { cost: null, attack: minion.attack, health: minion.health }, catalog);
}

function fromHand(card: CardView, catalog: Map<string, CatalogCard>): ComparedCard {
  return compareCard(card.entityId, card.cardId, card.name, { cost: card.cost, attack: card.attack ?? null, health: card.health ?? null }, catalog);
}

function publicHero(hero: BoardSnapshot['hero'], catalog: Map<string, CatalogCard>) {
  return {
    entity_id: hero.entityId,
    name: hero.name,
    class: hero.className,
    health: hero.health,
    armor: hero.armor,
    attack: hero.attack,
    frozen: hero.frozen,
    immune: hero.immune,
    weapon: hero.weapon,
    hero_power: hero.heroPower
      ? {
          ...hero.heroPower,
          card: compareCard(0, hero.heroPower.cardId, hero.heroPower.name, { cost: hero.heroPower.cost, attack: null, health: null }, catalog)
        }
      : null
  };
}

export function loadArchetypePrinciples(id: string | undefined, readFile: (fileId: string) => string | null): ArchetypeFile['principles'] {
  if (!id || !/^[a-z0-9-]+$/i.test(id)) return [];
  const raw = readFile(id);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as ArchetypeFile;
  return Array.isArray(parsed.principles) ? parsed.principles : [];
}

export function buildAnalysisPayload(
  board: BoardSnapshot,
  cards: CatalogCard[],
  source: CardSourceInfo,
  archetype?: { id: string; principles: typeof general.principles }
): AnalysisPayload {
  const catalog = indexCatalog(cards);
  const missing = [...board.hand, ...board.board, ...board.opponentBoard]
    .filter((card) => card.cardId && !catalog.has(card.cardId))
    .map((card) => card.cardId as string);
  const warnings = [...board.assessment.warnings];
  if (source.count === 0) warnings.push('本机没有卡牌目录，卡面文字无法对照。');
  else if (missing.length > 0) warnings.push(`这些卡不在本地目录里：${[...new Set(missing)].slice(0, 6).join('、')}。`);
  return {
    knowledge: {
      id: RULES_MANIFEST.id,
      version: RULES_MANIFEST.version,
      updated: RULES_MANIFEST.updated,
      card_source: source,
      heuristics: general.principles,
      heuristics_note: general.note,
      archetype: archetype && archetype.principles.length > 0 ? archetype : null,
      supported: RULES_MANIFEST.supported,
      not_simulated: RULES_MANIFEST.notSimulated
    },
    hidden: {
      opponent_hand_cards: null,
      opponent_hand_count: board.opponentHandCount,
      opponent_secret_ids: null,
      opponent_secret_count: board.secrets.opponent,
      future_draws: null
    },
    warnings,
    lethal_check: board.assessment.lethal,
    our_turn: board.ourTurn,
    mana: board.mana,
    hero: publicHero(board.hero, catalog),
    opponent_hero: publicHero(board.opponent, catalog),
    board: board.board.map((minion) => fromMinion(minion, catalog)),
    opponent_board: board.opponentBoard.map((minion) => fromMinion(minion, catalog)),
    hand: board.hand.map((card) => fromHand(card, catalog)),
    legal_actions: board.legalActions
  };
}

export function buildSystemPrompt(): string {
  const principles = general.principles.map((item) => `- ${item.title}：${item.text}`).join('\n');
  return `你是炉石传说的对局参谋。你只根据这次输入的 JSON 给建议，不搜索网页，不回忆当前环境或卡组攻略。
规则版本 ${RULES_MANIFEST.version}（${RULES_MANIFEST.updated}）。
已检查的范围：
${RULES_MANIFEST.supported.map((item) => `- ${item}`).join('\n')}
明确没有模拟：
${RULES_MANIFEST.notSimulated.map((item) => `- ${item}`).join('\n')}
通用启发式（可以不遵守）：
${principles}
${general.note}

隐藏信息：opponent_hand_cards、opponent_secret_ids、future_draws 固定为 null。不要编造对手手牌、奥秘或接下来抽到的牌。
runtime 是日志里的当前数值，printed 是卡面印刷值。两者不同代表减费或增益，不要把印刷值写回场面。
legal_actions 是唯一允许引用的动作。actionId 必须来自其中，对不上就用 null，并说明为什么不能执行。
只输出一个 JSON 对象，不要 Markdown，也不要思维链：
{"summary":"一句话","steps":[{"actionId":"legal_actions 的 id","text":"给玩家看的短理由"}],"alternatives":[{"actionId":"id 或 null","text":"另一条可执行的线路"}],"uncertainty":"未知或未模拟的部分","risk":"主要风险"}
steps 最多 3 步。用简体中文。`;
}

function byId(board: BoardSnapshot, id: string | null | undefined): LegalAction | undefined {
  if (!id) return undefined;
  return board.legalActions.find((action) => action.id === id);
}

function attackIntoTaunt(board: BoardSnapshot): LegalAction | undefined {
  const taunts = new Set(board.opponentBoard.filter((minion) => minion.taunt).map((minion) => minion.entityId));
  const attacks = board.legalActions.filter((action) => action.type === 'attack' && taunts.has(Number(action.id.split('-t-')[1])));
  return attacks.sort((a, b) => attackerAttack(board, b.id) - attackerAttack(board, a.id))[0];
}

function attackerAttack(board: BoardSnapshot, actionId: string): number {
  const entityId = Number(actionId.split('-')[1]);
  return board.board.find((minion) => minion.entityId === entityId)?.attack ?? 0;
}

export function adviseOffline(board: BoardSnapshot, cards: CatalogCard[], source: CardSourceInfo): Advice {
  const payload = buildAnalysisPayload(board, cards, source);
  const version = payload.knowledge.version;
  const end = byId(board, 'end-turn');
  if (!board.ourTurn || board.legalActions.length === 0) {
    return {
      summary: board.note ?? '现在没有可以建议的我方动作。',
      steps: [],
      alternatives: [],
      uncertainty: payload.warnings.join(' '),
      risk: '',
      fallback: false,
      warnings: payload.warnings,
      knowledgeVersion: version,
      source: 'offline',
      detail: '未调用模型。这是本地规则检查。'
    };
  }

  const steps: AdviceStep[] = [];
  if (board.assessment.lethal.status === 'yes') {
    const face = board.legalActions.filter((action) => action.type === 'attack' && action.id.endsWith(`-t-${board.opponent.entityId}`));
    for (const action of face.slice(0, 2)) steps.push({ actionId: action.id, text: `${action.label}。本地斩杀检查只算了当前攻击力。` });
  }
  const tauntHit = attackIntoTaunt(board);
  if (steps.length === 0 && tauntHit) {
    steps.push({ actionId: tauntHit.id, text: `${tauntHit.label}。嘲讽还在时，其它攻击打不到英雄。` });
  }
  if (steps.length === 0) {
    const anyAttack = board.legalActions.find((action) => action.type === 'attack');
    if (anyAttack) steps.push({ actionId: anyAttack.id, text: `${anyAttack.label}。这一步用的是场上已经写明的攻击力。` });
  }
  if (end && !steps.some((step) => step.actionId === end.id)) {
    steps.push({ actionId: end.id, text: '如果没有必须立刻打出的牌，结束回合，把未知的法术结算留给以后。' });
  }

  const primary = steps[0]?.actionId;
  const alternative = board.legalActions.find((action) => action.id !== primary && action.type !== 'end_turn');
  return {
    summary: board.assessment.lethal.status === 'yes' ? '本地检查认为当前攻击可以打脸斩杀。' : '先处理已知的场面限制，不猜测没模拟的效果。',
    steps: steps.slice(0, 3),
    alternatives: alternative ? [{ actionId: alternative.id, text: `也可以考虑：${alternative.label}。这不是必须线路。` }] : [],
    uncertainty: payload.warnings.join(' ') || '没有额外的状态缺口。',
    risk: board.secrets.opponent > 0 ? '奥秘效果没有模拟，打脸或攻击都可能被反制。' : board.assessment.lethal.detail,
    fallback: false,
    warnings: payload.warnings,
    knowledgeVersion: version,
    source: 'offline',
    detail: `未调用模型。规则 ${version}，卡牌目录 ${source.count} 张${source.refreshedAt ? `，更新于 ${source.refreshedAt.slice(0, 10)}` : ''}。`
  };
}

export function reviewModelAdvice(advice: Advice, legalIds: ReadonlySet<string>): Advice {
  const warnings = [...(advice.warnings ?? [])];
  const mark = (step: AdviceStep): AdviceStep => {
    if (!step.actionId || legalIds.has(step.actionId)) return { ...step, illegal: false };
    warnings.push(`已拒绝不在合法动作中的 ${step.actionId}。`);
    return {
      ...step,
      illegal: true,
      actionId: null,
      text: `【未通过合法性检查，不要执行】${step.text}`
    };
  };
  const steps = advice.steps.map(mark);
  const alternatives = (advice.alternatives ?? []).map(mark);
  const kept = steps.filter((step) => !step.illegal);
  if (advice.steps.length > 0 && kept.length === 0) {
    return {
      ...advice,
      summary: '模型给的动作都不在当前合法列表里',
      steps: [],
      alternatives,
      fallback: true,
      warnings,
      source: 'model',
      detail: `${warnings.join(' ')} 已丢弃这些步骤。`
    };
  }
  return { ...advice, steps, alternatives, warnings, fallback: false, source: 'model' };
}
