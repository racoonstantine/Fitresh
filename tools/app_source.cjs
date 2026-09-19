// Returns public/index.html with the local <script src="js/*.js"> tags merged
// back into one inline <script> (in load order), so tests can slice code out
// of it by function-name markers regardless of which public/js/ file it is in.
const fs = require('fs');
const path = require('path');
module.exports = function readAppSource(){
  const root = path.join(__dirname, '..', 'public');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const re = /<script src="(js\/[^"]+\.js)"><\/script>\r?\n?/g;
  const code = [...html.matchAll(re)].map(m => fs.readFileSync(path.join(root, m[1]), 'utf8')).join('');
  let first = true;
  return html.replace(re, () => { if (!first) return ''; first = false; return '<script>\n' + code + '</script>\n'; });
};
