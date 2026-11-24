import type { Question } from '../types/index';

/**
 * Converts Devanagari numerals (०, १, २, ३, ४, ५, ६, ७, ८, ९) to ASCII digits (0-9)
 */
export function convertDevanagariNumerals(str: string): string {
  if (!str) return '';
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return str.replace(/[०-९]/g, (w) => String(devanagariDigits.indexOf(w)));
}

/**
 * Normalizes citation and reference strings by:
 * 1. Converting Devanagari numerals (०-९) to standard digits (0-9).
 * 2. Applying Unicode NFD normalization and stripping all combining diacritical marks
 *    so sūtrasthānam -> sutrasthanam, śārīra -> sarira, cikitsā -> cikitsa, nidāna -> nidana.
 * 3. Lowercasing and trimming.
 */
export function normalizeCitationText(str: string): string {
  if (!str) return '';
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let s = str.replace(/[०-९]/g, (w) => String(devanagariDigits.indexOf(w)));
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s.toLowerCase().trim();
}

/**
 * Extracts only the citation prefix (the first ~60-70 characters or before Sanskrit verses)
 * so that Sthana keywords are NEVER matched from inside the Sanskrit shloka body.
 */
export function extractCitationPrefix(citation?: string, explanation?: string, stem?: string): string {
  // 1. If explicit citation / reference column exists:
  if (citation && citation.trim()) {
    const clean = citation.trim();
    // Stop at verse delimiters like ॥, |, or newline if they appear early
    const verseBreak = clean.search(/[॥|\n]/);
    if (verseBreak > 0 && verseBreak <= 75) {
      return clean.slice(0, verseBreak).trim();
    }
    return clean.slice(0, 65).trim();
  }

  // 2. Check if stem starts with a classical citation or shloka header
  if (stem && stem.trim()) {
    const cleanStem = stem.trim();
    if (/^(?:su|ss|ca|cha|cs|ah|as|va|vr|सु|च|अष्टाङ्ग|अष्टांग|सुश्रुत|चरक|वाग्भट|sushrut|charak|ashtang|vagbhat)/i.test(cleanStem)) {
      const verseBreak = cleanStem.search(/[॥|\n]/);
      if (verseBreak > 0 && verseBreak <= 75) {
        return cleanStem.slice(0, verseBreak).trim();
      }
      return cleanStem.slice(0, 65).trim();
    }
  }

  // 3. Check if explanation contains an explicit classical citation pattern e.g. "(su.su 45/194)"
  if (explanation && explanation.trim()) {
    const cleanExp = explanation.trim();
    const mExplicit = cleanExp.match(
      /(?:(?:su|ca|cha|ah|as|cs|ss|च|सु)\s*[-–.]?\s*(?:su|ni|vi|sha|in|ci|chi|ka|si|ut|sutra|सूत्र|सू|नि|वि|शा|इन्|चि|क|सि|उ)?\s*[-–.]?\s*\d{1,3}\s*[\/:]\s*\d+)|(?:(?:sūtrasthānam|sutrasthanam|सूत्रस्थानम्|सूत्रस्थान|chikitsasthanam|चिकित्सास्थानम्|uttaratantra|उत्तरतन्त्र|nidana|निदान|sharira|शारीर|adhyaya|अध्याय)\s*[:\-–]?\s*\d{1,3})/i
    );
    if (mExplicit && mExplicit[0]) {
      return mExplicit[0].trim();
    }
  }

  return '';
}

export interface DetectedChapterInfo {
  subject: string;
  sthana: string;
  chapter: string;
  fullChapterName: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'citation' | 'filename' | 'tabname' | 'existing' | 'default';
}

export interface ContextHints {
  fileName?: string;
  tabName?: string;
  existingChapter?: string;
  defaultSubject?: string;
}

/**
 * Smart Ayurveda Samhita, Sthana and Chapter Detector.
 * Analyzes citation strings (Devanagari, IAST, English abbreviations) alongside
 * file and worksheet tab names.
 */
