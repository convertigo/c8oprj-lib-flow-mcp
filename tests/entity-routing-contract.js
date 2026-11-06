/* Lightweight documentation contract only: no runtime, model, network or exercise input. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// A guide and its sub-guides (<name>-*.md; start-rules for start), entry first, size annotations removed.
const guide = name => fs.readdirSync(path.join(root, '_flow/resources/guide'))
  .filter(file => file.startsWith(name + '-') && file.endsWith('.md')).sort()
  .reduce((text, file) => text + '\n\n' + read('_flow/resources/guide/' + file), read('_flow/resources/guide/' + name + '.md'))
  .replace(/ \(\d+\.\d KB\)/g, '');
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
assert.ok(guide('multipage-entities').includes('flow-project-bootstrap({project,ui:true,references:["lib_flow_entity","lib_flow_sql","lib_flow_crud_data"]})'), 'The nominal bootstrap includes the entity reference in one call');
const entityGet = read('_flow/blocks/mcp/tool/flow/entity/model/get.block.js');
assert.ok(entityGet.includes('lib_flow_entity') && entityGet.includes('flow://guide/multipage-entities'));
assert.match(start, /imposed HTTP contract[\s\S]*?Your own HTTP contract over entities/);
assert.match(backend, /Imposed HTTP names, error codes\/statuses and JSON keys also keep entities/);
const entities = guide('entities');
assert.ok(entities.indexOf('## Your own HTTP contract over entities') < entities.indexOf('## Authentication'));
assert.ok(entities.indexOf('<!-- example: http-save-reservation -->') < entities.indexOf('## Authentication'));
for (const code of ['ENTITY_UNAUTHENTICATED', 'ENTITY_FORBIDDEN', 'ENTITY_NOT_FOUND', 'ENTITY_VALIDATION', 'ENTITY_CONFLICT', 'BOOKING_WINDOW_CONFLICT']) assert.ok(entities.includes('| ' + (code === 'BOOKING_WINDOW_CONFLICT' ? "Your hook's code/status" : code)), code + ' has an adaptation policy');
const multi = guide('multipage-entities');
const quick = multi.slice(multi.indexOf('## Quick path'), multi.indexOf('Use this route'));
assert.ok(quick.split('\n').length >= 30 && quick.split('\n').length <= 50, 'Quick path stays readable in 30–50 lines');
assert.ok(quick.includes('HTTP') && quick.includes('Possédé') && quick.includes('The detail follows'));
console.log('entity-routing-contract: documentation entry points agree');

// The front follows the same project-local boundary as HTTP facades.
for (const name of ['entities', 'multipage-entities', 'frontend-svelte']) {
  const text = guide(name);
  assert.ok(text.includes('EntityGateway') && text.includes('targetProject'), name + ' states the local transport default');
  assert.ok(text.includes('ownershipFilter'), name + ' separates display filtering from policy scope');
  assert.ok(!/targetProject="(?:BookingApp|EquipmentApp)"/.test(text), name + ' keeps the nominal path configuration-free');
}
for (const text of [router, backend, frontend]) {
  assert.ok(text.includes('targetProject') && text.includes('optional'), 'Skills document optional cross-project transport');
  assert.ok(text.includes('context.permissions.create'), 'Custom New commands follow describe capabilities');
}
assert.ok(!multi.includes('following frontend palier'), 'The recipe is usable without a future transport step');
assert.match(multi, /<Toolbar><If[^>]+context\.permissions\.create/);
assert.ok(!multi.includes('scope="mine"'), 'The nominal page relies on the server owner perimeter');
console.log('entity-front-guide-contract: local transport, capabilities and display filters agree');

// The backend contract distinguishes static authorization from row/hook decisions.
const ddlGuarantee = 'A refusal by a policy, model ACL or authorization slot, including on a relation target needed by options or validation, triggers no DDL (a refused target only omits labels); a refusal depending on data or a hook can occur after schema creation.';
for (const [name, text] of Object.entries({entities, multi, router, backend})) {
  assert.ok(text.includes(ddlGuarantee), name + ': ' + ddlGuarantee);
  assert.ok(!text.includes('refusal causes no DDL'), name + ' must not promise rollback of bootstrap DDL');
}
assert.ok(entities.includes('SQL_TRANSACTION_ROLLBACK_ONLY') && entities.includes('even if its error is caught'));
console.log('entity-backend-review-contract: exact DDL guarantee and borrowed rollback semantics agree');

for (const text of [entities, multi, router, backend]) {
  assert.ok(text.includes('MariaDB') && text.includes('HSQLDB') && text.includes('PostgreSQL'));
  assert.ok(text.includes('private:false') && /without (?:a )?guards?/.test(text));
  assert.ok(text.includes('dryRun:true') && text.includes('code-run'));
}
assert.ok(entities.includes('metadata-only') && entities.includes('explicit public keys'));
assert.ok(!entities.includes('403 with the available additive plan'));
console.log('entity-publication-contract: exported unguarded blocks, typed scope and bounded public diagnostics');
