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
print('resource-text-alias OK (start '+start.length+' characters; envelope budget '+(JSON.stringify(startResult).length+200)+'/16000)');
