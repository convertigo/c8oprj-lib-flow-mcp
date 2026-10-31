var File=java.io.File, IO=Packages.org.apache.commons.io.FileUtils;
var root=java.nio.file.Files.createTempDirectory('flow-source-discard-').toFile();
var source=String(IO.readFileToString(new File(arguments[0],'_flow/blocks/frontend/svelte/source.block.js'),'UTF-8'));
var block=eval(source.substring(source.indexOf('(function')));
var dirty=true,text='<FlowComponent $$id="scratch"><Structure /></FlowComponent>\n';
var store={drafts:true,dirty:function(){return dirty;},read:function(){return text;},exists:function(f){return dirty||f.isFile();},discard:function(){dirty=false;return true;}};
var ctx={props:function(n){return n;},write:function(){},lib:function(){return {sourceStore:function(){return store;},queueSourceNotifications:function(){return true;}};}};
function assert(ok,msg){if(!ok)throw Error(msg);}
var props={operation:'discard',projectDir:String(root),sourceFile:'_flow/frontbuilder/svelte/model/App/src/routes/scratch/+page.flow.svelte'};
var result=block.run(ctx,props);
assert(result.discarded && !result.exists && !result.dirty,'working-copy-only scratch disappears: '+JSON.stringify(result));
assert(String(IO.readFileToString(new File(result.recoveryFile),'UTF-8'))===text,'discarded text has a recovery copy');
var saved=new File(root,props.sourceFile);IO.writeStringToFile(saved,'saved source','UTF-8');dirty=true;
result=block.run(ctx,props);assert(result.exists && String(IO.readFileToString(saved,'UTF-8'))==='saved source','saved source is preserved');
var repeat=block.run(ctx,props);assert(!repeat.discarded && repeat.exists,'repeat discard is unchanged');
var refused=false;try{block.run(ctx,{operation:'discard',projectDir:String(root),sourceFile:'../outside.flow.svelte'});}catch(e){refused=true;}assert(refused,'path traversal refused');
print('frontend-source-discard OK');
