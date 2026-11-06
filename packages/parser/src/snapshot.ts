import { cardName } from './cards.js';
import { tagNum, tagOn } from './tags.js';
import type {
  BoardSnapshot,
  CardView,
  HandCardType,
  HeroView,
  MinionView,
  RawEntity,
  RawGame,
  WeaponView
} from './types.js';
import { legalActions } from './actions.js';

const CLASS_ZH: Record<string, string> = {
  MAGE: '法师',
  HUNTER: '猎人',
  WARRIOR: '战士',
  PALADIN: '圣骑士',
  PRIEST: '牧师',
  ROGUE: '潜行者',
  SHAMAN: '萨满',
  WARLOCK: '术士',
  DRUID: '德鲁伊',
  DEMONHUNTER: '恶魔猎手',
  DEATHKNIGHT: '死亡骑士'
};

const STEP_ZH: Record<string, string> = {
  BEGIN_MULLIGAN: '换牌',
  MAIN_DRAW: '抽牌',
  MAIN_START: '回合开始',
  MAIN_ACTION: '主要阶段',
  MAIN_END: '回合结束',
  FINAL_GAMEOVER: '对局结束'
};

const ACTIONABLE_STEPS = new Set(['MAIN_ACTION', 'MAIN_START']);

function emptyHero(): HeroView {
  return {
    entityId: 0,
    name: '未知英雄',
    className: '未知',
    health: 0,
    armor: 0,
    attack: 0,
    frozen: false,
    immune: false,
    heroPower: null,
    weapon: null
  };
}

export function emptyBoard(): BoardSnapshot {
  return {
    source: 'empty',
    inGame: false,
    turn: 0,
    step: '',
    stepLabel: '未开始',
    ourTurn: false,
    mana: { available: 0, max: 0, used: 0 },
    opponentMana: { available: 0, max: 0 },
    hero: emptyHero(),
    opponent: emptyHero(),
    board: [],
    opponentBoard: [],
    hand: [],
    opponentHandCount: 0,
    secrets: { friendly: 0, opponent: 0 },
    legalActions: [],
    note: '还没有进行中的对局。启动炉石并打一局，或打开演示局面。'
  };
}

function findPlayer(game: RawGame, playerId: number): RawEntity | undefined {
  return game.entities.find(
    (entity) => entity.tags.CARDTYPE === 'PLAYER' && entity.tags.PLAYER_ID === String(playerId)
  );
}

function friendlyPlayerId(game: RawGame): number {
  if (game.localPlayerEntityId != null) {
    const local = game.entities.find((entity) => entity.id === game.localPlayerEntityId);
    if (local?.tags.PLAYER_ID) return Number(local.tags.PLAYER_ID);
  }
  const revealed = new Map<number, number>();
  for (const entity of game.entities) {
    if (entity.tags.ZONE === 'HAND' && entity.cardId) {
      const controller = Number(entity.tags.CONTROLLER || 0);
      if (controller) revealed.set(controller, (revealed.get(controller) ?? 0) + 1);
    }
  }
  let best = 1;
  let count = -1;
  for (const [controller, n] of revealed) {
    if (n > count) {
      count = n;
      best = controller;
    }
  }
  return best;
}

function findHero(game: RawGame, playerId: number, player: RawEntity | undefined): RawEntity | undefined {
  const heroId = player ? tagNum(player, 'HERO_ENTITY') : 0;
  if (heroId) return game.entities.find((entity) => entity.id === heroId);
  return game.entities.find(
    (entity) =>
      entity.tags.CARDTYPE === 'HERO' &&
      entity.tags.ZONE === 'PLAY' &&
      entity.tags.CONTROLLER === String(playerId)
  );
}

function manaOf(player: RawEntity | undefined): { available: number; max: number; used: number } {
  if (!player) return { available: 0, max: 0, used: 0 };
  const max = tagNum(player, 'RESOURCES');
  const used = tagNum(player, 'RESOURCES_USED');
  const temp = tagNum(player, 'TEMP_RESOURCES');
  return { available: Math.max(0, max + temp - used), max, used };
}

