// Every declared outputSchema applies to the finalized structuredContent, not to content.
const assert = require('node:assert/strict');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const Ajv = require(require.resolve('ajv', {paths:[process.env.FLOW_FRONTBUILDER_RESOURCE_ROOT]}));
const output = execFileSync('java', ['-cp', process.env.CONVERTIGO_TEST_CLASSPATH,
  'org.mozilla.javascript.tools.shell.Main', '-version', '200',
  path.join(__dirname, 'fixtures/tool-output-contract.js'), root, process.env.FLOW_ENGINE_RESOURCE_ROOT],
  {encoding:'utf8', maxBuffer:16*1024*1024, timeout:90000});
const data = JSON.parse(output.split('\n').find(line => line.startsWith('OUTPUT_CONTRACT:')).slice(16));
const ajv = new Ajv({strict:false, allErrors:true});
const tools = new Map(data.tools.map(tool => [tool.name, tool]));
const validators = new Map(data.tools.filter(tool => tool.outputSchema).map(tool => [tool.name, ajv.compile(tool.outputSchema)]));
assert(tools.size >= 40, 'Expected the real public catalog');
function check(name, result) {
  assert(Array.isArray(result.content), 'Missing MCP content');
  if (result.isError === true) {
    assert(result.content.some(block => block.type === 'text' && block.text), 'Errors need a readable diagnostic');
    return; // MCP tool errors need not satisfy the success output contract.
  }
  assert(!result.structuredContent?.error && result.structuredContent?.ok !== false, 'Failure must set isError');
  const validate = validators.get(name);
  if (validate) {
    assert(Object.hasOwn(result, 'structuredContent'), name + ' advertises outputSchema but omitted structuredContent');
    assert(validate(result.structuredContent), name + ': ' + JSON.stringify(validate.errors));
  }
}
for (const entry of data.cases) {
  try {
    if (/^(?:error|failed)-/.test(entry.label)) assert.equal(entry.result.isError, true, 'Failure was not signalled');
    check(entry.name, entry.result);
  }
  catch (error) { throw new Error(entry.label + ': ' + error.message, {cause:error}); }
}
// Guard the guard: missing/invalid structure and a disguised error must all fail.
const name = validators.keys().next().value;
for (const bad of [{content:[]}, {content:[],structuredContent:[]},
  {content:[],structuredContent:{operatorNote:42}}, {content:[],structuredContent:{ok:false}}]) {
  assert.throws(() => check(name,bad));
}
check(name,{content:[{type:'text',text:'Expected refusal'}],isError:true});
const resource = tools.get('flow-resource-get');
assert(!Object.hasOwn(resource,'outputSchema'), 'The optional text result cannot promise structured output');
assert(data.cases.some(entry => entry.name === resource.name && !entry.result.isError && !entry.result.structuredContent),
  'Expected a successful text-only resource result');
console.log(`tool-output-contract OK (${tools.size} tools, ${validators.size} schemas, ${data.cases.length} finalized results)`);
