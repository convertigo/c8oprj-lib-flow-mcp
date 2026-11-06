// Guides split into an entry guide and sub-guides lose no information: every heading and every paragraph of the
// guide as it was before the split (tests/fixtures/guides-938fc6a, MCP 938fc6a) is still served by its family,
// apart from the explicit cross-reference rewrites listed in rewrites.json. Size annotations are ignored.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const guideDir = path.join(root, '_flow/resources/guide');
const before = path.join(__dirname, 'fixtures/guides-938fc6a');
const rewrites = JSON.parse(fs.readFileSync(path.join(before, 'rewrites.json'), 'utf8'));
const { stale, guides, LIMIT } = require(path.join(root, 'tools/guide-sizes.cjs'));

const families = {
  'frontend-svelte': { entryMax: 8000, subs: ['sources', 'layout', 'data', 'forms', 'datatable', 'actions', 'themes', 'components', 'proof'].map(s => 'frontend-svelte-' + s) },
  start: { entryMax: 6000, subs: ['start-rules'] },
  authoring: { entryMax: LIMIT, subs: ['authoring-data', 'authoring-source', 'authoring-blocks'] },
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
  for (const file of files) assert.ok(fs.existsSync(file), entry + ': missing ' + path.basename(file));
  const texts = files.map(read);
  const entryText = texts[0];

  // Sizes: the entry stays short, no file of the family exceeds the guide limit.
  assert.ok(Buffer.byteLength(entryText) <= family.entryMax, `${entry} entry is ${Buffer.byteLength(entryText)} bytes, over ${family.entryMax}`);
  files.forEach((file, index) => assert.ok(texts[index].length < LIMIT, `${path.basename(file)} is not under ${LIMIT} characters`));

  // The entry keeps the title and names each sub-guide with its size; each sub-guide points back to the entry.
  assert.equal(entryText.split('\n')[0], original.split('\n')[0], entry + ' keeps its title');
  for (const sub of family.subs) {
    assert.match(entryText, new RegExp('`flow://guide/' + sub + '` \\(\\d+\\.\\d KB\\)'), `${entry} must list ${sub} with its size`);
    assert.ok(read(path.join(guideDir, sub + '.md')).includes('`flow://guide/' + entry + '`'), `${sub} must name its entry guide`);
  }

  // Sections: every former heading is still a heading of the family.
  const now = new Set(texts.flatMap(headings));
  for (const heading of headings(original)) assert.ok(now.has(heading), `${entry}: section "${heading}" was lost`);

  // Paragraphs: every former paragraph (title and one-line description excepted) is served whole by the family.
  let previous = normalize(original);
  for (const rewrite of rewrites.filter(item => item.family === entry)) {
    const old = normalize(rewrite.old);
    assert.ok(previous.includes(old), `${entry}: rewrite source not found: ${rewrite.old}`);
    previous = previous.split(old).join(normalize(rewrite.new));
  }
  const union = normalize(texts.join('\n\n'));
  const lines = original.split('\n');
  const paragraphs = original.split(/\n[ \t]*\n/).map(normalize).filter(Boolean)
    .filter(text => text !== normalize(lines[0]) && text !== normalize(lines[2]) && !/^#{2,3} /.test(text));
  for (let paragraph of paragraphs) {
    for (const rewrite of rewrites.filter(item => item.family === entry)) {
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
