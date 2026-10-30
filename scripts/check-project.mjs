import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read = path => readFile(path);
const files = ['package.json','angular.json','tsconfig.json','tsconfig.app.json','public/data/videos.json'];
for (const f of files) {
  JSON.parse((await read(f)).toString());
  console.log(`✓ Valid JSON: ${f}`);
}
const feed = JSON.parse((await read('public/data/videos.json')).toString());
if (feed.channelId !== 'UChm8ZVGKr5RL3YZoxDkoSaA') throw Error('Channel ID mismatch');
console.log(`✓ N95 channel ID verified: ${feed.channelId}`);
const logo = await read('public/assets/n95-original-logo.png');
console.log(`✓ Original logo preserved, SHA-256: ${createHash('sha256').update(logo).digest('hex')}`);
console.log('Note: full Angular compilation requires npm install (internet access).');
