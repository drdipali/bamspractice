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

// 2. Fix index.html paths so it works under any subpath (e.g. /repo-name/)
const indexPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Replace absolute /_expo/ with ./_expo/
  html = html.replace(/src="\/_expo\//g, 'src="./_expo/');
  html = html.replace(/href="\/_expo\//g, 'href="./_expo/');
  html = html.replace(/src="\//g, 'src="./');
  
  fs.writeFileSync(indexPath, html);
  console.log('Fixed asset paths in dist/index.html');

  // 3. Create 404.html as a duplicate of index.html for SPA fallback
  const notFoundPath = path.join(distDir, '404.html');
  fs.writeFileSync(notFoundPath, html);
  console.log('Created dist/404.html for GitHub Pages SPA routing');
}

console.log('GitHub Pages preparation completed successfully!');
