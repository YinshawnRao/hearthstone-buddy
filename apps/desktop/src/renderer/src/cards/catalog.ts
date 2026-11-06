export interface CardDef {
  id: string;
  dbfId: number | null;
  name: string;
  cost: number | null;
  attack: number | null;
  health: number | null;
  armor: number | null;
  rarity: string | null;
  set: string | null;
  type: string | null;
  cardClass: string | null;
  text: string;
}

let pending: Promise<Map<string, CardDef>> | null = null;

export function loadCatalog(): Promise<Map<string, CardDef>> {
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}cards/catalog.json`)
      .then((response) => (response.ok ? (response.json() as Promise<CardDef[]>) : []))
      .then((rows) => new Map(rows.map((row) => [row.id, row])))
      .catch(() => new Map());
  }
  return pending;
}

export function cardAsset(kind: 'renders' | 'art' | 'heroes', id: string): string {
  const ext = kind === 'art' ? 'jpg' : 'png';
  return `${import.meta.env.BASE_URL}cards/${kind}/${id}.${ext}`;
}

export function cardCdn(kind: 'renders' | 'art' | 'heroes', id: string): string {
  if (kind === 'renders') return `https://art.hearthstonejson.com/v1/render/latest/zhCN/256x/${id}.png`;
  if (kind === 'art') return `https://art.hearthstonejson.com/v1/256x/${id}.jpg`;
  return `https://art.hearthstonejson.com/v1/heroes/latest/256x/${id}.png`;
}

export function plainCardText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RARITY_ZH: Record<string, string> = {
  FREE: '基本',
  COMMON: '普通',
  RARE: '稀有',
  EPIC: '史诗',
  LEGENDARY: '传说'
};

const SET_ZH: Record<string, string> = {
  CORE: '核心',
  EXPERT1: '经典',
  LEGACY: '传承',
  VANILLA: '怀旧',
  BASIC: '基本'
};

export function rarityLabel(rarity: string | null | undefined): string {
  if (!rarity) return '未知';
  return RARITY_ZH[rarity] ?? rarity;
}

export function setLabel(set: string | null | undefined): string {
  if (!set) return '';
  return SET_ZH[set] ?? set;
}
