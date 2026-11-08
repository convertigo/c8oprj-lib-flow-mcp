// requestable-execute of a Flow that is not promoted: five agents read UNKNOWN_REQUESTABLE with the generic hint
// "Use .Sequence, .Flow or .Connector.Transaction" while the Flow existed as a working copy, or as a file a project-save
// wrote before any promotion. The refusal now says so and gives the code-promote call; otherwise it names the close
// requestables of the project, and a Flow suffixed with .Flow is given back without its suffix.
var root = new java.io.File(arguments[0]), files = Packages.org.apache.commons.io.FileUtils;
var text = String(files.readFileToString(new java.io.File(root, "_flow/blocks/mcp/tools/server.block.js"), "UTF-8"));
var tools = eval(text.substring(text.indexOf("(function ()")));
var checks = 0;
function assert(ok, message) { checks++; if (!ok) throw new Error(message); }
var dir = java.nio.file.Files.createTempDirectory("flow-requestable-unknown-").toFile().getCanonicalFile();
try {
  files.writeStringToFile(new java.io.File(dir, "_flow/flows/book_create.flow.js"), "function book_create({ result }) {\n  result.ok = true\n}\n", "UTF-8");
  function sequence(name) { return { getName: function () { return name; } }; }
  var declared = ["book_get", "books_list", "book_delete"];
  var owner = {
    getDirPath: function () { return String(dir.getAbsolutePath()); },
    getSequencesList: function () { var list = new java.util.ArrayList(); declared.forEach(function (name) { list.add(sequence(name)); }); return list; },
    getSequenceByName: function (name) { return declared.indexOf(String(name)) >= 0 ? sequence(name) : null; },
    getFlowEngine: function () { return { hasSource: function (path) { return /book_draft\.flow\.js$/.test(String(path)); } }; }
  };
  var engine = { isEngineMode: function () { return true; }, theApp: { databaseObjectsManager: {
    existsProject: function () { return false; }, getOriginalProjectByName: function (name) { return name === "orders" ? owner : null; }
  } } };
  var ctx = { lib: function () { return {}; }, callBlock: function (name, args) {
    var parts = String(args.requestable).split(".");
    if (parts.length === 2 && declared.indexOf(parts[1]) >= 0) return { answer: parts[1] };
    var error = new Error("Unknown Convertigo requestable: " + args.requestable);
    error.code = "UNKNOWN_REQUESTABLE";
    error.hint = "Use .Sequence, .Flow or .Connector.Transaction for the current project; use Project.Sequence or Project.Connector.Transaction for another project.";
    throw error;
  } };
  function refusal(args) {
    try { tools.execute(ctx, engine, "requestable-execute", args); } catch (error) { return error; }
    throw new Error("Expected a refusal for " + JSON.stringify(args));
  }
  assert(tools.execute(ctx, engine, "requestable-execute", { project: "orders", requestable: "book_get" }).result.answer === "book_get", "A declared Flow runs");

  // A Flow file that no promotion declared, then a working copy only: the refusal gives the code-promote call.
  [["book_create", "a saved file"], ["book_draft", "a working copy"]].forEach(function (item) {
    var error = refusal({ project: "orders", requestable: item[0] });
    assert(String(error.code) === "UNKNOWN_REQUESTABLE" && /not promoted/.test(String(error.message)) &&
      String(error.hint).indexOf('code-promote({project:"orders", name:"' + item[0] + '"})') >= 0,
      item[1] + " gives the code-promote call: " + error.message + " / " + error.hint);
    assert(error.details && error.details.next && error.details.next.tool === "code-promote" && error.details.next.arguments.name === item[0],
      item[1] + " details the next call: " + JSON.stringify(error.details));
  });
  var qualified = refusal({ requestable: "orders.book_create" });
  assert(String(qualified.hint).indexOf('code-promote({project:"orders", name:"book_create"})') >= 0, "a qualified name too: " + qualified.hint);

  // A guessed name: the close requestables of the project.
  var guessed = refusal({ project: "orders", requestable: "book_gets" });
  assert(String(guessed.code) === "UNKNOWN_REQUESTABLE" && String(guessed.hint).indexOf("orders.book_get") >= 0 && String(guessed.hint).indexOf("books_list") < 0,
    "a guessed name lists the close requestables: " + guessed.hint);
  assert(guessed.details && guessed.details.candidates && guessed.details.candidates[0] === "orders.book_get", "and details them: " + JSON.stringify(guessed.details));

  // A Flow read as a connector transaction (name.Flow): its requestable without suffix.
  var suffixed = refusal({ project: "orders", requestable: "orders.book_get.Flow" });
  assert(String(suffixed.hint).indexOf('"orders.book_get"') >= 0, "a .Flow suffix is given back without it: " + suffixed.hint);

  // An unknown name far from every requestable: the requestables of the project.
  var far = refusal({ project: "orders", requestable: "zzz" });
  assert(String(far.hint).indexOf("orders.book_get") >= 0 && String(far.hint).indexOf("orders.books_list") >= 0, "a far name lists the project requestables: " + far.hint);

  // The same engine refusal also reaches code-run through the common MCP error formatter.
  var realPackages = Packages;
  var mocked = { java: Packages.java, org: Packages.org, com: { twinsoft: { convertigo: { engine: { Engine: engine } } } } };
  var mcp = (function (Packages) { return eval(String(files.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8"))); })(mocked);
  function formatted(name) {
    return mcp.toolError({ jsonrpc: "2.0", id: 3, method: "tools/call", params: {
      name: "code-run", arguments: { project: "orders", name: name }
    } }, { code: "UNKNOWN_REQUESTABLE", message: "Unknown Convertigo requestable: orders." + name,
      hint: "Use .Sequence, .Flow or .Connector.Transaction" }).result.structuredContent.error;
  }
  var draftRun = formatted("book_draft");
  assert(/code-promote/.test(draftRun.hint) && draftRun.details.next.tool === "code-promote" &&
    draftRun.details.next.arguments.name === "book_draft", "code-run names promotion for a source draft");
  var unknownRun = formatted("missing");
  assert(unknownRun.hint === "Use .Sequence, .Flow or .Connector.Transaction" && !unknownRun.details,
    "an unknown source keeps the general engine refusal");
  print("requestable-unknown-draft OK (" + checks + " checks)");
} finally {
  files.deleteDirectory(dir);
}
