// Real JSON Schema validation, including strict success schemas, using the frontend test bench's Ajv.
// FLOW_FRONTBUILDER_RESOURCE_ROOT=... node tests/tool-error-schemas.cjs <Rhino classpath> <project>
const assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const provider=process.env.FLOW_FRONTBUILDER_RESOURCE_ROOT;
if(!provider)throw Error('Set FLOW_FRONTBUILDER_RESOURCE_ROOT to the installed frontend test bench.');
const Ajv=require(require.resolve('ajv',{paths:[provider]}));
const project=path.resolve(process.argv[3]||path.join(__dirname,'..'));
const output=execFileSync('java',['-cp',process.argv[2],'org.mozilla.javascript.tools.shell.Main','-version','200',path.join(project,'tests/tool-errors.js'),project,'--schemas'],{encoding:'utf8'});
const fixtures=JSON.parse(output.split('\n').find(line=>line.startsWith('SCHEMA_FIXTURES:')).slice('SCHEMA_FIXTURES:'.length));
const validate=new Ajv({strict:false,allErrors:true}).compile(fixtures.schema);
for(const value of [fixtures.ordinary,fixtures.vibe,{answer:42},{error:{context:'string',newField:{nested:true}}}])assert(validate(value),JSON.stringify(validate.errors));
for(const value of [{answer:'wrong'},{answer:42,extra:'not allowed'},{}, {error:'not an object'}])assert(!validate(value),'Strict schema accepted '+JSON.stringify(value));
console.log('tool-error-schemas OK (8 real Ajv validations)');
