import * as XLSX from 'xlsx';
import { Difficulty, MatchPair, Question, QuestionType } from '../types';

export interface SpreadsheetParseResult {
  validQuestions: Omit<Question, 'id'>[];
  errors: { row: number; error: string; rawSnippet?: string }[];
  totalRows: number;
}

const STANDARD_AR_OPTIONS = [
  'Both (A) and (R) are true and (R) is the correct explanation of (A) / (A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है',
  'Both (A) and (R) are true but (R) is NOT the correct explanation of (A) / (A) और (R) दोनों सही हैं परंतु (R), (A) की सही व्याख्या नहीं है',
  '(A) is true but (R) is false / (A) सही है परंतु (R) सही नहीं है',
  '(A) is false but (R) is true / (A) सही नहीं है परंतु (R) सही है',
];

const STANDARD_STATEMENT_OPTIONS = [
  'Both Statement I and Statement II are correct / दोनों कथन I और II सही हैं',
  'Both Statement I and Statement II are incorrect / दोनों कथन I और II गलत हैं',
  'Statement I is correct but Statement II is incorrect / कथन I सही है परंतु कथन II गलत है',
  'Statement I is incorrect but Statement II is correct / कथन I गलत है परंतु कथन II सही है',
];

/**
 * Parses any uploaded ArrayBuffer (XLSX, XLS, or CSV) or raw CSV text
 * with strict UTF-8 preservation for Sanskrit, Hindi (Devanagari) and IAST diacritics.
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer | Uint8Array | string): SpreadsheetParseResult {
  let workbook: XLSX.WorkBook;

  if (typeof buffer === 'string') {
    workbook = XLSX.read(buffer, { type: 'string', codepage: 65001 });
  } else {
    workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', codepage: 65001 });
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      validQuestions: [],
      errors: [{ row: 1, error: 'Spreadsheet has no worksheets.' }],
      totalRows: 0,
    };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  // Convert sheet to 2D array of string values
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });

  if (rawRows.length < 2) {
    return {
      validQuestions: [],
      errors: [{ row: 1, error: 'Spreadsheet must contain a header row and at least one data row.' }],
      totalRows: 0,
    };
  }

  // Detect header indices
  const headerRow = rawRows[0].map((cell) =>
    String(cell || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  );

  const headerMap: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const getCol = (row: any[], ...aliases: string[]): string => {
    for (const alias of aliases) {
      const clean = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headerMap[clean];
      if (idx !== undefined && row[idx] !== undefined) {
        return String(row[idx]).trim();
      }
    }
    return '';
  };

  const validQuestions: Omit<Question, 'id'>[] = [];
  const errors: { row: number; error: string; rawSnippet?: string }[] = [];

  for (let r = 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rowNum = r + 1;

    // Check if entire row is empty
    if (!row || row.every((c) => !String(c || '').trim())) {
      continue;
    }

    // 1. Column extraction (supporting both unified and multi-column chapter fields)
    const rawType = getCol(row, 'questiontype', 'type', 'qtype').toLowerCase();
    const subject = getCol(row, 'subject', 'samhita', 'text');
    const sthana = getCol(row, 'sthana', 'section', 'sth');
    const chapter = getCol(row, 'chapter', 'chaptername', 'adhyaya', 'ch');

    let stem = getCol(row, 'questiontext', 'stem', 'question', 'text', 'prompt');
    const optA = getCol(row, 'optiona', 'opta', 'a', 'opt1');
    const optB = getCol(row, 'optionb', 'optb', 'b', 'opt2');
    const optC = getCol(row, 'optionc', 'optc', 'c', 'opt3');
    const optD = getCol(row, 'optiond', 'optd', 'd', 'opt4');
    const rawAnswer = getCol(row, 'correctanswer', 'answer', 'ans', 'correct');
    const reference = getCol(row, 'reference', 'ref', 'referenceshloka', 'shloka', 'source');
    const explanation = getCol(row, 'explanation', 'exp', 'solution', 'rationale');
    const rawDiff = getCol(row, 'difficultylevel', 'difficulty', 'diff', 'level').toLowerCase();

    // Positional fallback if named headers were not recognized (e.g. Col 1 = stem, 2 = A, 3 = B, 4 = C, 5 = D, 6 = Ans, 7 = Ref)
    const effectiveStem = stem || (row.length >= 6 ? String(row[1] || '').trim() : '');
    const effectiveOptA = optA || (row.length >= 6 ? String(row[2] || '').trim() : '');
    const effectiveOptB = optB || (row.length >= 6 ? String(row[3] || '').trim() : '');
    const effectiveOptC = optC || (row.length >= 6 ? String(row[4] || '').trim() : '');
    const effectiveOptD = optD || (row.length >= 6 ? String(row[5] || '').trim() : '');
    const effectiveAns = rawAnswer || (row.length >= 7 ? String(row[6] || '').trim() : '');
    const effectiveRef = reference || (row.length >= 8 ? String(row[7] || '').trim() : '');

    // 2. Validate Question Text
    if (!effectiveStem) {
      errors.push({
        row: rowNum,
        error: 'Missing Question Text / Stem.',
        rawSnippet: row.slice(0, 3).join(' | '),
      });
      continue;
    }

    // 3. Resolve Full Chapter Mapping
    let fullChapterName = '';
    if (subject && sthana && chapter) {
      const cleanCh = chapter.toLowerCase().includes('chapter') ? chapter : `Chapter ${chapter}`;
      fullChapterName = `${subject} > ${sthana} > ${cleanCh}`;
    } else if (chapter) {
      if (chapter.includes('>')) {
        fullChapterName = chapter;
      } else if (sthana) {
        fullChapterName = `${subject || 'Charaka Samhita'} > ${sthana} > ${chapter}`;
      } else {
        fullChapterName = chapter;
      }
    } else if (effectiveRef) {
      // Try resolving chapter from reference text like "ca.su 1/1" or "Charaka Sutra 25/40"
      const lowerRef = effectiveRef.toLowerCase();
      let refSthana = 'Sutrasthana';
      if (/nidan|निदान/.test(lowerRef)) refSthana = 'Nidanasthana';
      else if (/viman|विमान/.test(lowerRef)) refSthana = 'Vimanasthana';
      else if (/sharir|शारीर/.test(lowerRef)) refSthana = 'Sharirasthana';
      else if (/indriya|इन्द्रिय/.test(lowerRef)) refSthana = 'Indriyasthana';
      else if (/chikitsa|चिकित्सा/.test(lowerRef)) refSthana = 'Chikitsasthana';
      else if (/kalpa|कल्प/.test(lowerRef)) refSthana = 'Kalpasthana';
      else if (/siddhi|सिद्धि/.test(lowerRef)) refSthana = 'Siddhisthana';

      const chMatch = effectiveRef.match(/(\d{1,2})\s*\/\s*\d+/) || effectiveRef.match(/chapter\s*(\d{1,2})/i);
      const chNum = chMatch ? chMatch[1] : '1';
      fullChapterName = `Charaka Samhita > ${refSthana} > Chapter ${chNum}`;
    } else {
      fullChapterName = 'Charaka Samhita > Sutrasthana > Chapter 1';
    }

    // 4. Determine Question Type
    let questionType: QuestionType = 'standard';
    const lowerStem = effectiveStem.toLowerCase();
    if (rawType.includes('assert') || rawType === 'ar' || (lowerStem.includes('a:') && lowerStem.includes('r:')) || (lowerStem.includes('assertion') && lowerStem.includes('reason'))) {
      questionType = 'assertion_reason';
    } else if (rawType.includes('match') || lowerStem.includes('match') && (lowerStem.includes('column') || lowerStem.includes('list i'))) {
      questionType = 'match_the_pair';
    } else if (rawType.includes('statement') || (lowerStem.includes('statement i') && lowerStem.includes('statement ii'))) {
      questionType = 'statement_type';
    }

    // 5. Options
    let options: string[] = [effectiveOptA, effectiveOptB, effectiveOptC, effectiveOptD].filter(Boolean);
    if (options.length < 4) {
      if (questionType === 'assertion_reason') {
        options = [...STANDARD_AR_OPTIONS];
      } else if (questionType === 'statement_type') {
        options = [...STANDARD_STATEMENT_OPTIONS];
      } else {
        errors.push({
          row: rowNum,
          error: `Incomplete options: Found ${options.length} options, exactly 4 are required.`,
          rawSnippet: effectiveStem.slice(0, 50),
        });
        continue;
      }
    }

    // 6. Correct Answer
    let correctAnswer = -1;
    const cleanAns = effectiveAns.toUpperCase().trim();
    if (['A', 'OPT A', 'OPTION A', '0', '1'].includes(cleanAns)) correctAnswer = 0;
    else if (['B', 'OPT B', 'OPTION B', '2'].includes(cleanAns)) correctAnswer = 1;
    else if (['C', 'OPT C', 'OPTION C', '3'].includes(cleanAns)) correctAnswer = 2;
    else if (['D', 'OPT D', 'OPTION D', '4'].includes(cleanAns)) correctAnswer = 3;

    if (correctAnswer < 0 || correctAnswer > 3) {
      errors.push({
        row: rowNum,
        error: `Invalid or missing correct answer "${effectiveAns}". Must be A, B, C, or D.`,
        rawSnippet: effectiveStem.slice(0, 50),
      });
      continue;
    }

    // 7. Difficulty
    let difficulty: Difficulty = 1;
    if (rawDiff.includes('easy') || rawDiff === '0') difficulty = 0;
    else if (rawDiff.includes('hard') || rawDiff === '2' || questionType === 'assertion_reason') difficulty = 2;

    validQuestions.push({
      ch: fullChapterName,
      chapterName: fullChapterName,
      questionType,
      stem: effectiveStem,
      o: options.slice(0, 4),
      c: correctAnswer,
      d: difficulty,
      explanation: explanation || 'Refer to the classical textual citations above.',
      r: effectiveRef || fullChapterName,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    validQuestions,
    errors,
    totalRows: rawRows.length - 1,
  };
}

/**
 * Generates and triggers download of the sample Excel (.xlsx) or CSV (.csv) template.
 */
