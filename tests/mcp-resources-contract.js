var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/_flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var engineSource = String(FileUtils.readFileToString(new java.io.File(engineDir, "Engine.js"), "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);
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
var listed = call(1, "resources/list").result.resources;
guideFiles.forEach(function (file) {
  var slug = file.replace(/\.md$/, "");
  var resource = listed.filter(function (entry) { return entry.uri === "flow://guide/" + slug; })[0];
  assertTrue(resource, "resources/list does not expose flow://guide/" + slug);
  var lines = readText("_flow/resources/guide/" + file).split(/\r?\n/).filter(function (line) {
    return line.trim() !== "";
  });
  assertTrue(/^# \S/.test(lines[0]), file + " must start with an H1");
  assertTrue(resource.name === lines[0].substring(2).trim(), file + " name must be its H1: " + resource.name);
  var description = String(resource.description || "");
  assertTrue(description === lines[1].trim(), file + " description must be the line under the H1: " + description);
  assertTrue(description.length >= 40 && /\.$/.test(description) && description.charAt(0) !== "-",
    file + " needs a one-line summary sentence under its H1, got: " + description);
});

// resources/read: guides and skills are served whole, never truncated.
guideFiles.forEach(function (file, index) {
  var uri = "flow://guide/" + file.replace(/\.md$/, "");
  var response = call(10 + index, "resources/read", { uri: uri });
  assertTrue(response.result && response.result.contents && response.result.contents.length === 1,
    "resources/read failed for " + uri + ": " + JSON.stringify(response).substring(0, 300));
  var expected = readText("_flow/resources/guide/" + file);
  var text = response.result.contents[0].text;
  assertTrue(text === expected, uri + " was not returned whole: " + text.length + " of " + expected.length + " characters");
  assertTrue(response.result.contents[0].mimeType === "text/markdown", uri + " must be text/markdown");
});
var skill = call(40, "resources/read", { uri: "flow://skills/convertigo-flow-mcp/SKILL" });
assertTrue(skill.result.contents[0].text === readText("_flow/resources/skills/convertigo-flow-mcp/SKILL.md"),
  "Skills must be returned whole by resources/read");
var unknown = call(41, "resources/read", { uri: "flow://guide/does-not-exist" });
assertTrue(unknown.error && unknown.error.data && unknown.error.data.code === "FLOW_MCP_RESOURCE_ERROR",
  "Unknown resources must return FLOW_MCP_RESOURCE_ERROR");

// Guides name only tools advertised by tools/list, and show only the current source dialect.
var tools = {};
call(50, "tools/list").result.tools.forEach(function (tool) { tools[tool.name] = true; });
// Words that look like tool names but are values ("runtime": "flow-svelte").
var notTools = { "flow-svelte": true };
var toolPattern = /(^|[\s`(\[{,"'])((?:code|flow|authoring|frontend-svelte)-[a-z][a-z0-9-]*[a-z0-9])/g;
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

print(JSON.stringify({ ok: true, guides: guideFiles.length, tools: Object.keys(tools).length }));