function keywordsOf(entity: RawEntity): string[] {
  const labels: [string, string][] = [
    ['TAUNT', '嘲讽'],
    ['DIVINE_SHIELD', '圣盾'],
    ['STEALTH', '潜行'],
    ['FROZEN', '冻结'],
    ['CHARGE', '冲锋'],
    ['RUSH', '突袭'],
    ['WINDFURY', '风怒'],
    ['POISONOUS', '剧毒'],
    ['LIFESTEAL', '吸血'],
    ['REBORN', '复生']
  ];
  return labels.filter(([tag]) => tagOn(entity, tag)).map(([, label]) => label);
}

function canMinionAttack(entity: RawEntity, actionable: boolean): boolean {
  if (!actionable) return false;
  if (tagOn(entity, 'FROZEN') || tagOn(entity, 'CANT_ATTACK') || tagOn(entity, 'DORMANT')) return false;
  if (tagNum(entity, 'ATK') <= 0) return false;
  const used = tagNum(entity, 'NUM_ATTACKS_THIS_TURN');
  const limit = tagOn(entity, 'MEGA_WINDFURY') ? 4 : tagOn(entity, 'WINDFURY') ? 2 : 1;
  if (used >= limit) return false;
  const summoningSickness = tagOn(entity, 'EXHAUSTED') && used === 0;
  if (summoningSickness && !tagOn(entity, 'CHARGE') && !tagOn(entity, 'RUSH')) return false;
  return true;
}

function toMinion(entity: RawEntity, actionable: boolean): MinionView {
  const maxHealth = tagNum(entity, 'HEALTH');
  return {
    entityId: entity.id,
    name: cardName(entity.cardId, entity.name),
    cardId: entity.cardId,
    attack: tagNum(entity, 'ATK'),
    health: Math.max(0, maxHealth - tagNum(entity, 'DAMAGE')),
    maxHealth,
    keywords: keywordsOf(entity),
    taunt: tagOn(entity, 'TAUNT'),
    divineShield: tagOn(entity, 'DIVINE_SHIELD'),
    stealth: tagOn(entity, 'STEALTH'),
    frozen: tagOn(entity, 'FROZEN'),
    immune: tagOn(entity, 'IMMUNE'),
    rush: tagOn(entity, 'RUSH'),
    charge: tagOn(entity, 'CHARGE'),
    windfury: tagOn(entity, 'WINDFURY'),
    canAttack: canMinionAttack(entity, actionable),
    zonePosition: tagNum(entity, 'ZONE_POSITION')
  };
}

function cardTypeOf(entity: RawEntity): HandCardType {
  if (entity.tags.CARDTYPE === 'MINION') return 'minion';
  if (entity.tags.CARDTYPE === 'SPELL') return 'spell';
  if (entity.tags.CARDTYPE === 'WEAPON') return 'weapon';
  return 'other';
}

function toHero(
  entity: RawEntity | undefined,
  power: RawEntity | undefined,
  weapon: RawEntity | undefined,
  actionable: boolean
): HeroView {
  if (!entity) return emptyHero();
  const classKey = entity.tags.CLASS ?? '';
  const maxHealth = tagNum(entity, 'HEALTH');
  const attack = tagNum(entity, 'ATK');

  let heroPower: HeroView['heroPower'] = null;
  if (power) {
    const cost = power.tags.COST != null ? tagNum(power, 'COST') : 2;
    const usedUp = tagOn(power, 'EXHAUSTED') || tagNum(power, 'HEROPOWER_ACTIVATIONS_THIS_TURN') >= 1;
    heroPower = {
      name: cardName(power.cardId, '英雄技能'),
      cost,
      available: actionable && !usedUp,
      targeted: classKey === 'MAGE' || classKey === 'PRIEST'
    };
  }

  let weaponView: WeaponView | null = null;
  if (weapon) {
    const durabilityTag = weapon.tags.DURABILITY;
    const durability =
      durabilityTag != null
        ? Math.max(0, tagNum(weapon, 'DURABILITY') - tagNum(weapon, 'DAMAGE'))
        : Math.max(0, tagNum(weapon, 'HEALTH') - tagNum(weapon, 'DAMAGE'));
    weaponView = {
      name: cardName(weapon.cardId, weapon.name),
      attack: tagNum(weapon, 'ATK'),
      durability
    };
  }

  return {
    entityId: entity.id,
    name: cardName(entity.cardId, entity.name),
    cardId: entity.cardId,
    className: CLASS_ZH[classKey] ?? (classKey || '未知'),
    health: Math.max(0, maxHealth - tagNum(entity, 'DAMAGE')),
    armor: tagNum(entity, 'ARMOR'),
    attack,
    frozen: tagOn(entity, 'FROZEN'),
    immune: tagOn(entity, 'IMMUNE'),
    heroPower,
    weapon: weaponView
  };
}

