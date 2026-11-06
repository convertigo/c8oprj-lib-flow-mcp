#!/usr/bin/env node
// Guide sizes shown to agents. resources/list computes each description size at run time
// (mcp.js guideSizeLabel); the guide tables that name another guide write it as
// `flow://guide/<name>` (N.N KB). This tool recomputes those annotations from the guide bytes:
//   node tools/guide-sizes.cjs           lists stale annotations, exit 1 when one is stale
//   node tools/guide-sizes.cjs --write   rewrites them until they are stable
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const guideDir = path.join(root, '_flow/resources/guide');
const skillDir = path.join(root, '_flow/resources/skills');
const ANNOTATION = /`flow:\/\/guide\/([a-z0-9-]+)` \((\d+\.\d) KB\)/g;
// Under 16 000 characters every client (Claude Code, Codex, Vibe) shows a tool result whole, without saving it to a file.
const LIMIT = 16000;

// Same rounding as guideSizeLabel in _flow/lib/mcp.js: decimal kilobytes, one decimal.
function sizeLabel(bytes) {
  const tenths = Math.max(1, Math.round(Number(bytes) / 100));
  return Math.floor(tenths / 10) + '.' + (tenths % 10) + ' KB';
}

function guides() {
  return fs.readdirSync(guideDir).filter(name => name.endsWith('.md')).sort()
    .map(name => ({ name: name.slice(0, -3), file: path.join(guideDir, name), bytes: fs.statSync(path.join(guideDir, name)).size,
      chars: fs.readFileSync(path.join(guideDir, name), 'utf8').length }));
}

function annotatedFiles() {
  const files = guides().map(guide => guide.file);
  for (const skill of fs.existsSync(skillDir) ? fs.readdirSync(skillDir).sort() : []) {
    const file = path.join(skillDir, skill, 'SKILL.md');
    if (fs.existsSync(file)) files.push(file);
  }
  return files;
}

function stale() {
  const sizes = Object.fromEntries(guides().map(guide => [guide.name, sizeLabel(guide.bytes)]));
  const found = [];
  for (const file of annotatedFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(ANNOTATION)) {
      const expected = sizes[match[1]];
      if (!expected) found.push({ file, guide: match[1], shown: match[2] + ' KB', expected: 'missing guide' });
      else if (expected !== match[2] + ' KB') found.push({ file, guide: match[1], shown: match[2] + ' KB', expected });
    }
  }
  return found;
}

function write() {
  for (let pass = 0; pass < 6; pass++) {
    const sizes = Object.fromEntries(guides().map(guide => [guide.name, sizeLabel(guide.bytes)]));
    let changed = false;
    for (const file of annotatedFiles()) {
      const text = fs.readFileSync(file, 'utf8');
      const next = text.replace(ANNOTATION, (all, name) => sizes[name] ? '`flow://guide/' + name + '` (' + sizes[name] + ')' : all);
      if (next !== text) { fs.writeFileSync(file, next); changed = true; }
    }
    if (!changed) return pass;
  }
  throw new Error('Guide size annotations did not converge');
}

module.exports = { sizeLabel, guides, stale, write, LIMIT, ANNOTATION };

if (require.main === module) {
  if (process.argv.includes('--write')) write();
  const left = stale();
  for (const item of left) console.log(path.relative(root, item.file) + ': ' + item.guide + ' shows ' + item.shown + ', expected ' + item.expected);
  for (const guide of guides()) if (guide.chars >= LIMIT) console.log('not under ' + LIMIT + ' characters: ' + guide.name + ' (' + guide.chars + ')');
  process.exit(left.length ? 1 : 0);
}
