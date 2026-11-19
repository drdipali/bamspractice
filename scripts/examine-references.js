const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'charak_questions.csv');
const raw = fs.readFileSync(csvPath, 'utf8');

function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current);
      lines.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    lines.push(row);
  }
  return lines;
}

const rows = parseCSV(raw);
console.log('Total parsed rows:', rows.length);

const references = new Set();
const refPatterns = {};

rows.forEach((r, idx) => {
  if (r.length >= 8 && r[7]) {
    const ref = r[7].trim();
    // take the first 40 chars of ref
    const prefix = ref.slice(0, 40).replace(/\n/g, ' ');
    refPatterns[prefix] = (refPatterns[prefix] || 0) + 1;
  }
});

console.log('Sample reference prefixes in Column H:');
Object.entries(refPatterns)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)
  .forEach(([pat, count]) => {
    console.log(`  [${count}x]: "${pat}"`);
  });
