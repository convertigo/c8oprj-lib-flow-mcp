// c8o: FlowScript spike. Function calls are Flow blocks; named arguments are block properties.
// c8o: Patch with the returned revision. The engine validates and compiles this code back to Flow YAML.

const _flow = {
  "inputs": {
    "name": {
      "type": "string",
      "description": "Person name used by the FlowScript sample block.",
      "default": "Nicolas",
    },
    "city": {
      "type": "string",
      "description": "City name used by the FlowScript sample block.",
      "default": "Paris",
    },
    "minTemperature": {
      "type": "number",
      "description": "Keep only cities at or above this temperature.",
      "default": 30,
    },
  },
  "tests": {
    "checkParis": {
      "input": {
        "name": "Nicolas",
        "city": "Paris",
        "minTemperature": 30,
      },
    },
  },
  "sourceVersion": 2,
}

function sample_blocks_flow_and_rhino({ input, config, result }) {
  local.greeting = sample.formatGreeting({
    $$id: "greeting",
    $$comment: "Only call Flow blocks with one object containing named parameters.",
    name: input.name,
    city: input.city,
    prefix: "Hello",
  })
  local.hash = sample.sha256({
    $$id: "hash",
    $$comment: "Rhino is reserved for one small Java bridge or primitive, not a full feature.",
    text: local.greeting,
  })
  set({
    $$id: "cities",
    path: "local.cities",
    value: [
      {
        name: "Paris",
        temperature: 38,
      },
      {
        name: "Lyon",
        temperature: 31,
      },
      {
        name: "Brest",
        temperature: 22,
      },
    ],
  })
  local.hotCities = list.filter({
    $$id: "hotCities",
    items: local.cities,
    where: current.temperature >= input.minTemperature,
  })
  local.hotCityNames = list.map({
    $$id: "hotCityNames",
    items: local.hotCities,
    select: current.name,
  })
  set({
    $$id: "greeting",
    path: "result.greeting",
    value: local.greeting,
  })
  set({
    $$id: "digest",
    path: "result.digest",
    value: local.hash.digest,
  })
  set({
    $$id: "hotCities",
    path: "result.hotCities",
    value: local.hotCityNames,
  })
  set({
    $$id: "count",
    path: "result.count",
    value: local.hotCityNames.length,
  })
}
