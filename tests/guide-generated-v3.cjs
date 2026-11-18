// The generated zones of the FlowScript v3 guides are up to date with the specification (tools/gen-v3-guides.cjs --check),
// and the generator detects a stale zone, an unknown id and an unclosed zone.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const gen = require('../tools/gen-v3-guides.cjs');

const checked = spawnSync(process.execPath, [path.join(__dirname, '../tools/gen-v3-guides.cjs'), '--check'], { encoding: 'utf8', env: process.env });
assert.equal(checked.status, 0, 'generated zones are stale or the sources are missing; run node tools/gen-v3-guides.cjs\n' + checked.stdout + checked.stderr);

const report = gen.run(false);
const zones = report.reduce((sum, item) => sum + item.zones, 0);
assert.ok(zones >= 15 && report.length >= 6, 'the v3 guides carry generated zones: ' + zones + ' in ' + report.length + ' files');
const kinds = new Set();
for (const item of report) for (const match of fs.readFileSync(item.file, 'utf8').matchAll(gen.ZONE)) kinds.add(match[1]);
for (const kind of ['v3-forms', 'v3-refusals', 'v3-example', 'v3-fragment']) assert.ok(kinds.has(kind), 'a guide uses a ' + kind + ' zone');

const src = gen.sources();
const zone = (kind, params, body) => '<!-- generated:' + kind + params + ' -->' + body + '<!-- /generated -->';
// A stale zone is reported, and rewritten by regeneration.
const stale = zone('v3-refusals', ' format=bullets codes=BREAK', '\n- outdated\n');
const result = gen.regenerate('prose\n' + stale + '\nprose', src, 'sample');
assert.deepEqual(result.stale, ['v3-refusals format=bullets codes=BREAK']);
assert.match(result.next, /`FLOWSCRIPT_V3_BREAK`/);
assert.equal(gen.regenerate(result.next, src, 'sample').stale.length, 0, 'regeneration is idempotent');
// Unknown ids and kinds, unclosed zones fail.
assert.throws(() => gen.regenerate(zone('v3-refusals', ' codes=NOPE', '\n'), src, 'sample'), /Unknown refusal NOPE/);
assert.throws(() => gen.regenerate(zone('v3-example', ' id=nope', '\n'), src, 'sample'), /Unknown example nope/);
assert.throws(() => gen.regenerate(zone('v3-fragment', ' id=nope', '\n'), src, 'sample'), /Unknown fragment nope/);
assert.throws(() => gen.regenerate(zone('v3-other', '', '\n'), src, 'sample'), /Unknown generated zone kind/);
assert.throws(() => gen.regenerate('<!-- generated:v3-forms -->\nno end', src, 'sample'), /not closed/);
// The check mode fails on a stale copy of a guide (a temporary root, nothing of the guides is touched).
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-v3-guides-'));
try {
  const copy = path.join(temporary, 'guide.md');
  fs.writeFileSync(copy, 'x\n' + zone('v3-forms', ' format=inline ids=push', '`old`') + '\n');
  const text = fs.readFileSync(copy, 'utf8');
  assert.equal(gen.regenerate(text, src, copy).stale.length, 1);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
console.log('guide-generated-v3 OK: ' + zones + ' zones in ' + report.length + ' files');