export function detectChapterInfo(
  citation?: string,
  explanation?: string,
  context: ContextHints = {},
  stem?: string
): DetectedChapterInfo {
  const safeContext: ContextHints = context || {};
  // 1. Extract only the citation prefix (~60 chars) - NEVER search the full Sanskrit shloka body for Sthana keywords!
  const prefixRaw = extractCitationPrefix(citation, explanation, stem);
  const normalizedPrefix = normalizeCitationText(prefixRaw);
  const normalizedFileName = normalizeCitationText(safeContext.fileName || '');
  const normalizedTabName = normalizeCitationText(safeContext.tabName || '');
  const combinedContext = `${normalizedFileName} ${normalizedTabName}`.trim();
  const searchPrefix = `${normalizedPrefix} ${combinedContext}`.trim();

  // Full normalized reference pool (used only for Samhita detection fallback or fraction fallback)
  const fullNormalizedRef = normalizeCitationText(`${citation || ''} ${explanation || ''} ${(stem || '').slice(0, 100)}`);

  // 1. Detect Subject / Samhita
  let subject = '';
  let subjectSource: DetectedChapterInfo['source'] = 'default';

  // Sushruta Samhita check
  if (
    /(?:\b(?:su|ss)\s*[-–.]?\s*(?:su|ni|sha|sar|ci|chi|ka|ut|सूत्र|सू|नि|शा|चि|क|उ)\b)|\b(?:sushrut\w*|susruta\w*|suśruta\w*|सुश्रुत)\b/i.test(
      searchPrefix
    ) ||
    /\b(?:sushrut\w*|susruta\w*|suśruta\w*|सुश्रुत)\b/i.test(fullNormalizedRef)
  ) {
    subject = 'Sushruta Samhita';
    subjectSource = 'citation';
  } else if (/\b(?:sushrut\w*|susruta\w*|suśruta\w*|सुश्रुत)\b/i.test(combinedContext)) {
    subject = 'Sushruta Samhita';
    subjectSource = safeContext.fileName ? 'filename' : 'tabname';
  }
  // Charaka Samhita check
  else if (
    /(?:\b(?:ca|cha|cs)\s*[-–.]?\s*(?:su|ni|vi|sha|sar|in|ci|chi|ka|si|sutra|सूत्र|सू|नि|वि|शा|इन्|चि|क|सि)\b)|\b(?:charak\w*|caraka\w*|चरक)\b/i.test(
      searchPrefix
    ) ||
    /\b(?:charak\w*|caraka\w*|चरक)\b/i.test(fullNormalizedRef)
  ) {
    subject = 'Charaka Samhita';
    subjectSource = 'citation';
  } else if (/\b(?:charak\w*|caraka\w*|चरक)\b/i.test(combinedContext)) {
    subject = 'Charaka Samhita';
    subjectSource = safeContext.fileName ? 'filename' : 'tabname';
  }
  // Ashtanga Hridaya check
  else if (
    /(?:\b(?:a\s*\.\s*h\.?|a\s*\.\s*s\.?|ah|as)\s*[-–.]?\s*(?:su|ni|sha|ci|ka|ut|सू|नि|शा|चि|क|उ)\b)|\b(?:ashtang\w*|astanga\w*|aṣṭāṅga\w*|अष्टाङ्ग|अष्टांग|vagbhat\w*|vāgbhaṭa\w*|वाग्भट)\b|\b(?:hridaya|hrdaya)\b/i.test(
      searchPrefix
    ) ||
    /\b(?:ashtang\w*|astanga\w*|aṣṭāṅga\w*|अष्टाङ्ग|vagbhat\w*|वाग्भट)\b/i.test(fullNormalizedRef)
  ) {
    subject = 'Ashtanga Hridaya';
    subjectSource = 'citation';
  } else if (/\b(?:ashtang\w*|astanga\w*|hridaya|vagbhat\w*|अष्टाङ्ग|हृदय)\b/i.test(combinedContext)) {
    subject = 'Ashtanga Hridaya';
    subjectSource = 'filename';
  }
  // Sharangadhara Samhita check
  else if (/sharang|śārṅga|शार्ङ्गधर|शारंगधर/i.test(searchPrefix) || /sharang|शार्ङ्गधर/i.test(combinedContext)) {
    subject = 'Sharangadhara Samhita';
    subjectSource = 'citation';
  }
  // Madhava Nidana check
  else if (/madhava|mādhava|माधव/i.test(searchPrefix) || /madhav|माधव/i.test(combinedContext)) {
    subject = 'Madhava Nidana';
    subjectSource = 'citation';
  }
  // Kashyapa Samhita check
  else if (/kashyap|kāśyapa|काश्यप/i.test(searchPrefix) || /kashyap|काश्यप/i.test(combinedContext)) {
    subject = 'Kashyapa Samhita';
    subjectSource = 'citation';
  }
  // Dravyaguna
  else if (/dravyaguna|द्रव्यगुण/i.test(searchPrefix) || /dravyaguna|द्रव्यगुण/i.test(combinedContext)) {
    subject = 'Dravyaguna Vijnana';
    subjectSource = 'citation';
  }
  // Rasa Shastra
  else if (/rasashastra|bhaishajya|रसशास्त्र|भैषज्य/i.test(searchPrefix) || /rasa|bhaishajya/i.test(combinedContext)) {
    subject = 'Rasa Shastra & Bhaishajya Kalpana';
    subjectSource = 'citation';
  }
  // Existing breadcrumb check
  else if (safeContext.existingChapter && safeContext.existingChapter.includes('>')) {
    const parts = safeContext.existingChapter.split('>').map((p) => p.trim());
    subject = parts[0] || 'Uncategorized / Needs Review';
    subjectSource = 'existing';
  } else if (safeContext.defaultSubject) {
    subject = safeContext.defaultSubject;
    subjectSource = 'default';
  } else {
    subject = 'Uncategorized / Needs Review';
    subjectSource = 'default';
  }

  // 2. Detect Sthana (Section) - STRICTLY ON CITATION PREFIX & CONTEXT, NEVER ON SHLOKA BODY
  let sthana = '';

  if (
    /uttaratantra|uttaratantram|uttarasthana|uttarasthanam|uttara|uttar|\but\b|उत्तरتन्त्र|उत्तरतन्त्र|उत्तरस्थान|उत्तर|su\.?\s*ut|ah\.?\s*ut|ss\s*[-–.]?\s*ut|सु\.?\s*उ/i.test(
      searchPrefix
    )
  ) {
    // Charaka Samhita strictly has 8 Sthanas and NO Uttaratantra / Uttarasthana!
    if (subject === 'Charaka Samhita' || subject === 'Uncategorized / Needs Review' || !subject) {
      if (/ashtang|astanga|अष्टाङ्ग|vagbhat|vagbhata|वाग्भट|a\.?\s*h\.?/i.test(searchPrefix)) {
        subject = 'Ashtanga Hridaya';
        sthana = 'Uttarasthana';
      } else {
        subject = 'Sushruta Samhita';
        sthana = 'Uttaratantra';
      }
      subjectSource = 'citation';
    } else if (subject === 'Sushruta Samhita') {
      sthana = 'Uttaratantra';
    } else if (subject === 'Ashtanga Hridaya') {
      sthana = 'Uttarasthana';
    } else {
      sthana = 'Uttaratantra';
    }
  } else if (
    /nidanasthana|nidanasthanam|nidana|\bni\b|निदानस्थानम्|निदानस्थान|निदान|ca\.?\s*ni|su\.?\s*ni|ah\.?\s*ni|च\.?\s*नि|सु\.?\s*नि/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Nidanasthana';
  } else if (
    /vimanasthana|vimanasthanam|vimana|\bvi\b|विमानस्थानम्|विमानस्थान|विमान|ca\.?\s*vi|च\.?\s*वि/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Vimanasthana';
  } else if (
    /sharirasthana|sarirasthana|sharirasthanam|sarirasthanam|sharira|sarira|\bsha\b|शारीरस्थानम्|शारीरस्थान|शारीर|ca\.?\s*sha|su\.?\s*sha|ah\.?\s*sha|च\.?\s*शा|सु\.?\s*शा/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Sharirasthana';
  } else if (
    /indriyasthana|indriyasthanam|indriya|\bin\b|इन्द्रियस्थानम्|इन्द्रियस्थान|इन्द्रिय|ca\.?\s*in|च\.?\s*इन्/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Indriyasthana';
  } else if (
    /chikitsasthana|cikitsasthana|chikitsasthanam|cikitsasthanam|chikitsa|cikitsa|\bci\b|\bchi\b|चिकित्सास्थानम्|चिकित्सास्थान|चिकित्सा|ca\.?\s*ci|ca\.?\s*chi|su\.?\s*ci|su\.?\s*chi|च\.?\s*चि|सु\.?\s*चि/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Chikitsasthana';
  } else if (
    /kalpasiddhisthana|kalpasiddhisthanam|kalpasiddhi|कल्पसिद्धिस्थानम्|कल्पसिद्धि/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Kalpasiddhisthana';
  } else if (
    /kalpasthana|kalpasthanam|kalpa|\bka\b|कल्पस्थानम्|कल्पस्थान|कल्प|ca\.?\s*ka|ca\.?\s*kal|su\.?\s*ka|su\.?\s*kal|च\.?\s*क|सु\.?\s*क/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Kalpasthana';
  } else if (
    /siddhisthana|siddhisthanam|siddhi|\bsi\b|सिद्धिस्थानम्|सिद्धिस्थान|सिद्धि|ca\.?\s*si|च\.?\s*सि/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Siddhisthana';
  } else if (/purva|पूर्व/i.test(searchPrefix) && subject.includes('Sharangadhara')) {
    sthana = 'Purva Khanda';
  } else if (/madhyama|मध्यम/i.test(searchPrefix) && subject.includes('Sharangadhara')) {
    sthana = 'Madhyama Khanda';
  } else if (
    /sutrasthana|sutrasthanam|sutra|\bsu\b|सूत्रस्थानम्|सूत्रस्थान|सूत्र|ca\.?\s*su|su\.?\s*su|ah\.?\s*su|च\.?\s*सू|सु\.?\s*सू/i.test(
      searchPrefix
    )
  ) {
    sthana = 'Sutrasthana';
  } else {
    // If context has existing sthana
    if (safeContext.existingChapter && safeContext.existingChapter.includes('>')) {
      const parts = safeContext.existingChapter.split('>').map((p) => p.trim());
      sthana = parts[1] || (subject === 'Uncategorized / Needs Review' ? 'General' : 'Sutrasthana');
    } else {
      sthana = subject.includes('Nidana')
        ? 'Nidanasthana'
        : subject === 'Uncategorized / Needs Review'
        ? 'General'
        : 'Sutrasthana';
    }
  }

  // 3. Detect Chapter Number
  let chNum = '';

  // Pattern A: Sthana name followed by chapter number in searchPrefix
  const mCitationWithSthana = searchPrefix.match(
    /(?:sutrasthanam|sutrasthana|सूत्रस्थानम्|सूत्रस्थान|sutra|सूत्र|chikitsasthanam|cikitsasthanam|चिकित्सास्थानम्|uttaratantra|uttarasthana|उत्तरतन्त्र|उत्तरस्थान|nidanasthanam|nidana|निदानस्थान|निदान|sarirasthana|sharirasthana|शारीरस्थान|sharira|sarira|शारीर|adhyaya|अध्याय)\s*[:\-–]?\s*(\d{1,3})/i
  );
  if (mCitationWithSthana && mCitationWithSthana[1]) {
    chNum = mCitationWithSthana[1];
  }

  // Pattern B: Classical fraction citation e.g. "ca.su 1/115", "su.su 45/12", "च.सू - 1/115", "45/12", "26 / 8" in searchPrefix
  if (!chNum) {
    const mFraction = searchPrefix.match(
      /(?:ca|su|ah|cs|ss|च|सु)\s*[-–.]?\s*(?:su|ni|vi|sha|sar|in|ci|chi|ka|si|ut|सू|नि|वि|शा|इन्|चि|क|सि|उ)?\s*[-–.]?\s*(\d{1,3})\s*[\/:]\s*\d+/i
    );
    if (mFraction && mFraction[1]) {
      chNum = mFraction[1];
    }
  }

  // Pattern C: Plain fraction "45/12" or "45:12" in searchPrefix
  if (!chNum) {
    const mPlainFraction = searchPrefix.match(/\b(\d{1,3})\s*[\/:]\s*\d+\b/);
    if (mPlainFraction && mPlainFraction[1]) {
      chNum = mPlainFraction[1];
    }
  }

  // Pattern D: Explicit "Chapter 45", "Ch 45", "Ch. 45", "Adhyaya 45" in searchPrefix
  if (!chNum) {
    const mExplicit = searchPrefix.match(/(?:chapter|adhyaya|अध्याय|ch\.?)\s*[:\-–]?\s*(\d{1,3})/i);
    if (mExplicit && mExplicit[1]) {
      chNum = mExplicit[1];
    }
  }

  // Pattern E: Tab Name or File Name is just a number
  if (!chNum && safeContext.tabName) {
    const tabClean = normalizeCitationText(safeContext.tabName);
    const mTab = tabClean.match(/^(?:chapter|ch\.?|adhyaya)?\s*(\d{1,3})$/i) || tabClean.match(/\b(\d{1,3})\b/);
    if (mTab && mTab[1]) {
      chNum = mTab[1];
    }
  }

  // Pattern F: If not found in prefix, fallback to looking in the normalized full reference for a fraction
  if (!chNum) {
    const mFullFraction = fullNormalizedRef.match(
      /(?:ca|su|ah|cs|ss|च|सु)\s*[-–.]?\s*(?:su|ni|vi|sha|sar|in|ci|chi|ka|si|ut|सू|नि|वि|शा|इन्|चि|क|सि|उ)?\s*[-–.]?\s*(\d{1,3})\s*[\/:]\s*\d+/i
    ) || fullNormalizedRef.match(/\b(\d{1,3})\s*[\/:]\s*\d+\b/);
    if (mFullFraction && mFullFraction[1]) {
      chNum = mFullFraction[1];
    }
  }

  // Pattern G: Existing chapter number if already present in question
  if (!chNum && safeContext.existingChapter) {
    const mExist = safeContext.existingChapter.match(/chapter\s*(\d{1,3})/i) || safeContext.existingChapter.match(/\b(\d{1,3})\b/);
    if (mExist && mExist[1]) {
      chNum = mExist[1];
    }
  }

  // Fallback chapter number
  if (!chNum) {
    chNum = '1';
  }

  const cleanChapter = `Chapter ${parseInt(chNum, 10) || 1}`;
  const fullChapterName = `${subject} > ${sthana} > ${cleanChapter}`;

  const confidence: DetectedChapterInfo['confidence'] =
    subjectSource === 'citation' && chNum !== '1'
      ? 'high'
      : subjectSource !== 'default'
      ? 'medium'
      : 'low';

  return {
    subject,
    sthana,
    chapter: cleanChapter,
    fullChapterName,
    confidence,
    source: subjectSource,
  };
}

