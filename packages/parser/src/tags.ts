/** GameTag ids that show up as numbers when a log line is not verbose. */
const TAG_IDS: Record<string, string> = {
  '19': 'STEP',
  '20': 'TURN',
  '23': 'CURRENT_PLAYER',
  '25': 'RESOURCES_USED',
  '26': 'RESOURCES',
  '27': 'HERO_ENTITY',
  '30': 'PLAYER_ID',
  '43': 'EXHAUSTED',
  '44': 'DAMAGE',
  '45': 'HEALTH',
  '47': 'ATK',
  '48': 'COST',
  '49': 'ZONE',
  '50': 'CONTROLLER',
  '176': 'MAXRESOURCES',
  '187': 'DURABILITY',
  '189': 'WINDFURY',
  '190': 'TAUNT',
  '191': 'STEALTH',
  '194': 'DIVINE_SHIELD',
  '197': 'CHARGE',
  '199': 'CLASS',
  '202': 'CARDTYPE',
  '240': 'IMMUNE',
  '260': 'FROZEN',
  '263': 'ZONE_POSITION',
  '272': 'NUM_TURNS_IN_PLAY',
  '292': 'ARMOR',
  '295': 'TEMP_RESOURCES',
  '297': 'NUM_ATTACKS_THIS_TURN',
  '311': 'CANT_ATTACK',
  '406': 'HEROPOWER_ACTIVATIONS_THIS_TURN',
  '791': 'RUSH'
};

const ZONE_VALUES: Record<string, string> = {
  '1': 'PLAY',
  '2': 'DECK',
  '3': 'HAND',
  '4': 'GRAVEYARD',
  '5': 'REMOVEDFROMGAME',
  '6': 'SETASIDE',
  '7': 'SECRET'
};

const CARDTYPE_VALUES: Record<string, string> = {
  '3': 'HERO',
  '4': 'MINION',
  '5': 'SPELL',
  '6': 'ENCHANTMENT',
  '7': 'WEAPON',
  '10': 'HERO_POWER',
  '39': 'LOCATION'
};

const STEP_VALUES: Record<string, string> = {
  '4': 'BEGIN_MULLIGAN',
  '8': 'MAIN_DRAW',
  '9': 'MAIN_START',
  '10': 'MAIN_ACTION',
  '12': 'MAIN_END',
  '15': 'FINAL_GAMEOVER'
};

const CLASS_VALUES: Record<string, string> = {
  '1': 'DEATHKNIGHT',
  '2': 'DRUID',
  '3': 'HUNTER',
  '4': 'MAGE',
  '5': 'PALADIN',
  '6': 'PRIEST',
  '7': 'ROGUE',
  '8': 'SHAMAN',
  '9': 'WARLOCK',
  '10': 'WARRIOR',
  '14': 'DEMONHUNTER'
};

export function normalizeTag(tag: string): string {
  return TAG_IDS[tag] ?? tag;
}

export function normalizeValue(tag: string, value: string): string {
  if (tag === 'ZONE') return ZONE_VALUES[value] ?? value;
  if (tag === 'CARDTYPE') return CARDTYPE_VALUES[value] ?? value;
  if (tag === 'STEP') return STEP_VALUES[value] ?? value;
  if (tag === 'CLASS') return CLASS_VALUES[value] ?? value;
  return value;
}

export function tagNum(entity: { tags: Record<string, string> }, name: string): number {
  const raw = entity.tags[name];
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function hasTag(entity: { tags: Record<string, string> }, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(entity.tags, name) && entity.tags[name] !== '';
}

export function tagOn(entity: { tags: Record<string, string> }, name: string): boolean {
  return entity.tags[name] === '1';
}
