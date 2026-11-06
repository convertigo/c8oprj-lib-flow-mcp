// Resource reads have one document, an explicit legacy-field redirect, and an opt-in readable transport.
var project = new java.io.File(arguments[0]), io = Packages.org.apache.commons.io.FileUtils;
var mcp = eval(String(io.readFileToString(new java.io.File(project, '_flow/lib/mcp.js'), 'UTF-8')));
function assert(ok, message) { if (!ok) throw Error(message); }
function request(format) { return {id:1, method:'tools/call', params:{name:'flow-resource-get', arguments:{format:format}}}; }
[{text:'guide body'}, {content:'project body'}, {text:''}, {content:''}].forEach(function(value) {
 var original = value.text === undefined ? value.content : value.text;
 var req = request('structured'), response = mcp.toolResponse(req, value, {}), out = response.result.structuredContent;
 assert(out.text === original, 'Canonical text is unchanged, including empty files');
 assert(/Resource text is in text/.test(out.content), 'Legacy content explicitly redirects to the text already returned');
 assert(JSON.stringify(mcp.finalizeResponse({}, req, response)) === JSON.stringify(response), 'Finalizing twice is stable');
 var plain = mcp.finalizeResponse({}, request('text'), response).result;
 assert(plain.structuredContent === undefined, 'Readable mode has no competing structured payload');
 assert(plain.content[0].text.slice(-original.length || plain.content[0].text.length) === original, 'Readable mode keeps source text');
});
var projectValue = {ok:true, content:'first\nlast\n', hash:'abc', truncated:true, warnings:['Preview only']};
var plain = mcp.toolResponse(request('text'), projectValue, {}).result;
assert(plain.content[0].text === 'Resource metadata: {"ok":true,"hash":"abc","truncated":true,"warnings":["Preview only"]}\n\nfirst\nlast\n',
 'Project previews keep the hash, truncation and notices outside their source');
var guide = mcp.toolResponse(request('text'), {source:'resources/read', text:'# Guide\nFull body\n'}, {}).result;
assert(guide.content.length === 1 && guide.content[0].text === '# Guide\nFull body\n', 'Guide is literal Markdown, once');
var error = mcp.toolError(request('text'), {code:'UNKNOWN_RESOURCE', message:'Missing guide'}, {}).result;
assert(error.isError && error.structuredContent.error.code === 'UNKNOWN_RESOURCE', 'Text format does not mask errors');
var failed = mcp.toolResponse(request('text'), {ok:false, content:'failed'}, {}).result;
assert(failed.isError && failed.structuredContent.content === 'failed', 'Failed resources are not reformatted as successful text');
var unrelated = mcp.toolResponse({id:2,method:'tools/call',params:{name:'code-get',arguments:{format:'text'}}}, {text:'code'}, {}).result;
assert(unrelated.structuredContent.text === 'code', 'Other tools retain their contract');
var start = String(io.readFileToString(new java.io.File(project, '_flow/resources/guide/start.md'), 'UTF-8'));
var startResult = mcp.toolResponse(request('text'), {source:'resources/read', text:start}, {}).result;
assert(JSON.stringify(startResult).length + 200 < 16000,
 'Start must fit the Vibe 4000-token/16000-character envelope budget, including harness overhead');
assert(startResult.content[0].text === start, 'Start is complete and readable');
// An unknown guide URI resolves to the one library guide it names, else lists the nearest guide URIs.
var libGuides = [{uri:'flow://lib/lib_flow_sql/sql', project:'lib_flow_sql'}, {uri:'flow://lib/lib_flow_crud_data/csv', project:'lib_flow_crud_data'},
 {uri:'flow://lib/lib_flow_frontbuilder_svelte/frontend-actions', project:'lib_flow_frontbuilder_svelte'},
 {uri:'flow://lib/lib_flow_frontbuilder_svelte/frontend-design', project:'lib_flow_frontbuilder_svelte'}];
