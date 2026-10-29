// Run with Rhino and the engine test classpath. All files belong to a temporary workspace.
var root = new java.io.File(arguments[0]).getCanonicalFile();
var Files = java.nio.file.Files, IO = Packages.org.apache.commons.io.FileUtils;
var Yaml = Packages.com.twinsoft.convertigo.engine.util.YamlConverter;
var tmp = Files.createTempDirectory('mcp-standard-yaml-').toFile();
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function read(file) { return String(IO.readFileToString(file, 'UTF-8')); }
function write(file, text) { IO.writeStringToFile(file, text, 'UTF-8'); }
var source = read(new java.io.File(root, '_flow/lib/mcp.js')).replace('jsonRpcResult: jsonRpcResult,', '_save:saveFlowDeclaration, _assertName:assertFlowNameFree, jsonRpcResult: jsonRpcResult,');
var mcp = eval(source);
try {
 var file = new java.io.File(tmp, 'c8oProject.yaml');
 // Quoted/reformatted standard keys must remain editable by the MCP tools.
 write(file, '---\n"convertigo": "8.5.0.m006"\n"↓App [core.Project]":\n  comment: "Saved, not the Studio draft"\n  "↓Existing [sequences.GenericSequence]": sequences/Existing.yaml\n');
 var other = new java.io.File(tmp, '_c8oProject/sequences/Existing.yaml');
 write(other, 'comment: |\n  Keep these exact bytes.\n');
 var timestamp = other.lastModified();
 var bean = {getAuthenticatedContextRequired:function(){return true;},getVariable:function(){return null;}};
 var project = {getDirPath:function(){return String(tmp);}};
 var value = "first\n  second \n\tthird\n\n", definitions = {text:{type:'string',description:value,default:'001'}, empty:{type:'string',default:''}};
 mcp._save(project, bean, 'Probe', {}, {inputDefinitions:definitions});
 assert(String(Yaml.getFormat(file)) === 'STANDARD', 'Standard project stays standard');
 assert(read(file).indexOf('🗏') < 0 && read(file).indexOf('sequences/Probe.yaml') >= 0, 'Plain include path');
 assert(read(file).indexOf('Saved, not the Studio draft') >= 0, 'Unrelated saved project property kept');
 assert(other.lastModified() === timestamp, 'Unchanged other file keeps its mtime');
 var doc = Yaml.readYaml(file), values = doc.getElementsByTagName('description');
 var found = false;
 for(var i=0;i<values.getLength();i++) if(String(values.item(i).getTextContent())===value) found=true;
 assert(found, 'Exact multiline description after reload');
 var seq = new java.io.File(tmp, '_c8oProject/sequences/Probe.yaml');
 assert(read(seq).indexOf('description: |') >= 0, 'Literal multiline block');
 var before=read(seq), time=seq.lastModified();
 mcp._save(project, bean, 'Probe', {}, {inputDefinitions:definitions});
 assert(read(seq)===before && seq.lastModified()===time, 'Repeated save preserves bytes and mtime');
 var bad={text:{type:'string',required:'wrong'}};
 try { mcp._save(project,bean,'Probe',{}, {inputDefinitions:bad}); throw new Error('Accepted invalid boolean'); }
 catch(e) { assert(String(e).indexOf('normalized boolean')>=0,'Invalid contract rejected'); }
 assert(read(seq)===before, 'Failed validation writes nothing');
 // Discovery uses the engine metadata reader, including after a standard tool quotes root keys.
 ['bootstrap','reference'].forEach(function(name){
  var blockSource=read(new java.io.File(root,'_flow/blocks/project/'+name+'.block.js'));
  blockSource=blockSource.substring(blockSource.indexOf('(function'));
  blockSource=blockSource.replace('run: function (ctx, node) {','_name:projectNameFromFile, run: function (ctx, node) {');
  var block=eval(blockSource);
  assert(block._name(file)==='App', name+' discovers standard root');
 });
 var bootstrapSource=read(new java.io.File(root,'_flow/blocks/project/bootstrap.block.js'));
 bootstrapSource=bootstrapSource.substring(bootstrapSource.indexOf('(function'))
  .replace('run: function (ctx, node) {','_import:importTemplate, run: function (ctx, node) {');
 var bootstrap=eval(bootstrapSource), Project=Packages.com.twinsoft.convertigo.beans.core.Project;
 var created=new Project(); created.setName('NewProject'); created.isSubLoaded=true; created.setYamlFormat(Yaml.Format.LEGACY);
 var imported=bootstrap._import({theApp:{referencedProjectManager:{importProject:function(parser,force){
  assert(String(parser.getProjectName())==='NewProject' && force, 'Bootstrap requests a new template copy');return created;
 }}}},'NewProject','https://example.invalid/template.zip');
 assert(String(imported.getYamlFormat())==='STANDARD','Bootstrap explicitly changes the legacy template copy to standard');
 var Engine=Packages.com.twinsoft.convertigo.engine.Engine;
 Engine.logBeans=Engine.logEngine=Engine.logDatabaseObjectManager=Engine.logAdmin=Packages.org.apache.log4j.Logger.getLogger('standard-yaml-test');
 Packages.com.twinsoft.convertigo.engine.EnginePropertiesManager.initProperties();
 Engine.PROJECTS_PATH=Engine.USER_WORKSPACE_PATH=String(tmp);
 Engine.theApp=new Engine(); Engine.theApp.databaseObjectsManager=new Packages.com.twinsoft.convertigo.engine.DatabaseObjectsManager();
 var symbols=Engine.theApp.databaseObjectsManager.getClass().getDeclaredField("symbolsProperties");
 symbols.setAccessible(true);symbols.set(Engine.theApp.databaseObjectsManager,new java.util.Properties());
 var createdFile=new java.io.File(tmp,'NewProject/c8oProject.yaml');createdFile.getParentFile().mkdirs();
 Packages.com.twinsoft.convertigo.engine.util.CarUtils.exportProject(imported,String(createdFile));
 assert(read(createdFile).indexOf('convertigo: 8.5.')===0,'The actual engine exports the bootstrapped template as standard');
 assert(String(Yaml.projectName(Yaml.readYaml(createdFile)))==='NewProject','Exported bootstrap project reloads through the engine codec');
 var guard=new Project();guard.setName('Guard');guard.isSubLoaded=true;
 var guardFile=new java.io.File(tmp,'Guard/c8oProject.yaml');
 write(guardFile,'convertigo: 8.5.0.m006\n"↓Guard [core.Project]": {"↓Collision [sequences.GenericSequence]": sequences/Collision.yaml}\n');
 Engine.theApp.databaseObjectsManager=new JavaAdapter(Packages.com.twinsoft.convertigo.engine.DatabaseObjectsManager, {
  getOriginalProjectByName:function(){return guard;}
 });
 try { mcp._assertName({project:'Guard'},'Collision');throw new Error('Unsaved deletion was missed'); }
 catch(e) { assert(e.code==='FLOW_NAME_DELETION_UNSAVED','Quoted and inline standard keys preserve the unsaved deletion guard'); }
 print('standard-project-yaml OK ('+checks+' checks)');
} finally { IO.deleteDirectory(tmp); }
