import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  ActiveView,
  Chapter,
  Difficulty,
  Language,
  MockBlueprintItem,
  PracticeConfig,
  Question,
  QuizMode,
  QuizResults,
  QuizSession,
  SavedPracticeSet,
  StudentPracticeMode,
  SubjectAccuracyStat,
  UserRecord,
} from '../types';
import { shuffle } from '../utils/allocator';
import { isQuestionChapterVerified, isValidQuestion } from '../utils/chapterMapper';
import {
  loadDraft,
  loadLanguage,
  loadSavedSets,
  loadBookmarks,
  saveDraft,
  saveLanguage,
  savePracticeSets,
  saveBookmarks,
} from '../utils/storage';
import {
  backend,
  isUserAdmin,
  DEFAULT_MOCK_BLUEPRINT,
  matchQuestionToBlueprintSubject,
} from '../services/backend';

export interface AppContextType {
  currentUser: UserRecord | null;
  logIn: (emailOrPhone: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, phone?: string) => Promise<void>;
  logOut: () => Promise<void>;
  navigateToAdmin: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  practiceMode: StudentPracticeMode;
  setPracticeMode: (mode: StudentPracticeMode) => void;
  view: ActiveView;
  setView: (view: ActiveView) => void;
  // Dynamic chapters & questions from cloud database
  chapters: Chapter[];
  allQuestions: Record<string | number, Question>;
  refreshQuestions: () => Promise<void>;
  selectedChapters: (string | number)[];
  toggleChapter: (id: string | number) => void;
  toggleGroup: (ids: (string | number)[], selectAll?: boolean) => void;
  clearSelection: () => void;
  config: PracticeConfig;
  updateConfig: (patch: Partial<PracticeConfig>) => void;
  setManualCount: (chapterId: string | number, count: number) => void;
  toggleDifficulty: (diff: Difficulty) => void;
  savedSets: SavedPracticeSet[];
  saveCurrentSet: (name: string) => Promise<void>;
  loadSet: (set: SavedPracticeSet) => void;
  deleteSet: (setId: string) => Promise<void>;
  session: QuizSession | null;
  startQuiz: (customIds?: (string | number)[], forcedMode?: QuizMode) => Promise<void> | void;
  // Full-Syllabus AIAPGET Mock Test Engine
  mockBlueprint: MockBlueprintItem[];
  updateMockBlueprint: (newBlueprint: MockBlueprintItem[]) => Promise<void>;
  startMockTest: () => Promise<void>;
  answerQuestion: (optionIndex: number) => void;
  unattemptQuestion: () => void;
  submitQuestion: () => void;
  toggleMarkReview: () => void;
  jumpToQuestion: (index: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  finishQuiz: () => void;
  results: QuizResults | null;
  reattemptIncorrect: () => void;
  backToBuilder: () => void;
  statusMessage: string;
  setStatusMessage: (msg: string) => void;
  // Persistent revision bookmarks
  bookmarkedIds: (string | number)[];
  toggleBookmark: (questionId: string | number) => void;
  isBookmarked: (questionId: string | number) => boolean;
  clearAllBookmarks: () => Promise<void>;
  clearChapterBookmarks: (chapterId: string | number) => Promise<void>;
}

const DEFAULT_CONFIG: PracticeConfig = {
  total: 50,
  dist: 'pooled',
  diffs: [0, 1, 2],
  mode: 'learning',
  manual: {},
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [language, setLangState] = useState<Language>('en');
  const [practiceMode, setPracticeMode] = useState<StudentPracticeMode>('chapter_verified');
  const [view, setView] = useState<ActiveView>('auth');
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [allQuestions, setAllQuestions] = useState<Record<string | number, Question>>({});
  const [selectedChapters, setSelectedChapters] = useState<(string | number)[]>([]);
  const [config, setConfig] = useState<PracticeConfig>(DEFAULT_CONFIG);
  const [savedSets, setSavedSets] = useState<SavedPracticeSet[]>([]);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [bookmarkedIds, setBookmarkedIds] = useState<(string | number)[]>([]);
  const [mockBlueprint, setMockBlueprint] = useState<MockBlueprintItem[]>(DEFAULT_MOCK_BLUEPRINT);

  // Function to refresh questions and dynamic chapter syllabus from backend
  const refreshQuestions = async () => {
    try {
      const qList = await backend.getQuestions();
      const qMap: Record<string | number, Question> = {};
      qList.forEach((q) => {
        qMap[q.id] = q;
      });
      setAllQuestions(qMap);

      const chList = await backend.getChapters();
      setChapters(chList);
    } catch (e) {
      console.warn('Error refreshing cloud questions:', e);
    }
  };

  // Initial load from storage & backend authentication & cloud questions
  useEffect(() => {
    (async () => {
      const storedLang = await loadLanguage('en');
      setLangState(storedLang);

      // Check existing auth session
      const user = await backend.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setView('build');
      } else {
        setView('auth');
      }

      // Load dynamic cloud questions & chapters
      await refreshQuestions();

      const storedDraft = await loadDraft();
      if (storedDraft) {
        if (storedDraft.sel && Array.isArray(storedDraft.sel)) {
          setSelectedChapters(storedDraft.sel);
        }
        if (storedDraft.cfg) {
          setConfig((prev) => ({ ...prev, ...storedDraft.cfg }));
        }
      }

      const storedSets = await loadSavedSets();
      setSavedSets(storedSets);

      const storedBookmarks = await loadBookmarks();
      setBookmarkedIds(storedBookmarks);

      // Load mock test blueprint
      try {
        const bp = await backend.getMockBlueprint();
        if (bp && bp.length > 0) {
          setMockBlueprint(bp);
        }
      } catch (err) {
        console.warn('Error loading mock blueprint:', err);
      }
    })();
  }, []);

