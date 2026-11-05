/* Lightweight documentation contract only: no runtime, model, network or exercise input. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const guide = name => read('_flow/resources/guide/' + name + '.md');
const skill = name => read('_flow/resources/skills/convertigo-flow-' + name + '/SKILL.md');
const start = guide('start');
const router = skill('mcp');
const backend = skill('backend');
const frontend = skill('frontend-svelte');
const alternative = guide('multipage-roles');
const bootstrap = read('_flow/blocks/project/bootstrap.block.js');
const tools = read('_flow/blocks/mcp/tools/available.block.js');

assert.match(start, /\| Any persisted business data with roles: add the `lib_flow_entity` project reference \| `flow:\/\/guide\/entities`, then `flow:\/\/guide\/multipage-entities` \|/);
assert.match(start, /## Authentication and add-ons/);
for (const anchor of ['authentication', 'demo-login', 'export-csv', 'scheduled-jobs', 'audit']) {
  const resource = anchor === 'authentication' ? 'entities' : 'multipage-entities';
  assert.ok(start.includes('flow://guide/' + resource), anchor + ' stays independent of direct SQL');
  const title = { authentication: 'Authentication', 'demo-login': 'Demo login', 'export-csv': 'Export CSV', 'scheduled-jobs': 'Scheduled jobs', audit: 'Audit' }[anchor];
  assert.ok(guide(resource).includes('## ' + title), 'The target section exists: ' + title);
}
for (const text of [start, router, backend, frontend, alternative]) {
  assert.ok(/persisted business data/.test(text), 'Every entry states the data criterion');
  assert.ok(/explicit(?:ly requests| request| user request)/.test(text), 'Direct SQL needs an explicit request');
  assert.ok(!text.includes('without an entity model'), 'Absence of an authored model cannot choose SQL');
  assert.ok(!/without an entity model \(sign-in, an export or a\s+scheduled job\)/.test(text));
}
assert.ok(backend.indexOf('Choose the data route') < backend.indexOf('- Data access'), 'Choose entities before low-level storage discovery');
assert.match(backend, /do not duplicate entity\s+fields in a separate SQL schema/);
assert.match(alternative, /persisted room-booking example below applies only to an explicit request\s+for direct SQL/);
assert.ok(!bootstrap.includes('See flow://guide/multipage-roles.'), 'Bootstrap demo note points to neutral authentication');
assert.ok(bootstrap.includes('flow://guide/start'));
assert.match(tools, /name === "flow-project-bootstrap"[\s\S]*?description = "[^"\n]*persisted business data with roles[^"\n]*lib_flow_entity/);
assert.ok(!/flow:\/\/guide\/[A-Za-z-]+#/.test(start), 'Guide reads use canonical whole-resource URIs, with section labels in prose');
assert.match(start, /String\(config\.demo\.login\) === "true"/);
assert.match(start, /false by default/);
for (const name of ['fullstack-paperboard', 'frontend-svelte', 'crud']) {
  const text = guide(name);
  assert.ok(text.includes('flow://guide/entities') && text.includes('flow://guide/multipage-entities'), name + ' preserves the entity route');
}
const upsert = read('_flow/blocks/mcp/tool/flow/crud/upsert.block.js');
assert.ok(!upsert.includes('Use it first'), 'Generated CRUD tool cannot override the entity default');
assert.ok(upsert.includes('explicitly requests generated CRUD') && upsert.includes('prefer interpreted entities by default'));
const entityGet = read('_flow/blocks/mcp/tool/flow/entity/model/get.block.js');
assert.ok(entityGet.includes('lib_flow_entity') && entityGet.includes('flow://guide/multipage-entities'));
console.log('entity-routing-contract: documentation entry points agree');
