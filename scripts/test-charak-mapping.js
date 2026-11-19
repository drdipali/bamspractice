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

function parseReference(ref) {
  if (!ref) return null;
  const lower = ref.toLowerCase();

  let sthana = null;
  if (/sutra|sūtra|su\b|\.su|सूत्र|सू\b/.test(lower)) sthana = 'Sutrasthana';
  else if (/nidan|nidāna|ni\b|\.ni|निदान|नि\b/.test(lower)) sthana = 'Nidanasthana';
  else if (/viman|vimāna|vi\b|\.vi|विमान|वि\b/.test(lower)) sthana = 'Vimanasthana';
  else if (/sharir|śarīr|sha\b|\.sha|शारीर|शा\b/.test(lower)) sthana = 'Sharirasthana';
  else if (/indriya|in\b|\.in|इन्द्रिय|इं\b/.test(lower)) sthana = 'Indriyasthana';
  else if (/chikitsa|cikitsā|chi\b|\.chi|चिकित्सा|चि\b/.test(lower)) sthana = 'Chikitsasthana';
  else if (/kalpa|ka\b|\.ka|कल्प|क\b/.test(lower)) sthana = 'Kalpasthana';
  else if (/siddhi|si\b|\.si|सिद्धि|सि\b/.test(lower)) sthana = 'Siddhisthana';

  // Extract chapter: e.g. "25/40", "1/ 117", "- 1/58", "12/8.2"
  const m = ref.match(/(\d{1,2})\s*\/\s*\d+/) ||
            ref.match(/-\s*(\d{1,2})\s*\//) ||
            ref.match(/chapter\s*(\d{1,2})/i) ||
            ref.match(/अध्याय\s*(\d{1,2})/);
  
  const ch = m ? parseInt(m[1], 10) : null;
  return { sthana, ch };
}

let mapped = 0;
let fallbackToRow = 0;
let invalid = 0;

let currentSthana = 'Sutrasthana';
let currentChapter = 1;

const breakdown = {};

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 6) continue;

  const colA = (r[0] || '').trim();
  const stem = (r[1] || '').trim();
  const oA = (r[2] || '').trim();
  const oB = (r[3] || '').trim();
  const oC = (r[4] || '').trim();
  const oD = (r[5] || '').trim();
  const ans = (r[6] || '').trim().toLowerCase();
  const ref = (r[7] || '').trim();

  // Header row check
  if (colA && isNaN(Number(colA))) {
    const combined = (colA + ' ' + stem).toLowerCase();
    if (combined.includes('sutra') || combined.includes('सूत्र')) currentSthana = 'Sutrasthana';
    else if (combined.includes('nidan') || combined.includes('निदान')) currentSthana = 'Nidanasthana';
    else if (combined.includes('viman') || combined.includes('विमान')) currentSthana = 'Vimanasthana';
    else if (combined.includes('sharir') || combined.includes('शारीर')) currentSthana = 'Sharirasthana';
    else if (combined.includes('indriya') || combined.includes('इन्द्रिय')) currentSthana = 'Indriyasthana';
    else if (combined.includes('chikitsa') || combined.includes('चिकित्सा')) currentSthana = 'Chikitsasthana';
    else if (combined.includes('kalpa') || combined.includes('कल्प')) currentSthana = 'Kalpasthana';
    else if (combined.includes('siddhi') || combined.includes('सिद्धि')) currentSthana = 'Siddhisthana';

    const chM = combined.match(/chapter\s*(\d+)/i) || combined.match(/अध्याय\s*(\d+)/);
    if (chM) currentChapter = parseInt(chM[1], 10);
    continue;
  }

  // Must have question text and at least 2 non-empty options
  if (!stem || (!oA && !oB)) {
    invalid++;
    continue;
  }

  const parsedRef = parseReference(ref);
  const sthana = parsedRef?.sthana || currentSthana;
  const ch = parsedRef?.ch || currentChapter;

  if (parsedRef?.ch) {
    mapped++;
    currentChapter = ch;
    if (parsedRef.sthana) currentSthana = parsedRef.sthana;
  } else {
    fallbackToRow++;
  }

  const key = `Charaka Samhita > ${sthana} > Chapter ${ch}`;
  breakdown[key] = (breakdown[key] || 0) + 1;
}

console.log(`\nMapping results:`);
console.log(`Directly parsed from Column H reference: ${mapped}`);
console.log(`Contextual fallback: ${fallbackToRow}`);
console.log(`Total valid questions: ${mapped + fallbackToRow}`);
console.log(`Invalid / empty rows: ${invalid}`);
console.log(`Unique Chapters populated: ${Object.keys(breakdown).length}`);

console.log('\nBreakdown by Sthana:');
const sthanaTotals = {};
Object.entries(breakdown).forEach(([k, count]) => {
  const parts = k.split(' > ');
  sthanaTotals[parts[1]] = (sthanaTotals[parts[1]] || 0) + count;
});
console.table(sthanaTotals);

console.log('\nTop 15 Chapters:');
Object.entries(breakdown)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([k, c]) => console.log(`  ${k}: ${c} questions`));
