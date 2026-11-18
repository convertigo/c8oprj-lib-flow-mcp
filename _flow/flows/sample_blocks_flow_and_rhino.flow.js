const _flow = {
  sourceVersion: 3,
  inputs: {
    name: { type: "string", description: "Person name used by the FlowScript sample block.", default: "Nicolas" },
    city: { type: "string", description: "City name used by the FlowScript sample block.", default: "Paris" },
    minTemperature: { type: "number", description: "Keep only cities at or above this temperature.", default: 30 },
  },
  tests: { checkParis: { input: { name: "Nicolas", city: "Paris", minTemperature: 30 } } },
}

function sample_blocks_flow_and_rhino({ input, config, result }) {
  // Only call Flow blocks with one object containing named parameters.
  local.greeting = sample.formatGreeting({ name: input.name, city: input.city, prefix: "Hello" })
  // Rhino is reserved for one small Java bridge or primitive, not a full feature.
  local.hash = sample.sha256({ text: local.greeting })
  local.cities = [
    { name: "Paris", temperature: 38 },
    { name: "Lyon", temperature: 31 },
    { name: "Brest", temperature: 22 },
  ]
  local.hotCities = local.cities.filter(item => item.temperature >= input.minTemperature)
  local.hotCityNames = local.hotCities.map(item => item.name)
  result.greeting = local.greeting
  result.digest = local.hash.digest
  result.hotCities = local.hotCityNames
  result.count = local.hotCityNames.length
}