export function downloadSampleTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const headers = [
    'Question Type',
    'Subject / Samhita',
    'Sthana',
    'Chapter',
    'Question Text',
    'Option A',
    'Option B',
    'Option C',
    'Option D',
    'Correct Answer',
    'Reference / Shloka',
    'Difficulty',
    'Explanation',
  ];

  const sampleRows = [
    [
      'Standard MCQ',
      'Charaka Samhita',
      'Sutrasthana',
      'Chapter 1',
      'According to Acharya Charak, how many Karana dravyas (causal substances) are there? / आचार्य चरक के अनुसार कारण द्रव्यों की संख्या कितनी है?',
      '4',
      '7',
      '9',
      '6',
      'C',
      'Charaka Samhita - Sutra Sthana - 1/48, खादीन्यात्मा मनः कालो दिशश्च द्रव्यसङ्ग्रहः',
      'Easy',
      'Acharya Charaka mentions 9 Karana dravyas: 5 Mahabhutas + Atma, Manas, Kala, Disha.',
    ],
    [
      'Standard MCQ',
      'Charaka Samhita',
      'Sutrasthana',
      'Chapter 1',
      'Which of the following is NOT a Parthiva dravya (mineral substance) according to Charaka? / निम्नलिखित में से कौन सा पार्थिव द्रव्य नहीं है?',
      'Samlaah / समलाः',
      'Gairika / गैरिक',
      'Suvarna / सुवर्ण',
      'Gorochana / गोरोचन',
      'D',
      'Charaka Samhita - Sutra Sthana - 1/70',
      'Medium',
      'Gorochana is of Jantava (animal) origin, whereas Suvarna, Gairika, and Sikata are Parthiva (minerals).',
    ],
    [
      'Assertion / Reason',
      'Charaka Samhita',
      'Sutrasthana',
      'Chapter 1',
      'Given below are two statements. A: Tridanda consists of Satva, Atma, and Shareera. R: The universe rests upon their combination like a tripod. / नीचे दो कथन दिए गए हैं।',
      'Both (A) and (R) are true and (R) is the correct explanation of (A) / (A) और (R) दोनों सही हैं',
      'Both (A) and (R) are true but (R) is NOT the correct explanation of (A)',
      '(A) is true but (R) is false',
      '(A) is false but (R) is true',
      'A',
      'ca.su 1/46, सत्त्वमात्मा शरीरं च त्रयमेतत्त्रिदण्डवत्| लोकस्तिष्ठति संयोगात्तत्र सर्वं प्रतिष्ठितम्||',
      'Hard',
      'Satva, Atma, and Shareera constitute the classical Tridanda upon which the sentient universe stands.',
    ],
    [
      'Standard MCQ',
      'Charaka Samhita',
      'Sutrasthana',
      'Chapter 26',
      'How many Rasas (tastes) are accepted by Acharya Atreya in Atreya Bhadrakapya Adhyaya? / आचार्य आत्रेय के अनुसार रस कितने प्रकार के हैं?',
      '5',
      '6',
      '7',
      '8',
      'B',
      'Charaka Sutrasthana 26/9, षडेव रसा इत्युवाच भगवानात्रेयः पुनर्वसुः',
      'Easy',
      'Shad Rasas: Madhura, Amla, Lavana, Katu, Tikta, Kashaya.',
    ],
  ];

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths for comfortable reading
    ws['!cols'] = [
      { wch: 18 }, // Type
      { wch: 18 }, // Subject
      { wch: 16 }, // Sthana
      { wch: 14 }, // Chapter
      { wch: 55 }, // Question Text
      { wch: 22 }, // Opt A
      { wch: 22 }, // Opt B
      { wch: 22 }, // Opt C
      { wch: 22 }, // Opt D
      { wch: 14 }, // Answer
      { wch: 45 }, // Reference
      { wch: 12 }, // Difficulty
      { wch: 45 }, // Explanation
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Questions Template');
    XLSX.writeFile(wb, 'bams_questions_template.xlsx');
  } else {
    // CSV with UTF-8 BOM (\uFEFF) so Excel opens Hindi / Sanskrit and diacritics correctly
    const escapeCsv = (val: string) => {
      const s = String(val || '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csvLines = [headers.map(escapeCsv).join(',')];
    sampleRows.forEach((row) => {
      csvLines.push(row.map(escapeCsv).join(','));
    });

    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bams_questions_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
