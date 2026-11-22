import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserRecord, QuizAttemptRecord } from '../types/auth';
import { Chapter, Question, MockBlueprintItem } from '../types';
import { INITIAL_SEED_QUESTIONS } from './seedQuestions';
import { ALL_CHAPTERS } from '../constants/syllabusData';
import { normalizeQuestionStem } from '../utils/spreadsheetHelper';
import { isQuestionChapterVerified, isValidQuestion } from '../utils/chapterMapper';
import {
  SUPABASE_CONFIG,
  isRemoteSupabaseConfigured,
  FIREBASE_CONFIG,
  isRemoteFirebaseConfigured,
} from '../config/backendConfig';

const USERS_STORAGE_KEY = 'bams_cloud_users_v1';
const SESSION_STORAGE_KEY = 'bams_cloud_session_v1';
const QUESTIONS_STORAGE_KEY = 'bams_cloud_questions_v1';
const MOCK_BLUEPRINT_STORAGE_KEY = 'bams_mock_blueprint_v1';

export const DEFAULT_MOCK_BLUEPRINT: MockBlueprintItem[] = [
  {
    id: 'bp_charaka',
    subject: 'Charaka Samhita',
    weightage_questions: 35,
    is_high_yield: true,
  },
  {
    id: 'bp_sushruta',
    subject: 'Sushruta Samhita',
    weightage_questions: 30,
    is_high_yield: true,
  },
  {
    id: 'bp_ashtanga',
    subject: 'Ashtanga Hridaya',
    weightage_questions: 15,
    is_high_yield: true,
  },
  {
    id: 'bp_dravyaguna_rasa',
    subject: 'Dravyaguna & Rasashastra',
    weightage_questions: 15,
    is_high_yield: true,
  },
  {
    id: 'bp_roganidana_kaya',
    subject: 'Roganidana & Kayachikitsa',
    weightage_questions: 15,
    is_high_yield: false,
  },
  {
    id: 'bp_modern_research',
    subject: 'Modern Medical & Research Methodology',
    weightage_questions: 10,
    is_high_yield: false,
  },
];

export function matchQuestionToBlueprintSubject(
  chapterName: string,
  blueprint: MockBlueprintItem[]
): string {
  const norm = (chapterName || '').toLowerCase().trim();
  const root = (chapterName.split('>')[0] || '').trim().toLowerCase();

  // 1. Direct match with blueprint subject name or root
  for (const item of blueprint) {
    const sNorm = item.subject.toLowerCase().trim();
    if (norm.includes(sNorm) || sNorm.includes(root)) {
      return item.subject;
    }
  }

  // 2. Specific Samhita & Subject keywords
  if (norm.includes('charak') || norm.includes('चरक')) {
    const b = blueprint.find((x) => x.subject.toLowerCase().includes('charak'));
    if (b) return b.subject;
  }
  if (norm.includes('sushrut') || norm.includes('su.su') || norm.includes('सुश्रुत')) {
    const b = blueprint.find((x) => x.subject.toLowerCase().includes('sushrut'));
    if (b) return b.subject;
  }
  if (
    norm.includes('ashtang') ||
    norm.includes('hridaya') ||
    norm.includes('vagbhat') ||
    norm.includes('अष्टांग')
  ) {
    const b = blueprint.find((x) => x.subject.toLowerCase().includes('ashtang'));
    if (b) return b.subject;
  }
  if (
    norm.includes('dravya') ||
    norm.includes('rasa') ||
    norm.includes('bhaishaj') ||
    norm.includes('bhasma') ||
    norm.includes('द्रव्यगुण') ||
    norm.includes('रसशास्त्र')
  ) {
    const b = blueprint.find(
      (x) => x.subject.toLowerCase().includes('dravya') || x.subject.toLowerCase().includes('rasa')
    );
    if (b) return b.subject;
  }
  if (
    norm.includes('roga') ||
    norm.includes('nidana') ||
    norm.includes('kaya') ||
    norm.includes('chikitsa') ||
    norm.includes('रोगनिदान') ||
    norm.includes('कायचिकित्सा')
  ) {
    const b = blueprint.find(
      (x) => x.subject.toLowerCase().includes('roga') || x.subject.toLowerCase().includes('kaya')
    );
    if (b) return b.subject;
  }
  if (
    norm.includes('modern') ||
    norm.includes('research') ||
    norm.includes('stat') ||
    norm.includes('methodology') ||
    norm.includes('padartha') ||
    norm.includes('rachana') ||
    norm.includes('kriya') ||
    norm.includes('shalya') ||
    norm.includes('shalakya') ||
    norm.includes('prasuti') ||
    norm.includes('kaumar') ||
    norm.includes('agada') ||
    norm.includes('swastha')
  ) {
    const b = blueprint.find(
      (x) =>
        x.subject.toLowerCase().includes('modern') ||
        x.subject.toLowerCase().includes('research') ||
        x.subject.toLowerCase().includes('other')
    );
    if (b) return b.subject;
  }

  // 3. Fallback to first item in blueprint
  return blueprint[0]?.subject || 'Charaka Samhita';
}

