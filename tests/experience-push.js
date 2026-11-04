// Offline contract through the real Flow MCP router, with neutral, isolated library fixtures.
var engineDir = arguments[0], projectDir = String(new java.io.File(arguments[1]).getCanonicalPath());
var File = java.io.File, Files = java.nio.file.Files, UTF8 = java.nio.charset.StandardCharsets.UTF_8;
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var __flowEngineDir = String(new File(engineDir).getCanonicalPath());
var __flowProjectDir = projectDir;
var engine = eval(String(FileUtils.readFileToString(new File(engineDir, 'Engine.js'), 'UTF-8')));
var source = String(FileUtils.readFileToString(new File(projectDir, '_flow/flows/McpServer.flow.js'), 'UTF-8'));
var ace = eval(String(FileUtils.readFileToString(new File(projectDir, '_flow/lib/experience.js'), 'UTF-8')));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
// Shared JVM store: also prove state survives the separate scopes of two Flow runtimes.
var attributes = new java.util.concurrent.ConcurrentHashMap();
var ConvertigoEngine = Packages.com.twinsoft.convertigo.engine.Engine;
ConvertigoEngine.initServletContext(new Packages.jakarta.servlet.ServletContext({
  getAttribute: function(name) { return attributes.get(name); },
  setAttribute: function(name, value) { attributes.put(name, value); },
  removeAttribute: function(name) { attributes.remove(name); }
}));
var privateDir = new File(projectDir, '_private'); privateDir.mkdirs();
var root = Files.createTempDirectory(privateDir.toPath(), 'ace-layer2-').toFile();
function write(relative, text) {
  var file = new File(root, relative); file.getParentFile().mkdirs();
  Files.writeString(file.toPath(), text, UTF8); return file;
}
var commonText = '## STRATEGIES & INSIGHTS\n[common-00001] helpful=2 harmful=0 :: Check the orders input contract.\n';
var sqlText = '## STRATEGIES & INSIGHTS\n' +
  '[sql-00001] helpful=10 harmful=1 :: Check the orders table before writing.\n    @blocks: sql.*, data.write\n' +
  '[sql-00002] helpful=4 harmful=0 :: Check the customers key.\n    @codes: MISSING_FLOW_QNAME\n' +
  '[sql-00003] helpful=1 harmful=5 :: Low score orders advice.\n';
write('lib_flow_engine/_flow/resources/ace/common.md', commonText);
var sqlFile = write('lib_orders/_flow/resources/ace/sql.md', sqlText);
write('lib_orders/_flow/resources/ace/front.md', '## STRATEGIES & INSIGHTS\n[front-00001] helpful=1 harmful=0 :: Keep the orders form small.\n');
write('lib_orders/_flow/resources/ace/jobs.md', '## STRATEGIES & INSIGHTS\n[jobs-00001] helpful=1 harmful=0 :: Make the orders job repeatable.\n');
write('lib_unrelated/_flow/resources/ace/sql.md', '## STRATEGIES & INSIGHTS\n[sql-99999] helpful=999 harmful=0 :: Unrelated orders advice.\n');
write('Orders/c8oProject.yaml', '↓Orders [core.Project]:\n  ↓orders_reference [references.ProjectSchemaReference]:\n    projectName: lib_orders\n  ↓engine_reference [references.ProjectSchemaReference]:\n    projectName: lib_flow_engine\n');
write('Orders/_flow/flows/Orders.flow.js', 'function Orders({result}) {\n result.rows = sql.table({name:"orders"})\n}\n');
write('Empty/c8oProject.yaml', '↓Empty [core.Project]:\n');
var app = String(new File(root, 'Orders').getCanonicalPath());
var empty = String(new File(root, 'Empty').getCanonicalPath());
var sessionId = String(root.getName()), seq = 0;
function call(method, params, mode, session) {
  var response = JSON.parse(engine.run(JSON.stringify({ flowSource: source, includeTrace: false,
    config: { mcp: { experience: mode || 'on', experienceSession: session || sessionId } },
    input: { request: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: method, params: params || {} }) } })));
  assert(response.ok === true, 'Router failed: ' + JSON.stringify(response));
  return response.result;
}
function tool(name, args, mode, session) { return call('tools/call', {name:name, arguments:args || {projectDir:app}}, mode, session); }
function exp(response) { return response.result && response.result.structuredContent && response.result.structuredContent.experience; }
function ids(response) { return exp(response).entries.map(function(e) { return e.id; }); }
function gesture(session, mode, code) { return tool('code-set', { projectDir: app, name: 'Orders', code: code || 'function Orders({result}) {\n result.rows = sql.table({name:"orders"})\n}\n' }, mode, session); }

