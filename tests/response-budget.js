// Measure the final MCP tool result seen by Vibe, including content and structuredContent.
var root = String(new java.io.File(arguments[0]).getCanonicalPath());
var engineDir = String(new java.io.File(arguments[1]).getCanonicalPath());
var FU = Packages.org.apache.commons.io.FileUtils;
var File = java.io.File;
var __flowProjectDir = root, __flowEngineDir = engineDir;
var engine = eval(String(FU.readFileToString(new File(engineDir, 'Engine.js'), 'UTF-8')));
var server = String(FU.readFileToString(new File(root, '_flow/flows/McpServer.flow.js'), 'UTF-8'));
var mcp = eval(String(FU.readFileToString(new File(root, '_flow/lib/mcp.js'), 'UTF-8')));
function check(ok, message) { if (!ok) throw Error(message); }
function call(name, args) {
  var request = {jsonrpc:'2.0',id:1,method:'tools/call',params:{name:name,arguments:args}};
  var run = JSON.parse(engine.run(JSON.stringify({flowSource:server,includeTrace:false,input:{request:JSON.stringify(request)}})));
  check(run.ok && run.result && run.result.result, name + ': ' + JSON.stringify(run).slice(0, 400));
  return run.result.result;
}
function length(value) { return JSON.stringify(value).length; }
var resources = [], oversized = [], byUri = {};
function record(uri, response) {
  var size = length(response);
  resources.push({uri:uri,chars:size});
  byUri[uri] = { chars:size, response:response };
  if (size > 15000) oversized.push({uri:uri,chars:size});
  return size;
}
var listed = [], cursor = null, pages = 0;
do {
  var listing = JSON.parse(engine.run(JSON.stringify({flowSource:server,includeTrace:false,input:{request:JSON.stringify({jsonrpc:'2.0',id:2,method:'resources/list',params:cursor ? {cursor:cursor} : {}})}}))).result;
  check(length(listing) < 16000, 'resources/list envelope exceeds 16000 characters: ' + length(listing));
  listed = listed.concat(listing.result.resources);
  cursor = listing.result.nextCursor;
  check(++pages < 30, 'resources/list cursor does not terminate');
} while (cursor);
check(listed.length >= 80, 'resources/list lost guides: ' + listed.length);
function read(uri) {
  var request = {jsonrpc:'2.0',id:3,method:'resources/read',params:{uri:uri}};
  var run = JSON.parse(engine.run(JSON.stringify({flowSource:server,includeTrace:false,input:{request:JSON.stringify(request)}})));
  check(run.ok && run.result && run.result.result && run.result.result.contents, 'resources/read ' + uri);
  return run.result.result.contents[0].text;
}
function readPages(uri) {
  var params={uri:uri}, joined='', count=0;
  do {
    var request={jsonrpc:'2.0',id:3,method:'resources/read',params:params};
    var run=JSON.parse(engine.run(JSON.stringify({flowSource:server,includeTrace:false,input:{request:JSON.stringify(request)}})));
    var page=run.result.result.contents[0];
    check(length(run.result.result)<16000,uri+' resource page exceeds budget');
    joined+=page.text;
    params=page.continuation && page.continuation.params;
    check(++count<30,uri+' resource pagination terminates');
  } while(params);
  return joined;
}
['convertigo-flow-mcp','convertigo-flow-backend','convertigo-flow-frontend-svelte'].forEach(function(name){
  var uri='flow://skills/'+name+'/SKILL';
  check(readPages(uri)===String(FU.readFileToString(new File(root,'_flow/resources/skills/'+name+'/SKILL.md'),'UTF-8')),
    uri+' must be recoverable from returned continuations');
});
var skillArgs={uri:'flow://skills/convertigo-flow-mcp/SKILL'}, toolSkill='', toolSkillPages=0;
do {
  var skillResult=call('flow-resource-get',skillArgs);
  check(length(skillResult)<16000,'flow-resource-get skill page exceeds budget');
  var skillPage=skillResult.structuredContent;
  toolSkill+=skillPage.text;
  skillArgs=skillPage.continuation && skillPage.continuation.arguments;
  check(++toolSkillPages<30,'flow-resource-get skill pagination terminates');
} while(skillArgs);
check(toolSkill===String(FU.readFileToString(new File(root,'_flow/resources/skills/convertigo-flow-mcp/SKILL.md'),'UTF-8')),
  'flow-resource-get skill continuation reconstructs the complete skill');
