import { QuestionType } from '../types';
import { GeminiService, normalizeGroqModel } from '../services/gemini';

export interface BaseQuestionItem {
  id?: string | number;
  stem: string;
  o: string[];
  c: number | string;
  r?: string;
  explanation?: string;
  ch?: string | number;
  chapterName?: string;
  questionType?: QuestionType;
  assertionText?: string;
  reasonText?: string;
  statement1?: string;
  statement2?: string;
  matchPairs?: any[];
  hi?: {
    stem?: string;
    o?: string[];
    explanation?: string;
  };
  [key: string]: any;
}

export interface ProcessingOptions {
  randomizeOptions: boolean;
  swapWrongDistractor: boolean;
  rephraseStem: boolean;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  batchIndex: number;
  totalBatches: number;
  status: 'idle' | 'processing' | 'paused' | 'stopped' | 'completed' | 'error';
  errorMessage?: string;
}

export interface ShuffledQuestionResult<T extends BaseQuestionItem> {
  question: T;
  wasShuffled: boolean;
  skipReason?: string;
}

export interface AIProcessedQuestionResult<T extends BaseQuestionItem> {
  question: T;
  wasStemRephrased: boolean;
  wasDistractorSwapped: boolean;
  swappedOptionIndex?: number;
  oldDistractorText?: string;
  newDistractorText?: string;
  originalStem?: string;
}

/**
 * Patterns that indicate an option or stem relies on absolute option positions
 * (e.g. "All of the above", "Both A and B", "None of these").
 * Shuffling options for these questions would create nonsensical answer choices.
 */
const POSITIONAL_OPTION_PATTERNS: RegExp[] = [
  /\ball\s+(?:of\s+)?the\s+above\b/i,
  /\ball\s+the\s+above\b/i,
  /\bnone\s+(?:of\s+)?the\s+above\b/i,
  /\bnone\s+of\s+these\b/i,
  /\bboth\s+[a-d]\s+(?:and|&)\s+[a-d]\b/i,
  /\bboth\s+\([a-d]\)\s+(?:and|&)\s+\([a-d]\)\b/i,
  /\b(?:both\s+)?[a-d]\s*(?:and|&|\/|\+)\s*[a-d]\b/i,
  /\b\([a-d]\)\s*(?:and|&|\/|\+)\s*\([a-d]\)\b/i,
  /\b(?:only|option)\s+[a-d]\b/i,
  /\bboth\s+[1-4]\s+(?:and|&)\s+[1-4]\b/i,
  /\b(?:options?|choices?)\s+[a-d]\s+and\s+[a-d]\b/i,
  /उपरोक्त\s*सभी/i,
  /उपर्युक्त\s*सभी/i,
  /उपरोक्त\s*दोनों/i,
  /उपर्युक्त\s*दोनों/i,
  /उपरोक्त\s*में\s*से\s*कोई\s*नहीं/i,
  /उपर्युक्त\s*में\s*से\s*कोई\s*नहीं/i,
  /इनमें\s*से\s*कोई\s*नहीं/i,
  /कोई\s*भी\s*नहीं/i,
  /दोनों\s*[a-d1-4]/i,
  /[a-d]\s*(?:तथा|और|एवं)\s*[a-d]/i,
  /\([a-d]\)\s*(?:तथा|और|एवं)\s*\([a-d]\)/i,
  /1\s*(?:तथा|और|एवं)\s*2/i,
  /a\s*(?:तथा|और|एवं)\s*b/i,
];

/**
 * Checks whether a question must be skipped from option randomization to protect
 * question validity and logic.
 */
