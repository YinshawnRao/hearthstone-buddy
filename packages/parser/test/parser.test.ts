import assert from 'node:assert/strict';
import test from 'node:test';
import { PowerParser, demoBoard, parsePowerLog, snapshotFromRaw } from '../src/index.js';
import { SAMPLE_POWER_LOG } from '../src/sampleLog.js';

test('demo board reads turn, mana, heroes, hand, and taunt-limited attacks', () => {
  const board = demoBoard();
  assert.equal(board.source, 'demo');
  assert.equal(board.turn, 6);
  assert.equal(board.step, 'MAIN_ACTION');
  assert.equal(board.ourTurn, true);
  assert.equal(board.mana.available, 6);
  assert.equal(board.mana.max, 6);
  assert.equal(board.hero.name, '吉安娜·普罗德摩尔');
  assert.equal(board.hero.className, '法师');
  assert.equal(board.hero.health, 27);
  assert.equal(board.opponent.name, '雷克萨');
  assert.equal(board.opponent.health, 18);
  assert.equal(board.opponent.armor, 2);
  assert.equal(board.board.length, 2);
  assert.equal(board.board[0]?.name, '水元素');
  assert.equal(board.board[0]?.canAttack, true);
  assert.equal(board.board[1]?.name, '法力浮龙');
  assert.equal(board.board[1]?.attack, 2);
  assert.equal(board.board[1]?.health, 3);
  assert.equal(board.board[1]?.canAttack, false);
  assert.equal(board.board[1]?.frozen, true);
  assert.equal(board.opponentBoard[0]?.taunt, true);
  assert.equal(board.opponentBoard[1]?.divineShield, true);
  assert.equal(board.hand.length, 4);
  assert.equal(board.hand[3]?.name, '烈焰风暴');
  assert.equal(board.hand[3]?.playable, false);
  assert.equal(board.opponentHandCount, 3);
  assert.equal(board.secrets.opponent, 1);

  const ids = board.legalActions.map((action) => action.id);
  assert.ok(ids.includes('atk-10-t-30'));
  assert.equal(ids.some((id) => id.startsWith('atk-10-t-31')), false);
  assert.equal(ids.some((id) => id.startsWith('atk-11-')), false);
  assert.ok(ids.includes('play-40-t-66'));
  assert.ok(ids.includes('play-40-t-31'));
  assert.ok(ids.includes('play-42'));
  assert.equal(ids.some((id) => id.startsWith('play-43')), false);
  assert.ok(ids.includes('hp-t-30'));
  assert.ok(ids.includes('hp-t-66'));
  assert.ok(ids.includes('end-turn'));
  assert.equal(board.legalActions.at(-1)?.label, '结束回合');
});

test('PowerTaskList duplicates do not override GameState', () => {
  const board = parsePowerLog(SAMPLE_POWER_LOG, 'log');
  assert.equal(board.turn, 6);
  assert.equal(board.source, 'log');
});

test('numeric GameTag ids are accepted', () => {
  const lines = [
    'CREATE_GAME',
    '    GameEntity EntityID=1',
    '        tag=20 value=3',
    '        tag=19 value=10',
    '        tag=23 value=1',
    '    Player EntityID=2 PlayerID=1 GameAccountId=[hi=1 lo=1]',
    '        tag=30 value=1',
    '        tag=27 value=4',
    '        tag=26 value=4',
    '        tag=25 value=1',
    'FULL_ENTITY - Creating ID=4 CardID=HERO_08',
    '    tag=49 value=1',
    '    tag=50 value=1',
    '    tag=202 value=3',
    '    tag=199 value=4',
    '    tag=45 value=30',
    '    tag=44 value=5',
    'FULL_ENTITY - Creating ID=8 CardID=CS2_182',
    '    tag=49 value=1',
    '    tag=50 value=1',
    '    tag=202 value=4',
    '    tag=47 value=4',
    '    tag=45 value=5',
    '    tag=263 value=1',
    '    tag=43 value=0'
  ];
  const text = lines
    .map((body, index) => `D 12:00:00.${String(index).padStart(7, '0')} GameState.DebugPrintPower() - ${body}`)
    .join('\n');
  const board = parsePowerLog(text);
  assert.equal(board.turn, 3);
  assert.equal(board.step, 'MAIN_ACTION');
  assert.equal(board.hero.health, 25);
  assert.equal(board.hero.className, '法师');
  assert.equal(board.mana.available, 3);
  assert.equal(board.board[0]?.name, '冰风雪人');
  assert.equal(board.board[0]?.attack, 4);
  assert.equal(board.board[0]?.health, 5);
  assert.equal(board.board[0]?.canAttack, true);
});

test('chunks and a new CREATE_GAME reset the board', () => {
  const parser = new PowerParser();
  const cut = 80;
  parser.push(SAMPLE_POWER_LOG.slice(0, cut));
  parser.push(SAMPLE_POWER_LOG.slice(cut));
  assert.equal(snapshotFromRaw(parser.raw(), 'log').turn, 6);
  parser.push(
    [
      'D 12:00:02.0000000 GameState.DebugPrintPower() - CREATE_GAME',
      'D 12:00:02.0000001 GameState.DebugPrintPower() -     GameEntity EntityID=1',
      'D 12:00:02.0000002 GameState.DebugPrintPower() -         tag=TURN value=1',
      ''
    ].join('\n')
  );
  const next = snapshotFromRaw(parser.raw(), 'log');
  assert.equal(next.turn, 1);
  assert.equal(next.board.length, 0);
  assert.equal(next.hand.length, 0);
});
