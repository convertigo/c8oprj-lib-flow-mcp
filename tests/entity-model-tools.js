// Run under the same Rhino/JVM classpath as mcp-resources-contract.js.
var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var Files = java.nio.file.Files;
var __flowEngineDir = String(new java.io.File(engineDir).getCanonicalPath());
var __flowProjectDir = String(new java.io.File(projectDir).getCanonicalPath());
var engine = eval(String(FileUtils.readFileToString(new java.io.File(engineDir,"Engine.js"),"UTF-8")));
var source = String(FileUtils.readFileToString(new java.io.File(projectDir,"_flow/flows/McpServer.flow.js"),"UTF-8"));
var target = Files.createTempDirectory("entity-mcp-tools-").toFile();
var calls=0,assertions=0;
function assert(value,message){assertions++;if(!value)throw new Error(message);}
function rpc(method,params){
 var execution=JSON.parse(engine.run(JSON.stringify({flowSource:source,includeTrace:false,input:{request:JSON.stringify({jsonrpc:"2.0",id:++calls,method:method,params:params||{}})}})));
 assert(execution.ok===true,"MCP runtime failed: "+JSON.stringify(execution).substring(0,400));
 return execution.result;
}
function tool(name,args){var response=rpc("tools/call",{name:name,arguments:args});return response.result&&response.result.structuredContent;}
try {
 FileUtils.writeStringToFile(new java.io.File(target,"c8oProject.yaml"),"convertigo: 8.5.0.m006\n↓EntityToolsTest [core.Project]:\n  version: 1.0\n", "UTF-8");
 var names=rpc("tools/list").result.tools;
 ["get","check","set"].forEach(function(op){
  var descriptor=names.filter(function(t){return t.name==="flow-entity-model-"+op;})[0];
  assert(!!descriptor,"Entity model "+op+" is not public");
  assert(descriptor.inputSchema.required.indexOf("project")>=0,"Project is required");
  if(op==="set")assert(descriptor.inputSchema.required.indexOf("expectedRevision")>=0,"Revision is required");
 });
 var missing=tool("flow-entity-model-get",{});
 assert(missing&&missing.error&&/explicit project/.test(missing.error.message),"Project omission is refused");
 var args={projectDir:String(target.getAbsolutePath())};
 var first=tool("flow-entity-model-get",args);
 assert(first&&first.revision==="missing","Blank model has missing revision: "+JSON.stringify(first));
 var model={version:2,modelVersion:1,entities:{Equipment:{fields:{label:{type:"string",default:"{{ 6 * 7 }}"}}}}};
 var check=tool("flow-entity-model-check",{projectDir:args.projectDir,model:model});
 assert(check&&check.valid===true,"Valid model check failed: "+JSON.stringify(check));
 var noRevision=tool("flow-entity-model-set",{projectDir:args.projectDir,model:model});
 assert(noRevision&&(noRevision.ok===false||!!noRevision.error),"Set without revision refused");
 var saved=tool("flow-entity-model-set",{projectDir:args.projectDir,model:model,expectedRevision:"missing"});
 assert(saved&&saved.ok===true,"Initial write failed: "+JSON.stringify(saved));
 var read=tool("flow-entity-model-get",args);
 assert(read&&read.model.entities.Equipment.fields.label.default==="{{ 6 * 7 }}","Model text stays literal");
 assert(/^[0-9a-f]{64}$/.test(read.revision),"Model revision is SHA-256");
 var stale=tool("flow-entity-model-set",{projectDir:args.projectDir,model:model,expectedRevision:"missing"});
 assert(stale&&(stale.ok===false||!!stale.error),"Stale revision refused");
 var invalid=tool("flow-entity-model-set",{projectDir:args.projectDir,model:{version:2,entities:{Equipment:{fields:{bad:{type:"UNSUPPORTED"}}}}},expectedRevision:read.revision});
 assert(invalid&&invalid.ok===false,"Invalid model refused");
 var unchanged=tool("flow-entity-model-get",args);
 assert(unchanged&&unchanged.revision===read.revision,"Refused writes preserve file");
 print(JSON.stringify({ok:true,protocolCalls:calls,assertions:assertions}));
} finally {FileUtils.deleteDirectory(target);}