  const logIn = async (emailOrPhone: string, pass: string) => {
    const user = await backend.logIn(emailOrPhone, pass);
    setCurrentUser(user);
    setView('build');
  };

  const signUp = async (email: string, pass: string, phone?: string) => {
    const user = await backend.signUp(email, pass, phone);
    setCurrentUser(user);
    setView('build');
  };

  const logOut = async () => {
    await backend.logOut();
    setCurrentUser(null);
    setView('auth');
  };

  const navigateToAdmin = () => {
    if (isUserAdmin(currentUser)) {
      setView('admin');
    }
  };

  // Save draft whenever selection or config changes
  useEffect(() => {
    saveDraft({ sel: selectedChapters, cfg: config });
  }, [selectedChapters, config]);

  const setLanguage = (lang: Language) => {
    setLangState(lang);
    saveLanguage(lang);
  };

  const toggleChapter = (id: string | number) => {
    setSelectedChapters((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleGroup = (ids: (string | number)[], selectAll?: boolean) => {
    setSelectedChapters((prev) => {
      const allSelected = ids.every((id) => prev.includes(id));
      const shouldSelect = selectAll !== undefined ? selectAll : !allSelected;

      if (shouldSelect) {
        const newSet = new Set([...prev, ...ids]);
        return Array.from(newSet);
      } else {
        return prev.filter((id) => !ids.includes(id));
      }
    });
  };

  const clearSelection = () => {
    setSelectedChapters([]);
  };

  const updateConfig = (patch: Partial<PracticeConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  };

  const setManualCount = (chapterId: string | number, count: number) => {
    setConfig((prev) => ({
      ...prev,
      manual: {
        ...prev.manual,
        [chapterId]: Math.max(0, count),
      },
    }));
  };

  const toggleDifficulty = (diff: Difficulty) => {
    setConfig((prev) => {
      const current = prev.diffs;
      if (current.includes(diff)) {
        if (current.length === 1) return prev; // Keep at least one
        return { ...prev, diffs: current.filter((d) => d !== diff) };
      } else {
        return { ...prev, diffs: [...current, diff].sort() };
      }
    });
  };

  const saveCurrentSet = async (name: string) => {
    const newSet: SavedPracticeSet = {
      id: Date.now().toString(),
      name: name.slice(0, 60),
      sel: [...selectedChapters],
      cfg: JSON.parse(JSON.stringify(config)),
      createdAt: Date.now(),
    };
    const updated = [...savedSets, newSet];
    setSavedSets(updated);
    await savePracticeSets(updated);
    setStatusMessage(`Saved preset "${newSet.name}".`);
  };

  const loadSet = (set: SavedPracticeSet) => {
    setSelectedChapters(set.sel);
    setConfig({
      ...set.cfg,
      manual: set.cfg.manual || {},
    });
    setStatusMessage(`Loaded "${set.name}".`);
  };

  const deleteSet = async (setId: string) => {
    const updated = savedSets.filter((s) => s.id !== setId);
    setSavedSets(updated);
    await savePracticeSets(updated);
  };

  // Dynamic Quiz Generation from Cloud Database
  const startQuiz = async (customIds?: (string | number)[], forcedMode?: QuizMode) => {
    let targetQuestions: Question[] = [];
    const verifiedOnly = practiceMode === 'chapter_verified';

    if (customIds && customIds.length > 0) {
      targetQuestions = customIds
        .map((id) => allQuestions[id])
        .filter(
          (q): q is Question =>
            q !== undefined &&
            isValidQuestion(q) &&
            (!verifiedOnly || isQuestionChapterVerified(q))
        );
    } else {
      if (selectedChapters.length === 0) return;

      // Query database dynamically for questions matching selected chapters
      // In chapter_verified mode, strictly fetch verified + valid questions only
      const matchingQuestions = await backend.getQuestionsByChapters(selectedChapters, verifiedOnly);

      // Filter by selected difficulties
      let filtered = matchingQuestions.filter((q) => config.diffs.includes(q.d));
      if (filtered.length === 0) {
        filtered = matchingQuestions;
      }

      // Shuffle pool
      const pool = shuffle([...filtered]);
      const count = Math.min(config.total, pool.length);
      targetQuestions = pool.slice(0, count);
    }

    if (targetQuestions.length === 0) {
      setStatusMessage(
        verifiedOnly
          ? 'No verified questions available for the selected chapter(s) yet. (Labeled "Coming Soon")'
          : 'No valid questions available for the selected chapters.'
      );
      return;
    }

    setSession({
      qs: targetQuestions,
      i: 0,
      ans: {},
      sub: {},
      rev: {},
      mode: forcedMode || config.mode,
      t0: Date.now(),
      chs: [...selectedChapters],
    });
    setView('quiz');
    setStatusMessage('');
  };

  const updateMockBlueprint = async (newBlueprint: MockBlueprintItem[]) => {
    try {
      const saved = await backend.saveMockBlueprint(newBlueprint);
      setMockBlueprint(saved);
      setStatusMessage('Mock blueprint saved successfully.');
    } catch (e) {
      console.warn('Failed to save mock blueprint:', e);
      setStatusMessage('Failed to save blueprint.');
    }
  };

  const startMockTest = async () => {
    try {
      const mockQs = await backend.generateMockTestQuestions(mockBlueprint);
      if (mockQs.length === 0) {
        setStatusMessage('No valid questions found to generate mock test.');
        return;
      }

      setSession({
        qs: mockQs,
        i: 0,
        ans: {},
        sub: {},
        rev: {},
        mode: 'test', // Full competitive test mode (+4/-1)
        t0: Date.now(),
        chs: [],
        isMockTest: true,
        durationSecs: 120 * 60, // 120 minutes (7200 seconds)
      });
      setView('quiz');
      setStatusMessage('');
    } catch (e) {
      console.warn('Failed to start mock test:', e);
      setStatusMessage('Error generating mock test. Please try again.');
    }
  };

  const answerQuestion = (optionIndex: number) => {
    if (!session) return;
    const currentQ = session.qs[session.i];
    if (!currentQ) return;
    if (session.mode === 'learning' && session.sub[currentQ.id]) return; // Locked

    setSession((prev) => {
      if (!prev) return null;
      const isSame = prev.ans[currentQ.id] === optionIndex;
      const newAns = { ...prev.ans };
      if (isSame) {
        delete newAns[currentQ.id];
      } else {
        newAns[currentQ.id] = optionIndex;
      }
      return {
        ...prev,
        ans: newAns,
      };
    });
  };

  const unattemptQuestion = () => {
    if (!session) return;
    const currentQ = session.qs[session.i];
    if (!currentQ) return;
    if (session.mode === 'learning' && session.sub[currentQ.id]) return; // Locked

    setSession((prev) => {
      if (!prev) return null;
      const newAns = { ...prev.ans };
      delete newAns[currentQ.id];
      return {
        ...prev,
        ans: newAns,
      };
    });
  };

  const submitQuestion = () => {
    if (!session) return;
    const currentQ = session.qs[session.i];
    if (!currentQ) return;

    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        sub: {
          ...prev.sub,
          [currentQ.id]: true,
        },
      };
    });
  };

