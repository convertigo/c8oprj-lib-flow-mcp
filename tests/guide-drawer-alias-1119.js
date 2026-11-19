// A split guide has sub-guides <family>-<topic> and drawers <family>/<topic>: agents swap the two forms (it156, GLM:
// flow://guide/frontend-svelte/data, /actions, /blocks, /sequences on four front exercises, each an UNKNOWN_RESOURCE).
// Either form reads the one guide of the other; flow://guide/ alone reads the entry guide; nothing is invented.
var root = new java.io.File(arguments[0]);
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8")));
var core = ["start", "frontend-svelte", "frontend-svelte-data", "frontend-svelte-actions", "frontend-svelte/limits",
  "frontend-svelte/loop", "entities-widgets", "entities-widgets/table", "entities-widgets-reference"];
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function uri(text) { return mcp.guideAlias(text, [], core).uri; }

assert(uri("flow://guide/frontend-svelte/data") === "flow://guide/frontend-svelte-data", "a sub-guide named as a drawer");
assert(uri("flow://guide/frontend-svelte/actions/") === "flow://guide/frontend-svelte-actions", "with a final slash");
assert(uri("flow://guides/Frontend-Svelte/Data.md") === "flow://guide/frontend-svelte-data", "guides, case and .md");
assert(uri("flow://guide/frontend-svelte-limits") === "flow://guide/frontend-svelte/limits", "a drawer named as a sub-guide");
assert(uri("flow://guide/entities-widgets-table") === "flow://guide/entities-widgets/table", "a drawer of another family");
assert(uri("flow://guide/") === "flow://guide/start" && uri("flow://guide") === "flow://guide/start", "the bare guide address");
// Nothing invented: a topic of no sub-guide nor drawer keeps the error and its suggestions.
var blocks = mcp.guideAlias("flow://guide/frontend-svelte/sequences", [], core);
assert(!blocks.uri || blocks.uri === "flow://guide/frontend-svelte", "an unknown topic is not mapped to another topic: " + JSON.stringify(blocks));
assert(mcp.guideAlias("flow://guide/", [], ["authoring"]).uri !== "flow://guide/start", "no entry guide, no answer");
print("guide-drawer-alias-1119 OK (" + count + " checks)");
