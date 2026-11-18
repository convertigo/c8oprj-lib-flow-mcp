const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Installs or updates local Codex onboarding for Convertigo Flow MCP.",
  "icon": "mdi:robot-outline",
  "properties": {
    "codexHome": {
      "label": "codexHome",
      "kind": "template",
      "type": "string",
      "description": "Optional Codex home directory. Defaults to ~/.codex."
    },
    "mcpUrl": {
      "label": "mcpUrl",
      "kind": "template",
      "type": "string",
      "description": "Optional Flow MCP endpoint URL. Defaults to the local /convertigo/api/flow-mcp endpoint."
    },
    "dryRun": {
      "label": "dryRun",
      "kind": "expression",
      "type": "boolean",
      "default": false,
      "description": "Preview the generated skill and config patch without writing files."
    },
    "out": {
      "label": "out",
      "kind": "path",
      "mode": "write",
      "default": "local.setup",
      "description": "Scope path receiving the setup result."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "ok": {
          "type": "boolean"
        },
        "skillName": {
          "type": "string"
        },
        "skillDirectoryName": {
          "type": "string"
        },
        "skillStatus": {
          "type": "string"
        },
        "backendSkillStatus": {
          "type": "string"
        },
        "frontendSkillStatus": {
          "type": "string"
        },
        "configStatus": {
          "type": "string"
        },
        "configServerName": {
          "type": "string"
        },
        "resolvedCodexHome": {
          "type": "string"
        },
        "resolvedMcpUrl": {
          "type": "string"
        },
        "skillPath": {
          "type": "string"
        },
        "backendSkillPath": {
          "type": "string"
        },
        "frontendSkillPath": {
          "type": "string"
        },
        "configPath": {
          "type": "string"
        },
        "dryRun": {
          "type": "boolean"
        },
        "warnings": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "nextSteps": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    }
  },
  "private": true,
  "tags": [
    "codex",
    "setup"
  ]
}

const _flow = { sourceVersion: 3 }

function codex_setup({ input, config, result }) {
  local.endpoint = endpoint.current({})
  local.mcpUrl = startsWith(input.mcpUrl, '{{') ? local.endpoint.flowMcpUrl :
    flow.default(input.mcpUrl, local.endpoint.flowMcpUrl)
  local.codexHome = path.resolveHome({
    path: startsWith(input.codexHome, '{{') ? '~/.codex' : flow.default(input.codexHome, '~/.codex'),
  })
  local.skillPath = path.resolveHome({ path: local.codexHome, suffix: "skills/convertigo-flow-mcp/SKILL.md" })
  local.backendSkillPath = path.resolveHome({
    path: local.codexHome,
    suffix: "skills/convertigo-flow-backend/SKILL.md",
  })
  local.frontendSkillPath = path.resolveHome({
    path: local.codexHome,
    suffix: "skills/convertigo-flow-frontend-svelte/SKILL.md",
  })
  local.configPath = path.resolveHome({ path: local.codexHome, suffix: "config.toml" })
  skillAsset: local.skillTemplate = asset.read({ path: "_flow/resources/skills/convertigo-flow-mcp/SKILL.md" })
  backendSkillAsset: local.backendSkillTemplate = asset.read({
    path: "_flow/resources/skills/convertigo-flow-backend/SKILL.md",
  })
  frontendSkillAsset: local.frontendSkillTemplate = asset.read({
    path: "_flow/resources/skills/convertigo-flow-frontend-svelte/SKILL.md",
  })
  local.skillMarkdown = template.render({ template: local.skillTemplate })
  local.backendSkillMarkdown = template.render({ template: local.backendSkillTemplate })
  local.frontendSkillMarkdown = template.render({ template: local.frontendSkillTemplate })
  writeSkill: local.skillWrite = file.writeIfChanged({
    path: local.skillPath,
    content: local.skillMarkdown,
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  writeBackendSkill: local.backendSkillWrite = file.writeIfChanged({
    path: local.backendSkillPath,
    content: local.backendSkillMarkdown,
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  writeFrontendSkill: local.frontendSkillWrite = file.writeIfChanged({
    path: local.frontendSkillPath,
    content: local.frontendSkillMarkdown,
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  patchConfig: local.configPatch = toml.ensureSection({
    path: local.configPath,
    section: "mcp_servers.convertigo-flow",
    values: { url: local.mcpUrl, startup_timeout_sec: 60, enabled: true, bearer_token_env_var: "CONVERTIGO_MCP_TOKEN" },
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  summary: json.object({
    $$out: "local.setup",
    $$fields: function () {
      ok: json.field({ key: "ok", value: true })
      skillName: json.field({ key: "skillName", value: "ConvertigoFlowMCP" })
      skillDirectoryName: json.field({ key: "skillDirectoryName", value: "convertigo-flow-mcp" })
      skillStatus: json.field({ key: "skillStatus", value: local.skillWrite.status })
      backendSkillStatus: json.field({ key: "backendSkillStatus", value: local.backendSkillWrite.status })
      frontendSkillStatus: json.field({ key: "frontendSkillStatus", value: local.frontendSkillWrite.status })
      configStatus: json.field({ key: "configStatus", value: local.configPatch.status })
      configServerName: json.field({ key: "configServerName", value: "convertigo-flow" })
      resolvedCodexHome: json.field({ key: "resolvedCodexHome", value: local.codexHome })
      resolvedMcpUrl: json.field({ key: "resolvedMcpUrl", value: local.mcpUrl })
      json.field({ key: "skillPath", value: local.skillPath })
      backendSkillPathResult: json.field({ key: "backendSkillPath", value: local.backendSkillPath })
      frontendSkillPathResult: json.field({ key: "frontendSkillPath", value: local.frontendSkillPath })
      json.field({ key: "configPath", value: local.configPath })
      dryRun: json.field({ key: "dryRun", value: input.dryRun == true || input.dryRun == 'true' })
      warnings: json.field({ key: "warnings", value: local.endpoint.warnings })
      nextSteps: json.field({
        key: "nextSteps",
        value: [
          "Restart Codex to pick up skill or MCP configuration changes.",
          "Start a fresh Codex session and use the convertigo-flow-mcp skill for Flow work.",
          "Reuse the convertigo-flow-backend and convertigo-flow-frontend-svelte specialists across implementation lots.",
          "Use the convertigo-flow MCP server for Flow-native project authoring.",
        ],
      })
    },
  })
  returnValue: return local.setup
}