export interface SamhitaMismatchResult {
  hasMismatch: boolean;
  type: 'samhita_conflict' | 'impossible_chapter' | 'impossible_sthana' | 'none';
  citationSamhita?: string;
  claimedSamhita?: string;
  badgeLabel?: string;
  detailedMessage?: string;
  suggestedTag?: string;
}

export interface SthanaDefinition {
  name: string;
  maxChapters: number;
  aliases?: string[];
}

export interface ClassicalSamhitaDefinition {
  name: string;
  totalChapters: number;
  sthanas: SthanaDefinition[];
}

export const EDIT_MODAL_SAMHITA_OPTIONS = [
  'Charaka Samhita',
  'Sushruta Samhita',
  'Ashtanga Hridaya',
  'Ashtanga Sangraha',
  'Kashyapa Samhita',
  'Madhava Nidana',
  'Sharangadhara Samhita',
  'Bhavaprakasha',
  'Dravyaguna',
  'Rasashastra & Bhaishajya Kalpana',
  'Roga Nidana',
  'Modern / Other',
];

// Strict Classical Samhita-Sthana Schema
export const CLASSICAL_SAMHITA_SCHEMA: Record<string, ClassicalSamhitaDefinition> = {
  'Charaka Samhita': {
    name: 'Charaka Samhita',
    totalChapters: 120,
    sthanas: [
      { name: 'Sutrasthana', maxChapters: 30, aliases: ['sutra', 'sūtra', 'सूत्रस्थान', 'सूत्र', 'सू'] },
      { name: 'Nidanasthana', maxChapters: 8, aliases: ['nidana', 'nidāna', 'निदानस्थान', 'निदान', 'नि'] },
      { name: 'Vimanasthana', maxChapters: 8, aliases: ['vimana', 'vimāna', 'विमानस्थान', 'विमान', 'वि'] },
      { name: 'Sharirasthana', maxChapters: 8, aliases: ['sharira', 'śārīra', 'शारीरस्थान', 'शारीर', 'शा'] },
      { name: 'Indriyasthana', maxChapters: 12, aliases: ['indriya', 'इन्द्रियस्थान', 'इन्द्रिय', 'इन्'] },
      { name: 'Chikitsasthana', maxChapters: 30, aliases: ['chikitsa', 'cikitsā', 'चिकित्सास्थान', 'चिकित्सा', 'चि'] },
      { name: 'Kalpasthana', maxChapters: 12, aliases: ['kalpa', 'कल्पस्थान', 'कल्प', 'क'] },
      { name: 'Siddhisthana', maxChapters: 12, aliases: ['siddhi', 'सिद्धिस्थान', 'सिद्धि', 'सि'] },
    ],
  },
  'Sushruta Samhita': {
    name: 'Sushruta Samhita',
    totalChapters: 186,
    sthanas: [
      { name: 'Sutrasthana', maxChapters: 46, aliases: ['sutra', 'sūtra', 'सूत्रस्थान', 'सूत्र', 'सू'] },
      { name: 'Nidanasthana', maxChapters: 16, aliases: ['nidana', 'nidāna', 'निदानस्थान', 'निदान', 'नि'] },
      { name: 'Sharirasthana', maxChapters: 10, aliases: ['sharira', 'śārīra', 'शारीरस्थान', 'शारीर', 'शा'] },
      { name: 'Chikitsasthana', maxChapters: 40, aliases: ['chikitsa', 'cikitsā', 'चिकित्सास्थान', 'चिकित्सा', 'चि'] },
      { name: 'Kalpasthana', maxChapters: 8, aliases: ['kalpa', 'कल्पस्थान', 'कल्प', 'क'] },
      { name: 'Uttaratantra', maxChapters: 66, aliases: ['uttaratantra', 'uttara', 'uttar', 'उत्तरतन्त्र', 'उत्तरस्थान', 'उत्तर', 'उ'] },
    ],
  },
  'Ashtanga Hridaya': {
    name: 'Ashtanga Hridaya',
    totalChapters: 120,
    sthanas: [
      { name: 'Sutrasthana', maxChapters: 30, aliases: ['sutra', 'sūtra', 'सूत्रस्थान', 'सूत्र', 'सू'] },
      { name: 'Sharirasthana', maxChapters: 6, aliases: ['sharira', 'śārīra', 'शारीरस्थान', 'शारीर', 'शा'] },
      { name: 'Nidanasthana', maxChapters: 16, aliases: ['nidana', 'nidāna', 'निदानस्थान', 'निदान', 'नि'] },
      { name: 'Chikitsasthana', maxChapters: 22, aliases: ['chikitsa', 'cikitsā', 'चिकित्सास्थान', 'चिकित्सा', 'चि'] },
      { name: 'Kalpasiddhisthana', maxChapters: 6, aliases: ['kalpasiddhi', 'kalpasiddhisthana', 'kalpa', 'kalpasthana', 'कल्पसिद्धि', 'कल्प', 'क'] },
      { name: 'Uttarasthana', maxChapters: 40, aliases: ['uttarasthana', 'uttara', 'uttar', 'उत्तरस्थान', 'उत्तरतन्त्र', 'उत्तर', 'उ'] },
    ],
  },
  'Ashtanga Sangraha': {
    name: 'Ashtanga Sangraha',
    totalChapters: 150,
    sthanas: [
      { name: 'Sutrasthana', maxChapters: 40, aliases: ['sutra', 'sūtra', 'सूत्रस्थान', 'सूत्र', 'सू'] },
      { name: 'Sharirasthana', maxChapters: 12, aliases: ['sharira', 'śārīra', 'शारीरस्थान', 'शारीर', 'शा'] },
      { name: 'Nidanasthana', maxChapters: 16, aliases: ['nidana', 'nidāna', 'निदानस्थान', 'निदान', 'नि'] },
      { name: 'Chikitsasthana', maxChapters: 24, aliases: ['chikitsa', 'cikitsā', 'चिकित्सास्थान', 'चिकित्सा', 'चि'] },
      { name: 'Kalpasthana', maxChapters: 8, aliases: ['kalpa', 'कल्पस्थान', 'कल्प', 'क'] },
      { name: 'Uttaratantra', maxChapters: 50, aliases: ['uttaratantra', 'uttaratantra', 'uttara', 'uttar', 'उत्तरतन्त्र', 'उत्तरस्थान', 'उत्तर', 'उ'] },
    ],
  },
  'Kashyapa Samhita': {
    name: 'Kashyapa Samhita',
    totalChapters: 120,
    sthanas: [
      { name: 'Sutrasthana', maxChapters: 30, aliases: ['sutra', 'sūtra', 'सूत्रस्थान', 'सूत्र', 'सू'] },
      { name: 'Nidanasthana', maxChapters: 8, aliases: ['nidana', 'nidāna', 'निदानस्थान', 'निदान', 'नि'] },
      { name: 'Vimanasthana', maxChapters: 8, aliases: ['vimana', 'vimāna', 'विमानस्थान', 'विमान', 'वि'] },
      { name: 'Sharirasthana', maxChapters: 8, aliases: ['sharira', 'śārīra', 'शारीरस्थान', 'शारीर', 'शा'] },
      { name: 'Indriyasthana', maxChapters: 12, aliases: ['indriya', 'इन्द्रियस्थान', 'इन्द्रिय', 'इन्'] },
      { name: 'Chikitsasthana', maxChapters: 30, aliases: ['chikitsa', 'cikitsā', 'चिकित्सास्थान', 'चिकित्सा', 'चि'] },
      { name: 'Siddhisthana', maxChapters: 12, aliases: ['siddhi', 'सिद्धिस्थान', 'सिद्धि', 'सि'] },
      { name: 'Kalpasthana', maxChapters: 12, aliases: ['kalpa', 'कल्पस्थान', 'कल्प', 'क'] },
      { name: 'Khilasthana', maxChapters: 80, aliases: ['khila', 'खिलस्थान', 'खिल', 'खि'] },
    ],
  },
  'Madhava Nidana': {
    name: 'Madhava Nidana',
    totalChapters: 69,
    sthanas: [
      { name: 'Nidana chapters', maxChapters: 69, aliases: ['nidana', 'rogavinishchaya', 'निदान'] },
    ],
  },
  'Sharangadhara Samhita': {
    name: 'Sharangadhara Samhita',
    totalChapters: 32,
    sthanas: [
      { name: 'Purva Khanda', maxChapters: 7, aliases: ['purva', 'पूर्वखण्ड', 'पूर्व'] },
      { name: 'Madhyama Khanda', maxChapters: 12, aliases: ['madhyama', 'मध्यमखण्ड', 'मध्यम'] },
      { name: 'Uttara Khanda', maxChapters: 13, aliases: ['uttara', 'उत्तरखण्ड', 'उत्तर'] },
    ],
  },
  'Bhavaprakasha': {
    name: 'Bhavaprakasha',
    totalChapters: 96,
    sthanas: [
      { name: 'Purva Khanda', maxChapters: 6, aliases: ['purva', 'पूर्वखण्ड', 'पूर्व'] },
      { name: 'Madhyama Khanda', maxChapters: 80, aliases: ['madhyama', 'मध्यमखण्ड', 'मध्यम'] },
      { name: 'Uttara Khanda', maxChapters: 10, aliases: ['uttara', 'उत्तरखण्ड', 'उत्तर'] },
    ],
  },
  'Dravyaguna': {
    name: 'Dravyaguna',
    totalChapters: 30,
    sthanas: [
      { name: 'Samanya Siddhanta', maxChapters: 10, aliases: ['samanya', 'सामान्य सिद्धान्त'] },
      { name: 'Aushadhi Dravya', maxChapters: 20, aliases: ['aushadhi', 'औषधि द्रव्य'] },
      { name: 'General', maxChapters: 1, aliases: ['general', 'सामान्य'] },
    ],
  },
  'Rasashastra & Bhaishajya Kalpana': {
    name: 'Rasashastra & Bhaishajya Kalpana',
    totalChapters: 24,
    sthanas: [
      { name: 'Rasashastra', maxChapters: 14, aliases: ['rasashastra', 'रसशास्त्र'] },
      { name: 'Bhaishajya Kalpana', maxChapters: 10, aliases: ['bhaishajya', 'भैषज्य कल्पना'] },
      { name: 'General', maxChapters: 1, aliases: ['general', 'सामान्य'] },
    ],
  },
  'Roga Nidana': {
    name: 'Roga Nidana',
    totalChapters: 22,
    sthanas: [
      { name: 'Roga Nidana', maxChapters: 14, aliases: ['roga', 'रोग निदान'] },
      { name: 'Vikriti Vigyan', maxChapters: 8, aliases: ['vikriti', 'विकृति विज्ञान'] },
      { name: 'General', maxChapters: 1, aliases: ['general', 'सामान्य'] },
    ],
  },
  'Modern / Other': {
    name: 'Modern / Other',
    totalChapters: 3,
    sthanas: [
      { name: 'General / Other', maxChapters: 1, aliases: ['general', 'सामान्य', 'other'] },
      { name: 'Modern Medicine', maxChapters: 1, aliases: ['modern', 'allopathy'] },
      { name: 'Research Methodology', maxChapters: 1, aliases: ['research', 'अनुसंधान'] },
    ],
  },
};