assert(!exp(tool('flow-list')), 'Discovery must not push common or domain advice');
var first = gesture();
assert(exp(first) && exp(first).reason === 'first-domain', 'First SQL gesture must push: ' + JSON.stringify(first));
assert(ids(first)[0] === 'sql-00001', 'Rank by helpful - harmful');
assert(ids(first).indexOf('common-00001') >= 0, 'Core common joins the first domain gesture');
assert(ids(first).indexOf('sql-99999') < 0, 'Unreferenced library leaked');
assert(first.result.content[first.result.content.length - 1].text.indexOf('[Flow ACE') === 0, 'Text advice must be recognizable and last');
assert(JSON.stringify(exp(first)).indexOf('@blocks') < 0, 'Triggers are not advice');
assert(!exp(gesture()), 'A drawer is pushed only once');
var firstReads = Number(attributes.get('lib_flow_mcp.experience.control.v1').get('reads'));
assert(!exp(gesture()), 'Warm gesture repeated the drawer');
assert(Number(attributes.get('lib_flow_mcp.experience.control.v1').get('reads')) === firstReads, 'Unchanged drawers were read again');
var previousEngine = engine;
engine = eval(String(FileUtils.readFileToString(new File(engineDir, 'Engine.js'), 'UTF-8')));
assert(!exp(gesture()), 'Session state must survive different runtime scopes');
engine = previousEngine;
assert(!exp(tool('code-check', {projectDir:app, name:'Orders'})), 'check must not repeat the drawer');
var front = tool('code-check', {projectDir:app, kind:'source', sourceFile:'_flow/front/main.flow.svelte'});
assert(exp(front) && exp(front).drawer === 'front', 'Flow Svelte selects front');
assert(!exp(tool('code-get', {projectDir:app, kind:'source', sourceFile:'_flow/front/main.flow.svelte'})), 'Reading is not a first source gesture');
var errorsSession = sessionId + '-errors';
var error = tool('code-get', {projectDir:app}, 'errors-only', errorsSession);
assert(exp(error) && exp(error).reason === 'error' && ids(error).join(',') === 'sql-00002', 'Declared error code must push in errors-only: ' + JSON.stringify(error));
assert(error.result.isError === true, 'Advice must preserve tool failure');
for (var i = 0; i < 10; i++) assert(!exp(tool('code-get', {projectDir:app}, 'errors-only', errorsSession)), 'Error repeated within 10 calls');
assert(exp(tool('code-get', {projectDir:app}, 'errors-only', errorsSession)), 'Error must return after more than 10 calls');
assert(!exp(gesture(sessionId + '-off', 'off')), 'off must suppress domain advice');
assert(!exp(tool('code-get', {projectDir:app}, 'off', sessionId + '-off')), 'off must suppress error advice');
assert(!exp(gesture(sessionId + '-errors-domain', 'errors-only')), 'errors-only must suppress first-domain advice');
assert(exp(gesture(sessionId + '-other')), 'Independent session needs its own first push');
assert(!exp(tool('code-set', {projectDir:empty, name:'Orders', code:'function Orders({result}) {\n result.rows = sql.table({name:"orders"})\n}\n'})), 'Project without drawers must remain unchanged');
assert(!exp(gesture(sessionId + '-literal', 'on', 'function Orders({result}) {\n // sql.table({})\n result.label = "sql.table({})"\n}\n')), 'Comments/string literals must not trigger a domain');
assert(ace.sourceBlocks('result.label = input.customer.trim()\nresult.rows = local.orders.filter(Boolean)\nresult.amount = Math.round(4.2)').length === 0,
  'Expression methods must not be mistaken for block domains');
assert(exp(tool('code-check', {projectDir:app, name:'Orders'}, 'on', sessionId + '-check')), 'check must detect domains in the saved source');
var patchBase = tool('code-get', {projectDir:app, name:'Orders'}).result.structuredContent;
var patchedGesture = tool('code-patch', {projectDir:app, name:'Orders', revision:patchBase.revision,
  edits:[{oldText:'name:"orders"',newText:'name:"customers"'}]}, 'on', sessionId+'-patch');
assert(exp(patchedGesture) && ids(patchedGesture).indexOf('sql-00001') >= 0, 'patch must detect domains in the resulting source');
var noBookOn = tool('code-get', {projectDir:empty}, 'on', sessionId+'-empty-on');
var noBookOff = tool('code-get', {projectDir:empty}, 'off', sessionId+'-empty-off');
assert(JSON.stringify(noBookOn.result) === JSON.stringify(noBookOff.result), 'No-playbook result must be byte-for-byte unchanged');

