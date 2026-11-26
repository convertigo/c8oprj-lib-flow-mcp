var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var engineSource = String(FileUtils.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);
load(new java.io.File(projectDir, "tests/support/guide-navigation.js"));
var flowSource = String(FileUtils.readFileToString(
  new java.io.File(projectDir, "_flow/flows/McpServer.flow.js"), "UTF-8"));

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

function call(id, method, params) {
  var execution = JSON.parse(engine.run(JSON.stringify({
    flowSource: flowSource,
    includeTrace: false,
    config: {},
    input: { request: JSON.stringify({ jsonrpc: "2.0", id: id, method: method, params: params || {} }) }
  })));
  assertTrue(execution.ok === true, method + " failed: " + JSON.stringify(execution).substring(0, 500));
  return execution.result;
}

function readText(relativePath) {
  return String(FileUtils.readFileToString(new java.io.File(projectDir, relativePath), "UTF-8"));
}

var guideDir = new java.io.File(projectDir, "_flow/resources/guide");
var guideFiles = guideDir.list().filter(function (name) {
  return String(name).endsWith(".md");
}).map(String).sort();
assertTrue(guideFiles.length >= 12, "Expected the Flow guides, found " + guideFiles.length);

// resources/list: every guide, with its H1 as name and its one-line summary as description.
var listed = [], cursor = null, pages = 0;
do {
  var page = call(1, "resources/list", cursor ? {cursor:cursor} : {}).result;
  listed = listed.concat(page.resources);
  cursor = page.nextCursor;
  assertTrue(++pages < 30, "resources/list cursor must terminate");
} while (cursor);
guideFiles.forEach(function (file) {
  var slug = file.replace(/\.md$/, "");
  var resource = listed.filter(function (entry) { return entry.uri === "flow://guide/" + slug; })[0];
  assertTrue(resource, "resources/list does not expose flow://guide/" + slug);
  var lines = readText("_flow/resources/guide/" + file).split(/\r?\n/).filter(function (line) {
    return line.trim() !== "";
  });
  assertTrue(/^# \S/.test(lines[0]), file + " must start with an H1");
  assertTrue(resource.name === lines[0].substring(2).trim(), file + " name must be its H1: " + resource.name);
  // The description is the line under the H1, then the guide size in KB computed from its bytes.
  var bytes = Number(new java.io.File(guideDir, file).length());
  var tenths = Math.max(1, Math.round(bytes / 100));
  var sizeLabel = Math.floor(tenths / 10) + "." + (tenths % 10) + " KB";
  var description = String(resource.description || "");
  assertTrue(resource.size === bytes, file + " resources/list size must be its byte length " + bytes + ": " + resource.size);
  assertTrue(description === lines[1].trim() + " (" + sizeLabel + ")",
    file + " description must be the line under the H1 then (" + sizeLabel + "): " + description);
  var summary = lines[1].trim();
  assertTrue(summary.length >= 40 && /\.$/.test(summary) && summary.charAt(0) !== "-",
    file + " needs a one-line summary sentence under its H1, got: " + summary);
  // Under 16 000 characters Claude Code, Codex and Vibe show a guide whole instead of saving it to a file.
  var characters = readText("_flow/resources/guide/" + file).length;
  assertTrue(characters < 16000, file + " has " + characters + " characters, not under 16 000: split it into sub-guides");
});

// Short guides are served whole; long skills are paged with an exact continuation.
guideFiles.forEach(function (file, index) {
  var uri = "flow://guide/" + file.replace(/\.md$/, "");
  var response = call(10 + index, "resources/read", { uri: uri });
  assertTrue(response.result && response.result.contents && response.result.contents.length === 1,
    "resources/read failed for " + uri + ": " + JSON.stringify(response).substring(0, 300));
  var expected = readText("_flow/resources/guide/" + file);
  var text = response.result.contents[0].text;
  assertTrue(sameGuideText(text, expected), uri + " was not returned whole: " + text.length + " of " + expected.length + " characters");
  assertTrue(response.result.contents[0].mimeType === "text/markdown", uri + " must be text/markdown");
});
var skill = call(40, "resources/read", { uri: "flow://skills/convertigo-flow-mcp/SKILL" });
var inputGuide = call(39, "resources/read", { uri: "flow://guide/authoring/data" });
assertTrue(/FLOW_INPUT_REQUIRED/.test(inputGuide.result.contents[0].text) &&
  /throw \{ code, message \}/.test(inputGuide.result.contents[0].text) &&
  /requester \(\.json, SDK, frontbuilder\)[\s\S]*200 and the `error` envelope/.test(inputGuide.result.contents[0].text),
  "authoring data guide must explain application-owned input errors");
assertTrue(skill.result.contents[0].text === readText("_flow/resources/skills/convertigo-flow-mcp/SKILL.md").slice(0,6000) &&
  skill.result.contents[0].continuation.params.startChar === 6000,
  "Long skills must offer a resource continuation");
var unknown = call(41, "resources/read", { uri: "flow://guide/does-not-exist" });
assertTrue(unknown.error && unknown.error.data && unknown.error.data.code === "FLOW_MCP_RESOURCE_ERROR",
  "Unknown resources must return FLOW_MCP_RESOURCE_ERROR");

// flow-resource-get reads the same guides and skills without project, for clients without resources/read (Vibe).
function tool(id, name, args) {
  var response = call(id, "tools/call", { name: name, arguments: args });
  assertTrue(response.result && response.result.structuredContent, name + " failed: " + JSON.stringify(response).substring(0, 500));
  return response.result.structuredContent;
}
var startGuide = tool(42, "flow-resource-get", { uri: "flow://guide/start" });
// the relay carries the tree of start once (mcp.js guideNavigation)
assertTrue(startGuide.ok === true && sameGuideText(startGuide.text, readText("_flow/resources/guide/start.md")) &&
  startGuide.text.split("\n## Guide tree\n").length === 2 && startGuide.source === "resources/read",
  "flow-resource-get must read flow://guide/start whole without project: " + JSON.stringify(startGuide).substring(0, 400));
var routerSkill = tool(43, "flow-resource-get", { uri: "flow://skills/convertigo-flow-mcp/SKILL" });
assertTrue(routerSkill.text === readText("_flow/resources/skills/convertigo-flow-mcp/SKILL.md").slice(0,6000) &&
  routerSkill.continuation.arguments.startChar === 6000, "flow-resource-get must page a long skill without project");
var missingGuide = tool(44, "flow-resource-get", { uri: "flow://guide/does-not-exist" });
assertTrue(missingGuide.error && missingGuide.error.code === "UNKNOWN_RESOURCE", "an unknown guide is UNKNOWN_RESOURCE: " + JSON.stringify(missingGuide));
var projectPath = tool(45, "flow-resource-get", { path: "_flow/engine.yaml" });
assertTrue(projectPath.error && /requires an explicit project/.test(projectPath.error.message), "a project resource still requires project: " + JSON.stringify(projectPath));
// An agent that has not created its application yet learns to bootstrap it instead of retrying without project.
var catalogWithoutProject = tool(46, "flow-catalog", { query: "sql" });
assertTrue(catalogWithoutProject.error && /requires an explicit project/.test(catalogWithoutProject.error.message) &&
	/create it first with flow-project-bootstrap\(\{ project:"<NewProject>" \}\)/.test(catalogWithoutProject.error.message),
	"flow-catalog without project names the bootstrap: " + JSON.stringify(catalogWithoutProject));

// Guides name only tools advertised by tools/list, and show only the current source dialect.
var tools = {};
call(50, "tools/list").result.tools.forEach(function (tool) { tools[tool.name] = true; });
// flow-source-sync is advertised by the sources profile only (X-Convertigo-Source-Mode: sources, flow://guide/sources).
tools["flow-source-sync"] = true;
// Words that look like tool names but are values ("runtime": "flow-svelte").
var notTools = { "flow-svelte": true };
var toolPattern = /(^|[\s`(\[{,"'])((?:code|flow|authoring|frontend-svelte)-[a-z][a-z0-9-]*[a-z0-9])/g;
assertTrue(!/`flow-(?:tree|get)`/.test(routerSkill.text), "The router skill must not advertise private tools");
guideFiles.forEach(function (file) {
  var text = readText("_flow/resources/guide/" + file);
  var match;
  while ((match = toolPattern.exec(text))) {
    assertTrue(tools[match[2]] === true || notTools[match[2]] === true, file + " names a tool that tools/list does not advertise: " + match[2]);
  }
  var fence = /```(javascript|svelte)\n([\s\S]*?)```/g;
  while ((match = fence.exec(text))) {
    var code = match[2];
    assertTrue(!/\)[ \t]*;[ \t]*\S/.test(code) && !/;[ \t]*(local|result|var|const|let)\b/.test(code),
      file + " joins Flow statements with ';' on one line:\n" + code);
    assertTrue(!/\bvar \w+ = [a-z]+\.[A-Za-z.]+\(\{/.test(code), file + " captures a block with var instead of an assignment:\n" + code);
    if (match[1] === "svelte") {
      assertTrue(!/<[A-Z][A-Za-z]*\s+id=/.test(code), file + " uses id= as a Flow Svelte node identity; use $$id:\n" + code);
      if (code.indexOf("<FlowComponent") !== -1) {
        assertTrue(/sourceVersion: 2/.test(code), file + " shows a Flow Svelte document without sourceVersion: 2");
      }
    }
  }
  assertTrue(!/sidecar/i.test(text) && text.indexOf("libs/flow") === -1 && text.indexOf(".front.json") === -1,
    file + " mentions a removed source layout");
});

// Register workspace directories with the host double. App has no project references.
var Engine = Packages.com.twinsoft.convertigo.engine.Engine;
var Project = Packages.com.twinsoft.convertigo.beans.core.Project;
var previousApp = Engine.theApp;
var previousLog = Engine.logEngine;
var appDir = java.nio.file.Files.createTempDirectory("mcp-guide-catalog-").toFile();
try {
  var sqlDir = new java.io.File(projectDir, "../lib_flow_sql").getCanonicalFile();
  if (!sqlDir.isDirectory()) sqlDir = new java.io.File(projectDir, "../c8oprj-lib-flow-sql").getCanonicalFile();
  assertTrue(sqlDir.isDirectory(), "The sibling SQL library is required for provider and guide checks");
  var target = { project: "App", projectDir: String(appDir) };
  var sqlBlocks = ["sql.query", "sql.write", "sql.transaction"];
  var blockErrors = sqlBlocks.concat(["sql.errorOutput"]).map(function (name, i) {
    return tool(301 + i, "flow-block-get", Object.assign({ name: name }, target)).error;
  });
  var filters = [{ query: "sql.query" }, { namespace: "sql" }];
  var catalogs = filters.map(function (filter, i) {
    return tool(310 + i, "flow-catalog", Object.assign({ detail: "summary" }, filter, target));
  });
  var projects = {};
  function projectAt(name, dir) {
    var bean = new JavaAdapter(Project, { getDirPath: function () { return String(dir.getPath()); } });
    bean.setName(name);
    bean.isSubLoaded = true;
    projects[name] = bean;
  }
  projectAt("App", appDir);
  projectAt("lib_flow_sql", sqlDir);
  var privateDir = new java.io.File(appDir, "private-provider");
  ["private: true", '"private": true', "'private' /* flag */ : true", 'visibility: "private"', 'visibility: "internal"'].forEach(function (flag, i) {
    FileUtils.writeStringToFile(new java.io.File(privateDir, "_flow/blocks/sql/aaa" + i + ".block.js"),
      "const _meta = { sourceVersion: 2, " + flag + " };\nfunction hidden({ input, result }) {}\n", "UTF-8");
  });
  FileUtils.writeStringToFile(new java.io.File(privateDir, "_flow/blocks/discovery/publicBody.block.js"),
    "const _meta = { sourceVersion: 3, description: 'Public block' };\n" +
    "function publicBody({ input, result }) {\n  return {private: true}\n}\n", "UTF-8");
  projectAt("PrivateBlocks", privateDir);
  Engine.logEngine = Packages.org.apache.log4j.Logger.getLogger("mcp-guide-catalog-test");
  Engine.theApp = new Engine();
  Engine.theApp.databaseObjectsManager = new JavaAdapter(Packages.com.twinsoft.convertigo.engine.DatabaseObjectsManager, {
    getAllProjectNamesList: function () {
      var names = new java.util.ArrayList();
      Object.keys(projects).forEach(function (name) { names.add(name); });
      return names;
    },
    getOriginalProjectByName: function (name) { return projects[String(name)] || null; }
  });
  // Use a fresh library instance so the workspace index reflects the host double.
  var mcp = eval(readText("_flow/lib/mcp.js"));
  var laterPages = 0;
  var ctx = { blockList: function (args) {
    assertTrue(args.origin === "project" && args.includePrivate === false && args.includeInternal === false,
      "The workspace index must use the public project catalog");
    if (args.cursor) laterPages++;
    var previousDir = __flowProjectDir, host = Engine.theApp;
    try {
      Engine.theApp = null;
      __flowProjectDir = args.projectDir;
      return JSON.parse(engine.catalog(JSON.stringify(Object.assign({}, args, { limit: 2 }))));
    } finally {
      __flowProjectDir = previousDir;
      Engine.theApp = host;
    }
  } };
  var sqlGuide = "flow://lib/lib_flow_sql/sql";
  function request(name, args) {
    return { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: name, arguments: Object.assign({}, target, args) } };
  }
  sqlBlocks.forEach(function (name, i) {
    var missing = mcp.toolError(request("flow-block-get", { name: name }), blockErrors[i], ctx).result.structuredContent.error;
    assertTrue(missing.code === "UNKNOWN_BLOCK" && missing.details.workspaceProviders[0].block === name &&
      missing.details.workspaceProviders[0].project === "lib_flow_sql" && missing.details.workspaceGuides.indexOf(sqlGuide) >= 0 &&
      /flow-project-reference\(\{project:"App", reference:"lib_flow_sql"\}\)/.test(missing.hint),
      name + " must identify the missing SQL reference and the provider guide: " + JSON.stringify(missing));
  });
  var privateBlock = mcp.toolError(request("flow-block-get", { name: "sql.errorOutput" }), blockErrors[sqlBlocks.length], ctx).result.structuredContent.error;
  assertTrue(privateBlock.code === "UNKNOWN_BLOCK" && !privateBlock.details.workspaceProviders &&
    privateBlock.hint.indexOf("flow-project-reference") < 0, "Block lookup must not recommend referencing a private SQL block");
  filters.forEach(function (filter, i) {
    var catalog = mcp.toolResponse(request("flow-catalog", filter), catalogs[i], ctx).result.structuredContent;
    assertTrue(catalog.blocks.length === 0 && catalog.workspaceProviders.length &&
      catalog.workspaceProviders.every(function (provider) {
        return provider.project === "lib_flow_sql" && /^sql\./.test(provider.block) && provider.block !== "sql.errorOutput";
      }) &&
      (i !== 0 || catalog.workspaceProviders.some(function (provider) { return provider.block === "sql.query"; })) &&
      catalog.workspaceGuides.indexOf(sqlGuide) >= 0 && /flow-project-reference/.test(catalog.workspaceNext),
      "Catalog must describe unreferenced SQL blocks for " + JSON.stringify(filter));
  });
  var publicBody = mcp.toolResponse(request("flow-catalog", { namespace: "discovery" }), { blocks: [] }, ctx).result.structuredContent;
  assertTrue(laterPages > 0 && publicBody.workspaceProviders[0].block === "discovery.publicBody",
    "Workspace discovery follows catalog pages and ignores data keys in public block bodies");
  // A partial index (a later catalog page failed) serves its own call only; a complete index is cached.
  var mcpPartial = eval(readText("_flow/lib/mcp.js"));
  var listCalls = 0, failLaterPages = true;
  var flaky = { blockList: function (args) {
    listCalls++;
    if (failLaterPages && args.cursor) throw new Error("catalog page unavailable");
    return ctx.blockList(args);
  } };
  function discoverSql() { return mcpPartial.toolResponse(request("flow-catalog", { namespace: "sql" }), { blocks: [] }, flaky); }
  discoverSql();
  var afterPartial = listCalls;
  failLaterPages = false;
  discoverSql();
  var afterComplete = listCalls;
  discoverSql();
  assertTrue(afterPartial > 0 && afterComplete > afterPartial && listCalls === afterComplete,
    "A partial workspace block index must not be cached, a complete one must: " + [afterPartial, afterComplete, listCalls]);
  function cliResource(id, uri) {
    var reply = call(id, "tools/call", { name: "flow-resource-get", arguments: { uri: uri, format: "text" } }).result;
    assertTrue(reply && !reply.isError && reply.content.length > 0, "CLI cannot read " + uri);
    return reply.content.map(function (item) { return item.text; }).join("\n\n");
  }
  var cliSkill = cliResource(320, "flow://skills/convertigo-flow-cli/SKILL");
  assertTrue(cliSkill.length <= 4500, "CLI skill exceeds its size budget");
  var guideCommand = /`c8o guide(?: ([a-z][\w/-]*))?`/g, cited = {}, command;
  while ((command = guideCommand.exec(cliSkill))) cited[command[1] || "start"] = true;
  var expectedGuides = ["start", "sources", "sql", "authoring/source", "authoring/data", "entities", "frontend-svelte/loop"];
  assertTrue(expectedGuides.every(function (name) { return cited[name]; }), "The CLI skill is missing a family guide");
  Object.keys(cited).forEach(function (name, i) {
    var uri = name === "sql" ? sqlGuide : "flow://guide/" + name;
    var served = cliResource(321 + i, "flow://guide/" + name);
    var expected = name === "sql" ? String(FileUtils.readFileToString(new java.io.File(sqlDir, "_flow/resources/guide/sql.md"), "UTF-8"))
      : readText("_flow/resources/guide/" + name + ".md");
    if (name === "sql") {
      assertTrue(served.indexOf("Note: flow://guide/sql is read as " + sqlGuide) === 0, "The CLI resolves the SQL guide alias");
      served = served.replace(/^Note:[^\n]*\n+/, "");
    }
    assertTrue(sameGuideText(served, expected), "c8o guide " + name + " must read " + uri);
  });
} finally {
  Engine.theApp = previousApp;
  Engine.logEngine = previousLog;
  FileUtils.deleteDirectory(appDir);
}

print(JSON.stringify({ ok: true, guides: guideFiles.length, tools: Object.keys(tools).length }));
