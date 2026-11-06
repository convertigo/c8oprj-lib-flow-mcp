// Run under the same Rhino/JVM classpath as mcp-resources-contract.js.
var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var Files = java.nio.file.Files;
var __flowEngineDir = String(new java.io.File(engineDir).getCanonicalPath());
var __flowProjectDir = String(new java.io.File(projectDir).getCanonicalPath());
var engine = eval(String(FileUtils.readFileToString(new java.io.File(engineDir,"Engine.js"),"UTF-8")));
var source = String(FileUtils.readFileToString(new java.io.File(projectDir,"_flow/flows/McpServer.flow.js"),"UTF-8"));
var workspace = Files.createTempDirectory(new java.io.File(projectDir,"../.cache/entity-tests").getCanonicalFile().toPath(),"entity-mcp-tools-").toFile();
var target = new java.io.File(workspace,"EntityToolsTest");
["lib_flow_engine","lib_flow_entity","lib_flow_sql","lib_flow_crud_data"].forEach(function(n){Files.createSymbolicLink(new java.io.File(workspace,"c8oprj-"+n.replace(/_/g,"-")).toPath(),new java.io.File(projectDir,"../"+n).getCanonicalFile().toPath());});
var calls=0,assertions=0;
function assert(value,message){assertions++;if(!value)throw new Error(message);}
function rpc(method,params){
 var execution=JSON.parse(engine.run(JSON.stringify({flowSource:source,includeTrace:false,input:{request:JSON.stringify({jsonrpc:"2.0",id:++calls,method:method,params:params||{}})}})));
 assert(execution.ok===true,"MCP runtime failed: "+JSON.stringify(execution).substring(0,400));
 return execution.result;
}
function tool(name,args){var response=rpc("tools/call",{name:name,arguments:args});return response.result&&response.result.structuredContent;}
try {
 FileUtils.writeStringToFile(new java.io.File(target,"c8oProject.yaml"),"convertigo: 8.5.0.m006\n↓EntityToolsTest [core.Project]:\n  version: 1.0\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n", "UTF-8");
 var names=rpc("tools/list").result.tools;
 ["get","check","set"].forEach(function(op){
  var descriptor=names.filter(function(t){return t.name==="flow-entity-model-"+op;})[0];
  assert(!!descriptor,"Entity model "+op+" is not public");
  assert(descriptor.inputSchema.required.indexOf("project")>=0,"Project is required");
  if(op==="set")assert(descriptor.inputSchema.required.indexOf("expectedRevision")>=0,"Revision is required");
 });
 var described={};names.forEach(function(t){described[t.name]=t;});
 assert(/empty model .*returns format.*example/.test(described["flow-entity-model-get"].description),"Get announces the format of an empty model");
 var missing=tool("flow-entity-model-get",{});
 assert(missing&&missing.error&&/explicit project/.test(missing.error.message),"Project omission is refused");
 var args={projectDir:String(target.getAbsolutePath())};
 var first=tool("flow-entity-model-get",args);
 assert(first&&first.revision==="missing","Blank model has missing revision: "+JSON.stringify(first));
 // The model format: the entity library returns it for an empty model, and the tool contracts hold the same keys and example.
 assert(first.model===null&&first.format&&first.example&&first.example.version===2,"Empty model returns format and example: "+JSON.stringify(first));
 var format=first.format,exampleText=JSON.stringify(first.example);
 // tools/list publishes, unchanged, the constant whose example entity-model-example-contract.js ties to the guide, the skills and the library.
 var constant=/var ENTITY_MODEL_FORMAT = ([\s\S]*?);\n/.exec(String(FileUtils.readFileToString(new java.io.File(projectDir,"_flow/blocks/mcp/tools/available.block.js"),"UTF-8")));
 assert(constant,"The model contract is one constant of tools/available.block.js");
 var published=eval(constant[1]);
 ["check","set"].forEach(function(op){
  var descriptor=described["flow-entity-model-"+op],contract=descriptor.inputSchema.properties.model.description;
  assert(contract===published,op+" publishes the model contract constant unchanged: "+contract);
  assert(contract.indexOf("Example: "+exampleText)>=0,op+" model contract holds the example: "+contract);
  format.types.concat(format.model,format.entity,format.field,format.relation,format.auto,Object.keys(format.traits)).forEach(function(key){assert(contract.indexOf(key)>=0,op+" model contract names "+key);});
  Object.keys(format.traits).forEach(function(trait){format.traits[trait].forEach(function(parameter){assert(contract.indexOf(parameter)>=0,op+" model contract names the "+trait+" parameter "+parameter);});});
  assert(/model property gives the format and an example/.test(descriptor.description),op+" points to the model format");
 });
 // The format documentation: int64 is an example of a relation type, and a project trait and a source are described.
 var guideText=String(FileUtils.readFileToString(new java.io.File(projectDir,"_flow/resources/guide/entities.md"),"UTF-8")).replace(/\s+/g," ");
 ["check","set"].forEach(function(op){
  var contract=described["flow-entity-model-"+op].inputSchema.properties.model.description;
  assert(/target identity, for example int64[^.]*string/.test(contract),op+" model contract gives int64 as an example of a relation type");
  assert(/Project trait: \{parameters [^;]*rules [^;]*ui\}; a "\$name"/.test(contract),op+" model contract describes a project trait");
  assert(/Source: \{provider: block\} on a read-only entity/.test(contract),op+" model contract describes a source");
 });
 assert(/`int64` for the default identity[^.]*`string`/.test(guideText)&&/\*\*Project traits:\*\* [^-]*`parameters`[^-]*`rules`/.test(guideText)&&/\*\*Source:\*\* `"source": \{"provider"/.test(guideText),"The entities guide documents the relation type, project traits and source");
 var bogus=tool("flow-entity-model-check",{projectDir:args.projectDir,model:{version:2,entities:{},bogusSection:{}}});
 assert(bogus&&bogus.valid===false&&bogus.diagnostics.some(function(d){return d.path==="bogusSection"&&/Accepted here: version, modelVersion, entities[^.]*\. Correct form: /.test(d.message);}),"Invented section refused: "+JSON.stringify(bogus));
 var relation=tool("flow-entity-model-check",{projectDir:args.projectDir,model:{version:2,entities:{Pret:{fields:{materiel:{type:"relation"}}}}}});
 assert(relation&&relation.valid===false&&relation.diagnostics.some(function(d){return d.path==="entities.Pret.fields.materiel.type"&&d.message.indexOf("Accepted types: "+format.types.join(", "))>=0&&d.message.indexOf('"relation": {"entity"')>=0;}),"Relation type refused with the types and the relation form: "+JSON.stringify(relation));
 var example=tool("flow-entity-model-check",{projectDir:args.projectDir,model:first.example});
 assert(example&&example.valid===true,"Published example is valid: "+JSON.stringify(example));
 var model={version:2,modelVersion:1,entities:{Equipment:{fields:{label:{type:"string",default:"{{ 6 * 7 }}"}}}}};
 var check=tool("flow-entity-model-check",{projectDir:args.projectDir,model:model});
 assert(check&&check.valid===true,"Valid model check failed: "+JSON.stringify(check));
 var noRevision=tool("flow-entity-model-set",{projectDir:args.projectDir,model:model});
 assert(noRevision&&(noRevision.ok===false||!!noRevision.error),"Set without revision refused");
 var saved=tool("flow-entity-model-set",{projectDir:args.projectDir,model:model,expectedRevision:"missing"});
 assert(saved&&saved.ok===true,"Initial write failed: "+JSON.stringify(saved));
 assert(saved.scaffold&&saved.scaffold.created.indexOf("EntityGateway")>=0&&saved.scaffold.created.indexOf("block:app.entityAccess")>=0,"Local gateway and policy were scaffolded");
 assert(/publicRead/.test(saved.scaffold.message)&&/Writes stay denied/.test(saved.scaffold.message),"Scaffold reports application decisions");
 var gateway=new java.io.File(target,"_flow/flows/EntityGateway.flow.js"),policy=new java.io.File(target,"_flow/blocks/app/entityAccess.block.js");
 assert(String(FileUtils.readFileToString(gateway,"UTF-8")).indexOf("$$authorize")<0,"Scaffold has no second authorization slot");
 var authored=String(FileUtils.readFileToString(policy,"UTF-8"))+"\n// Application-owned policy\n";
 FileUtils.writeStringToFile(policy,authored,"UTF-8");
 var gatewayText=String(FileUtils.readFileToString(gateway,"UTF-8"));
 var replay=tool("flow-entity-model-set",{projectDir:args.projectDir,model:model,expectedRevision:saved.revision});
 assert(replay.ok&&replay.scaffold.created.length===0&&replay.scaffold.preserved.length===2,"Scaffold replay preserves application sources");
 assert(String(FileUtils.readFileToString(policy,"UTF-8"))===authored&&String(FileUtils.readFileToString(gateway,"UTF-8"))===gatewayText,"Neither custom policy nor gateway was overwritten");
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
} finally {FileUtils.deleteDirectory(workspace);}
