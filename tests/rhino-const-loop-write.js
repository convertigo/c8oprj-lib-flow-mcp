var mcpDir = String(new java.io.File(arguments[0] || ".").getCanonicalPath());
var engineDir = String(new java.io.File(arguments[1] || "../lib_flow_engine/_flow").getCanonicalPath());
var files = Packages.org.apache.commons.io.FileUtils;
var target = java.nio.file.Files.createTempDirectory("flow-mcp-rhino-const-").toFile().getCanonicalFile();
var __flowEngineDir = engineDir;
var __flowProjectDir = mcpDir;
var engine = eval(String(files.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8")));
var router = String(files.readFileToString(new java.io.File(mcpDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function tool(id, name, args) {
	args.projectDir = String(target.getAbsolutePath());
	var request = {jsonrpc: "2.0", id: id, method: "tools/call", params: {name: name, arguments: args}};
	var out = JSON.parse(engine.run(JSON.stringify({flowSource: router, includeTrace: false, input: {request: JSON.stringify(request)}})));
	assert(out.ok && out.result && out.result.result, name + ': ' + JSON.stringify(out.error));
	var result = out.result.result;
	return {value: result.structuredContent, text: String(result.content && result.content[0] && result.content[0].text || ''), error: result.isError};
}
try {
	var code = 'const _meta={runtime:"rhino",description:"Loop probe."}\n(function(){return {run:function(){var values=[];for(var i=0;i<3;i++){const x=i*2;values.push(x);}return values;}};}())';
	var written = tool(1, 'code-set', {block: 'proof.loop', code: code});
	assert(!written.error && written.value.ok && written.value.fixes && written.value.fixes.length === 1, 'code-set fixes: ' + JSON.stringify(written.value));
	assert(written.value.fixes[0].line === 2 && written.value.fixes[0].before === 'const' && written.value.fixes[0].after === 'let', 'fix details');
	assert(written.value.warnings.some(function (warning) { return warning.code === 'RHINO_CONST_IN_LOOP_CORRECTED'; }) && written.text.indexOf('Const declarations inside Rhino loops') >= 0, 'warning was lost');
	var saved = tool(2, 'code-get', {block: 'proof.loop'});
	assert(saved.value.code.indexOf('let x=i*2') >= 0, 'code-get has old source');
	var patched = tool(3, 'code-patch', {block: 'proof.loop', revision: saved.value.revision, edits: [{oldText: 'let x=i*2', newText: 'const x=i*3'}]});
	assert(!patched.error && patched.value.fixes && patched.value.fixes[0].after === 'let' && patched.value.warnings.some(function (warning) { return warning.code === 'RHINO_CONST_IN_LOOP_CORRECTED'; }), 'code-patch correction: ' + JSON.stringify(patched.value));
	print('Rhino const loop MCP write OK (' + checks + ' checks)');
} finally { files.deleteDirectory(target); }
