// Bundles the sample CAP project's files into project-files.js so the site can show the real source.
// Run from the portfolio folder:  node tools/build-explorer.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'sample-cap-java');
const skip = new Set(['target', 'node_modules', 'gen', '.git']);
const files = {};

(function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { if (!skip.has(name)) walk(full); continue; }
    if (name === '.gitignore') continue;
    files[path.relative(root, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
  }
})(root);

const out = path.join(__dirname, '..', 'project-files.js');
fs.writeFileSync(out, 'window.PROJECT_FILES = ' + JSON.stringify(files, null, 1) + ';\n');
console.log(`Wrote ${Object.keys(files).length} files to ${out}`);
