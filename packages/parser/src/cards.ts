/** Names for cards the demo and the MVP dictionary know. Unknown ids stay as CardIDs. */
export const CARD_NAMES: Record<string, string> = {
  HERO_01: '加尔鲁什·地狱咆哮',
  HERO_02: '萨尔',
  HERO_03: '乌瑟尔·光明使者',
  HERO_04: '安度因·乌瑞恩',
  HERO_05: '雷克萨',
  HERO_06: '玛法里奥·怒风',
  HERO_07: '古尔丹',
  HERO_08: '吉安娜·普罗德摩尔',
  HERO_09: '瓦莉拉·萨古纳尔',
  HERO_10: '伊利丹·怒风',
  HERO_08bp: '火焰冲击',
  HERO_05bp: '稳固射击',
  DS1h_292: '稳固射击',
  CS2_034: '火焰冲击',
  CS2_029: '火球术',
  CS2_024: '寒冰箭',
  CS2_023: '奥术智慧',
  CS2_032: '烈焰风暴',
  CS2_022: '变形术',
  CS2_025: '魔爆术',
  CS2_033: '水元素',
  NEW1_012: '法力浮龙',
  CS2_182: '冰风雪人',
  CS2_127: '银背族长',
  CS2_200: '石拳食人魔',
  CS2_121: '霜狼步兵',
  CS2_172: '血沼迅猛龙',
  EX1_610: '爆炸陷阱'
};

/** Spells that need a target in the basic rules. Unknown spells stay untargeted. */
export const TARGETED_SPELLS = new Set(['CS2_029', 'CS2_024', 'CS2_022']);

export function cardName(cardId?: string, fallbackName?: string): string {
  if (cardId && CARD_NAMES[cardId]) return CARD_NAMES[cardId];
  if (fallbackName && !fallbackName.startsWith('UNKNOWN')) return fallbackName;
  if (cardId) return cardId;
  return '未知卡牌';
}
