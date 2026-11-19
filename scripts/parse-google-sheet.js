const https = require('https');
const fs = require('fs');

const url = 'https://docs.google.com/spreadsheets/d/1-3E3lVtbN-rAQ69FRb8xric5KsV48TPVbctyxahSu5s/edit?usp=sharing';

function get(u) {
  return new Promise((resolve, reject) => {
    https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching Google Sheet HTML metadata...');
  const html = await get(url);
  
  // Look for sheet tabs in bootstrap data
  const matches = [...html.matchAll(/"name":"([^"]+)"[^}]*"sheetId":(\d+)/g)];
  if (matches.length > 0) {
    console.log(`Found ${matches.length} sheet tabs:`);
    matches.forEach(m => console.log(`  - "${m[1]}" (gid=${m[2]})`));
  } else {
    const fallbackMatches = [...html.matchAll(/gid=(\d+)[^"]*"[^>]*>([^<]+)/g)];
    console.log(`Fallback matches: ${fallbackMatches.length}`);
    fallbackMatches.forEach(m => console.log(`  - ${m[2]} (gid=${m[1]})`));
  }
}

run().catch(console.error);
