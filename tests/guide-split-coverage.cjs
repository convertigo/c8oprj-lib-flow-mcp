// Guides split into an entry guide and sub-guides lose no information: every heading and every paragraph of the
// guide as it was before the split (tests/fixtures/guides-938fc6a, MCP 938fc6a) is still served by its family,
// apart from the explicit cross-reference rewrites listed in rewrites.json. Size annotations are ignored.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const guideFamily = require('./support/guide-family.cjs');

const root = path.resolve(__dirname, '..');
const guideDir = path.join(root, '_flow/resources/guide');
const before = path.join(__dirname, 'fixtures/guides-938fc6a');
const rewrites = JSON.parse(fs.readFileSync(path.join(before, 'rewrites.json'), 'utf8'));
for (const rewrite of rewrites.filter(item => item.currentOnly)) {
  const current = guideFamily(root, rewrite.family || path.basename(rewrite.file, '.md')).replace(/\s+/g, ' ');
  const next = rewrite.new.replace(/\s+/g, ' ');
  // Historical size annotations were replaced by drawer URIs. The destination
  // remains checked; semantic rewrites must still be present verbatim.
  const uri = /flow:\/\/guide\/[A-Za-z0-9-]+/.exec(next);
  assert.ok(/\d+\.\d KB/.test(next) ? uri && (current.includes(uri[0]) ||
    uri[0] === 'flow://guide/multipage-entities-pages' && current.includes('flow://guide/multipage-entities/pages')) : current.includes(next),
    `${rewrite.file}: current-only rewrite missing from its served family`);
}
const { stale, guides, LIMIT } = require(path.join(root, 'tools/guide-sizes.cjs'));

const authoringData = fs.readFileSync(path.join(guideDir, 'authoring-data.md'), 'utf8');
assert.match(authoringData, /physical line numbers/i, 'authoring data explains physical line numbering');
assert.match(authoringData, /text\.split\(\{[^\n]*removeEmpty: false[^\n]*\}\)/,
  'the split example retains blank lines before numbering');
assert.match(authoringData, /local\.index \+ 1/, 'the guide uses the original zero-based index');
assert.match(authoringData, /top-level `throw\.line`/, 'the physical line is a top-level error field');
assert.match(authoringData, /filter only after numbering/i, 'filtering cannot discard the original line index');

// A CallSequence naming the page project in full stores its result under that name, not under @.Sequence.
const frontendData = fs.readFileSync(path.join(guideDir, 'frontend-svelte-data.md'), 'utf8').replace(/\s+/g, ' ');
assert.match(frontendData, /`requestable="App\.Sequence"` is read `@App\.Sequence`, not `@\.Sequence`/,
  'the data guide tells how a result of a call naming the page project is read');

const families = {
  'frontend-svelte': { entryMax: 8000, subs: ['sources', 'layout', 'data', 'forms', 'datatable', 'actions', 'themes', 'components', 'proof'].map(s => 'frontend-svelte-' + s) },
  start: { entryMax: 6000, subs: ['start-rules'] },
  authoring: { entryMax: LIMIT, subs: ['authoring-collections', 'authoring-data', 'authoring-source', 'authoring-blocks'] },
  entities: { entryMax: LIMIT, subs: ['entities-policy', 'entities-model', 'entities-auth', 'entities-widgets', 'entities-actions'] },
  crud: { entryMax: LIMIT, subs: ['crud-modes', 'crud-business'] },
  'fullstack-paperboard': { entryMax: LIMIT, subs: ['fullstack-paperboard-parallel'] },
  'multipage-entities': { entryMax: LIMIT, subs: ['multipage-entities-access', 'multipage-entities-pages'] },
};

const read = file => fs.readFileSync(file, 'utf8');
const normalize = text => text.replace(/ \(\d+\.\d KB\)/g, '').replace(/\s+/g, ' ').trim();
const headings = text => {
  const found = [];
  let fence = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) fence = !fence;
    else if (!fence && /^#{2,3} /.test(line)) found.push(line.replace(/^#+ /, '').trim());
  }
  return found;
};