  const toggleMarkReview = () => {
    if (!session) return;
    const currentQ = session.qs[session.i];
    if (!currentQ) return;

    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        rev: {
          ...prev.rev,
          [currentQ.id]: !prev.rev[currentQ.id],
        },
      };
    });
  };

  const jumpToQuestion = (index: number) => {
    if (!session) return;
    if (index >= 0 && index < session.qs.length) {
      setSession((prev) => (prev ? { ...prev, i: index } : null));
    }
  };

  const nextQuestion = () => {
    if (!session || session.i >= session.qs.length - 1) return;
    setSession((prev) => (prev ? { ...prev, i: prev.i + 1 } : null));
  };

  const prevQuestion = () => {
    if (!session || session.i <= 0) return;
    setSession((prev) => (prev ? { ...prev, i: prev.i - 1 } : null));
  };

  const finishQuiz = () => {
    if (!session) return;
    const tEnd = Date.now();
    setSession((prev) => (prev ? { ...prev, t1: tEnd } : null));
    setView('result');

    // Cloud Database Synchronization: sync final score and timestamp to user profile
    if (currentUser) {
      let correct = 0;
      let incorrect = 0;
      let unattempted = 0;
      session.qs.forEach((q) => {
        const chosen = session.ans[q.id];
        if (chosen === undefined) {
          unattempted++;
        } else if (chosen === q.c) {
          correct++;
        } else {
          incorrect++;
        }
      });

      const score = correct * 4 - incorrect * 1;
      const maxScore = session.qs.length * 4;
      const scorePercent =
        maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

      backend
        .recordQuizAttempt(currentUser.id, {
          timestamp: new Date(tEnd).toISOString(),
          score,
          maxScore,
          scorePercent,
          correct,
          incorrect,
          unattempted,
          mode: session.mode,
          chapterCount: session.chs.length || 1,
        })
        .then(() => backend.getCurrentUser())
        .then((updatedUser) => {
          if (updatedUser) {
            setCurrentUser(updatedUser);
          }
        })
        .catch((err) => console.warn('Cloud score sync error:', err));
    }
  };

  const results: QuizResults | null = useMemo(() => {
    if (!session) return null;
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    const byChapter: Record<
      string | number,
      { chapterId: string | number; chapterName?: string; total: number; correct: number; accuracy: number }
    > = {};
    const wrongQuestions: Question[] = [];

    session.qs.forEach((q) => {
      const chosen = session.ans[q.id];
      const chKey = q.chapterName || q.ch;
      if (!byChapter[chKey]) {
        byChapter[chKey] = {
          chapterId: chKey,
          chapterName: q.chapterName,
          total: 0,
          correct: 0,
          accuracy: 0,
        };
      }
      byChapter[chKey].total++;

      if (chosen === undefined) {
        unattempted++;
      } else if (chosen === q.c) {
        correct++;
        byChapter[chKey].correct++;
      } else {
        incorrect++;
        wrongQuestions.push(q);
      }
    });

    Object.keys(byChapter).forEach((key) => {
      const stat = byChapter[key];
      stat.accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    });

    // Subject-level performance analysis for Mock Tests and Revision Focus
    const bySubject: Record<string, SubjectAccuracyStat> = {};
    const blueprintItems = mockBlueprint.length > 0 ? mockBlueprint : DEFAULT_MOCK_BLUEPRINT;

    blueprintItems.forEach((b) => {
      bySubject[b.subject] = {
        subject: b.subject,
        total: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        accuracy: 0,
        is_high_yield: b.is_high_yield,
      };
    });

    session.qs.forEach((q) => {
      const subj = matchQuestionToBlueprintSubject(q.chapterName || '', blueprintItems);
      if (!bySubject[subj]) {
        const bpMatch = blueprintItems.find((b) => b.subject.toLowerCase() === subj.toLowerCase());
        bySubject[subj] = {
          subject: subj,
          total: 0,
          attempted: 0,
          correct: 0,
          incorrect: 0,
          unattempted: 0,
          accuracy: 0,
          is_high_yield: bpMatch ? bpMatch.is_high_yield : false,
        };
      }

      bySubject[subj].total++;
      const chosen = session.ans[q.id];
      if (chosen === undefined) {
        bySubject[subj].unattempted++;
      } else {
        bySubject[subj].attempted++;
        if (chosen === q.c) {
          bySubject[subj].correct++;
        } else {
          bySubject[subj].incorrect++;
        }
      }
    });

    Object.keys(bySubject).forEach((key) => {
      const stat = bySubject[key];
      // Accuracy computed based on questions attempted (or total if none)
      stat.accuracy = stat.attempted > 0 ? Math.round((stat.correct / stat.attempted) * 100) : 0;
    });

    const attempted = correct + incorrect;
    const total = session.qs.length;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const timeSpentSecs = Math.round(((session.t1 || Date.now()) - session.t0) / 1000);

    // Competitive Exam Scoring: +4 for correct, -1 for incorrect, 0 for unattempted
    const score = correct * 4 - incorrect * 1;
    const maxScore = total * 4;
    const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return {
      total,
      attempted,
      correct,
      incorrect,
      unattempted,
      accuracy,
      timeSpentSecs,
      byChapter,
      bySubject,
      isMockTest: session.isMockTest,
      wrongQuestions,
      score,
      maxScore,
      scorePercent,
    };
  }, [session, view, mockBlueprint]);

  const reattemptIncorrect = () => {
    if (!results || results.wrongQuestions.length === 0) return;
    const wrongIds = shuffle(results.wrongQuestions.map((q) => q.id));
    startQuiz(wrongIds, session?.mode || 'learning');
  };

  const backToBuilder = () => {
    setView('build');
  };

  const toggleBookmark = (questionId: string | number) => {
    setBookmarkedIds((prev) => {
      const exists = prev.includes(questionId);
      const updated = exists
        ? prev.filter((id) => id !== questionId)
        : [...prev, questionId];
      saveBookmarks(updated);
      return updated;
    });
  };

  const isBookmarked = (questionId: string | number) => {
    return bookmarkedIds.includes(questionId);
  };

  const clearAllBookmarks = async () => {
    setBookmarkedIds([]);
    await saveBookmarks([]);
  };

  const clearChapterBookmarks = async (chapterId: string | number) => {
    setBookmarkedIds((prev) => {
      const updated = prev.filter((id) => {
        const q = allQuestions[id];
        return q ? (q.ch !== chapterId && q.chapterName !== chapterId) : true;
      });
      saveBookmarks(updated);
      return updated;
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        logIn,
        signUp,
        logOut,
        navigateToAdmin,
        language,
        setLanguage,
        practiceMode,
        setPracticeMode,
        view,
        setView,
        chapters,
        allQuestions,
        refreshQuestions,
        selectedChapters,
        toggleChapter,
        toggleGroup,
        clearSelection,
        config,
        updateConfig,
        setManualCount,
        toggleDifficulty,
        savedSets,
        saveCurrentSet,
        loadSet,
        deleteSet,
        session,
        startQuiz,
        mockBlueprint,
        updateMockBlueprint,
        startMockTest,
        answerQuestion,
        unattemptQuestion,
        submitQuestion,
        toggleMarkReview,
        jumpToQuestion,
        nextQuestion,
        prevQuestion,
        finishQuiz,
        results,
        reattemptIncorrect,
        backToBuilder,
        statusMessage,
        setStatusMessage,
        bookmarkedIds,
        toggleBookmark,
        isBookmarked,
        clearAllBookmarks,
        clearChapterBookmarks,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
