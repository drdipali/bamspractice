const https = require('https');
const fs = require('fs');
const path = require('path');

const csvUrl = 'https://docs.google.com/spreadsheets/d/1-3E3lVtbN-rAQ69FRb8xric5KsV48TPVbctyxahSu5s/export?format=csv';
const destPath = path.join(__dirname, 'charak_questions.csv');

function download(u, dest) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download: status ${res.statusCode}`));
      }
      const file = fs.createWriteStream(dest, { encoding: 'utf8' });
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function run() {
  console.log('Downloading CSV from Google Sheets...');
  await download(csvUrl, destPath);
  const stats = fs.statSync(destPath);
  console.log(`Saved ${destPath} (${stats.size} bytes).`);

  const content = fs.readFileSync(destPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  console.log('First 5 lines:');
  lines.slice(0, 5).forEach((line, i) => console.log(`[Line ${i}]: ${line.slice(0, 150)}`));
}

run().catch(console.error);
