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

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function sample_formatGreeting({ input, config, result }) {
  return({
    $$id: "returnValue",
    value: `${input.prefix} ${input.name} from ${input.city}`,
  })
}
