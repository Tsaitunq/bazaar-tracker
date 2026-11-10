// CPU time per request of the deployed worker, read from `wrangler tail`.
// Usage (in apps/api):  npm run measure -- https://<worker-url> <your-name> <profile-id>
// Prints status, cache state and CPU/wall ms per request. Names, ids and URLs are never printed or written to a file.
import { spawn } from 'node:child_process';

const [base, name, profileId] = process.argv.slice(2);
if (!base || !name || !profileId) {
  console.error('usage: npm run measure -- <worker-url> <name> <profile-id>');
  process.exit(1);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const events = [];

const tail = spawn('npx', ['wrangler', 'tail', '--format', 'json'], { shell: true, stdio: ['ignore', 'pipe', 'inherit'] });
let buf = '';
tail.stdout.on('data', (d) => {
  buf += d;
  const lines = buf.split('\n');
  buf = lines.pop();
  for (const l of lines) {
    try {
      const e = JSON.parse(l);
      if (typeof e.cpuTime === 'number') events.push({ cpu: e.cpuTime, wall: e.wallTime, outcome: e.outcome });
    } catch { /* not a JSON line */ }
  }
});

await wait(8000); // tail needs a moment to connect
const calls = [
  ['profiles (1st, usually MISS)', `/v1/profiles/${name}`],
  ['profiles (2nd, HIT)', `/v1/profiles/${name}`],
  ['profile  (1st, usually MISS)', `/v1/profile/${name}/${profileId}`],
  ['profile  (2nd, HIT)', `/v1/profile/${name}/${profileId}`],
];
const rows = [];
for (const [label, path] of calls) {
  const res = await fetch(base.replace(/\/$/, '') + path);
  await res.arrayBuffer();
  rows.push([label, res.status, res.headers.get('X-Cache'), res.headers.get('X-Cache-Mojang')]);
  await wait(1500);
}
await wait(4000); // late tail events
tail.kill();

console.log('request                        status  cache  mojang  cpu ms  wall ms');
rows.forEach((r, i) => {
  const e = events[i];
  const cols = [r[0].padEnd(30), String(r[1]).padEnd(7), String(r[2]).padEnd(6), String(r[3]).padEnd(7), String(e ? e.cpu : '?').padEnd(7), e ? e.wall : '?'];
  console.log(cols.join(' '));
});
if (events.length !== rows.length) console.log(`note: ${events.length} tail events for ${rows.length} requests; rows may not line up, repeat the run`);
