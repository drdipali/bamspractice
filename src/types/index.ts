export type Difficulty = 0 | 1 | 2; // 0: Easy, 1: Medium, 2: Hard
export type Language = 'en' | 'hi' | 'both';
export type QuizMode = 'learning' | 'test';
export type StudentPracticeMode = 'chapter_verified' | 'mixed_mock';
export type DistributionType = 'pooled' | 'equal' | 'proportional' | 'manual';
export type ActiveView = 'auth' | 'build' | 'quiz' | 'result' | 'admin';
export * from './auth';

export type QuestionType =
  | 'standard'
  | 'assertion_reason'
  | 'match_the_pair'
  | 'statement_type';

export interface MatchPair {
  left: string;
  right: string;
}

export interface Question {
  id: string | number;
  ch: string | number;          // Chapter ID or Chapter Name identifier
  chapterName: string;          // Full breadcrumb e.g. "Charaka Samhita > Sutrasthana > Chapter 1"
  questionType: QuestionType;
  d: Difficulty;               // 0, 1, 2
  c: number;                   // Correct option index (0..3)
  stem: string;                // Question text / prompt
  o: string[];                 // 4 options [A, B, C, D]
  r?: string;                  // Chapter / Shloka textual citation or book reference
  explanation?: string;        // Detailed explanation for learning mode
  // Conditional fields for advanced question types
  assertionText?: string;      // For assertion_reason
  reasonText?: string;         // For assertion_reason
  statement1?: string;         // For statement_type
  statement2?: string;         // For statement_type
  matchPairs?: MatchPair[];    // For match_the_pair
  createdAt?: string;
  is_chapter_verified?: boolean; // Verified for strict chapter-wise practice
  isChapterVerified?: boolean;   // CamelCase alias
  is_manually_verified?: boolean; // Manually edited/verified by Admin; permanently excluded from issue detectors
  isManuallyVerified?: boolean;   // CamelCase alias
  manually_edited?: boolean;      // Admin edit flag
  hi?: {
    stem: string;
    o: string[];
    explanation?: string;
  };
}

export interface Chapter {
  id: string | number;
  name: string;
  sam: string;        // Samhita or Subject name
  sth: string;        // Sthana or Section name
  n: number | string; // Chapter number
  si?: number;        // Samhita index
  key: string;        // Unique section key e.g. "0-0"
  qs: Question[];     // Questions for this chapter (loaded on demand)
  verifiedCount?: number; // Lightweight verified question count
  totalCount?: number;    // Lightweight total question count
}

export interface SthanaDef {
  name: string;
  count: number;
}

export interface SamhitaDef {
  name: string;
  sthanas: [string, number][];
  groupIndex: number; // 0: Major, 1: Minor, 2: BAMS Subjects
}

export interface PracticeConfig {
  total: number;
  dist: DistributionType;
  diffs: Difficulty[];
  mode: QuizMode;
  manual: Record<string | number, number>;
}

export interface SavedPracticeSet {
  id: string;
  name: string;
  sel: (string | number)[];
  cfg: PracticeConfig;
  createdAt: number;
}

export interface QuizSession {
  qs: Question[];
  i: number;                                       // Current question index
  ans: Record<string | number, number>;            // Question ID -> Selected option index
  sub: Record<string | number, boolean>;           // Question ID -> Submitted status (Learning mode)
  rev: Record<string | number, boolean>;           // Question ID -> Marked for review
  mode: QuizMode;
  t0: number;                                      // Start timestamp ms
  t1?: number;                                     // Finish timestamp ms
  chs: (string | number)[];                        // Selected chapter IDs
  isMockTest?: boolean;                            // True if full-syllabus 120Q timed mock test
  durationSecs?: number;                           // e.g. 7200 for 120 minutes
}

export interface MockBlueprintItem {
  id: string;
  subject: string;
  weightage_questions: number;
  is_high_yield: boolean;
}

export interface SubjectAccuracyStat {
  subject: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  is_high_yield: boolean;
}

export interface ChapterStat {
  chapterId: string | number;
  chapterName?: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface QuizResults {
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  timeSpentSecs: number;
  byChapter: Record<string | number, ChapterStat>;
  bySubject?: Record<string, SubjectAccuracyStat>;
  isMockTest?: boolean;
  wrongQuestions: Question[];
  // Competitive exam scoring: +4 correct, -1 incorrect, 0 unattempted
  score: number;
  maxScore: number;
  scorePercent: number;
}
