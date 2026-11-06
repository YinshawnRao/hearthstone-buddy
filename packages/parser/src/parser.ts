import { normalizeTag, normalizeValue } from './tags.js';
import type { RawEntity, RawGame } from './types.js';

const LINE_RE = /^[DWE]\s+(?:\d{4}-\d{2}-\d{2}\s+)?[\d:.]+\s+(.+)$/;
const GAMESTATE_POWER_RE = /^GameState\.DebugPrintPower\(\)\s*-\s*(.*)$/;
const TASKLIST_POWER_RE = /^PowerTaskList\.DebugPrintPower\(\)\s*-\s*(.*)$/;
const OPTIONS_RE = /^GameState\.DebugPrintOptions\(\)\s*-\s*id=(\d+)\s*$/;
const TAG_LINE_RE = /^tag=(\w+) value=(\w+)/;
const CREATE_FULL_RE = /^FULL_ENTITY - Creating ID=(\d+) CardID=(\w*)$/;
const UPDATE_FULL_RE = /^FULL_ENTITY - Updating (.+) CardID=(\w*)$/;
const SHOW_RE = /^SHOW_ENTITY - Updating Entity=(.+) CardID=(\w*)$/;
const CHANGE_RE = /^CHANGE_ENTITY - Updating Entity=(.+) CardID=(\w*)$/;
const HIDE_RE = /^HIDE_ENTITY - Entity=(.+) tag=(\w+) value=(\w+)$/;
const TAG_CHANGE_RE = /^TAG_CHANGE Entity=(.+) tag=(\w+) value=(\w+)/;
const GAME_ENTITY_RE = /^GameEntity EntityID=(\d+)$/;
const PLAYER_RE = /^Player EntityID=(\d+) PlayerID=(\d+)/;

interface MutableEntity {
  id: number;
  cardId?: string;
  name?: string;
  tags: Record<string, string>;
}

/**
 * Incremental Power.log reader.
 * GameState.DebugPrintPower lines are applied once. PowerTaskList duplicates are ignored
 * after the first GameState line so tags are not double-counted.
 * This class never sends input to the game.
 */
export class PowerParser {
  private entities = new Map<number, MutableEntity>();
  private current: MutableEntity | null = null;
  private gameEntityId = 1;
  private localPlayerEntityId: number | null = null;
  private buffer = '';
  private sawGameState = false;
  private bomChecked = false;
  linesParsed = 0;

  reset(): void {
    this.entities.clear();
    this.current = null;
    this.gameEntityId = 1;
    this.localPlayerEntityId = null;
    this.sawGameState = false;
  }

  push(chunk: string): boolean {
    let text = chunk;
    if (!this.bomChecked) {
      this.bomChecked = true;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    }
    this.buffer += text;
    const parts = this.buffer.split(/\r?\n/);
    this.buffer = parts.pop() ?? '';
    let changed = false;
    for (const line of parts) {
      if (this.consumeLine(line)) changed = true;
    }
    return changed;
  }

  raw(): RawGame {
    const entities: RawEntity[] = [];
    for (const entity of this.entities.values()) {
      entities.push({
        id: entity.id,
        cardId: entity.cardId,
        name: entity.name,
        tags: { ...entity.tags }
      });
    }
    return {
      entities,
      gameEntityId: this.gameEntityId,
      localPlayerEntityId: this.localPlayerEntityId
    };
  }

  private consumeLine(line: string): boolean {
    const match = LINE_RE.exec(line.trimEnd());
    if (!match) return false;
    const rest = match[1] ?? '';
    const gameState = GAMESTATE_POWER_RE.exec(rest);
    if (gameState) {
      this.sawGameState = true;
      this.linesParsed += 1;
      return this.consumePower(gameState[1] ?? '');
    }
    const taskList = TASKLIST_POWER_RE.exec(rest);
    if (taskList && !this.sawGameState) {
      this.linesParsed += 1;
      return this.consumePower(taskList[1] ?? '');
    }
    const options = OPTIONS_RE.exec(rest);
    if (options) {
      this.localPlayerEntityId = Number(options[1]);
      this.linesParsed += 1;
      return true;
    }
    return false;
  }

