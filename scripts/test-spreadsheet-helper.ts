import { parseSpreadsheetBuffer } from '../src/utils/spreadsheetHelper';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
  console.log('Testing spreadsheetHelper...');
  const csvPath = path.join(__dirname, 'charak_questions.csv');
  const buffer = fs.readFileSync(csvPath);

  const res = parseSpreadsheetBuffer(buffer);
  console.log(`Parsed total rows: ${res.totalRows}`);
  console.log(`Valid questions: ${res.validQuestions.length}`);
  console.log(`Errors: ${res.errors.length}`);

  if (res.validQuestions.length > 5000) {
    console.log('✅ Successfully parsed over 5000 questions with spreadsheetHelper!');
  } else {
    throw new Error(`Expected > 5000 questions, got ${res.validQuestions.length}`);
  }

  const q0 = res.validQuestions[0];
  console.log('First question sample:');
  console.log('  Stem:', q0.stem.slice(0, 80));
  console.log('  Chapter:', q0.chapterName);
  console.log('  Answer index:', q0.c);
  console.log('  Reference:', q0.r);
  console.log('  Options:', q0.o);
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