// Classical maximum chapter limits per Samhita & Sthana (backwards compatible map)
export const SAMHITA_MAX_CHAPTERS: Record<string, Record<string, number>> = {
  'Charaka Samhita': {
    Sutrasthana: 30,
    Nidanasthana: 8,
    Vimanasthana: 8,
    Sharirasthana: 8,
    Indriyasthana: 12,
    Chikitsasthana: 30,
    Kalpasthana: 12,
    Siddhisthana: 12,
  },
  'Sushruta Samhita': {
    Sutrasthana: 46,
    Nidanasthana: 16,
    Sharirasthana: 10,
    Chikitsasthana: 40,
    Kalpasthana: 8,
    Uttaratantra: 66,
  },
  'Ashtanga Hridaya': {
    Sutrasthana: 30,
    Sharirasthana: 6,
    Nidanasthana: 16,
    Chikitsasthana: 22,
    Kalpasiddhisthana: 6,
    Kalpasthana: 6,
    Uttarasthana: 40,
  },
  'Ashtanga Sangraha': {
    Sutrasthana: 40,
    Sharirasthana: 12,
    Nidanasthana: 16,
    Chikitsasthana: 24,
    Kalpasthana: 8,
    Uttaratantra: 50,
  },
  'Kashyapa Samhita': {
    Sutrasthana: 30,
    Nidanasthana: 8,
    Vimanasthana: 8,
    Sharirasthana: 8,
    Indriyasthana: 12,
    Chikitsasthana: 30,
    Siddhisthana: 12,
    Kalpasthana: 12,
    Khilasthana: 80,
  },
  'Madhava Nidana': {
    'Nidana chapters': 69,
    Nidana: 69,
  },
  'Sharangadhara Samhita': {
    'Purva Khanda': 7,
    'Madhyama Khanda': 12,
    'Uttara Khanda': 13,
  },
  'Bhavaprakasha': {
    'Purva Khanda': 6,
    'Madhyama Khanda': 80,
    'Uttara Khanda': 10,
  },
  'Dravyaguna': {
    'Samanya Siddhanta': 10,
    'Aushadhi Dravya': 20,
    General: 1,
  },
  'Rasashastra & Bhaishajya Kalpana': {
    Rasashastra: 14,
    'Bhaishajya Kalpana': 10,
    General: 1,
  },
  'Roga Nidana': {
    'Roga Nidana': 14,
    'Vikriti Vigyan': 8,
    General: 1,
  },
  'Modern / Other': {
    'General / Other': 1,
    'Modern Medicine': 1,
    'Research Methodology': 1,
  },
};