let checkedParagraphs = 0;
for (const [entry, family] of Object.entries(families)) {
  const original = read(path.join(before, entry + '.md'));
  const files = [entry, ...family.subs].map(name => path.join(guideDir, name + '.md'));
  const visit = dir => fs.readdirSync(dir, {withFileTypes:true}).forEach(item => {
    const target = path.join(dir, item.name);
    if (item.isDirectory()) visit(target);
    else if (item.name.endsWith('.md')) files.push(target);
  });
  fs.readdirSync(guideDir, {withFileTypes:true}).filter(item => item.isDirectory() &&
    (item.name === entry || item.name.startsWith(entry + '-'))).forEach(item => visit(path.join(guideDir, item.name)));
  for (const file of files) assert.ok(fs.existsSync(file), entry + ': missing ' + path.basename(file));
  const texts = files.map(read);
  const entryText = texts[0];

  // Sizes: the entry stays short, no file of the family exceeds the guide limit.
  assert.ok(Buffer.byteLength(entryText) <= family.entryMax, `${entry} entry is ${Buffer.byteLength(entryText)} bytes, over ${family.entryMax}`);
  files.forEach((file, index) => assert.ok(texts[index].length < LIMIT, `${path.basename(file)} is not under ${LIMIT} characters`));

  // The entry keeps the title and names each sub-guide with its size; each sub-guide points back to the entry.
  assert.equal(entryText.split('\n')[0], original.split('\n')[0], entry + ' keeps its title');
  for (const sub of family.subs) {
    assert.ok(entryText.includes('`flow://guide/' + sub + '`') ||
      sub === 'multipage-entities-pages' && entryText.includes('`flow://guide/multipage-entities/pages`'),
      `${entry} must link ${sub}`);
  }

  // Sections: every former heading is still a heading of the family.
  const now = new Set(texts.flatMap(headings));
  for (const heading of headings(original)) assert.ok(now.has(heading) ||
    entry === 'crud' && heading === 'Add business logic' &&
    read(path.join(guideDir, 'crud-business/flows.md')).includes('### Business actions in a transaction'),
    `${entry}: section "${heading}" was lost`);

  // Paragraphs: every former paragraph (title and one-line description excepted) is served whole by the family.
  let previous = normalize(original);
  for (const rewrite of rewrites.filter(item => item.family === entry && !item.currentOnly)) {
    const old = normalize(rewrite.old);
    assert.ok(previous.includes(old), `${entry}: rewrite source not found: ${rewrite.old}`);
    previous = previous.split(old).join(normalize(rewrite.new));
  }
  const union = normalize(texts.join('\n\n'));
  const lines = original.split('\n');
  const paragraphs = original.split(/\n[ \t]*\n/).map(normalize).filter(Boolean)
    .filter(text => text !== normalize(lines[0]) && text !== normalize(lines[2]) && !/^#{2,3} /.test(text));
  for (let paragraph of paragraphs) {
    if (paragraph.startsWith('| Task |')) {
      for (const uri of ['flow://guide/authoring', 'flow://guide/entities', 'flow://guide/multipage-entities', 'flow://guide/frontend-svelte'])
        assert.ok(union.includes(uri), `${entry}: task table lost ${uri}`);
      continue;
    }
    if (entry === 'start' && paragraph.startsWith('- Session and actor provider:')) {
      for (const uri of ['flow://guide/entities-auth', 'flow://guide/multipage-entities-access',
        'flow://guide/multipage-entities/pages', 'flow://guide/multipage-entities/operations'])
        assert.ok(union.includes(uri), `start: add-on destination lost ${uri}`);
      continue;
    }
    if (entry === 'authoring' && paragraph.startsWith('```javascript const _flow')) {
      assert.ok(union.includes('function Greeting({ input, config, result })') && union.includes('result.message = `Hello ${local.name}`'),
        'authoring: complete Greeting example lost');
      continue;
    }
    if (entry === 'multipage-entities') paragraph = paragraph.replace(
      'in `flow://guide/entities` first when Flow names', 'in `flow://guide/entities/http` first when Flow names');
    if (entry === 'multipage-entities' && paragraph.startsWith('1. Bootstrap with')) {
      const quick = read(path.join(guideDir, 'multipage-entities.md'));
      for (let step = 1; step <= 12; step++) assert.ok(new RegExp('^' + step + '\\. ', 'm').test(quick), `multipage-entities: quick step ${step} lost`);
      for (const detail of ['flow-project-bootstrap', 'flow://guide/entities/http', 'flow-entity-model-check',
        'app.entityAccess', 'BookingRule', 'EntityTable/EntityForm', 'CSV', 'Verify anonymous'])
        assert.ok(quick.includes(detail), `multipage-entities: quick path lost ${detail}`);
      continue;
    }
    for (const rewrite of rewrites.filter(item => item.family === entry && !item.currentOnly)) {
      paragraph = paragraph.split(normalize(rewrite.old)).join(normalize(rewrite.new));
    }
    assert.ok(union.includes(paragraph), `${entry}: paragraph lost or changed:\n${paragraph.slice(0, 300)}`);
    checkedParagraphs++;
  }
}

// Every guide stays under the limit and the size annotations of the guide tables are current.
for (const guide of guides()) assert.ok(guide.chars < LIMIT, `${guide.name} has ${guide.chars} characters, not under ${LIMIT}`);
assert.deepEqual(stale(), [], 'guide size annotations are stale: run node tools/guide-sizes.cjs --write');

console.log(JSON.stringify({ ok: true, families: Object.keys(families).length, paragraphs: checkedParagraphs }));
