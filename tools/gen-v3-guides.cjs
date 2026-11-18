#!/usr/bin/env node
// FlowScript v3 guides are generated from the specification, not written twice.
//
// Sources (lib_flow_engine):
//   docs/flowscript-v3-grammar.json   accepted forms (with their block), refusals (code, construct, rewrite), examples
//   docs/flowscript-v3.md             `flowscript id=<id>` fences (examples) and <!-- fragment:<id> --> ... <!-- /fragment -->
//
// A guide or skill keeps its editorial prose. Only the zones between these markers are regenerated:
//
//   <!-- generated:v3-forms [ids=a,b] [format=table|inline] -->      accepted forms: write -> block
//   <!-- generated:v3-refusals [codes=BREAK,FINALLY] [format=table|bullets|inline] -->
//   <!-- generated:v3-example id=<spec fence id> -->                 one example of the specification
//   <!-- generated:v3-fragment id=<fragment id> -->                  one marked fragment of the specification
//   ... generated text ...
//   <!-- /generated -->
//
//   node tools/gen-v3-guides.cjs           rewrites the zones
//   node tools/gen-v3-guides.cjs --check   fails (exit 1) when a zone is not up to date, or names an unknown id
//
// FLOW_ENGINE_RESOURCE_ROOT (<engine>/_flow) locates the engine; by default the sibling lib_flow_engine.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const resources = path.join(root, '_flow/resources');
const ZONE = /<!-- generated:([a-z0-9-]+)((?: [a-z]+=\S+)*) -->([\s\S]*?)<!-- \/generated -->/g;
const OPEN = /<!-- generated:/g;
const PREFIX = 'FLOWSCRIPT_V3_';

function engineDocs() {
  const engine = process.env.FLOW_ENGINE_RESOURCE_ROOT || path.join(root, '../lib_flow_engine/_flow');
  const docs = path.join(path.resolve(engine), '..', 'docs');
  for (const name of ['flowscript-v3.md', 'flowscript-v3-grammar.json']) {
    if (!fs.existsSync(path.join(docs, name))) throw new Error('Missing ' + path.join(docs, name) + ' (set FLOW_ENGINE_RESOURCE_ROOT=<engine>/_flow).');
  }
  return docs;
}

// Fenced blocks of Markdown: { lang, attrs, code }.
function fences(markdown) {
  const out = [];
  let open = null;
  for (const line of markdown.split('\n')) {
    if (!open) {
      const start = /^```(\S*)(.*)$/.exec(line);
      if (start) open = { lang: start[1], rest: start[2], body: [] };
    } else if (/^```\s*$/.test(line)) {
      const attrs = {};
      for (const found of open.rest.matchAll(/(\w+)=(\S+)/g)) attrs[found[1]] = found[2];
      out.push({ lang: open.lang, attrs, code: open.body.join('\n') });
      open = null;
    } else open.body.push(line);
  }
  return out;
}

// <!-- fragment:id --> ... <!-- /fragment -->, without the common indentation.
function fragments(markdown) {
  const out = {};
  for (const found of markdown.matchAll(/^[ \t]*<!-- fragment:([a-z0-9-]+) -->\n([\s\S]*?)\n[ \t]*<!-- \/fragment -->/gm)) {
    const lines = found[2].split('\n');
    const indent = Math.min(...lines.filter(line => line.trim()).map(line => /^ */.exec(line)[0].length));
    if (out[found[1]]) throw new Error('Duplicate fragment ' + found[1]);
    out[found[1]] = lines.map(line => line.slice(indent)).join('\n').replace(/\s+$/, '');
  }
  return out;
}

function sources() {
  const docs = engineDocs();
  const spec = fs.readFileSync(path.join(docs, 'flowscript-v3.md'), 'utf8');
  const examples = {};
  for (const fence of fences(spec)) {
    if (fence.lang !== 'flowscript' || !fence.attrs.id) continue;
    if (examples[fence.attrs.id]) throw new Error('Duplicate example id ' + fence.attrs.id);
    examples[fence.attrs.id] = fence;
  }
  return { grammar: JSON.parse(fs.readFileSync(path.join(docs, 'flowscript-v3-grammar.json'), 'utf8')), examples, fragments: fragments(spec) };
}

const cell = text => String(text).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const code = text => '`' + String(text).trim() + '`';
const alternatives = construct => String(construct).split(' | ').map(item => item.trim());
const plainOrCode = text => /^[a-z]+$/.test(text) ? code(text) : text;

function pick(list, names, key, what) {
  if (!names) return list;
  return names.split(',').map(name => {
    const found = list.find(item => item[key] === name || item[key] === PREFIX + name);
    if (!found) throw new Error('Unknown ' + what + ' ' + name);
    return found;
  });
}