// Initial pre-seeded users for immediate admin testing
const SEED_USERS: UserRecord[] = [
  {
    id: 'user_admin_001',
    email: 'admin@bams.com',
    phone: '7798660051',
    role: 'admin',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date().toISOString(),
    quizCount: 0,
    quizzes: [],
  },
  {
    id: 'user_student_001',
    email: 'sharma.ayur@bams.com',
    phone: '9820012345',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    quizCount: 0,
    quizzes: [],
  },
  {
    id: 'user_student_002',
    email: 'priya.bams@bams.com',
    phone: '9830067890',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    quizCount: 0,
    quizzes: [],
  },
  {
    id: 'user_student_003',
    email: 'rahul.vaidya@bams.com',
    phone: '9840054321',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastActive: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    quizCount: 0,
    quizzes: [],
  },
];

// In-memory passwords for local cloud engine
const PASSWORDS_KEY = 'bams_cloud_passwords_v1';
const DEFAULT_PASSWORDS: Record<string, string> = {
  'admin@bams.com': 'iamthebest@999',
  '7798660051': 'iamthebest@999',
  'sharma.ayur@bams.com': 'student123',
  '9820012345': 'student123',
  'priya.bams@bams.com': 'student123',
  '9830067890': 'student123',
  'rahul.vaidya@bams.com': 'student123',
  '9840054321': 'student123',
};

/**
 * Checks whether a user possesses Administrator privileges
 * (matching admin role, admin email, or designated mobile number 7798660051).
 */
