// flow-entity-model-set needs an entity library whose entity.model.set declares the gateway option: an older one
// ignores that option and creates a public EntityGateway on every model set. With such a library the tool refuses,
// says to update lib_flow_entity, and writes nothing: no model, no policy, no gateway.
// The older library is the current one with the model set block and the scaffold of lib_flow_entity 2b62e53
// (tests/fixtures/entity-2b62e53), or a checkout named by FLOW_MCP_ENTITY_BASELINE_LIBRARY.
// Run under the same Rhino/JVM classpath as entity-model-tools.js; arguments: MCP project, then engine _flow (unused:
// the engine beside the MCP runs).
var projectDir = arguments.length > 0 ? arguments[0] : ".";
var engineDir = arguments.length > 1 ? arguments[1] : "../lib_flow_engine/_flow";
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var Files = java.nio.file.Files;
var cache = new java.io.File(projectDir,"../.cache/entity-tests").getCanonicalFile();cache.mkdirs();
var workspace = Files.createTempDirectory(cache.toPath(),"entity-mcp-pair-").toFile();
var target = new java.io.File(workspace,"PairTest");
var calls=0,assertions=0;
function assert(value,message){assertions++;if(!value)throw new Error(message);}
var named = String(java.lang.System.getenv("FLOW_MCP_ENTITY_BASELINE_LIBRARY") || "");
var older;
if (named) older = new java.io.File(named).getCanonicalFile();
else {
 older = new java.io.File(workspace,"lib_flow_entity_2b62e53");
 FileUtils.copyDirectory(new java.io.File(projectDir,"../lib_flow_entity").getCanonicalFile(),older,function(f){return String(f.getName())!==".git";});
 [["set.block.js","_flow/blocks/entity/model/set.block.js"],["entity-scaffold.js","_flow/lib/entity-scaffold.js"]].forEach(function(p){
  FileUtils.writeStringToFile(new java.io.File(older,p[1]),String(FileUtils.readFileToString(new java.io.File(projectDir,"tests/fixtures/entity-2b62e53/"+p[0]),"UTF-8")),"UTF-8");
 });
}
// The MCP runs from this workspace, beside the older entity library: the libraries a Flow calls are its neighbours.
["lib_flow_engine","lib_flow_sql","lib_flow_crud_data","lib_flow_mcp"].forEach(function(n){Files.createSymbolicLink(new java.io.File(workspace,"c8oprj-"+n.replace(/_/g,"-")).toPath(),new java.io.File(projectDir,"../"+n).getCanonicalFile().toPath());});
Files.createSymbolicLink(new java.io.File(workspace,"c8oprj-lib-flow-entity").toPath(),older.toPath());
var mcpDir = new java.io.File(workspace,"c8oprj-lib-flow-mcp");
var __flowEngineDir = String(new java.io.File(workspace,"c8oprj-lib-flow-engine/_flow").getAbsolutePath());
var __flowProjectDir = String(mcpDir.getAbsolutePath());
var engine = eval(String(FileUtils.readFileToString(new java.io.File(__flowEngineDir,"Engine.js"),"UTF-8")));
var source = String(FileUtils.readFileToString(new java.io.File(mcpDir,"_flow/flows/McpServer.flow.js"),"UTF-8"));
function rpc(method,params){
 var execution=JSON.parse(engine.run(JSON.stringify({flowSource:source,includeTrace:false,input:{request:JSON.stringify({jsonrpc:"2.0",id:++calls,method:method,params:params||{}})}})));
 assert(execution.ok===true,"MCP runtime failed: "+JSON.stringify(execution).substring(0,400));
 return execution.result;
}
function call(name,args){var response=rpc("tools/call",{name:name,arguments:args});return response.result;}
try {
 FileUtils.writeStringToFile(new java.io.File(target,"c8oProject.yaml"),"convertigo: 8.5.0.m006\n↓PairTest [core.Project]:\n  version: 1.0\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n","UTF-8");
 var args={projectDir:String(target.getAbsolutePath())};
 var described=call("flow-block-get",{projectDir:args.projectDir,name:"entity.model.set"}).structuredContent;
 assert(described&&described.ok===true&&described.block&&described.block.properties&&!described.block.properties.gateway,"The older library declares no gateway option: "+JSON.stringify(described).substring(0,400));
 var model={version:2,modelVersion:1,entities:{Equipment:{fields:{label:{type:"string",maxLength:40}}}}};
 [undefined,true,false].forEach(function(gateway){
  var request={projectDir:args.projectDir,model:model,expectedRevision:"missing"};if(gateway!==undefined)request.gateway=gateway;
  var result=call("flow-entity-model-set",request),content=result&&result.structuredContent,error=content&&content.error;
  assert(result&&result.isError===true&&error&&error.code==="ENTITY_LIBRARY_TOO_OLD"&&/lib_flow_entity is too old for this MCP: update it/.test(error.message),
   "Model set refused with an older entity library (gateway "+gateway+"): "+JSON.stringify(result).substring(0,600));
  assert(!new java.io.File(target,"_flow/flows/EntityGateway.flow.js").exists()&&!/EntityGateway/.test(String(FileUtils.readFileToString(new java.io.File(target,"c8oProject.yaml"),"UTF-8"))),"No gateway created (gateway "+gateway+")");
  assert(!new java.io.File(target,"_flow/data/model.yaml").exists()&&!new java.io.File(target,"_flow/blocks/app/entityAccess.block.js").exists(),"Nothing written (gateway "+gateway+")");
 });
 // Reads and checks stay available: only the write that scaffolds sources is refused.
 var check=call("flow-entity-model-check",{projectDir:args.projectDir,model:model}).structuredContent;
 assert(check&&check.valid===true,"Model check still works with the older library: "+JSON.stringify(check).substring(0,300));
 print(JSON.stringify({ok:true,library:named?"named":"fixture-2b62e53",protocolCalls:calls,assertions:assertions}));
} finally {FileUtils.deleteDirectory(workspace);}