/**
 * Parses a chapter mapping string (e.g. "Charaka Samhita > Sutrasthana > Chapter 1")
 * into normalized { samhita, sthana, chapter } matching the canonical options.
 */
export function parseChapterMappingString(mappingStr: string): {
  samhita: string;
  sthana: string;
  chapter: string;
} {
  const raw = String(mappingStr || '').trim();
  const parts = raw.split('>').map((p) => p.trim());
  let samhita = 'Charaka Samhita';
  let sthana = 'Sutrasthana';
  let chapter = 'Chapter 1';

  if (parts.length >= 3) {
    samhita = parts[0];
    sthana = parts[1];
    chapter = parts[2];
  } else if (parts.length === 2) {
    samhita = parts[0];
    sthana = parts[1];
    chapter = 'Chapter 1';
  } else if (parts.length === 1 && parts[0]) {
    const matched = EDIT_MODAL_SAMHITA_OPTIONS.find((s) =>
      parts[0].toLowerCase().includes(s.toLowerCase())
    );
    if (matched) samhita = matched;
  }

  // Canonical match for Samhita
  const canonicalSamhita = EDIT_MODAL_SAMHITA_OPTIONS.find(
    (s) => s.toLowerCase() === samhita.toLowerCase() || samhita.toLowerCase().includes(s.toLowerCase())
  );
  if (canonicalSamhita) {
    samhita = canonicalSamhita;
  }

  // Canonical match for Sthana
  const schema = CLASSICAL_SAMHITA_SCHEMA[samhita];
  if (schema && schema.sthanas.length > 0) {
    const matchedSth = schema.sthanas.find(
      (s) =>
        s.name.toLowerCase() === sthana.toLowerCase() ||
        sthana.toLowerCase().includes(s.name.toLowerCase()) ||
        s.aliases?.some((a) => sthana.toLowerCase().includes(a.toLowerCase()))
    );
    if (matchedSth) {
      sthana = matchedSth.name;
    } else {
      sthana = schema.sthanas[0].name;
    }
  }

  // Ensure chapter is formatted as "Chapter N" or "General / All"
  if (/^\d+$/.test(chapter)) {
    chapter = `Chapter ${chapter}`;
  } else if (!chapter.toLowerCase().startsWith('chapter') && !chapter.toLowerCase().includes('general')) {
    const num = chapter.match(/\d+/)?.[0];
    if (num) {
      chapter = `Chapter ${num}`;
    }
  }

  return { samhita, sthana, chapter };
}

/**
 * Returns the canonical Sthana definition if it validly belongs to the given Samhita,
 * or null if the Sthana is impossible for that Samhita (e.g. Uttarasthana on Charaka).
 */
export function getCanonicalSthana(samhitaName: string, sthanaName: string): SthanaDefinition | null {
  const samhitaDef = CLASSICAL_SAMHITA_SCHEMA[samhitaName];
  if (!samhitaDef) return null;
  const cleanSth = (sthanaName || '').trim().toLowerCase();
  for (const sth of samhitaDef.sthanas) {
    if (sth.name.toLowerCase() === cleanSth) return sth;
    if (cleanSth.includes(sth.name.toLowerCase())) return sth;
    if (sth.aliases?.some((alias) => cleanSth.includes(alias.toLowerCase()))) {
      return sth;
    }
  }
  return null;
}

/**
 * Verifies if a chapter tag is a valid classical tag:
 * - Must be formatted as "Subject > Sthana > Chapter N"
 * - N must be a valid number >= 1
 * - If the Samhita is in CLASSICAL_SAMHITA_SCHEMA:
 *   - Sthana must be a valid canonical Sthana
 *   - N must not exceed the classical maxChapters for that Sthana
 */
export function isValidClassicalTag(tag?: string): boolean {
  if (!tag || !tag.includes('>')) return false;
  const parts = tag.split('>').map((p) => p.trim());
  if (parts.length < 3) return false;
  const [samhita, sthana, chapterStr] = parts;
  const chMatch = chapterStr.match(/(\d+)/);
  if (!chMatch) return false;
  const chNum = parseInt(chMatch[1], 10);
  if (chNum < 1) return false;

  const schema = CLASSICAL_SAMHITA_SCHEMA[samhita];
  if (schema) {
    const canonical = getCanonicalSthana(samhita, sthana);
    if (!canonical) return false; // Impossible sthana for this Samhita
    if (chNum > canonical.maxChapters) return false; // Impossible chapter number
  }
  return true;
}

/**
 * Checks whether a question has been manually edited or verified by an administrator.
 * Manually verified questions are authoritative and excluded from automated heuristic issue detectors.
 */
export function isQuestionManuallyVerified(q: Question | any): boolean {
  if (!q) return false;
  return (
    q.is_manually_verified === true ||
    q.isManuallyVerified === true ||
    q.manually_edited === true ||
    String(q.is_manually_verified) === 'true' ||
    String(q.isManuallyVerified) === 'true' ||
    String(q.manually_edited) === 'true' ||
    q.is_manually_verified === 1 ||
    q.isManuallyVerified === 1 ||
    q.manually_edited === 1
  );
}

/**
 * Detects whether a question has:
 * 1. A Samhita conflict (e.g. citation mentions Sushruta/su.su while Question Text or Chapter Tag mentions Charaka)
 * 2. An impossible Sthana for that Samhita (e.g. Charaka Samhita > Uttarasthana / Uttaratantra)
 * 3. An impossible chapter number for that Samhita/Sthana (e.g. Charaka Sutra > 30, Charaka Nidana > 8, Sushruta Sutra > 46).
 */
