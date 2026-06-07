const _meta = {
  "version": 1,
  "icon": "mdi:language-javascript",
  "tags": [
    "native"
  ],
  "description": "New JavaScript Flow block.",
  "hooks": {
    "file": "rhinoBlock.hooks.js"
  },
  "properties": {
  },
  "runtime": "rhino"
}

(function () {
	return {
		run: function (ctx, node) {
			return null;
		}
	};
}())
