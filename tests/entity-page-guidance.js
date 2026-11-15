// Entity page guidance appears at the page contract and palette, only for a project referencing lib_flow_entity.
var root = String(new java.io.File(arguments[0]).getCanonicalPath());
var File = java.io.File, FU = Packages.org.apache.commons.io.FileUtils;
var source = String(FU.readFileToString(new File(root, '_flow/lib/mcp.js'), 'UTF-8'));
var mcp = eval(source);
var dir = java.nio.file.Files.createTempDirectory('entity-page-guidance-').toFile();
var page = '_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte';
var hint = 'Entity pages: EntityTable → flow://guide/entities-widgets/table; EntityForm → flow://guide/entities-widgets/form; EntityView → flow://guide/entities-widgets/view; EntityStat/EntityBreakdown → flow://guide/entities-widgets/stat.';
function check(ok, label) { print((ok ? 'PASS ' : 'FAIL ') + label); if (!ok) throw Error(label); }
function response(name, args, value) {
  args.projectDir = String(dir.getAbsolutePath());
  return mcp.toolResponse({jsonrpc:'2.0', id:1, method:'tools/call', params:{name:name, arguments:args}}, value, {}).result.structuredContent;
}
try {
  var yaml = new File(dir, 'c8oProject.yaml');
  var pageValue = {ok:true, sourceFile:page, code:'<FlowComponent />', revision:'r1'};
  var paletteValue = {ok:true, items:[]};
  FU.writeStringToFile(yaml, '↓App [core.Project]:\n  ↓entities [references.ProjectSchemaReference]:\n    projectName: lib_flow_entity\n', 'UTF-8');
  check(response('code-get', {sourceFile:page}, Object.assign({}, pageValue)).entityPages === hint, 'entity page code-get names widgets and guide');
  check(response('authoring-palette', {surface:'frontend', builder:'svelte'}, Object.assign({}, paletteValue)).entityPages === hint, 'entity frontend palette names widgets and guide');
  var tablePalette = response('authoring-palette', {surface:'frontend', builder:'svelte'}, {ok:true,items:[{id:'svelte.entityTable',tag:'EntityTable',label:'Entity table',properties:{entity:{type:'string'}}}]});
  check(tablePalette.items[0].guide === 'flow://guide/entities-widgets/table', 'palette item points to the exact table drawer');
  check(response('code-get', {name:'Backend'}, {ok:true, code:'return {}'}).entityPages === undefined, 'backend code-get stays quiet');
  FU.writeStringToFile(yaml, '↓App [core.Project]:\n  version: 1.0\n', 'UTF-8');
  check(response('code-get', {sourceFile:page}, Object.assign({}, pageValue)).entityPages === undefined, 'ordinary page stays quiet');
  check(response('authoring-palette', {surface:'frontend', builder:'svelte'}, Object.assign({}, paletteValue)).entityPages === undefined, 'ordinary palette stays quiet');
  var start = String(FU.readFileToString(new File(root, '_flow/resources/guide/start.md'), 'UTF-8'));
  var routing = String(FU.readFileToString(new File(root, '_flow/resources/skills/convertigo-flow-mcp/SKILL.md'), 'UTF-8'));
  var frontend = String(FU.readFileToString(new File(root, '_flow/resources/skills/convertigo-flow-frontend-svelte/SKILL.md'), 'UTF-8'));
  check(/lib_flow_entity[^\n]*Read `flow:\/\/guide\/entities-widgets` before writing pages/.test(start), 'start routes entity pages imperatively');
  check(/flow:\/\/guide\/entities-widgets\/table/.test(routing) && /flow:\/\/guide\/entities-widgets\/form/.test(routing), 'start skill routes entity pages to exact drawers');
  check(/flow:\/\/guide\/entities-widgets\/table/.test(frontend) && /flow:\/\/guide\/entities-widgets\/form/.test(frontend), 'frontend skill routes entity pages to exact drawers');
} finally { FU.deleteDirectory(dir); }
print('entity-page-guidance OK');
