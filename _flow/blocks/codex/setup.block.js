const _meta = {
  "sourceVersion": 2,
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

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function codex_setup({ input, config, result }) {
  local.endpoint = endpoint.current({
    $$id: "endpoint",
  })
  set({
    $$id: "mcpUrl",
    path: "local.mcpUrl",
    value: startsWith(input.mcpUrl, '{{') ? local.endpoint.flowMcpUrl : default(input.mcpUrl, local.endpoint.flowMcpUrl),
  })
  local.codexHome = path.resolveHome({
    $$id: "codexHome",
    path: startsWith(input.codexHome, '{{') ? '~/.codex' : default(input.codexHome, '~/.codex'),
  })
  local.skillPath = path.resolveHome({
    $$id: "skillPath",
    path: local.codexHome,
    suffix: "skills/convertigo-flow-mcp/SKILL.md",
  })
  local.backendSkillPath = path.resolveHome({
    $$id: "backendSkillPath",
    path: local.codexHome,
    suffix: "skills/convertigo-flow-backend/SKILL.md",
  })
  local.frontendSkillPath = path.resolveHome({
    $$id: "frontendSkillPath",
    path: local.codexHome,
    suffix: "skills/convertigo-flow-frontend-svelte/SKILL.md",
  })
  local.configPath = path.resolveHome({
    $$id: "configPath",
    path: local.codexHome,
    suffix: "config.toml",
  })
  local.skillTemplate = asset.read({
    $$id: "skillAsset",
    path: "_flow/resources/skills/convertigo-flow-mcp/SKILL.md",
  })
  local.backendSkillTemplate = asset.read({
    $$id: "backendSkillAsset",
    path: "_flow/resources/skills/convertigo-flow-backend/SKILL.md",
  })
  local.frontendSkillTemplate = asset.read({
    $$id: "frontendSkillAsset",
    path: "_flow/resources/skills/convertigo-flow-frontend-svelte/SKILL.md",
  })
  local.skillMarkdown = template.render({
    $$id: "skillMarkdown",
    template: "{{ local.skillTemplate }}",
  })
  local.backendSkillMarkdown = template.render({
    $$id: "backendSkillMarkdown",
    template: "{{ local.backendSkillTemplate }}",
  })
  local.frontendSkillMarkdown = template.render({
    $$id: "frontendSkillMarkdown",
    template: "{{ local.frontendSkillTemplate }}",
  })
  local.skillWrite = file.writeIfChanged({
    $$id: "writeSkill",
    path: local.skillPath,
    content: local.skillMarkdown,
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  local.backendSkillWrite = file.writeIfChanged({
    $$id: "writeBackendSkill",
    path: local.backendSkillPath,
    content: local.backendSkillMarkdown,
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  local.frontendSkillWrite = file.writeIfChanged({
    $$id: "writeFrontendSkill",
    path: local.frontendSkillPath,
    content: local.frontendSkillMarkdown,
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  local.configPatch = toml.ensureSection({
    $$id: "patchConfig",
    path: local.configPath,
    section: "mcp_servers.convertigo-flow",
    values: {
      url: local.mcpUrl,
      startup_timeout_sec: 60,
      enabled: true,
      bearer_token_env_var: "CONVERTIGO_MCP_TOKEN",
    },
    dryRun: input.dryRun == true || input.dryRun == 'true',
  })
  local.setup = json.object({
    $$id: "summary",
    $$fields: function () {
      json.field({
        $$id: "ok",
        key: "ok",
        value: true,
      })
      json.field({
        $$id: "skillName",
        key: "skillName",
        value: "ConvertigoFlowMCP",
      })
      json.field({
        $$id: "skillDirectoryName",
        key: "skillDirectoryName",
        value: "convertigo-flow-mcp",
      })
      json.field({
        $$id: "skillStatus",
        key: "skillStatus",
        value: local.skillWrite.status,
      })
      json.field({
        $$id: "backendSkillStatus",
        key: "backendSkillStatus",
        value: local.backendSkillWrite.status,
      })
      json.field({
        $$id: "frontendSkillStatus",
        key: "frontendSkillStatus",
        value: local.frontendSkillWrite.status,
      })
      json.field({
        $$id: "configStatus",
        key: "configStatus",
        value: local.configPatch.status,
      })
      json.field({
        $$id: "configServerName",
        key: "configServerName",
        value: "convertigo-flow",
      })
      json.field({
        $$id: "resolvedCodexHome",
        key: "resolvedCodexHome",
        value: local.codexHome,
      })
      json.field({
        $$id: "resolvedMcpUrl",
        key: "resolvedMcpUrl",
        value: local.mcpUrl,
      })
      json.field({
        $$id: "skillPath",
        key: "skillPath",
        value: local.skillPath,
      })
      json.field({
        $$id: "backendSkillPathResult",
        key: "backendSkillPath",
        value: local.backendSkillPath,
      })
      json.field({
        $$id: "frontendSkillPathResult",
        key: "frontendSkillPath",
        value: local.frontendSkillPath,
      })
      json.field({
        $$id: "configPath",
        key: "configPath",
        value: local.configPath,
      })
      json.field({
        $$id: "dryRun",
        key: "dryRun",
        value: input.dryRun == true || input.dryRun == 'true',
      })
      json.field({
        $$id: "warnings",
        key: "warnings",
        value: local.endpoint.warnings,
      })
      json.field({
        $$id: "nextSteps",
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
  return({
    $$id: "returnValue",
    value: local.setup,
  })
}
