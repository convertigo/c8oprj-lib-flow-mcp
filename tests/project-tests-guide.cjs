const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('constructor keeps tests in Git with no secrets or committed cookie jar',()=>{
 const guide=read('_flow/resources/guide/fullstack-paperboard-parallel.md');
 for(const text of ['tests/','Git','.car','environment','outside','cookie jar','never commit','docs/generated/','not published over HTTP'])assert(guide.includes(text),text);
});
test('agent instructions and skills retain the documentation handoff and state HTTP publication',()=>{
 for(const file of ['AGENTS.md','_flow/resources/skills/convertigo-flow-mcp/SKILL.md','_flow/resources/skills/convertigo-flow-backend/SKILL.md','_flow/resources/skills/convertigo-flow-frontend-svelte/SKILL.md']){
  const text=read(file);assert(text.includes('docs/generated/'));assert(text.includes('not published over HTTP'));
 }
});
