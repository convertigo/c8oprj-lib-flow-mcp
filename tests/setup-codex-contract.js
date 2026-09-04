var engineDir = arguments.length > 0 ? arguments[0] : "../lib_flow_engine/libs/flow";
var projectDir = arguments.length > 1 ? arguments[1] : ".";
var engineFile = new java.io.File(engineDir, "Engine.js");
var engineSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(engineFile, "UTF-8"));
var __flowEngineDir = String(new java.io.File(engineDir).getAbsolutePath());
var __flowProjectDir = String(new java.io.File(projectDir).getAbsolutePath());
var engine = eval(engineSource);

function assertTrue(condition, message) {
  if (!condition) throw new Error(message);
}

var flowFile = new java.io.File(projectDir, "libs/flows/_setupCodex.flow.js");
var flowSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(flowFile, "UTF-8"));
var setupBlockFile = new java.io.File(projectDir, "libs/flow/blocks/codex/setup.block.js");
var setupBlockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(setupBlockFile, "UTF-8"));
var routerSkillSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
  new java.io.File(projectDir, "libs/flow/resources/skills/convertigo-flow-mcp/SKILL.md"), "UTF-8"));
var frontendSkillSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
  new java.io.File(projectDir, "libs/flow/resources/skills/convertigo-flow-frontend-svelte/SKILL.md"), "UTF-8"));
var frontendGuideSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
  new java.io.File(projectDir, "libs/flow/resources/guide/frontend-svelte.md"), "UTF-8"));
assertTrue(setupBlockSource.indexOf('"bearer_token_env_var":"CONVERTIGO_MCP_TOKEN"') >= 0,
  "Flow Codex setup omitted the bearer token environment variable");
var codexHome = new java.io.File(java.lang.System.getProperty("java.io.tmpdir"),
  "convertigo-flow-codex-setup-contract");
var execution = JSON.parse(engine.run(JSON.stringify({
  flowSource: flowSource,
  includeTrace: false,
  input: {
    codexHome: String(codexHome.getAbsolutePath()),
    mcpUrl: "http://localhost:18080/convertigo/api/flow-mcp",
    dryRun: true
  }
})));
var response = execution.result;

assertTrue(execution.ok === true && response && response.ok === true,
  "Flow Codex setup did not complete: " + JSON.stringify(execution));
assertTrue(response.skillDirectoryName === "convertigo-flow-mcp",
  "Flow Codex setup returned the wrong primary skill");
assertTrue(response.configServerName === "convertigo-flow",
  "Flow Codex setup returned the wrong MCP server name");
assertTrue(response.dryRun === true, "Flow Codex setup ignored dryRun");
assertTrue(String(response.backendSkillPath || "").indexOf("convertigo-flow-backend/SKILL.md") >= 0,
  "Flow Codex setup omitted the backend specialist");
assertTrue(String(response.frontendSkillPath || "").indexOf("convertigo-flow-frontend-svelte/SKILL.md") >= 0,
  "Flow Codex setup omitted the frontend specialist");
assertTrue(routerSkillSource.indexOf("no-op path") >= 0,
  "Flow router must preserve the existing-project no-op fast path");
assertTrue(frontendSkillSource.indexOf("stop and answer") >= 0,
  "Flow frontend skill must stop after a proven unchanged result");
assertTrue(frontendGuideSource.indexOf("successful\nno-op") >= 0,
  "Flow frontend guide must document the existing-project no-op fast path");
assertTrue(!codexHome.exists(), "Flow Codex setup wrote files during dryRun");

print(JSON.stringify({
  ok: true,
  skill: response.skillDirectoryName,
  server: response.configServerName,
  backendSkillStatus: response.backendSkillStatus,
  frontendSkillStatus: response.frontendSkillStatus,
  configStatus: response.configStatus
}));