listed.filter(function(item) { return /^flow:\/\/guide\//.test(item.uri); }).forEach(function(item) {
  var response = call('flow-resource-get', {uri:item.uri});
  check(response.structuredContent && response.structuredContent.ok, item.uri + ': ' + JSON.stringify(response).slice(0, 300));
  record(item.uri, response);
});
var summaries = ['start','start-rules','entities','entities-model','entities-widgets','multipage-entities',
  'multipage-entities-pages','frontend-svelte','authoring','crud-business','crud','fullstack-paperboard','multipage-roles'];
summaries.forEach(function(name) {
  var uri = 'flow://guide/' + name, item = byUri[uri];
  check(item && item.chars < 6000, 'Summary exceeds 6000 served characters: ' + uri + ' ' + (item && item.chars));
});
Object.keys(byUri).filter(function(uri) { return /^flow:\/\/guide\/[^/]+\//.test(uri); }).forEach(function(uri) {
  check(byUri[uri].chars < 12000, 'Drawer exceeds 12000 served characters: ' + uri + ' ' + byUri[uri].chars);
});
var guidePath = new File(root, '_flow/resources/guide');
function checkCitedDrawers(file) {
  var content = String(FU.readFileToString(file, 'UTF-8'));
  var matches = content.match(/flow:\/\/guide\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g) || [];
  matches.forEach(function(uri) { uri = uri.replace(/[.,;]+$/, ''); check(byUri[uri], String(file.getName()) + ' cites missing drawer ' + uri); });
}
function walk(dir) {
  var files = dir.listFiles() || [];
  for (var i = 0; i < files.length; i++) {
    if (files[i].isDirectory()) walk(files[i]);
    else if (/\.md$|\.js$/.test(String(files[i].getName()))) checkCitedDrawers(files[i]);
  }
}
walk(guidePath);
walk(new File(root, '_flow/resources/skills'));
checkCitedDrawers(new File(root, '_flow/lib/mcp.js'));
var entitiesEntry = String(FU.readFileToString(new File(guidePath, 'entities.md'), 'UTF-8'));
var multipageEntry = String(FU.readFileToString(new File(guidePath, 'multipage-entities.md'), 'UTF-8'));
check(/JavaScript → FlowScript[^\n]*flow:\/\/guide\/start\/syntax/.test(entitiesEntry),
  'The FlowScript section reference must name start/syntax');
check(/Your own HTTP contract over entities[^\n]*flow:\/\/guide\/entities\/http/.test(multipageEntry),
  'The HTTP section reference must name entities/http');
var focusedTree = mcp.qualifyAuthoringResult({project:'App'}, {path:'frontends.svelte.routes.home.Structure',children:[{path:'frontends.svelte.routes.home.Structure.Children'}]});
check(focusedTree.parentPath==='App::frontends.svelte.routes.home.Structure' &&
  focusedTree.children[0].parentPath==='App::frontends.svelte.routes.home.Structure.Children',
  'authoring-tree exposes exact qualified parentPath values for the palette');
var richBlocks = [];
for (var n = 0; n < 65; n++) richBlocks.push({tag:'Widget' + n,properties:{id:'identity:literal!',value:'string:literal!',optional:'string:literal'},slots:['Toolbar']});
var richContract = {ok:true,code:'<FlowComponent />',revision:'r',authoringContract:{version:2,detail:'full',
  blocks:richBlocks,omittedBlocks:['RareWidget'],root:{tag:'FlowComponent',properties:{'$$id':'identity:literal!'},slots:['Structure']},
  pages:new Array(35).join('page/source/'),sources:new Array(35).join('source/path/')}};
var richReply = mcp.toolResponse({id:1,method:'tools/call',params:{name:'code-get',arguments:{contractDetail:'full'}}},richContract,{}).result;
check(length(richReply) < 16000, 'Rich full contract exceeds 16000 characters: ' + length(richReply));
var richPart = richReply.structuredContent.authoringContract, richTags = [], richExamples = [], richPages = richPart.pages, richPageCount = 0;
while (true) {
  richTags = richTags.concat(richPart.availableBlocks || []);
  richExamples = richExamples.concat(richPart.blocks || []);
  if (richPart.contractNextOffset === undefined) break;
  var richNext = mcp.toolResponse({id:1,method:'tools/call',params:{name:'code-get',arguments:{contractDetail:'full',contractOffset:richPart.contractNextOffset,revision:'r'}}},richContract,{}).result;
  check(length(richNext) < 16000, 'Rich contract continuation exceeds 16000 characters: ' + length(richNext));
  richPart = richNext.structuredContent.authoringContract;
  check(++richPageCount < 100, 'Rich contract pagination terminates');
}
check(richTags.length === 66 &&
  richPages === richContract.authoringContract.pages &&
  richExamples.some(function(block){return block.tag==='Widget0' && block.properties.value && block.slots[0]==='Toolbar';}),
  'Compact contract must keep pages, every tag and essential property and slot examples');
