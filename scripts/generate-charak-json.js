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

  const m = ref.match(/(\d{1,2})\s*\/\s*\d+/) ||
            ref.match(/-\s*(\d{1,2})\s*\//) ||
            ref.match(/chapter\s*(\d{1,2})/i) ||
            ref.match(/अध्याय\s*(\d{1,2})/);
  
  const ch = m ? parseInt(m[1], 10) : null;
  return { sthana, ch };
}

const ansMap = { a: 0, b: 1, c: 2, d: 3 };

const rows = parseCSV(raw);
const questions = [];

let currentSthana = 'Sutrasthana';
let currentChapter = 1;

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 6) continue;

  const colA = (r[0] || '').trim();
  const stem = (r[1] || '').trim();
  const oA = (r[2] || '').trim();
  const oB = (r[3] || '').trim();
  const oC = (r[4] || '').trim();
  const oD = (r[5] || '').trim();
  const ansLetter = (r[6] || '').trim().toLowerCase();
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

  if (!stem || (!oA && !oB) || ansMap[ansLetter] === undefined) {
    continue;
  }

  const parsedRef = parseReference(ref);
  const sthana = parsedRef?.sthana || currentSthana;
  const ch = parsedRef?.ch || currentChapter;
  if (parsedRef?.ch) {
    currentChapter = ch;
    if (parsedRef.sthana) currentSthana = parsedRef.sthana;
  }

  const lowerStem = stem.toLowerCase();
  let questionType = 'standard';
  if (lowerStem.includes('a:') && lowerStem.includes('r:') || lowerStem.includes('assertion') && lowerStem.includes('reason')) {
    questionType = 'assertion_reason';
  } else if (lowerStem.includes('match') && (lowerStem.includes('column') || lowerStem.includes('list i') || lowerStem.includes('सूची'))) {
    questionType = 'match_pair';
  } else if (lowerStem.includes('statement i') && lowerStem.includes('statement ii') || lowerStem.includes('कथन i') && lowerStem.includes('कथन ii')) {
    questionType = 'statement';
  }

  const chapterPath = `Charaka Samhita > ${sthana} > Chapter ${ch}`;

  questions.push({
    id: `q_ca_${sthana.slice(0, 2).toLowerCase()}_${ch}_${questions.length + 1}`,
    ch: chapterPath,
    chapterName: chapterPath,
    stem,
    o: [oA, oB, oC, oD].filter(Boolean),
    c: ansMap[ansLetter],
    r: ref || `Charaka Samhita ${sthana} ${ch}`,
    d: questionType === 'assertion_reason' ? 2 : 1,
    questionType,
    createdAt: '2026-11-19T10:00:00.000Z',
  });
}

const outputPath = path.join(__dirname, '..', 'src', 'data', 'charakQuestions.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(questions));

const stat = fs.statSync(outputPath);
console.log(`Generated ${questions.length} questions in ${outputPath}`);
console.log(`JSON File Size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