export function detectSamhitaMismatch(q: Question): SamhitaMismatchResult {
  // If the question has been manually edited or verified by admin, permanently skip mismatch check
  if (isQuestionManuallyVerified(q)) {
    return {
      hasMismatch: false,
      type: 'none',
    };
  }

  const stem = String(q.stem || '');
  const ref = String(q.r || '');
  const exp = String(q.explanation || '');
  const tag = String(q.chapterName || q.ch || '').trim();

  // Extract prefix and normalize
  const prefixRaw = extractCitationPrefix(ref, exp, stem);
  const normalizedPrefix = normalizeCitationText(prefixRaw);
  const fullNormalized = normalizeCitationText(`${ref} ${exp} ${stem.slice(0, 100)}`);

  // 1. Detect which Samhita the citation actually points to
  let citationSamhita: 'Sushruta Samhita' | 'Charaka Samhita' | 'Ashtanga Hridaya' | null = null;
  let citationEvidence = '';

  const searchSamhita = `${normalizedPrefix} ${fullNormalized}`;

  if (
    /(?:\b(?:su|ss)\s*[-–.]?\s*(?:su|ni|sha|sar|ci|chi|ka|ut|सूत्र|सू|नि|शा|चि|क|उ)\b)|\b(?:sushrut\w*|susruta\w*|suśruta\w*|सुश्रुत)\b/i.test(
      searchSamhita
    )
  ) {
    citationSamhita = 'Sushruta Samhita';
    citationEvidence = 'Sushruta (su.su)';
  } else if (
    /(?:\b(?:ca|cha|cs)\s*[-–.]?\s*(?:su|ni|vi|sha|sar|in|ci|chi|ka|si|sutra|सूत्र|सू|नि|वि|शा|इन्|चि|क|सि)\b)|\b(?:charak\w*|caraka\w*|चरक)\b/i.test(
      searchSamhita
    )
  ) {
    citationSamhita = 'Charaka Samhita';
    citationEvidence = 'Charaka (ca.su / cha sutra)';
  } else if (
    /(?:\b(?:a\s*\.\s*h\.?|a\s*\.\s*s\.?|ah|as)\s*[-–.]?\s*(?:su|ni|sha|ci|ka|ut|सू|नि|शा|चि|क|उ)\b)|\b(?:ashtang\w*|astanga\w*|aṣṭāṅga\w*|अष्टाङ्ग|अष्टांग|vagbhat\w*|vāgbhaṭa\w*|वाग्भट)\b|\b(?:hridaya|hrdaya)\b/i.test(
      searchSamhita
    )
  ) {
    citationSamhita = 'Ashtanga Hridaya';
    citationEvidence = 'Ashtanga (A.H.)';
  }

  // 2. Detect which Samhita is claimed by Chapter Tag and Question Text
  const tagNormalized = normalizeCitationText(tag);
  const stemNormalized = normalizeCitationText(stem);

  let claimedSamhita: 'Charaka Samhita' | 'Sushruta Samhita' | 'Ashtanga Hridaya' | null = null;
  if (
    tagNormalized.includes('charak') ||
    stemNormalized.includes('acharya charak') ||
    stemNormalized.includes('चरक के मतानुसार') ||
    stemNormalized.includes('charaka samhita')
  ) {
    claimedSamhita = 'Charaka Samhita';
  } else if (
    tagNormalized.includes('sushrut') ||
    stemNormalized.includes('sushruta') ||
    stemNormalized.includes('सुश्रुत')
  ) {
    claimedSamhita = 'Sushruta Samhita';
  } else if (
    tagNormalized.includes('ashtang') ||
    stemNormalized.includes('ashtanga') ||
    stemNormalized.includes('अष्टाङ्ग')
  ) {
    claimedSamhita = 'Ashtanga Hridaya';
  }

  // Auto-detect best target tag using detectChapterInfo (inspecting citation prefix + stem + explanation)
  const detectedTarget = detectChapterInfo(ref, exp, { existingChapter: tag }, stem);

  // Check Condition 1: Samhita conflict between Citation vs Tag / Question text
  if (citationSamhita && claimedSamhita && citationSamhita !== claimedSamhita) {
    const citationShort = citationSamhita.replace(' Samhita', '');
    const claimedShort = claimedSamhita.replace(' Samhita', '');

    let candidateTag = detectedTarget.fullChapterName;
    if (!candidateTag.startsWith(citationSamhita)) {
      candidateTag = `${citationSamhita} > ${detectedTarget.sthana} > ${detectedTarget.chapter}`;
    }

    const validSuggestedTag =
      candidateTag !== tag && isValidClassicalTag(candidateTag) ? candidateTag : undefined;

    return {
      hasMismatch: true,
      type: 'samhita_conflict',
      citationSamhita,
      claimedSamhita,
      badgeLabel: `⚠️ Samhita Mismatch: Citation is ${citationShort}, Tag/Text says ${claimedShort}`,
      detailedMessage: `Citation points to ${citationSamhita} (${citationEvidence}), but the question is tagged or worded as ${claimedSamhita}.`,
      suggestedTag: validSuggestedTag,
    };
  }

  // Check Condition 2 & 3: Impossible Sthana or Impossible Chapter Number
  if (tag.includes('>')) {
    const tagParts = tag.split('>').map((s) => s.trim());
    const samhitaName = tagParts[0];
    const sthanaName = tagParts[1];
    const chStr = tagParts[2] || '';
    const chMatch = chStr.match(/(\d+)/);
    const chNum = chMatch ? parseInt(chMatch[1], 10) : 1;

    if (samhitaName && sthanaName) {
      const classicalSchema = CLASSICAL_SAMHITA_SCHEMA[samhitaName];

      if (classicalSchema) {
        const canonicalSthana = getCanonicalSthana(samhitaName, sthanaName);

        // A. Impossible Sthana (e.g. Charaka Samhita with Uttarasthana / Uttaratantra)
        if (!canonicalSthana) {
          let targetSubject = 'Sushruta Samhita';
          let targetSthana = 'Uttaratantra';
          if (/ashtang|astanga|vagbhat|वाग्भट|a\.h\.|ah\./i.test(fullNormalized)) {
            targetSubject = 'Ashtanga Hridaya';
            targetSthana = 'Uttarasthana';
          }
          if (chNum > 40) {
            targetSubject = 'Sushruta Samhita';
            targetSthana = 'Uttaratantra';
          }
          const candidateTag = `${targetSubject} > ${targetSthana} > Chapter ${chNum}`;
          const validSuggestedTag =
            candidateTag !== tag && isValidClassicalTag(candidateTag) ? candidateTag : undefined;

          return {
            hasMismatch: true,
            type: 'impossible_sthana',
            citationSamhita: citationSamhita || targetSubject,
            claimedSamhita: samhitaName,
            badgeLabel: `⚠️ Impossible Sthana: ${samhitaName} has no ${sthanaName}`,
            detailedMessage: `${samhitaName} strictly contains 8 classical Sthanas and has no ${sthanaName}. Auto-reassign to ${candidateTag}.`,
            suggestedTag: validSuggestedTag,
          };
        }

        // B. Impossible Chapter Number (e.g. Charaka Sutra > 30, Charaka Nidana > 8)
        if (chNum > canonicalSthana.maxChapters) {
          let candidateTag = detectedTarget.fullChapterName;
          if (candidateTag === tag || !isValidClassicalTag(candidateTag)) {
            if (samhitaName === 'Charaka Samhita' && canonicalSthana.name === 'Sutrasthana' && chNum <= 46) {
              candidateTag = `Sushruta Samhita > Sutrasthana > Chapter ${chNum}`;
            } else {
              candidateTag = `${samhitaName} > ${canonicalSthana.name} > Chapter ${canonicalSthana.maxChapters}`;
            }
          }
          const validSuggestedTag =
            candidateTag !== tag && isValidClassicalTag(candidateTag) ? candidateTag : undefined;

          return {
            hasMismatch: true,
            type: 'impossible_chapter',
            citationSamhita: citationSamhita || undefined,
            claimedSamhita: samhitaName,
            badgeLabel: `⚠️ Impossible Chapter: ${samhitaName} ${canonicalSthana.name} has max ${canonicalSthana.maxChapters} chapters (Tagged as Ch ${chNum})`,
            detailedMessage: `${samhitaName} ${canonicalSthana.name} only contains ${canonicalSthana.maxChapters} chapters. Tagging as Chapter ${chNum} is invalid.`,
            suggestedTag: validSuggestedTag,
          };
        }
      }
    }
  }

  return {
    hasMismatch: false,
    type: 'none',
  };
}

