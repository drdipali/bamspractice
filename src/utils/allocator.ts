import { Chapter, Difficulty, PracticeConfig, Question } from '../types';

export function shuffle<T>(array: T[]): T[] {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

export function getEligibleQuestions(chapter: Chapter, diffs: Difficulty[]): Question[] {
  return chapter.qs.filter((q) => diffs.includes(q.d));
}

export interface AllocationResult {
  available: number[];
  allocated: number[] | null;
  totalEligible: number;
  finalCount: number;
}

export function allocateQuestions(
  selectedChapters: Chapter[],
  config: PracticeConfig
): AllocationResult {
  const available = selectedChapters.map(
    (c) => getEligibleQuestions(c, config.diffs).length
  );
  const totalEligible = available.reduce((acc, count) => acc + count, 0);
  const N = Math.min(config.total, totalEligible);
  const allocated = available.map(() => 0);
  const dist = config.dist;

  if (dist === 'manual') {
    selectedChapters.forEach((c, idx) => {
      const requested = config.manual[c.id] || 0;
      allocated[idx] = Math.min(requested, available[idx]);
    });
    const finalCount = allocated.reduce((acc, count) => acc + count, 0);
    return { available, allocated, totalEligible, finalCount };
  }

  if (dist === 'pooled') {
    return { available, allocated: null, totalEligible, finalCount: N };
  }

  let remaining = N;
  if (dist === 'proportional' && totalEligible > 0) {
    const remainders = available.map((av, idx) => {
      const exact = (av * N) / totalEligible;
      allocated[idx] = Math.min(Math.floor(exact), av);
      return exact - Math.floor(exact);
    });

    remaining = N - allocated.reduce((acc, c) => acc + c, 0);
    const sortedIndices = remainders
      .map((rem, idx) => ({ rem, idx }))
      .sort((a, b) => b.rem - a.rem)
      .map((item) => item.idx);

    for (const idx of sortedIndices) {
      if (remaining > 0 && allocated[idx] < available[idx]) {
        allocated[idx]++;
        remaining--;
      }
    }
  }

  // Equal distribution or remainder handling
  let changed = true;
  while (remaining > 0 && changed) {
    changed = false;
    const shuffledIdxs = shuffle(available.map((_, i) => i));
    for (const idx of shuffledIdxs) {
      if (remaining > 0 && allocated[idx] < available[idx]) {
        allocated[idx]++;
        remaining--;
        changed = true;
      }
    }
  }

  return { available, allocated, totalEligible, finalCount: N };
}

export function generateQuestionIds(
  selectedChapters: Chapter[],
  config: PracticeConfig
): (string | number)[] {
  const alloc = allocateQuestions(selectedChapters, config);
  let ids: (string | number)[] = [];
  const validChapterSet = new Set(selectedChapters.map((c) => c.id));

  if (config.dist === 'pooled') {
    const pool: (string | number)[] = [];
    selectedChapters.forEach((c) => {
      getEligibleQuestions(c, config.diffs).forEach((q) => pool.push(q.id));
    });
    ids = shuffle(pool).slice(0, alloc.finalCount);
  } else if (alloc.allocated) {
    selectedChapters.forEach((c, idx) => {
      const count = alloc.allocated ? alloc.allocated[idx] : 0;
      const chEligible = shuffle(getEligibleQuestions(c, config.diffs));
      ids.push(...chEligible.slice(0, count).map((q) => q.id));
    });
  }

  return shuffle(ids);
}
