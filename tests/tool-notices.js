// Response projections must retain actionable notices and failures without echoing discarded source.
var project = new java.io.File(arguments[0]).getCanonicalFile();
var sourceFile = arguments[1] ? new java.io.File(arguments[1]) : new java.io.File(project, '_flow/lib/mcp.js');
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(sourceFile, 'UTF-8')));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function request(name, args) { return { jsonrpc: '2.0', id: 23, method: 'tools/call', params: { name: name, arguments: args || {} } }; }
function response(name, value, args) { return mcp.toolResponse(request(name, args), value, {}).result; }
var normalization = [{ property: 'example', before: 'true', after: true }];
['flow-list', 'code-set', 'code-run', 'code-check', 'code-analyze'].forEach(function (name) {
  var answer = response(name, { ok: true, flows: [], revision: 'draft', result: { count: 0 },
    argumentWarning: 'Ignored argument example.', operatorNote: 'Check the business refusal.', normalizations: normalization });
  var value = answer.structuredContent;
  assert(value.argumentWarning === 'Ignored argument example.', name + ' lost the argument warning');
  assert(value.operatorNote === 'Check the business refusal.', name + ' lost the operator note');
  assert(value.normalizations[0].after === true, name + ' lost the normalization');
  var text = answer.content[0].text;
  assert(text.indexOf(value.operatorNote) >= 0 && text.indexOf(value.argumentWarning) >= 0, name + ' text omits notices');
});
['code-check', 'code-run', 'code-analyze', 'flow-code-check', 'flow-code-run', 'flow-code-analyze'].forEach(function (name) {
  var args = { code: 'discarded-source-marker', flowScript: '', flowSource: null, definition: {}, includeTrace: false, input: { code: 'business value' } };
  var original = JSON.stringify(args);
  var prepared = mcp.prepareToolArguments(null, request(name, args), { resolveProject: false });
  ['code', 'flowScript', 'flowSource', 'definition'].forEach(function (key) { assert(!Object.prototype.hasOwnProperty.call(prepared, key), name + ' forwarded ' + key); });
  assert(prepared.input.code === 'business value' && JSON.stringify(args) === original, 'Nested business data or caller arguments changed');
  var answer = response(name, { ok: true }, args);
  assert(/code, flowScript, flowSource, definition/.test(answer.structuredContent.argumentWarning), name + ' did not identify discarded arguments');
  assert(answer.structuredContent.argumentWarning.indexOf('code-set or code-patch') >= 0, name + ' has no recovery step');
  assert(JSON.stringify(answer).indexOf('discarded-source-marker') < 0, name + ' echoed discarded code');
});
assert(!response('code-run', { ok: true }, { input: { code: 'business data' }, providerExtension: true }).structuredContent.argumentWarning,
  'Open provider properties must not be classified as ignored');
