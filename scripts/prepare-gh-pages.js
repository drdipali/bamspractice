const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('dist directory does not exist. Run "expo export --platform web" first.');
  process.exit(1);
}

// 1. Create .nojekyll so GitHub Pages does not ignore _expo directory
const nojekyllPath = path.join(distDir, '.nojekyll');
fs.writeFileSync(nojekyllPath, '');
console.log('Created .nojekyll in dist/');

// 2. Fix index.html paths and inject cache-busting so browsers never serve stale bundles
const indexPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Replace absolute /_expo/ with ./_expo/
  html = html.replace(/src="\/_expo\//g, 'src="./_expo/');
  html = html.replace(/href="\/_expo\//g, 'href="./_expo/');
  html = html.replace(/src="\//g, 'src="./');

  // Cache busting meta tags to prevent stale cached bundles
  const cacheBustMeta = `
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
  `;
  if (!html.includes('http-equiv="Cache-Control"')) {
    html = html.replace('<head>', `<head>${cacheBustMeta}`);
  }

  // Append timestamp cache-buster query parameter to bundled JavaScript
  const buildTimestamp = Date.now();
  html = html.replace(/(\.js)(" defer)/g, `$1?v=${buildTimestamp}$2`);
  
  fs.writeFileSync(indexPath, html);
  console.log(`Fixed asset paths and added cache-buster (?v=${buildTimestamp}) in dist/index.html`);

  // 3. Create 404.html as a duplicate of index.html for SPA fallback
  const notFoundPath = path.join(distDir, '404.html');
  fs.writeFileSync(notFoundPath, html);
  console.log('Created dist/404.html for GitHub Pages SPA routing');
}

console.log('GitHub Pages preparation completed successfully!');