export function shouldSkipOptionRandomization(
  q: BaseQuestionItem
): { skip: boolean; reason?: string } {
  if (!q) return { skip: true, reason: 'Empty question object' };

  // 1. Guard against fixed-meaning question types where A/B/C/D have fixed definitions
  const qType = q.questionType;
  if (
    qType === 'assertion_reason' ||
    qType === 'match_the_pair' ||
    qType === 'statement_type'
  ) {
    return {
      skip: true,
      reason: `Fixed question type (${qType}) has standardized option definitions.`,
    };
  }

  if (q.assertionText || q.statement1 || (q.matchPairs && q.matchPairs.length > 0)) {
    return {
      skip: true,
      reason: 'Contains Assertion-Reason, Statement, or Match Pair structure.',
    };
  }

  // 2. Validate options array and correct answer index
  const options = q.o;
  if (!Array.isArray(options) || options.length < 2) {
    return { skip: true, reason: 'Invalid or missing options array' };
  }

  const correctIndex = typeof q.c === 'number' ? q.c : parseInt(String(q.c), 10);
  if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    return { skip: true, reason: 'Invalid correct answer index' };
  }

  // 3. Scan each option text for positional keywords (e.g. "All of the above", "Both A and B")
  for (let i = 0; i < options.length; i++) {
    const optText = String(options[i] || '').trim();
    for (const pattern of POSITIONAL_OPTION_PATTERNS) {
      if (pattern.test(optText)) {
        return {
          skip: true,
          reason: `Option ${String.fromCharCode(65 + i)} contains positional reference ("${optText}").`,
        };
      }
    }
  }

  // 4. Scan stem for explicit letter-based option references like "statements (A) and (B)"
  const stem = String(q.stem || '');
  if (
    /\b(?:both\s+options?\s+[a-d]|which\s+of\s+the\s+following\s+pairs?\s+\([a-d]\))\b/i.test(stem) ||
    /विकल्प\s*\([a-d]\)\s*तथा/i.test(stem)
  ) {
    return {
      skip: true,
      reason: 'Stem explicitly references option letters.',
    };
  }

  return { skip: false };
}

/**
 * Shuffles options for a single question randomly while preserving the exact
 * correct answer. Automatically updates the correct answer index (`c`).
 * If bilingual Hindi options (`q.hi.o`) exist, they are shuffled in the exact same permutation.
 */
export function randomizeQuestionOptions<T extends BaseQuestionItem>(
  q: T
): ShuffledQuestionResult<T> {
  const guard = shouldSkipOptionRandomization(q);
  if (guard.skip) {
    return {
      question: q,
      wasShuffled: false,
      skipReason: guard.reason,
    };
  }

  const options: string[] = [...q.o];
  const correctIndex = typeof q.c === 'number' ? q.c : parseInt(String(q.c), 10);
  const hiOptions: string[] = q.hi?.o ? [...q.hi.o] : [];

  // Create tagged list of items
  const items = options.map((text, idx) => ({
    text,
    isCorrect: idx === correctIndex,
    hiText: hiOptions[idx] || '',
    origIdx: idx,
  }));

  // Fisher-Yates shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  // If random shuffle resulted in the exact same order and we have at least 2 distinct options, swap two
  const isIdentical = items.every((it, idx) => it.origIdx === idx);
  if (isIdentical && items.length >= 2) {
    const swapTarget = items[0].isCorrect ? 1 : 0;
    const swapWith = items.length - 1;
    const temp = items[swapTarget];
    items[swapTarget] = items[swapWith];
    items[swapWith] = temp;
  }

  const newOptions = items.map((it) => it.text);
  const newCorrectIndex = items.findIndex((it) => it.isCorrect);
  const newHiOptions = items.map((it) => it.hiText);

  const updated: T = {
    ...q,
    o: newOptions,
    c: newCorrectIndex,
    ...(q.hi
      ? {
          hi: {
            ...q.hi,
            o: newHiOptions,
          },
        }
      : {}),
  };

  return {
    question: updated,
    wasShuffled: true,
  };
}

/**
 * Shuffles options for an entire array of questions in-place, returning summary counts.
 */
export function batchRandomizeOptions<T extends BaseQuestionItem>(
  questions: T[]
): {
  processed: T[];
  shuffledCount: number;
  skippedCount: number;
  results: ShuffledQuestionResult<T>[];
  shuffleDetails: ShuffledQuestionResult<T>[];
} {
  let shuffledCount = 0;
  let skippedCount = 0;
  const results: ShuffledQuestionResult<T>[] = [];
  const processed: T[] = [];

  for (const q of questions) {
    const res = randomizeQuestionOptions(q);
    results.push(res);
    processed.push(res.question);
    if (res.wasShuffled) {
      shuffledCount++;
    } else {
      skippedCount++;
    }
  }

  return {
    processed,
    shuffledCount,
    skippedCount,
    results,
    shuffleDetails: results,
  };
}

/**
 * System prompt for Groq AI distractor swapping & stem rephrasing
 */
