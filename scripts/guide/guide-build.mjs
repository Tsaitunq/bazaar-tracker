// Builds the debug APK of the guide app: node scripts/guide/guide-build.mjs  (also: npm run guide:build). With --sync it stops before Gradle.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { copyGuide, capConfig } from './guide-copy.mjs';

// Gradle needs Java 21; the system default may be older, so fall back to the Temurin install.
if (!process.env.JAVA_HOME) {
  const base = 'C:/Program Files/Eclipse Adoptium';
  const jdk = fs.existsSync(base) && fs.readdirSync(base).filter((d) => d.startsWith('jdk-21')).sort().pop();
  if (!jdk) throw new Error('JDK 21 not found. Install it or set JAVA_HOME.');
  process.env.JAVA_HOME = path.join(base, jdk);
}

// The SDK path is per machine and not in git; this machine already has it for the Bazaar app.
if (!fs.existsSync('apps/guide/android/local.properties') && fs.existsSync('apps/bazaar/android/local.properties')) fs.copyFileSync('apps/bazaar/android/local.properties', 'apps/guide/android/local.properties');

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
console.log(`copied ${copyGuide('.', 'apps/guide/www-guide')} web files`);

run('npx cap sync android', 'apps/guide');
fs.writeFileSync('apps/guide/android/app/src/main/assets/capacitor.config.json', capConfig('.'));
if (!process.argv.includes('--sync')) {
  run(process.platform === 'win32' ? '.\\gradlew.bat assembleDebug' : './gradlew assembleDebug', 'apps/guide/android');
  console.log('APK: apps/guide/android/app/build/outputs/apk/debug/app-debug.apk');
}
