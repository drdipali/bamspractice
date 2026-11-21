import * as XLSX from 'xlsx';
import { Difficulty, MatchPair, Question, QuestionType } from '../types';
import { detectChapterInfo, ContextHints } from './chapterMapper';

export interface SpreadsheetParseResult {
  validQuestions: Omit<Question, 'id'>[];
  errors: { row: number; error: string; rawSnippet?: string }[];
  totalRows: number;
}

export interface GoogleSheetPreviewStats {
  totalRows: number;
  validCount: number;
  newCount: number;
  duplicateCount: number;
  errorCount: number;
  validQuestions: Omit<Question, 'id'>[];
  duplicateQuestions: { incomingIndex: number; stem: string; existingId: string | number }[];
  errors: { row: number; error: string; rawSnippet?: string }[];
}

/**
 * Normalizes question stem text for accurate duplicate detection across languages,
 * removing whitespace, newlines, and punctuation while strictly preserving Sanskrit,
 * Devanagari Hindi and English Unicode alphanumeric characters.
 */
export function normalizeQuestionStem(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 160);
}

/**
 * Converts any standard Google Sheet URL (edit, share, pubhtml, export) into
 * a direct Google CSV export URL with strict UTF-8 output.
 */
/**
 * Converts any standard Google Sheet URL (edit, share, pubhtml, export) into
 * candidate Google CSV export URLs with strict UTF-8 output.
 */
