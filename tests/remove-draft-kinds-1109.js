// flow-object-remove refused for unsaved Studio work (PROJECT_HAS_STUDIO_DRAFTS): pendingDrafts mixes Flow working copies
// ("flow name"), Flow source drafts, frontend sources, _flow/engine.yaml and other sources. The hint gives each entry
// its own recovery: code-get, then code-promote or code-discard for a Flow; code-get and code-discard with sourceFile for
// a frontend source; the Studio for the others, which no tool saves or discards. It never names a path as a Flow.
var root = new java.io.File(arguments[0]);
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8"));
var mcp = eval(source);
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function refusal(pending) {
  return mcp.toolError({ jsonrpc: "2.0", id: 1, method: "tools/call", params: {
    name: "flow-object-remove", arguments: { project: "App", qname: "App.old_list" }
  } }, { code: "PROJECT_HAS_STUDIO_DRAFTS", message: "Saving project App would also save unsaved Studio work.",
    details: { project: "App", pendingDrafts: pending, requiresChoice: true } }).result.structuredContent.error;
}
var error = refusal(["flow notes_list", "_flow/flows/tasks_list.flow.js", "_flow/engine.yaml",
  "_flow/frontbuilder/pages/home.flow.svelte", "_flow/blocks/app/total.block.js"]);
var hint = String(error.hint);
["notes_list", "tasks_list"].forEach(function (name) {
  assert(hint.indexOf('code-get({project:"App",name:"' + name + '"})') >= 0 &&
    hint.indexOf('code-promote({project:"App",name:"' + name + '",revision})') >= 0 &&
    hint.indexOf('code-discard({project:"App",name:"' + name + '"})') >= 0, "the Flow " + name + " is resolved with the code tools: " + hint);
});
var svelte = "_flow/frontbuilder/pages/home.flow.svelte";
assert(hint.indexOf('code-get({project:"App",sourceFile:"' + svelte + '"})') >= 0 &&
  hint.indexOf('code-discard({project:"App",sourceFile:"' + svelte + '"})') >= 0, "a frontend source is read and discarded by sourceFile: " + hint);
assert(!/code-promote\(\{[^)]*sourceFile/.test(hint), "no promotion exists for a source: " + hint);
["_flow/engine.yaml", "_flow/blocks/app/total.block.js"].forEach(function (path) {
  assert(hint.indexOf(path) >= 0 && /Studio/.test(hint), path + " is left to the Studio: " + hint);
  assert(hint.indexOf('name:"' + path) < 0 && hint.indexOf('sourceFile:"' + path) < 0, path + " is never given to a code tool: " + hint);
});
assert(/name:"_flow/.test(hint) === false && /name:"flow /.test(hint) === false, "a path or a prefixed entry is never a Flow name: " + hint);
assert(/saveProject:false/.test(hint) && /flow-object-remove/.test(hint), "the deletion can still be left for the next Save: " + hint);

// Flow drafts only: no Studio step is invented.
var flowsOnly = String(refusal(["flow notes_list"]).hint);
assert(flowsOnly.indexOf('code-promote({project:"App",name:"notes_list",revision})') >= 0 && !/engine\.yaml|sourceFile/.test(flowsOnly),
  "a Flow draft alone: " + flowsOnly);
print("remove-draft-kinds-1109 OK (" + checks + " checks)");
