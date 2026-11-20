// One name form since 20/11: a guide is its path, flow://guide/<family>/<topic>. The former names, sub-guides
// <family>-<topic> and drawers <family-topic>/<leaf>, and guesses that differ by their separators only (it156, GLM:
// flow://guide/frontend-svelte/data and its siblings, each an UNKNOWN_RESOURCE) read the one guide of that path; the
// retired redirect guides read their parent; flow://guide/ alone reads the entry guide; nothing is invented.
var root = new java.io.File(arguments[0]);
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8")));
var core = ["start", "frontend-svelte", "frontend-svelte/data", "frontend-svelte/actions", "frontend-svelte/limits",
  "frontend-svelte/loop", "entities", "entities/model", "entities/model/lists", "entities/widgets", "entities/widgets/table",
  "crud", "crud/business"];
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function uri(text) { return mcp.guideAlias(text, [], core).uri; }

assert(uri("flow://guide/frontend-svelte-data") === "flow://guide/frontend-svelte/data", "a former sub-guide name");
assert(uri("flow://guide/frontend-svelte-actions/") === "flow://guide/frontend-svelte/actions", "with a final slash");
assert(uri("flow://guides/Frontend-Svelte/Data.md") === "flow://guide/frontend-svelte/data", "guides, case and .md");
assert(uri("flow://guide/entities-model/lists") === "flow://guide/entities/model/lists", "a former drawer of a sub-guide");
assert(uri("flow://guide/entities-widgets-table") === "flow://guide/entities/widgets/table", "three levels with dashes");
assert(uri("flow://guide/entities-model-reference") === "flow://guide/entities/model", "a retired redirect guide");
assert(uri("flow://guide/crud-business-reference") === "flow://guide/crud/business", "another retired redirect guide");
assert(uri("flow://guide/") === "flow://guide/start" && uri("flow://guide") === "flow://guide/start", "the bare guide address");
// Nothing invented: a topic of no guide keeps the error and its suggestions.
var blocks = mcp.guideAlias("flow://guide/frontend-svelte/sequences", [], core);
assert(!blocks.uri || blocks.uri === "flow://guide/frontend-svelte", "an unknown topic is not mapped to another topic: " + JSON.stringify(blocks));
assert(mcp.guideAlias("flow://guide/", [], ["authoring"]).uri !== "flow://guide/start", "no entry guide, no answer");
print("guide-drawer-alias-1119 OK (" + count + " checks)");
