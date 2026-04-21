const fs = require('fs');
const path = require('path');

const nextVersion = process.argv[2];

if (!nextVersion) {
  console.error('[set-workspace-version] version is required');
  process.exit(1);
}

if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(nextVersion)) {
  console.error(
    `[set-workspace-version] invalid version format: ${nextVersion}`
  );
  process.exit(1);
}

const packageFiles = [
  'package.json',
  path.join('feature', 'package.json'),
  path.join('tpl', 'package.json'),
  path.join('detach', 'package.json'),
  path.join('guide', 'package.json'),
];

packageFiles.forEach((relativePath) => {
  const filePath = path.resolve(process.cwd(), relativePath);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.version = nextVersion;
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  process.stdout.write(`[set-workspace-version] updated ${relativePath}\n`);
});
