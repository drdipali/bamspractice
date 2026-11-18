/**
 * Backend Cloud Configuration (Supabase / Firebase)
 *
 * To connect to your live remote Firebase or Supabase instance,
 * supply your project credentials below. If left as default, the app
 * uses the built-in Cloud Storage Engine with instant persistence and pre-seeded demo accounts.
 */

export const BACKEND_PROVIDER: 'supabase' | 'firebase' | 'cloud_sync' = 'cloud_sync';

export const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://YOUR_PROJECT_ID.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
};

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'YOUR_APP_ID',
};

export const isRemoteSupabaseConfigured = (): boolean => {
  return (
    !SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID') &&
    !SUPABASE_CONFIG.anonKey.includes('YOUR_SUPABASE_ANON_KEY')
  );
};

export const isRemoteFirebaseConfigured = (): boolean => {
  return (
    !FIREBASE_CONFIG.apiKey.includes('YOUR_FIREBASE_API_KEY') &&
    !FIREBASE_CONFIG.projectId.includes('YOUR_PROJECT_ID')
  );
};