function sideEntities(game: RawGame, playerId: number, cardType: string, zone: string): RawEntity[] {
  return game.entities.filter(
    (entity) =>
      entity.tags.CARDTYPE === cardType &&
      entity.tags.ZONE === zone &&
      entity.tags.CONTROLLER === String(playerId)
  );
}

export function snapshotFromRaw(game: RawGame, source: BoardSnapshot['source']): BoardSnapshot {
  const gameEntity = game.entities.find((entity) => entity.id === game.gameEntityId);
  const turn = gameEntity ? tagNum(gameEntity, 'TURN') : 0;
  const step = gameEntity?.tags.STEP ?? '';
  const friendly = friendlyPlayerId(game);
  const opponent = friendly === 1 ? 2 : 1;
  const currentRaw = gameEntity?.tags.CURRENT_PLAYER;
  const ourTurn = currentRaw ? Number(currentRaw) === friendly : step === 'MAIN_ACTION';
  const actionable = ourTurn && (step === '' || ACTIONABLE_STEPS.has(step));

  const friendlyPlayer = findPlayer(game, friendly);
  const opponentPlayer = findPlayer(game, opponent);
  const heroEnt = findHero(game, friendly, friendlyPlayer);
  const oppHeroEnt = findHero(game, opponent, opponentPlayer);
  const heroPower = sideEntities(game, friendly, 'HERO_POWER', 'PLAY')[0];
  const weapon = sideEntities(game, friendly, 'WEAPON', 'PLAY')[0];
  const oppPower = sideEntities(game, opponent, 'HERO_POWER', 'PLAY')[0];

  const board = sideEntities(game, friendly, 'MINION', 'PLAY')
    .map((entity) => toMinion(entity, actionable))
    .sort((a, b) => a.zonePosition - b.zonePosition);
  const opponentBoard = sideEntities(game, opponent, 'MINION', 'PLAY')
    .map((entity) => toMinion(entity, false))
    .sort((a, b) => a.zonePosition - b.zonePosition);

  const mana = manaOf(friendlyPlayer);
  const opponentManaFull = manaOf(opponentPlayer);

  const hand: CardView[] = game.entities
    .filter((entity) => entity.tags.ZONE === 'HAND' && entity.tags.CONTROLLER === String(friendly))
    .map((entity) => {
      const cost = entity.tags.COST != null ? tagNum(entity, 'COST') : null;
      const type = cardTypeOf(entity);
      const view: CardView = {
        entityId: entity.id,
        name: cardName(entity.cardId, entity.name),
        cardId: entity.cardId,
        cost,
        cardType: type,
        playable: actionable && cost != null && cost <= mana.available
      };
      if (type === 'minion') {
        view.attack = tagNum(entity, 'ATK');
        view.health = Math.max(0, tagNum(entity, 'HEALTH') - tagNum(entity, 'DAMAGE'));
      }
      return view;
    })
    .sort((a, b) => a.entityId - b.entityId);

  const opponentHandCount = game.entities.filter(
    (entity) => entity.tags.ZONE === 'HAND' && entity.tags.CONTROLLER === String(opponent)
  ).length;

  const secrets = {
    friendly: game.entities.filter(
      (entity) => entity.tags.ZONE === 'SECRET' && entity.tags.CONTROLLER === String(friendly)
    ).length,
    opponent: game.entities.filter(
      (entity) => entity.tags.ZONE === 'SECRET' && entity.tags.CONTROLLER === String(opponent)
    ).length
  };

  const hero = toHero(heroEnt, heroPower, weapon, actionable);
  const opponentHero = toHero(oppHeroEnt, oppPower, undefined, false);
  const inGame = Boolean(heroEnt || oppHeroEnt || turn > 0);

  let note: string | undefined;
  if (!inGame) note = '还没有进行中的对局。启动炉石并打一局，或打开演示局面。';
  else if (!ourTurn) note = '现在是对手的回合。';
  else if (!actionable) note = `当前是${STEP_ZH[step] ?? step}，进入主要阶段后才会列出可执行动作。`;

  const rushOnly = new Set(
    game.entities
      .filter(
        (entity) =>
          entity.tags.CONTROLLER === String(friendly) &&
          tagOn(entity, 'RUSH') &&
          !tagOn(entity, 'CHARGE') &&
          tagNum(entity, 'NUM_TURNS_IN_PLAY') === 0
      )
      .map((entity) => entity.id)
  );

  const heroCanAttack =
    actionable &&
    hero.attack > 0 &&
    !hero.frozen &&
    heroEnt != null &&
    tagNum(heroEnt, 'NUM_ATTACKS_THIS_TURN') < (tagOn(heroEnt, 'WINDFURY') ? 2 : 1) &&
    !(tagOn(heroEnt, 'EXHAUSTED') && tagNum(heroEnt, 'NUM_ATTACKS_THIS_TURN') === 0);

  const draft: BoardSnapshot = {
    source,
    inGame,
    turn,
    step,
    stepLabel: STEP_ZH[step] ?? (step || '未知阶段'),
    ourTurn,
    mana,
    opponentMana: { available: opponentManaFull.available, max: opponentManaFull.max },
    hero,
    opponent: opponentHero,
    board,
    opponentBoard,
    hand,
    opponentHandCount,
    secrets,
    legalActions: [],
    note
  };

  if (actionable && inGame) {
    draft.legalActions = legalActions(draft, { rushOnly, heroCanAttack });
    draft.note = undefined;
  }

  return draft;
}

