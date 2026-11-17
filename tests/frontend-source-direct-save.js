// Loaded Studio sources save to disk after validation; check alone is a dry-run.
var File = java.io.File, IO = Packages.org.apache.commons.io.FileUtils;
var root = java.nio.file.Files.createTempDirectory('frontend-direct-save-').toFile().getCanonicalFile();
var library = new File(arguments[0]);
var realPackages = Packages, drafts = {}, notifications = [], sets = 0;
function assert(ok, message) { if (!ok) throw Error(message); }
function read(file) { return String(IO.readFileToString(file, 'UTF-8')); }
var flowEngine = {
 hasSource: function(path) { return drafts[String(path)] !== undefined || new File(String(path)).isFile(); },
 getSource: function(path) { return drafts[String(path)] !== undefined ? drafts[String(path)] : read(new File(String(path))); },
 isSourceDirty: function(path) { return drafts[String(path)] !== undefined; },
 discardSource: function(path) { delete drafts[String(path)]; return true; },
 setSources: function() { sets++; }
};
var project = {getName:function(){return 'App';},getDirFile:function(){return root;},getFlowEngine:function(){return flowEngine;}};
var Packages = {java:realPackages.java,javax:realPackages.javax,org:realPackages.org,
 com:{twinsoft:{convertigo:{engine:{Engine:{theApp:{databaseObjectsManager:{getLoadedProjectByName:function(){return project;}}}}}}}}};
var mcp = eval(read(new File(library, '_flow/lib/mcp.js')));
var source = read(new File(library, '_flow/blocks/frontend/svelte/source.block.js'));
var block = eval(source.substring(source.indexOf('(function')));
var store = mcp.sourceStore({project:'App', projectDir:String(root)});
var lib = {sourceStore:function(){return store;},queueSourceNotifications:function(){return false;}};
var ctx = {
 props:function(node){return node;},write:function(){},lib:function(){return lib;},
 authoringTreeSource:function(){return {ok:true,diagnostics:[],children:[]};},
 authoringContractSource:function(){return {ok:true,items:[]};},
 notifySourceMutation:function(request){notifications.push(request);},
 resourcePatch:function(){return {content:'<FlowComponent $$id="home"><Structure /></FlowComponent>\n'};}
};
var base = '_flow/frontbuilder/svelte/model/App/src/';
var page = base + 'routes/+page.flow.svelte';
function run(operation, path, code, revision) {
 return block.run(ctx, {operation:operation,project:'App',projectDir:String(root),sourceFile:path,code:code,
 revision:revision,edits:[{oldText:'home',newText:'home'}]});
}
var first = '<FlowComponent $$id="old"><Structure /></FlowComponent>\n';
var file = new File(root,page); IO.writeStringToFile(file,first,'UTF-8');
drafts[String(file.getCanonicalPath())] = '<FlowComponent $$id="draft"><Structure /></FlowComponent>\n';
var revision = run('get',page).revision;
var saved = run('set',page,first,revision);
assert(saved.written && !saved.draft && !store.dirty(file) && read(file) === saved.code,'loaded Svelte set saves and clears the old draft');
var patched = run('patch',page,null,saved.revision);
assert(patched.written && !patched.draft && read(file) === patched.code,'loaded Svelte patch saves directly');
assert(notifications.length === 2 && sets === 0,'set and patch notify without creating a draft');
var before = read(file);
run('check',page,first);
assert(read(file) === before && notifications.length === 2,'code-check writes and notifies nothing');
['app.flow.css','theme.flow.css'].forEach(function(name){
 var css = run('set',base + name,name === 'theme.flow.css' ? '@layer flow.theme { :root { --c8o-test: red; } }\n' : ':root { --c8o-test: red; }\n');
 assert(css.written && !css.draft && read(new File(root,base+name)) === css.code,'canonical CSS saves directly: '+name);
});
assert(root.listFiles().length > 0 && sets === 0,'no source working copy was created');
print('frontend-source-direct-save OK');