const AI_BATCH_SYSTEM_INSTRUCTION = `You are a distinguished Professor of Ayurveda (BAMS/AIAPGET) and medical exam question setter.
You will transform multiple-choice questions according to strict classical Ayurvedic standards (Charaka, Sushruta, Ashtanga Hridaya).

STRICT INSTRUCTIONS:
1. PRESERVE THE CORRECT ANSWER:
   - For every question, the correct answer text and its exact position in the options array MUST REMAIN 100% UNTOUCHED.
   - NEVER modify or swap the correct answer.

2. REFRESH ONE INCORRECT DISTRACTOR (if requested):
   - Choose exactly ONE incorrect option (distractor) that is NOT the correct answer.
   - Replace it with a fresh, plausible, classical Ayurveda distractor that fits the context of the question (e.g. a different Dravya, Dosha, Shloka term, Guna, or Rogi lakshana).
   - Match the exact bilingual format (English / Devanagari Hindi) and grammatical style of the other options.
   - The new distractor must be definitively INCORRECT based on classical texts so it does not create ambiguous or double-correct questions.
   - Leave the remaining 2 incorrect options completely unchanged.

3. REPHRASE QUESTION STEM (if requested):
   - Rephrase the question stem to make it clearer, exam-grade, grammatically flawless, and professionally worded.
   - Maintain the bilingual format (English followed by Hindi / Devanagari).
   - NEVER alter any quoted Sanskrit Shloka verses, Samhita citations (e.g. 'Cha. Su. 25/40', 'चरक सूत्र', 'सुश्रुत'), or medical terms.
   - Do NOT change what the question is asking or its answer key.

OUTPUT FORMAT:
Return valid JSON only matching this schema:
{
  "results": [
    {
      "index": 0,
      "rephrasedStem": "Rephrased stem text (or null if not requested)",
      "swappedOptionIndex": 2, // 0-based index of the swapped incorrect option (or null if not requested)
      "oldDistractorText": "Old option text",
      "newDistractorText": "New fresh distractor text",
      "updatedOptions": ["Option A", "Option B", "Option C", "Option D"]
    }
  ]
}`;

/**
 * Processes a small batch of up to 5 questions through Groq AI.
 */
