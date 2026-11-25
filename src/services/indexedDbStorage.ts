/**
 * Safe IndexedDB Storage Engine for BAMS Practice
 *
 * Provides a high-capacity (hundreds of MB) local storage layer for storing
 * large question banks (5,000+ MCQs) in web & mobile browsers (iOS Safari, Android Chrome).
 *
 * Completely bypasses the restrictive 5 MB window.localStorage quota and QuotaExceededError crashes,
 * with seamless in-memory fallback for environments where IndexedDB is unavailable or restricted.
 */

import { Question } from '../types';

const DB_NAME = 'bams_practice_idb_v1';
const DB_VERSION = 1;
const STORE_NAME = 'questions_store';
const KEY_NAME = 'all_questions_bank';

// In-memory fallback
let _inMemoryQuestions: Question[] | null = null;

function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB.'));
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open blocked by another tab.');
        reject(new Error('IndexedDB database open blocked.'));
      };
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Loads stored questions from IndexedDB, falling back to in-memory store.
 */
export async function getStoredQuestions(): Promise<Question[] | null> {
  if (!isIndexedDBAvailable()) {
    return _inMemoryQuestions;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(KEY_NAME);

        request.onsuccess = () => {
          const result = request.result;
          if (Array.isArray(result) && result.length > 0) {
            _inMemoryQuestions = result;
            resolve(result);
          } else {
            resolve(_inMemoryQuestions);
          }
        };

        request.onerror = () => {
          console.warn('[IndexedDB] Get request failed, using in-memory fallback:', request.error);
          resolve(_inMemoryQuestions);
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Transaction creation failed:', txErr);
        resolve(_inMemoryQuestions);
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to read stored questions:', err);
    return _inMemoryQuestions;
  }
}

/**
 * Persists questions array to IndexedDB (and updates memory store).
 * Returns true on success, false if stored in memory only.
 */
export async function setStoredQuestions(questions: Question[]): Promise<boolean> {
  _inMemoryQuestions = questions;

  if (!isIndexedDBAvailable() || !Array.isArray(questions)) {
    return false;
  }

  if (questions.length === 0) {
    await clearStoredQuestions();
    return true;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(questions, KEY_NAME);

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = () => {
          console.warn('[IndexedDB] Put request failed:', request.error);
          resolve(false);
        };

        tx.onabort = () => {
          console.warn('[IndexedDB] Transaction aborted.');
          resolve(false);
        };
      } catch (txErr) {
        console.warn('[IndexedDB] Write transaction failed:', txErr);
        resolve(false);
      }
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to persist questions to IndexedDB:', err);
    return false;
  }
}

/**
 * Clears the stored questions in IndexedDB and in-memory store.
 */
export async function clearStoredQuestions(): Promise<void> {
  _inMemoryQuestions = [];

  if (!isIndexedDBAvailable()) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(KEY_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (e) {
    console.warn('[IndexedDB] Failed to clear questions:', e);
  }
}

/**
 * Safe localStorage wrapper that NEVER throws QuotaExceededError or crashes on iOS Safari.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return true;
    }
  } catch (e) {
    console.warn(`[safeLocalStorage] Quota or security error writing key "${key}":`, e);
  }
  return false;
}

export function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (e) {
    console.warn(`[safeLocalStorage] Error reading key "${key}":`, e);
  }
  return null;
}

export function safeLocalStorageRemove(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn(`[safeLocalStorage] Error removing key "${key}":`, e);
  }
}

// =========================================================================
// LIGHTWEIGHT CHAPTER SUMMARY & 24-HOUR SINGLE CHAPTER CACHE
// =========================================================================

export interface ChapterCountsSummary {
  [chapterKey: string]: {
    verifiedCount: number;
    totalCount: number;
  };
}

export interface CachedChapterPayload {
  chapterKey: string;
  questions: Question[];
  timestamp: number;
}

const CHAPTER_SUMMARY_KEY = 'bams_chapter_counts_summary_v1';
const CHAPTER_CACHE_PREFIX = 'bams_ch_cache_';
const CHAPTER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const _inMemoryChapterCache: Record<string, CachedChapterPayload> = {};
let _inMemorySummary: ChapterCountsSummary | null = null;

function normalizeChapterCacheKey(key: string): string {
  return CHAPTER_CACHE_PREFIX + key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/**
 * Retrieves the lightweight chapter counts summary from cache.
 */
export async function getCachedChapterSummary(): Promise<ChapterCountsSummary | null> {
  if (_inMemorySummary) return _inMemorySummary;
  const raw = safeLocalStorageGet(CHAPTER_SUMMARY_KEY);
  if (raw) {
    try {
      _inMemorySummary = JSON.parse(raw);
      return _inMemorySummary;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Persists the lightweight chapter counts summary in cache.
 */
export async function setCachedChapterSummary(summary: ChapterCountsSummary): Promise<boolean> {
  _inMemorySummary = summary;
  try {
    return safeLocalStorageSet(CHAPTER_SUMMARY_KEY, JSON.stringify(summary));
  } catch {
    return false;
  }
}

/**
 * Retrieves a single chapter's questions from the 24-hour cache.
 * Returns null if not cached or if cache is older than 24 hours.
 */
export async function getCachedChapterQuestions(chapterKey: string): Promise<Question[] | null> {
  const normKey = normalizeChapterCacheKey(chapterKey);

  // Check in-memory first
  const mem = _inMemoryChapterCache[normKey];
  if (mem && Date.now() - mem.timestamp < CHAPTER_CACHE_TTL_MS) {
    return mem.questions;
  }

  if (!isIndexedDBAvailable()) {
    return null;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(normKey);

        request.onsuccess = () => {
          const entry = request.result as CachedChapterPayload | undefined;
          if (entry && entry.questions && Date.now() - entry.timestamp < CHAPTER_CACHE_TTL_MS) {
            _inMemoryChapterCache[normKey] = entry;
            resolve(entry.questions);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Persists a single chapter's questions in IndexedDB with a 24-hour timestamp.
 */
export async function setCachedChapterQuestions(chapterKey: string, questions: Question[]): Promise<boolean> {
  const normKey = normalizeChapterCacheKey(chapterKey);
  const payload: CachedChapterPayload = {
    chapterKey,
    questions,
    timestamp: Date.now(),
  };

  _inMemoryChapterCache[normKey] = payload;

  if (!isIndexedDBAvailable()) {
    return true;
  }

  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(payload, normKey);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}
