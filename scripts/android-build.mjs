// Builds the debug APK: node scripts/android-build.mjs  (also: npm run android:build)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { copyWeb } from './copy-web.mjs';

// Gradle needs Java 21; the system default may be older, so fall back to the Temurin install.
if (!process.env.JAVA_HOME) {
  const base = 'C:/Program Files/Eclipse Adoptium';
  const jdk = fs.existsSync(base) && fs.readdirSync(base).filter((d) => d.startsWith('jdk-21')).sort().pop();
  if (!jdk) throw new Error('JDK 21 not found. Install it or set JAVA_HOME.');
  process.env.JAVA_HOME = path.join(base, jdk);
}

const run = (cmd, cwd = '.') => execSync(cmd, { cwd, stdio: 'inherit' });
console.log(`copied ${copyWeb('.', 'www')} web files`);
run('npx cap sync android');
run(process.platform === 'win32' ? '.\\gradlew.bat assembleDebug' : './gradlew assembleDebug', 'android');
console.log('APK: android/app/build/outputs/apk/debug/app-debug.apk');
