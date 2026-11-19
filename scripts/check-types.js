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
const typeCounts = {
  standard: 0,
  assertion_reason: 0,
  match_pair: 0,
  statement: 0,
};

rows.forEach((r) => {
  if (r.length < 7) return;
  const stem = (r[1] || '').trim();
  const oA = (r[2] || '').trim();
  const ans = (r[6] || '').trim().toLowerCase();
  if (!stem || !['a', 'b', 'c', 'd'].includes(ans)) return;

  const lower = stem.toLowerCase();
  if (lower.includes('a:') && lower.includes('r:') || lower.includes('assertion') && lower.includes('reason')) {
    typeCounts.assertion_reason++;
  } else if (lower.includes('match') && (lower.includes('column') || lower.includes('list i') || lower.includes('सूची'))) {
    typeCounts.match_pair++;
  } else if (lower.includes('statement i') && lower.includes('statement ii') || lower.includes('कथन i') && lower.includes('कथन ii')) {
    typeCounts.statement++;
  } else {
    typeCounts.standard++;
  }
});

console.log('Question Types breakdown:');
console.table(typeCounts);
