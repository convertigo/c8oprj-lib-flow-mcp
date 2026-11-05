// entity.list returns one page: code-set, code-patch and code-check warn when a Flow keeps its rows
// without an offset and never reads hasMore, nextOffset or total. Real engine results through the MCP response.
// FLOW_MCP_EXPECT_BASELINE=true runs it against an older MCP root: every regression check fails, every contract check passes.
var root=String(new java.io.File(arguments[0]).getCanonicalPath()),engineDir=String(arguments[1]);
var File=java.io.File,FU=Packages.org.apache.commons.io.FileUtils,checks=0;
function read(p){return String(FU.readFileToString(new File(p),'UTF-8'));}
var negative=String(java.lang.System.getenv('FLOW_MCP_EXPECT_BASELINE')||'')==='true',results=[];
function assert(v,m){checks++;if(!v)throw Error(m);}
// check() records a regression (new behaviour) or a contract (no false positive) without stopping the run.
function check(v,m,regression){checks++;results.push({name:m,passed:!!v,regression:regression!==false});print((v?'PASS ':'FAIL ')+m);}
// The temporary project sits beside the sibling libraries, as a workspace project referencing them.
var temp=java.nio.file.Files.createTempDirectory(new File(engineDir).getCanonicalFile().getParentFile().getParentFile().toPath(),'entity-page-').toFile();
FU.writeStringToFile(new File(temp,'c8oProject.yaml'),'projectName: lib_flow_sql\nprojectName: lib_flow_crud_data\nprojectName: lib_flow_entity\n','UTF-8');
var app={getDirPath:function(){return String(temp);},getSequencesList:function(){return new java.util.ArrayList();},getFlowEngine:function(){return {isEngineSourceDirty:function(){return false;},getSourceDrafts:function(){return new java.util.LinkedHashMap();}};}};
var fakeEngine={isStudioMode:function(){return false;},theApp:{databaseObjectsManager:{getOriginalProjectByName:function(){return app;},getAllProjectNamesList:function(){var l=new java.util.ArrayList();l.add('App');return l;}}}};
var mocked={java:Packages.java,org:Packages.org,com:{twinsoft:{convertigo:{engine:{Engine:fakeEngine}}}}};
var mcp=(function(Packages){return eval(read(root+'/_flow/lib/mcp.js'));})(mocked);
try {
 var __flowEngineDir=engineDir,__flowProjectDir=String(temp),engine=eval(read(engineDir+'/Engine.js'));
 function respond(tool,args,value){return mcp.toolResponse({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:tool,arguments:args}},value,{}).result.structuredContent;}
 function set(name,body){
  var code='const _flow = { sourceVersion: 2 }\n\nfunction '+name+'({ input, config, result }) {\n'+body+'\n}\n';
  var args={projectDir:String(temp),name:name,code:code},value=JSON.parse(String(engine.flowCodeSet(JSON.stringify(args))));
  assert(value.ok,'code-set compiles '+name+': '+JSON.stringify(value.error||value.diagnostics));
  return respond('code-set',args,value);
 }
 function warning(out){return (out.warnings||[]).filter(function(w){return w.code==='ENTITY_LIST_PAGE_UNCHECKED';});}
 var unchecked=set('UncheckedList','  local.page = entity.list({ entity: "Ticket", checkAccess: true, options: { limit: 200 } })\n  result.titles = list.map({ items: local.page.rows, select: current.values.title })');
 var found=warning(unchecked);
 check(found.length===1&&found[0].path==='local.page'&&found[0].line===4&&/hasMore/.test(found[0].hint)&&/offset/.test(found[0].hint),'rows used without hasMore are warned at code-set');
 check(warning(set('CheckedList','  local.page = entity.list({ entity: "Ticket", checkAccess: true, options: { limit: 200 } })\n  if (local.page.hasMore) {\n    throw { code: "TOO_MANY_ROWS", message: "Narrow the filter", status: 413 }\n  }\n  result.titles = list.map({ items: local.page.rows, select: current.values.title })')).length===0,'a hasMore check is enough',false);
 check(warning(set('PagedList','  local.page = entity.list({ entity: "Ticket", checkAccess: true, options: { limit: 20, offset: input.offset || 0 } })\n  result.rows = local.page.rows')).length===0,'an explicit offset pages',false);
 check(warning(set('TotalList','  local.page = entity.list({ entity: "Ticket", checkAccess: true })\n  return { rows: local.page.rows, total: local.page.total }')).length===0,'returning total exposes the page',false);
 check(warning(set('ResultPage','  result.page = entity.list({ entity: "Ticket", checkAccess: true })')).length===0,'the whole page returned keeps hasMore',false);
 var two=set('TwoLists','  local.a = entity.list({ entity: "Ticket" })\n  local.b = entity.list({ entity: "Equipment" })\n  if (local.a.hasMore) {\n    throw { code: "TOO_MANY_ROWS", message: "Narrow", status: 413 }\n  }\n  result.n = local.b.rows.length');
 check(warning(two).length===1&&warning(two)[0].path==='local.b','each list is judged on its own page');
 // code-patch carries no full source: the warning reads the working copy file the Studio reports (codeFile).
 var patch={projectDir:String(temp),name:'CheckedList',revision:'',edits:[{oldText:'  if (local.page.hasMore) {\n    throw { code: "TOO_MANY_ROWS", message: "Narrow the filter", status: 413 }\n  }\n',newText:''}]};
 var current=JSON.parse(String(engine.flowCodeGet(JSON.stringify({projectDir:String(temp),name:'CheckedList'}))));patch.revision=current.revision;
 var patched=JSON.parse(String(engine.flowCodePatch(JSON.stringify(patch))));
 assert(patched.ok,'patch applies: '+JSON.stringify(patched.error));
 var after=JSON.parse(String(engine.flowCodeGet(JSON.stringify({projectDir:String(temp),name:'CheckedList'})))),copy=new File(temp,'_private/flow/CheckedList.flow.js');
 assert(after.code.indexOf('hasMore')<0,'working copy is the patched source');FU.writeStringToFile(copy,after.code,'UTF-8');patched.codeFile=String(copy);
 check(warning(respond('code-patch',patch,patched)).length===1,'code-patch warns from the written working copy');
 var refused=respond('code-set',{projectDir:String(temp),name:'Broken',code:'x'},{ok:false,error:{code:'FLOWSCRIPT_PARSE_FAILED',message:'x'}});
 check(warning(refused).length===0,'a refused source is not linted',false);
 // The guide teaches the same contract the warning names.
 var guide=read(root+'/_flow/resources/guide/entities.md');
 check(/## Lists: filters and pages/.test(guide)&&/ENTITY_LIST_PAGE_UNCHECKED/.test(guide)&&/ENTITY_LIST_INCOMPLETE/.test(guide)&&/local\.page\.hasMore/.test(guide)&&/nextOffset/.test(guide),'guide documents pages and both warnings');
 check(/\{field: value\}/.test(guide)&&/relations\s+included/.test(guide),'guide documents the short filter form on relations');
 check(/return \{ scope: \{ requesterId: input\.request\.user \} \}/.test(guide)&&/actorProvider/.test(guide)&&/ENTITY_RELATION_LABELS_OMITTED/.test(guide),'guide shows the role scope, the actor provider and omitted relation labels');
 // C1, C2, C4 of the 05/11 review: neutral refusals, writes that do not touch the relation, absent filter values.
 check(guide.indexOf('A create or update that neither sets nor changes such a relation does not read its target and succeeds; any write that sets or changes it, including to null, is refused.')>=0,'guide states which writes need a refused relation target');
 check(/The first is a heuristic on the source text:\s+it can miss a case \(false negatives\)/.test(guide),'guide says the page lint is a heuristic');
 check(guide.indexOf('A create also sets it when a default, an auto rule, the policy scope or the Possédé owner fills it.')>=0,'guide states that server-filled values set the relation');
 check(/Relation non autorisée\."\s+naming only `details\.field`/.test(guide)&&/a 404 still fails the read/.test(guide),'guide states the neutral relation refusal');
 check(/an absent value is\s+`ENTITY_FILTER_INVALID`/.test(guide),'guide states that an absent filter value is an error');
 var failed=results.filter(function(r){return !r.passed;}),regressions=results.filter(function(r){return r.regression;});
 var passed=negative?failed.length===regressions.length&&failed.every(function(r){return r.regression;}):failed.length===0;
 print(JSON.stringify({passed:passed,baseline:negative,checks:checks,regressionChecks:regressions.length,failures:failed.map(function(r){return r.name;})}));
 if(!passed)throw Error('entity-list-page-warning failed');
 print('entity-list-page-warning OK ('+checks+' checks)');
} finally {FU.deleteDirectory(temp);}
