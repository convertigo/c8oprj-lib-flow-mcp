// Only call Flow blocks with one object containing named parameters.
const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "Sample FlowScript block that formats one greeting from typed inputs.",
  "icon": "mdi:card-text-outline",
  "visibility": "internal",
  "tags": [
    "sample",
    "flowscript",
    "block",
  ],
  "properties": {
    "name": {
      "kind": "template",
      "type": "string",
      "default": "World",
      "description": "Person name.",
    },
    "city": {
      "kind": "template",
      "type": "string",
      "default": "Paris",
      "description": "City name.",
    },
    "prefix": {
      "kind": "template",
      "type": "string",
      "default": "Hello",
      "description": "Greeting prefix.",
    },
  },
  "outputs": {
    "out": {
      "type": "string",
    },
  },
}

// c8o: Flow source (FlowScript, sourceVersion 2). Calls are Flow blocks; plain keys are business properties, $$ keys are engine attributes and slots.
// c8o: Edit in the Studio or with the Flow MCP code tools; patch with the returned revision.

const _flow = {
  "sourceVersion": 2,
}

function sample_formatGreeting({ input, config, result }) {
  return({
    $$id: "returnValue",
    value: `${input.prefix} ${input.name} from ${input.city}`,
  })
}