export function boardKey(board: BoardSnapshot): string {
  return JSON.stringify({
    turn: board.turn,
    step: board.step,
    mana: board.mana.available,
    hero: [board.hero.health, board.hero.armor, board.hero.attack],
    opponent: [board.opponent.health, board.opponent.armor],
    board: board.board.map((minion) => [minion.entityId, minion.attack, minion.health, minion.canAttack]),
    opp: board.opponentBoard.map((minion) => [minion.entityId, minion.attack, minion.health, minion.taunt]),
    hand: board.hand.map((card) => [card.entityId, card.cost, card.playable]),
    actions: board.legalActions.map((action) => action.id)
  });
}

export function toModelInput(board: BoardSnapshot): unknown {
  const hero = (view: HeroView) => ({
    name: view.name,
    class: view.className,
    health: view.health,
    armor: view.armor,
    attack: view.attack,
    frozen: view.frozen,
    hero_power: view.heroPower,
    weapon: view.weapon
  });
  const minion = (view: MinionView) => ({
    id: view.entityId,
    name: view.name,
    attack: view.attack,
    health: view.health,
    keywords: view.keywords,
    can_attack: view.canAttack
  });
  return {
    turn: board.turn,
    step: board.stepLabel,
    our_turn: board.ourTurn,
    mana: board.mana,
    opponent_mana: board.opponentMana,
    hero: hero(board.hero),
    opponent: hero(board.opponent),
    board: board.board.map(minion),
    opponent_board: board.opponentBoard.map(minion),
    hand: board.hand.map((card) => ({
      id: card.entityId,
      name: card.name,
      cost: card.cost,
      type: card.cardType,
      playable: card.playable
    })),
    opponent_hand_count: board.opponentHandCount,
    secrets: board.secrets,
    note: board.note ?? null,
    legal_actions: board.legalActions
  };
}