  private consumePower(message: string): boolean {
    const text = message.trim();
    const tagLine = TAG_LINE_RE.exec(text);
    if (tagLine && this.current) {
      this.apply(this.current, tagLine[1] ?? '', tagLine[2] ?? '');
      return true;
    }
    this.current = null;
    if (!text || text === 'BLOCK_END' || text.startsWith('BLOCK_START') || text.startsWith('META_DATA') || text.startsWith('SUB_SPELL')) {
      return false;
    }
    if (text === 'CREATE_GAME' || text === 'RESET_GAME') {
      const keepLocal = this.localPlayerEntityId;
      this.reset();
      this.localPlayerEntityId = keepLocal;
      this.sawGameState = true;
      return true;
    }

    const gameEntity = GAME_ENTITY_RE.exec(text);
    if (gameEntity) {
      this.gameEntityId = Number(gameEntity[1]);
      const entity = this.ensure(this.gameEntityId);
      entity.tags.CARDTYPE = 'GAME';
      this.current = entity;
      return true;
    }

    const player = PLAYER_RE.exec(text);
    if (player) {
      const entity = this.ensure(Number(player[1]));
      entity.tags.PLAYER_ID = player[2] ?? '';
      entity.tags.CARDTYPE = 'PLAYER';
      this.current = entity;
      return true;
    }

    const created = CREATE_FULL_RE.exec(text);
    if (created) {
      const entity = this.ensure(Number(created[1]));
      this.setCardId(entity, created[2] ?? '');
      this.current = entity;
      return true;
    }

    const updated = UPDATE_FULL_RE.exec(text);
    if (updated) {
      const entity = this.entityFromRef(updated[1] ?? '');
      if (!entity) return false;
      this.setCardId(entity, updated[2] ?? '');
      this.current = entity;
      return true;
    }

    const shown = SHOW_RE.exec(text) ?? CHANGE_RE.exec(text);
    if (shown) {
      const entity = this.entityFromRef(shown[1] ?? '');
      if (!entity) return false;
      this.setCardId(entity, shown[2] ?? '');
      this.current = entity;
      return true;
    }

    const hidden = HIDE_RE.exec(text);
    if (hidden) {
      const entity = this.entityFromRef(hidden[1] ?? '');
      if (!entity) return false;
      this.apply(entity, hidden[2] ?? '', hidden[3] ?? '');
      return true;
    }

    const change = TAG_CHANGE_RE.exec(text);
    if (change) {
      const ref = change[1] ?? '';
      const entity = ref.trim() === 'GameEntity' ? this.ensure(this.gameEntityId) : this.entityFromRef(ref);
      if (!entity) return false;
      this.apply(entity, change[2] ?? '', change[3] ?? '');
      return true;
    }

    return false;
  }

  private ensure(id: number): MutableEntity {
    let entity = this.entities.get(id);
    if (!entity) {
      entity = { id, tags: {} };
      this.entities.set(id, entity);
    }
    return entity;
  }

  private apply(entity: MutableEntity, tag: string, value: string): void {
    const name = normalizeTag(tag);
    entity.tags[name] = normalizeValue(name, value);
  }

  private setCardId(entity: MutableEntity, cardId: string): void {
    if (cardId) entity.cardId = cardId;
  }

  private entityFromRef(raw: string): MutableEntity | null {
    const text = raw.trim();
    if (text === 'GameEntity') return this.ensure(this.gameEntityId);
    if (/^\d+$/.test(text)) return this.ensure(Number(text));
    const idMatch = /id=(\d+)/.exec(text);
    if (!idMatch) return null;
    const entity = this.ensure(Number(idMatch[1]));
    const nameMatch = /entityName=(.*?)\s+id=/.exec(text);
    if (nameMatch) {
      const name = nameMatch[1]?.trim() ?? '';
      if (name && !name.startsWith('UNKNOWN')) entity.name = name;
    }
    const cardMatch = /cardId=([^\s\]]*)/.exec(text);
    if (cardMatch?.[1]) entity.cardId = cardMatch[1];
    return entity;
  }
}
