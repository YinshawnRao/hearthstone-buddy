import { TARGETED_SPELLS } from './cards.js';
import type { BoardSnapshot, HeroView, LegalAction, MinionView } from './types.js';

export const BOARD_LIMIT = 7;

type RulesBoard = Omit<BoardSnapshot, 'assessment'>;

export interface ActionContext {
  rushOnly: Set<number>;
  heroCanAttack: boolean;
}

function livingMinions(board: RulesBoard): MinionView[] {
  return board.opponentBoard.filter(
    (minion) => !minion.stealth && !minion.immune && (minion.health == null || minion.health > 0)
  );
}

/** Taunt only forces attacks. Spells and targeted hero powers can still pick other characters. */
function attackTargets(board: RulesBoard, allowFace: boolean): { id: number; name: string }[] {
  const living = livingMinions(board);
  const taunts = living.filter((minion) => minion.taunt);
  const pool = taunts.length > 0 ? taunts : living;
  const list = pool.map((minion) => ({ id: minion.entityId, name: minion.name }));
  const faceBlocked = taunts.length > 0 || board.opponent.immune;
  if (allowFace && !faceBlocked && board.opponent.entityId) {
    list.push({ id: board.opponent.entityId, name: board.opponent.name });
  }
  return list;
}

function spellTargets(board: RulesBoard): { id: number; name: string }[] {
  const list = livingMinions(board).map((minion) => ({ id: minion.entityId, name: minion.name }));
  if (!board.opponent.immune && board.opponent.entityId) {
    list.push({ id: board.opponent.entityId, name: board.opponent.name });
  }
  return list;
}

function attackActions(attackerId: number, attackerName: string, board: RulesBoard, allowFace: boolean): LegalAction[] {
  return attackTargets(board, allowFace).map((target) => ({
    id: `atk-${attackerId}-t-${target.id}`,
    type: 'attack' as const,
    label: `攻击 ${attackerName} → ${target.name}`
  }));
}

function heroPowerActions(board: RulesBoard, hero: HeroView): LegalAction[] {
  const power = hero.heroPower;
  if (!power?.available) return [];
  if (power.cost == null || board.mana.available == null || power.cost > board.mana.available) return [];
  if (!power.targeted) {
    return [{ id: 'hp', type: 'hero_power', label: `英雄技能 ${power.name}` }];
  }
  return spellTargets(board).map((target) => ({
    id: `hp-t-${target.id}`,
    type: 'hero_power' as const,
    label: `英雄技能 ${power.name} → ${target.name}`
  }));
}

export function legalActions(board: RulesBoard, ctx: ActionContext): LegalAction[] {
  const actions: LegalAction[] = [];
  const boardFull = board.board.length >= BOARD_LIMIT;

  for (const card of board.hand) {
    if (!card.playable) continue;
    if (card.cardType === 'minion' && boardFull) continue;
    const targeted = card.cardType === 'spell' && card.cardId != null && TARGETED_SPELLS.has(card.cardId);
    if (!targeted) {
      actions.push({
        id: `play-${card.entityId}`,
        type: 'play_card',
        label: `打出 ${card.name}`
      });
      continue;
    }
    for (const target of spellTargets(board)) {
      actions.push({
        id: `play-${card.entityId}-t-${target.id}`,
        type: 'play_card',
        label: `打出 ${card.name} → ${target.name}`
      });
    }
  }

  for (const minion of board.board) {
    if (!minion.canAttack) continue;
    const allowFace = !ctx.rushOnly.has(minion.entityId);
    actions.push(...attackActions(minion.entityId, minion.name, board, allowFace));
  }

  if (ctx.heroCanAttack) {
    actions.push(...attackActions(board.hero.entityId, board.hero.name, board, true));
  }

  actions.push(...heroPowerActions(board, board.hero));
  actions.push({ id: 'end-turn', type: 'end_turn', label: '结束回合' });
  return actions;
}
