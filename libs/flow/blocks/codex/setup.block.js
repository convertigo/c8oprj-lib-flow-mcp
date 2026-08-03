const _meta = {
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

function codex_setup({ input, config, result }) {
  const endpoint = endpoint.current({ id: "endpoint" })
  const mcpUrl = startsWith(input.mcpUrl, '{{') ? endpoint.flowMcpUrl : default(input.mcpUrl, endpoint.flowMcpUrl)
  const codexHome = path.resolveHome({ id: "codexHome", path: startsWith(input.codexHome, '{{') ? '~/.codex' : default(input.codexHome, '~/.codex') })
  const skillPath = path.resolveHome({ id: "skillPath", path: codexHome, suffix: "skills/convertigo-flow-mcp/SKILL.md" })
  const backendSkillPath = path.resolveHome({ id: "backendSkillPath", path: codexHome, suffix: "skills/convertigo-flow-backend/SKILL.md" })
  const frontendSkillPath = path.resolveHome({ id: "frontendSkillPath", path: codexHome, suffix: "skills/convertigo-flow-frontend-svelte/SKILL.md" })
  const configPath = path.resolveHome({ id: "configPath", path: codexHome, suffix: "config.toml" })
  const skillTemplate = asset.read({ id: "skillAsset", path: "libs/flow/resources/skills/convertigo-flow-mcp/SKILL.md" })
  const backendSkillTemplate = asset.read({ id: "backendSkillAsset", path: "libs/flow/resources/skills/convertigo-flow-backend/SKILL.md" })
  const frontendSkillTemplate = asset.read({ id: "frontendSkillAsset", path: "libs/flow/resources/skills/convertigo-flow-frontend-svelte/SKILL.md" })
  const skillMarkdown = template.render({ id: "skillMarkdown", template: "{{ local.skillTemplate }}" })
  const backendSkillMarkdown = template.render({ id: "backendSkillMarkdown", template: "{{ local.backendSkillTemplate }}" })
  const frontendSkillMarkdown = template.render({ id: "frontendSkillMarkdown", template: "{{ local.frontendSkillTemplate }}" })
  const skillWrite = file.writeIfChanged({ id: "writeSkill", path: skillPath, content: skillMarkdown, dryRun: input.dryRun == true || input.dryRun == 'true' })
  const backendSkillWrite = file.writeIfChanged({ id: "writeBackendSkill", path: backendSkillPath, content: backendSkillMarkdown, dryRun: input.dryRun == true || input.dryRun == 'true' })
  const frontendSkillWrite = file.writeIfChanged({ id: "writeFrontendSkill", path: frontendSkillPath, content: frontendSkillMarkdown, dryRun: input.dryRun == true || input.dryRun == 'true' })
  const configPatch = toml.ensureSection({ id: "patchConfig", path: configPath, section: "mcp_servers.convertigo-flow", values: {"url":"{{ local.mcpUrl }}","startup_timeout_sec":60,"enabled":true}, dryRun: input.dryRun == true || input.dryRun == 'true' })
  const setup = json.object({ id: "summary" }) {
    json.field({ id: "ok", key: "ok", value: true })
    json.field({ id: "skillName", key: "skillName", value: "ConvertigoFlowMCP" })
    json.field({ id: "skillDirectoryName", key: "skillDirectoryName", value: "convertigo-flow-mcp" })
    json.field({ id: "skillStatus", key: "skillStatus", value: skillWrite.status })
    json.field({ id: "backendSkillStatus", key: "backendSkillStatus", value: backendSkillWrite.status })
    json.field({ id: "frontendSkillStatus", key: "frontendSkillStatus", value: frontendSkillWrite.status })
    json.field({ id: "configStatus", key: "configStatus", value: configPatch.status })
    json.field({ id: "configServerName", key: "configServerName", value: "convertigo-flow" })
    json.field({ id: "resolvedCodexHome", key: "resolvedCodexHome", value: codexHome })
    json.field({ id: "resolvedMcpUrl", key: "resolvedMcpUrl", value: mcpUrl })
    json.field({ id: "skillPath", key: "skillPath", value: skillPath })
    json.field({ id: "backendSkillPathResult", key: "backendSkillPath", value: backendSkillPath })
    json.field({ id: "frontendSkillPathResult", key: "frontendSkillPath", value: frontendSkillPath })
    json.field({ id: "configPath", key: "configPath", value: configPath })
    json.field({ id: "dryRun", key: "dryRun", value: input.dryRun == true || input.dryRun == 'true' })
    json.field({ id: "warnings", key: "warnings", value: endpoint.warnings })
    json.field({ id: "nextSteps", key: "nextSteps", value: ["Restart Codex to pick up skill or MCP configuration changes.","Start a fresh Codex session and use the convertigo-flow-mcp skill for Flow work.","Reuse the convertigo-flow-backend and convertigo-flow-frontend-svelte specialists across implementation lots.","Use the convertigo-flow MCP server for Flow-native project authoring."] })
  }
  return setup
}
