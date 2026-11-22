import { Difficulty, MatchPair, Question, QuestionType } from '../types';
import { parseAssertionReason, parseStatementType } from './spreadsheetHelper';

export interface CsvParseResult {
  validQuestions: Omit<Question, 'id'>[];
  errors: { row: number; error: string; rawRow?: string }[];
  totalRows: number;
}

const STANDARD_AR_OPTIONS = [
  'Both (A) and (R) are true and (R) is the correct explanation of (A)',
  'Both (A) and (R) are true but (R) is NOT the correct explanation of (A)',
  '(A) is true but (R) is false',
  '(A) is false but (R) is true',
];

const STANDARD_STATEMENT_OPTIONS = [
  'Both Statement I and Statement II are correct',
  'Both Statement I and Statement II are incorrect',
  'Statement I is correct but Statement II is incorrect',
  'Statement I is incorrect but Statement II is correct',
];

/**
 * Splits CSV lines while respecting quoted cells containing commas and newlines
 */
export function splitCsvLines(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote: "" -> "
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function parseQuestionsCsv(csvContent: string): CsvParseResult {
  const rows = splitCsvLines(csvContent);
  if (rows.length < 2) {
    return {
      validQuestions: [],
      errors: [{ row: 1, error: 'CSV must contain at least a header row and one data row.' }],
      totalRows: 0,
    };
  }

  const rawHeaders = rows[0].map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  const headerMap: Record<string, number> = {};
  rawHeaders.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const getCol = (row: string[], ...aliases: string[]): string => {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idx = headerMap[cleanAlias];
      if (idx !== undefined && row[idx] !== undefined) {
        return row[idx].trim();
      }
    }
    return '';
  };

  const validQuestions: Omit<Question, 'id'>[] = [];
  const errors: { row: number; error: string; rawRow?: string }[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNum = r + 1; // 1-indexed for human readability

    // Extract fields
    const rawType = getCol(row, 'type', 'questiontype', 'qtype').toLowerCase();
    const chapter = getCol(row, 'chapter', 'chaptername', 'subject', 'ch');
    let stem = getCol(row, 'stem', 'question', 'questiontext', 'text');
    const optA = getCol(row, 'optiona', 'opt1', 'a', 'opta');
    const optB = getCol(row, 'optionb', 'opt2', 'b', 'optb');
    const optC = getCol(row, 'optionc', 'opt3', 'c', 'optc');
    const optD = getCol(row, 'optiond', 'opt4', 'd', 'optd');
    const rawAnswer = getCol(row, 'answer', 'correctanswer', 'ans', 'correct');
    const explanation = getCol(row, 'explanation', 'exp', 'solution');
    const reference = getCol(row, 'reference', 'ref', 'source', 'referencesource');
    const rawDiff = getCol(row, 'difficulty', 'diff', 'level').toLowerCase();

    // Conditional fields
    let assertionText = getCol(row, 'assertion', 'assertiontext', 'a_text');
    let reasonText = getCol(row, 'reason', 'reasontext', 'r_text');
    let statement1 = getCol(row, 'statement1', 'stmt1', 's1');
    let statement2 = getCol(row, 'statement2', 'stmt2', 's2');
    const rawMatchPairs = getCol(row, 'matchpairs', 'pairs', 'match');

    // Validation 1: Chapter
    if (!chapter) {
      errors.push({ row: rowNum, error: 'Missing Chapter / ChapterName.' });
      continue;
    }

    // Determine Question Type
    let questionType: QuestionType = 'standard';
    const lowerStem = (stem || '').toLowerCase();
    if (
      rawType.includes('assert') ||
      rawType === 'ar' ||
      (assertionText && reasonText) ||
      (lowerStem.includes('a:') && lowerStem.includes('r:')) ||
      (lowerStem.includes('assertion') && lowerStem.includes('reason')) ||
      (lowerStem.includes('अभिकथन') && (lowerStem.includes('तर्क') || lowerStem.includes('कारण')))
    ) {
      questionType = 'assertion_reason';
    } else if (rawType.includes('match') || rawMatchPairs) {
      questionType = 'match_the_pair';
    } else if (
      rawType.includes('statement') ||
      (statement1 && statement2) ||
      (lowerStem.includes('statement i') && lowerStem.includes('statement ii')) ||
      (lowerStem.includes('कथन i') && lowerStem.includes('कथन ii'))
    ) {
      questionType = 'statement_type';
    }

    // Validation 2: Stem & Content
    if (questionType === 'assertion_reason') {
      if ((!assertionText || !reasonText) && stem) {
        const ext = parseAssertionReason(stem);
        if (!assertionText && ext.assertion) assertionText = ext.assertion;
        if (!reasonText && ext.reason) reasonText = ext.reason;
        if (ext.cleanedStem && (assertionText || reasonText)) {
          stem = ext.cleanedStem;
        }
      }
      if (!assertionText || !reasonText) {
        errors.push({
          row: rowNum,
          error: 'Assertion/Reason questions require both "Assertion" and "Reason" fields.',
        });
        continue;
      }
      if (!stem) {
        stem = 'Given below are two statements, one is labelled as Assertion (A) and the other as Reason (R):';
      }
    } else if (questionType === 'statement_type') {
      if ((!statement1 || !statement2) && stem) {
        const ext = parseStatementType(stem);
        if (!statement1 && ext.statement1) statement1 = ext.statement1;
        if (!statement2 && ext.statement2) statement2 = ext.statement2;
        if (ext.cleanedStem && (statement1 || statement2)) {
          stem = ext.cleanedStem;
        }
      }
      if (!statement1 || !statement2) {
        errors.push({
          row: rowNum,
          error: 'Statement Type questions require both "Statement1" and "Statement2" fields.',
        });
        continue;
      }
      if (!stem) {
        stem = 'In light of the given statements, choose the most appropriate answer:';
      }
    } else if (!stem) {
      errors.push({ row: rowNum, error: 'Missing Question Stem / Text.' });
      continue;
    }

    // Options mapping & fallback
    let options: string[] = [optA, optB, optC, optD].filter(Boolean);
    if (options.length < 4) {
      if (questionType === 'assertion_reason') {
        options = [...STANDARD_AR_OPTIONS];
      } else if (questionType === 'statement_type') {
        options = [...STANDARD_STATEMENT_OPTIONS];
      } else {
        errors.push({
          row: rowNum,
          error: `Incomplete options: Found ${options.length} options, exactly 4 are required.`,
        });
        continue;
      }
    }

    // Validation 3: Correct Answer
    let correctAnswer = -1;
    const cleanAns = rawAnswer.toUpperCase().trim();
    if (['A', 'OPT A', 'OPTION A', '0', '1'].includes(cleanAns)) {
      correctAnswer = 0;
    } else if (['B', 'OPT B', 'OPTION B', '2'].includes(cleanAns)) {
      correctAnswer = 1;
    } else if (['C', 'OPT C', 'OPTION C', '3'].includes(cleanAns)) {
      correctAnswer = 2;
    } else if (['D', 'OPT D', 'OPTION D', '4'].includes(cleanAns)) {
      correctAnswer = 3;
    }

    if (correctAnswer < 0 || correctAnswer > 3) {
      errors.push({
        row: rowNum,
        error: `Invalid answer "${rawAnswer}". Must be A, B, C, D (or 1, 2, 3, 4).`,
      });
      continue;
    }

    // Difficulty
    let difficulty: Difficulty = 1; // Default Medium
    if (rawDiff.includes('easy') || rawDiff === '0') difficulty = 0;
    else if (rawDiff.includes('hard') || rawDiff === '2') difficulty = 2;

    // Parse Match Pairs if present
    let matchPairs: MatchPair[] | undefined;
    if (rawMatchPairs) {
      const pairs = rawMatchPairs.split(/[|;]/).map((p) => p.trim()).filter(Boolean);
      matchPairs = pairs.map((p) => {
        const parts = p.split(/[:=-]/);
        return {
          left: parts[0]?.trim() || '',
          right: parts[1]?.trim() || '',
        };
      });
    }

    validQuestions.push({
      ch: chapter,
      chapterName: chapter,
      questionType,
      stem,
      o: options.slice(0, 4),
      c: correctAnswer,
      d: difficulty,
      explanation: explanation || 'Refer to classical Samhita references.',
      r: reference || 'Ayurvedic Samhita Reference',
      assertionText: assertionText || undefined,
      reasonText: reasonText || undefined,
      statement1: statement1 || undefined,
      statement2: statement2 || undefined,
      matchPairs: matchPairs && matchPairs.length > 0 ? matchPairs : undefined,
      createdAt: new Date().toISOString(),
    });
  }

  return {
    validQuestions,
    errors,
    totalRows: rows.length - 1,
  };
}

