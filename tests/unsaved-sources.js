// The compact and full public responses retain every unsaved kind and never claim readiness.
var File=java.io.File,IO=Packages.org.apache.commons.io.FileUtils;
var root=java.nio.file.Files.createTempDirectory('unsaved-sources-').toFile().getCanonicalFile();
var realPackages=Packages;
var page='_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte';
var block='_flow/blocks/app/demo.block.js';
var pending=[page,block,'_flow/flows/New.flow.js'];
var existing=new realPackages.com.twinsoft.convertigo.beans.flow.Flow();
existing.setName('Existing');existing.setFlowSource('function Existing({input,config,result}) { result.ok = true }');
var sequences=[existing];
var project={getName:function(){return 'App';},getDirFile:function(){return root;},getDirPath:function(){return String(root);},
 getSequencesList:function(){return {toArray:function(){return sequences;}};},
 getFlowEngine:function(){return {isEngineSourceDirty:function(){return false;},getSourceDrafts:function(){return {keySet:function(){return {toArray:function(){return pending.map(function(path){return String(new File(root,path));});}};}};}};}};
var Packages={java:realPackages.java,javax:realPackages.javax,org:realPackages.org,
 com:{twinsoft:{convertigo:{engine:{Engine:{theApp:{databaseObjectsManager:{getLoadedProjectByName:function(){return project;}}}}}}}}};
var mcp=eval(String(IO.readFileToString(new File(arguments[0],'_flow/lib/mcp.js'),'UTF-8')));
function assert(ok,message){if(!ok)throw Error(message);}
function answer(name,args,value){args.project='App';args.projectDir=String(root);return mcp.toolResponse({id:1,params:{name:name,arguments:args}},value,{}).result.structuredContent;}
['compact','full'].forEach(function(detail){
 var out=answer('flow-app-progress',{detail:detail},{ok:true,complete:true,pocReady:true,hardeningComplete:true,progressPhase:'complete',next:'Ready',tasks:[{id:'preview',done:true}],progress:{completed:1,total:1,percent:100}});
 assert(out.unsavedSources.count===4,'Flow DBO, new Flow, page and block are counted: '+JSON.stringify(out));
 assert(out.unsavedSources.items.some(function(item){return item.kind==='page' && item.path===page;}),'page draft has its path');
 assert(out.unsavedSources.items.some(function(item){return item.kind==='flow' && item.qname==='App.New';}),'new Flow source has its qname');
 assert(!out.complete && !out.pocReady && !out.hardeningComplete && /code-promote/.test(out.next) && /code-discard/.test(out.next),'progress stays not ready and gives recovery');
 assert(out.progress.percent<100 && out.progress.total===2 && !/Ready$/.test(out.next),'progress cannot present 100% or ready text while a source is unsaved');
 ['dev.sync','build'].forEach(function(action){var result=answer('frontend-svelte-action',{actionId:action,detail:detail},{ok:true,generated:false,status:'stopped',stopReason:'first-viewer-timeout',next:'dev.ensure(wait:true)'});
 assert(result.unsavedSources.count===4 && /code-discard/.test(result.next),'frontend action retains unsaved sources: '+action);
 if(action==='dev.sync')assert(result.status==='stopped' && result.stopReason==='first-viewer-timeout' && /dev.ensure/.test(result.next),'stopped sync retains lifecycle fields');});
 var run=answer('code-run',{detail:detail},{ok:true,qname:'App.Existing',draft:true,result:{done:true}});
 assert(run.unsavedSources.count===4 && /code-promote/.test(run.next),'code-run retains all drafts');
});
var byQName=mcp.toolResponse({id:1,params:{name:'code-run',arguments:{qname:'App.Existing'}}},{ok:true,qname:'App.Existing',draft:true,result:{}},{}).result.structuredContent;
assert(byQName.unsavedSources.count===4,'qname alone selects the project for all unsaved sources');
pending=[];sequences=[];
var clean=answer('flow-app-progress',{}, {ok:true,complete:true,pocReady:true});
assert(clean.unsavedSources.count===0 && clean.complete && clean.pocReady,'clean application can be ready');
print('unsaved-sources OK');
