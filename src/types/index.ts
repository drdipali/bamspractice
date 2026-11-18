export type Difficulty = 0 | 1 | 2; // 0: Easy, 1: Medium, 2: Hard
export type Language = 'en' | 'hi' | 'both';
export type QuizMode = 'learning' | 'test';
export type DistributionType = 'pooled' | 'equal' | 'proportional' | 'manual';
export type ActiveView = 'auth' | 'build' | 'quiz' | 'result' | 'admin';
export * from './auth';

export interface Question {
  id: number;
  ch: number;          // Chapter ID
  d: Difficulty;      // 0, 1, 2
  c: number;          // Correct option index (0..3)
  stem: string;       // English / Sanskrit stem
  o: string[];        // 4 options [A, B, C, D]
  r?: string;         // Chapter / Shloka textual citation
  hi?: {
    stem: string;
    o: string[];
  };
}

export interface Chapter {
  id: number;
  sam: string;        // Samhita or Subject name
  sth: string;        // Sthana or Section name
  n: number;          // Chapter number
  si: number;         // Samhita index
  key: string;        // Unique section key e.g. "0-0"
  qs: Question[];     // Questions for this chapter
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
  manual: Record<number, number>;
}

export interface SavedPracticeSet {
  id: string;
  name: string;
  sel: number[];
  cfg: PracticeConfig;
  createdAt: number;
}

export interface QuizSession {
  qs: Question[];
  i: number;                           // Current question index
  ans: Record<number, number>;         // Question ID -> Selected option index
  sub: Record<number, boolean>;        // Question ID -> Submitted status (Learning mode)
  rev: Record<number, boolean>;        // Question ID -> Marked for review
  mode: QuizMode;
  t0: number;                          // Start timestamp ms
  t1?: number;                         // Finish timestamp ms
  chs: number[];                       // Selected chapter IDs
}

export interface ChapterStat {
  chapterId: number;
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
  byChapter: Record<number, ChapterStat>;
  wrongQuestions: Question[];
  // Competitive exam scoring: +4 correct, -1 incorrect, 0 unattempted
  score: number;
  maxScore: number;
  scorePercent: number;
}