var core = ['start', 'authoring', 'crud', 'frontend-svelte'];
assert(typeof mcp.guideAlias === 'function', 'Unknown guide URIs have an alias resolver');
assert(mcp.guideAlias('flow://guide/sql', libGuides, core).uri === 'flow://lib/lib_flow_sql/sql', 'flow://guide/sql is the SQL library guide');
assert(mcp.guideAlias('flow://lib/lib_flow_sql/guide', libGuides, core).uri === 'flow://lib/lib_flow_sql/sql', 'The only guide of a library answers its unknown guide name');
assert(mcp.guideAlias('flow://guide/csv', libGuides, core).uri === 'flow://lib/lib_flow_crud_data/csv', 'Other library guides resolve the same way');
assert(mcp.guideAlias('flow://guide/crud_data', libGuides, core).uri === 'flow://lib/lib_flow_crud_data/csv', 'A library short name with one guide resolves');
var ambiguous = mcp.guideAlias('flow://guide/frontbuilder_svelte', libGuides, core);
assert(!ambiguous.uri && ambiguous.suggestions.indexOf('flow://lib/lib_flow_frontbuilder_svelte/frontend-design') !== -1, 'Ambiguous names list their guides');
var lost = mcp.guideAlias('flow://guide/missing-frontend', libGuides, core);
assert(!lost.uri && lost.suggestions.indexOf('flow://guide/frontend-svelte') !== -1 && lost.suggestions.length <= 5, 'Unknown names suggest the nearest URIs: ' + JSON.stringify(lost));
// A split guide family: the entry guide answers the generic names of its library and the short name of its family.
var splitSql = ['sql', 'sql-crud', 'sql-hsqldb', 'sql-named', 'sql-sample', 'sql-schema'].map(function(name) { return {uri:'flow://lib/lib_flow_sql/' + name, project:'lib_flow_sql'}; });
var splitGuides = splitSql.concat(libGuides.slice(1));
var splitCore = ['start', 'start-rules', 'authoring', 'authoring-data', 'crud', 'crud-modes', 'frontend-svelte', 'frontend-svelte-routing', 'frontend-svelte-layout',
 'frontend-svelte-proof', 'multipage-entities', 'multipage-entities-pages', 'multipage-roles'];
['guide', 'start', 'index', 'readme', 'README.md'].forEach(function(name) {
 var entry = mcp.guideAlias('flow://lib/lib_flow_sql/' + name, splitGuides, splitCore);
 assert(entry.uri === 'flow://lib/lib_flow_sql/sql', 'flow://lib/lib_flow_sql/' + name + ' is the entry guide of the split SQL guides: ' + JSON.stringify(entry));
});
assert(mcp.guideAlias('flow://guide/sql', splitGuides, splitCore).uri === 'flow://lib/lib_flow_sql/sql', 'flow://guide/sql stays the SQL entry guide once split');
var frontend = mcp.guideAlias('flow://guide/frontend', splitGuides, splitCore);
assert(frontend.uri === 'flow://guide/frontend-svelte', 'flow://guide/frontend is the entry of the frontend Svelte guide: ' + JSON.stringify(frontend));
var noEntry = mcp.guideAlias('flow://lib/lib_flow_frontbuilder_svelte/guide', splitGuides, splitCore);
assert(!noEntry.uri && noEntry.suggestions.indexOf('flow://lib/lib_flow_frontbuilder_svelte/frontend-design') !== -1, 'A library without an entry guide lists its guides: ' + JSON.stringify(noEntry));
var twoFamilies = mcp.guideAlias('flow://guide/multipage', splitGuides, splitCore);
assert(!twoFamilies.uri && twoFamilies.suggestions.indexOf('flow://guide/multipage-roles') !== -1, 'Two guide families under one name stay ambiguous: ' + JSON.stringify(twoFamilies));
var otherWord = mcp.guideAlias('flow://lib/lib_flow_sql/overview-x', splitGuides, splitCore);
assert(!otherWord.uri && otherWord.suggestions.indexOf('flow://lib/lib_flow_sql/sql') !== -1, 'Another unknown name of a split library lists its guides: ' + JSON.stringify(otherWord));
print('resource-text-alias OK (start '+start.length+' characters; envelope budget '+(JSON.stringify(startResult).length+200)+'/16000)');
