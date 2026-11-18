import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRecord, QuizAttemptRecord } from '../types/auth';
import { Chapter, Question } from '../types';
import { INITIAL_SEED_QUESTIONS } from './seedQuestions';
import { ALL_CHAPTERS } from '../constants/syllabusData';
import {
  SUPABASE_CONFIG,
  isRemoteSupabaseConfigured,
  FIREBASE_CONFIG,
  isRemoteFirebaseConfigured,
} from '../config/backendConfig';

const USERS_STORAGE_KEY = 'bams_cloud_users_v1';
const SESSION_STORAGE_KEY = 'bams_cloud_session_v1';
const QUESTIONS_STORAGE_KEY = 'bams_cloud_questions_v1';

// Initial pre-seeded users for immediate admin testing
const SEED_USERS: UserRecord[] = [
  {
    id: 'user_admin_001',
    email: 'admin@bams.com',
    phone: '9876543210',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date().toISOString(),
    quizCount: 2,
    quizzes: [
      {
        id: 'quiz_seed_0',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        score: 40,
        maxScore: 40,
        scorePercent: 100,
        correct: 10,
        incorrect: 0,
        unattempted: 0,
        mode: 'test',
        chapterCount: 1,
      },
      {
        id: 'quiz_seed_0b',
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        score: 35,
        maxScore: 40,
        scorePercent: 88,
        correct: 9,
        incorrect: 1,
        unattempted: 0,
        mode: 'learning',
        chapterCount: 1,
      },
    ],
  },
  {
    id: 'user_student_001',
    email: 'sharma.ayur@bams.com',
    phone: '9820012345',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    quizCount: 4,
    quizzes: [
      {
        id: 'quiz_seed_1',
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        score: 32,
        maxScore: 40,
        scorePercent: 80,
        correct: 8,
        incorrect: 0,
        unattempted: 2,
        mode: 'learning',
        chapterCount: 1,
      },
      {
        id: 'quiz_seed_2',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        score: 27,
        maxScore: 40,
        scorePercent: 68,
        correct: 7,
        incorrect: 1,
        unattempted: 2,
        mode: 'test',
        chapterCount: 2,
      },
    ],
  },
  {
    id: 'user_student_002',
    email: 'priya.bams@bams.com',
    phone: '9830067890',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    quizCount: 2,
    quizzes: [
      {
        id: 'quiz_seed_3',
        timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        score: 19,
        maxScore: 20,
        scorePercent: 95,
        correct: 5,
        incorrect: 1,
        unattempted: 0,
        mode: 'learning',
        chapterCount: 1,
      },
    ],
  },
  {
    id: 'user_student_003',
    email: 'rahul.vaidya@bams.com',
    phone: '9840054321',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    quizCount: 1,
    quizzes: [
      {
        id: 'quiz_seed_4',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        score: 15,
        maxScore: 20,
        scorePercent: 75,
        correct: 4,
        incorrect: 1,
        unattempted: 0,
        mode: 'test',
        chapterCount: 1,
      },
    ],
  },
];

// In-memory passwords for local cloud engine
const PASSWORDS_KEY = 'bams_cloud_passwords_v1';
const DEFAULT_PASSWORDS: Record<string, string> = {
  'admin@bams.com': 'admin123',
  '9876543210': 'admin123',
  'sharma.ayur@bams.com': 'student123',
  '9820012345': 'student123',
  'priya.bams@bams.com': 'student123',
  '9830067890': 'student123',
  'rahul.vaidya@bams.com': 'student123',
  '9840054321': 'student123',
};

/**
 * Builds Chapter objects containing all 1,179 classical BAMS syllabus chapters,
 * dynamically merging any questions created or imported into the cloud database.
 */