assert(!response('code-set', { ok: true }, { code: 'valid source' }).structuredContent.argumentWarning, 'Source writes must keep accepting code');
var combined = response('code-check', { ok: true, argumentWarning: 'Provider notice.' }, { code: 'discarded' }).structuredContent.argumentWarning;
assert(combined.indexOf('Provider notice.') === 0 && combined.indexOf('Ignored arguments code') > 0, 'Wrapper overwrote the provider warning');
['flow-list', 'code-run', 'code-set'].forEach(function (name) {
  var answer = response(name, { error: { code: 'FIXTURE_ERROR', message: 'Read the cause', details: { password: 'fixture-only' } }, revision: 'retry', operatorNote: 'Keep the draft.' });
  assert(answer.isError === true && answer.structuredContent.error.code === 'FIXTURE_ERROR', name + ' hid a tool failure');
  assert(answer.structuredContent.revision === 'retry' && answer.structuredContent.operatorNote === 'Keep the draft.', name + ' lost recovery metadata');
  assert(JSON.stringify(answer).indexOf('fixture-only') < 0, name + ' bypassed sanitization');
});
assert(!response('flow-list', { ok: true, flows: [] }).structuredContent.operatorNote, 'Empty notices should not inflate ordinary answers');
var diagnostics = [];
for (var i = 0; i < 30; i++) diagnostics.push({ code: 'FIXTURE', message: 'Diagnostic ' + i });
var failedWrite = response('code-set', { ok: false, error: {code:'FIXTURE',message:'Check failed'}, diagnostics:diagnostics, operatorNote:'Keep the draft.' }).structuredContent;
assert(failedWrite.diagnostics.length === 8 && failedWrite.diagnosticCount === 30 && failedWrite.operatorNote === 'Keep the draft.', 'Notices bypassed the diagnostic budget');
var longNote = Array(6001).join('x'), bounded = response('flow-list', { ok: true, flows: [], operatorNote: longNote });
assert(bounded.content[0].text.length < 2400 && bounded.structuredContent.operatorNote === longNote, 'Text notices must stay compact without losing structured data');
var successSchema = { type: 'object', properties: { answer: { type: 'integer' } }, required: ['answer'], additionalProperties: false };
var schema = mcp.toolOutputSchema(successSchema);
assert(!successSchema.properties.argumentWarning, 'Output schema decoration mutated its owner');
assert(schema.properties.argumentWarning.type === 'string' && schema.anyOf[0].properties.operatorNote.type === 'string', 'Strict success schema rejects notices');
// A refused code-set or code-patch of a Flow keeps the refused source as its working copy, under a new revision: the
// text says so with that revision (an agent reading the text alone retried on the former one).
['code-set', 'code-patch'].forEach(function (name) {
  var kept = response(name, { ok: false, name: 'Orders', draft: true, written: true, revision: 'rev-new', oldRevision: 'rev-old',
    error: { code: 'FLOWSCRIPT_UNBALANCED_SYNTAX', message: 'Unbalanced FlowScript function body at line 2' } }, { qname: 'P.Orders', revision: 'rev-old', code: 'x' });
  assert(kept.isError === true && kept.structuredContent.revision === 'rev-new', name + ' lost the new revision: ' + JSON.stringify(kept.structuredContent));
  assert(kept.content[0].text.indexOf('kept as the working copy, revision rev-new') >= 0, name + ' text does not give the revision of the kept working copy: ' + kept.content[0].text);
  var unwritten = response(name, { ok: false, written: false, revision: 'rev-old', error: { code: 'FLOW_CODE_DRAFT_REVISION_MISMATCH', message: 'Stale' } }, { revision: 'rev-old', code: 'x' });
  assert(unwritten.content[0].text.indexOf('kept as the working copy') < 0, name + ' claims a working copy for a refusal that wrote nothing');
});
// A mistyped revision (copySlip from the engine) needs no code-get: the next step promotes again without revision.
var slipped = response('code-promote', { ok: false, name: 'Orders', draft: true, revision: 'rev-current',
  error: { code: 'FLOW_CODE_DRAFT_REVISION_MISMATCH', message: 'Supplied revision rev-curernt is a mistyped copy of the current revision rev-current',
    hint: 'Promote again without revision to promote this working copy, or copy this revision exactly: rev-current.',
    details: { property: 'revision', receivedRevision: 'rev-curernt', currentRevision: 'rev-current', name: 'Orders', copySlip: true } } }, { name: 'Orders', revision: 'rev-curernt' });
assert(slipped.structuredContent.error.details.copySlip === true, 'copySlip lost: ' + JSON.stringify(slipped.structuredContent.error));
assert(/without revision/.test(slipped.structuredContent.next) && !/code-get/.test(slipped.structuredContent.next), 'A copy slip still sends to code-get: ' + slipped.structuredContent.next);
var stale = response('code-promote', { ok: false, name: 'Orders', draft: true, revision: 'r1',
  error: { code: 'FLOW_CODE_DRAFT_REVISION_MISMATCH', message: 'Supplied revision r0 is not the current working copy revision r1',
    details: { property: 'revision', receivedRevision: 'r0', currentRevision: 'r1', name: 'Orders' } } }, { name: 'Orders', revision: 'r0' });
assert(/code-get/.test(stale.structuredContent.next) && !/without revision/.test(stale.structuredContent.next), 'An unrelated revision must still be reviewed: ' + stale.structuredContent.next);
print('tool-notices OK (' + checks + ' checks)');