var listed = call('resources/list', {projectDir:app}).result.resources;
assert(listed.some(function(r) { return r.uri === 'flow://ace'; }), 'ACE index missing from resources/list');
assert(listed.some(function(r) { return r.uri === 'flow://ace/lib_orders/sql'; }), 'Library drawer missing from resources/list');
var uri = 'flow://ace/lib_orders/sql';
var read = call('resources/read', {uri:uri, projectDir:app});
assert(read.result.contents[0].text === sqlText, 'Drawer must be served whole');
var index = call('resources/read', {uri:'flow://ace', projectDir:app}).result.contents[0].text;
assert(index.indexOf('3 entries') >= 0 && index.indexOf('MISSING_FLOW_QNAME') >= 0 && index.indexOf('data.write') >= 0, 'Index must report counts and triggers');
assert(call('resources/read', {uri:'flow://ace/../sql', projectDir:app}).error, 'Unknown/path traversal resource must be refused');
var viaTool = tool('flow-resource-get', {projectDir:app, uri:uri});
assert(viaTool.result.structuredContent.text === sqlText, 'Clients without resource support need flow-resource-get');
assert(/Resource text is in text/.test(viaTool.result.structuredContent.content), 'Legacy field redirects without a duplicate drawer');
var plainDrawer = tool('flow-resource-get', {projectDir:app, uri:uri, format:'text'}).result;
assert(!plainDrawer.structuredContent && plainDrawer.content[0].text === sqlText, 'Readable drawer is complete with no competing structured data');
var changed = sqlText.replace('Check the orders table', 'Probe the orders table');
assert(changed.length === sqlText.length, 'Invalidation fixture must keep the same size');
Files.writeString(sqlFile.toPath(), changed, UTF8);
var beforeEditReads = Number(attributes.get('lib_flow_mcp.experience.control.v1').get('reads'));
assert(call('resources/read', {uri:uri, projectDir:app}).result.contents[0].text === changed, 'Resource edit must invalidate cached drawer');
assert(Number(attributes.get('lib_flow_mcp.experience.control.v1').get('reads')) === beforeEditReads + 1, 'Only the changed drawer should be read again');
assert(exp(gesture(sessionId + '-changed')).entries[0].text.indexOf('Probe') === 0, 'Push used stale drawer');

