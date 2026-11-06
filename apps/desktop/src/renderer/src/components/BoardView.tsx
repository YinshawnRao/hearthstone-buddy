import type { BoardSnapshot, HeroView } from '@hs-coach/parser';
import { ArtWindow, HandRender, MinionToken, Portrait } from './HsCard';

function Mana({ available, max }: { available: number; max: number }) {
  const total = Math.min(10, Math.max(max, 0));
  return (
    <div className="mana" aria-label={`法力 ${available} / ${max}`}>
      <b>
        {available}
        <span>/{max}</span>
      </b>
      <span className="crystals">
        {Array.from({ length: total }, (_, index) => (
          <i key={index} className={index < available ? 'on' : ''} />
        ))}
      </span>
    </div>
  );
}

function HeroMedal({ hero, powerReady }: { hero: HeroView; powerReady?: boolean }) {
  return (
    <div className="medal">
      <div className="portrait-wrap">
        <div className="portrait">
          <Portrait cardId={hero.cardId} name={hero.name} />
        </div>
        {hero.armor > 0 ? <span className="armor-orb">{hero.armor}</span> : null}
        <span className="health-orb">{hero.health}</span>
        {hero.heroPower ? (
          <div className={powerReady ? 'hp-orb' : 'hp-orb dim'} title={`${hero.heroPower.name} · ${hero.heroPower.cost} 费`}>
            <ArtWindow cardId={hero.cardId ? `${hero.cardId}bp` : undefined} name={hero.heroPower.name} />
            <b>{hero.heroPower.cost}</b>
          </div>
        ) : null}
      </div>
      <div className="medal-copy">
        <p>{hero.className}</p>
        <h3>{hero.name}</h3>
      </div>
      {hero.weapon ? (
        <p className="weapon-line">
          {hero.weapon.name} {hero.weapon.attack}/{hero.weapon.durability}
        </p>
      ) : null}
    </div>
  );
}

function Backs({ count }: { count: number }) {
  const shown = Math.min(count, 7);
  return (
    <div className="backs" aria-label={`对手手牌 ${count}`}>
      {Array.from({ length: shown }, (_, index) => (
        <i key={index} />
      ))}
      <span>{count}</span>
    </div>
  );
}

export function BoardView({
  board,
  onInspect
}: {
  board: BoardSnapshot;
  onInspect: (cardId: string) => void;
}) {
  const powerReady = Boolean(board.hero.heroPower?.available && board.hero.heroPower.cost <= board.mana.available);
  const mid = (board.hand.length - 1) / 2;
  return (
    <div className="board-col">
      <section className="playmat">
        <div className="felt">
          {board.inGame ? (
            <>
              <div className="lane">
                <div className="lane-main">
                  <div className="lane-tools">
                    {board.secrets.opponent > 0 ? <span className="secret-orb">奥秘 {board.secrets.opponent}</span> : <span />}
                    <Backs count={board.opponentHandCount} />
                  </div>
                  <div className="token-row">
                    {board.opponentBoard.length === 0 ? <p className="empty-row">对面没有随从</p> : null}
                    {board.opponentBoard.map((minion) => (
                      <MinionToken key={minion.entityId} {...minion} onInspect={onInspect} />
                    ))}
                  </div>
                </div>
                <HeroMedal hero={board.opponent} />
              </div>

              <div className="midbar">
                <span>回合 {board.turn || '—'}</span>
                <span>{board.ourTurn ? '我方回合' : '对手回合'} · {board.stepLabel}</span>
                <Mana available={board.mana.available} max={board.mana.max} />
              </div>

              <div className="lane friendly">
                <div className="token-row">
                  {board.board.length === 0 ? <p className="empty-row">我方没有随从</p> : null}
                  {board.board.map((minion) => (
                    <MinionToken key={minion.entityId} {...minion} onInspect={onInspect} />
                  ))}
                </div>
                <HeroMedal hero={board.hero} powerReady={powerReady} />
              </div>
            </>
          ) : (
            <div className="felt-empty">
              <span className="seal big">炉</span>
              <h2>还没有对局</h2>
              <p>{board.note}</p>
            </div>
          )}

          <div className="hand-fan">
            {board.hand.length === 0 ? <p className="empty-row">手牌为空</p> : null}
            {board.hand.map((card, index) => (
              <HandRender
                key={card.entityId}
                cardId={card.cardId}
                name={card.name}
                playable={card.playable}
                tilt={(index - mid) * 3.5}
                onInspect={onInspect}
              />
            ))}
          </div>
        </div>
      </section>

      {board.legalActions.length > 0 || board.note ? (
        <section className="plaque">
          <header>
            <h2>候选动作</h2>
            <span>{board.legalActions.length}</span>
          </header>
          {board.note ? <p>{board.note}</p> : null}
          <ul>
            {board.legalActions.map((action) => (
              <li key={action.id}>{action.label}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
