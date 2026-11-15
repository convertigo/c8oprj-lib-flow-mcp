// Browser proof must reuse contexts and release Convertigo sessions before closing them.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const guideFamily = require('./support/guide-family.cjs');

const root = path.resolve(__dirname, '..');
const guideDir = path.join(root, '_flow/resources/guide');
const read = name => fs.readFileSync(path.join(guideDir, name + '.md'), 'utf8');
const normalize = text => text.replace(/\s+/g, ' ');
const proofGuides = [
  ['frontend-svelte-proof', 'frontend-svelte'],
  ['frontend-svelte/loop', 'frontend-svelte'],
  ['multipage-entities/proof', 'multipage-entities'],
];

for (const [name, family] of proofGuides) {
  const source = read(name);
  const served = normalize(guideFamily(root, family));
  const proof = normalize(source);
  assert.ok(served.includes(proof), `${name}: proof is absent from the served ${family} guide`);
  assert.match(proof, /reuse the current browser context|reuse the current context/i, `${name}: reuse the current context`);
  assert.match(proof, /at most one additional context per role/i, `${name}: at most one context per role`);
  assert.match(proof, /sign out[^.]*before closing/i, `${name}: sign out before closing a context`);
  assert.match(proof, /only 5 HTTP sessions in Standard Edition/i, `${name}: development HTTP session limit`);
  assert.match(proof, /each browser context can occupy one for 30 minutes/i, `${name}: session lifetime`);
  assert.match(proof, /all MCP calls suddenly fail[^.]*suspect the session limit[^.]*sign out and close test contexts, retry once, and report/i,
    `${name}: recover and report simultaneous MCP failures`);
}

for (const [name, destination] of [
  ['frontend-svelte', 'frontend-svelte-proof'],
  ['multipage-entities', 'multipage-entities/proof'],
]) {
  assert.ok(read(name).includes(`flow://guide/${destination}`), `${name}: link to proof guide`);
}

for (const name of [...proofGuides.map(([name]) => name), 'frontend-svelte', 'multipage-entities']) {
  const examples = [...read(name).matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map(match => match[1]).join('\n');
  assert.doesNotMatch(examples, /\bbrowser\s*\.\s*newContext\s*\(/,
    `${name}: examples must reuse the current context, not create one per verification`);
}

console.log(JSON.stringify({ ok: true, proofGuides: proofGuides.length, summaries: 2 }));
