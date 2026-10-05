// Real Java domain + complete Flow MCP router; all writes use disposable sources.
// java -cp <dependencies:engine-classes:tas> org.mozilla.javascript.tools.shell.Main
//   tests/tags-tools.js <lib_flow_engine/_flow> <lib_flow_mcp> [legacy-mcp]
var engineDir = String(new java.io.File(arguments[0]).getCanonicalPath());
var projectDir = String(new java.io.File(arguments[1]).getCanonicalPath());
var legacyDir = arguments.length > 2 ? String(new java.io.File(arguments[2]).getCanonicalPath()) : "";
var Files = java.nio.file.Files;
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
var Tags = Packages.com.twinsoft.convertigo.engine.tags;
var Project = Packages.com.twinsoft.convertigo.beans.core.Project;
var Sequence = Packages.com.twinsoft.convertigo.beans.sequences.GenericSequence;
var temporary = Files.createTempDirectory("mcp-tags-contract-");
var models = new java.util.HashMap();
var count = 0;
function assert(condition, message) { count++; if (!condition) throw new Error(message); }
function read(path) { return String(FileUtils.readFileToString(new java.io.File(path), "UTF-8")); }
function source(project) { return temporary.resolve(String(project.getName())).resolve("_c8oProject/tags.json"); }
function model(name) {
  var project = new Project(); project.isSubLoaded = true; project.setName(name);
  Files.createDirectories(temporary.resolve(name)); models.put(name, project);
  var sequence = new Sequence(); sequence.isSubLoaded = true; sequence.setName("Main"); project.add(sequence);
  project.hasChanged = false;
  return project;
}
Engine.logBeans = Engine.logEngine = Engine.logDatabaseObjectManager = Packages.org.apache.log4j.Logger.getLogger("mcp-tags-contract");
Packages.com.twinsoft.convertigo.engine.EnginePropertiesManager.initProperties();
var project = model("TagMcpProof"); model("Other");
var manager = new Tags.TagManager(temporary,
  new JavaAdapter(java.util.function.Function, { apply: function (name) { return models.get(String(name)); } }),
  new JavaAdapter(java.util.function.Function, { apply: source }),
  new JavaAdapter(java.util.function.Supplier, { get: function () { return models.keySet(); } }));
