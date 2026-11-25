import type { ChapterCountsSummary } from '../services/indexedDbStorage';
import rawData from './defaultChapterSummary.json';

export const DEFAULT_CHAPTER_SUMMARY: ChapterCountsSummary = rawData as ChapterCountsSummary;