function forms(params, grammar) {
  const entries = pick(grammar.accepted, params.ids, 'id', 'accepted form');
  if ((params.format || 'table') === 'inline') return entries.flatMap(entry => alternatives(entry.construct)).map(code).join(', ');
  const rows = ['| JavaScript | Block | Lowering and limits |', '|---|---|---|'];
  for (const entry of entries) {
    const notes = [];
    if (entry.properties) notes.push('properties: ' + Object.entries(entry.properties).map(([key, value]) => key + ' = ' + value).join('; '));
    for (const key of ['lowering', 'limits', 'where', 'note']) if (entry[key]) notes.push(entry[key]);
    if (entry.defaults) notes.push('defaults: ' + Object.entries(entry.defaults).map(([key, value]) => key + ' ' + value).join(', '));
    rows.push('| ' + cell(alternatives(entry.construct).map(code).join(', ')) + ' | ' + (entry.block ? cell(code(entry.block)) : '') + ' | ' + cell(notes.join('. ')) + ' |');
  }
  return rows.join('\n');
}

function refusals(params, grammar) {
  const entries = pick(grammar.refused, params.codes, 'code', 'refusal');
  const format = params.format || 'table';
  if (format === 'inline') return entries.map(entry => plainOrCode(entry.construct) + ' → ' + entry.rewrite).join('; ');
  if (format === 'bullets') return entries.map(entry => '- ' + plainOrCode(entry.construct) + ': ' + entry.rewrite + ' (`' + entry.code + '`)').join('\n');
  const rows = ['| Construct | Code | Rewrite |', '|---|---|---|'];
  for (const entry of entries) rows.push('| ' + cell(plainOrCode(entry.construct)) + ' | `' + entry.code + '` | ' + cell(entry.rewrite) + ' |');
  return rows.join('\n');
}

function example(params, src) {
  const fence = src.examples[params.id];
  if (!fence) throw new Error('Unknown example ' + params.id);
  return '```javascript' + (fence.attrs.refused ? ' refused=' + fence.attrs.refused : '') + '\n' + fence.code.replace(/\s+$/, '') + '\n```';
}

function fragment(params, src) {
  if (!(params.id in src.fragments)) throw new Error('Unknown fragment ' + params.id);
  return src.fragments[params.id];
}

const KINDS = {
  'v3-forms': { render: (params, src) => forms(params, src.grammar), inline: params => params.format === 'inline' },
  'v3-refusals': { render: (params, src) => refusals(params, src.grammar), inline: params => params.format === 'inline' },
  'v3-example': { render: example, inline: () => false },
  'v3-fragment': { render: fragment, inline: () => false },
};

function renderZone(kind, rawParams, src) {
  const spec = KINDS[kind];
  if (!spec) throw new Error('Unknown generated zone kind ' + kind);
  const params = {};
  for (const found of rawParams.matchAll(/ ([a-z]+)=(\S+)/g)) params[found[1]] = found[2];
  const body = spec.render(params, src);
  return spec.inline(params) ? body : '\n' + body + '\n';
}

// The zones of a text: the regenerated text and the ids of the zones whose content changed.
function regenerate(text, src, where) {
  const stale = [];
  const opens = [...text.matchAll(OPEN)].length, closed = [...text.matchAll(ZONE)].length;
  if (opens !== closed) throw new Error(where + ': a generated zone is not closed with <!-- /generated -->');
  const next = text.replace(ZONE, (all, kind, params, body) => {
    let content;
    try { content = renderZone(kind, params, src); } catch (error) { throw new Error(where + ': ' + error.message); }
    if (content !== body) stale.push(kind + params);
    return '<!-- generated:' + kind + params + ' -->' + content + '<!-- /generated -->';
  });
  return { next, stale };
}

function files() {
  const out = [];
  const visit = dir => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
    const target = path.join(dir, item.name);
    if (item.isDirectory()) visit(target);
    else if (item.name.endsWith('.md')) out.push(target);
  });
  visit(path.join(resources, 'guide'));
  visit(path.join(resources, 'skills'));
  return out;
}

// { file, zones } for every guide or skill holding generated zones; with write, the files are rewritten.
function run(write) {
  const src = sources();
  const report = [];
  for (const file of files()) {
    const text = fs.readFileSync(file, 'utf8');
    if (!text.includes('<!-- generated:')) continue;
    const { next, stale } = regenerate(text, src, path.relative(root, file));
    report.push({ file, zones: (text.match(ZONE) || []).length, stale });
    if (write && next !== text) fs.writeFileSync(file, next);
  }
  return report;
}

module.exports = { run, regenerate, renderZone, sources, files, ZONE };

if (require.main === module) {
  try {
    const check = process.argv.includes('--check');
    const report = run(!check);
    let stale = 0;
    for (const item of report) {
      for (const zone of item.stale) {
        stale++;
        console.log(path.relative(root, item.file) + ': ' + (check ? 'stale zone ' : 'rewrote zone ') + zone);
      }
    }
    console.log(report.reduce((sum, item) => sum + item.zones, 0) + ' generated zones in ' + report.length + ' files' + (check && stale ? ', ' + stale + ' stale (run node tools/gen-v3-guides.cjs)' : ''));
    process.exit(check && stale ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}
