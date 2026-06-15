const _meta = {
  "version": 1,
  "description": "Sample Rhino block that computes a SHA-256 digest through Java.",
  "icon": "mdi:fingerprint",
  "visibility": "internal",
  "tags": [
    "sample",
    "rhino",
    "java"
  ],
  "properties": {
    "text": {
      "kind": "template",
      "type": "string",
      "default": "",
      "description": "Text to hash."
    }
  },
  "outputs": {
    "out": {
      "type": "object",
      "properties": {
        "algorithm": {
          "type": "string"
        },
        "input": {
          "type": "string"
        },
        "digest": {
          "type": "string"
        }
      }
    }
  },
  "runtime": "rhino"
}

// Use Rhino 1.9.0 features: https://mozilla.github.io/rhino/compat/engines.html
(function () {
  function hex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      var value = bytes[i];
      if (value < 0) {
        value += 256;
      }
      out += ("0" + value.toString(16)).slice(-2);
    }
    return out;
  }

  return {
    run: function (ctx, node) {
      var props = ctx.props(node);
      var text = String(ctx.template(props.text || ""));
      var digest = Packages.java.security.MessageDigest.getInstance("SHA-256");
      var bytes = digest.digest(new java.lang.String(text).getBytes("UTF-8"));
      return {
        algorithm: "SHA-256",
        input: text,
        digest: hex(bytes)
      };
    }
  };
}())