// A metadata-only response must page every route and block tag in the final MCP envelope.
var manyPages = [], manyBlocks = [];
for (var p = 0; p < 120; p++) manyPages.push({id:'page'+p,path:'/page'+p,parameters:[],sourceFile:'src/routes/page'+p+'/+page.flow.svelte'});
for (var b = 0; b < 80; b++) manyBlocks.push({tag:'Widget'+b,properties:{id:'identity:literal!',optional:'string:literal'},slots:['Children']});
var metadata = {ok:true,code:'<FlowComponent />',revision:'meta-r',authoringContract:{version:2,detail:'full',pages:manyPages,blocks:manyBlocks}};
var seenPages = {}, seenTags = {}, metaOffset = 0, metaCount = 0;
do {
  var metaRequest = {id:1,method:'tools/call',params:{name:'code-get',arguments:{project:'App',sourceFile:'src/routes/+page.flow.svelte',contractOffset:metaOffset,revision:'meta-r'}}};
  var metaReply = mcp.toolResponse(metaRequest,metadata,{}).result;
  check(length(metaReply)<16000,'metadata page exceeds final envelope budget: '+length(metaReply));
  var metaPart = metaReply.structuredContent.authoringContract;
  (metaPart.pages||[]).forEach(function(page){seenPages[page.id]=true;});
  (metaPart.availableBlocks||[]).forEach(function(tag){seenTags[tag]=true;});
  if (metaPart.contractNextOffset === undefined) break;
  check(metaPart.continuation.arguments.project==='App' && metaPart.continuation.arguments.sourceFile==='src/routes/+page.flow.svelte' && metaPart.continuation.arguments.revision==='meta-r',
    'metadata continuation preserves selector and revision');
  metaOffset=metaPart.contractNextOffset;
  check(++metaCount<100,'metadata pagination terminates');
} while (true);
check(Object.keys(seenPages).length===120 && Object.keys(seenTags).length===80,'metadata pages and available blocks are recoverable');
// Explicitly requested contracts retain optional properties, events and snippet parameters across pages.
var requestedBlocks=[];
for(var t=0;t<5;t++) {
  var properties={}; for(var j=0;j<60;j++) properties['optional'+j]='string:literal';
  requestedBlocks.push({tag:'Entity'+t,properties:properties,events:['OnLoaded','OnSelectionChange'],slots:['Toolbar'],snippets:{Toolbar:['row','selected','item']}});
}
var targetedValue={ok:true,code:new Array(19000).join('x'),revision:'target-r',authoringContract:{version:2,detail:'blocks',blocks:requestedBlocks}};
var targetOffset=0, contractPages=0, recovered={};
do {
  var targetRequest={id:1,method:'tools/call',params:{name:'code-get',arguments:{project:'App',sourceFile:'src/routes/+page.flow.svelte',contractBlocks:['Entity0','Entity1','Entity2','Entity3','Entity4'],contractOffset:targetOffset,revision:'target-r'}}};
  var targetReply=mcp.toolResponse(targetRequest,targetedValue,{}).result;
  check(length(targetReply)<16000,'targeted contract exceeds final envelope budget: '+length(targetReply));
  var targetPart=targetReply.structuredContent;
  if (targetOffset===0) check(/Events.*snippets/.test(targetPart.authoringContract.syntax),'targeted contract explains events and snippets');
  check(targetPart.code===undefined && targetPart.sourceOmitted===true,'targeted contracts omit source body');
  targetPart.authoringContract.blocks.forEach(function(block){
    var found=recovered[block.tag]||(recovered[block.tag]={properties:{},events:[],slots:[],snippets:{}});
    Object.keys(block.properties||{}).forEach(function(key){found.properties[key]=block.properties[key];});
    found.events=found.events.concat(block.events||[]); found.slots=found.slots.concat(block.slots||[]);
    Object.keys(block.snippets||{}).forEach(function(key){found.snippets[key]=block.snippets[key];});
  });
  if (targetPart.authoringContract.contractNextOffset===undefined) break;
  targetOffset=targetPart.authoringContract.contractNextOffset;
  check(++contractPages<100,'targeted contract pagination terminates');
} while(true);
check(contractPages>0,'large targeted contract is paginated');
requestedBlocks.forEach(function(block){var got=recovered[block.tag];check(got && Object.keys(got.properties).length===60 && got.events.length===2 && got.snippets.Toolbar.length===3,
  'targeted contract complete for '+block.tag);});
