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
for (const name of ['flow-project-bootstrap','code-check','code-get','code-run','code-rg','code-status',
  'frontend-svelte-action','authoring-palette','flow-app-progress','tools-more','flow-entity-model-check'])
  assert.equal(sync.visible(ctx('sources'),name),true);
// Once the disk is saved there is no working copy: the draft tools are hidden with the writers.
for (const name of ['code-promote','code-discard']) assert.equal(sync.visible(ctx('sources'),name),false);
const t = p => JSON.parse(JSON.stringify(sync.target(p)));
assert.deepEqual(t('_flow/flows/Example.flow.js'),{type:'flow',args:{name:'Example'}});
assert.deepEqual(t('_flow/blocks/app/hello.block.js'),{type:'block',args:{block:'app.hello'}});
// The browser implementation of a block is checked and saved for target frontend, deduced from the file name.
assert.deepEqual(t('_flow/blocks/app/hello.browser.js'),{type:'browser',args:{block:'app.hello',target:'frontend'}});
assert.deepEqual(t('_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte'),
  {type:'source',args:{sourceFile:'_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte'}});
assert.deepEqual(t('_flow/frontbuilder/svelte/model/App/src/app.flow.css').type,'source');
assert.deepEqual(t('_flow/data/model.yaml'),{type:'model',args:{}});
// The code dispatcher reads `kind`: the selecting arguments never carry it.
for (const p of ['_flow/flows/Example.flow.js','_flow/blocks/app/hello.block.js','_flow/blocks/app/hello.browser.js'])
  assert.equal('kind' in sync.target(p).args,false);
assert.equal(sync.target('_c8oProject/sequences/Example.yaml'),null);
assert.equal(sync.target('_flow/schemas/Example.json'),null);
console.log('source-sync adapter/profile contract OK');
