// After a write (code-promote, flow-sync-inputs, a frontend source), the Project Explorer reload goes through the queue of
// the tree refreshes of the project when the Studio has it (ProjectTreeObject.reloadWrittenObject): the projections the
// reload compares are made off the UI thread, which only updates its tree, inside reloadNotingProjectFlag (flag lock
// taken briefly before and after the reload, never during it). An older Studio keeps the reload on the UI thread.
// Run with Rhino: java -cp <rhino:rhino-tools:commons-io:Convertigo engine classes and their libs> org.mozilla.javascript.tools.shell.Main tests/studio-reload-queue.js <lib_flow_mcp dir>
var project=new java.io.File(arguments[0]).getCanonicalFile();
var mcp=eval(String(org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project,'_flow/lib/mcp.js'),'UTF-8')));
var concurrent=java.util.concurrent;
function fail(message,value){throw new Error(message+': '+JSON.stringify(value));}
var lastChange=100;
var sample={hasChanged:false,getName:function(){return 'SampleQueueProject';},getLastChange:function(){return lastChange;}};
sample.getProject=function(){return sample;};
var flow={getName:function(){return 'Promoted';},getProject:function(){return sample;}};
var submitted=[],calls=[];
function queueTree(accepted){return {reloadWrittenObject:function(written,engineSources,resources,around){
	submitted.push({written:written,engineSources:String(engineSources),resources:resources,around:around});return accepted;}};}
function explorer(tree){return {
	getProjectRootObject:function(name){calls.push('root:'+name);if(tree instanceof Error)throw tree;return tree;},
	reloadDatabaseObject:function(){calls.push('reloadDatabaseObject');sample.hasChanged=true;lastChange++;},
	findTreeObjectByUserObject:function(target){return {target:target};},
	refreshTreeObject:function(){calls.push('refreshTreeObject');},
	reloadTreeObject:function(){calls.push('reloadTreeObject');},
	refreshTree:function(){calls.push('refreshTree');}
};}
function reset(){submitted=[];calls=[];sample.hasChanged=false;}
// the pass runs the hook on the UI thread once it projected the trees
function runPass(entry,reload){entry.around.accept(new java.lang.Runnable({run:reload}));}

// 1. A promoted Flow is queued, nothing is reloaded on the calling (UI) thread; the reload of the pass notes its mark.
reset();
var how=mcp._studioReloadObject(explorer(queueTree(true)),flow);
if(how!=='queued'||submitted.length!==1)fail('A promoted Flow is not queued',{how:how,submitted:submitted.length});
if(submitted[0].written!==flow||submitted[0].engineSources!==''||submitted[0].resources!==false)fail('The queued reload is not that of the Flow',{engineSources:submitted[0].engineSources,resources:submitted[0].resources});
if(calls.join()!=='root:SampleQueueProject')fail('A queued reload reloads on the calling thread',calls);
lastChange=200;
runPass(submitted[0],function(){calls.push('pass');sample.hasChanged=true;lastChange=201;});
if(calls.indexOf('pass')<0||!mcp._studioReloadNoted(sample,201))fail('The reload of the pass did not note its mark',calls);

// 2. While the reload of a pass runs, a registration takes the flag lock at once, and its flag writes keep the mark.
reset();lastChange=300;
mcp._studioReloadObject(explorer(queueTree(true)),flow);
var started=new concurrent.CountDownLatch(1),release=new concurrent.CountDownLatch(1);
var ui=new java.lang.Thread(new java.lang.Runnable({run:function(){
	runPass(submitted[0],function(){started.countDown();release.await(20,concurrent.TimeUnit.SECONDS);sample.hasChanged=true;lastChange=301;});
}}));
ui.start();
if(!started.await(10,concurrent.TimeUnit.SECONDS))fail('the reload of the pass did not start',null);
var status={},begin=java.lang.System.currentTimeMillis();
var unlock=mcp._lockProjectFlags(sample,status);
var waited=java.lang.System.currentTimeMillis()-begin;
unlock();
release.countDown();ui.join(20000);
if(status.acquired!==true||waited>1500)fail('A registration waits for the reload of a pass',{status:status,waitedMs:waited});
if(mcp._studioReloadNoted(sample,301))fail('A pass noted a mark while a registration wrote the flags',null);

// 3. A created Flow queues the reload of its project, whose whole tree the pass reloads.
reset();
if(mcp._studioReloadObject(explorer(queueTree(true)),sample)!=='queued'||submitted[0].written!==sample)fail('A project with a new Flow is not queued',calls);

// 4. A frontend write queues the tree of the Flow engine with the resources, the UI thread refreshing nothing itself; a
// removal queues it with the invalidation of the catalog, as the older path invalidated every data cache.
reset();
var resourceCalls=[];
var plugin={
	getProjectExplorerView:function(){return explorer(queueTree(true));},
	getProjectPluginResource:function(name){resourceCalls.push(name);return {refreshLocal:function(){resourceCalls.push('refreshLocal');}};}
};
if(mcp._studioReloadFrontend(plugin,sample,'frontend-source-mutation')!=='queued')fail('A frontend write is not queued',calls);
if(submitted[0].written!==null||submitted[0].engineSources!=='frontend'||submitted[0].resources!==true)fail('The frontend reload is not queued with the resources',{engineSources:submitted[0].engineSources,resources:submitted[0].resources});
if(mcp._studioReloadFrontend(plugin,sample,'object removed')!=='queued'||submitted[1].engineSources!=='catalog'||submitted[1].resources!==true)fail('A removal is not queued with the catalog caches',{engineSources:submitted[1]&&submitted[1].engineSources});
if(resourceCalls.length)fail('A queued frontend reload refreshes the resources on the UI thread',resourceCalls);

// 5. An older Studio (no reloadWrittenObject), a missing tree or a refused queue: the object is reloaded here, as before.
reset();lastChange=400;
if(mcp._studioReloadObject(explorer(new java.lang.Object()),flow)!=='reloaded')fail('An older Studio does not reload the object itself',calls);
if(calls.join()!=='root:SampleQueueProject,reloadDatabaseObject,refreshTreeObject')fail('The reload of an older Studio changed',calls);
if(!mcp._studioReloadNoted(sample,401))fail('The reload of an older Studio did not note its mark',null);
[explorer({}),explorer(null),explorer(new Error('no tree')),explorer(queueTree(false))].forEach(function(view,index){
	reset();
	if(mcp._studioReloadObject(view,flow)!=='reloaded'||calls.indexOf('reloadDatabaseObject')<0)fail('A Studio without the queue does not reload the object itself',{index:index,calls:calls});
});

// 6. An older Studio after a frontend write: the resources are refreshed here, on the UI thread, as before. The later
// steps of that path need the Studio itself (its logger, a real project), absent offline.
reset();resourceCalls=[];
plugin.getProjectExplorerView=function(){return explorer(new java.lang.Object());};
try{mcp._studioReloadFrontend(plugin,sample,'frontend-source-mutation');}catch(_offline){}
if(resourceCalls.join()!=='SampleQueueProject,refreshLocal'||submitted.length)fail('An older Studio does not refresh the resources itself',{resourceCalls:resourceCalls,submitted:submitted.length});
print('studio-reload-queue OK (promote, created Flow, frontend writes and removals queued, flag lock free during the pass, older Studio reloads itself)');
