// options.active of entity.read, as an agent meets it through the MCP (light-bench L18, it65: a model could not read an
// inactive row before reactivating it, because entity.read refused an options property).
// - flow-block-get returns the contract of entity.read with options.active: its values, its refusal, the access policy
//   that receives it, the scope that still applies and the missing-row answer of an inactive row kept from the actor.
// - The entities guide names entity.read beside entity.list and entity.count; the entities-policy guide says what a read
//   by key returns without the option, who decides, and how to reactivate a row.
// Run with Rhino: arguments are the lib_flow_mcp project, then the engine _flow; the entity library beside the MCP answers.
// FLOW_MCP_EXPECT_BASELINE=true runs it against an older MCP and entity: every regression check fails, every contract check passes.
var root=String(new java.io.File(arguments[0]).getCanonicalPath());
var File=java.io.File,FU=Packages.org.apache.commons.io.FileUtils,Files=java.nio.file.Files,results=[];
var negative=String(java.lang.System.getenv('FLOW_MCP_EXPECT_BASELINE')||'')==='true';
function read(p){return String(FU.readFileToString(new File(p),'UTF-8'));}
function guide(name){return read(root+'/_flow/resources/guide/'+name+'.md').replace(/\s+/g,' ');}
function check(v,m,detail,regression){results.push({name:m,passed:!!v,regression:regression!==false});print((v?'PASS ':'FAIL ')+m+(v?'':' '+String(JSON.stringify(detail)).substring(0,600)));}
var cache=new File(root,'../.cache/entity-tests').getCanonicalFile();cache.mkdirs();
var workspace=Files.createTempDirectory(cache.toPath(),'entity-read-active-').toFile(),target=new File(workspace,'ReadApp');
try {
 ['lib_flow_engine','lib_flow_entity','lib_flow_sql','lib_flow_crud_data','lib_flow_mcp'].forEach(function(n){Files.createSymbolicLink(new File(workspace,'c8oprj-'+n.replace(/_/g,'-')).toPath(),new File(root,'../'+n).getCanonicalFile().toPath());});
 var mcpDir=new File(workspace,'c8oprj-lib-flow-mcp');
 var __flowEngineDir=String(new File(workspace,'c8oprj-lib-flow-engine/_flow').getAbsolutePath()),__flowProjectDir=String(mcpDir.getAbsolutePath());
 var engine=eval(read(__flowEngineDir+'/Engine.js')),source=read(String(mcpDir.getAbsolutePath())+'/_flow/flows/McpServer.flow.js'),calls=0;
 function call(name,args){var e=JSON.parse(engine.run(JSON.stringify({flowSource:source,includeTrace:false,input:{request:JSON.stringify({jsonrpc:'2.0',id:++calls,method:'tools/call',params:{name:name,arguments:args}})}})));
  if(!(e.ok===true&&e.result&&e.result.result))throw Error(name+' failed: '+JSON.stringify(e).substring(0,400));return e.result.result.structuredContent;}
 FU.writeStringToFile(new File(target,'c8oProject.yaml'),'convertigo: 8.5.0.m006\n↓ReadApp [core.Project]:\n  version: 1.0\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n','UTF-8');
 var got=call('flow-block-get',{projectDir:String(target.getAbsolutePath()),name:'entity.read'});
 var options=got&&got.ok&&got.block&&got.block.properties&&got.block.properties.options;
 var d=String(options&&options.description||'');
 check(/"active"/.test(d)&&/"inactive"/.test(d)&&/"all"/.test(d)&&/ENTITY_ACTIVE_INVALID/.test(d)&&/input\.request\.payload\.options\.active/.test(d)&&/scope/.test(d)&&/ENTITY_NOT_FOUND/.test(d),
  'entity.read compact contract names options.active, its refusal, the policy, the scope and the missing-row answer',got&&got.block&&got.block.properties);
} finally {FU.deleteDirectory(workspace);}
var entities=guide('entities'),policy=guide('entities-policy');
check(/`entity\.list`, `entity\.count` and `entity\.read`/.test(entities)&&/read by key without it returns the row whatever its state/.test(entities),'entities guide names entity.read with options.active and its default',null);
check(/`entity\.list`, `entity\.count`, `entity\.read`/.test(policy)&&/read by key \(`entity\.read`, the gateway's read\) without `options\.active` returns the row whatever its state/.test(policy)&&
 /receives it as `options\.active: "all"`/.test(policy)&&/`ENTITY_NOT_FOUND`, exactly as a missing key/.test(policy)&&/whether the row exists or not/.test(policy)&&/reactivate a row/.test(policy),
 'entities-policy says what a read by key returns, who decides, the missing-row answer and how to reactivate',null);
check(/Writes by key reach inactive rows/.test(policy),'entities-policy says writes by key reach inactive rows and the scope keeps them away',null);
check(/input\.request\.payload\.options\.active/.test(policy)&&/scope that fixes the active field/.test(policy),'entities-policy keeps the policy and the scope of options.active',null,false);
var expected=results.filter(function(r){return r.regression;}).length,failed=results.filter(function(r){return !r.passed;});
var passed=negative?failed.length===expected&&results.filter(function(r){return !r.regression;}).every(function(r){return r.passed;}):failed.length===0;
print(JSON.stringify({ok:passed,baseline:negative,checks:results.length,expectedBaselineFailures:expected,failures:failed.map(function(r){return r.name;})}));
if(!passed)throw Error('entity-read-active-1110 failed: '+failed.map(function(r){return r.name;}).join(', '));