/**
 * Generates a clean sample CSV string that can be downloaded or copied
 */
export function generateSampleCsv(): string {
  return `Type,Chapter,Stem,OptionA,OptionB,OptionC,OptionD,Answer,Explanation,Reference,Assertion,Reason,Statement1,Statement2
standard,"Charaka Samhita > Sutrasthana > Chapter 1","Which dosha is pacified primarily by Madhura, Amla, and Lavana rasa?","Vata","Pitta","Kapha","Rakta","A","Madhura, Amla, and Lavana pacify Vata, while Katu, Tikta, and Kashaya aggravate it.","Charaka Sutrasthana 1/66",,,,
assertion_reason,"Charaka Samhita > Sutrasthana > Chapter 1","Assertion and Reason regarding Samanya Vishesha Siddhanta:","Both (A) and (R) are true and (R) is the correct explanation of (A)","Both (A) and (R) are true but (R) is NOT the correct explanation of (A)","(A) is true but (R) is false","(A) is false but (R) is true","A","Samanya leads to increase (Vriddhi) of similar entities because like increases like.","Charaka Sutrasthana 1/44","Samanya (similarity) is the cause of increase in all entities.","Vishesha (dissimilarity) causes decrease and reduction.",,
statement_type,"Charaka Samhita > Sutrasthana > Chapter 1","Evaluate the two statements regarding Dhatu Poshan:","Both Statement I and Statement II are correct","Both Statement I and Statement II are incorrect","Statement I is correct but Statement II is incorrect","Statement I is incorrect but Statement II is correct","A","Both Ksheera Dadhi and Kedari Kulya nyaya explain distinct facets of dhatu nutrition.","Charaka Chikitsa 15",,,"Statement I: Ksheera Dadhi Nyaya explains direct total transformation of previous dhatu into the next.","Statement II: Kedari Kulya Nyaya explains channelized delivery of nutrition to all tissues."
match_the_pair,"Charaka Samhita > Sutrasthana > Chapter 1","Match the Mahabhuta with their dominant Tanmatra:","A-I, B-II, C-III, D-IV","A-II, B-I, C-IV, D-III","A-III, B-IV, C-I, D-II","A-IV, B-III, C-II, D-I","A","Akasha carries Shabda, Vayu has Sparsha, Agni has Rupa, Jala has Rasa.","Charaka Sutrasthana 1/48",,,,`;
}
