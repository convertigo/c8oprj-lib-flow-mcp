'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const guideDir = path.join(root, '_flow/resources/guide');
const skillDir = path.join(root, '_flow/resources/skills');
const files = fs.readdirSync(guideDir).filter(name => name.endsWith('.md')).map(name => path.join(guideDir, name));
for (const name of fs.readdirSync(skillDir)) {
  const file = path.join(skillDir, name, 'SKILL.md');
  if (fs.existsSync(file)) files.push(file);
}
for (const file of files) {
  const body = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(body, /throw(?:Flow)?\s*(?:\(|\{)[^\n]*\bstatus\b/i, file);
  assert.doesNotMatch(body, /\{\s*code\s*,\s*message\s*,\s*status\s*\}/i, file);
  assert.doesNotMatch(body, /(?:HTTP status is its `status`|error\.status|code\/status reach|code\/status in catch|HTTP [45]\d\d and .*error)/i, file);
  assert.doesNotMatch(body, /\b[A-Z][A-Z0-9_]+ \/ [45]\d\d\b/, file);
}
const authoring = fs.readFileSync(path.join(guideDir, 'authoring-data.md'), 'utf8');
const backend = fs.readFileSync(path.join(skillDir, 'convertigo-flow-backend/SKILL.md'), 'utf8');
for (const [name, body] of [['authoring-data', authoring], ['backend skill', backend]]) {
  assert.match(body, /requester \(\.json, SDK, frontbuilder\)[\s\S]{0,100}200 and the `error` envelope; do not set `status`/i, name);
}
console.log('no-requester-status-guidance OK');