export function extractGoogleSheetCsvCandidates(rawUrl: string): {
  candidateUrls: string[];
  sheetId: string;
  gid?: string;
  isTruncated?: boolean;
} | null {
  const url = (rawUrl || '').trim();
  if (!url) return null;

  // 1. Direct published web link
  // e.g. https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv
  if (url.includes('/spreadsheets/d/e/')) {
    let clean = url;
    if (clean.includes('pub?output=csv')) {
      return { candidateUrls: [clean], sheetId: 'pub_web' };
    }
    if (clean.includes('/pub')) {
      clean = clean.replace(/\/pub(\?.*)?$/, '/pub?output=csv');
      return { candidateUrls: [clean], sheetId: 'pub_web' };
    }
    if (clean.includes('/pubhtml')) {
      clean = clean.replace(/\/pubhtml(\?.*)?$/, '/pub?output=csv');
      return { candidateUrls: [clean], sheetId: 'pub_web' };
    }
  }

  // 2. Standard Google Sheet or Google Drive file URL
  let sheetId = '';
  const sheetIdMatch = url.match(/(?:\/spreadsheets\/d\/|\/file\/d\/)([a-zA-Z0-9-_]+)/);
  if (sheetIdMatch && sheetIdMatch[1]) {
    sheetId = sheetIdMatch[1];
  } else {
    const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idParamMatch && idParamMatch[1]) {
      sheetId = idParamMatch[1];
    }
  }

  if (!sheetId) {
    if (url.startsWith('http') && (url.includes('.csv') || url.includes('format=csv') || url.includes('output=csv'))) {
      return { candidateUrls: [url], sheetId: 'custom' };
    }
    return null;
  }

  const isTruncated = sheetId.length < 28;

  // Extract explicit GID if present in user URL
  const gidMatch = url.match(/[#?&]gid=([0-9]+)/);
  const explicitGid = gidMatch ? gidMatch[1] : undefined;

  const candidateUrls: string[] = [];

  // Candidate 1: Google Visualization API (Direct HTTP 200, CORS enabled, no 307 redirect, works on public sheets)
  if (explicitGid) {
    candidateUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${explicitGid}`);
  }
  candidateUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`);

  // Candidate 2: Standard Google export endpoint (omit gid if not explicit so it defaults to active sheet)
  if (explicitGid) {
    candidateUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${explicitGid}`);
  }
  candidateUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`);

  // Candidate 3: Standard Google export endpoint with gid=0
  if (!explicitGid) {
    candidateUrls.push(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`);
  }

  // Candidate 4: Google Drive direct download endpoint
  candidateUrls.push(`https://drive.google.com/uc?export=download&id=${sheetId}`);

  return {
    candidateUrls: Array.from(new Set(candidateUrls)),
    sheetId,
    gid: explicitGid,
    isTruncated,
  };
}

export function extractGoogleSheetCsvUrl(rawUrl: string): {
  csvUrl: string;
  sheetId: string;
  gid: string;
} | null {
  const result = extractGoogleSheetCsvCandidates(rawUrl);
  if (!result || result.candidateUrls.length === 0) return null;
  return {
    csvUrl: result.candidateUrls[0],
    sheetId: result.sheetId,
    gid: result.gid || '0',
  };
}

/**
 * Live-fetches CSV data from Google Sheets across prioritized candidate endpoints,
 * supporting Visualization API, Export API, and Published web links with strict UTF-8 charset.
 */
export async function fetchGoogleSheetCsv(sheetUrl: string): Promise<string> {
  const result = extractGoogleSheetCsvCandidates(sheetUrl);
  if (!result) {
    throw new Error(
      'Invalid Google Sheet link. Please paste a valid Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/SHEET_ID/edit).'
    );
  }

  if (result.isTruncated) {
    throw new Error(
      `The Google Sheet ID in the link appears incomplete or truncated ("${result.sheetId}"). Google Sheet IDs are normally ~44 characters long. Please ensure you copied the complete URL from your browser address bar.`
    );
  }

  let lastStatus = 0;
  let lastStatusText = '';
  let lastError: any = null;

  for (const candidateUrl of result.candidateUrls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);

    try {
      const res = await fetch(candidateUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 0) {
          // If Google returned an HTML login page or service redirection
          if (
            text.includes('<!DOCTYPE html>') ||
            text.includes('<html') ||
            text.includes('accounts.google.com') ||
            text.includes('serviceLogin')
          ) {
            lastStatus = 403;
            continue;
          }
          // Valid CSV data found!
          return text;
        }
      } else {
        lastStatus = res.status;
        lastStatusText = res.statusText || '';
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }

  // If all candidate URLs failed
  if (lastStatus === 400) {
    throw new Error(
      `Google could not open this sheet (HTTP 400 Bad Request). Common causes:
1. The spreadsheet ID may be incomplete or invalid.
2. The sheet is not shared publicly.
Quick Fix: In your Google Sheet, click File → Share → Publish to web → Comma-separated values (.csv) and paste that link here, or download the CSV to your device and choose "Upload CSV / Excel File Instead".`
    );
  }

  if (lastStatus === 401 || lastStatus === 403) {
    throw new Error(
      "Make sure the Google Sheet sharing is set to 'Anyone with the link can view' (or connect Google Drive)."
    );
  }

  if (lastStatus === 404) {
    throw new Error(
      `Google Sheet Not Found (HTTP 404): The requested spreadsheet does not exist or has been deleted. Please check your URL.`
    );
  }

  if (lastError?.name === 'AbortError') {
    throw new Error(
      'Connection timed out after 18 seconds while downloading Google Sheet. Please check your internet connection or verify the sheet link.'
    );
  }

  if (lastError?.message && lastError.message.toLowerCase().includes('failed to fetch')) {
    throw new Error(
      'Browser network/CORS restriction: Unable to download sheet directly. Please ensure the Google Sheet is shared as "Anyone with the link can view", or use File → Share → Publish to web → CSV and paste that link.'
    );
  }

  throw new Error(
    `Failed to access Google Sheet (HTTP ${lastStatus || 'Error'}${lastStatusText ? `: ${lastStatusText}` : ''}). Please ensure the sheet is shared as "Anyone with the link can view", or use File → Share → Publish to web → CSV.`
  );
}

/**
 * Previews Google Sheet parsed questions against existing Cloud DB questions,
 * isolating duplicates and identifying brand new additions.
 */
export function calculateGoogleSheetPreview(
  parsed: SpreadsheetParseResult,
  existingQuestions: Question[]
): GoogleSheetPreviewStats {
  const existingStemMap = new Map<string, Question>();
  existingQuestions.forEach((q) => {
    const key = normalizeQuestionStem(q.stem);
    if (key && !existingStemMap.has(key)) {
      existingStemMap.set(key, q);
    }
  });

  const duplicateQuestions: { incomingIndex: number; stem: string; existingId: string | number }[] = [];
  let newCount = 0;

  parsed.validQuestions.forEach((q, idx) => {
    const key = normalizeQuestionStem(q.stem);
    const existing = key ? existingStemMap.get(key) : undefined;
    if (existing) {
      duplicateQuestions.push({
        incomingIndex: idx + 1,
        stem: q.stem,
        existingId: existing.id,
      });
    } else {
      newCount++;
    }
  });

  return {
    totalRows: parsed.totalRows,
    validCount: parsed.validQuestions.length,
    newCount,
    duplicateCount: duplicateQuestions.length,
    errorCount: parsed.errors.length,
    validQuestions: parsed.validQuestions,
    duplicateQuestions,
    errors: parsed.errors,
  };
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

export interface WorkbookTabResult {
  sheetName: string;
  totalRows: number;
  validQuestions: Omit<Question, 'id'>[];
  errors: { row: number; error: string; rawSnippet?: string }[];
}

/**
 * Parses any uploaded ArrayBuffer (XLSX, XLS, or CSV) or raw CSV text
 * with strict UTF-8 preservation for Sanskrit, Hindi (Devanagari) and IAST diacritics.
 */
export function parseSpreadsheetBuffer(
  buffer: ArrayBuffer | Uint8Array | string,
  contextHint?: ContextHints
): SpreadsheetParseResult {
  let workbook: XLSX.WorkBook;

  try {
    if (typeof buffer === 'string') {
      workbook = XLSX.read(buffer, { type: 'string', codepage: 65001 });
    } else {
      workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', codepage: 65001 });
    }
  } catch (err: any) {
    throw new Error(`Failed to parse file: ${err.message || 'Corrupted or unsupported format'}`);
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

  return parseSpreadsheetRows(rawRows, contextHint);
}

/**
 * Parses an Excel (.xlsx/.xls) or CSV buffer and extracts questions from ALL worksheets/tabs.
 */
export function parseWorkbookAllTabs(
  buffer: ArrayBuffer | Uint8Array | string,
  contextHint?: ContextHints
): WorkbookTabResult[] {
  let workbook: XLSX.WorkBook;

  try {
    if (typeof buffer === 'string') {
      workbook = XLSX.read(buffer, { type: 'string', codepage: 65001 });
    } else {
      workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', codepage: 65001 });
    }
  } catch (err: any) {
    throw new Error(`Failed to parse file: ${err.message || 'Corrupted or unsupported format'}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return [
      {
        sheetName: 'Sheet1',
        totalRows: 0,
        validQuestions: [],
        errors: [{ row: 1, error: 'Spreadsheet contains no worksheets.' }],
      },
    ];
  }

  const results: WorkbookTabResult[] = [];
  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });

    const parsed = parseSpreadsheetRows(rawRows, {
      fileName: contextHint?.fileName,
      tabName: sheetName,
      defaultSubject: contextHint?.defaultSubject,
    });
    results.push({
      sheetName,
      totalRows: parsed.totalRows,
      validQuestions: parsed.validQuestions,
      errors: parsed.errors,
    });
  }

  return results;
}

/**
 * Parses a 2D array of string/cell values (from Excel, CSV, or Google Sheets API)
 * with automatic header detection (named headers vs positional layout),
 * smart serial-number column detection (+1 column shift handling), and UTF-8 preservation.
 */
export function parseSpreadsheetRows(
  rawRows: any[][],
  contextHint?: ContextHints
): SpreadsheetParseResult {
  if (!rawRows || rawRows.length < 1) {
    return {
      validQuestions: [],
      errors: [{ row: 1, error: 'Spreadsheet contains no data rows.' }],
      totalRows: 0,
    };
  }

  // Helper to check if a cell value looks like a serial number (1, 234, 360, 420, 1., etc.) or serial header
  const isSerialCell = (val: string): boolean => {
    const s = String(val || '').trim();
    return (
      /^\d+\.?$/.test(s) ||
      /^(?:sr\.?\s*no\.?|s\.?\s*no\.?|q\.?\s*no\.?|qno|slno|#|id|serial|no)$/i.test(s)
    );
  };

  // Inspect the first few rows (up to 12) to detect if Column 0 is consistently a serial number
  // while Column 1 contains actual question text (length > 15)
  let sampleSerialCount = 0;
  let sampleValidCount = 0;
  for (let sIdx = 0; sIdx < Math.min(12, rawRows.length); sIdx++) {
    const sRow = rawRows[sIdx];
    if (!sRow || sRow.length < 2) continue;
    const c0 = String(sRow[0] || '').trim();
    const c1 = String(sRow[1] || '').trim();
    if (c0 || c1) {
      sampleValidCount++;
      if (isSerialCell(c0) && c1.length > 15) {
        sampleSerialCount++;
      }
    }
  }

  const sheetHasSerialCol0 = sampleSerialCount > 0 && sampleSerialCount >= sampleValidCount * 0.35;

  // 1. Detect if sheet has named headers in row 0 or row 1
  const row0Clean = rawRows[0].map((cell) =>
    String(cell || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  );

  const hasNamedHeaderRow0 = row0Clean.some((h) =>
    ['question', 'stem', 'questiontext', 'qtext', 'questionstem', 'prompt'].includes(h)
  );

  let startRow = 1;
  let isPositional = false;
  let posColMap = { stem: 1, optA: 2, optB: 3, optC: 4, optD: 5, ans: 6, ref: 7, qNum: 0 };
  const headerMap: Record<string, number> = {};

  if (hasNamedHeaderRow0) {
    startRow = 1;
    isPositional = false;
    row0Clean.forEach((h, idx) => {
      headerMap[h] = idx;
    });
  } else {
    // Check row 1 in case row 0 was a document title or section heading
    const row1Clean =
      rawRows.length > 1
        ? rawRows[1].map((cell) =>
            String(cell || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')
          )
        : [];
    const hasNamedHeaderRow1 = row1Clean.some((h) =>
      ['question', 'stem', 'questiontext', 'qtext', 'questionstem', 'prompt'].includes(h)
    );

    if (hasNamedHeaderRow1) {
      startRow = 2;
      isPositional = false;
      row1Clean.forEach((h, idx) => {
        headerMap[h] = idx;
      });
    } else {
      // Positional mode: Row 0 is data
      isPositional = true;
      startRow = 0;
      if (sheetHasSerialCol0) {
        posColMap = { stem: 1, optA: 2, optB: 3, optC: 4, optD: 5, ans: 6, ref: 7, qNum: 0 };
      } else {
        const firstCell = String(rawRows[0][0] || '').trim();
        const secondCell = String(rawRows[0][1] || '').trim();
        if (isSerialCell(firstCell) && secondCell.length > 15) {
          posColMap = { stem: 1, optA: 2, optB: 3, optC: 4, optD: 5, ans: 6, ref: 7, qNum: 0 };
        } else if (rawRows[0].length >= 7 && (isSerialCell(firstCell) || firstCell.length <= 4)) {
          posColMap = { stem: 1, optA: 2, optB: 3, optC: 4, optD: 5, ans: 6, ref: 7, qNum: 0 };
        } else {
          posColMap = { stem: 0, optA: 1, optB: 2, optC: 3, optD: 4, ans: 5, ref: 6, qNum: -1 };
        }
      }
    }
  }

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

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    const rowNum = r + 1;

    // Check if entire row is empty
    if (!row || row.every((c) => !String(c || '').trim())) {
      continue;
    }

    let stem = '';
    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let rawAnswer = '';
    let reference = '';
    let explanation = '';
    let rawType = '';
    let rawDiff = '';
    let subject = '';
    let sthana = '';
    let chapter = '';

    const c0 = String(row[0] || '').trim();
    const c1 = String(row[1] || '').trim();

    if (isPositional) {
      // Per-row serial detection: if col 0 is serial number (e.g. 420) while col 1 is actual question text
      let offset = posColMap.stem;
      if (isSerialCell(c0) && c1.length > 15) {
        offset = 1;
      } else if (!sheetHasSerialCol0 && !isSerialCell(c0) && c0.length > 15) {
        offset = 0;
      }

      stem = String(row[offset] || '').trim();
      optA = String(row[offset + 1] || '').trim();
      optB = String(row[offset + 2] || '').trim();
      optC = String(row[offset + 3] || '').trim();
      optD = String(row[offset + 4] || '').trim();
      rawAnswer = String(row[offset + 5] || '').trim();
      reference = String(row[offset + 6] || '').trim();
      explanation = offset + 7 < row.length ? String(row[offset + 7] || '').trim() : '';

      // Skip non-question trailing summary rows or notes
      if (!stem || (!optA && !optB && !rawAnswer)) {
        continue;
      }
    } else {
      rawType = getCol(row, 'questiontype', 'type', 'qtype').toLowerCase();
      subject = getCol(row, 'subject', 'samhita', 'text');
      sthana = getCol(row, 'sthana', 'section', 'sth');
      chapter = getCol(row, 'chapter', 'chaptername', 'adhyaya', 'ch');

      stem = getCol(row, 'questiontext', 'stem', 'question', 'text', 'prompt', 'mcq');
      optA = getCol(row, 'optiona', 'opta', 'a', 'opt1', 'choicea');
      optB = getCol(row, 'optionb', 'optb', 'b', 'opt2', 'choiceb');
      optC = getCol(row, 'optionc', 'optc', 'c', 'opt3', 'choicec');
      optD = getCol(row, 'optiond', 'optd', 'd', 'opt4', 'choiced');
      rawAnswer = getCol(row, 'correctanswer', 'answer', 'ans', 'correct', 'key');
      reference = getCol(row, 'reference', 'ref', 'referenceshloka', 'shloka', 'source');
      explanation = getCol(row, 'explanation', 'exp', 'solution', 'rationale');
      rawDiff = getCol(row, 'difficultylevel', 'difficulty', 'diff', 'level').toLowerCase();

      // If stem is missing or row is incomplete, fallback to positional if row has >= 6 columns
      if (!stem && row.length >= 6) {
        const offset = isSerialCell(c0) && c1.length > 15 ? 1 : 0;
        stem = String(row[offset] || '').trim();
        optA = optA || String(row[offset + 1] || '').trim();
        optB = optB || String(row[offset + 2] || '').trim();
        optC = optC || String(row[offset + 3] || '').trim();
        optD = optD || String(row[offset + 4] || '').trim();
        rawAnswer = rawAnswer || String(row[offset + 5] || '').trim();
        reference = reference || (row.length >= offset + 7 ? String(row[offset + 6] || '').trim() : '');
      }
    }

    // DEFENSIVE 1-COLUMN SHIFT AUTO-HEALING:
    // If stem was mapped to a numeric serial number (e.g. 420, 430, or length < 10) while optA is > 25 chars
    if ((/^\d+\.?$/.test(stem) || stem.length < 10) && optA.length > 25) {
      const realStem = optA;
      const realOptA = optB;
      const realOptB = optC;
      const realOptC = optD;
      const realOptD = rawAnswer;
      const realAns = reference;
      const realRef = explanation || (row.length > 7 ? String(row[7] || '').trim() : '');
      const realExp = row.length > 8 ? String(row[8] || '').trim() : '';

      stem = realStem;
      optA = realOptA;
      optB = realOptB;
      optC = realOptC;
      optD = realOptD;
      rawAnswer = realAns;
      reference = realRef;
      if (realExp) explanation = realExp;
    }

    const effectiveStem = stem;
    const effectiveOptA = optA;
    const effectiveOptB = optB;
    const effectiveOptC = optC;
    const effectiveOptD = optD;
    const effectiveAns = rawAnswer;
    const effectiveRef = reference;

    // 2. Validate Question Text
    if (!effectiveStem) {
      errors.push({
        row: rowNum,
        error: 'Missing Question Text / Stem.',
        rawSnippet: row.slice(0, 3).join(' | '),
      });
      continue;
    }

    // 3. Resolve Full Chapter Mapping using Smart Ayurveda Citation & Context Detector
    let fullChapterName = '';
    if (subject && sthana && chapter) {
      const cleanCh = chapter.toLowerCase().includes('chapter') ? chapter : `Chapter ${chapter}`;
      fullChapterName = `${subject} > ${sthana} > ${cleanCh}`;
    } else if (chapter && chapter.includes('>')) {
      fullChapterName = chapter;
    } else {
      const detected = detectChapterInfo(effectiveRef, explanation, {
        fileName: contextHint?.fileName,
        tabName: contextHint?.tabName,
        existingChapter: chapter || sthana,
        defaultSubject: subject || contextHint?.defaultSubject,
      });
      fullChapterName = detected.fullChapterName;
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
    totalRows: Math.max(0, rawRows.length - startRow),
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
