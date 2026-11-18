// Only call Flow blocks with one object containing named parameters.
const _meta = {
  "sourceVersion": 3,
  "version": 1,
  "description": "Sample FlowScript block that formats one greeting from typed inputs.",
  "summary": "greeting of {{name}}",
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

const _flow = { sourceVersion: 3 }

function sample_formatGreeting({ input, config, result }) {
  returnValue: return `${input.prefix} ${input.name} from ${input.city}`
}
