// Fast, dependency-free adapter/profile contract; integration uses source-sync-http.py.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const sync = vm.runInNewContext(fs.readFileSync(path.join(root, '_flow/lib/source-sync.js'), 'utf8'));
const ctx = mode => ({convertigoContext:() => ({httpServletRequest:{getHeader:() => mode}})});
assert.equal(sync.visible(ctx(''), 'flow-source-sync'), false);
assert.equal(sync.visible(ctx('sources'), 'flow-source-sync'), true);
for (const name of sync.hidden) {
  assert.equal(sync.visible(ctx(''), name), true);
  assert.equal(sync.visible(ctx('sources'), name), false);
}
for (const name of ['flow-project-bootstrap','code-check','code-get','code-run','code-promote',
  'frontend-svelte-action','authoring-palette','flow-app-progress','tools-more'])
  assert.equal(sync.visible(ctx('sources'),name),true);
assert.equal(sync.target('_flow/flows/Example.flow.js').name,'Example');
assert.equal(sync.target('_flow/blocks/app/hello.block.js').block,'app.hello');
assert.equal(sync.target('_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte').sourceFile,
  '_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte');
assert.equal(sync.target('_c8oProject/sequences/Example.yaml'),null);
console.log('source-sync adapter/profile contract OK');
