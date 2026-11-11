// Review regressions are asserted on both engine errors and complete MCP envelopes.
var root=String(new java.io.File(arguments[0]).getCanonicalPath()),__flowEngineDir=String(arguments[1]);
var File=java.io.File,FU=Packages.org.apache.commons.io.FileUtils,checks=0;
var temp=java.nio.file.Files.createTempDirectory(new File(root,'..').toPath(),'flow-review-1105-').toFile();
var __flowProjectDir=String(temp),__flowProjectsDir=String(new File(root,'..').getCanonicalPath());
function read(p){return String(FU.readFileToString(new File(p),'UTF-8'));}
function write(p,s){FU.writeStringToFile(new File(p),String(s),'UTF-8');}
function assert(v,m){checks++;if(!v)throw Error(m);}
var marker='FAKE-MARKER-0001';
var engine=eval(read(__flowEngineDir+'/Engine.js')),mcp=eval(read(root+'/_flow/lib/mcp.js'));
function api(name,args){
 if(name==='resourcePatch'&&args.content!==undefined){args=Object.assign({},args,{edits:[{oldText:read(String(temp)+'/'+args.path),newText:args.content}]});delete args.content;}
 return JSON.parse(engine[name](JSON.stringify(Object.assign({projectDir:String(temp)},args))));
}
function request(name){return {jsonrpc:'2.0',id:1,method:'tools/call',params:{name:name,arguments:{projectDir:String(temp),responseDetail:'full'}}};}
function finalResponse(raw,name){
 var req=request(name);
 return mcp.finalizeResponse({},req,mcp.sanitizeForMcp(mcp.toolResponse(req,raw,{}),{}));
}
function finalError(raw,name){
 var req=request(name),out=mcp.finalizeResponse({},req,mcp.sanitizeForMcp(mcp.toolError(req,raw.error,{}),{}));
 assert(JSON.stringify(raw).indexOf(marker)<0,'engine error contains no marker');
 assert(JSON.stringify(out).indexOf(marker)<0,'entire MCP error envelope contains no marker');
 var full=finalResponse(raw,name);
 assert(JSON.stringify(full).indexOf(marker)<0,'entire MCP tool response contains no marker');
 return out.result.structuredContent.error;
}
function patchText(text,edits){
 edits.forEach(function(e){
  var at=text.indexOf(e.oldText),prefix=text.substring(0,at),suffix=text.substring(at+e.oldText.length);
  assert(at>=0&&at===text.lastIndexOf(e.oldText),'patch oldText is unique and exact');
  var changed=prefix+e.newText+suffix;
  assert(changed.substring(0,at)===prefix&&changed.substring(at+e.newText.length)===suffix,'outside each announced edit is identical');
  text=changed;
 });return text;
}
var initial='version: 1\nengineQName: lib_flow_engine.Engine\nconfig: {}\n';
var path='_flow/engine.yaml',schema='_flow/resources/sql/app/schema.json',data='_flow/resources/sql/app/data.json';
function doc(){return {version:1,engineQName:'lib_flow_engine.Engine',config:{sql:{connections:{app:{url:'jdbc:hsqldb:file:.//_flow/resources/sql/app/db/test',user:'SA',password:marker,dialect:'hsqldb'}},initializers:{app:{connection:'app',schemaFile:'.//'+schema,dataFile:'.//'+data}}}}};}
try{
 write(String(temp)+'/c8oProject.yaml','convertigo: 8.5.0.m006\n↓Review [core.Project]:\n  ↓sql [references.ProjectSchemaReference]:\n    projectName: lib_flow_sql\n  ↓crud [references.ProjectSchemaReference]:\n    projectName: lib_flow_crud_data\n');
 write(String(temp)+'/'+schema,'{"version":1,"tables":[]}');write(String(temp)+'/'+data,'{"tables":[]}');
 var yaml='version: 1\nengineQName: lib_flow_engine.Engine\nconfig:\n  sql:\n    connections:\n      app:\n        url: jdbc:hsqldb:file:.//_flow/resources/sql/app/db/test\n        user: SA\n        password: "'+marker+'" # private field stays byte-for-byte\n        dialect: hsqldb\n    initializers:\n      app:\n        connection: app\n        schemaFile: ".//'+schema+'" # preserve schema comment\n        dataFile: \'.//'+data+'\' # preserve seed comment\n';
 [JSON.stringify(doc()),yaml].forEach(function(source,i){
  write(String(temp)+'/'+path,initial);var hash=api('resourceGet',{path:path}).hash;
  var raw=api('resourcePatch',{path:path,content:source,baseHash:hash});
  assert(!raw.ok&&raw.error.code==='SQL_CONFIG_INVALID','B1 refused before write '+i+' '+JSON.stringify(raw).replace(new RegExp(marker,'g'),'[fixture]'));
  assert(read(String(temp)+'/'+path)===initial,'B1 refusal writes nothing');
  var error=finalError(raw,'flow-resource-patch'),edits=error.details.proposedPatch.edits;
  assert(edits.length===2&&edits.every(function(e){return e.oldText==='.//'+schema||e.oldText==='.//'+data;}),'B1 only two path values are exposed');
  var fixed=patchText(source,edits);
  assert(fixed===source.replace('.//'+schema,schema).replace('.//'+data,data),'B1 all unrelated bytes and quotes/comments unchanged');
  var stale=api('resourcePatch',{path:path,content:fixed,baseHash:'stale'});
  assert(!stale.ok&&stale.error.code==='RESOURCE_BASE_HASH_MISMATCH'&&read(String(temp)+'/'+path)===initial,'B1 stale hash refuses unchanged');
  var accepted=api('resourcePatch',{path:path,content:fixed,baseHash:hash});
  assert(accepted.ok&&read(String(temp)+'/'+path)===fixed,'B1 final MCP edits apply and validate');
 });
 // A duplicate occurrence in a comment and an alias shared with another field cannot be narrowed safely.
 [yaml+'# duplicate .//'+schema+'\n',yaml.replace('schemaFile: ".//'+schema+'"','schemaFile: &schema ".//'+schema+'"')+'        also: *schema\n',JSON.stringify(doc()).replace('.//'+schema,'.\\/\\/'+schema.replace(/\//g,'\\/'))].forEach(function(source){
  write(String(temp)+'/'+path,initial);
  var raw=api('resourcePatch',{path:path,content:source,baseHash:api('resourceGet',{path:path}).hash});
  assert(!raw.ok,'ambiguous configuration still refused');
  var error=finalError(raw,'flow-resource-patch');
  assert(!error.details||!error.details.proposedPatch,'ambiguous or escaped scalar offers no edit');
  assert(read(String(temp)+'/'+path)===initial,'fallback writes nothing');
 });
 // B2: arbitrary strings/containers never become a diagnostic string or details.received.
 [marker,{password:marker},[marker],null,true,0,1.5,1000000].forEach(function(value){
  var d=doc();delete d.config.sql.initializers;d.config.sql.connections.app.maxConnections=value;
  write(String(temp)+'/'+path,initial);
  var raw=api('resourcePatch',{path:path,content:JSON.stringify(d),baseHash:api('resourceGet',{path:path}).hash});
  assert(!raw.ok&&raw.error.code==='SQL_CONFIG_INVALID','B2 invalid bound refused');
  var err=finalError(raw,'flow-resource-patch').details.errors.filter(function(e){return /maxConnections$/.test(e.path);})[0];
  assert(err&&/integer/.test(err.message)&&(typeof value==='number'?err.message.indexOf('Received '+String(value)+'.')>=0:/Received type:/.test(err.message))&&err.details.minimum===1,'B2 type and bounds explained');
  if(typeof value==='number')assert(err.details.received===value,'finite number may be retained');
  else assert(!Object.prototype.hasOwnProperty.call(err.details,'received'),'arbitrary received value omitted');
  write(String(temp)+'/'+path,JSON.stringify(d));
  var checked=api('run',{flowSource:'function Check({result}) {\nlocal.report = sql.configCheck({})\nresult.report = local.report\n}',includeTrace:false});
  assert(checked.ok&&!checked.result.report.ok,'B2 configCheck also refuses '+JSON.stringify(checked).replace(new RegExp(marker,'g'),'[fixture]'));
  var envelope=finalResponse(checked,'code-run');
  assert(JSON.stringify(envelope).indexOf(marker)<0,'B2 configCheck final envelope omits marker');
 });
 write(String(temp)+'/'+path,initial);
 var suffix='\nresult.keep = 7\nresult.other = 9';
 // Exact B3 reproduction, plus duplicate/nonliteral headers. No proposal is safer than a partial guess.
 ['_flow({config:{value:JSON.stringify({a:1})}})','_flow({config:{value:input.x}})','_flow({})\n_flow({})'].forEach(function(header,i){
  var name='Unsafe'+i,source=header+suffix,raw=api('flowCodeSet',{name:name,code:source,autoCorrect:true});
  assert(!raw.ok&&api('flowCodeGet',{name:name}).code===source,'B3 exact source retained');
  finalError(raw,'code-set');
  var out=finalResponse(raw,'code-set').result.structuredContent;
  assert(!out.proposedPatch||!out.proposedPatch.edits||out.proposedPatch.edits.length===0,'B3 final MCP supplies no unsafe edit');
 });
 ['// const _flow = {}\n','result.note = "const _flow = {}"\n',''].forEach(function(prefix,i){
  var name='Literal'+i,source=prefix+'_flow({config:{value:7}})'+suffix;
  var raw=api('flowCodeSet',{name:name,code:source,autoCorrect:true});
  finalError(raw,'code-set');
  var out=finalResponse(raw,'code-set').result.structuredContent,edits=out.proposedPatch.edits;
  assert(edits.length===1&&edits[0].oldText==='_flow({config:{value:7}})','literal header has a bounded edit');
  var expected=patchText(source,edits),fixed=api('flowCodePatch',{name:name,revision:out.revision,edits:edits});
  assert(fixed.ok&&api('flowCodeGet',{name:name}).code===expected,'MCP metadata edit applies without unrelated changes');
  var run=api('flowCodeRun',{name:name});assert(run.ok&&run.result.keep===7&&run.result.other===9,'B3 suffix instructions both execute');
 });
 // Header and slot diagnostics are intentionally staged, each proposal preserving both following instructions.
 var combined='_flow({config:{value:7}})\nwhile({condition:false,maxIterations:2,$nodes(){ result.loop = 1 }})'+suffix;
 var first=api('flowCodeSet',{name:'Combined',code:combined,autoCorrect:true});
 var firstOut=finalResponse(first,'code-set').result.structuredContent;
 var applied=api('flowCodePatch',{name:'Combined',revision:firstOut.revision,edits:firstOut.proposedPatch.edits,autoCorrect:true});
 var second=finalResponse(applied,'code-patch').result.structuredContent;
 assert(second.proposedPatch&&second.proposedPatch.edits.length,'independent slot repair remains available after metadata repair');
 var before=api('flowCodeGet',{name:'Combined'}).code,expected=patchText(before,second.proposedPatch.edits);
 var done=api('flowCodePatch',{name:'Combined',revision:second.revision,edits:second.proposedPatch.edits});
 assert(done.ok&&api('flowCodeGet',{name:'Combined'}).code===expected&&expected.slice(-suffix.length)===suffix,'combined repairs preserve exact suffix');
 print('review-1105 OK ('+checks+' checks)');
}finally{FU.deleteDirectory(temp);}
