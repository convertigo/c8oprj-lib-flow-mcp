const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(process.env.PATCH_BLOCK_PATH||'_flow/blocks/mcp/tool/flow/resource/patch.block.js','utf8');
const block=vm.runInNewContext(source.slice(source.indexOf('(function')));
const patch=vm.runInNewContext(fs.readFileSync('_flow/lib/patch.js','utf8'));
test('a refused SQL schema patch retains its diagnostic and cannot claim that it was written',()=>{
 const args={path:'_flow/resources/sql/schema.json',content:'{"version":1,"tables":[]}',baseHash:'h'};
 const error={ok:false,error:{code:'SQL_SCHEMA_PROPERTY_UNKNOWN',message:'schema.json at line 2: unknown references',details:{line:2,property:'references'}}};
 const mcp={requestValue:()=>({}),toolArguments:()=>args,runToolBlock:(_ctx,_req,_opts,call)=>call(args)};
 const ctx={props:()=>({}),lib:name=>name==='mcp'?mcp:patch,resourceGet:()=>({content:'{}',hash:'h'}),resourcePatch:()=>error,write:()=>{}};
 const out=block.run(ctx,{});assert.equal(out.ok,false);assert.equal(out.error.details.line,2);assert.ok(!out.next || !/Written as sent/.test(out.next));
});
