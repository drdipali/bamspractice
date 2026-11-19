const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'charak_questions.csv');
const raw = fs.readFileSync(csvPath, 'utf8');

// Use simple line check for headers
const lines = raw.split(/\r?\n/);
lines.forEach((l, idx) => {
  const firstComma = l.indexOf(',');
  if (firstComma > -1) {
    const colA = l.slice(0, firstComma).trim();
    if (colA && isNaN(Number(colA)) && colA.length < 30) {
      console.log(`Line ${idx}: ColA="${colA}", rest="${l.slice(firstComma + 1, firstComma + 50)}"`);
    }
  }
});
