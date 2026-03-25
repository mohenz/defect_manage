const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const targets = [
    'server.js',
    'playwright.config.js',
    'vitest.config.js',
    path.join('js', 'app.js'),
    path.join('js', 'config.js'),
    path.join('js', 'storage.js')
];

let hasFailure = false;

for (const relativeTarget of targets) {
    const fullPath = path.join(projectRoot, relativeTarget);

    if (!fs.existsSync(fullPath)) {
        console.error(`[check:syntax] Missing file: ${relativeTarget}`);
        hasFailure = true;
        continue;
    }

    const result = spawnSync(process.execPath, ['--check', fullPath], {
        encoding: 'utf8'
    });

    if (result.status === 0) {
        console.log(`[check:syntax] OK ${relativeTarget}`);
        continue;
    }

    hasFailure = true;
    console.error(`[check:syntax] FAIL ${relativeTarget}`);
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
}

if (hasFailure) {
    process.exit(1);
}

console.log('[check:syntax] All syntax checks passed.');
