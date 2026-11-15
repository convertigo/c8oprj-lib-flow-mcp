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
var richBlocks = [];
for (var n = 0; n < 65; n++) richBlocks.push({tag:'Widget' + n,properties:{id:'identity:literal!',value:'string:literal!',optional:'string:literal'},slots:['Toolbar']});
var richContract = {ok:true,code:'<FlowComponent />',revision:'r',authoringContract:{version:2,detail:'full',
  blocks:richBlocks,omittedBlocks:['RareWidget'],root:{tag:'FlowComponent',properties:{'$$id':'identity:literal!'},slots:['Structure']},
  pages:new Array(35).join('page/source/'),sources:new Array(35).join('source/path/')}};
var richReply = mcp.toolResponse({id:1,method:'tools/call',params:{name:'code-get',arguments:{contractDetail:'full'}}},richContract,{}).result;
check(length(richReply) < 16000, 'Rich full contract exceeds 16000 characters: ' + length(richReply));
check(richReply.structuredContent.authoringContract.availableBlocks.length === 66 &&
  richReply.structuredContent.authoringContract.pages === richContract.authoringContract.pages &&
  richReply.structuredContent.authoringContract.blocks.some(function(block){return block.tag==='Widget0' && block.properties.value && block.slots[0]==='Toolbar';}),
  'Compact contract must keep pages, every tag and essential property and slot examples');
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
    /startLine/.test(longResponse.structuredContent.next || ''), 'long code-get must page below 16000: ' + length(longResponse));
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
