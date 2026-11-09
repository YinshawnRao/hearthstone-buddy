import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  adviseOffline,
  buildAnalysisPayload,
  buildSystemPrompt,
  compareCard,
  demoBoard,
  indexCatalog,
  loadArchetypePrinciples,
  normalizeCardText,
  parseAdvice,
  parsePowerLog,
  reviewModelAdvice,
  type CatalogCard
} from '../src/index.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'apps/desktop/src/renderer/public/cards/catalog.json'), 'utf8')
) as CatalogCard[];
const sourceFile = JSON.parse(
  fs.readFileSync(path.join(root, 'apps/desktop/src/renderer/public/cards/source.json'), 'utf8')
) as { provider: string; refreshedAt: string; count: number };
const source = { provider: sourceFile.provider, refreshedAt: sourceFile.refreshedAt, count: sourceFile.count };

test('demo analysis stays offline, legal, and does not invent the opponent hand', () => {
  const board = demoBoard();
  const advice = adviseOffline(board, catalog, source);
  const payload = buildAnalysisPayload(board, catalog, source);
  assert.equal(advice.fallback, false);
  assert.equal(advice.source, 'offline');
  assert.equal(advice.knowledgeVersion, '1.0.0');
  assert.ok(advice.steps.length > 0);
  for (const step of advice.steps) {
    assert.equal(board.legalActions.some((action) => action.id === step.actionId), true);
  }
  assert.equal(advice.steps.some((step) => step.actionId === 'atk-10-t-30'), true);
  assert.equal(advice.steps.some((step) => step.actionId?.startsWith('play-43')), false);
  assert.equal(payload.hidden.opponent_hand_cards, null);
  assert.equal(payload.hidden.future_draws, null);
  assert.equal(payload.hidden.opponent_secret_ids, null);
  assert.equal(payload.hidden.opponent_hand_count, 3);
  assert.equal(JSON.stringify(payload).includes('"opponent_hand":['), false);
  const fireball = payload.hand.find((card) => card.cardId === 'CS2_029');
  assert.equal(fireball?.printed?.cost, 4);
  assert.equal(fireball?.printed?.name, '火球术');
  assert.equal(fireball?.runtime.cost, 4);
  assert.equal(fireball?.costModified, false);
  assert.match(fireball?.printed?.text ?? '', /伤害/);
  assert.equal(board.legalActions.some((action) => action.id.startsWith('play-43')), false);
  assert.equal(board.legalActions.some((action) => action.id === 'atk-10-t-31'), false);
  assert.equal(board.legalActions.some((action) => action.id === 'play-40-t-31'), true);
  assert.equal(board.assessment.lethal.status, 'unknown');
  assert.match(buildSystemPrompt(), /不要编造对手手牌/);
  assert.match(buildSystemPrompt(), /节奏/);
});

test('printed cost stays beside a reduced runtime cost', () => {
  const cards = indexCatalog([{ id: 'CS2_029', name: '火球术', cost: 4, text: '<b>造成</b> $6 点伤害。' }]);
  const compared = compareCard(7, 'CS2_029', '火球术', { cost: 1, attack: null, health: null }, cards);
  assert.equal(compared.printed?.cost, 4);
  assert.equal(compared.runtime.cost, 1);
  assert.equal(compared.costModified, true);
  assert.equal(normalizeCardText('<b>造成</b> $6 点伤害。'), '造成 6 点伤害。');
  const missing = compareCard(8, 'NO_SUCH', '未知', { cost: null, attack: null, health: null }, cards);
  assert.equal(missing.missingMetadata, true);
  assert.equal(missing.runtime.cost, null);
  assert.equal(missing.costModified, null);
});

