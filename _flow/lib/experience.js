(function () {
  // ACE's line format, without evaluating any source or exposing trigger metadata as advice.
  function parse(text, library, drawer) {
    var entries = [], entry = null, section = "";
    String(text || "").split(/\r?\n/).forEach(function (line) {
      if (/^## /.test(line)) { section = line.substring(3).trim(); entry = null; return; }
      var match = /^\[([a-z][a-z0-9_-]*-\d+)\]\s*helpful=(\d+)\s*harmful=(\d+)\s*::\s*(.*)$/.exec(line);
      if (match) {
        entry = null;
        if (!section || match[1].substring(0, match[1].lastIndexOf("-")) !== drawer) return;
        entry = { id: match[1], library: library, drawer: drawer, section: section,
          score: Number(match[2]) - Number(match[3]), text: match[4], codes: [], blocks: [] };
        entries.push(entry);
      } else if (entry && /^\s+/.test(line)) {
        var trigger = /^\s+@(codes|blocks):\s*(.*)$/.exec(line);
        if (trigger) entry[trigger[1]] = entry[trigger[1]].concat(trigger[2].split(/\s*,\s*/).filter(Boolean));
        else entry.text += "\n" + line;
      }
    });
    entries.forEach(function (item) { item.text = item.text.replace(/\s+$/, ""); });
    return entries;
  }

  function glob(pattern, block) {
    var escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp("^" + escaped + "(?:\\..*)?$").test(block);
  }

  function sourceBlocks(source) {
    // Mask comments and literals: a SQL example in a comment/string is not a domain gesture.
    var clean = String(source || "").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, " ");
    var blocks = [], seen = {}, match;
    var call = /\b([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)+)\s*\(/g;
    while ((match = call.exec(clean))) {
      if (!seen[match[1]] && !/^(?:ctx|Math|JSON|Object|String|Array)\./.test(match[1])) {
        seen[match[1]] = true;
        blocks.push(match[1]);
      }
    }
    return blocks;
  }

  function domains(request, value, source) {
    var name = String(request.params && request.params.name || "");
    var args = request.params && request.params.arguments || {};
    var kind = String(args.kind || args.type || args.target || "");
    var front = /^frontend-svelte-/.test(name) || !!(args.sourceFile || args.sourcePath) || /^(source|sourcefile|svelte|frontend|browser)$/.test(kind);
    var blocks = [];
    if (/^(?:code|flow-(?:block-)?code)-(set|patch|check)$/.test(name)) {
      if (front) blocks.push("front");
      else blocks = sourceBlocks(source);
    }
    if (/^frontend-svelte-/.test(name)) blocks.push("front");
    if (/^scheduler-/.test(name)) blocks.push("jobs");
    if (/^flow-crud-/.test(name)) blocks.push("sql", "front");
    return blocks;
  }

  function diagnosticCodes(value) {
    var found = {}, remaining = 2000;
    // Only diagnostic containers. A successful business result with a field named code is not an error.
    function visit(item, depth) {
      if (!item || typeof item !== "object" || depth > 8 || --remaining < 0) return;
      if (Array.isArray(item)) { item.forEach(function (child) { visit(child, depth + 1); }); return; }
      if (typeof item.code === "string") found[item.code] = true;
      ["error", "errors", "diagnostics", "warnings", "details", "analysis", "validation"].forEach(function (key) {
        visit(item[key], depth + 1);
      });
    }
    ["error", "errors", "diagnostics", "warnings", "analysis", "validation"].forEach(function (key) { visit(value && value[key], 0); });
    return found;
  }

  function entryKey(entry) { return entry.library + "/" + entry.id; }
  function render(experience) {
    return "[Flow ACE: " + experience.reason + "; " + experience.drawer + "]\n" + experience.entries.map(function (entry) {
      return "[Flow ACE " + entry.id + "] " + entry.text.replace(/\n/g, "\n[Flow ACE] ");
    }).join("\n");
  }
  function payload(entries, reason) {
    var drawers = [];
    entries.forEach(function (entry) { if (drawers.indexOf(entry.drawer) < 0) drawers.push(entry.drawer); });
    return { reason: reason, drawer: drawers.join(","), entries: entries.map(function (entry) { return { id: entry.id, text: entry.text }; }) };
  }
  function addedChars(experience) {
    return JSON.stringify({ experience: experience }).length + JSON.stringify({ type: "text", text: render(experience) }).length + 2;
  }

  function select(entries, blocks, codes, state, mode) {
    var ranked = entries.slice().sort(function (a, b) {
      return b.score - a.score || entryKey(a).localeCompare(entryKey(b));
    });
    var reason = "error", eligible = ranked.filter(function (entry) {
      return entry.codes.some(function (code) { return codes[code]; }) &&
        (state.sent[entryKey(entry)] === undefined || state.call - state.sent[entryKey(entry)] > 10);
    });
    if (!eligible.length && mode === "on" && blocks.length) {
      reason = "first-domain";
      var drawers = {};
      ranked.forEach(function (entry) {
        if (entry.drawer === "common" || blocks.some(function (block) {
          return glob(entry.drawer, block) || entry.blocks.some(function (pattern) { return glob(pattern, block); });
        })) drawers[entry.drawer] = true;
      });
      eligible = ranked.filter(function (entry) {
        return drawers[entry.drawer] && !state.drawers[entry.drawer] &&
          (!entry.blocks.length || blocks.some(function (block) { return entry.blocks.some(function (pattern) { return glob(pattern, block); }); })) &&
          state.sent[entryKey(entry)] === undefined;
      });
    }
    var chosen = [];
    eligible.forEach(function (entry) {
      // Keep complete advice/snippets. Oversize entries stay available through resources/read.
      if ((reason !== "error" || chosen.length < 2) && addedChars(payload(chosen.concat([entry]), reason)) <= 2000) chosen.push(entry);
    });
    if (!chosen.length) return null;
    chosen.forEach(function (entry) {
      state.sent[entryKey(entry)] = state.call;
      if (reason === "first-domain") state.drawers[entry.drawer] = true;
    });
    var experience = payload(chosen, reason);
    return { experience: experience, text: render(experience), estimatedTokens: Math.ceil(addedChars(experience) / 4),
      sources: chosen.map(function (entry) { return { library: entry.library, drawer: entry.drawer, id: entry.id }; }) };
  }

  return { parse: parse, domains: domains, diagnosticCodes: diagnosticCodes, select: select,
    sourceBlocks: sourceBlocks, render: render, addedChars: addedChars };
}())
