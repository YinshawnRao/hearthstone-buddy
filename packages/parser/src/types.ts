export type ActionType = 'play_card' | 'attack' | 'hero_power' | 'end_turn';

export interface LegalAction {
  id: string;
  type: ActionType;
  label: string;
}

export interface HeroPowerView {
  name: string;
  cost: number;
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
  health: number;
  armor: number;
  attack: number;
  frozen: boolean;
  immune: boolean;
  heroPower: HeroPowerView | null;
  weapon: WeaponView | null;
}

export interface MinionView {
  entityId: number;
  name: string;
  cardId?: string;
  attack: number;
  health: number;
  maxHealth: number;
  keywords: string[];
  taunt: boolean;
  divineShield: boolean;
  stealth: boolean;
  frozen: boolean;
  immune: boolean;
  rush: boolean;
  charge: boolean;
  windfury: boolean;
  canAttack: boolean;
  zonePosition: number;
}

export type HandCardType = 'minion' | 'spell' | 'weapon' | 'other';

export interface CardView {
  entityId: number;
  name: string;
  cardId?: string;
  cost: number | null;
  cardType: HandCardType;
  attack?: number;
  health?: number;
  playable: boolean;
}

export interface BoardSnapshot {
  source: 'log' | 'demo' | 'empty';
  inGame: boolean;
  turn: number;
  step: string;
  stepLabel: string;
  ourTurn: boolean;
  mana: { available: number; max: number; used: number };
  opponentMana: { available: number; max: number };
  hero: HeroView;
  opponent: HeroView;
  board: MinionView[];
  opponentBoard: MinionView[];
  hand: CardView[];
  opponentHandCount: number;
  secrets: { friendly: number; opponent: number };
  legalActions: LegalAction[];
  note?: string;
}

export interface AdviceStep {
  actionId: string | null;
  text: string;
}

export interface Advice {
  summary: string;
  steps: AdviceStep[];
  risk: string;
  fallback: boolean;
  detail?: string;
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
