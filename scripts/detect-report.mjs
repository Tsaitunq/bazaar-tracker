// Local check of the guide mapping against the private test copy. Prints guide entries only: no values, ids or counts of the profile.
import { readFileSync, readdirSync } from 'node:fs';
import { summarize } from '../profile.js';
import { detectGuide } from '../detect.js';
import { stepKey } from '../progress.js';

const dir = 'personal/guides';
const profile = await summarize(JSON.parse(readFileSync('personal/fixtures/profile-fixture.json', 'utf8')).members.self);
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
  const guide = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
  const found = detectGuide(guide, profile, stepKey);
  const lists = { erkannt: [], unsicher: [], 'nicht erkannt': [] };
  for (const section of guide.sections) {
    for (const step of section.steps) {
      const f = found.get(stepKey(section, step));
      const parts = [step.detect ?? []].flat();
      const kinds = [...new Set(parts.map((d) => d.kind))].join('+');
      const soft = parts.find((d) => d.soft)?.soft;
      const label = `${section.name} | ${step.text}`;
      if (!step.detect) lists['nicht erkannt'].push(`${label} -- ${step.manual ?? 'keine Regel'}`);
      else if (!f) lists.unsicher.push(`${label} -- Profildaten fehlen`);
      else if (f.have >= f.need) lists.erkannt.push(`${label} -- ${kinds}`);
      else if (soft && !(parts.length === 1 && f.have)) lists.unsicher.push(`${label} -- ${soft}${f.have ? ' (teilweise erfuellt)' : ''}`);
      else lists['nicht erkannt'].push(`${label} -- Regel ${kinds}: ${f.have ? 'teilweise erfuellt' : 'nicht erfuellt'}`);
    }
  }
  console.log(`\n=== ${guide.title}: ${Object.entries(lists).map(([k, v]) => `${k} ${v.length}`).join(', ')}`);
  for (const [name, rows] of Object.entries(lists)) console.log(`\n-- ${name}\n${rows.join('\n')}`);
}
