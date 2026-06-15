const _flow = {
  inputs: {
    name: {
      type: "string",
      description: "Person name used by the FlowScript sample block.",
      default: "Nicolas"
    },
    city: {
      type: "string",
      description: "City name used by the FlowScript sample block.",
      default: "Paris"
    },
    minTemperature: {
      type: "number",
      description: "Keep only cities at or above this temperature.",
      default: 30
    }
  },
  tests: {
    checkParis: {
      input: {
        name: "Nicolas",
        city: "Paris",
        minTemperature: 30
      }
    }
  }
}

function sample_blocks_flow_and_rhino({ input, config, result }) {
  // Only call Flow blocks with one object containing named parameters.
  var greeting = sample.formatGreeting({
    name: input.name,
    city: input.city,
    prefix: "Hello"
  })

  // Rhino is reserved for one small Java bridge or primitive, not a full feature.
  var hash = sample.sha256({ text: greeting })

  var cities = [
    { name: "Paris", temperature: 38 },
    { name: "Lyon", temperature: 31 },
    { name: "Brest", temperature: 22 }
  ]
  var hotCities = list.filter({
    items: cities,
    where: current.temperature >= input.minTemperature
  })
  var hotCityNames = list.map({
    items: hotCities,
    select: current.name
  })

  result.greeting = greeting
  result.digest = hash.digest
  result.hotCities = hotCityNames
  result.count = hotCityNames.length
  return result
}
