const _meta = {
  "sourceVersion": 2,
  "version": 1,
  "description": "New composite Flow block.",
  "icon": "mdi:source-branch",
  "properties": {},
  "outputs": {
    "out": {
      "type": "unknown",
    },
  },
  "tags": [
    "composite",
  ],
}

// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "sourceVersion": 2,
}

function project_flowBlock({ input, config, result }) {
}
