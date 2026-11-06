// A tool result with ok:false and no error object still gives text clients a code and a message,
// and the cause of its failed step (a frontend build answered "keys: ok, title, message, ..." only).
var project = new java.io.File(arguments[0]).getCanonicalFile();
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project, '_flow/lib/mcp.js'), 'UTF-8')));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var request = {jsonrpc:'2.0', id:54, method:'tools/call', params:{name:'frontend-svelte-action', arguments:{project:'Example', action:'build'}}};
var stdout = '\n> example@0.0.0 build\n> vite build\n\nvite v8.3.4 building ssr environment for production...\n✗ Build failed in 533ms\n' +
	'error during build:\nBuild failed with 1 error:\n\n[plugin vite-plugin-svelte:compile] /workspace/src/routes/+page.svelte:82:588\n' +
	'RolldownError: src/routes/+page.svelte:82:588 `<#text>` cannot be a child of `<table>`.\nhttps://svelte.dev/e/node_invalid_placement\n' +
	' 80 |    />\n 81 |  </RowLayout>\n';
var value = {ok:false, title:'Svelte frontbuilder', message:'Svelte frontbuilder action failed: build.', refresh:true,
	details:{action:'build', steps:[{action:'generate', ok:true, exitCode:0}, {action:'build', ok:false, exitCode:1, stdout:stdout}]}};
var result = mcp.toolResponse(request, value, {}).result;
var text = result.content[0].text;
assert(result.isError === true, 'A failed result is a tool error');
assert(/^Error \[[A-Z][A-Z0-9_]+\]: /.test(text), 'The text gives an error code: ' + text);
assert(text.indexOf('Svelte frontbuilder action failed: build') >= 0, 'The text gives the message: ' + text);
assert(text.indexOf('cannot be a child of `<table>`') >= 0 && text.indexOf('build') >= 0, 'The text gives the cause of the failed step: ' + text);
assert(result.structuredContent.ok === false && result.structuredContent.details.steps.length === 2, 'Structured data is unchanged');
// A failure with its own code keeps it; a bare one still has a message.
var coded = mcp.toolResponse(request, {ok:false, code:'FRONTEND_DEV_NOT_RUNNING', message:'Dev mode is stopped.'}, {}).result.content[0].text;
assert(coded.indexOf('Error [FRONTEND_DEV_NOT_RUNNING]: Dev mode is stopped.') === 0, 'Own code kept: ' + coded);
var bare = mcp.toolResponse(request, {ok:false}, {}).result.content[0].text;
assert(/^Error \[[A-Z][A-Z0-9_]+\]: \S/.test(bare), 'A bare failure still has a code and a message: ' + bare);
// Source code in a "code" property is not taken for an error code.
var source = mcp.toolResponse(request, {ok:false, code:'result.x = 1\n', message:'Refused.'}, {}).result.content[0].text;
assert(source.indexOf('result.x = 1') < 0 && /^Error \[[A-Z][A-Z0-9_]+\]: Refused\./.test(source), 'Source is not an error code: ' + source);
// Errors with an error object keep their own text.
var errored = mcp.toolResponse(request, {ok:false, error:{code:'TEST_ERROR', message:'Expected refusal'}}, {}).result.content[0].text;
assert(errored.indexOf('Error [TEST_ERROR]: Expected refusal.') === 0, 'Error objects unchanged: ' + errored);
print('tool-failed-summary OK (' + checks + ' checks)');
