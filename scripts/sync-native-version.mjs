#!/usr/bin/env node
/**
 * Keep the Android manifest version in sync with the web app version.
 *
 * versionCode must increase for every Play Store upload, so it is derived
 * deterministically (major * 10000 + minor * 100 + patch) and can be
 * overridden with ANDROID_VERSION_CODE when a build is re-cut.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const gradlePath = path.join(root, 'android/app/build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.error('[native-version] android/app/build.gradle not found');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = String(process.env.ANDROID_VERSION_NAME ?? pkg.version ?? '').trim();
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);

if (!match) {
  console.error(
    `[native-version] package version "${version}" is not a plain x.y.z semver`
  );
  process.exit(1);
}

const [major, minor, patch] = match.slice(1).map(Number);
const derivedCode = major * 10000 + minor * 100 + patch;
const versionCode = Number(process.env.ANDROID_VERSION_CODE ?? derivedCode);

if (!Number.isInteger(versionCode) || versionCode < 1) {
  console.error(`[native-version] invalid versionCode "${versionCode}"`);
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');
const codePattern = /versionCode\s+\d+/;
const namePattern = /versionName\s+"[^"]*"/;

if (!codePattern.test(gradle) || !namePattern.test(gradle)) {
  console.error('[native-version] versionCode/versionName not found in build.gradle');
  process.exit(1);
}

gradle = gradle
  .replace(codePattern, `versionCode ${versionCode}`)
  .replace(namePattern, `versionName "${version}"`);
fs.writeFileSync(gradlePath, gradle);

console.log(`[native-version] versionName=${version} versionCode=${versionCode}`);
