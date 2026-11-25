import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, PracticeConfig, SavedPracticeSet } from '../types';

const STORAGE_KEYS = {
  LANG: 'bams_lang',
  DRAFT: 'bams_draft',
  SETS: 'bams_sets',
  BOOKMARKS: 'bams_bookmarks',
};

export async function loadLanguage(defaultValue: Language = 'both'): Promise<Language> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.LANG);
    if (val === 'en' || val === 'hi' || val === 'both') {
      return val;
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function saveLanguage(lang: Language): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LANG, lang);
  } catch (e) {
    console.warn('Failed to save language', e);
  }
}

export interface DraftState {
  sel: (string | number)[];
  cfg: PracticeConfig;
}

export async function loadDraft(): Promise<DraftState | null> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.DRAFT);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(draft: DraftState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(draft));
  } catch (e) {
    console.warn('Failed to save draft', e);
  }
}

export async function loadSavedSets(): Promise<SavedPracticeSet[]> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.SETS);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

export async function savePracticeSets(sets: SavedPracticeSet[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SETS, JSON.stringify(sets));
  } catch (e) {
    console.warn('Failed to save sets', e);
  }
}

export async function loadBookmarks(): Promise<(string | number)[]> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

export async function saveBookmarks(ids: (string | number)[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(ids));
  } catch (e) {
    console.warn('Failed to save bookmarks', e);
  }
}
