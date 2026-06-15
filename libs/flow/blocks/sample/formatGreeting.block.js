const _meta = {
  "version": 1,
  "description": "Sample FlowScript block that formats one greeting from typed inputs.",
  "icon": "mdi:card-text-outline",
  "visibility": "internal",
  "tags": [
    "sample",
    "flowscript",
    "block"
  ],
  "properties": {
    "name": {
      "kind": "template",
      "type": "string",
      "default": "World",
      "description": "Person name."
    },
    "city": {
      "kind": "template",
      "type": "string",
      "default": "Paris",
      "description": "City name."
    },
    "prefix": {
      "kind": "template",
      "type": "string",
      "default": "Hello",
      "description": "Greeting prefix."
    }
  },
  "outputs": {
    "out": {
      "type": "string"
    }
  }
}

function sample_formatGreeting({ input, config, result }) {
  // Only call Flow blocks with one object containing named parameters.
  return `${input.prefix} ${input.name} from ${input.city}`
}