export async function processBatchWithGroq<T extends BaseQuestionItem>(
  batch: { item: T; index: number }[],
  options: { swapWrongDistractor: boolean; rephraseStem: boolean }
): Promise<AIProcessedQuestionResult<T>[]> {
  const apiKey = await GeminiService.getGroqApiKey();
  if (!apiKey) {
    throw new Error('Groq API Key is not configured. Please enter your free Groq API key in AI Settings.');
  }

  // If neither AI option is selected, return items untouched
  if (!options.swapWrongDistractor && !options.rephraseStem) {
    return batch.map(({ item }) => ({
      question: item,
      wasStemRephrased: false,
      wasDistractorSwapped: false,
    }));
  }

  const preferredModel = await GeminiService.getGroqModel();
  const models = [
    preferredModel,
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
  ].map(normalizeGroqModel);

  const uniqueModels = Array.from(new Set(models));

  // Prepare payload for the 5-question batch
  const payloadQuestions = batch.map(({ item, index }) => {
    const cIdx = typeof item.c === 'number' ? item.c : parseInt(String(item.c), 10);
    return {
      index,
      stem: String(item.stem || ''),
      options: Array.isArray(item.o) ? item.o : [],
      correctIndex: cIdx,
      correctOption: item.o?.[cIdx] || '',
      referenceCitation: item.r || '',
    };
  });

  const requestBody = {
    instructions: {
      rephraseStem: options.rephraseStem,
      swapWrongDistractor: options.swapWrongDistractor,
    },
    questions: payloadQuestions,
  };

  let lastError: any = null;

  for (const model of uniqueModels) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: AI_BATCH_SYSTEM_INSTRUCTION },
            {
              role: 'user',
              content: `Process this batch of ${payloadQuestions.length} questions:\n\n${JSON.stringify(
                requestBody,
                null,
                2
              )}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.25,
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
        if (response.status === 429 || errMsg.toLowerCase().includes('rate limit')) {
          lastError = new Error(`Groq rate limit: ${errMsg}`);
          continue; // try next model
        }
        throw new Error(`Groq error (${model}): ${errMsg}`);
      }

      const json = await response.json();
      const rawContent = json?.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error('Groq returned empty response');
      }

      let parsed: { results?: any[] };
      try {
        parsed = JSON.parse(rawContent);
      } catch (pErr) {
        // Safe regex extract if needed
        const m = rawContent.match(/\{[\s\S]*\}/);
        if (m) {
          parsed = JSON.parse(m[0]);
        } else {
          throw new Error('Failed to parse Groq JSON response');
        }
      }

      const resultsList = Array.isArray(parsed?.results) ? parsed.results : [];
      const resultMap = new Map<number, any>();
      resultsList.forEach((r) => {
        if (typeof r.index === 'number') {
          resultMap.set(r.index, r);
        }
      });

      // Construct verified outputs for each item in batch
      return batch.map(({ item, index }) => {
        const aiRes = resultMap.get(index);
        let updatedQuestion: T = { ...item };
        let wasStemRephrased = false;
        let wasDistractorSwapped = false;
        let swappedOptionIndex: number | undefined;
        let oldDistractorText: string | undefined;
        let newDistractorText: string | undefined;

        if (aiRes) {
          // 1. Apply stem rephrase if valid
          if (
            options.rephraseStem &&
            typeof aiRes.rephrasedStem === 'string' &&
            aiRes.rephrasedStem.trim().length > 10
          ) {
            updatedQuestion = {
              ...updatedQuestion,
              stem: aiRes.rephrasedStem.trim(),
            };
            wasStemRephrased = true;
          }

          // 2. Apply distractor swap with strict correctness protection
          if (options.swapWrongDistractor) {
            const correctIdx =
              typeof item.c === 'number' ? item.c : parseInt(String(item.c), 10);
            const targetSwapIdx =
              typeof aiRes.swappedOptionIndex === 'number'
                ? aiRes.swappedOptionIndex
                : -1;

            // Security guard: Ensure AI never altered the correct answer!
            if (
              targetSwapIdx >= 0 &&
              targetSwapIdx < item.o.length &&
              targetSwapIdx !== correctIdx &&
              typeof aiRes.newOptionText === 'string' &&
              aiRes.newOptionText.trim().length > 0
            ) {
              const newOptions = [...item.o];
              const validNewText = aiRes.newOptionText.trim();
              oldDistractorText = newOptions[targetSwapIdx];
              newDistractorText = validNewText;
              newOptions[targetSwapIdx] = validNewText;

              // Ensure correct answer is still exactly identical
              newOptions[correctIdx] = item.o[correctIdx] || '';

              updatedQuestion = {
                ...updatedQuestion,
                o: newOptions,
                c: correctIdx,
              };
              wasDistractorSwapped = true;
              swappedOptionIndex = targetSwapIdx;
            } else if (
              Array.isArray(aiRes.updatedOptions) &&
              aiRes.updatedOptions.length === item.o.length
            ) {
              // Fallback verification for array output
              const candidate = [...aiRes.updatedOptions];
              // Strict guard: verify the correct option is untouched
              candidate[correctIdx] = item.o[correctIdx] || '';
              updatedQuestion = {
                ...updatedQuestion,
                o: candidate,
                c: correctIdx,
              };
              wasDistractorSwapped = true;
            }
          }
        }

        return {
          question: updatedQuestion,
          wasStemRephrased,
          wasDistractorSwapped,
          swappedOptionIndex,
          oldDistractorText,
          newDistractorText,
          originalStem: item.stem,
        };
      });
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      console.warn(`Groq model ${model} batch error:`, err?.message || err);
    }
  }

  throw (
    lastError ||
    new Error('Failed to process batch with Groq AI. Please check your internet connection or Groq API key.')
  );
}

/**
 * Controller class to run an asynchronous, rate-limited queue over an array of questions.
 * Processes 5 questions per Groq call, sleeps 2.5 seconds between batches, and supports
 * pause, resume, and stop controls.
 */
export class QuestionProcessingQueue<T extends BaseQuestionItem> {
  private items: T[];
  private options: ProcessingOptions;
  private onProgress: (progress: ProcessingProgress) => void;
  private isPaused: boolean = false;
  private isStopped: boolean = false;
  private processedResults: T[] = [];
  private aiDetails: AIProcessedQuestionResult<T>[] = [];
  private shuffleDetails: ShuffledQuestionResult<T>[] = [];

  constructor(
    items: T[],
    options: ProcessingOptions,
    onProgress: (progress: ProcessingProgress) => void
  ) {
    this.items = [...items];
    this.options = { ...options };
    this.onProgress = onProgress;
  }

  public pause() {
    this.isPaused = true;
  }

  public resume() {
    this.isPaused = false;
  }

  public stop() {
    this.isStopped = true;
    this.isPaused = false;
  }

  /**
   * Runs the processing queue. Returns the final processed questions and metadata.
   */
  public async run(): Promise<{
    processed: T[];
    shuffledCount: number;
    rephrasedCount: number;
    distractorSwappedCount: number;
    aiDetails: AIProcessedQuestionResult<T>[];
    shuffleDetails: ShuffledQuestionResult<T>[];
  }> {
    const total = this.items.length;
    if (total === 0) {
      return {
        processed: [],
        shuffledCount: 0,
        rephrasedCount: 0,
        distractorSwappedCount: 0,
        aiDetails: [],
        shuffleDetails: [],
      };
    }

    // Step 1: Client-Side Option Randomizer (Instant, 0 AI cost)
    let currentQuestions = [...this.items];
    if (this.options.randomizeOptions) {
      const shuffleRes = batchRandomizeOptions(currentQuestions);
      currentQuestions = shuffleRes.processed;
      this.shuffleDetails = shuffleRes.results;
    }

    // If no AI processing was selected, we are done immediately!
    if (!this.options.swapWrongDistractor && !this.options.rephraseStem) {
      this.onProgress({
        current: total,
        total,
        batchIndex: 1,
        totalBatches: 1,
        status: 'completed',
      });
      return {
        processed: currentQuestions,
        shuffledCount: this.shuffleDetails.filter((s) => s.wasShuffled).length,
        rephrasedCount: 0,
        distractorSwappedCount: 0,
        aiDetails: [],
        shuffleDetails: this.shuffleDetails,
      };
    }

    // Step 2: Rate-Limited AI Queue (5 questions per batch, 2.5s delay)
    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(total / BATCH_SIZE);
    this.processedResults = [];
    this.aiDetails = [];

    for (let b = 0; b < totalBatches; b++) {
      // Check if user requested stop
      if (this.isStopped) {
        // Fill remaining with unprocessed questions
        const remaining = currentQuestions.slice(this.processedResults.length);
        this.processedResults.push(...remaining);
        this.onProgress({
          current: this.processedResults.length,
          total,
          batchIndex: b,
          totalBatches,
          status: 'stopped',
        });
        break;
      }

      // Check if paused: wait until resumed or stopped
      while (this.isPaused && !this.isStopped) {
        this.onProgress({
          current: this.processedResults.length,
          total,
          batchIndex: b,
          totalBatches,
          status: 'paused',
        });
        await new Promise((r) => setTimeout(r, 500));
      }

      if (this.isStopped) break;

      const start = b * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, total);
      const batchSlice = currentQuestions.slice(start, end).map((item, idx) => ({
        item,
        index: start + idx,
      }));

      this.onProgress({
        current: start,
        total,
        batchIndex: b + 1,
        totalBatches,
        status: 'processing',
      });

      try {
        const batchResults = await processBatchWithGroq(batchSlice, {
          swapWrongDistractor: this.options.swapWrongDistractor,
          rephraseStem: this.options.rephraseStem,
        });

        batchResults.forEach((res) => {
          this.processedResults.push(res.question);
          this.aiDetails.push(res);
        });
      } catch (err: any) {
        console.warn(`[QuestionProcessor] Batch ${b + 1} processing warning:`, err);
        // On error, fallback to keeping original questions for this batch
        batchSlice.forEach(({ item }) => {
          this.processedResults.push(item);
          this.aiDetails.push({
            question: item,
            wasStemRephrased: false,
            wasDistractorSwapped: false,
          });
        });
      }

      this.onProgress({
        current: Math.min(end, total),
        total,
        batchIndex: b + 1,
        totalBatches,
        status: b === totalBatches - 1 ? 'completed' : 'processing',
      });

      // 2.5-second rate-limiting delay between successive Groq batches
      if (b < totalBatches - 1 && !this.isStopped) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

    const shuffledCount = this.shuffleDetails.filter((s) => s.wasShuffled).length;
    const rephrasedCount = this.aiDetails.filter((a) => a.wasStemRephrased).length;
    const distractorSwappedCount = this.aiDetails.filter((a) => a.wasDistractorSwapped).length;

    return {
      processed: this.processedResults,
      shuffledCount,
      rephrasedCount,
      distractorSwappedCount,
      aiDetails: this.aiDetails,
      shuffleDetails: this.shuffleDetails,
    };
  }
}
