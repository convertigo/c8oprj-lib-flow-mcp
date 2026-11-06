/* The entity model example is one text: the model contract of the tools, the entities guide, the skills that
   route to entities and the example an empty flow-entity-model-get returns (lib_flow_entity) are identical. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const tools = read('_flow/blocks/mcp/tools/available.block.js');
const literal = /var ENTITY_MODEL_FORMAT = ([\s\S]*?);\n/.exec(tools);
assert.ok(literal, 'The model contract is one string constant');
const contract = vm.runInNewContext(literal[1]);
const fromContract = /Example: (\{.*\})$/.exec(contract);
assert.ok(fromContract, 'The model contract ends with its example');
const example = fromContract[1];
JSON.parse(example);

const guide = /<!-- example: model-format -->\s*```json\n([\s\S]*?)\n```/.exec(read('_flow/resources/guide/entities.md'));
assert.ok(guide && guide[1] === example, 'The entities guide holds the same example');
for (const name of ['convertigo-flow-backend', 'convertigo-flow-mcp']) {
  const skill = read('_flow/resources/skills/' + name + '/SKILL.md');
  const inline = /`(\{"version":2,[^`]*\})`/.exec(skill);
  assert.ok(inline && inline[1] === example, name + ' holds the same example');
  assert.ok(/EntityTable/.test(skill) && /EntityForm/.test(skill) && /EntityGateway/.test(skill) && /Journalisé/.test(skill) &&
    /roles,\s+lists and forms/.test(skill), name + ' says when entities pay and what they give');
}
const library = ['lib_flow_entity', 'c8oprj-lib-flow-entity'].map(n => path.join(root, '..', n, '_flow/lib/entity-format.js')).find(f => fs.existsSync(f));
assert.ok(library, 'The sibling lib_flow_entity is required');
const format = vm.runInNewContext(fs.readFileSync(library, 'utf8'));
assert.strictEqual(JSON.stringify(format.example()), example, 'lib_flow_entity returns the same example');
console.log('entity-model-example-contract: contract, guide, skills and library share one example');
