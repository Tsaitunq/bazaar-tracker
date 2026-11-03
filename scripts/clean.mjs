// Removes what the builds and checks write: npm run clean. Nothing in git, nothing in personal/.
import fs from 'node:fs';

const OUTPUTS = ['www', 'www-guide', 'android/app/build', 'android-guide/app/build', 'guide-shots'];

for (const dir of OUTPUTS) {
  if (!fs.existsSync(dir)) continue;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`removed ${dir}`);
}