export function isUserAdmin(user: UserRecord | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.email.toLowerCase() === 'admin@bams.com') return true;
  if (user.phone && user.phone.replace(/[^0-9]/g, '').slice(-10) === '7798660051') return true;
  return false;
}

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
  private editedQuestions: Record<string, Question> = {};
  private deletedQuestionIds: Set<string> = new Set();
  private mockBlueprint: MockBlueprintItem[] = [];
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

      // Ensure Admin user and password are consistently kept up-to-date
      let admin = this.users.find(
        (u) =>
          u.role === 'admin' ||
          u.email.toLowerCase() === 'admin@bams.com' ||
          (u.phone && u.phone.replace(/[^0-9]/g, '').slice(-10) === '7798660051')
      );
      if (admin) {
        admin.phone = '7798660051';
        admin.role = 'admin';
      } else {
        admin = {
          id: 'user_admin_001',
          email: 'admin@bams.com',
          phone: '7798660051',
          role: 'admin',
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          quizCount: 2,
          quizzes: [],
        };
        this.users.unshift(admin);
      }
      this.passwords['admin@bams.com'] = 'iamthebest@999';
      this.passwords['7798660051'] = 'iamthebest@999';
      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
      await AsyncStorage.setItem(PASSWORDS_KEY, JSON.stringify(this.passwords));

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
      const QUESTIONS_PURGED_FLAG = 'bams_questions_bank_purged_v2';
      const isAlreadyPurged = await AsyncStorage.getItem(QUESTIONS_PURGED_FLAG);
      if (!isAlreadyPurged) {
        await AsyncStorage.removeItem('bams_custom_questions_v1').catch(() => {});
        await AsyncStorage.removeItem('bams_edited_questions_v1').catch(() => {});
        await AsyncStorage.removeItem('bams_deleted_questions_v1').catch(() => {});
        await AsyncStorage.removeItem('bams_cloud_questions_v1').catch(() => {});
        await AsyncStorage.removeItem(QUESTIONS_STORAGE_KEY).catch(() => {});
        await AsyncStorage.removeItem('bams_bookmarks').catch(() => {});
        await AsyncStorage.removeItem('bams_sets').catch(() => {});
        await AsyncStorage.removeItem('bams_draft').catch(() => {});
        this.users.forEach((u) => {
          u.quizzes = [];
          u.quizCount = 0;
        });
        await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users)).catch(() => {});
        await AsyncStorage.setItem(QUESTIONS_PURGED_FLAG, 'true').catch(() => {});
      }

      const customStored = await AsyncStorage.getItem('bams_custom_questions_v1');
      const editedStored = await AsyncStorage.getItem('bams_edited_questions_v1');
      const deletedStored = await AsyncStorage.getItem('bams_deleted_questions_v1');

      let customQuestions: Question[] = [];
      if (customStored) {
        try {
          customQuestions = JSON.parse(customStored);
        } catch {}
      }

      if (editedStored) {
        try {
          this.editedQuestions = JSON.parse(editedStored);
        } catch {}
      }

      if (deletedStored) {
        try {
          this.deletedQuestionIds = new Set(JSON.parse(deletedStored));
        } catch {}
      }

      // Remove legacy bulky key if present
      await AsyncStorage.removeItem(QUESTIONS_STORAGE_KEY).catch(() => {});

      // Apply overrides and deletions
      const baseQuestions = INITIAL_SEED_QUESTIONS
        .filter((q) => !this.deletedQuestionIds.has(String(q.id)))
        .map((q) => {
          const edited = this.editedQuestions[String(q.id)];
          const target = edited ? edited : q;
          return {
            ...target,
            is_chapter_verified: target.is_chapter_verified ?? target.isChapterVerified ?? true,
            isChapterVerified: target.is_chapter_verified ?? target.isChapterVerified ?? true,
          };
        });

      const activeCustom = customQuestions
        .filter((q) => !this.deletedQuestionIds.has(String(q.id)))
        .map((q) => {
          const edited = this.editedQuestions[String(q.id)];
          const target = edited ? edited : q;
          return {
            ...target,
            is_chapter_verified: Boolean(target.is_chapter_verified ?? target.isChapterVerified),
            isChapterVerified: Boolean(target.is_chapter_verified ?? target.isChapterVerified),
          };
        });

      this.questions = [...activeCustom, ...baseQuestions];

      // 5. Mock Blueprint
      const storedBlueprint = await AsyncStorage.getItem(MOCK_BLUEPRINT_STORAGE_KEY);
      if (storedBlueprint) {
        try {
          this.mockBlueprint = JSON.parse(storedBlueprint);
        } catch {
          this.mockBlueprint = [...DEFAULT_MOCK_BLUEPRINT];
        }
      } else {
        this.mockBlueprint = [...DEFAULT_MOCK_BLUEPRINT];
        await AsyncStorage.setItem(MOCK_BLUEPRINT_STORAGE_KEY, JSON.stringify(this.mockBlueprint));
      }
    } catch (e) {
      console.warn('Backend initialization error:', e);
      this.users = [...SEED_USERS];
      this.passwords = { ...DEFAULT_PASSWORDS };
      this.questions = [...INITIAL_SEED_QUESTIONS];
      this.mockBlueprint = [...DEFAULT_MOCK_BLUEPRINT];
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
    if (normalizedEmail === 'admin@bams.com') {
      throw new Error('This email is reserved for System Administration. Please Log In directly.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : undefined;
    if (cleanPhone && cleanPhone.length < 10) {
      throw new Error('Please enter a valid 10-digit mobile number.');
    }
    if (cleanPhone && cleanPhone.slice(-10) === '7798660051') {
      throw new Error('This mobile number is reserved for System Administration. Please Log In directly.');
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

    const isAdminLogin =
      digitsOnly === '7798660051' ||
      digitsOnly.slice(-10) === '7798660051' ||
      normalized === 'admin@bams.com';

    if (isAdminLogin) {
      if (password !== 'iamthebest@999') {
        throw new Error('Incorrect Admin password. Please try again.');
      }
      let admin = this.users.find(
        (u) =>
          u.role === 'admin' ||
          u.email.toLowerCase() === 'admin@bams.com' ||
          (u.phone && u.phone.replace(/[^0-9]/g, '').slice(-10) === '7798660051')
      );
      if (!admin) {
        admin = {
          id: 'user_admin_001',
          email: 'admin@bams.com',
          phone: '7798660051',
          role: 'admin',
          createdAt: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          quizCount: 2,
          quizzes: [],
        };
        this.users.unshift(admin);
      }
      admin.role = 'admin';
      admin.phone = '7798660051';
      admin.lastActive = new Date().toISOString();
      this.currentUser = admin;

      await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users));
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(admin));
      return admin;
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

  async getQuestionsByChapters(
    chapterIdsOrNames: (string | number)[],
    verifiedOnly = false
  ): Promise<Question[]> {
    await this.initialize();
    const allChapters = await this.getChapters();
    const set = new Set(chapterIdsOrNames.map((c) => c.toString().trim().toLowerCase()));

    const result: Question[] = [];
    const seen = new Set<string | number>();

    const checkCandidate = (q: Question): boolean => {
      if (!isValidQuestion(q)) return false;
      if (verifiedOnly && !isQuestionChapterVerified(q)) return false;
      return true;
    };

    // 1. Cloud-authored questions matching selected chapters
    this.questions.forEach((q) => {
      const chName = (q.chapterName || q.ch?.toString() || '').trim().toLowerCase();
      const chId = q.ch?.toString().trim().toLowerCase();
      if (set.has(chName) || set.has(chId)) {
        if (!seen.has(q.id) && checkCandidate(q)) {
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
          if (!seen.has(q.id) && checkCandidate(q)) {
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

  private async persistCustomQuestions(): Promise<void> {
    const custom = this.questions.filter((q) => !q.id.toString().startsWith('q_ca_'));
    await AsyncStorage.setItem('bams_custom_questions_v1', JSON.stringify(custom));
  }

  async addQuestion(questionData: Omit<Question, 'id'>): Promise<Question> {
    await this.initialize();

    const id = `q_custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isVerified = Boolean(questionData.is_chapter_verified ?? questionData.isChapterVerified);
    const newQuestion: Question = {
      id,
      ...questionData,
      ch: questionData.chapterName || questionData.ch,
      chapterName: questionData.chapterName || questionData.ch.toString(),
      is_chapter_verified: isVerified,
      isChapterVerified: isVerified,
      createdAt: new Date().toISOString(),
    };

    this.questions.unshift(newQuestion);
    await this.persistCustomQuestions();

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

      const id = `q_custom_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
      const isVerified = Boolean(qData.is_chapter_verified ?? qData.isChapterVerified);
      addedQuestions.push({
        id,
        ...qData,
        ch: qData.chapterName,
        chapterName: qData.chapterName,
        is_chapter_verified: isVerified,
        isChapterVerified: isVerified,
        createdAt: new Date().toISOString(),
      });
    });

    if (addedQuestions.length > 0) {
      this.questions = [...addedQuestions, ...this.questions];
      await this.persistCustomQuestions();
    }

    return { added: addedQuestions.length, errors };
  }

  /**
   * Imports or synchronizes questions from Google Sheets with full duplicate detection.
   * Mode 'skip': Only inserts new questions; duplicates are skipped.
   * Mode 'overwrite': Overwrites/updates matching existing questions and inserts new questions.
   */
  async syncGoogleSheetQuestions(
    incomingQuestions: Omit<Question, 'id'>[],
    duplicateAction: 'skip' | 'overwrite' = 'skip'
  ): Promise<{
    addedCount: number;
    updatedCount: number;
    skippedCount: number;
    totalIncoming: number;
    affectedIds: string[];
  }> {
    await this.initialize();

    // Map existing questions by normalized stem
    const existingStemMap = new Map<string, Question>();
    this.questions.forEach((q) => {
      const key = normalizeQuestionStem(q.stem);
      if (key && !existingStemMap.has(key)) {
        existingStemMap.set(key, q);
      }
    });

    const toInsert: Question[] = [];
    let updatedCount = 0;
    let skippedCount = 0;
    const affectedIds: string[] = [];
    const now = new Date().toISOString();

    incomingQuestions.forEach((qData, idx) => {
      if (!qData.stem || !qData.o || qData.o.length < 2) return;

      const key = normalizeQuestionStem(qData.stem);
      const existing = key ? existingStemMap.get(key) : undefined;

      if (existing) {
        if (duplicateAction === 'skip') {
          skippedCount++;
        } else {
          // Overwrite existing question with updated sheet data
          const strId = String(existing.id);
          const isVerified =
            qData.is_chapter_verified !== undefined
              ? qData.is_chapter_verified
              : qData.isChapterVerified !== undefined
              ? qData.isChapterVerified
              : existing.is_chapter_verified;
          const updated: Question = {
            ...existing,
            ...qData,
            id: existing.id,
            ch: qData.chapterName || existing.chapterName || existing.ch,
            chapterName: qData.chapterName || existing.chapterName,
            is_chapter_verified: isVerified,
            isChapterVerified: isVerified,
          };

          const qIdx = this.questions.findIndex((q) => String(q.id) === strId);
          if (qIdx !== -1) {
            this.questions[qIdx] = updated;
          }
          this.editedQuestions[strId] = updated;
          affectedIds.push(strId);
          updatedCount++;
        }
      } else {
        // Brand new question to insert
        const newId = `q_custom_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
        const isVerified = Boolean(qData.is_chapter_verified ?? qData.isChapterVerified);
        const newQ: Question = {
          id: newId,
          ...qData,
          ch: qData.chapterName || 'Uncategorized / Needs Review > General > Chapter 1',
          chapterName: qData.chapterName || 'Uncategorized / Needs Review > General > Chapter 1',
          is_chapter_verified: isVerified,
          isChapterVerified: isVerified,
          createdAt: now,
        };
        toInsert.push(newQ);
        affectedIds.push(newId);

        if (key) {
          existingStemMap.set(key, newQ);
        }
      }
    });

    if (toInsert.length > 0) {
      this.questions = [...toInsert, ...this.questions];
    }

    if (toInsert.length > 0 || updatedCount > 0) {
      await AsyncStorage.setItem('bams_edited_questions_v1', JSON.stringify(this.editedQuestions));
      await this.persistCustomQuestions();
    }

    return {
      addedCount: toInsert.length,
      updatedCount,
      skippedCount,
      totalIncoming: incomingQuestions.length,
      affectedIds,
    };
  }

  async deleteQuestion(id: string | number): Promise<void> {
    await this.initialize();
    const strId = String(id);
    this.deletedQuestionIds.add(strId);
    this.questions = this.questions.filter((q) => String(q.id) !== strId);
    delete this.editedQuestions[strId];

    await AsyncStorage.setItem('bams_deleted_questions_v1', JSON.stringify(Array.from(this.deletedQuestionIds)));
    await AsyncStorage.setItem('bams_edited_questions_v1', JSON.stringify(this.editedQuestions));
    await this.persistCustomQuestions();
  }

  async deleteQuestions(ids: (string | number)[]): Promise<number> {
    await this.initialize();
    const idSet = new Set(ids.map((id) => String(id)));
    if (idSet.size === 0) return 0;

    let deletedCount = 0;
    this.questions = this.questions.filter((q) => {
      const sId = String(q.id);
      if (idSet.has(sId)) {
        deletedCount++;
        this.deletedQuestionIds.add(sId);
        delete this.editedQuestions[sId];
        return false;
      }
      return true;
    });

    await AsyncStorage.setItem('bams_deleted_questions_v1', JSON.stringify(Array.from(this.deletedQuestionIds)));
    await AsyncStorage.setItem('bams_edited_questions_v1', JSON.stringify(this.editedQuestions));
    await this.persistCustomQuestions();

    return deletedCount;
  }

  /**
   * Completely purges all question records from database, resets custom storage,
   * and clears associated test attempts / quizzes from all users.
   */
  async clearAllQuestions(): Promise<void> {
    await this.initialize();
    this.questions = [];
    this.editedQuestions = {};
    this.deletedQuestionIds = new Set();
    await AsyncStorage.removeItem('bams_custom_questions_v1').catch(() => {});
    await AsyncStorage.removeItem('bams_edited_questions_v1').catch(() => {});
    await AsyncStorage.removeItem('bams_deleted_questions_v1').catch(() => {});
    await AsyncStorage.removeItem('bams_cloud_questions_v1').catch(() => {});
    await AsyncStorage.removeItem(QUESTIONS_STORAGE_KEY).catch(() => {});
    await AsyncStorage.removeItem('bams_bookmarks').catch(() => {});
    await AsyncStorage.removeItem('bams_sets').catch(() => {});
    await AsyncStorage.removeItem('bams_draft').catch(() => {});
    this.users.forEach((u) => {
      u.quizzes = [];
      u.quizCount = 0;
    });
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(this.users)).catch(() => {});
  }

  async updateQuestion(id: string | number, patch: Partial<Question>): Promise<Question> {
    await this.initialize();
    const strId = String(id);
    const index = this.questions.findIndex((q) => String(q.id) === strId);
    if (index === -1) {
      throw new Error(`Question with id ${id} not found.`);
    }

    const existing = this.questions[index];
    const isVerified =
      patch.is_chapter_verified !== undefined
        ? patch.is_chapter_verified
        : patch.isChapterVerified !== undefined
        ? patch.isChapterVerified
        : existing.is_chapter_verified;

    const updated: Question = {
      ...existing,
      ...patch,
      ch: patch.chapterName || existing.chapterName || existing.ch,
      chapterName: patch.chapterName || existing.chapterName,
      is_chapter_verified: isVerified,
      isChapterVerified: isVerified,
    };

    this.questions[index] = updated;
    this.editedQuestions[strId] = updated;

    await AsyncStorage.setItem('bams_edited_questions_v1', JSON.stringify(this.editedQuestions));
    await this.persistCustomQuestions();

    return updated;
  }

  async updateQuestionsBatch(
    updates: { id: string | number; patch: Partial<Question> }[]
  ): Promise<number> {
    await this.initialize();
    let updatedCount = 0;

    for (const item of updates) {
      const strId = String(item.id);
      const index = this.questions.findIndex((q) => String(q.id) === strId);
      if (index !== -1) {
        const existing = this.questions[index];
        const isVerified =
          item.patch.is_chapter_verified !== undefined
            ? item.patch.is_chapter_verified
            : item.patch.isChapterVerified !== undefined
            ? item.patch.isChapterVerified
            : existing.is_chapter_verified;

        const updated: Question = {
          ...existing,
          ...item.patch,
          ch: item.patch.chapterName || existing.chapterName || existing.ch,
          chapterName: item.patch.chapterName || existing.chapterName,
          is_chapter_verified: isVerified,
          isChapterVerified: isVerified,
        };
        this.questions[index] = updated;
        this.editedQuestions[strId] = updated;
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      await AsyncStorage.setItem('bams_edited_questions_v1', JSON.stringify(this.editedQuestions));
      await this.persistCustomQuestions();
    }

    return updatedCount;
  }

  async getEditedQuestionIds(): Promise<string[]> {
    await this.initialize();
    return Object.keys(this.editedQuestions);
  }

  // ==========================================
  // FULL-SYLLABUS AIAPGET MOCK TEST ENGINE
  // ==========================================

  async getMockBlueprint(): Promise<MockBlueprintItem[]> {
    await this.initialize();
    return [...this.mockBlueprint];
  }

  async saveMockBlueprint(blueprint: MockBlueprintItem[]): Promise<MockBlueprintItem[]> {
    await this.initialize();
    this.mockBlueprint = [...blueprint];
    await AsyncStorage.setItem(MOCK_BLUEPRINT_STORAGE_KEY, JSON.stringify(blueprint));
    return [...this.mockBlueprint];
  }

  /**
   * Generates a 120-question Mock Exam strictly adhering to the blueprint weightage.
   * If a subject doesn't have enough questions, it backfills from the overall valid pool
   * to guarantee exactly 120 questions.
   */
  async generateMockTestQuestions(customBlueprint?: MockBlueprintItem[]): Promise<Question[]> {
    await this.initialize();
    const activeBlueprint = customBlueprint && customBlueprint.length > 0 ? customBlueprint : this.mockBlueprint;

    // Filter all valid questions
    const allValid = this.questions.filter((q) => isValidQuestion(q));

    // Group valid questions into blueprint subject buckets
    const subjectBuckets: Record<string, Question[]> = {};
    activeBlueprint.forEach((item) => {
      subjectBuckets[item.subject] = [];
    });

    allValid.forEach((q) => {
      const matched = matchQuestionToBlueprintSubject(q.chapterName || '', activeBlueprint);
      if (subjectBuckets[matched]) {
        subjectBuckets[matched].push(q);
      }
    });

    const selectedQuestions: Question[] = [];
    const usedIds = new Set<string | number>();

    // Step 1: Draw weightage_questions from each bucket
    activeBlueprint.forEach((item) => {
      const bucket = subjectBuckets[item.subject] || [];
      // Shuffle bucket candidates
      const shuffled = [...bucket].sort(() => Math.random() - 0.5);
      const needed = item.weightage_questions || 0;
      let addedForSubject = 0;

      for (const q of shuffled) {
        if (addedForSubject >= needed) break;
        if (!usedIds.has(q.id)) {
          usedIds.add(q.id);
          selectedQuestions.push(q);
          addedForSubject++;
        }
      }
    });

    // Step 2: Ensure target questions total (120 questions)
    const targetTotal = activeBlueprint.reduce((acc, curr) => acc + (curr.weightage_questions || 0), 0) || 120;

    if (selectedQuestions.length < targetTotal) {
      const remainingCandidates = allValid
        .filter((q) => !usedIds.has(q.id))
        .sort(() => Math.random() - 0.5);

      for (const q of remainingCandidates) {
        if (selectedQuestions.length >= targetTotal) break;
        usedIds.add(q.id);
        selectedQuestions.push(q);
      }
    }

    // Step 3: Shuffle the entire set of 120 questions so they appear randomized across subjects
    return selectedQuestions.sort(() => Math.random() - 0.5);
  }
}

export const backend = new BackendService();
