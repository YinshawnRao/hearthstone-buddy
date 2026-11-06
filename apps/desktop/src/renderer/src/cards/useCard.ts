import { useEffect, useState } from 'react';
import { cardAsset, cardCdn, loadCatalog, type CardDef } from './catalog';

export { cardAsset, cardCdn };

export function useCardDef(cardId?: string): CardDef | undefined {
  const [def, setDef] = useState<CardDef | undefined>();
  useEffect(() => {
    if (!cardId) {
      setDef(undefined);
      return;
    }
    let alive = true;
    void loadCatalog().then((map) => {
      if (alive) setDef(map.get(cardId));
    });
    return () => {
      alive = false;
    };
  }, [cardId]);
  return def;
}