export function buildChaptersFromQuestions(cloudQuestions: Question[]): Chapter[] {
  // 1. Clone all 1,179 base chapters from the accredited classical syllabus
  const baseChapters: Chapter[] = ALL_CHAPTERS.map((ch) => ({
    ...ch,
    qs: [...ch.qs],
  }));

  const chapterMap: Record<string, Chapter> = {};
  baseChapters.forEach((ch) => {
    chapterMap[String(ch.id)] = ch;
    const path = `${ch.sam} > ${ch.sth} > Chapter ${ch.n}`.toLowerCase();
    chapterMap[path] = ch;
    const pathAlt = `${ch.sam} > ${ch.sth} > ${ch.name}`.toLowerCase();
    chapterMap[pathAlt] = ch;
  });

  // 2. Merge cloud-authored and CSV-imported questions into their target chapters
  const extraChaptersMap: Record<string, Question[]> = {};

  cloudQuestions.forEach((q) => {
    const chBreadcrumb = (q.chapterName || String(q.ch)).trim().toLowerCase();
    const chId = String(q.ch).trim();

    const target = chapterMap[chId] || chapterMap[chBreadcrumb];
    if (target) {
      // Add or replace question without duplicates
      if (!target.qs.some((existing) => String(existing.id) === String(q.id))) {
        target.qs.unshift(q);
      }
    } else {
      // Custom chapter added outside the 1,179 standard chapters
      const customKey = q.chapterName || String(q.ch);
      if (!extraChaptersMap[customKey]) {
        extraChaptersMap[customKey] = [];
      }
      extraChaptersMap[customKey].push(q);
    }
  });

  // 3. Append any custom admin chapters
  Object.keys(extraChaptersMap).forEach((customKey, idx) => {
    const parts = customKey.split('>').map((p) => p.trim());
    let sam = 'Custom Subjects';
    let sth = 'General';
    let n: string | number = customKey;

    if (parts.length >= 3) {
      sam = parts[0];
      sth = parts[1];
      n = parts[2];
    } else if (parts.length === 2) {
      sam = parts[0];
      sth = parts[1];
      n = parts[1];
    }

    baseChapters.push({
      id: `custom_${idx}`,
      name: n.toString(),
      sam,
      sth,
      n,
      key: `custom_${idx}`,
      qs: extraChaptersMap[customKey],
    });
  });

  return baseChapters;
}

class BackendService {
  private users: UserRecord[] = [];
  private passwords: Record<string, string> = {};
  private currentUser: UserRecord | null = null;
  private questions: Question[] = [];
  private isInitialized = false;

  private async initialize() {
    if (this.isInitialized) return;

    try {
      // 1. Users
      const storedUsers = await AsyncStorage.getItem(USERS_STORAGE_KEY);
      if (storedUsers) {
        this.users = JSON.parse(storedUsers);
      } else {
        this.users = [...SEED_USERS];
        await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
      }

      // 2. Passwords
      const storedPasswords = await AsyncStorage.getItem(PASSWORDS_KEY);
      if (storedPasswords) {
        this.passwords = JSON.parse(storedPasswords);
      } else {
        this.passwords = { ...DEFAULT_PASSWORDS };
        await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(this.passwords));
      }

      // 3. Current Session
      const storedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        const user = this.users.find((u) => u.id === parsed.id || u.email === parsed.email);
        if (user) {
          this.currentUser = user;
        }
      }

