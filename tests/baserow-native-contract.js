var project=new java.io.File(arguments[0]).getCanonicalFile(),files=Packages.org.apache.commons.io.FileUtils,checks=0,failures=[];
function assert(v,m){checks++;if(!v)failures.push(m);}
var source=String(files.readFileToString(new java.io.File(project,'_flow/lib/mcp.js'),'UTF-8'));
// Test real fast-save serialization in a temporary directory, exposing private helpers only in this in-memory copy.
source=source.replace('jsonRpcResult: jsonRpcResult,','_renderNativeInput:renderFlowInputVariableYaml, _saveNativeDeclaration:saveFlowDeclaration, jsonRpcResult: jsonRpcResult,');
var mcp=eval(source),temp=java.nio.file.Files.createTempDirectory('flow-native-contract-').toFile();
try{
 var bean={getAuthenticatedContextRequired:function(){return true;}},p={getDirPath:function(){return String(temp);}};
 files.writeStringToFile(new java.io.File(temp,'c8oProject.yaml'),'↑convertigo: 8.5.0\n↓App [core.Project]: \n  version: 1\n','UTF-8');
 var definitions={secret:{type:'string',visibility:-1,default:"l'équipe"},files:{type:'array',items:{type:'string'},isFileUpload:true,default:[]}};
 var saved=mcp._saveNativeDeclaration(p,bean,'Probe',{}, {inputDefinitions:definitions});assert(saved,'Fast-save creates native declaration');
 var file=new java.io.File(temp,'_c8oProject/sequences/Probe.yaml'),yaml=String(files.readFileToString(file,'UTF-8'));
 assert(/^authenticatedContextRequired: true$/m.test(yaml),'F16 fast-save persists native auth');
 assert(/visibility: -1/.test(yaml),'F08 fast-save persists visibility');
 assert(/isFileUpload: true/.test(yaml)&&/RequestableMultiValuedVariable/.test(yaml),'F19 native upload and multivalue persisted');
 assert(yaml.indexOf("'l''équipe'")>=0,'JSON/YAML defaults quoting unchanged');
 assert(!mcp._saveNativeDeclaration(p,bean,'Probe',{}, {inputDefinitions:definitions}),'Repeated native save is idempotent');
 files.writeStringToFile(file,yaml+'↓obsolete [variables.RequestableVariable-1780000000998]: \n  value: old\n↓__reserved [variables.RequestableVariable-1780000000999]: \n  value: keep\n','UTF-8');
 mcp._saveNativeDeclaration(p,bean,'Probe',{}, {inputDefinitions:definitions});yaml=String(files.readFileToString(file,'UTF-8'));
 assert(yaml.indexOf('↓obsolete')<0&&yaml.indexOf('↓__reserved')>=0,'Native fast-save removes obsolete declared inputs and preserves reserved variables');
 bean.getAuthenticatedContextRequired=function(){return false;};definitions.secret.visibility=0;definitions.files.isFileUpload=false;
 mcp._saveNativeDeclaration(p,bean,'Probe',{}, {inputDefinitions:definitions});yaml=String(files.readFileToString(file,'UTF-8'));
 assert(yaml.indexOf('authenticatedContextRequired')<0&&yaml.indexOf('isFileUpload')<0&&yaml.indexOf('visibility')<0,'Explicit false/zero survives reload defaults');
 var code=String(files.readFileToString(new java.io.File(project,'_flow/blocks/mcp/tools/available.block.js'),'UTF-8'));
 var available=eval(code.substring(code.indexOf('(function'))),name='mcp.tool.flow.syncInputs';
 var tools=available.run({props:function(){return {};},blockNames:function(){return [name];},blockContract:function(){return {name:name,props:{request:{type:'object'},out:{kind:'path'}},description:'sync'};},write:function(){},lib:function(){return {legacyRelayTools:function(){return [];}};}},{});
 var tool=tools.filter(function(t){return t.name==='flow-sync-inputs';})[0];assert(tool,'F21 tool exists');
 assert(tool.inputSchema.properties.project&&tool.inputSchema.properties.name&&tool.inputSchema.properties.qname,'F21 public schema exposes project/name/qname');
 assert(tool.inputSchema.anyOf&&tool.inputSchema.anyOf.length===2,'F21 name or qname is required');
 assert(tool.description.indexOf('visibility')>=0&&tool.description.indexOf('isFileUpload')>=0,'Native input properties discoverable');
 if(failures.length)throw new Error(failures.join('\n'));
 print('baserow-native-contract OK ('+checks+' assertions)');
}finally{files.deleteDirectory(temp);}
