import { readFileSync, writeFileSync } from 'fs';

const type = process.argv[2] || 'patch';
if (!['major', 'minor', 'patch'].includes(type)) {
  console.error('Usage: node scripts/bump-version.mjs [major|minor|patch]');
  process.exit(1);
}

function bumpVersion(version, bump) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const oldVersion = manifest.version;
const newVersion = bumpVersion(oldVersion, type);

manifest.version = newVersion;
pkg.version = newVersion;

writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log(`Bumped ${type}: ${oldVersion} → ${newVersion}`);
