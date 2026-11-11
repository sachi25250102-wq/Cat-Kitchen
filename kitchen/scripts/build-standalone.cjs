// Package the offline game into one HTML file without changing the source files.
const fs = require('node:fs');
const path = require('node:path');

function buildStandalone(root) {
  const read = name => fs.readFileSync(path.join(root, name), 'utf8');
  const background = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets', 'kitchen.png')).toString('base64');
  let html = read('index.html');
  let styles = 0;
  let scripts = 0;

  html = html.replace(/<link rel="stylesheet" href="style\.css">/, () => {
    styles += 1;
    return '<style>\n' + read('style.css') + '\n</style>';
  });

  html = html.replace(/<script src="([a-z]+\.js)"><\/script>/g, (_tag, filename) => {
    let source = read(filename);
    if (filename === 'stage.js') {
      if (!source.includes("'assets/kitchen.png'")) throw new Error('Kitchen background reference changed; update the packer.');
      source = source.replace("'assets/kitchen.png'", () => JSON.stringify(background));
    }
    scripts += 1;
    // Prevent a JavaScript string or comment from closing its containing HTML tag.
    source = source.replace(/<\/script/gi, '<\\/script');
    return '<script data-source="' + filename + '">\n' + source + '\n</script>';
  });

  if (styles !== 1 || scripts !== 7) throw new Error('Expected one stylesheet and seven classic scripts.');
  return html;
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const destination = path.join(root, 'output', '小满食堂-双击即玩.html');
  const html = buildStandalone(root);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html, 'utf8');
  console.log(destination);
  console.log((Buffer.byteLength(html) / 1024 / 1024).toFixed(2) + ' MB; all game resources embedded');
}

module.exports = { buildStandalone };
