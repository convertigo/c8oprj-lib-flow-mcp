const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Whitespace-insensitive: the guide may rewrap its lines or rename the local variable.
const guide = fs.readFileSync(path.join(__dirname, '../_flow/resources/guide/authoring/blocks.md'), 'utf8').replace(/\s+/g, ' ');

test('the HTTP guide proves an anonymous form POST against the engine URL, never a guessed port', () => {
  assert.match(guide, /const (\w+) = endpoint\.current\(\{\}\)/);
  assert.match(guide, /\w+\.convertigoUrl \+ "\/projects\/<project>\/\.json"/);
  assert.match(guide, /method: "POST"/);
  assert.match(guide, /"Content-Type": "application\/x-www-form-urlencoded"/);
  assert.match(guide, /__sequence: "<Flow>"/);
  assert.match(guide, /cookies: "request"/);
  assert.match(guide, /Never guess the host or port\./);
  assert.match(guide, /convertigo\.flow\.http\.allowedHosts/);
});
