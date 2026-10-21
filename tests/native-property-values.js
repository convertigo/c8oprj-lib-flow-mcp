// Preflight every native writer with real JVM enum contracts. DBO lookup alone is a test double.
var engineRoot=new java.io.File(arguments[0]).getCanonicalFile(),project=new java.io.File(arguments[1]).getCanonicalFile();
var files=Packages.org.apache.commons.io.FileUtils,assertions=0,failures=[];
var contract=eval(String(files.readFileToString(new java.io.File(engineRoot,'modules/native-property-contract.js'),'UTF-8')));
function assert(v,m){assertions++;if(!v)failures.push(m);}
function read(path){return String(files.readFileToString(new java.io.File(project,path),'UTF-8'));}
function block(path,replace){var s=read(path);if(replace)s=replace(s);return eval(s.substring(s.indexOf('(function')));}
function context(){return {props:function(n){return n.props;},nativePropertyContract:function(){return contract;},write:function(){},lib:function(){return {assertProjectSaveAllowed:function(){return false;},withProjectFlagLock:function(p,f){return f();}};}};}
function bad(call,path,value){try{call();assert(false,'Accepted '+path+'='+JSON.stringify(value));}catch(e){assert(e.message.indexOf(path)>=0&&e.message.indexOf('takes')>=0,'Refusal names property and allowed values: '+String(e));}}
var __propertyProject={version:'old',description:'original',changed:function(){},getVersion:function(){return this.version;},setVersion:function(v){this.version=v;},getComment:function(){return this.description;},setComment:function(v){this.description=v;},getReferenceList:function(){return {iterator:function(){return {hasNext:function(){return false;}};}};}};
var metadata=block('_flow/blocks/project/metadata.block.js',function(s){return s.replace('var project = Engine.theApp.databaseObjectsManager.getOriginalProjectByName(projectName, false);','var project = __propertyProject;');});
var scaffold=block('_flow/blocks/project/fullsync/scaffold.block.js',function(s){return s.replace('function loadedProject(engine, name) {','function loadedProject(engine, name) { return null;');});
var reference=block('_flow/blocks/project/reference.block.js',function(s){return s.replace('function resolveProject(engine, name, anchorProject) {','function resolveProject(engine, name, anchorProject) { return __propertyProject;');});
function meta(props){return metadata.run(context(),{props:Object.assign({project:'Probe'},props)});}
function full(props){return scaffold.run(context(),{props:Object.assign({project:'Probe',connector:{name:'probe'},dryRun:true},props)});}
function ref(props){return reference.run(context(),{props:Object.assign({project:'Probe',reference:'Other',url:'https://github.com/example/project.git',dryRun:true},props)});}
['abc','Bogus','private','yes',' 60 ',60,{},[],null].forEach(function(v){
 bad(function(){full({transactions:[{name:'Write',type:'postDocument',useHash:v}]});},'useHash',v);
 bad(function(){full({transactions:[{name:'Write',type:'postDocument',variables:[{name:'key',required:v}]}]});},'required',v);
 bad(function(){full({listeners:[{name:'Listener',type:'post',enabled:v}]});},'enabled',v);
 bad(function(){ref({autoPull:v});},'autoPull',v);
});
['abc','Bogus','private','yes','',{},[],true,null,2147483648].forEach(function(v){bad(function(){full({listeners:[{name:'Listener',chunk:v}]});},'chunk',v);});
['abc','Bogus','yes',' 60 ',{},[],true,null].forEach(function(v){
 bad(function(){full({transactions:[{name:'Get',type:'getDocument',accessibility:v}]});},'accessibility',v);
 bad(function(){full({connector:{name:'probe',anonymousReplication:v}});},'anonymousReplication',v);
});
[true,60,{},[],null].forEach(function(v){bad(function(){meta({version:v});},'version',v);bad(function(){meta({description:v});},'description',v);});
['abc',' 60 ','Bogus','private','yes'].forEach(function(v){
 var r=meta({description:v});assert(r.description===v,'Text descriptions retain '+JSON.stringify(v));
});
var v=meta({version:' 60 '});assert(v.version==='60'&&v.normalizations.length===1,'Version trim is explicitly reported');
var plain=meta({version:'abc'});assert(plain.version==='abc'&&plain.normalizations.length===0,'Version is bounded text, not a number or enum');
bad(function(){meta({responseTimeout:'abc'});},'responseTimeout','abc');
var a=ref({autoPull:' TRUE '});assert(a.ok&&a.normalizations.length===1&&/autoPull=true/.test(a.url),'Reference boolean normalization is reported: '+JSON.stringify(a));
['abc',' 60 ','Bogus','private','yes'].forEach(function(value){bad(function(){ref({url:'Other=https://github.com/example/project.git:autoPull='+value});},'url.autoPull',value);});
var embedded=ref({url:'Other=https://github.com/example/project.git:autoPull= TRUE '});
assert(embedded.ok&&/autoPull=true/.test(embedded.url)&&embedded.normalizations.some(function(n){return n.property==='url.autoPull'&&n.after===true;}),'Embedded autoPull is validated and normalization reported: '+JSON.stringify(embedded));
bad(function(){ref({branch:'main:autoPull=yes'});},'branch','main:autoPull=yes');
bad(function(){ref({path:'project:autoPull=yes'});},'path','project:autoPull=yes');
var tx=full({transactions:[{name:'Get',type:'getDocument',accessibility:'private'}]});
assert(tx.ok&&tx.normalizations.some(function(n){return n.property.indexOf('accessibility')>=0&&n.after==='Private';}),'FullSync enum canonical name is reported: '+JSON.stringify(tx));
var library=read('_flow/lib/mcp.js').replace('jsonRpcResult: jsonRpcResult,','_renderNative:renderFlowInputVariableYaml,jsonRpcResult:jsonRpcResult,');
var mcp=eval(library);
['abc',' 60 ','Bogus','private','yes'].forEach(function(v){
 bad(function(){mcp._renderNative('value',{type:'string',required:v},'variables.RequestableVariable-1');},'required',v);
 bad(function(){mcp._renderNative('value',{type:'string',visibility:v},'variables.RequestableVariable-1');},'visibility',v);
});
bad(function(){mcp._renderNative('value',{type:'Bogus'},'variables.RequestableVariable-1');},'type','Bogus');
assert(__propertyProject.description==='yes','Rejected options did not change unrelated bean properties');
if(failures.length)throw new Error(failures.join('\n'));
print('native-property-values MCP OK ('+assertions+' assertions)');
