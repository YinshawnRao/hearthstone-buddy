export interface CompanionCharacter {
  id: string;
  name: string;
  nameEn: string;
  adult: true;
  tagline: string;
  /** Renderer implementation key. Future Live2D entries would use another key; none exist yet. */
  renderer: 'svg-cheng';
  default: boolean;
}

export const CHARACTERS: CompanionCharacter[] = [
  {
    id: 'cheng',
    name: '澄',
    nameEn: 'Cheng',
    adult: true,
    tagline: '陪你看下一手',
    renderer: 'svg-cheng',
    default: true
  }
];

export function defaultCharacter(): CompanionCharacter {
  return CHARACTERS.find((character) => character.default) ?? CHARACTERS[0];
}

export function findCharacter(id: string | undefined): CompanionCharacter {
  return CHARACTERS.find((character) => character.id === id) ?? defaultCharacter();
}
