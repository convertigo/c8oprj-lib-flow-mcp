var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/libs/flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var engineSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
  new java.io.File(engineDir, "Engine.js"), "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);
var flowSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
  new java.io.File(projectDir, "libs/flows/McpServer.flow.js"), "UTF-8"));

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

var execution = JSON.parse(engine.run(JSON.stringify({
  flowSource: flowSource,
  includeTrace: false,
  input: {
    request: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
  }
})));
assertTrue(execution.ok === true, "McpServer internal execution failed: " + JSON.stringify(execution));
assertTrue(execution.result && execution.result.result && execution.result.result.serverInfo,
  "McpServer internal authentication bypass did not reach initialize: " + JSON.stringify(execution.result));

var adminExecution = JSON.parse(engine.run(JSON.stringify({
  flowSource: flowSource,
  includeTrace: false,
  input: {
    request: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "flow-token-status", arguments: {} }
    })
  }
})));
assertTrue(adminExecution.ok === true,
  "Flow token admin route failed: " + String(adminExecution.error || "unknown error"));
assertTrue(adminExecution.result && adminExecution.result.result &&
  adminExecution.result.result.structuredContent &&
  adminExecution.result.result.structuredContent.status === "forbidden",
  "Hidden Flow token admin tool was not routed to its block");

var listExecution = JSON.parse(engine.run(JSON.stringify({
  flowSource: flowSource,
  includeTrace: false,
  input: {
    request: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} })
  }
})));
assertTrue(listExecution.ok === true && listExecution.result && listExecution.result.result &&
  listExecution.result.result.tools && typeof listExecution.result.result.tools.length !== "undefined",
  "Flow MCP tools/list failed while checking private token operations");
assertTrue(JSON.stringify(listExecution.result.result.tools).indexOf("flow-token-") === -1,
  "Flow token administration operations leaked into tools/list");

print(JSON.stringify({
  ok: true,
  server: execution.result.result.serverInfo.name,
  adminRoute: adminExecution.result.result.structuredContent.status,
  adminToolsHidden: true
}));
