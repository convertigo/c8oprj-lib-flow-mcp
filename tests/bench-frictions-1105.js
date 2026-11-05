// Offline host doubles expose the same draft list and workspace library as the failed calls.
var root=String(new java.io.File(arguments[0]).getCanonicalPath()),engineDir=String(arguments[1]);
var File=java.io.File,FU=Packages.org.apache.commons.io.FileUtils,checks=0;
function read(p){return String(FU.readFileToString(new File(p),'UTF-8'));}
function assert(v,m){checks++;if(!v)throw Error(m);}
var temp=java.nio.file.Files.createTempDirectory('mcp-1105-').toFile(),pending=['_flow/flows/notes_list.flow.js'];
var app={getDirPath:function(){return String(temp);},getSequencesList:function(){return new java.util.ArrayList();},getFlowEngine:function(){return {
 isEngineSourceDirty:function(){return false;},getSourceDrafts:function(){var m=new java.util.LinkedHashMap();pending.forEach(function(p){m.put(String(new File(temp,p)), 'draft');});return m;}
};}};
var projectDirs={App:String(temp),lib_flow_crud_data:String(new File(root,'../lib_flow_crud_data').getCanonicalPath())};
var fakeEngine={isStudioMode:function(){return false;},theApp:{databaseObjectsManager:{
 getOriginalProjectByName:function(n){return String(n)==='App'?app:{getDirPath:function(){return projectDirs[String(n)];}};},
 getAllProjectNamesList:function(){var l=new java.util.ArrayList();Object.keys(projectDirs).forEach(function(n){l.add(n);});return l;}
}}};
var realPackages=Packages,mocked={java:Packages.java,org:Packages.org,com:{twinsoft:{convertigo:{engine:{Engine:fakeEngine}}}}};
var mcp=(function(Packages){return eval(read(root+'/_flow/lib/mcp.js'));})(mocked);
try {
 var refusal;
 try {mcp.assertProjectSaveAllowed({project:'App',saveProject:true},'');}catch(e){refusal=e;}
 assert(refusal && refusal.code==='PROJECT_HAS_STUDIO_DRAFTS','pending drafts still refuse');
 assert(/code-get/.test(refusal.hint)&&/code-promote/.test(refusal.hint)&&/code-discard/.test(refusal.hint)&&/then code-set/.test(refusal.hint),'actionable order');
 assert(refusal.details.pendingDrafts[0]===pending[0]&&refusal.details.requiresChoice,'lists exact draft without discarding it');
 pending=[];assert(mcp.assertProjectSaveAllowed({project:'App',saveProject:true},'')===true,'resolved drafts allow save');
 var __flowEngineDir=engineDir,__flowProjectDir=String(temp),engine=eval(read(engineDir+'/Engine.js'));
 ['data.read','data.write','list.slice','list.concat'].forEach(function(name){
  var raw=JSON.parse(engine.blockGet(JSON.stringify({name:name})));assert(!raw.ok&&raw.error.code==='UNKNOWN_BLOCK','unknown stays refused '+name);
  var response=mcp.toolError({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'flow-block-get',arguments:{project:'App',name:name}}},raw.error).result.structuredContent;
  if(name.indexOf('data.')===0){
   assert(response.error.details.workspaceProviders[0].project==='lib_flow_crud_data','real workspace provider '+name);
   assert(response.error.hint.indexOf('flow-project-reference')>=0&&response.error.hint.indexOf(name)>=0,'reference recovery '+name);
   assert(response.error.details.contract.indexOf(name)>=0,'contract targets the exact provider '+name);
   assert(response.error.hint.indexOf('Inspect the closest')<0,'exact provider takes precedence over approximations '+name);
  }else if(name==='list.slice'){
   assert(raw.error.details.candidates.some(function(c){return c.block==='list.take';}),'existing slice alternative');
   assert(!response.error.details.workspaceProviders&&response.error.hint.indexOf('list.take')>=0,'do not suggest an unrelated workspace reference for a slice');
   var twice=mcp.toolError({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'flow-block-get',arguments:{project:'App',name:name}}},response.error).result.structuredContent;
   assert(twice.error.hint===response.error.hint,'error enrichment is idempotent');
  }
 });
 // Only the descriptor comes from this loopback stub; no browser or legacy server is called.
 var original=JSON.parse(read(root+'/tests/fixtures/bench-1105-browser.json'));
 var originalJson=JSON.stringify(original);
 var server=Packages.com.sun.net.httpserver.HttpServer.create(new java.net.InetSocketAddress('127.0.0.1',0),0);
 server.createContext('/convertigo/api/mcp',new Packages.com.sun.net.httpserver.HttpHandler({handle:function(exchange){
  var body=JSON.parse(String(new java.lang.String(exchange.getRequestBody().readAllBytes(),'UTF-8')));
  var bytes=new java.lang.String(JSON.stringify({jsonrpc:'2.0',id:body.id,result:{tools:[original]}})).getBytes('UTF-8');
  exchange.sendResponseHeaders(200,bytes.length);exchange.getResponseBody().write(bytes);exchange.close();
 }}));server.start();
 try {
  var descriptor=mcp.legacyRelayTools({convertigoContext:function(){return {httpServletRequest:{getScheme:function(){return 'http';},getLocalPort:function(){return server.getAddress().getPort();},getContextPath:function(){return '/convertigo';},getHeader:function(){return null;}}};}})[0];
  assert(descriptor&&/paths/.test(descriptor.description)&&/inputs.project/.test(descriptor.description),'required new-call arguments advertised');
  assert(/verificationId alone/.test(descriptor.description),'resume contract unchanged');
  assert(/Required for a new check/.test(descriptor.inputSchema.properties.paths.description),'paths property explicit');
  assert(!descriptor.inputSchema.required&&JSON.stringify(original)===originalJson,'no global requirement on resume and no legacy mutation');
  assert(!descriptor.inputSchema.properties.inputs&&/subagent-run/.test(descriptor.description)&&/profile:\u0022verifier/.test(descriptor.description),'historical schema routes Flow to the existing verifier tool');
  original.inputSchema.properties.inputs={type:'object'};
  var extended=mcp.legacyRelayTools({convertigoContext:function(){return {httpServletRequest:{getScheme:function(){return 'http';},getLocalPort:function(){return server.getAddress().getPort();},getContextPath:function(){return '/convertigo';},getHeader:function(){return null;}}};}})[0];
  assert(/include inputs.project/.test(extended.description)&&!/cannot carry/.test(extended.description),'compatible schema documents project directly');
 } finally {server.stop(0);}
 print('bench-frictions-1105 OK ('+checks+' checks)');
} finally {FU.deleteDirectory(temp);}
