/**
 * A short, realistic Power.log excerpt used as the demo board and as the parser fixture.
 * Only GameState lines are authoritative. A trailing PowerTaskList line is a decoy.
 */
function buildSampleLog(): string {
  let n = 0;
  const next = (): string => String(n++).padStart(7, '0');
  const gs = (body: string): string =>
    `D 12:00:00.${next()} GameState.DebugPrintPower() - ${body}`;

  const lines: string[] = [];
  const add = (body: string): void => {
    lines.push(gs(body));
  };
  const tags = (pairs: [string, string][]): void => {
    for (const [tag, value] of pairs) add(`    tag=${tag} value=${value}`);
  };

  add('CREATE_GAME');
  add('    GameEntity EntityID=1');
  tags([
    ['TURN', '6'],
    ['STEP', 'MAIN_ACTION'],
    ['CURRENT_PLAYER', '1'],
    ['STATE', 'RUNNING']
  ]);
  add('    Player EntityID=2 PlayerID=1 GameAccountId=[hi=1 lo=2]');
  tags([
    ['PLAYER_ID', '1'],
    ['HERO_ENTITY', '64'],
    ['RESOURCES', '6'],
    ['RESOURCES_USED', '0'],
    ['MAXRESOURCES', '6']
  ]);
  add('    Player EntityID=3 PlayerID=2 GameAccountId=[hi=1 lo=3]');
  tags([
    ['PLAYER_ID', '2'],
    ['HERO_ENTITY', '66'],
    ['RESOURCES', '5'],
    ['RESOURCES_USED', '5'],
    ['MAXRESOURCES', '5']
  ]);

  const entity = (id: number, cardId: string, pairs: [string, string][]): void => {
    add(`FULL_ENTITY - Creating ID=${id} CardID=${cardId}`);
    tags(pairs);
  };

  entity(64, 'HERO_08', [
    ['ZONE', 'PLAY'],
    ['CONTROLLER', '1'],
    ['CARDTYPE', 'HERO'],
    ['CLASS', 'MAGE'],
    ['HEALTH', '30'],
    ['DAMAGE', '3'],
    ['ARMOR', '0'],
    ['ATK', '0']
  ]);
  entity(65, 'HERO_08bp', [
    ['ZONE', 'PLAY'],
    ['CONTROLLER', '1'],
    ['CARDTYPE', 'HERO_POWER'],
    ['COST', '2'],
    ['EXHAUSTED', '0'],
    ['HEROPOWER_ACTIVATIONS_THIS_TURN', '0']
  ]);
  entity(66, 'HERO_05', [
    ['ZONE', 'PLAY'],
    ['CONTROLLER', '2'],
    ['CARDTYPE', 'HERO'],
    ['CLASS', 'HUNTER'],
    ['HEALTH', '30'],
    ['DAMAGE', '12'],
    ['ARMOR', '2'],
    ['ATK', '0']
  ]);
  entity(10, 'CS2_033', [
    ['ZONE', 'PLAY'],
    ['CONTROLLER', '1'],
    ['CARDTYPE', 'MINION'],
    ['ATK', '3'],
    ['HEALTH', '6'],
    ['DAMAGE', '0'],
    ['ZONE_POSITION', '1'],
    ['EXHAUSTED', '0'],
    ['NUM_ATTACKS_THIS_TURN', '0'],
    ['NUM_TURNS_IN_PLAY', '2'],
    ['TAUNT', '0']
  ]);
  entity(11, 'NEW1_012', [
    ['ZONE', 'PLAY'],
    ['CONTROLLER', '1'],
    ['CARDTYPE', 'MINION'],
    ['ATK', '2'],
    ['HEALTH', '3'],
    ['DAMAGE', '0'],
    ['ZONE_POSITION', '2'],
    ['EXHAUSTED', '1'],
    ['FROZEN', '1'],
    ['NUM_ATTACKS_THIS_TURN', '0'],
    ['NUM_TURNS_IN_PLAY', '1']
  ]);
  entity(30, 'CS2_127', [
    ['ZONE', 'PLAY'],
    ['CONTROLLER', '2'],
    ['CARDTYPE', 'MINION'],
    ['ATK', '1'],
    ['HEALTH', '4'],
    ['DAMAGE', '0'],
    ['ZONE_POSITION', '1'],
    ['TAUNT', '1'],
    ['EXHAUSTED', '0']
  ]);
  entity(31, 'CS2_200', [
    ['ZONE', 'PLAY'],
    ['CONTROLLER', '2'],
    ['CARDTYPE', 'MINION'],
    ['ATK', '6'],
    ['HEALTH', '7'],
    ['DAMAGE', '0'],
    ['ZONE_POSITION', '2'],
    ['TAUNT', '0'],
    ['DIVINE_SHIELD', '1']
  ]);

  const hand = (id: number, cardId: string, pos: string, cost: string, cardType: string): void => {
    const pairs: [string, string][] = [
      ['ZONE', 'HAND'],
      ['CONTROLLER', '1'],
      ['CARDTYPE', cardType],
      ['COST', cost],
      ['ZONE_POSITION', pos]
    ];
    if (cardType === 'MINION') pairs.push(['ATK', '1'], ['HEALTH', '1']);
    entity(id, cardId, pairs);
  };
  hand(40, 'CS2_029', '1', '4', 'SPELL');
  hand(41, 'CS2_024', '2', '2', 'SPELL');
  hand(42, 'CS2_023', '3', '3', 'SPELL');
  hand(43, 'CS2_032', '4', '7', 'SPELL');

  for (const id of [50, 51, 52]) {
    entity(id, '', [
      ['ZONE', 'HAND'],
      ['CONTROLLER', '2'],
      ['CARDTYPE', 'INVALID'],
      ['ZONE_POSITION', String(id - 49)]
    ]);
  }

  entity(80, '', [
    ['ZONE', 'SECRET'],
    ['CONTROLLER', '2'],
    ['CARDTYPE', 'SPELL'],
    ['ZONE_POSITION', '1']
  ]);

  add(
    'TAG_CHANGE Entity=[entityName=Water Elemental id=10 zone=PLAY zonePos=1 cardId=CS2_033 player=1] tag=ATK value=3'
  );
  add(
    'BLOCK_START BlockType=PLAY Entity=[entityName=Arcane Intellect id=42 zone=HAND zonePos=3 cardId=CS2_023 player=1] EffectCardId= EffectIndex=0 Target=0 SubOption=-1'
  );
  add('BLOCK_END');

  lines.push(`D 12:00:01.0000000 GameState.DebugPrintOptions() - id=2`);
  lines.push(
    `D 12:00:01.1000000 PowerTaskList.DebugPrintPower() - TAG_CHANGE Entity=GameEntity tag=TURN value=99`
  );
  return lines.join('\n') + '\n';
}

export const SAMPLE_POWER_LOG = buildSampleLog();