// It126: EntityStat was cut before sum, and Form appeared with slots=[] although
// its component has Children and OnSubmit. Each block announces structure on
// its first page, while a cut block says it is incomplete.
var statProperties={}; for(var sp=0;sp<400;sp++) statProperties['field'+sp]='string:literal';
statProperties.sum='decimal:expression';
var edgeBlocks=[{tag:'EntityStat',properties:statProperties,slots:[],events:['OnLoaded']},
  {tag:'Form',properties:{ariaLabel:'string:binding'},slots:['Children','Events'],events:['OnSubmit']}];
var edgeValue={ok:true,revision:'it126-r',authoringContract:{version:2,blocks:edgeBlocks}};
var edgeOffset=0, edgePages=0, firstSeen={}, edgeRecovered={};
do {
  var edgeRequest={id:1,method:'tools/call',params:{name:'code-get',arguments:{project:'App',contractBlocks:['EntityStat','Form'],contractOffset:edgeOffset,revision:'it126-r'}}};
  var edgeReply=mcp.toolResponse(edgeRequest,edgeValue,{}).result;
  check(length(edgeReply)<16000,'it126 contract page exceeds budget');
  var edgePart=edgeReply.structuredContent.authoringContract;
  edgePart.blocks.forEach(function(block){
    if(!firstSeen[block.tag]) {
      firstSeen[block.tag]=block;
      if(block.tag==='Form') check(block.slots.indexOf('Children')>=0 && block.events.indexOf('OnSubmit')>=0,
        'Form first page announces Children and OnSubmit');
      if(block.tag==='EntityStat') check(block.incomplete===true && !block.properties.sum,
        'EntityStat first page announces that sum may follow: '+JSON.stringify({incomplete:block.incomplete,count:Object.keys(block.properties).length,sum:block.properties.sum,offset:edgeOffset}));
    }
    var properties=edgeRecovered[block.tag]||(edgeRecovered[block.tag]={});
    Object.keys(block.properties||{}).forEach(function(key){properties[key]=block.properties[key];});
  });
  if(edgePart.contractNextOffset===undefined) break;
  check(edgePart.continuation.arguments.contractBlocks.join(',')==='EntityStat,Form' &&
    edgePart.continuation.arguments.contractOffset===edgePart.contractNextOffset,
    'it126 cursor retains the selected contractBlocks');
  edgeOffset=edgePart.contractNextOffset;
  check(++edgePages<100,'it126 contract pagination terminates');
} while(true);
check(firstSeen.Form && edgeRecovered.EntityStat.sum==='decimal:expression' && edgePages>0,
  'it126 Form structure and EntityStat sum are recoverable');
var choices=[]; for(var c=0;c<2000;c++) choices.push('choice'+('0000'+c).slice(-4));
var oversizedContract={ok:true,code:'source',revision:'enum-r',authoringContract:{version:2,
  blocks:[{tag:'Huge',properties:{choice:'enum:'+choices.join('|')},events:['OnChange'],snippets:{Slot:['item']}}],
  portableBlocks:[{id:'huge.portable',tag:'HugePortable',contract:{choices:choices}}]}};
