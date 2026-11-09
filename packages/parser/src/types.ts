export type ActionType = 'play_card' | 'attack' | 'hero_power' | 'end_turn';

export interface LegalAction {
  id: string;
  type: ActionType;
  label: string;
}

export interface HeroPowerView {
  name: string;
  cardId?: string;
  /** Null when the log did not include COST. That is unknown, not zero. */
  cost: number | null;
  available: boolean;
  targeted: boolean;
}

export interface WeaponView {
  name: string;
  attack: number;
  durability: number;
}

export interface HeroView {
  entityId: number;
  name: string;
  cardId?: string;
  className: string;
  health: number | null;
  armor: number;
  attack: number | null;
  frozen: boolean;
  immune: boolean;
  heroPower: HeroPowerView | null;
  weapon: WeaponView | null;
}

export interface MinionView {
  entityId: number;
  name: string;
  cardId?: string;
  attack: number | null;
  health: number | null;
  maxHealth: number | null;
  keywords: string[];
  taunt: boolean;
  divineShield: boolean;
  stealth: boolean;
  frozen: boolean;
  immune: boolean;
  rush: boolean;
  charge: boolean;
  windfury: boolean;
  /** True only when attack count and summoning state are both known and allow an attack. */
  canAttack: boolean;
  attackAvailability: 'yes' | 'no' | 'unknown';
  /** Rush on the turn it was played, so it cannot attack the hero. */
  rushBlocksFace: boolean;
  zonePosition: number;
}

export type HandCardType = 'minion' | 'spell' | 'weapon' | 'other';

export interface CardView {
  entityId: number;
  name: string;
  cardId?: string;
  cost: number | null;
  cardType: HandCardType;
  attack?: number | null;
  health?: number | null;
  playable: boolean;
  unplayableReason?: string;
}

export interface BoardSnapshot {
  source: 'log' | 'demo' | 'empty';
  inGame: boolean;
  turn: number;
  step: string;
  stepLabel: string;
  ourTurn: boolean;
  mana: { available: number | null; max: number | null; used: number | null };
  opponentMana: { available: number | null; max: number | null };
  hero: HeroView;
  opponent: HeroView;
  board: MinionView[];
  opponentBoard: MinionView[];
  hand: CardView[];
  opponentHandCount: number;
  secrets: { friendly: number; opponent: number };
  legalActions: LegalAction[];
  /** What the local rules actually checked. Not a full game engine. */
  assessment: PositionAssessment;
  note?: string;
}

export interface PositionAssessment {
  knowledgeVersion: string;
  warnings: string[];
  lethal: {
    status: 'yes' | 'no' | 'unknown';
    /** Null when attack stats are missing. Zero means we know face damage is blocked or absent. */
    faceDamage: number | null;
    detail: string;
  };
}

export interface AdviceStep {
  actionId: string | null;
  text: string;
  illegal?: boolean;
}

export interface Advice {
  summary: string;
  steps: AdviceStep[];
  alternatives?: AdviceStep[];
  uncertainty?: string;
  risk: string;
  fallback: boolean;
  detail?: string;
  warnings?: string[];
  knowledgeVersion?: string;
  source?: 'offline' | 'model';
}

export interface RawEntity {
  id: number;
  cardId?: string;
  name?: string;
  tags: Record<string, string>;
}

export interface RawGame {
  entities: RawEntity[];
  gameEntityId: number;
  localPlayerEntityId: number | null;
}
