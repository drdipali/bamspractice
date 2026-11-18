import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  ActiveView,
  Chapter,
  Difficulty,
  Language,
  PracticeConfig,
  Question,
  QuizMode,
  QuizResults,
  QuizSession,
  SavedPracticeSet,
} from '../types';
import { ALL_CHAPTERS, ALL_QUESTIONS } from '../constants/syllabusData';
import { allocateQuestions, generateQuestionIds, shuffle } from '../utils/allocator';
import {
  loadDraft,
  loadLanguage,
  loadSavedSets,
  saveDraft,
  saveLanguage,
  savePracticeSets,
} from '../utils/storage';

interface AppContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  view: ActiveView;
  setView: (view: ActiveView) => void;
  selectedChapters: number[];
  toggleChapter: (id: number) => void;
  toggleGroup: (ids: number[], selectAll?: boolean) => void;
  clearSelection: () => void;
  config: PracticeConfig;
  updateConfig: (patch: Partial<PracticeConfig>) => void;
  setManualCount: (chapterId: number, count: number) => void;
  toggleDifficulty: (diff: Difficulty) => void;
  savedSets: SavedPracticeSet[];
  saveCurrentSet: (name: string) => Promise<void>;
  loadSet: (set: SavedPracticeSet) => void;
  deleteSet: (setId: string) => Promise<void>;
  session: QuizSession | null;
  startQuiz: (customIds?: number[], forcedMode?: QuizMode) => void;
  answerQuestion: (optionIndex: number) => void;
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
  const [language, setLangState] = useState<Language>('en');
  const [view, setView] = useState<ActiveView>('build');
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [config, setConfig] = useState<PracticeConfig>(DEFAULT_CONFIG);
  const [savedSets, setSavedSets] = useState<SavedPracticeSet[]>([]);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Initial load from storage
  useEffect(() => {
    (async () => {
      const storedLang = await loadLanguage('en');
      setLangState(storedLang);

      const storedDraft = await loadDraft();
      if (storedDraft) {
        setSelectedChapters(
          (storedDraft.sel || []).filter((id) => ALL_CHAPTERS[id] !== undefined)
        );
        if (storedDraft.cfg) {
          setConfig((prev) => ({ ...prev, ...storedDraft.cfg }));
        }
      }

      const storedSets = await loadSavedSets();
      setSavedSets(storedSets);
    })();
  }, []);

  // Save draft whenever selection or config changes
  useEffect(() => {
    saveDraft({ sel: selectedChapters, cfg: config });
  }, [selectedChapters, config]);

  const setLanguage = (lang: Language) => {
    setLangState(lang);
    saveLanguage(lang);
  };

  const toggleChapter = (id: number) => {
    setSelectedChapters((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleGroup = (ids: number[], selectAll?: boolean) => {
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

  const setManualCount = (chapterId: number, count: number) => {
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
    setSelectedChapters(set.sel.filter((id) => ALL_CHAPTERS[id] !== undefined));
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

  const startQuiz = (customIds?: number[], forcedMode?: QuizMode) => {
    let targetIds: number[] = [];

    if (customIds && customIds.length > 0) {
      targetIds = customIds;
    } else {
      const activeChs = selectedChapters.map((id) => ALL_CHAPTERS[id]);
      if (activeChs.length === 0) return;
      targetIds = generateQuestionIds(activeChs, config);
    }

    if (targetIds.length === 0) return;

    const questions = targetIds
      .map((id) => ALL_QUESTIONS[id])
      .filter((q): q is Question => q !== undefined);

    setSession({
      qs: questions,
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

  const answerQuestion = (optionIndex: number) => {
    if (!session) return;
    const currentQ = session.qs[session.i];
    if (!currentQ) return;
    if (session.mode === 'learning' && session.sub[currentQ.id]) return; // Locked

    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ans: {
          ...prev.ans,
          [currentQ.id]: optionIndex,
        },
      };
    });
  };

  const submitQuestion = () => {
    if (!session) return;
    const currentQ = session.qs[session.i];
    if (!currentQ || session.ans[currentQ.id] === undefined) return;

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
    setSession((prev) => (prev ? { ...prev, t1: Date.now() } : null));
    setView('result');
  };

  const results: QuizResults | null = useMemo(() => {
    if (!session) return null;
    let correct = 0;
    let incorrect = 0;
    let unattempted = 0;
    const byChapter: Record<number, { chapterId: number; total: number; correct: number; accuracy: number }> = {};
    const wrongQuestions: Question[] = [];

    session.qs.forEach((q) => {
      const chosen = session.ans[q.id];
      if (!byChapter[q.ch]) {
        byChapter[q.ch] = { chapterId: q.ch, total: 0, correct: 0, accuracy: 0 };
      }
      byChapter[q.ch].total++;

      if (chosen === undefined) {
        unattempted++;
      } else if (chosen === q.c) {
        correct++;
        byChapter[q.ch].correct++;
      } else {
        incorrect++;
        wrongQuestions.push(q);
      }
    });

    Object.keys(byChapter).forEach((key) => {
      const stat = byChapter[Number(key)];
      stat.accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    });

    const attempted = correct + incorrect;
    const total = session.qs.length;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    const timeSpentSecs = Math.round(((session.t1 || Date.now()) - session.t0) / 1000);

    return {
      total,
      attempted,
      correct,
      incorrect,
      unattempted,
      accuracy,
      timeSpentSecs,
      byChapter,
      wrongQuestions,
    };
  }, [session, view]);

  const reattemptIncorrect = () => {
    if (!results || results.wrongQuestions.length === 0) return;
    const wrongIds = shuffle(results.wrongQuestions.map((q) => q.id));
    startQuiz(wrongIds, session?.mode || 'learning');
  };

  const backToBuilder = () => {
    setView('build');
  };

  return (
    <AppContext.Provider
      value={{
        language,
        setLanguage,
        view,
        setView,
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
        answerQuestion,
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
