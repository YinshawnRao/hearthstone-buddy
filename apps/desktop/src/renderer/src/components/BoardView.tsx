import type { BoardSnapshot, CardView, HeroView, MinionView } from '@hs-coach/parser';

function Mana({ available, max }: { available: number; max: number }) {
  const total = Math.min(10, Math.max(max, 0));
  return (
    <div className="mana" aria-label={`法力 ${available} / ${max}`}>
      <strong>
        {available}
        <span>/{max}</span>
      </strong>
      <span className="pips">
        {Array.from({ length: total }, (_, index) => (
          <i key={index} className={index < available ? 'on' : ''} />
        ))}
      </span>
    </div>
  );
}

function HeroPlate({ hero, powerReady }: { hero: HeroView; powerReady?: boolean }) {
  return (
    <article className="hero">
      <div>
        <p className="eyebrow">{hero.className}</p>
        <h3>{hero.name}</h3>
        {hero.weapon ? (
          <p className="weapon">
            {hero.weapon.name} {hero.weapon.attack}/{hero.weapon.durability}
          </p>
        ) : null}
        {hero.heroPower ? (
          <p className={powerReady ? 'power' : 'power dim'}>
            {hero.heroPower.name} · {hero.heroPower.cost} 费
          </p>
        ) : null}
      </div>
      <div className="hero-stats">
        {hero.armor > 0 ? <span className="armor">{hero.armor}</span> : null}
        <span className="life">{hero.health}</span>
      </div>
    </article>
  );
}

function MinionCard({ minion }: { minion: MinionView }) {
  const classes = [
    'minion',
    minion.taunt ? 'taunt' : '',
    minion.divineShield ? 'shield' : '',
    minion.frozen ? 'frozen' : '',
    minion.canAttack ? 'ready' : ''
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <article className={classes}>
      <h4>{minion.name}</h4>
      {minion.keywords.length > 0 ? <p className="keys">{minion.keywords.join(' · ')}</p> : <p className="keys quiet">随从</p>}
      {minion.canAttack ? <p className="ready-flag">可攻击</p> : null}
      <span className="gem atk">{minion.attack}</span>
      <span className="gem hp">{minion.health}</span>
    </article>
  );
}

function HandCard({ card }: { card: CardView }) {
  const kind = card.cardType === 'spell' ? '法术' : card.cardType === 'minion' ? '随从' : card.cardType === 'weapon' ? '武器' : '卡牌';
  return (
    <article className={card.playable ? 'hand-card' : 'hand-card locked'}>
      <span className="cost">{card.cost ?? '?'}</span>
      <h4>{card.name}</h4>
      <p>{kind}</p>
      {card.playable ? <em>可打出</em> : <em>费用不足</em>}
    </article>
  );
}

export function BoardView({ board }: { board: BoardSnapshot }) {
  const powerReady = Boolean(
    board.hero.heroPower?.available && board.hero.heroPower.cost <= board.mana.available
  );
  return (
    <div className="board-col">
      <section className="felt">
        {board.inGame ? (
          <>
            <header className="felt-head">
              <p className="eyebrow">对手</p>
              <div className="pills">
                {board.secrets.opponent > 0 ? <span>奥秘 {board.secrets.opponent}</span> : null}
                <span>手牌 {board.opponentHandCount}</span>
              </div>
            </header>
            <HeroPlate hero={board.opponent} />
            <div className="minion-row">
              {board.opponentBoard.length === 0 ? <p className="empty-row">对面没有随从</p> : null}
              {board.opponentBoard.map((minion) => (
                <MinionCard key={minion.entityId} minion={minion} />
              ))}
            </div>
            <div className="felt-split">
              <span>回合 {board.turn || '—'}</span>
              <span>{board.ourTurn ? '我方回合' : '对手回合'} · {board.stepLabel}</span>
              <Mana available={board.mana.available} max={board.mana.max} />
            </div>
            <div className="minion-row ours">
              {board.board.length === 0 ? <p className="empty-row">我方没有随从</p> : null}
              {board.board.map((minion) => (
                <MinionCard key={minion.entityId} minion={minion} />
              ))}
            </div>
            <HeroPlate hero={board.hero} powerReady={powerReady} />
          </>
        ) : (
          <div className="felt-empty">
            <span className="seal big">炉</span>
            <h2>还没有对局</h2>
            <p>{board.note}</p>
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>我方手牌</h2>
          <span>{board.hand.length} 张</span>
        </header>
        {board.hand.length === 0 ? (
          <p className="quiet-copy">手牌还是空的。演示模式或一局进行中的 Power.log 会把可见卡牌填到这里。</p>
        ) : (
          <div className="hand-row">
            {board.hand.map((card) => (
              <HandCard key={card.entityId} card={card} />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>候选动作</h2>
          <span>{board.legalActions.length}</span>
        </header>
        {board.note ? <p className="quiet-copy">{board.note}</p> : null}
        {board.legalActions.length > 0 ? (
          <ul className="action-list">
            {board.legalActions.map((action) => (
              <li key={action.id}>{action.label}</li>
            ))}
          </ul>
        ) : null}
        <p className="fine">这些动作是启发式估计，只用来提示模型。点它们不会操作炉石。</p>
      </section>
    </div>
  );
}