      // 4. Cloud Questions Collection
      const storedQuestions = await AsyncStorage.getItem(QUESTIONS_STORAGE_KEY);
      if (storedQuestions) {
        this.questions = JSON.parse(storedQuestions);
      } else {
        this.questions = [...INITIAL_SEED_QUESTIONS];
        await AsyncStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(this.questions));
      }
    } catch (e) {
      console.warn('Backend initialization error:', e);
      this.users = [...SEED_USERS];
      this.passwords = { ...DEFAULT_PASSWORDS };
      this.questions = [...INITIAL_SEED_QUESTIONS];
    }

    this.isInitialized = true;
  }

  // ==========================================
  // AUTHENTICATION & USERS
  // ==========================================

  async signUp(email: string, password: string, phone?: string): Promise<UserRecord> {
    await this.initialize();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : undefined;
    if (cleanPhone && cleanPhone.length < 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }

    const existingEmail = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (existingEmail) {
      throw new Error('An account with this email already exists. Please log in.');
    }

    if (cleanPhone) {
      const existingPhone = this.users.find(
        (u) =>
          u.phone &&
          u.phone.replace(/[^0-9]/g, '').slice(-10) === cleanPhone.slice(-10)
      );
      if (existingPhone) {
        throw new Error('An account with this mobile number already exists. Please log in.');
      }
    }

    const newUser: UserRecord = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: normalizedEmail,
      phone: cleanPhone ? cleanPhone.slice(-10) : undefined,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      quizCount: 0,
      quizzes: [],
    };

    this.users.unshift(newUser);
    this.passwords[normalizedEmail] = password;
    if (cleanPhone) {
      this.passwords[cleanPhone.slice(-10)] = password;
    }
    this.currentUser = newUser;

    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
    await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(this.passwords));
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));

    return newUser;
  }

  async logIn(identifier: string, password: string): Promise<UserRecord> {
    await this.initialize();

    const normalized = identifier.trim().toLowerCase();
    const digitsOnly = identifier.replace(/[^0-9]/g, '');

    if (!normalized) {
      throw new Error('Please enter your email or mobile number.');
    }

    if (normalized === 'admin@bams.com' && !this.passwords['admin@bams.com']) {
      this.passwords['admin@bams.com'] = 'admin123';
    }

    // Match by email or 10-digit mobile number
    const user = this.users.find((u) => {
      if (u.email.toLowerCase() === normalized) return true;
      if (
        digitsOnly.length >= 10 &&
        u.phone &&
        u.phone.replace(/[^0-9]/g, '').slice(-10) === digitsOnly.slice(-10)
      ) {
        return true;
      }
      return false;
    });

    if (!user) {
      throw new Error(
        'No account found with this email or mobile number. Please check your details or Sign Up.'
      );
    }

    // Verify password against email or phone key
    const savedPassword =
      this.passwords[user.email.toLowerCase()] ||
      (user.phone ? this.passwords[user.phone.slice(-10)] : undefined) ||
      this.passwords[normalized] ||
      (digitsOnly ? this.passwords[digitsOnly.slice(-10)] : undefined);

    if (savedPassword && savedPassword !== password) {
      throw new Error('Incorrect password. Please try again.');
    }

    user.lastActive = new Date().toISOString();
    this.currentUser = user;

    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));

    return user;
  }

  async logOut(): Promise<void> {
    await this.initialize();
    this.currentUser = null;
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  }

  async getCurrentUser(): Promise<UserRecord | null> {
    await this.initialize();
    return this.currentUser;
  }

  async recordQuizAttempt(
    userId: string,
    attemptData: Omit<QuizAttemptRecord, 'id'>
  ): Promise<void> {
    await this.initialize();

    const user = this.users.find((u) => u.id === userId || u.email === this.currentUser?.email);
    if (!user) return;

    const newAttempt: QuizAttemptRecord = {
      id: `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...attemptData,
    };

    user.quizzes.unshift(newAttempt);
    user.quizCount = user.quizzes.length;
    user.lastActive = new Date().toISOString();

    if (this.currentUser && this.currentUser.id === user.id) {
      this.currentUser = { ...user };
    }

    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
    if (this.currentUser) {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.currentUser));
    }
  }

  async getAllUsers(): Promise<UserRecord[]> {
    await this.initialize();
    return [...this.users];
  }

  // ==========================================
  // CLOUD QUESTIONS COLLECTION (CMS)
  // ==========================================

  async getQuestions(): Promise<Question[]> {
    await this.initialize();
    return [...this.questions];
  }

  async getQuestionsByChapters(chapterIdsOrNames: (string | number)[]): Promise<Question[]> {
    await this.initialize();
    const allChapters = await this.getChapters();
    const set = new Set(chapterIdsOrNames.map((c) => c.toString().trim().toLowerCase()));

    const result: Question[] = [];
    const seen = new Set<string | number>();

    // 1. Cloud-authored questions matching selected chapters
    this.questions.forEach((q) => {
      const chName = (q.chapterName || q.ch?.toString() || '').trim().toLowerCase();
      const chId = q.ch?.toString().trim().toLowerCase();
      if (set.has(chName) || set.has(chId)) {
        if (!seen.has(q.id)) {
          seen.add(q.id);
          result.push(q);
        }
      }
    });

    // 2. Base syllabus questions matching selected chapters
    allChapters.forEach((ch) => {
      const chId = ch.id.toString().trim().toLowerCase();
      const chPath = `${ch.sam} > ${ch.sth} > Chapter ${ch.n}`.toLowerCase();
      const chPathAlt = `${ch.sam} > ${ch.sth} > ${ch.name}`.toLowerCase();
      if (set.has(chId) || set.has(chPath) || set.has(chPathAlt)) {
        ch.qs.forEach((q) => {
          if (!seen.has(q.id)) {
            seen.add(q.id);
            result.push(q);
          }
        });
      }
    });

    return result;
  }

  async getChapters(): Promise<Chapter[]> {
    await this.initialize();
    return buildChaptersFromQuestions(this.questions);
  }

  async getUniqueChapterNames(): Promise<string[]> {
    await this.initialize();
    const set = new Set<string>();
    this.questions.forEach((q) => {
      if (q.chapterName) set.add(q.chapterName.trim());
    });
    return Array.from(set).sort();
  }

  async addQuestion(questionData: Omit<Question, 'id'>): Promise<Question> {
    await this.initialize();

    const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newQuestion: Question = {
      id,
      ...questionData,
      ch: questionData.chapterName || questionData.ch,
      chapterName: questionData.chapterName || questionData.ch.toString(),
      createdAt: new Date().toISOString(),
    };

    this.questions.unshift(newQuestion);
    await AsyncStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(this.questions));

    return newQuestion;
  }

  async batchAddQuestions(
    newQuestions: Omit<Question, 'id'>[]
  ): Promise<{ added: number; errors: string[] }> {
    await this.initialize();

    const addedQuestions: Question[] = [];
    const errors: string[] = [];

    newQuestions.forEach((qData, idx) => {
      if (!qData.chapterName || !qData.stem || !qData.o || qData.o.length < 4) {
        errors.push(`Row ${idx + 1}: Incomplete question content.`);
        return;
      }

      const id = `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      addedQuestions.push({
        id,
        ...qData,
        ch: qData.chapterName,
        chapterName: qData.chapterName,
        createdAt: new Date().toISOString(),
      });
    });

    if (addedQuestions.length > 0) {
      this.questions = [...addedQuestions, ...this.questions];
      await AsyncStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(this.questions));
    }

    return { added: addedQuestions.length, errors };
  }

  async deleteQuestion(id: string | number): Promise<void> {
    await this.initialize();
    this.questions = this.questions.filter((q) => q.id !== id);
    await AsyncStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(this.questions));
  }

  async updateQuestion(id: string | number, patch: Partial<Question>): Promise<Question> {
    await this.initialize();
    const index = this.questions.findIndex((q) => q.id === id);
    if (index === -1) {
      throw new Error(`Question with id ${id} not found.`);
    }

    const updated: Question = {
      ...this.questions[index],
      ...patch,
      ch: patch.chapterName || this.questions[index].chapterName,
    };

    this.questions[index] = updated;
    await AsyncStorage.setItem(QUESTIONS_STORAGE_KEY, JSON.stringify(this.questions));

    return updated;
  }
}

export const backend = new BackendService();
