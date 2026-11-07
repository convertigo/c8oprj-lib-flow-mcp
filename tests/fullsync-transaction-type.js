// A near-miss FullSync transaction type is understood, and an unknown one lists the valid types.
var engineRoot=new java.io.File(arguments[0]).getCanonicalFile(),project=new java.io.File(arguments[1]).getCanonicalFile();
var files=Packages.org.apache.commons.io.FileUtils,assertions=0,failures=[];
var contract=eval(String(files.readFileToString(new java.io.File(engineRoot,'modules/native-property-contract.js'),'UTF-8')));
function assert(v,m){assertions++;if(!v)failures.push(m);}
function read(path){return String(files.readFileToString(new java.io.File(project,path),'UTF-8'));}
function block(path,replace){var s=read(path);if(replace)s=replace(s);return eval(s.substring(s.indexOf('(function')));}
function context(){return {props:function(n){return n.props;},nativePropertyContract:function(){return contract;},write:function(){},lib:function(){return {assertProjectSaveAllowed:function(){return false;},withProjectFlagLock:function(p,f){return f();}};}};}
var scaffold=block('_flow/blocks/project/fullsync/scaffold.block.js',function(s){return s.replace('function loadedProject(engine, name) {','function loadedProject(engine, name) { return null;');});
function full(type){return scaffold.run(context(),{props:{project:'Probe',connector:{name:'probe'},dryRun:true,transactions:[{name:'T',type:type}]}});}
[['View','getView'],['view','getView'],['serverInfo','getServerInfo'],['GetDocument','getDocument'],['getAttachment','getDocumentAttachment'],['putAttachment','putDocumentAttachment']].forEach(function(p){
 assert(scaffold.canonicalType(p[0])===p[1],p[0]+' resolves to '+p[1]);
 var r;try{r=full(p[0]);assert(r.ok,p[0]+' plans');}catch(e){failures.push('Rejected '+p[0]+': '+e.message);}
});
['putDocument','deleteDocument','','bogus'].forEach(function(t){
 try{full(t);assert(false,'Accepted '+t);}catch(e){assert(/getView/.test(e.message)&&/postDocument/.test(e.message)&&/resetDatabase/.test(e.message),'Error for "'+t+'" lists the valid types: '+e.message);}
});
if(failures.length){throw new Error(failures.join('\n'));}
print('fullsync-transaction-type: '+assertions+' assertions');
