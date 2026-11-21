import type { Question } from '../types/index';

/**
 * Converts Devanagari numerals (०, १, २, ३, ४, ५, ६, ७, ८, ९) to ASCII digits (0-9)
 */
export function convertDevanagariNumerals(str: string): string {
  if (!str) return '';
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return str.replace(/[०-९]/g, (w) => String(devanagariDigits.indexOf(w)));
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
  context?: ContextHints,
  stem?: string
): DetectedChapterInfo {
  const rawRef = `${citation || ''} ${explanation || ''} ${(stem || '').slice(0, 350)}`.trim();
  const normalizedRef = convertDevanagariNumerals(rawRef);
  const normalizedFileName = convertDevanagariNumerals(context?.fileName || '');
  const normalizedTabName = convertDevanagariNumerals(context?.tabName || '');
  const combinedContext = `${normalizedFileName} ${normalizedTabName}`.toLowerCase();

  // 1. Detect Subject / Samhita
  let subject = '';
  let subjectSource: DetectedChapterInfo['source'] = 'default';

  const refLower = normalizedRef.toLowerCase();

  // Sushruta Samhita check
  if (
    /sushrut|suśruta|सुश्रुत|su\.?\s*(?:su|ni|sha|ci|chi|ka|ut|सू|नि|शा|चि|क|उ)|ss\s*[-–.]?\s*(?:su|ni|sha|ci|ut)/i.test(
      refLower
    )
  ) {
    subject = 'Sushruta Samhita';
    subjectSource = 'citation';
  } else if (/sushrut|suśruta|सुश्रुत/i.test(combinedContext)) {
    subject = 'Sushruta Samhita';
    subjectSource = context?.fileName ? 'filename' : 'tabname';
  }
  // Charaka Samhita check
  else if (
    /charak|caraka|चरक|ca\.?\s*(?:su|ni|vi|sha|in|ci|chi|ka|si|सू|नि|वि|शा|इन्|चि|क|सि)|cs\s*[-–.]?\s*(?:su|ni|vi|ci)/i.test(
      refLower
    )
  ) {
    subject = 'Charaka Samhita';
    subjectSource = 'citation';
  } else if (/charak|caraka|चरक/i.test(combinedContext)) {
    subject = 'Charaka Samhita';
    subjectSource = context?.fileName ? 'filename' : 'tabname';
  }
  // Ashtanga Hridaya check
  else if (
    /ashtang|aṣṭāṅga|अष्टाङ्ग|अष्टांग|hridaya|hṛdaya|हृदय|vagbhat|वाग्भट|a\.?\s*h\.?|a\.?\s*s\.?/i.test(
      refLower
    )
  ) {
    subject = 'Ashtanga Hridaya';
    subjectSource = 'citation';
  } else if (/ashtang|hridaya|vagbhat|अष्टाङ्ग|हृदय/i.test(combinedContext)) {
    subject = 'Ashtanga Hridaya';
    subjectSource = 'filename';
  }
  // Sharangadhara Samhita check
  else if (/sharang|śārṅga|शार्ङ्गधर|शारंगधर/i.test(refLower) || /sharang|शार्ङ्गधर/i.test(combinedContext)) {
    subject = 'Sharangadhara Samhita';
    subjectSource = 'citation';
  }
  // Madhava Nidana check
  else if (/madhava|mādhava|माधव/i.test(refLower) || /madhav|माधव/i.test(combinedContext)) {
    subject = 'Madhava Nidana';
    subjectSource = 'citation';
  }
  // Kashyapa Samhita check
  else if (/kashyap|kāśyapa|काश्यप/i.test(refLower) || /kashyap|काश्यप/i.test(combinedContext)) {
    subject = 'Kashyapa Samhita';
    subjectSource = 'citation';
  }
  // Dravyaguna
  else if (/dravyaguna|द्रव्यगुण/i.test(refLower) || /dravyaguna|द्रव्यगुण/i.test(combinedContext)) {
    subject = 'Dravyaguna Vijnana';
    subjectSource = 'citation';
  }
  // Rasa Shastra
  else if (/rasashastra|bhaishajya|रसशास्त्र|भैषज्य/i.test(refLower) || /rasa|bhaishajya/i.test(combinedContext)) {
    subject = 'Rasa Shastra & Bhaishajya Kalpana';
    subjectSource = 'citation';
  }
  // Existing breadcrumb check
  else if (context?.existingChapter && context.existingChapter.includes('>')) {
    const parts = context.existingChapter.split('>').map((p) => p.trim());
    subject = parts[0] || 'Uncategorized / Needs Review';
    subjectSource = 'existing';
  } else if (context?.defaultSubject) {
    subject = context.defaultSubject;
    subjectSource = 'default';
  } else {
    subject = 'Uncategorized / Needs Review';
    subjectSource = 'default';
  }

  // 2. Detect Sthana (Section)
  let sthana = '';
  const searchPool = `${refLower} ${combinedContext}`;

  if (/uttaratantra|uttara|uttar|उत्तरتन्त्र|उत्तरतन्त्र|उत्तरस्थान|उत्तर|su\.?\s*ut|ah\.?\s*ut/i.test(searchPool)) {
    // Charaka Samhita strictly has 8 Sthanas and NO Uttaratantra / Uttarasthana!
    if (subject === 'Charaka Samhita' || subject === 'Uncategorized / Needs Review' || !subject) {
      if (/ashtang|aṣṭāṅga|अष्टाङ्ग|vagbhat|वाग्भट|a\.?\s*h\.?/i.test(searchPool)) {
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
  } else if (/nidan|nidāna|निदानस्थान|निदान|ca\.?\s*ni|su\.?\s*ni|ah\.?\s*ni|च\.?\s*नि|सु\.?\s*नि/i.test(searchPool)) {
    sthana = 'Nidanasthana';
  } else if (/viman|vimāna|विमानस्थान|विमान|ca\.?\s*vi|च\.?\s*वि/i.test(searchPool)) {
    sthana = 'Vimanasthana';
  } else if (/sharir|śārīra|शारीरस्थान|शारीर|ca\.?\s*sha|su\.?\s*sha|ah\.?\s*sha|च\.?\s*शा|सु\.?\s*शा/i.test(searchPool)) {
    sthana = 'Sharirasthana';
  } else if (/indriya|इन्द्रियस्थान|इन्द्रिय|ca\.?\s*in|च\.?\s*इन्/i.test(searchPool)) {
    sthana = 'Indriyasthana';
  } else if (/chikitsa|cikitsā|चिकित्सास्थान|चिकित्सा|ca\.?\s*ci|ca\.?\s*chi|su\.?\s*ci|su\.?\s*chi|च\.?\s*चि|सु\.?\s*चि/i.test(searchPool)) {
    sthana = 'Chikitsasthana';
  } else if (/kalpa|कल्पस्थान|कल्प|ca\.?\s*ka|ca\.?\s*kal|su\.?\s*ka|su\.?\s*kal|च\.?\s*क|सु\.?\s*क/i.test(searchPool)) {
    sthana = 'Kalpasthana';
  } else if (/siddhi|सिद्धिस्थान|सिद्धि|ca\.?\s*si|च\.?\s*सि/i.test(searchPool)) {
    sthana = 'Siddhisthana';
  } else if (/purva|पूर्व/i.test(searchPool) && subject.includes('Sharangadhara')) {
    sthana = 'Purva Khanda';
  } else if (/madhyama|मध्यम/i.test(searchPool) && subject.includes('Sharangadhara')) {
    sthana = 'Madhyama Khanda';
  } else if (/sutra|sūtra|सूत्रस्थानम्|सूत्रस्थान|सूत्र|ca\.?\s*su|su\.?\s*su|ah\.?\s*su|च\.?\s*सू|सु\.?\s*सू/i.test(searchPool)) {
    sthana = 'Sutrasthana';
  } else {
    // If context has existing sthana
    if (context?.existingChapter && context.existingChapter.includes('>')) {
      const parts = context.existingChapter.split('>').map((p) => p.trim());
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

  // Pattern A: Classical shloka citation with chapter prefix: e.g. "sūtrasthānam 45/12", "सूत्रस्थानम् ४५/२", "sutra 45/1"
  const mCitationWithSthana = refLower.match(
    /(?:sūtrasthānam|sutrasthanam|सूत्रस्थानम्|सूत्रस्थान|chikitsasthanam|चिकित्सास्थानम्|uttaratantra|उत्तरतन्त्र|nidana|निदान|sharira|शारीर|adhyaya|अध्याय)\s*[:\-–]?\s*(\d{1,3})/i
  );
  if (mCitationWithSthana && mCitationWithSthana[1]) {
    chNum = mCitationWithSthana[1];
  }

  // Pattern B: Classical fraction citation e.g. "ca.su 1/115", "su.su 45/12", "च.सू - 1/115", "45/12", "26 / 8"
  if (!chNum) {
    const mFraction = refLower.match(
      /(?:ca|su|ah|cs|ss|च|सु)\s*[-–.]?\s*(?:su|ni|vi|sha|in|ci|chi|ka|si|ut|सू|नि|वि|शा|इन्|चि|क|सि|उ)?\s*[-–.]?\s*(\d{1,3})\s*[\/:]\s*\d+/i
    );
    if (mFraction && mFraction[1]) {
      chNum = mFraction[1];
    }
  }

  // Pattern C: Plain fraction "45/12" or "45:12" in citation
  if (!chNum) {
    const mPlainFraction = refLower.match(/\b(\d{1,3})\s*[\/:]\s*\d+\b/);
    if (mPlainFraction && mPlainFraction[1]) {
      chNum = mPlainFraction[1];
    }
  }

  // Pattern D: Explicit "Chapter 45", "Ch 45", "Ch. 45", "Adhyaya 45" in citation or context
  if (!chNum) {
    const mExplicit = `${refLower} ${combinedContext}`.match(
      /(?:chapter|adhyaya|अध्याय|ch\.?)\s*[:\-–]?\s*(\d{1,3})/i
    );
    if (mExplicit && mExplicit[1]) {
      chNum = mExplicit[1];
    }
  }

  // Pattern E: Tab Name or File Name is just a number (e.g. "45", "Ch 45", "Sutra 45")
  if (!chNum && context?.tabName) {
    const tabClean = normalizedTabName.trim();
    const mTab = tabClean.match(/^(?:chapter|ch\.?|adhyaya)?\s*(\d{1,3})$/i) || tabClean.match(/\b(\d{1,3})\b/);
    if (mTab && mTab[1]) {
      chNum = mTab[1];
    }
  }

  // Pattern F: Existing chapter number if already present in question
  if (!chNum && context?.existingChapter) {
    const mExist = context.existingChapter.match(/chapter\s*(\d{1,3})/i) || context.existingChapter.match(/\b(\d{1,3})\b/);
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
};

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
 * Detects whether a question has:
 * 1. A Samhita conflict (e.g. citation mentions Sushruta/su.su while Question Text or Chapter Tag mentions Charaka)
 * 2. An impossible Sthana for that Samhita (e.g. Charaka Samhita > Uttarasthana / Uttaratantra)
 * 3. An impossible chapter number for that Samhita/Sthana (e.g. Charaka Sutra > 30, Charaka Nidana > 8, Sushruta Sutra > 46).
 */
export function detectSamhitaMismatch(q: Question): SamhitaMismatchResult {
  const stem = String(q.stem || '');
  const ref = String(q.r || '');
  const exp = String(q.explanation || '');
  const tag = String(q.chapterName || q.ch || '').trim();

  // Combine reference, explanation, and first 350 chars of stem (where shlokas/citations often appear)
  const citationPool = `${ref} ${exp} ${stem.slice(0, 350)}`;
  const normalizedCitationPool = convertDevanagariNumerals(citationPool).toLowerCase();

  // 1. Detect which Samhita the citation actually points to
  let citationSamhita: 'Sushruta Samhita' | 'Charaka Samhita' | 'Ashtanga Hridaya' | null = null;
  let citationEvidence = '';

  if (
    /su\.?\s*(?:su|ni|sha|ci|chi|ka|ut|सू|नि|शा|चि|क|उ)|sushrut|suśruta|सुश्रुत|ss\s*[-–.]?\s*(?:su|ni|sha|ci|ut)/i.test(
      normalizedCitationPool
    )
  ) {
    citationSamhita = 'Sushruta Samhita';
    citationEvidence = 'Sushruta (su.su)';
  } else if (
    /ca\.?\s*(?:su|ni|vi|sha|in|ci|chi|ka|si|सू|नि|वि|शा|इन्|चि|क|सि)|charak|caraka|चरक|cs\s*[-–.]?\s*(?:su|ni|vi|ci)/i.test(
      normalizedCitationPool
    )
  ) {
    citationSamhita = 'Charaka Samhita';
    citationEvidence = 'Charaka (ca.su)';
  } else if (
    /ashtang|aṣṭāṅga|अष्टाङ्ग|अष्टांग|hridaya|hṛdaya|हृदय|vagbhat|वाग्भट|a\.?\s*h\.?|a\.?\s*s\.?/i.test(
      normalizedCitationPool
    )
  ) {
    citationSamhita = 'Ashtanga Hridaya';
    citationEvidence = 'Ashtanga (A.H.)';
  }

  // 2. Detect which Samhita is claimed by Chapter Tag and Question Text
  const tagLower = tag.toLowerCase();
  const stemLower = stem.toLowerCase();

  let claimedSamhita: 'Charaka Samhita' | 'Sushruta Samhita' | 'Ashtanga Hridaya' | null = null;
  if (
    tagLower.includes('charaka') ||
    stemLower.includes('acharya charak') ||
    stemLower.includes('चरक के मतानुसार') ||
    stemLower.includes('charaka samhita')
  ) {
    claimedSamhita = 'Charaka Samhita';
  } else if (
    tagLower.includes('sushrut') ||
    stemLower.includes('sushruta') ||
    stemLower.includes('सुश्रुत')
  ) {
    claimedSamhita = 'Sushruta Samhita';
  } else if (
    tagLower.includes('ashtang') ||
    stemLower.includes('ashtanga') ||
    stemLower.includes('अष्टाङ्ग')
  ) {
    claimedSamhita = 'Ashtanga Hridaya';
  }

  // Auto-detect best target tag using detectChapterInfo (inspecting citation + stem + explanation)
  const detectedTarget = detectChapterInfo(ref, exp, { existingChapter: tag }, stem);

  // Check Condition 1: Samhita conflict between Citation vs Tag / Question text
  if (citationSamhita && claimedSamhita && citationSamhita !== claimedSamhita) {
    const citationShort = citationSamhita.replace(' Samhita', '');
    const claimedShort = claimedSamhita.replace(' Samhita', '');
    return {
      hasMismatch: true,
      type: 'samhita_conflict',
      citationSamhita,
      claimedSamhita,
      badgeLabel: `⚠️ Samhita Mismatch: Citation is ${citationShort}, Tag/Text says ${claimedShort}`,
      detailedMessage: `Citation points to ${citationSamhita} (${citationEvidence}), but the question is tagged or worded as ${claimedSamhita}.`,
      suggestedTag: detectedTarget.fullChapterName,
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
          if (/ashtang|aṣṭāṅga|vagbhat|वाग्भट|a\.h\.|ah\./i.test(citationPool)) {
            targetSubject = 'Ashtanga Hridaya';
            targetSthana = 'Uttarasthana';
          }
          if (chNum > 40) {
            // Ashtanga Uttarasthana only has 40 chapters, so > 40 must be Sushruta
            targetSubject = 'Sushruta Samhita';
            targetSthana = 'Uttaratantra';
          }
          const suggestedTag = `${targetSubject} > ${targetSthana} > Chapter ${chNum}`;

          return {
            hasMismatch: true,
            type: 'impossible_sthana',
            citationSamhita: citationSamhita || targetSubject,
            claimedSamhita: samhitaName,
            badgeLabel: `⚠️ Impossible Sthana: ${samhitaName} has no ${sthanaName}`,
            detailedMessage: `${samhitaName} strictly contains 8 classical Sthanas and has no ${sthanaName}. Auto-reassign to ${suggestedTag}.`,
            suggestedTag,
          };
        }

        // B. Impossible Chapter Number (e.g. Charaka Sutra > 30, Charaka Nidana > 8)
        if (chNum > canonicalSthana.maxChapters) {
          let suggestedTag = detectedTarget.fullChapterName;
          if (suggestedTag === tag) {
            // If detectedTarget still matched the invalid tag, check if verse belongs to Sushruta
            if (samhitaName === 'Charaka Samhita' && canonicalSthana.name === 'Sutrasthana' && chNum <= 46) {
              suggestedTag = `Sushruta Samhita > Sutrasthana > Chapter ${chNum}`;
            } else {
              suggestedTag = `${samhitaName} > ${canonicalSthana.name} > Chapter ${canonicalSthana.maxChapters}`;
            }
          }

          return {
            hasMismatch: true,
            type: 'impossible_chapter',
            citationSamhita: citationSamhita || undefined,
            claimedSamhita: samhitaName,
            badgeLabel: `⚠️ Impossible Chapter: ${samhitaName} ${canonicalSthana.name} has max ${canonicalSthana.maxChapters} chapters (Tagged as Ch ${chNum})`,
            detailedMessage: `${samhitaName} ${canonicalSthana.name} only contains ${canonicalSthana.maxChapters} chapters. Tagging as Chapter ${chNum} is invalid.`,
            suggestedTag,
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

  // Check if Samhita mismatch exists
  const mismatch = detectSamhitaMismatch(q);
  if (mismatch.hasMismatch && mismatch.suggestedTag && mismatch.suggestedTag !== currentTag) {
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
    currentTag === '1';

  // If currently generic and detected is different
  if (isCurrentGeneric && detected.fullChapterName !== 'Charaka Samhita > Sutrasthana > Chapter 1') {
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
    detected.source === 'citation'
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
    detected.confidence === 'high'
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
      issueReason: mismatch.badgeLabel.replace(/^⚠️\s*/, ''),
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
  return !getQuestionAuditStatus(q).isValid;
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
}

export interface SthanaSummaryItem {
  name: string; // "Sutrasthana"
  subject: string;
  fullBreadcrumb: string; // "Charaka Samhita > Sutrasthana"
  total: number;
  valid: number;
  malformed: number;
  chapters: ChapterSummaryItem[];
}

export interface SubjectSummaryItem {
  name: string; // "Charaka Samhita"
  total: number;
  valid: number;
  malformed: number;
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
      sthanaMap: Record<
        string,
        {
          total: number;
          valid: number;
          malformed: number;
          chapterMap: Record<
            string,
            {
              total: number;
              valid: number;
              malformed: number;
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
      subjectMap[subject] = { total: 0, valid: 0, malformed: 0, sthanaMap: {} };
    }
    if (!subjectMap[subject].sthanaMap[sthana]) {
      subjectMap[subject].sthanaMap[sthana] = { total: 0, valid: 0, malformed: 0, chapterMap: {} };
    }
    if (!subjectMap[subject].sthanaMap[sthana].chapterMap[chapter]) {
      subjectMap[subject].sthanaMap[sthana].chapterMap[chapter] = {
        total: 0,
        valid: 0,
        malformed: 0,
        fullBreadcrumb: `${subject} > ${sthana} > ${chapter}`,
      };
    }

    const malformed = isQuestionMalformed(q);

    subjectMap[subject].total += 1;
    subjectMap[subject].sthanaMap[sthana].total += 1;
    subjectMap[subject].sthanaMap[sthana].chapterMap[chapter].total += 1;

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
              };
            });

          return {
            name: sthKey,
            subject: subjKey,
            fullBreadcrumb: `${subjKey} > ${sthKey}`,
            total: sthData.total,
            valid: sthData.valid,
            malformed: sthData.malformed,
            chapters,
          };
        });

      return {
        name: subjKey,
        total: subjData.total,
        valid: subjData.valid,
        malformed: subjData.malformed,
        sthanas,
      };
    });

  return subjects;
}