test('missing cost, missing attack count, and a full board stay unknown or illegal', () => {
  const lines = [
    'CREATE_GAME',
    '    GameEntity EntityID=1',
    '        tag=TURN value=4',
    '        tag=STEP value=MAIN_ACTION',
    '        tag=CURRENT_PLAYER value=1',
    '    Player EntityID=2 PlayerID=1 GameAccountId=[hi=1 lo=1]',
    '        tag=PLAYER_ID value=1',
    '        tag=HERO_ENTITY value=4',
    '        tag=RESOURCES value=10',
    '        tag=RESOURCES_USED value=0',
    '    Player EntityID=3 PlayerID=2 GameAccountId=[hi=1 lo=2]',
    '        tag=PLAYER_ID value=2',
    '        tag=HERO_ENTITY value=5',
    'FULL_ENTITY - Creating ID=4 CardID=HERO_08',
    '    tag=ZONE value=PLAY',
    '    tag=CONTROLLER value=1',
    '    tag=CARDTYPE value=HERO',
    '    tag=HEALTH value=30',
    'FULL_ENTITY - Creating ID=5 CardID=HERO_05',
    '    tag=ZONE value=PLAY',
    '    tag=CONTROLLER value=2',
    '    tag=CARDTYPE value=HERO',
    '    tag=HEALTH value=30',
    'FULL_ENTITY - Creating ID=9 CardID=CS2_029',
    '    tag=ZONE value=HAND',
    '    tag=CONTROLLER value=1',
    '    tag=CARDTYPE value=SPELL',
    'FULL_ENTITY - Creating ID=11 CardID=CS2_033',
    '    tag=ZONE value=PLAY',
    '    tag=CONTROLLER value=1',
    '    tag=CARDTYPE value=MINION',
    '    tag=ATK value=3',
    '    tag=HEALTH value=6',
    '    tag=EXHAUSTED value=0'
  ];
  for (let index = 0; index < 7; index += 1) {
    const id = 20 + index;
    lines.push(
      `FULL_ENTITY - Creating ID=${id} CardID=CS2_182`,
      '    tag=ZONE value=PLAY',
      '    tag=CONTROLLER value=1',
      '    tag=CARDTYPE value=MINION',
      '    tag=ATK value=4',
      '    tag=HEALTH value=5',
      '    tag=EXHAUSTED value=1',
      '    tag=NUM_ATTACKS_THIS_TURN value=0',
      `    tag=ZONE_POSITION value=${index + 1}`
    );
  }
  lines.push(
    'FULL_ENTITY - Creating ID=40 CardID=CS2_182',
    '    tag=ZONE value=HAND',
    '    tag=CONTROLLER value=1',
    '    tag=CARDTYPE value=MINION',
    '    tag=COST value=1',
    '    tag=ATK value=4',
    '    tag=HEALTH value=5'
  );
  const text = lines
    .map((body, index) => `D 12:00:00.${String(index).padStart(7, '0')} GameState.DebugPrintPower() - ${body}`)
    .join('\n');
  const board = parsePowerLog(text);
  assert.equal(board.hand.find((card) => card.entityId === 9)?.cost, null);
  assert.equal(board.hand.find((card) => card.entityId === 9)?.playable, false);
  assert.equal(board.legalActions.some((action) => action.id.startsWith('play-9')), false);
  assert.equal(board.board.find((minion) => minion.entityId === 11)?.attackAvailability, 'unknown');
  assert.equal(board.board.find((minion) => minion.entityId === 11)?.canAttack, false);
  assert.equal(board.legalActions.some((action) => action.id.startsWith('atk-11-')), false);
  assert.equal(board.board.filter((minion) => minion.entityId >= 20).length, 7);
  assert.equal(board.legalActions.some((action) => action.id.startsWith('play-40')), false);
  assert.match(board.assessment.warnings.join(' '), /场面已有 7/);
  assert.match(board.assessment.warnings.join(' '), /没有费用/);
});

test('invalid model JSON and illegal action ids are rejected', () => {
  assert.throws(() => parseAdvice('当然可以，先打脸'));
  const board = demoBoard();
  const parsed = parseAdvice(
    '{"summary":"打一张不存在的牌","steps":[{"actionId":"play-999","text":"打出并不在手上的牌"}],"alternatives":[],"uncertainty":"","risk":"没有"}'
  );
  const reviewed = reviewModelAdvice(parsed, new Set(board.legalActions.map((action) => action.id)));
  assert.equal(reviewed.fallback, true);
  assert.equal(reviewed.steps.length, 0);
  assert.match(reviewed.warnings?.join(' ') ?? '', /play-999/);
});

test('an unknown archetype file adds nothing and does not invent a guide', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-coach-arch-'));
  const none = loadArchetypePrinciples('aggro', (id) => {
    const file = path.join(directory, `${id}.json`);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  });
  assert.deepEqual(none, []);
  fs.writeFileSync(
    path.join(directory, 'aggro.json'),
    JSON.stringify({ principles: [{ id: 'go-face', title: '样本', text: '只在测试里存在。' }] })
  );
  const loaded = loadArchetypePrinciples('aggro', (id) => fs.readFileSync(path.join(directory, `${id}.json`), 'utf8'));
  assert.equal(loaded?.[0]?.id, 'go-face');
  assert.deepEqual(loadArchetypePrinciples('../secrets', () => 'nope'), []);
});