/**
 * Checks if a question has an outdated, generic or shifted chapter tag
 * and returns the suggested auto-remap target based on its citation and explanation.
 */
export function checkQuestionRemap(q: Question): {
  needsRemap: boolean;
  currentTag: string;
  suggestedTag: string;
  detectedInfo: DetectedChapterInfo;
} {
  const currentTag = String(q.chapterName || q.ch || '').trim();
  const detected = detectChapterInfo(
    q.r,
    q.explanation,
    { existingChapter: currentTag },
    q.stem
  );

  // If question is manually verified, never suggest automated remap
  if (isQuestionManuallyVerified(q)) {
    return {
      needsRemap: false,
      currentTag,
      suggestedTag: currentTag,
      detectedInfo: detected,
    };
  }

  // Check if Samhita mismatch exists
  const mismatch = detectSamhitaMismatch(q);
  if (
    mismatch.hasMismatch &&
    mismatch.suggestedTag &&
    mismatch.suggestedTag !== currentTag &&
    isValidClassicalTag(mismatch.suggestedTag)
  ) {
    return {
      needsRemap: true,
      currentTag,
      suggestedTag: mismatch.suggestedTag,
      detectedInfo: detected,
    };
  }

  const isCurrentGeneric =
    !currentTag ||
    currentTag === 'Charaka Samhita > Sutrasthana > Chapter 1' ||
    currentTag === 'Chapter 1' ||
    currentTag === '1' ||
    currentTag.startsWith('Uncategorized');

  // If currently generic and detected is a specific valid tag
  if (
    isCurrentGeneric &&
    detected.fullChapterName !== currentTag &&
    detected.fullChapterName !== 'Charaka Samhita > Sutrasthana > Chapter 1' &&
    isValidClassicalTag(detected.fullChapterName)
  ) {
    return {
      needsRemap: true,
      currentTag: currentTag || 'Charaka Samhita > Sutrasthana > Chapter 1',
      suggestedTag: detected.fullChapterName,
      detectedInfo: detected,
    };
  }

  // If citation specifically points to Sushruta or Ashtanga while current is Charaka
  if (
    detected.subject !== 'Charaka Samhita' &&
    currentTag.startsWith('Charaka Samhita') &&
    detected.source === 'citation' &&
    detected.fullChapterName !== currentTag &&
    isValidClassicalTag(detected.fullChapterName)
  ) {
    return {
      needsRemap: true,
      currentTag,
      suggestedTag: detected.fullChapterName,
      detectedInfo: detected,
    };
  }

  // If chapter number in citation is different from currently tagged chapter
  const currentChMatch = currentTag.match(/chapter\s*(\d+)/i);
  const detectedChMatch = detected.chapter.match(/chapter\s*(\d+)/i);
  if (
    currentChMatch &&
    detectedChMatch &&
    currentChMatch[1] !== detectedChMatch[1] &&
    detected.source === 'citation' &&
    detected.confidence === 'high' &&
    detected.fullChapterName !== currentTag &&
    isValidClassicalTag(detected.fullChapterName)
  ) {
    return {
      needsRemap: true,
      currentTag,
      suggestedTag: detected.fullChapterName,
      detectedInfo: detected,
    };
  }

  return {
    needsRemap: false,
    currentTag,
    suggestedTag: currentTag,
    detectedInfo: detected,
  };
}

export interface QuestionAuditResult {
  isValid: boolean;
  issueReason?: string;
  isShifted?: boolean;
  isMalformedStem?: boolean;
  isMissingOptions?: boolean;
  isInvalidAnswerKey?: boolean;
  isSamhitaMismatch?: boolean;
  mismatchDetails?: SamhitaMismatchResult;
}

/**
 * Full Chapter Health & Accuracy Audit for a question:
 * Validates format, stem integrity, 4 options present, valid answer key, and Samhita citation matching.
 */
export function getQuestionAuditStatus(q: Question): QuestionAuditResult {
  // If explicitly verified or manually edited by admin, always treat as valid
  if (isQuestionManuallyVerified(q)) {
    return { isValid: true };
  }

  const stem = String(q.stem || '').trim();

  // 1. Shifted column / numeric stem check
  if (/^\d+\.?$/.test(stem) || stem.length < 5) {
    return {
      isValid: false,
      issueReason: 'Numeric serial number in stem',
      isMalformedStem: true,
    };
  }
  const optA = String((q.o && q.o[0]) || (q as any).options?.[0] || '').trim();
  if (optA.length > 25 && stem.length < 10) {
    return {
      isValid: false,
      issueReason: 'Shifted row (Stem in Option A)',
      isShifted: true,
    };
  }

  // 2. Options validation (must have 4 non-empty options for standard MCQs)
  const validOpts = (q.o || []).filter((opt) => String(opt || '').trim().length > 0);
  if (validOpts.length < 4) {
    return {
      isValid: false,
      issueReason: `Missing options (${validOpts.length}/4 present)`,
      isMissingOptions: true,
    };
  }

  // 3. Answer key validation (must be 0, 1, 2, or 3)
  if (typeof q.c !== 'number' || q.c < 0 || q.c > 3) {
    return {
      isValid: false,
      issueReason: 'Invalid answer key (not Option A–D)',
      isInvalidAnswerKey: true,
    };
  }

  // 4. Samhita & Citation Mismatch
  const mismatch = detectSamhitaMismatch(q);
  if (mismatch.hasMismatch) {
    return {
      isValid: false,
      issueReason: mismatch.badgeLabel ? mismatch.badgeLabel.replace(/^⚠️\s*/, '') : 'Samhita / Citation Mismatch',
      isSamhitaMismatch: true,
      mismatchDetails: mismatch,
    };
  }

  return { isValid: true };
}

/**
 * Helper to determine if a question is malformed / invalid for student tests
 */
export function isQuestionMalformed(q: Question): boolean {
  if (isQuestionManuallyVerified(q)) return false;
  return !getQuestionAuditStatus(q).isValid;
}

/**
 * Returns true if the question passes all validation checks (correct format, options, valid key).
 * If the question has been explicitly marked as Chapter-Verified by an Admin, the Admin's verification
 * is authoritative over automated heuristic citation-mismatch warnings.
 */
export function isValidQuestion(q: Question | any): boolean {
  if (!q) return false;
  if (isQuestionManuallyVerified(q)) return true;
  const stem = String(q.stem || q.question || q.question_text || '').trim();
  if (!stem || /^\d+\.?$/.test(stem) || stem.length < 3) return false;

  const rawOpts = q.o || q.options || [];
  const validOpts = Array.isArray(rawOpts)
    ? rawOpts.filter((opt: any) => String(opt || '').trim().length > 0)
    : [];
  if (validOpts.length < 2) return false;

  const rawAns = q.c ?? q.correctAnswer ?? q.answer ?? q.key;
  if (rawAns === undefined || rawAns === null) return false;
  if (typeof rawAns === 'number') {
    if (rawAns < 0 || rawAns > 3) return false;
  } else {
    const cleanStr = String(rawAns).trim().toUpperCase();
    if (!['0', '1', '2', '3', 'A', 'B', 'C', 'D'].includes(cleanStr)) {
      return false;
    }
  }

  // If verified by Admin, Admin verification is authoritative over heuristic citation mismatch checks
  if (isQuestionChapterVerified(q)) {
    return true;
  }

  const optA = String(validOpts[0] || '').trim();
  if (optA.length > 25 && stem.length < 10) return false;

  return getQuestionAuditStatus(q).isValid;
}

