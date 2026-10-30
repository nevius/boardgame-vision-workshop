// Tiny test runner, no dependencies. Runs every tests/*.test.js file.
// A test file exports functions; each one is a test. Throw (or fail an assert) to fail.
// Run: node tests/run.js
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();
let passed = 0;
let failed = 0;

for (const file of files) {
  const tests = await import(pathToFileURL(join(dir, file)).href);
  for (const [name, test] of Object.entries(tests)) {
    try {
      await test();
      passed++;
      console.log(`ok   ${file} › ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${file} › ${name}\n     ${err.message}`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) process.exit(1);
