// An unknown project is told with the projects of the server (it97, 13/11): a library absent from the server was searched
// about 300 times under guessed names (lib_flow_usermanager, lib_flow_auth...). The message gives the nearest names,
// then the projects of the server, and says that a library absent from the list is not installed.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/unknown-project-names-1113.js <lib_flow_mcp dir>
var root = new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
function read(path) { return String(FileUtils.readFileToString(new java.io.File(root, path), "UTF-8")); }
var mcp = eval(read("_flow/lib/mcp.js"));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var server = ["lib_flow_engine", "lib_flow_entity", "lib_flow_mcp", "lib_UserManager", "lib_OAuth", "PipelineCrm"];
var guessed = mcp.unknownProjectText("lib_flow_usermanager", server);
assert(/Did you mean lib_UserManager\?/.test(guessed), "a guessed name points to the installed library: " + guessed);
assert(/Projects of this server: PipelineCrm, lib_OAuth, lib_UserManager, lib_flow_engine/.test(guessed), "the projects are listed, sorted: " + guessed);
var absent = mcp.unknownProjectText("lib_UserManager", ["lib_flow_engine", "lib_flow_entity", "lib_flow_mcp"]);
assert(!/Did you mean/.test(absent) && /not installed: do not search it under other names/.test(absent), "an absent library is said absent: " + absent);
var many = []; for (var i = 0; i < 60; i++) many.push("p" + (i < 10 ? "0" : "") + i);
assert(/, … \(60\)\./.test(mcp.unknownProjectText("zz", many)), "a long list is bounded with its size");
assert(/This server has no project\./.test(mcp.unknownProjectText("x", [])), "an empty server is said");
assert(mcp.serverProjectNames().length === 0, "without a live engine the names are empty, never an error");
print("unknown-project-names-1113 OK (" + checks + " checks)");