var pieces={}, largeOffset=0, largePages=0, largeProperties={}, largePortables=[];
do {
  var largeRequest={id:1,method:'tools/call',params:{name:'code-get',arguments:{contractBlocks:['Huge'],contractOffset:largeOffset,revision:'enum-r'}}};
  var largeReply=mcp.toolResponse(largeRequest,oversizedContract,{}).result;
  check(length(largeReply)<16000,'oversized contract page exceeds budget: '+length(largeReply));
  var largePage=largeReply.structuredContent.authoringContract;
  check(largePage.reconstruction && largePage.contractTotal>0,'fragment reconstruction must be documented');
  largePage.fragments.forEach(function(fragment){var group=pieces[fragment.unitIndex]||(pieces[fragment.unitIndex]=[]);group[fragment.part]=fragment.data;});
  largePage.blocks.forEach(function(block){Object.keys(block.properties||{}).forEach(function(key){largeProperties[key]=block.properties[key];});});
  largePortables=largePortables.concat(largePage.portableBlocks);
  if(largePage.contractNextOffset===undefined) break;
  largeOffset=largePage.continuation.arguments.contractOffset;
  check(++largePages<100,'oversized contract pagination terminates');
} while(true);
Object.keys(pieces).forEach(function(key){var unit=JSON.parse(pieces[key].join(''));if(unit.kind==='property') largeProperties[unit.key]=unit.value;
  if(unit.kind==='portable') largePortables.push(unit.value);});
check(largeProperties.choice===oversizedContract.authoringContract.blocks[0].properties.choice &&
  largePortables.some(function(item){return item.id==='huge.portable' && item.contract.choices.length===2000;}),
  'oversized enum and portable contract are reconstructed exactly');
['flow://guide/entities-model/format','flow://guide/authoring/expressions','flow://guide/start-rules/design',
 'flow://guide/entities-model/schema','flow://guide/entities-widgets/table'].forEach(function(uri){
  var doc=read(uri), targets=doc.match(/flow:\/\/guide\/[A-Za-z0-9_.\/-]+/g)||[];
  check(targets.length>0,uri+' must name an explicit guide destination');
  targets.forEach(function(target){check(read(target).length>0,uri+' destination '+target+' is served alone');});
});
check(read('flow://guide/entities-model/format').indexOf('**Unique fields** below')<0,'format guide has no local-only unique link');
check(read('flow://guide/entities-widgets/table').indexOf('flow://guide/multipage-entities/operations')>=0,'table export points to operations');
// The dispatcher can rewrite tool names internally; continuations keep the caller's original selector.
[{original:{name:'code-get',arguments:{project:'App',qname:'App.LongFlow',revision:'flow-r'}},internal:'flow-code-get',selector:'qname',expected:'App.LongFlow'},
 {original:{name:'code-get',arguments:{project:'App',block:'app.longBlock',revision:'flow-r'}},internal:'flow-block-code-get',selector:'block',expected:'app.longBlock'},
 {original:{name:'code-get',arguments:{project:'App',sourceFile:'src/routes/+page.flow.svelte',revision:'flow-r'}},internal:'frontend-svelte-code-get',selector:'sourceFile',expected:'src/routes/+page.flow.svelte'}]
 .forEach(function(item){
   var request={id:1,method:'tools/call',params:{name:item.internal,arguments:item.original.arguments},__codeOriginal:item.original};
   var reply=mcp.toolResponse(request,{ok:true,revision:'flow-r',code:new Array(19000).join('x')},{}).result;
   check(length(reply)<16000,'backend/source continuation stays under budget');
   var next=reply.structuredContent.continuation;
   check(next && next.tool==='code-get' && next.arguments[item.selector]===item.expected && next.arguments.revision==='flow-r' && next.arguments.startChar>0,
     'continuation preserves original '+item.selector+' selector and revision');
 });
var list = call('flow-resource-search', {project:'lib_flow_mcp',projectDir:root,query:'EntityTable business screens',limit:10});
var found = list.structuredContent && list.structuredContent.matches || list.structuredContent && list.structuredContent.resources || [];
check(found.some(function(item) { return item.uri === 'flow://guide/entities-widgets/table'; }),
  'flow-resource-search must find the table drawer: ' + JSON.stringify(list).slice(0,600));
var widgetSummary = byUri['flow://guide/entities-widgets'].response.structuredContent.text;
check(read('flow://guide/entities-widgets/table').indexOf('EntityTable') >= 0,
  'resources/read must serve nested guide paths');
check(widgetSummary.indexOf('EntityTable') >= 0 && widgetSummary.indexOf('EntityForm') >= 0 &&
  widgetSummary.indexOf('EntityView') >= 0 && widgetSummary.indexOf('EntityStat') >= 0 &&
  widgetSummary.indexOf('EntityBreakdown') >= 0 && widgetSummary.indexOf('EntityTable') < 6000,
  'Entity widget selection must survive in the first 6000 characters');
