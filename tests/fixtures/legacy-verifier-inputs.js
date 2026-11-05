// Read-only input contract snapshot from c8oprj-lib-c8o-mcp v0.3.0-beta.1 (42ee7f6031f06215749b1f111ac7d4014b2d5be7).
// Exact parser functions; adapter supplies only objectArg. No runner, browser or host is called.
(function(){
var api={}, MAX_PATHS=8, MAX_CHECKS=20;
function str(value){return value==null?"":String(value).trim();}
function sa(){return {objectArg:function(value){return value&&typeof value==="object"?value:JSON.parse(value||"{}");}};}
  api.parseList = function (value, name, max) {
    var items;
    if (Array.isArray(value)) {
      items = value;
    } else {
      var text = str(value);
      if (!text.length) {
        return [];
      }
      items = null;
      if (text.charAt(0) === "[") {
        try {
          items = JSON.parse(text);
        } catch (_notJson) {
          items = null;
        }
      }
      if (!Array.isArray(items)) {
        items = text.split(/\r?\n/).map(function (line) {
          return line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim();
        });
      }
    }
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item && typeof item === "object") {
        var steps = str(item.steps || item.description || item.path || item.check);
        if (steps.length) {
          out.push(str(item.name).length ? { name: str(item.name), steps: steps } : steps);
        }
      } else if (str(item).length) {
        out.push(str(item));
      }
    }
    if (out.length > max) {
      throw new Error(name + ": at most " + max + " items per call; split the verification in several calls.");
    }
    return out;
  };

  api.parseViewport = function (value) {
    var text = str(value).toLowerCase();
    if (value && typeof value === "object" && value.width && value.height) {
      return { width: Math.max(320, Math.min(3840, Number(value.width) || 1280)), height: Math.max(320, Math.min(2160, Number(value.height) || 800)) };
    }
    if (text === "mobile") {
      return { width: 390, height: 844 };
    }
    var m = /^(\d{3,4})\s*x\s*(\d{3,4})$/.exec(text);
    if (m) {
      return api.parseViewport({ width: Number(m[1]), height: Number(m[2]) });
    }
    return { width: 1280, height: 800 };
  };

  function verifierInputs(params) {
    var inputs = sa().objectArg(params.inputs);
    var pick = function (key) {
      return params[key] !== undefined && params[key] !== null && str(params[key]).length ? params[key] : inputs[key];
    };
    var paths = api.parseList(pick("paths"), "paths", MAX_PATHS);
    if (!paths.length && str(params.task).length) {
      paths = [str(params.task)];
    }
    return {
      url: str(pick("url")),
      project: str(pick("project")),
      viewport: api.parseViewport(pick("viewport")),
      paths: paths,
      checks: api.parseList(pick("checks"), "checks", MAX_CHECKS),
      hints: [str(pick("hints")), str(params.reportFormat).length ? "Report format asked: " + str(params.reportFormat) : ""]
        .filter(function (x) { return x.length; }).join("\n")
    };
  }


return {inputs:verifierInputs,arguments:["profile", "task", "inputs", "reportFormat", "model", "maxSteps", "timeBudgetSec", "maxCostUsd", "waitSec", "runId", "cdpEndpoint", "browserDebugPort", "conversationId"]};
}())
