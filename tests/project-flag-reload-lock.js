// A Studio reload of the Project Explorer runs on the UI thread and can wait minutes: the change flag lock of the
// project is never held while it runs, so a Flow registration (code-promote, code-set) does not wait 30 s for it and
// then write its flags without the lock. A flag write during the reload keeps the mark a Save lowers.
var project=new java.io.File(arguments[0]).getCanonicalFile();
var mcp=eval(String(org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project,'_flow/lib/mcp.js'),'UTF-8')));
var concurrent=java.util.concurrent;
function fail(message,value){throw new Error(message+': '+JSON.stringify(value));}
var lastChange=100;
var sample={hasChanged:false,getName:function(){return 'SampleFlagProject';},getLastChange:function(){return lastChange;}};

// 1. While a reload runs, a registration takes the flag lock at once.
var reloadStarted=new concurrent.CountDownLatch(1),releaseReload=new concurrent.CountDownLatch(1);
var reloader=new java.lang.Thread(new java.lang.Runnable({run:function(){
	mcp._reloadNotingProjectFlag(sample,function(){reloadStarted.countDown();releaseReload.await(20,concurrent.TimeUnit.SECONDS);sample.hasChanged=true;lastChange=101;});
}}));
reloader.start();
if(!reloadStarted.await(10,concurrent.TimeUnit.SECONDS))fail('reload did not start',null);
var status={},started=java.lang.System.currentTimeMillis();
var unlock=mcp._lockProjectFlags(sample,status);
var waited=java.lang.System.currentTimeMillis()-started;
unlock();
if(status.acquired!==true||waited>1500)fail('A registration waits for a running reload',{status:status,waitedMs:waited});
releaseReload.countDown();reloader.join(20000);
// the registration wrote flags during the reload: the reload does not take the mark for its own
if(mcp._studioReloadNoted(sample,101))fail('A reload noted a mark while a registration wrote the flags',null);

// 2. A reload alone that marks the project notes the mark: the next registration may lower it.
sample.hasChanged=false;lastChange=200;
mcp._reloadNotingProjectFlag(sample,function(){sample.hasChanged=true;lastChange=201;});
if(!mcp._studioReloadNoted(sample,201))fail('A reload alone did not note its mark',null);

// 3. The reload is not run under the lock, and still runs when the lock is busy (no note then).
var holder=new concurrent.CountDownLatch(1),release=new concurrent.CountDownLatch(1);
var other=new java.lang.Thread(new java.lang.Runnable({run:function(){var u=mcp._lockProjectFlags(sample,{});holder.countDown();release.await(20,concurrent.TimeUnit.SECONDS);u();}}));
other.start();holder.await(10,concurrent.TimeUnit.SECONDS);
sample.hasChanged=false;lastChange=300;var reloaded=false;
mcp._reloadNotingProjectFlag(sample,function(){reloaded=true;sample.hasChanged=true;lastChange=301;});
release.countDown();other.join(20000);
if(!reloaded||mcp._studioReloadNoted(sample,301))fail('A busy lock runs the reload without a note',{reloaded:reloaded});
print('project-flag-reload-lock OK (lock free during a reload, registration at once, reload-only mark noted)');
