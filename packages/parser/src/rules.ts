import manifest from '../knowledge/manifest.json';
import type { BoardSnapshot, PositionAssessment } from './types.js';

export const KNOWLEDGE_VERSION = manifest.version;
export const RULES_MANIFEST = manifest;

type RulesBoard = Omit<BoardSnapshot, 'assessment'>;

function hpRemaining(board: RulesBoard): number | null {
  if (board.opponent.health == null) return null;
  return board.opponent.health + board.opponent.armor;
}

export function assessPosition(board: RulesBoard): PositionAssessment {
  const warnings: string[] = [];
  if (!board.inGame) warnings.push('没有进行中的对局。');
  if (board.inGame && !board.ourTurn) warnings.push('现在不是我方回合，没有列出我方动作。');
  if (board.mana.available == null && board.inGame && board.ourTurn) warnings.push('法力标签缺失，不能判断哪些牌打得起。');
  const unknownCost = board.hand.filter((card) => card.cost == null);
  if (unknownCost.length > 0) warnings.push(`${unknownCost.length} 张手牌没有费用标签，未当成 0 费。`);
  const unknownAttack = board.board.filter((minion) => minion.attackAvailability === 'unknown');
  if (unknownAttack.length > 0) warnings.push(`${unknownAttack.map((minion) => minion.name).join('、')} 的攻击次数或召唤状态不完整，未记为可攻击。`);
  if (board.board.length >= 7) warnings.push('我方场面已有 7 个随从，不能再打出随从。');
  if (board.opponentHandCount > 0) warnings.push(`对手手牌只知道 ${board.opponentHandCount} 张，不知道是什么牌。`);
  if (board.secrets.opponent > 0) warnings.push(`对手有 ${board.secrets.opponent} 个奥秘，效果没有模拟。`);
  if (board.hero.heroPower && board.hero.heroPower.cost == null) warnings.push('英雄技能费用未知，未列入动作。');

  const lethal = faceCheck(board);
  return {
    knowledgeVersion: KNOWLEDGE_VERSION,
    warnings: warnings.slice(0, 8),
    lethal
  };
}

function faceCheck(board: RulesBoard): PositionAssessment['lethal'] {
  const scope = '这不是完整斩杀：不计法术、英雄技能、亡语和光环。';
  if (!board.inGame || !board.ourTurn) {
    return { status: 'unknown', faceDamage: null, detail: `当前不能为我方计算斩杀。${scope}` };
  }
  if (board.board.some((minion) => minion.attackAvailability === 'unknown') || board.hero.attack == null) {
    return { status: 'unknown', faceDamage: null, detail: `有攻击力或攻击次数未知，不能判断打脸伤害。${scope}` };
  }
  const remaining = hpRemaining(board);
  if (remaining == null) {
    return { status: 'unknown', faceDamage: null, detail: `对手英雄生命未知。${scope}` };
  }
  const tauntWall = board.opponentBoard.some((minion) => minion.taunt && !minion.stealth && !minion.immune && minion.health !== 0);
  let face = 0;
  if (!tauntWall && !board.opponent.immune) {
    for (const minion of board.board) {
      if (minion.canAttack && !minion.rushBlocksFace) face += minion.attack ?? 0;
    }
    if (board.legalActions.some((action) => action.type === 'attack' && action.id.startsWith(`atk-${board.hero.entityId}-`))) {
      face += board.hero.attack ?? 0;
    }
  }
  if (board.secrets.opponent > 0) {
    return {
      status: 'unknown',
      faceDamage: tauntWall ? 0 : face,
      detail: `纸面上可打脸的攻击力是 ${tauntWall ? 0 : face}，对手还剩 ${remaining}。奥秘未模拟，不能判定斩杀。${scope}`
    };
  }
  if (tauntWall) {
    return { status: 'no', faceDamage: 0, detail: `有嘲讽，当前攻击打不到英雄。${scope}` };
  }
  if (face >= remaining && face > 0) {
    return { status: 'yes', faceDamage: face, detail: `可打脸攻击力 ${face}，不少于对手的 ${remaining}。${scope}` };
  }
  return { status: 'no', faceDamage: face, detail: `可打脸攻击力 ${face}，少于对手的 ${remaining}。${scope}` };
}
