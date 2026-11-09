/**
 * Refresh vendored HearthstoneJSON metadata and the demo card renders.
 *
 * Metadata: https://api.hearthstonejson.com/v1/latest/zhCN/cards.collectible.json
 * Renders:  https://art.hearthstonejson.com/v1/render/latest/zhCN/256x/{cardId}.png
 * Heroes:   https://art.hearthstonejson.com/v1/heroes/latest/256x/{cardId}.png
 *
 * These are community re-hosts maintained by HearthSim, not files taken from the
 * Hearthstone client. Re-run with `npm run cards:refresh`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'apps/desktop/src/renderer/public/cards');
const renderDir = path.join(outDir, 'renders');
const heroDir = path.join(outDir, 'heroes');
const artDir = path.join(outDir, 'art');

const DEMO_RENDERS = [
  'CS2_033',
  'NEW1_012',
  'CS2_127',
  'CS2_200',
  'CS2_029',
  'CS2_024',
  'CS2_023',
  'CS2_032',
  'HERO_08',
  'HERO_05',
  'HERO_08bp'
];
const DEMO_HEROES = ['HERO_08', 'HERO_05'];

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
  return fs.statSync(dest).size;
}

const response = await fetch('https://api.hearthstonejson.com/v1/latest/zhCN/cards.collectible.json');
if (!response.ok) throw new Error(`catalog ${response.status}`);
const cards = await response.json();
const slim = cards.map((card) => ({
  id: card.id,
  dbfId: card.dbfId ?? null,
  name: card.name ?? card.id,
  cost: card.cost ?? null,
  attack: card.attack ?? null,
  health: card.health ?? null,
  armor: card.armor ?? null,
  rarity: card.rarity ?? null,
  set: card.set ?? null,
  type: card.type ?? null,
  cardClass: card.cardClass ?? null,
  text: typeof card.text === 'string' ? card.text : ''
}));

fs.mkdirSync(renderDir, { recursive: true });
fs.mkdirSync(heroDir, { recursive: true });
fs.mkdirSync(artDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(slim));
fs.writeFileSync(
  path.join(outDir, 'source.json'),
  JSON.stringify(
    {
      provider: 'HearthstoneJSON (HearthSim)',
      docs: 'https://hearthstonejson.com/docs/images.html',
      metadata: 'https://api.hearthstonejson.com/v1/latest/zhCN/cards.collectible.json',
      render: 'https://art.hearthstonejson.com/v1/render/latest/zhCN/256x/{cardId}.png',
      art: 'https://art.hearthstonejson.com/v1/256x/{cardId}.jpg',
      hero: 'https://art.hearthstonejson.com/v1/heroes/latest/256x/{cardId}.png',
      refreshedAt: new Date().toISOString(),
      count: slim.length
    },
    null,
    2
  )
);

for (const id of DEMO_RENDERS) {
  const size = await download(
    `https://art.hearthstonejson.com/v1/render/latest/zhCN/256x/${id}.png`,
    path.join(renderDir, `${id}.png`)
  );
  console.log(`render ${id} ${size}`);
}
for (const id of DEMO_RENDERS) {
  const size = await download(
    `https://art.hearthstonejson.com/v1/256x/${id}.jpg`,
    path.join(artDir, `${id}.jpg`)
  );
  console.log(`art ${id} ${size}`);
}
for (const id of DEMO_HEROES) {
  const size = await download(
    `https://art.hearthstonejson.com/v1/heroes/latest/256x/${id}.png`,
    path.join(heroDir, `${id}.png`)
  );
  console.log(`hero ${id} ${size}`);
}
console.log(`catalog ${slim.length} cards`);
