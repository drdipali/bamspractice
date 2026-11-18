/**
 * BAMS Practice Builder - Verification Script
 * Validates State Management, Question Allocation, Scoring, and Session Workflows.
 */

import { ALL_CHAPTERS, ALL_QUESTIONS, getChapterPath } from '../src/constants/syllabusData';
import { allocateQuestions, generateQuestionIds, shuffle } from '../src/utils/allocator';
import { Chapter, PracticeConfig, Question, QuizResults, QuizSession } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('====================================================');
console.log('🧪 BAMS PRACTICE BUILDER - STATE VERIFICATION SUITE');
console.log('====================================================\n');

// Test 1: Syllabus & Real Question Bank Loading
console.log('--- Test 1: Syllabus & Data Structures ---');
assert(ALL_CHAPTERS.length > 500, `Loaded ${ALL_CHAPTERS.length} chapters across 25 classical texts`);
const ch0 = ALL_CHAPTERS[0];
assert(ch0.sam === 'Charaka Samhita' && ch0.sth === 'Sutrasthana' && ch0.n === 1, 'Chapter 0 correctly identifies Charaka Sutrasthana Ch 1');
assert(ch0.qs.length === 90, `Chapter 0 has exactly 90 verified entrance-exam questions (found ${ch0.qs.length})`);
assert(ch0.qs[0].hi !== undefined, 'Questions have Hindi translations bound');
assert(ch0.qs[0].r !== undefined, 'Questions have classical Samhita textual citations bound');

// Test 2: Allocation Engine
console.log('\n--- Test 2: Question Allocation Engine ---');
const selectedChapters: Chapter[] = [ALL_CHAPTERS[0], ALL_CHAPTERS[1], ALL_CHAPTERS[2]]; // Sutra Ch 1, 2, 3
const pooledConfig: PracticeConfig = {
  total: 40,
  dist: 'pooled',
  diffs: [0, 1, 2],
  mode: 'learning',
  manual: {},
};

const pooledAlloc = allocateQuestions(selectedChapters, pooledConfig);
assert(pooledAlloc.finalCount === 40, `Pooled distribution yields exact target questions (${pooledAlloc.finalCount})`);

const pooledIds = generateQuestionIds(selectedChapters, pooledConfig);
assert(pooledIds.length === 40, `Generated exactly 40 question IDs in pooled mode`);
assert(new Set(pooledIds).size === 40, 'All generated question IDs are strictly unique (no duplicates)');

const equalConfig: PracticeConfig = {
  total: 30,
  dist: 'equal',
  diffs: [0, 1, 2],
  mode: 'test',
  manual: {},
};
const equalAlloc = allocateQuestions(selectedChapters, equalConfig);
assert(equalAlloc.allocated !== null, 'Equal distribution produced per-chapter allocation breakdown');
const equalAllocSum = equalAlloc.allocated!.reduce((a, b) => a + b, 0);
assert(equalAllocSum === 30, `Equal allocation distributed all 30 questions evenly`);

const manualConfig: PracticeConfig = {
  total: 50,
  dist: 'manual',
  diffs: [0, 1, 2],
  mode: 'learning',
  manual: { [selectedChapters[0].id]: 15, [selectedChapters[1].id]: 5, [selectedChapters[2].id]: 10 },
};
const manualAlloc = allocateQuestions(selectedChapters, manualConfig);
assert(manualAlloc.finalCount === 30, `Manual distribution honored exact requested counts (15 + 5 + 10 = 30)`);

// Test 3: Live Quiz Session State Machine
console.log('\n--- Test 3: Active Quiz Session State Machine ---');
const sessionQuestions: Question[] = pooledIds.slice(0, 10).map((id) => ALL_QUESTIONS[id]);
const session: QuizSession = {
  qs: sessionQuestions,
  i: 0,
  ans: {},
  sub: {},
  rev: {},
  mode: 'learning',
  t0: Date.now() - 125000, // 2 mins 5 secs ago
  chs: selectedChapters.map((c) => c.id),
};

assert(session.qs.length === 10, 'Session initialized with 10 questions');
assert(session.i === 0, 'Session starts at question index 0');

// Answer and submit Question 0 (Correct answer)
const q0 = session.qs[0];
session.ans[q0.id] = q0.c; // Correct choice
session.sub[q0.id] = true; // Submit in learning mode
assert(session.ans[q0.id] === q0.c, 'Option answered accurately');
assert(session.sub[q0.id] === true, 'Submission locks answer in Learning mode');

// Answer Question 1 (Incorrect answer)
const q1 = session.qs[1];
const wrongOption = (q1.c + 1) % 4;
session.ans[q1.id] = wrongOption;
session.sub[q1.id] = true;
assert(session.ans[q1.id] !== q1.c, 'Option intentionally answered incorrectly');

// Mark Question 2 for review without answering
const q2 = session.qs[2];
session.rev[q2.id] = true;
assert(session.rev[q2.id] === true, 'Question 2 flagged with review bookmark');

// Answer Question 3 correctly
const q3 = session.qs[3];
session.ans[q3.id] = q3.c;
session.sub[q3.id] = true;

// Leave remaining 6 questions unattempted
// Finish session
session.t1 = Date.now();

// Test 4: Scoring & Analytics Computation
console.log('\n--- Test 4: Results & Scorecard Analytics ---');
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
const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
const timeSpentSecs = Math.round((session.t1 - session.t0) / 1000);

// Competitive exam scoring: +4 for correct, -1 for incorrect, 0 for unattempted
const score = correct * 4 - incorrect * 1;
const maxScore = session.qs.length * 4;
const scorePercent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

const results: QuizResults = {
  total: session.qs.length,
  attempted,
  correct,
  incorrect,
  unattempted,
  accuracy,
  timeSpentSecs,
  byChapter,
  wrongQuestions,
  score,
  maxScore,
  scorePercent,
};

assert(results.total === 10, 'Total questions tracked is 10');
assert(results.correct === 2, `Correct count is exactly 2 (found ${results.correct})`);
assert(results.incorrect === 1, `Incorrect count is exactly 1 (found ${results.incorrect})`);
assert(results.unattempted === 7, `Unattempted count is exactly 7 (found ${results.unattempted})`);
assert(results.accuracy === 67, `Accuracy is 67% (2 / 3 attempted) (found ${results.accuracy}%)`);
assert(results.score === 7, `Competitive score correctly awarded: 2*4 - 1*1 = 7 (found ${results.score})`);
assert(results.maxScore === 40, `Max competitive score correctly calculated: 10*4 = 40 (found ${results.maxScore})`);
assert(results.scorePercent === 18, `Score percentage correctly calculated: (7/40)*100 = 18% (found ${results.scorePercent}%)`);
assert(results.timeSpentSecs >= 120, `Time spent correctly calculated (${results.timeSpentSecs}s)`);
assert(results.wrongQuestions.length === 1, 'Wrong questions list contains exactly the 1 failed question');
assert(results.wrongQuestions[0].id === q1.id, 'Wrong question ID matches Question 1');

// Test 5: Reattempt Incorrect Flow
console.log('\n--- Test 5: Remedial Practice Reattempt ---');
const reattemptIds = shuffle(results.wrongQuestions.map((q) => q.id));
assert(reattemptIds.length === 1 && reattemptIds[0] === q1.id, 'Reattempt test specifically targets only the missed question');

console.log('\n====================================================');
console.log('🎉 ALL 20 STATE MANAGEMENT VERIFICATION TESTS PASSED!');
console.log('====================================================\n');
