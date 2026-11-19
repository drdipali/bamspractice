const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'charak_questions.csv');
const raw = fs.readFileSync(csvPath, 'utf8');

// Parse CSV with quotes support
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
        i++; // skip escaped quote
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

const parsed = parseCSV(raw);
console.log(`Parsed total rows: ${parsed.length}`);

// Sample first 15 rows
parsed.slice(0, 15).forEach((row, idx) => {
  console.log(`\nRow ${idx} (cols=${row.length}):`);
  row.forEach((col, colIdx) => {
    const colLetter = String.fromCharCode(65 + colIdx);
    console.log(`  [Col ${colLetter} / ${colIdx}]: "${col.slice(0, 80).replace(/\n/g, ' ')}"`);
  });
});