/**
 * Checks whether a question is explicitly marked as Chapter-Verified.
 * Accepts boolean true, string 'true', number 1, or variants across properties.
 */
export function isQuestionChapterVerified(q: Question | any): boolean {
  if (!q) return false;
  return (
    isQuestionManuallyVerified(q) ||
    q.is_chapter_verified === true ||
    q.isChapterVerified === true ||
    q.verified === true ||
    q.is_verified === true ||
    q.isVerified === true ||
    String(q.is_chapter_verified) === 'true' ||
    String(q.isChapterVerified) === 'true' ||
    String(q.verified) === 'true' ||
    String(q.is_verified) === 'true' ||
    q.is_chapter_verified === 1 ||
    q.isChapterVerified === 1 ||
    q.verified === 1 ||
    q.is_verified === 1
  );
}

/**
 * Checks whether a citation string is just a placeholder (e.g. contains ">", matches chapter tag, or is bare ">").
 * In student practice and mock tests, placeholder citations must be hidden.
 */
export function isPlaceholderCitation(ref?: string, chapterName?: string): boolean {
  if (!ref || !ref.trim()) return true;
  const clean = ref.trim();
  if (clean === '>' || clean === '-' || clean === '--' || clean === '.' || clean === '---') return true;
  if (clean.includes('>')) return true;
  if (chapterName && clean.toLowerCase() === chapterName.trim().toLowerCase()) return true;
  if (
    clean.toLowerCase().startsWith('charaka samhita >') ||
    clean.toLowerCase().startsWith('sushruta samhita >') ||
    clean.toLowerCase().startsWith('ashtanga hridaya >') ||
    clean.toLowerCase().startsWith('uncategorized')
  ) {
    return true;
  }
  if (/^chapter\s*\d+$/i.test(clean)) return true;
  return false;
}

export interface ChapterSummaryItem {
  id: string; // e.g. "Charaka Samhita > Sutrasthana > Chapter 1"
  name: string; // "Chapter 1"
  sthana: string; // "Sutrasthana"
  subject: string; // "Charaka Samhita"
  fullBreadcrumb: string;
  total: number;
  valid: number;
  malformed: number;
  verified: number;
}

export interface SthanaSummaryItem {
  name: string; // "Sutrasthana"
  subject: string;
  fullBreadcrumb: string; // "Charaka Samhita > Sutrasthana"
  total: number;
  valid: number;
  malformed: number;
  verified: number;
  chapters: ChapterSummaryItem[];
}

export interface SubjectSummaryItem {
  name: string; // "Charaka Samhita"
  total: number;
  valid: number;
  malformed: number;
  verified: number;
  sthanas: SthanaSummaryItem[];
}

/**
 * Groups all questions into a clean Subject -> Sthana -> Chapter hierarchy
 * with counts for Total, Valid (Live in Tests), and Malformed (Hidden).
 */
export function buildChapterHierarchy(questions: Question[]): SubjectSummaryItem[] {
  const subjectMap: Record<
    string,
    {
      total: number;
      valid: number;
      malformed: number;
      verified: number;
      sthanaMap: Record<
        string,
        {
          total: number;
          valid: number;
          malformed: number;
          verified: number;
          chapterMap: Record<
            string,
            {
              total: number;
              valid: number;
              malformed: number;
              verified: number;
              fullBreadcrumb: string;
            }
          >;
        }
      >;
    }
  > = {};

  questions.forEach((q) => {
    const rawTag = String(q.chapterName || q.ch || 'Uncategorized / Needs Review > General > Chapter 1').trim();
    const parts = rawTag.split('>').map((s) => s.trim());

    let subject = parts[0] || 'Uncategorized / Needs Review';
    let sthana = parts[1] || (subject.includes('Uncategorized') ? 'General' : 'Sutrasthana');
    let chapter = parts[2] || (parts[1] && parts[1].toLowerCase().includes('chapter') ? parts[1] : 'Chapter 1');

    if (!parts[1] && !parts[2]) {
      subject = 'Uncategorized / Needs Review';
      sthana = 'General';
      chapter = rawTag || 'Chapter 1';
    }

    if (!subjectMap[subject]) {
      subjectMap[subject] = { total: 0, valid: 0, malformed: 0, verified: 0, sthanaMap: {} };
    }
    if (!subjectMap[subject].sthanaMap[sthana]) {
      subjectMap[subject].sthanaMap[sthana] = { total: 0, valid: 0, malformed: 0, verified: 0, chapterMap: {} };
    }
    if (!subjectMap[subject].sthanaMap[sthana].chapterMap[chapter]) {
      subjectMap[subject].sthanaMap[sthana].chapterMap[chapter] = {
        total: 0,
        valid: 0,
        malformed: 0,
        verified: 0,
        fullBreadcrumb: `${subject} > ${sthana} > ${chapter}`,
      };
    }

    const malformed = isQuestionMalformed(q);
    const verified = isQuestionChapterVerified(q);

    subjectMap[subject].total += 1;
    subjectMap[subject].sthanaMap[sthana].total += 1;
    subjectMap[subject].sthanaMap[sthana].chapterMap[chapter].total += 1;

    if (verified && !malformed) {
      subjectMap[subject].verified += 1;
      subjectMap[subject].sthanaMap[sthana].verified += 1;
      subjectMap[subject].sthanaMap[sthana].chapterMap[chapter].verified += 1;
    }

    if (malformed) {
      subjectMap[subject].malformed += 1;
      subjectMap[subject].sthanaMap[sthana].malformed += 1;
      subjectMap[subject].sthanaMap[sthana].chapterMap[chapter].malformed += 1;
    } else {
      subjectMap[subject].valid += 1;
      subjectMap[subject].sthanaMap[sthana].valid += 1;
      subjectMap[subject].sthanaMap[sthana].chapterMap[chapter].valid += 1;
    }
  });

  // Convert map to sorted hierarchy
  const subjects: SubjectSummaryItem[] = Object.keys(subjectMap)
    .sort((a, b) => subjectMap[b].total - subjectMap[a].total)
    .map((subjKey) => {
      const subjData = subjectMap[subjKey];
      const sthanas: SthanaSummaryItem[] = Object.keys(subjData.sthanaMap)
        .sort((a, b) => subjData.sthanaMap[b].total - subjData.sthanaMap[a].total)
        .map((sthKey) => {
          const sthData = subjData.sthanaMap[sthKey];
          const chapters: ChapterSummaryItem[] = Object.keys(sthData.chapterMap)
            .sort((a, b) => {
              // Natural chapter number sort (Chapter 1, Chapter 2, ... Chapter 10)
              const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
              const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
              if (numA !== numB) return numA - numB;
              return a.localeCompare(b);
            })
            .map((chKey) => {
              const chData = sthData.chapterMap[chKey];
              return {
                id: chData.fullBreadcrumb,
                name: chKey,
                sthana: sthKey,
                subject: subjKey,
                fullBreadcrumb: chData.fullBreadcrumb,
                total: chData.total,
                valid: chData.valid,
                malformed: chData.malformed,
                verified: chData.verified,
              };
            });

          return {
            name: sthKey,
            subject: subjKey,
            fullBreadcrumb: `${subjKey} > ${sthKey}`,
            total: sthData.total,
            valid: sthData.valid,
            malformed: sthData.malformed,
            verified: sthData.verified,
            chapters,
          };
        });

      return {
        name: subjKey,
        total: subjData.total,
        valid: subjData.valid,
        malformed: subjData.malformed,
        verified: subjData.verified,
        sthanas,
      };
    });

  return subjects;
}
