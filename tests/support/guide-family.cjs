'use strict';
const fs = require('node:fs');
const path = require('node:path');

// A guide family is served as its entry, existing sub-guides and slash drawers.
module.exports = function guideFamily(root, name) {
  const dir = path.join(root, '_flow/resources/guide');
  const files = [name + '.md', ...fs.readdirSync(dir).filter(file => file.startsWith(name + '-') && file.endsWith('.md')).sort()];
  function walk(folder) {
    if (!fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, {withFileTypes:true})) {
      const target = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.name.endsWith('.md')) files.push(path.relative(dir, target));
    }
  }
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.isDirectory() && (entry.name === name || entry.name.startsWith(name + '-')))
      walk(path.join(dir, entry.name));
  }
  // A nested guide (entities/model, start/rules) also serves its own folder of children.
  if (name.includes('/')) walk(path.join(dir, name));
  return files.map(file => fs.readFileSync(path.join(dir, file), 'utf8')).join('\n\n').replace(/ \(\d+\.\d KB\)/g, '');
};