// Pure selection checks exercise budgets and multi-domain calls without needing a SQL runtime.
var large = '## STRATEGIES & INSIGHTS\n[sql-00001] helpful=999 harmful=0 :: ' + Array(5001).join('x') + '\n';
for (var n = 2; n < 40; n++) large += '[sql-' + n + '] helpful=' + n + ' harmful=0 :: Check orders and customers before writing orders.\n';
var entries = ace.parse(large, 'lib_orders', 'sql');
var state = {call:1, drawers:{}, sent:{}};
var bounded = ace.select(entries, ['sql.table'], {}, state, 'on');
assert(bounded && bounded.estimatedTokens <= 500 && ace.addedChars(bounded.experience) <= 2000, 'Combined channels exceed the 500 estimated token budget');
assert(bounded.experience.entries.every(function(e) { return e.id !== 'sql-00001'; }), 'Oversize snippet must not be cut');
assert(!ace.select(entries, ['sql.table'], {}, state, 'on'), 'Budget overflow must not repeat a seen drawer');
var custom = ace.parse('## SECTION\n[orders-1] helpful=4 harmful=0 :: Check customers.\n    @blocks: data.write\n', 'lib_orders', 'orders');
assert(ace.select(custom, ['data.write'], {}, {call:1,drawers:{},sent:{}}, 'on'), 'Block triggers must map a namespace to a differently named drawer');
assert(ace.domains({params:{name:'scheduler-list'}}, {}, '').join(',') === 'jobs', 'Scheduler domain missing');
assert(ace.domains({params:{name:'flow-crud-upsert'}}, {}, '').join(',') === 'sql,front', 'CRUD domain missing');
assert(!Object.keys(ace.diagnosticCodes({result:{code:'MISSING_FLOW_QNAME'}})).length, 'Business code must not trigger advice');
var errors = [];
for (var n = 0; n < 5; n++) errors.push({id:'sql-'+n,library:'lib_orders',drawer:'sql',score:n,text:'Check orders.',codes:['ERROR'],blocks:[]});
var maxTwo = ace.select(errors, [], {ERROR:true}, {call:1,drawers:{},sent:{}}, 'on');
assert(maxTwo.experience.entries.length === 2, 'Error pushes must contain at most two entries');
assert(!ace.select(entries, [], {}, {call:1,drawers:{},sent:{}}, 'on'), 'No domain means no common push');
// Session identities do not merge callers or conversations. No raw bearer/session value is logged.
var mcp = eval(String(FileUtils.readFileToString(new File(projectDir, '_flow/lib/mcp.js'), 'UTF-8')));
var decoratedSchema = mcp.toolOutputSchema({type:'object',properties:{ok:{type:'boolean'}},additionalProperties:false});
assert(decoratedSchema.anyOf[0].properties.experience.properties.entries.type === 'array', 'Strict tool schemas must accept structured experience');
var blockText = String(FileUtils.readFileToString(new File(projectDir, '_flow/blocks/mcp/experience.block.js'), 'UTF-8'));
var block = eval(blockText.substring(blockText.indexOf('(function')));
function direct(headers, caller, config, request, response) {
  return block.run({ props:function() { return {request:request, response:response, operation:'push'}; },
    lib:function(name) { return name === 'mcp' ? mcp : ace; }, write:function() {},
    scopes:{config:{mcp:config || {}}},
    convertigoContext:function() { return {httpServletRequest:{
      getHeader:function(name) { return headers[name] || null; }, getSession:function() { return null; },
      getAttribute:function() { return caller; }
    }}; }
  }, {});
}
var directRequest = {method:'tools/call',params:{name:'code-set',arguments:{projectDir:app,code:'function Orders({result}) { result.rows = sql.table({}) }'}}};
var directResponse = {result:{content:[{type:'text',text:'OK'}],structuredContent:{ok:true}}};
assert(exp(direct({'X-Convertigo-Conversation-Id':'orders-a'}, 'caller-a', {}, directRequest, directResponse)), 'Bridge conversation must get advice');
assert(!exp(direct({'X-Convertigo-Conversation-Id':'orders-a'}, 'caller-a', {}, directRequest, directResponse)), 'Bridge conversation was not kept');
assert(exp(direct({'X-Convertigo-Conversation-Id':'orders-b'}, 'caller-a', {}, directRequest, directResponse)), 'Different conversation was merged');
assert(exp(direct({'X-Convertigo-Conversation-Id':'orders-a'}, 'caller-b', {}, directRequest, directResponse)), 'Different authenticated caller was merged');
assert(exp(direct({'Mcp-Session-Id':'orders-mcp-a'}, 'caller-a', {}, directRequest, directResponse)), 'MCP session must get advice');
assert(!exp(direct({'Mcp-Session-Id':'orders-mcp-a'}, 'caller-a', {}, directRequest, directResponse)), 'MCP session was not kept');
assert(!exp(direct({'Mcp-Session-Id':'orders-unauth'}, null, {}, directRequest, directResponse)), 'Unauthenticated HTTP request must never get advice');
assert(!exp(direct({'Mcp-Session-Id':'orders-off'}, 'caller-a', {experience:'off'}, directRequest, directResponse)), 'Session off setting not honored');
assert(!exp(directResponse), 'Advice mutated a reusable provider response');
var jobsRequest = {method:'tools/call',params:{name:'scheduler-list',arguments:{projectDir:app}}};
var jobsReply = direct({'Mcp-Session-Id':'orders-jobs'}, 'caller-a', {}, jobsRequest, directResponse);
assert(exp(jobsReply) && exp(jobsReply).drawer.indexOf('jobs') >= 0, 'Scheduler reply must carry jobs advice');
assert(!exp(direct({'Mcp-Session-Id':'orders-jobs'}, 'caller-a', {}, jobsRequest, directResponse)), 'Scheduler must not repeat its drawer');
var crudRequest = {method:'tools/call',params:{name:'flow-crud-upsert',arguments:{projectDir:app}}};
var crudReply = direct({'Mcp-Session-Id':'orders-crud'}, 'caller-a', {}, crudRequest, directResponse);
assert(exp(crudReply) && exp(crudReply).drawer.indexOf('front') >= 0 && exp(crudReply).drawer.indexOf('sql') >= 0, 'CRUD reply must carry both domain drawers');
var warningRequest = {method:'tools/call',params:{name:'flow-list',arguments:{projectDir:app}}};
var warningResponse = {result:{structuredContent:{ok:true,diagnostics:[{severity:'warning',code:'MISSING_FLOW_QNAME'}]},content:[]}};
assert(exp(direct({'Mcp-Session-Id':'orders-warning'}, 'caller-a', {}, warningRequest, warningResponse)).reason === 'error', 'A diagnostic code must trigger even on success');
var trace = new File(projectDir, '_private/ace/experience-push.jsonl');
assert(trace.isFile(), 'Push log missing');
var records = String(FileUtils.readFileToString(trace, 'UTF-8')).trim().split('\n').map(JSON.parse).filter(function(r) { return r.tool === 'code-get' && r.reason === 'error'; });
assert(records.length >= 2 && records[0].session && records[0].ids[0] === 'sql-00002', 'Log needs session, tool, reason and ids');
print('experience-push OK (' + checks + ' checks; fixture ' + root + '; bounded push ' + bounded.estimatedTokens + ' estimated tokens across both channels)');
