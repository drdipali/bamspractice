import { QuizMode } from './index';

export interface QuizAttemptRecord {
  id: string;
  timestamp: string;
  score: number;
  maxScore: number;
  scorePercent: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  mode: QuizMode;
  chapterCount: number;
}

export interface UserRecord {
  id: string;
  email: string;
  phone?: string;
  role?: 'admin' | 'student';
  createdAt: string;
  lastActive: string;
  quizCount: number;
  quizzes: QuizAttemptRecord[];
}
