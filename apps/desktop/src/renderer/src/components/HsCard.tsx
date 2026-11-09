import { useEffect, useState } from 'react';
import { plainCardText, rarityLabel, setLabel } from '../cards/catalog';
import { cardAsset, cardCdn, useCardDef } from '../cards/useCard';

function useSrc(cardId: string | undefined, kind: 'renders' | 'art' | 'heroes') {
  const local = cardId ? cardAsset(kind, cardId) : '';
  const remote = cardId ? cardCdn(kind, cardId) : '';
  const [phase, setPhase] = useState<'local' | 'remote' | 'dead'>('local');
  useEffect(() => setPhase('local'), [local, remote]);
  return {
    src: !cardId || phase === 'dead' ? null : phase === 'local' ? local : remote,
    onError: () => setPhase((current) => (current === 'local' ? 'remote' : 'dead'))
  };
}

export function CardRender({
  cardId,
  name,
  className
}: {
  cardId?: string;
  name: string;
  className?: string;
}) {
  const image = useSrc(cardId, 'renders');
  const def = useCardDef(cardId);
  if (!image.src) {
    return (
      <div className={`render-fallback ${rarityClass(def?.rarity)} ${className ?? ''}`}>
        <strong>{name}</strong>
        <span>{def ? rarityLabel(def.rarity) : '无插画'}</span>
      </div>
    );
  }
  return <img className={className} src={image.src} alt={name} draggable={false} onError={image.onError} />;
}

export function Portrait({ cardId, name }: { cardId?: string; name: string }) {
  const image = useSrc(cardId, 'heroes');
  const art = useSrc(cardId, 'art');
  const src = image.src ?? art.src;
  const onError = image.src ? image.onError : art.onError;
  if (!src) return <div className="portrait-fallback">{name.slice(0, 1)}</div>;
  return <img src={src} alt={name} draggable={false} onError={onError} />;
}

export function ArtWindow({ cardId, name }: { cardId?: string; name: string }) {
  const image = useSrc(cardId, 'art');
  if (!image.src) return <div className="art-fallback">{name.slice(0, 1)}</div>;
  return <img src={image.src} alt="" draggable={false} onError={image.onError} />;
}

function rarityClass(rarity: string | null | undefined): string {
  if (rarity === 'LEGENDARY') return 'rarity-legendary';
  if (rarity === 'EPIC') return 'rarity-epic';
  if (rarity === 'RARE') return 'rarity-rare';
  return 'rarity-common';
}

export function MinionToken({
  cardId,
  name,
  attack,
  health,
  keywords,
  taunt,
  divineShield,
  frozen,
  canAttack,
  onInspect
}: {
  cardId?: string;
  name: string;
  attack: number | null;
  health: number | null;
  keywords: string[];
  taunt: boolean;
  divineShield: boolean;
  frozen: boolean;
  canAttack: boolean;
  onInspect?: (cardId: string) => void;
}) {
  const classes = ['token', taunt ? 'taunt' : '', divineShield ? 'shield' : '', frozen ? 'frozen' : '', canAttack ? 'ready' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} onClick={() => cardId && onInspect?.(cardId)} title={keywords.join(' · ') || name}>
      <span className="token-art">
        <ArtWindow cardId={cardId} name={name} />
      </span>
      <span className="token-name">{name}</span>
      {canAttack ? <em className="token-flag">可攻击</em> : null}
      <b className="gem atk">{attack ?? '?'}</b>
      <b className="gem hp">{health ?? '?'}</b>
    </button>
  );
}

export function HandRender({
  cardId,
  name,
  playable,
  tilt,
  lockLabel,
  onInspect
}: {
  cardId?: string;
  name: string;
  playable: boolean;
  tilt: number;
  lockLabel?: string;
  onInspect?: (cardId: string) => void;
}) {
  return (
    <button
      type="button"
      className={playable ? 'hand-render' : 'hand-render locked'}
      style={{ transform: `rotate(${tilt}deg)` }}
      onClick={() => cardId && onInspect?.(cardId)}
    >
      <CardRender cardId={cardId} name={name} />
      {!playable ? <span className="lock-note">{lockLabel ?? '现在不能打出'}</span> : null}
    </button>
  );
}

export function CardInspect({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const def = useCardDef(cardId);
  const name = def?.name ?? cardId;
  return (
    <div className="inspect" onClick={onClose} role="presentation">
      <div className="inspect-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={name}>
        <CardRender cardId={cardId} name={name} className="inspect-render" />
        <div className="inspect-copy">
          <p className="eyebrow">卡牌</p>
          <h2>{name}</h2>
          <p>
            {rarityLabel(def?.rarity)}
            {def?.set ? ` · ${setLabel(def.set)}` : ''}
            {def?.dbfId ? ` · dbfId ${def.dbfId}` : ''}
          </p>
          {def?.text ? <p className="inspect-text">{plainCardText(def.text)}</p> : <p className="inspect-text">没有额外说明。</p>}
          <button type="button" className="primary" onClick={onClose}>
            收起
          </button>
        </div>
      </div>
    </div>
  );
}
