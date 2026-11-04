// Real MCP tool dispatch and writers; model only the servlet's authenticated caller/headers.
var File=java.io.File, FU=Packages.org.apache.commons.io.FileUtils;
var projectDir=String(arguments[0]), engineDir=String(arguments[1]);
var __flowEngineDir=engineDir, __flowProjectDir=projectDir, context, checks=0;
var temp=java.nio.file.Files.createTempDirectory('flow-observed-revision-').toFile();
var attributes=new java.util.concurrent.ConcurrentHashMap();
Packages.com.twinsoft.convertigo.engine.Engine.initServletContext(new Packages.jakarta.servlet.ServletContext({
 getAttribute:function(n){return attributes.get(n);},setAttribute:function(n,v){attributes.put(n,v);},removeAttribute:function(n){attributes.remove(n);}
}));
var engine=eval(String(FU.readFileToString(new File(engineDir,'Engine.js'),'UTF-8')));
var router='function Test({input,result}) { result.response = mcp.tools.call({request:input.request}) }';
function assert(v,m){checks++;if(!v)throw new Error(m);}
function actor(id,sub,caller){context={httpServletRequest:{getHeader:function(n){return n==='X-Convertigo-Conversation-Id'?id:n==='X-Convertigo-Subagent-Run'?sub:null;},getAttribute:function(n){return n==='com.convertigo.flow.mcp.caller'?(caller||'agent'):null;},getSession:function(){return null;}}};}
function call(name,args){args.projectDir=String(temp);args.responseDetail='full';var r=JSON.parse(engine.run(JSON.stringify({flowSource:router,includeTrace:false,input:{request:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:name,arguments:args}}}})));assert(r.ok,'route '+JSON.stringify(r));return r.result.response.result.structuredContent;}
function source(n){return 'function Example({input,result}) { result.n = '+n+' }';}
try {
 FU.writeStringToFile(new File(temp,'c8oProject.yaml'),'↑convertigo: 8.5.0\nproject: RevisionTest\n','UTF-8');
 var file=new File(temp,'_flow/flows/Example.flow.js');FU.writeStringToFile(file,source(1),'UTF-8');
 actor('A');var a=call('code-get',{name:'Example'});assert(a.ok && a.revision,'read A');
 actor('B');var b=call('code-get',{name:'Example'});assert(b.revision===a.revision,'read B');
 actor('A');var r=call('code-set',{name:'Example',code:source(2)});assert(r.ok && r.revisionInferred,'A replaces observed source '+JSON.stringify(r));
 actor('B');r=call('code-set',{name:'Example',code:source(3)});assert(r.ok===false && /REVISION_MISMATCH/.test(r.error.code),'stale B refused '+JSON.stringify(r));
 actor('A');r=call('code-patch',{name:'Example',edits:[{oldText:'= 2',newText:'= 4'}]});assert(r.ok && r.revisionInferred,'own write observation '+JSON.stringify(r));
 r=call('code-set',{name:'Example',revision:a.revision,code:source(5)});assert(r.ok===false && /REVISION_MISMATCH/.test(r.error.code),'explicit stale revision wins');
 actor('A','child');r=call('code-patch',{name:'Example',edits:[{oldText:'= 4',newText:'= 5'}]});assert(r.error.code==='FLOW_CODE_REVISION_REQUIRED','subagent isolated '+JSON.stringify(r));
 actor('A',null,'other');r=call('code-patch',{name:'Example',edits:[{oldText:'= 4',newText:'= 5'}]});assert(r.error.code==='FLOW_CODE_REVISION_REQUIRED','caller isolated');
 context=null;r=call('code-patch',{name:'Example',edits:[{oldText:'= 4',newText:'= 5'}]});assert(r.error.code==='FLOW_CODE_REVISION_REQUIRED','unidentified client unchanged');
 actor('A');r=call('code-set',{name:'Example',code:'function Example({input,result}) { result.n = }'});assert(!r.ok && r.written && r.revision,'invalid draft kept');
 r=call('code-patch',{name:'Example',edits:[{oldText:'result.n = }',newText:'result.n = 6 }'}]});assert(r.ok && r.revisionInferred,'invalid own draft observation '+JSON.stringify(r));
 // A direct file edit after a read still changes the current revision.
 call('code-discard',{name:'Example'});call('code-get',{name:'Example'});FU.writeStringToFile(file,source(7),'UTF-8');
 r=call('code-set',{name:'Example',code:source(8)});assert(!r.ok && /REVISION_MISMATCH/.test(r.error.code),'external edit refused '+JSON.stringify(r));
 // Frontend revision rules before/after source validation; plain source has no provider dependencies.
 var path='_flow/frontbuilder/svelte/model/RevisionTest/src/app.flow.css';
 var front=new File(temp,path);FU.writeStringToFile(front,'.one { color: red; }','UTF-8');
 actor('F');r=call('code-set',{sourceFile:path,code:'.two { color: blue; }'});assert(r.error.code==='FRONTEND_SOURCE_REVISION_REQUIRED','unread frontend refused');
 call('code-get',{sourceFile:path});r=call('code-set',{sourceFile:path,code:'.two { color: blue; }'});assert(r.ok && r.revisionInferred,'frontend observed read '+JSON.stringify(r));
 FU.writeStringToFile(front,'.external { color: black; }','UTF-8');r=call('code-set',{sourceFile:path,code:'.three { color: green; }'});assert(!r.ok && /REVISION_MISMATCH|STALE_REVISION/.test(r.error.code),'frontend external edit refused '+JSON.stringify(r));
 // The default-source read returns the resolved file; it must count as an observation too.
 var home='_flow/frontbuilder/svelte/model/RevisionTest/src/routes/+page.flow.svelte';
 var page='<script module>export const _flow={sourceVersion:2};</script><FlowComponent $$id="home"><Variables><State $$id="st" type="boolean" value={false} /></Variables><Structure /></FlowComponent>';
 FU.writeStringToFile(new File(temp,home),page,'UTF-8');
 FU.writeStringToFile(new File(temp,'_flow/engine.yaml'),'version: 1\nconfig:\n  frontbuilder:\n    svelte:\n      target: svelte5\n      resourceRoot: '+String(java.lang.System.getenv('FLOW_FRONTBUILDER_RESOURCE_ROOT'))+'\n      modelPath: '+home+'\n','UTF-8');
 actor('Default');r=call('code-get',{kind:'source'});assert(r.ok && r.sourceFile===home,'default source read '+JSON.stringify(r));
 r=call('code-set',{sourceFile:home,code:page});assert(r.ok && r.revisionInferred,'default source observed '+JSON.stringify(r));
 var rejected=page.replace('<Structure />','<Events><OnMount><Actions><If test="@page.st === true"><Then><SetValue target="page.st" value={false} /></Then></If></Actions></OnMount></Events><Structure />');
 r=call('code-set',{sourceFile:home,code:rejected});assert(r.error && r.error.details.proposedPatch,'portable binding proposal '+JSON.stringify(r));
 assert(String(FU.readFileToString(new File(temp,home),'UTF-8'))===page,'refused frontend not written');
 var proposal=r.error.details.proposedPatch;
 proposal.edits.forEach(function(e){assert(rejected.split(e.oldText).length===2,'unique submitted edit');rejected=rejected.split(e.oldText).join(e.newText);});
 r=call('code-set',{sourceFile:home,code:rejected});assert(r.ok,'provider patch accepted '+JSON.stringify(r));
 print('source-observed-revision OK ('+checks+' checks)');
} finally {context=null;FU.deleteDirectory(temp);}
