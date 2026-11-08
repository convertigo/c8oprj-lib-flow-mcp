// UNKNOWN_REQUESTABLE names the requestable that is missing, which may be called inside the Flow that runs (a
// requestable.call of code-run, flow-code-run or requestable-execute). code-promote is proposed for that missing
// requestable when a source of that name exists, never for the Flow that runs because its own source exists.
var root = new java.io.File(arguments[0]), files = Packages.org.apache.commons.io.FileUtils;
var checks = 0;
function assert(ok, message) { checks++; if (!ok) throw new Error(message); }
var dir = java.nio.file.Files.createTempDirectory("flow-requestable-child-").toFile().getCanonicalFile();
try {
  // runner: a promoted Flow with its file; child_saved: a file never promoted; child_draft: a working copy only.
  ["runner", "child_saved"].forEach(function (name) {
    files.writeStringToFile(new java.io.File(dir, "_flow/flows/" + name + ".flow.js"), "function " + name + "({ result }) {\n  result.ok = true\n}\n", "UTF-8");
  });
  function sequence(name) { return { getName: function () { return name; } }; }
  var declared = ["runner"];
  var owner = {
    getDirPath: function () { return String(dir.getAbsolutePath()); },
    getSequencesList: function () { var list = new java.util.ArrayList(); declared.forEach(function (name) { list.add(sequence(name)); }); return list; },
    getSequenceByName: function (name) { return declared.indexOf(String(name)) >= 0 ? sequence(name) : null; },
    getFlowEngine: function () { return { hasSource: function (path) { return /child_draft\.flow\.js$/.test(String(path)); } }; }
  };
  var engine = { isEngineMode: function () { return true; }, theApp: { databaseObjectsManager: {
    existsProject: function () { return false; }, getOriginalProjectByName: function (name) { return name === "orders" ? owner : null; }
  } } };
  var GENERAL = "Use .Sequence, .Flow or .Connector.Transaction for the current project; use Project.Sequence or Project.Connector.Transaction for another project.";
  function engineError(missing) {
    var error = new Error("Unknown Convertigo requestable: " + missing);
    error.code = "UNKNOWN_REQUESTABLE";
    error.hint = GENERAL;
    return error;
  }
  var mocked = { java: Packages.java, org: Packages.org, com: { twinsoft: { convertigo: { engine: { Engine: engine } } } } };
  var mcp = (function (Packages) { return eval(String(files.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8"))); })(mocked);
  function formatted(tool, args, missing) {
    return mcp.toolError({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: tool, arguments: args } },
      engineError(missing)).result.structuredContent.error;
  }

  // 1. code-run and flow-code-run: the missing requestable decides, not the Flow that runs.
  ["code-run", "flow-code-run"].forEach(function (tool) {
    var inner = formatted(tool, { project: "orders", name: "runner" }, "orders.missing_child");
    assert(inner.hint === GENERAL && !inner.details && !/not promoted/.test(inner.message),
      tool + ": a missing child of a Flow with a source keeps the general refusal: " + JSON.stringify(inner));
    ["child_saved", "child_draft"].forEach(function (child) {
      var named = formatted(tool, { project: "orders", name: "runner" }, "orders." + child);
      assert(/code-promote/.test(named.hint) && named.details && named.details.next.tool === "code-promote" &&
        named.details.next.arguments.project === "orders" && named.details.next.arguments.name === child &&
        named.message.indexOf("A Flow source " + child + " exists but is not promoted.") >= 0,
        tool + ": the missing " + child + " is the one to promote: " + JSON.stringify(named));
    });
    var transaction = formatted(tool, { project: "orders", name: "runner" }, "orders.Http.child_saved");
    assert(transaction.hint === GENERAL && !transaction.details, tool + ": a connector transaction is never a Flow to promote");
    var unnamed = mcp.toolError({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: tool, arguments: { project: "orders", name: "child_saved" } } },
      { code: "UNKNOWN_REQUESTABLE", message: "Unknown requestable.", hint: GENERAL }).result.structuredContent.error;
    assert(unnamed.hint === GENERAL && !unnamed.details, tool + ": without the missing name, nothing is proposed");
  });

  // 2. requestable-execute of a promoted Flow whose requestable.call fails: no promotion of that Flow.
  var text = String(files.readFileToString(new java.io.File(root, "_flow/blocks/mcp/tools/server.block.js"), "UTF-8"));
  var tools = eval(text.substring(text.indexOf("(function ()")));
  function executeRefusal(requestable, missing) {
    var ctx = { lib: function () { return {}; }, callBlock: function () { throw engineError(missing); } };
    try { tools.execute(ctx, engine, "requestable-execute", { project: "orders", requestable: requestable }); } catch (error) { return error; }
    throw new Error("Expected a refusal for " + requestable);
  }
  var nested = executeRefusal("runner", "orders.missing_child");
  assert(!/not promoted/.test(String(nested.message)) && String(nested.hint).indexOf("code-promote({") < 0 &&
    !(nested.details && nested.details.next), "requestable-execute: a missing child is not the Flow that runs: " + nested.message + " / " + nested.hint);
  var draftChild = executeRefusal("runner", "orders.child_draft");
  assert(String(draftChild.hint).indexOf('code-promote({project:"orders", name:"child_draft"})') >= 0 &&
    draftChild.details.next.arguments.name === "child_draft", "requestable-execute: the missing child draft is promoted: " + draftChild.hint);
  var formattedTwice = mcp.toolError({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "requestable-execute",
    arguments: { project: "orders", requestable: "runner" } } }, draftChild).result.structuredContent.error;
  assert(formattedTwice.message.split("is not promoted").length === 2 && formattedTwice.details.next.arguments.name === "child_draft",
    "the formatter keeps one promotion: " + formattedTwice.message);
  print("requestable-unknown-child-1109 OK (" + checks + " checks)");
} finally {
  files.deleteDirectory(dir);
}
