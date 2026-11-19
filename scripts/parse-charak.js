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
console.log('Total raw rows:', rows.length);

const sthanaKeywords = {
  su: 'Sutrasthana',
  sutra: 'Sutrasthana',
  ni: 'Nidanasthana',
  nidan: 'Nidanasthana',
  vi: 'Vimanasthana',
  viman: 'Vimanasthana',
  sha: 'Sharirasthana',
  sharir: 'Sharirasthana',
  in: 'Indriyasthana',
  indriya: 'Indriyasthana',
  chi: 'Chikitsasthana',
  chikitsa: 'Chikitsasthana',
  ka: 'Kalpasthana',
  kalpa: 'Kalpasthana',
  si: 'Siddhisthana',
  siddhi: 'Siddhisthana',
};

// Track current section/chapter from headers or Col H
let currentSthana = 'Sutrasthana';
let currentChapter = 1;

let validQuestions = 0;
const chapterCounts = {};
const unmappedReferences = [];

for (let r = 0; r < rows.length; r++) {
  const row = rows[r];
  if (!row || row.length < 2) continue;

  const colA = (row[0] || '').trim();
  const colB = (row[1] || '').trim();
  const colC = (row[2] || '').trim();
  const colD = (row[3] || '').trim();
  const colE = (row[4] || '').trim();
  const colF = (row[5] || '').trim();
  const colG = (row[6] || '').trim().toLowerCase();
  const colH = (row[7] || '').trim();

  // Check if header row like "Sutra,chapter 1"
  if (colA && isNaN(Number(colA))) {
    const lowerA = colA.toLowerCase();
    const lowerB = colB.toLowerCase();
    for (const [k, v] of Object.entries(sthanaKeywords)) {
      if (lowerA.includes(k)) currentSthana = v;
    }
    const chMatch = (lowerA + ' ' + lowerB).match(/chapter\s*(\d+)/i) || (lowerA + ' ' + lowerB).match(/ch\s*(\d+)/i);
    if (chMatch) {
      currentChapter = parseInt(chMatch[1], 10);
    }
    continue;
  }

  // Question row
  if (colB && colC && colD && colE && colF) {
    let sthana = currentSthana;
    let chNum = currentChapter;

    // Check Col H for reference override:
    // e.g. "ca.su 1/1", "च.सू - 1/58", "Charaka Samhita - Sutra Sthana - 1/ 48", "ca.chi 15/2", "च.चि. 3/12"
    if (colH) {
      const hLower = colH.toLowerCase();
      
      // Match Sthana
      if (hLower.includes('sutra') || hLower.includes('su ') || hLower.includes('.su') || hLower.includes('सू')) {
        sthana = 'Sutrasthana';
      } else if (hLower.includes('nidan') || hLower.includes('ni ') || hLower.includes('.ni') || hLower.includes('नि')) {
        sthana = 'Nidanasthana';
      } else if (hLower.includes('viman') || hLower.includes('vi ') || hLower.includes('.vi') || hLower.includes('वि')) {
        sthana = 'Vimanasthana';
      } else if (hLower.includes('sharir') || hLower.includes('sha ') || hLower.includes('.sha') || hLower.includes('शा')) {
        sthana = 'Sharirasthana';
      } else if (hLower.includes('indriya') || hLower.includes('in ') || hLower.includes('.in') || hLower.includes('इ')) {
        sthana = 'Indriyasthana';
      } else if (hLower.includes('chikitsa') || hLower.includes('chi ') || hLower.includes('.chi') || hLower.includes('चि')) {
        sthana = 'Chikitsasthana';
      } else if (hLower.includes('kalpa') || hLower.includes('ka ') || hLower.includes('.ka') || hLower.includes('कल्प')) {
        sthana = 'Kalpasthana';
      } else if (hLower.includes('siddhi') || hLower.includes('si ') || hLower.includes('.si') || hLower.includes('सि')) {
        sthana = 'Siddhisthana';
      }

      // Match chapter number from patterns like:
      // "1/ 48", "1/1", "1 / 48", "15/2", "च.सू - 1/58", "30 /33"
      const numMatch = colH.match(/(\d+)\s*\/\s*\d+/) || colH.match(/-\s*(\d+)\s*\//) || colH.match(/chapter\s*(\d+)/i) || colH.match(/ch\s*(\d+)/i);
      if (numMatch) {
        chNum = parseInt(numMatch[1], 10);
      }
    }

    const key = `Charaka Samhita > ${sthana} > Chapter ${chNum}`;
    chapterCounts[key] = (chapterCounts[key] || 0) + 1;
    validQuestions++;
  }
}

console.log('\nTotal Valid Questions extracted:', validQuestions);
console.log('Chapters found:', Object.keys(chapterCounts).length);
console.log('\nTop 20 Chapters by Question Count:');
Object.entries(chapterCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .forEach(([ch, count]) => console.log(`  ${ch}: ${count} questions`));
