import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, PracticeConfig, SavedPracticeSet } from '../types';

const STORAGE_KEYS = {
  LANG: 'bams_lang',
  DRAFT: 'bams_draft',
  SETS: 'bams_sets',
};

export async function loadLanguage(defaultValue: Language = 'en'): Promise<Language> {
  try {
    const val = await AsyncStorage.getItem(STORAGE_KEYS.LANG);
    return (val as Language) || defaultValue;
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
  sel: number[];
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