manager.projectOpened(project);
manager.contributions().register("fixture", Tags.TagDocument.parseObject(JSON.stringify({
  label: "Neutral typed fixture", fields: { enabled: {label:"Enabled",type:"boolean"} }
})));
var tagClass = java.lang.Class.forName("com.twinsoft.convertigo.engine.tags.TagManager");
var instance = tagClass.getDeclaredField("instance"); instance.setAccessible(true);
var owner = tagClass.getDeclaredField("owner"); owner.setAccessible(true);
var previousInstance = instance.get(null), previousOwner = owner.get(null);
instance.set(null, manager); owner.set(null, Engine.theApp);
var __flowEngineDir = engineDir, __flowProjectDir = projectDir;
var engine = eval(read(engineDir + "/Engine.js"));
var flowSource = read(projectDir + "/_flow/flows/McpServer.flow.js");
var requestId = 0;
function rpc(method, params) {
  var run = JSON.parse(engine.run(JSON.stringify({
    flowSource: flowSource, includeTrace: false,
    input: { request: JSON.stringify({jsonrpc:"2.0",id:++requestId,method:method,params:params||{}}) }
  })));
  assert(run.ok === true, "Router failed: " + JSON.stringify(run).substring(0,600));
  return run.result;
}
function call(name, args) {
  var response = rpc("tools/call", {name:name,arguments:args});
  assert(!response.error, "Tool failed: " + JSON.stringify(response));
  return response.result.structuredContent;
}
function get() { return call("tags-get", {scope:"projectObjects",project:"TagMcpProof"}); }
function apply(action, input, revision) {
  return call("tags-apply", {scope:"projectObjects",project:"TagMcpProof",revision:revision||get().revision,action:action,input:input});
}
function rejected(args, reason) {
  var response = rpc("tools/call", {name:"tags-apply",arguments:args});
  assert(response.error && response.error.message.indexOf(reason) !== -1, "Expected " + reason + ": " + JSON.stringify(response));
}
try {
  var tools = rpc("tools/list").result.tools;
  ["tags-get","tags-apply"].forEach(function (name) {
    var tool = tools.filter(function (t) { return t.name === name; })[0];
    assert(tool && tool.inputSchema.properties.scope && tool.inputSchema.properties.project, name + " missing schema");
    assert(!tool.inputSchema.properties.request && !tool.inputSchema.properties.out, "Protocol internals leaked");
  });
  var snapshot = get();
  assert(snapshot.targets[0] === "TagMcpProof.sq:Main" && snapshot.membershipOrder === "explicit", "Wrong targets/order");
  assert(!snapshot.contributions.flow && snapshot.contributions.fixture, "Optional metadata visibility changed");
  assert(!Files.exists(source(project)) && !project.hasChanged, "Read created/changed project source");
  var first = apply("create", {definition:{label:"First",metadata:{fixture:{enabled:true}}}});
  var second = apply("create", {definition:{label:"Second"}});
  assert(first.id !== second.id && first.dirty && project.hasChanged, "No stable identities/draft");
  assert(!Files.exists(source(project)), "Mutation saved implicitly");
  var target = snapshot.targets[0];
  var assigned = apply("assign", {targets:[target],tagIds:[second.id,first.id]});
  assert(JSON.stringify(assigned.assignments[target]) === JSON.stringify([second.id,first.id]), "Order was sorted");
  var before = get();
  rejected({scope:"projectObjects",project:"TagMcpProof",revision:snapshot.revision,action:"delete",input:{id:first.id,confirmed:true,memberCount:1}}, "revision");
  rejected({scope:"projectObjects",project:"TagMcpProof",revision:before.revision,action:"assign",input:{targets:["Other.sq:Main"],tagIds:[first.id]}}, "target");
  rejected({scope:"projectObjects",project:"TagMcpProof",revision:before.revision,action:"create",input:{definition:{label:"Bad",metadata:{fixture:{enabled:"wrong"}}}}}, "Invalid metadata");
  rejected({scope:"projectObjects",project:"TagMcpProof",revision:before.revision,action:"delete",input:{id:first.id}}, "Confirm deletion");
  rejected({scope:"projectObjects",project:"TagMcpProof",revision:before.revision,action:"reorder",input:{targets:[target],tagIds:[first.id]}}, "exactly");
  assert(get().revision === before.revision, "Failed command changed draft");
  var reordered = apply("reorder", {targets:[target],tagIds:[first.id,second.id]});
  assert(JSON.stringify(reordered.assignments[target]) === JSON.stringify([first.id,second.id]), "Reorder failed");
  manager.save(project, source(project), new JavaAdapter(Tags.TagManager.ProjectWriter, {write:function () {}}));
  assert(Files.exists(source(project)) && !get().dirty, "Explicit Save did not publish tags");
  // An unavailable extension may already exist on disk. Clients must preserve it.
  var original = JSON.parse(read(String(source(project))));
  original.tags[first.id].metadata.unavailable = {keep:42};
  Files.writeString(source(project), JSON.stringify(original));
  var saved = read(String(source(project)));
  var updated = get().tags[first.id]; updated.label = "Draft label";
  apply("update", {id:first.id,definition:updated});
  assert(read(String(source(project))) === saved, "Update overwrote saved version");
  manager.projectClosed(project); manager.projectOpened(project);
  assert(get().tags[first.id].label === "First" && !get().dirty, "Reload did not discard draft");
  assert(get().tags[first.id].metadata.unavailable.keep === 42, "Unavailable metadata lost");
  if (legacyDir) {
    eval(read(legacyDir + "/js/tags.js"));
    var legacy = C8O.tags.get({scope:"projectObjects",project:"TagMcpProof"});
    assert(JSON.stringify(legacy) === JSON.stringify(get()), "Legacy/Flow snapshots differ");
    var created = C8O.tags.apply({scope:"projectObjects",project:"TagMcpProof",revision:legacy.revision,action:"create",input:JSON.stringify({definition:{label:"From legacy"}})});
    assert(get().tags[created.id].label === "From legacy" && get().dirty, "Legacy did not share drafts");
    var fromJavaString = C8O.tags.apply({scope:"projectObjects",project:"TagMcpProof",revision:get().revision,action:"create",input:new java.lang.String(JSON.stringify({definition:{label:"Transport Java string"}}))});
    assert(get().tags[fromJavaString.id].label === "Transport Java string", "Java string transport was quoted twice");
  }
  var workspace = call("tags-get", {scope:"workspaceProjects"});
  var local = call("tags-apply", {scope:"workspaceProjects",revision:workspace.revision,action:"createFromReferences",input:{project:"TagMcpProof",definition:{label:"Stack"}}});
  assert(local.done && local.assignments.TagMcpProof[0] === local.id && Files.exists(temporary.resolve("studio/tags.json")), "Workspace command did not persist locally");
  print(JSON.stringify({ok:true,checks:count,realDomain:true,legacy:!!legacyDir,adminSession:false}));
} finally {
  instance.set(null, previousInstance); owner.set(null, previousOwner);
  FileUtils.deleteDirectory(temporary.toFile());
}