['flow://guide/start','flow://guide/start-rules','flow://guide/frontend-svelte'].forEach(function(uri) {
  var text = byUri[uri].response.structuredContent.text;
  check(text.indexOf('browser_wait_for.time') >= 0 && text.indexOf('seconds') >= 0 &&
    text.indexOf('30') >= 0 && text.indexOf('2000') >= 0 && text.indexOf('browser_wait_for.time') < 6000,
    uri + ' must carry the wait unit in its first 6000 characters');
});
// In a standalone runner the other libraries are not loaded in Studio. Build their
// exact shared finalization envelope with the content that resources/read serves.
var sibling = new File(root).getParentFile();
['lib_flow_engine','lib_flow_entity','lib_flow_sql','lib_flow_crud_data','lib_flow_frontbuilder_svelte'].forEach(function(name) {
  var dir = new File(sibling, name + '/_flow/resources/guide');
  var files = dir.isDirectory() ? dir.listFiles() : [];
  for (var i = 0; i < files.length; i++) {
    if (!/\.md$/.test(String(files[i].getName()))) continue;
    var uri = 'flow://lib/' + name + '/' + String(files[i].getName()).replace(/\.md$/, '');
    var text = String(FU.readFileToString(files[i], 'UTF-8'));
    var request = {jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'flow-resource-get',arguments:{uri:uri}}};
    record(uri, mcp.toolResponse(request, {ok:true,uri:uri,mimeType:'text/markdown',text:text,source:'resources/read'}, {}).result);
  }
});
var project = java.nio.file.Files.createTempDirectory('response-budget-').toFile();
try {
  var page = '_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte';
  var source = '<script module>export const _flow = { sourceVersion: 2, page: { id: "home" } };</script>\n<FlowComponent $$id="home"><Structure><EntityTable $$id="rows" entity="Book" /></Structure></FlowComponent>\n';
  FU.writeStringToFile(new File(project, 'c8oProject.yaml'), '↓App [core.Project]:\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n', 'UTF-8');
  FU.writeStringToFile(new File(project, '_flow/engine.yaml'), JSON.stringify({version:1,config:{frontbuilder:{svelte:{target:'svelte5',resourceRoot:String(new File(sibling,'lib_flow_frontbuilder_svelte/_flow/frontbuilder/svelte').getCanonicalPath()),modelPath:page}}}}), 'UTF-8');
  FU.writeStringToFile(new File(project, page), source, 'UTF-8');
  var nestedPath = call('flow-resource-get', {project:'App',projectDir:String(project.getCanonicalPath()),path:'_flow/resources/guide/entities-widgets/table.md'});
  check(nestedPath.structuredContent && nestedPath.structuredContent.uri === 'flow://guide/entities-widgets/table',
    'A nested guide path must fall back to its drawer URI: ' + JSON.stringify(nestedPath).slice(0,400));
  var response = call('code-get', {project:'App',projectDir:String(project.getCanonicalPath()),sourceFile:page,kind:'source'});
  var content = response.structuredContent || {};
  var json = JSON.stringify(response);
  print('CODE_GET ' + JSON.stringify({chars:json.length,entityPagesAt:json.indexOf('entityPages'),fields:Object.keys(content).map(function(key) {return [key,length(content[key])];})}));
  var structured = JSON.stringify(content), hintAt = structured.indexOf('entityPages'), contractAt = structured.indexOf('authoringContract');
  check(hintAt >= 0 && hintAt < 4000 && hintAt < contractAt,
    'entityPages must precede authoringContract in the first 4000 characters: ' + hintAt + '/' + contractAt);
  check(json.length < 16000, 'A small entity page code-get should fit the Vibe limit: ' + json.length);
  var tableUri = /flow:\/\/guide\/entities-widgets\/table/.exec(content.entityPages || '');
  check(tableUri && byUri[tableUri[0]], 'code-get entityPages must point to the existing table drawer');
  var drawer = call('flow-resource-get', {uri:tableUri[0],format:'text'});
  check(drawer.content && drawer.content[0].text.indexOf('EntityTable') >= 0 &&
    drawer.content[0].text.indexOf('Toolbar') >= 0,
    'The code-get hint must lead to EntityTable choice and its configuration');
  var picked = call('code-get', {project:'App',projectDir:String(project.getCanonicalPath()),sourceFile:page,contractBlocks:['Text']}).structuredContent;
  check(picked.authoringContract && picked.authoringContract.blocks.some(function(block) {return block.tag === 'Text' && block.properties.text;}),
    'A targeted code-get must retain the full block contract');
  check(picked.authoringContract.portableBlocks.some(function(block) {return block.id === 'date.now' && block.tag;}),
    'A targeted code-get must retain the portable block index');
  var absoluteSource = 'alpha\nbeta\n' + new Array(19000).join('z') + '\nomega';
  FU.writeStringToFile(new File(project, page), absoluteSource, 'UTF-8');
  var lineChunk = call('code-get',{project:'App',projectDir:String(project.getCanonicalPath()),sourceFile:page,startLine:3,endLine:3});
  check(length(lineChunk)<16000 && lineChunk.structuredContent.startChar===11 && lineChunk.structuredContent.totalContentLength===absoluteSource.length,
    'line-range character offsets refer to the full source');
  var lineNext=lineChunk.structuredContent.continuation;
  check(lineNext && lineNext.arguments.startChar===lineChunk.structuredContent.endChar && lineNext.arguments.startLine===undefined &&
    lineChunk.structuredContent.endLine===undefined,'a cut line has a character continuation and no stale endLine');
  var afterLine = call(lineNext.tool,Object.assign({},lineNext.arguments,{projectDir:String(project.getCanonicalPath())}));
  check(afterLine.structuredContent.startChar===lineChunk.structuredContent.endChar && afterLine.structuredContent.code===absoluteSource.slice(lineChunk.structuredContent.endChar,afterLine.structuredContent.endChar),
    'character continuation resumes exactly after a line-range chunk');
  var rebuilt=lineChunk.structuredContent.code, nextLine= lineNext, followed=0;
  while(nextLine) {
    var followedPage=call(nextLine.tool,Object.assign({},nextLine.arguments,{projectDir:String(project.getCanonicalPath())}));
    rebuilt+=followedPage.structuredContent.code;
    nextLine=followedPage.structuredContent.continuation;
    check(++followed<30,'returned line continuation terminates');
  }
  check(rebuilt===absoluteSource.slice(11),'returned continuations recover the entire long line and subsequent source');
  FU.writeStringToFile(new File(project,page),'short', 'UTF-8');
  var staleChar = call('code-get',{project:'App',projectDir:String(project.getCanonicalPath()),sourceFile:page,startChar:1,revision:lineChunk.structuredContent.revision});
  check(staleChar.isError===true && /STALE_REVISION/.test(staleChar.structuredContent.error.code),
    'stale character range is rejected after the source becomes short');
  FU.writeStringToFile(new File(project,page),source,'UTF-8');
  var legacyResponse = call('frontend-svelte-code-get', {projectDir:String(project.getCanonicalPath()),sourceFile:page});
  var legacy = legacyResponse.structuredContent;
  check(legacy.authoringContract && legacy.authoringContract.blocks && legacy.authoringContract.blocks.length,
    'The direct frontend source tool retains its established starter contract');
  print('LEGACY_CODE_GET ' + length(legacyResponse));
  check(length(legacyResponse) < 16000, 'legacy frontend-svelte-code-get exceeds 16000 characters');
  var fullResponse = call('code-get', {project:'App',projectDir:String(project.getCanonicalPath()),sourceFile:page,contractDetail:'full'});
  check(length(fullResponse) < 16000, 'contractDetail full exceeds 16000 characters: ' + length(fullResponse));
  check((fullResponse.structuredContent.authoringContract.availableBlocks || []).indexOf('Text') >= 0,
    'bounded full contract must keep available block tags');
  FU.writeStringToFile(new File(project, page), source + new Array(320).join('<Text $$id="row" text="A line of long page source" />\n'), 'UTF-8');
  var longResponse = call('code-get', {project:'App',projectDir:String(project.getCanonicalPath()),sourceFile:page,kind:'source'});
  check(length(longResponse) < 16000 && longResponse.structuredContent.partial === true &&
    /startChar/.test(longResponse.structuredContent.next || ''), 'long code-get must page below 16000: ' + length(longResponse));
  var longLegacy = call('frontend-svelte-code-get', {projectDir:String(project.getCanonicalPath()),sourceFile:page});
  check(length(longLegacy) < 16000 && longLegacy.structuredContent.partial === true,
    'long legacy frontend-svelte-code-get must page below 16000: ' + length(longLegacy));
  var oneLine = '<script module>export const _flow = {sourceVersion:2};</script><FlowComponent $$id="home"><Structure><Text $$id="long" text="' +
    new Array(19000).join('x') + '" /></Structure></FlowComponent>';
  FU.writeStringToFile(new File(project, page), oneLine, 'UTF-8');
  var legacyFirst = call('frontend-svelte-code-get', {projectDir:String(project.getCanonicalPath()),sourceFile:page,startChar:0});
  check(length(legacyFirst) < 16000 && legacyFirst.structuredContent.partial === true &&
    legacyFirst.structuredContent.endChar > 0, 'single-line legacy read must return a bounded character range');
  var legacyNext = call('frontend-svelte-code-get', {projectDir:String(project.getCanonicalPath()),sourceFile:page,
    startChar:legacyFirst.structuredContent.endChar,revision:legacyFirst.structuredContent.revision});
  check(length(legacyNext) < 16000 && legacyNext.structuredContent.startChar === legacyFirst.structuredContent.endChar,
    'single-line legacy read must continue at the returned character offset');
  var offset = 0, joined = '', chunks = 0, revision = null;
  do {
    var chunk = call('code-get', {project:'App',projectDir:String(project.getCanonicalPath()),sourceFile:page,
      startChar:offset,revision:revision || undefined});
    check(length(chunk) < 16000, 'single-line code-get chunk exceeds 16000: ' + length(chunk));
    var part = chunk.structuredContent;
    check(part.partial && part.startChar === offset && part.endChar > offset,
      'single-line source must return a character range: ' + JSON.stringify(part).slice(0,300));
    joined += part.code;
    offset = part.endChar;
    revision = part.revision;
    check(++chunks < 30, 'single-line pagination must terminate');
  } while (offset < oneLine.length);
  check(joined === oneLine, 'single-line pagination must recover every character');
} finally { FU.deleteDirectory(project); }
var sampleDir = String(java.lang.System.getenv('FLOW_ENTITY_SAMPLE_DIR') || '');
if (sampleDir) {
  var samplePage = '_flow/frontbuilder/svelte/model/EntityMcpEquipment4Exercise/src/routes/admin/+page.flow.svelte';
  var sample = call('code-get', {project:'EntityMcpEquipment4Exercise',projectDir:sampleDir,sourceFile:samplePage,kind:'source'});
  var sampleJson = JSON.stringify(sample), sampleContent = sample.structuredContent || {};
  print('REAL_CODE_GET ' + JSON.stringify({chars:sampleJson.length,entityPagesAt:JSON.stringify(sampleContent).indexOf('entityPages'),detail:sampleContent.authoringContract && sampleContent.authoringContract.detail,fields:Object.keys(sampleContent).map(function(key) {return [key,length(sampleContent[key])];})}));
  check(sampleContent.entityPages && JSON.stringify(sampleContent).indexOf('entityPages') < 4000,
    'A real entity page must expose its hint first');
  check(sampleJson.length < 16000 && sampleContent.code === String(FU.readFileToString(new File(sampleDir, samplePage), 'UTF-8')),
    'A real entity page must keep its complete source under the Vibe limit when possible: ' + sampleJson.length);
  var full = call('code-get', {project:'EntityMcpEquipment4Exercise',projectDir:sampleDir,sourceFile:samplePage,kind:'source',contractDetail:'full'});
  print('FULL_CODE_GET ' + length(full));
  check(length(full) < 16000, 'real full contract exceeds 16000: ' + length(full));
}
resources.sort(function(a,b) { return b.chars-a.chars; });
print('RESOURCE_COUNT ' + resources.length);
print('OVER_15000 ' + JSON.stringify(oversized.sort(function(a,b) {return b.chars-a.chars;})));
print('SUMMARY_SIZES ' + JSON.stringify(resources.filter(function(item) { return summaries.indexOf(item.uri.replace('flow://guide/','')) >= 0; })));
print('DRAWER_SIZES ' + JSON.stringify(resources.filter(function(item) { return /^flow:\/\/guide\/[^/]+\//.test(item.uri); })));
print('OTHER_GUIDE_SIZES ' + JSON.stringify(resources.filter(function(item) { return /^flow:\/\/guide\/[^/]+$/.test(item.uri) && summaries.indexOf(item.uri.replace('flow://guide/','')) < 0; })));
print('LIBRARY_SIZES ' + JSON.stringify(resources.filter(function(item) { return /^flow:\/\/lib\//.test(item.uri); })));
check(oversized.length === 0, 'Served guides exceed 15000 characters: ' + JSON.stringify(oversized));
