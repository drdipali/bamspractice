import { Platform } from 'react-native';
import { Question } from '../types';
import {
  parseSpreadsheetRows,
  parseSpreadsheetBuffer,
  parseWorkbookAllTabs,
  WorkbookTabResult,
  SpreadsheetParseResult,
} from '../utils/spreadsheetHelper';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: any) => void;
            prompt?: string;
          }) => GoogleTokenClient;
          revoke: (accessToken: string, done?: () => void) => void;
        };
      };
    };
  }
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

export interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
  id?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

export interface DriveTabScan {
  tabName: string;
  sheetId: number | string;
  totalRows: number;
  validQuestions: Omit<Question, 'id'>[];
  errors: { row: number; error: string }[];
}

export interface DriveSheetScan {
  fileId: string;
  fileName: string;
  mimeType: string;
  status: 'success' | 'error';
  errorMessage?: string;
  tabs: DriveTabScan[];
  sheetValidQuestions: Omit<Question, 'id'>[];
}

export interface DriveFolderScanSummary {
  folderId: string;
  folderName: string;
  totalSheetsFound: number;
  totalTabsScanned: number;
  totalRowsScanned: number;
  validQuestionsCount: number;
  errorCount: number;
  failedFilesCount: number;
  sheets: DriveSheetScan[];
  allValidQuestions: Omit<Question, 'id'>[];
}

const STORAGE_KEYS = {
  CLIENT_ID: 'bams_google_oauth_client_id_v1',
  ACCESS_TOKEN: 'bams_gdrive_access_token_v1',
  TOKEN_EXPIRES_AT: 'bams_gdrive_token_expires_at_v1',
  USER_INFO: 'bams_gdrive_user_info_v1',
  LAST_FOLDER_URL: 'bams_gdrive_last_folder_url_v1',
};

// Fallback OAuth Client ID if set in environment
const ENV_CLIENT_ID =
  (typeof process !== 'undefined' &&
    (process.env?.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      process.env?.VITE_GOOGLE_CLIENT_ID ||
      (process.env as any)?.REACT_APP_GOOGLE_CLIENT_ID)) ||
  '';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export class GoogleDriveService {
  private static tokenClient: GoogleTokenClient | null = null;
  private static isScriptLoaded = false;
  private static scriptLoadingPromise: Promise<void> | null = null;

  /**
   * Get configured Google OAuth Client ID
   */
  static getClientId(): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
      if (saved && saved.trim()) return saved.trim();
    }
    return ENV_CLIENT_ID;
  }

  /**
   * Save Google OAuth Client ID
   */
  static setClientId(clientId: string): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (clientId && clientId.trim()) {
        window.localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId.trim());
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
      }
    }
    // Reset token client when client ID changes
    this.tokenClient = null;
  }

  /**
   * Load the Google Identity Services (GSI) SDK dynamically
   */
  static async loadGsiScript(): Promise<void> {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      throw new Error('Google Identity Services is only available on web browsers.');
    }

    if (window.google?.accounts?.oauth2) {
      this.isScriptLoaded = true;
      return;
    }

    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          this.isScriptLoaded = true;
          resolve();
        });
        existingScript.addEventListener('error', (err) => reject(err));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.isScriptLoaded = true;
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services library. Please check your internet connection.'));
      };
      document.head.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }

  /**
   * Check if a valid, unexpired token exists in localStorage
   */
  static getActiveToken(): string | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    const token = window.localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiresAt = window.localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    if (!token || !expiresAt) return null;

    const expiryTime = parseInt(expiresAt, 10);
    // 60-second grace window before expiration
    if (Date.now() > expiryTime - 60000) {
      this.clearSession();
      return null;
    }

    return token;
  }

  /**
   * Get currently connected Google user info from localStorage
   */
  static getStoredUserInfo(): GoogleUserInfo | null {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.USER_INFO);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore JSON parse error
    }
    return null;
  }

  /**
   * Fetch user info from Google's userinfo endpoint
   */
  static async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Google profile (HTTP ${res.status}).`);
    }

    const data = await res.json();
    const info: GoogleUserInfo = {
      email: data.email || 'Google User',
      name: data.name || data.given_name || '',
      picture: data.picture || '',
      id: data.sub || '',
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(info));
    }

    return info;
  }

  /**
   * Initiates Google OAuth flow to connect or switch Google accounts
   */
  static async requestAccessToken(prompt: 'select_account' | 'consent' | '' = 'select_account'): Promise<{
    token: string;
    userInfo: GoogleUserInfo;
  }> {
    const clientId = this.getClientId();
    if (!clientId) {
      throw new Error(
        'Google OAuth Client ID is missing. Please configure your Client ID in the OAuth Settings panel below.'
      );
    }

    await this.loadGsiScript();

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          prompt,
          callback: async (response: GoogleTokenResponse) => {
            if (response.error) {
              reject(new Error(`Google Sign-In Error: ${response.error_description || response.error}`));
              return;
            }

            if (!response.access_token) {
              reject(new Error('No access token returned by Google Identity Services.'));
              return;
            }

            const token = response.access_token;
            const expiresIn = response.expires_in || 3600;
            const expiresAt = Date.now() + expiresIn * 1000;

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
              window.localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, String(expiresAt));
            }

            try {
              const userInfo = await this.fetchUserInfo(token);
              resolve({ token, userInfo });
            } catch (userErr: any) {
              resolve({
                token,
                userInfo: { email: 'Connected Google Account' },
              });
            }
          },
          error_callback: (err: any) => {
            reject(new Error(err?.message || 'Google OAuth authorization was cancelled or failed.'));
          },
        });

        this.tokenClient = tokenClient;
        tokenClient.requestAccessToken({ prompt });
      } catch (err: any) {
        reject(new Error(`Failed to initialize Google token client: ${err.message}`));
      }
    });
  }

  /**
   * Disconnects Google Drive, revokes the OAuth token, and clears the local session
   */
  static async disconnect(): Promise<void> {
    const token = this.getActiveToken();
    if (token && window.google?.accounts?.oauth2?.revoke) {
      try {
        await new Promise<void>((resolve) => {
          window.google!.accounts.oauth2.revoke(token, () => resolve());
          // Fallback timeout in case callback doesn't fire
          setTimeout(() => resolve(), 1500);
        });
      } catch (e) {
        console.warn('Revoke token error:', e);
      }
    }

    this.clearSession();
  }

  /**
   * Clear local session storage
   */
  static clearSession(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      window.localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
      window.localStorage.removeItem(STORAGE_KEYS.USER_INFO);
    }
  }

  /**
   * Save and get last used folder URL
   */
  static getLastFolderUrl(): string {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(STORAGE_KEYS.LAST_FOLDER_URL) || '';
    }
    return '';
  }

  static setLastFolderUrl(url: string): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (url && url.trim()) {
        window.localStorage.setItem(STORAGE_KEYS.LAST_FOLDER_URL, url.trim());
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.LAST_FOLDER_URL);
      }
    }
  }

  /**
   * Extracts Google Drive Folder ID from a URL or raw string
   */
  static extractFolderId(input: string): string | null {
    if (!input || !input.trim()) return null;
    const clean = input.trim().replace(/^["']|["']$/g, '');

    // e.g. https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBHKU...
    // or https://drive.google.com/drive/u/0/folders/1BxiMVs...
    const urlMatch = clean.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }

    // e.g. https://drive.google.com/open?id=1BxiMVs...
    const idParamMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      return idParamMatch[1];
    }

    // If already raw folder ID (Google Drive IDs are usually 15-50 chars alphanumeric + hyphen/underscore)
    if (/^[a-zA-Z0-9_-]{15,60}$/.test(clean)) {
      return clean;
    }

    return null;
  }

  /**
   * Fetches metadata for a Drive folder (name, confirmation)
   */
  static async getFolderMetadata(
    folderId: string,
    token: string
  ): Promise<{ id: string; name: string }> {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) {
      if (res.status === 401) {
        this.clearSession();
        throw new Error('Google authentication expired (HTTP 401). Please click "Switch / Reconnect Account".');
      }
      if (res.status === 404) {
        throw new Error(`Google Drive Folder not found (HTTP 404). Please ensure the Folder ID or URL is correct and your connected account has access.`);
      }
      throw new Error(`Failed to access Google Drive folder (HTTP ${res.status}).`);
    }

    const data = await res.json();
    if (data.trashed) {
      throw new Error('The specified Google Drive folder is in the Trash.');
    }

    return { id: data.id, name: data.name || 'Drive Folder' };
  }

  /**
   * Processes a single Drive file (Google Sheet, Excel, or CSV) and parses all tabs
   */
  private static async processDriveFile(
    file: DriveFileItem,
    token: string,
    onFileProgress?: (msg: string) => void
  ): Promise<DriveSheetScan> {
    const isGoogleSheet = file.mimeType === 'application/vnd.google-apps.spreadsheet';
    const isExcelOrCsv =
      file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimeType === 'application/vnd.ms-excel' ||
      file.mimeType === 'text/csv' ||
      file.mimeType === 'application/csv' ||
      file.mimeType === 'text/comma-separated-values' ||
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.xls') ||
      file.name.toLowerCase().endsWith('.csv');

    // Case 1: Native Google Spreadsheet
    if (isGoogleSheet) {
      try {
        onFileProgress?.(`Querying Sheets API for "${file.name}"...`);
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${file.id}?fields=sheets(properties(sheetId,title))`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          const tabs = metaData.sheets || [];
          if (tabs.length === 0) {
            return {
              fileId: file.id,
              fileName: file.name,
              mimeType: file.mimeType,
              status: 'error',
              errorMessage: 'Google Sheet has no worksheets/tabs.',
              tabs: [],
              sheetValidQuestions: [],
            };
          }

          const sheetTabs: DriveTabScan[] = [];
          const fileValidQuestions: Omit<Question, 'id'>[] = [];

          for (const tab of tabs) {
            const title = tab.properties?.title || 'Sheet1';
            const sheetId = tab.properties?.sheetId ?? 0;
            onFileProgress?.(`Reading tab "${title}" in "${file.name}"...`);

            const valuesRes = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${file.id}/values/${encodeURIComponent(
                title
              )}?valueRenderOption=FORMATTED_VALUE`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!valuesRes.ok) {
              let valErr = `HTTP ${valuesRes.status}`;
              try {
                const valJson = await valuesRes.json();
                if (valJson?.error?.message) valErr = valJson.error.message;
              } catch {}
              sheetTabs.push({
                tabName: title,
                sheetId,
                totalRows: 0,
                validQuestions: [],
                errors: [{ row: 1, error: `Could not read tab "${title}": ${valErr}` }],
              });
              continue;
            }

            const valuesData = await valuesRes.json();
            const rawRows: any[][] = valuesData.values || [];
            const parseResult = parseSpreadsheetRows(rawRows, {
              fileName: file.name,
              tabName: title,
            });

            sheetTabs.push({
              tabName: title,
              sheetId,
              totalRows: rawRows.length,
              validQuestions: parseResult.validQuestions,
              errors: parseResult.errors,
            });
            fileValidQuestions.push(...parseResult.validQuestions);
          }

          return {
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            status: 'success',
            tabs: sheetTabs,
            sheetValidQuestions: fileValidQuestions,
          };
        }

        // Sheets API returned non-OK. Read the exact error.
        let sheetsErrMsg = `HTTP ${metaRes.status}`;
        try {
          const errData = await metaRes.json();
          if (errData?.error?.message) sheetsErrMsg = errData.error.message;
        } catch {
          const errText = await metaRes.text().catch(() => '');
          if (errText) sheetsErrMsg = errText;
        }

        // Try automatic fallback: Export Google Sheet as XLSX via Google Drive API
        // (Drive API export requires only drive.readonly scope and works even if Sheets API is not enabled!)
        onFileProgress?.(`Falling back to Drive XLSX export for "${file.name}"...`);
        const exportRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (exportRes.ok) {
          const buffer = await exportRes.arrayBuffer();
          const tabResults = parseWorkbookAllTabs(buffer, { fileName: file.name });
          const sheetTabs: DriveTabScan[] = tabResults.map((t, idx) => ({
            tabName: t.sheetName,
            sheetId: idx,
            totalRows: t.totalRows,
            validQuestions: t.validQuestions,
            errors: t.errors,
          }));
          const fileValidQuestions = tabResults.flatMap((t) => t.validQuestions);

          return {
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            status: 'success',
            tabs: sheetTabs,
            sheetValidQuestions: fileValidQuestions,
          };
        }

        // Both Sheets API and Drive Export failed: report real error
        let finalError = sheetsErrMsg;
        if (metaRes.status === 403 && sheetsErrMsg.toLowerCase().includes('sheets api')) {
          finalError = `Google Sheets API is not enabled in your Google Cloud Project (${sheetsErrMsg}). Please enable the 'Google Sheets API' in your Google Cloud Console.`;
        } else if (metaRes.status === 403) {
          finalError = `Permission denied (HTTP 403): ${sheetsErrMsg}`;
        }

        return {
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          status: 'error',
          errorMessage: finalError,
          tabs: [],
          sheetValidQuestions: [],
        };
      } catch (err: any) {
        return {
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          status: 'error',
          errorMessage: err.message || 'Failed to read Google Sheet.',
          tabs: [],
          sheetValidQuestions: [],
        };
      }
    }

    // Case 2: Excel (.xlsx / .xls) or CSV uploaded to Drive
    if (isExcelOrCsv || true) {
      try {
        onFileProgress?.(`Downloading binary for "${file.name}"...`);
        const downloadRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!downloadRes.ok) {
          let dlError = `HTTP ${downloadRes.status}`;
          try {
            const errJson = await downloadRes.json();
            if (errJson?.error?.message) dlError = errJson.error.message;
          } catch {
            const errText = await downloadRes.text().catch(() => '');
            if (errText) dlError = errText;
          }

          return {
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            status: 'error',
            errorMessage: `Download failed (${dlError})`,
            tabs: [],
            sheetValidQuestions: [],
          };
        }

        const buffer = await downloadRes.arrayBuffer();
        const tabResults = parseWorkbookAllTabs(buffer, { fileName: file.name });

        const sheetTabs: DriveTabScan[] = tabResults.map((t, idx) => ({
          tabName: t.sheetName,
          sheetId: idx,
          totalRows: t.totalRows,
          validQuestions: t.validQuestions,
          errors: t.errors,
        }));
        const fileValidQuestions = tabResults.flatMap((t) => t.validQuestions);

        return {
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          status: 'success',
          tabs: sheetTabs,
          sheetValidQuestions: fileValidQuestions,
        };
      } catch (err: any) {
        return {
          fileId: file.id,
          fileName: file.name,
          mimeType: file.mimeType,
          status: 'error',
          errorMessage: err.message || 'Failed to parse Excel / CSV file.',
          tabs: [],
          sheetValidQuestions: [],
        };
      }
    }
  }

  /**
   * Scans a Google Drive folder for all Google Sheets, Excel files, and CSVs,
   * reads every tab in batches of 3, and parses questions with live progress.
   */
  static async scanFolder(
    folderInput: string,
    onProgress?: (status: {
      message: string;
      currentFile?: string;
      completedFiles?: number;
      totalFiles?: number;
    }) => void
  ): Promise<DriveFolderScanSummary> {
    const token = this.getActiveToken();
    if (!token) {
      throw new Error(
        'You are not connected to Google Drive. Please click "Connect Google Drive" first.'
      );
    }

    const folderId = this.extractFolderId(folderInput);
    if (!folderId) {
      throw new Error(
        'Invalid Google Drive Folder URL or ID. Please paste a valid folder link (e.g. https://drive.google.com/drive/folders/YOUR_FOLDER_ID).'
      );
    }

    onProgress?.({ message: 'Verifying Google Drive folder access...' });
    const folderMeta = await this.getFolderMetadata(folderId, token);

    // List all non-folder files inside this folder
    onProgress?.({ message: `Listing spreadsheets inside "${folderMeta.name}"...` });
    const query = `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&fields=files(id,name,mimeType,modifiedTime)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!listRes.ok) {
      let listErr = `HTTP ${listRes.status}`;
      try {
        const j = await listRes.json();
        if (j?.error?.message) listErr = j.error.message;
      } catch {}
      throw new Error(`Failed to list files in folder: ${listErr}`);
    }

    const listData = await listRes.json();
    const rawFiles: DriveFileItem[] = listData.files || [];

    // Filter to spreadsheet, excel, csv files
    const files = rawFiles.filter((f) => {
      const mime = (f.mimeType || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      return (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        mime.includes('csv') ||
        name.endsWith('.xlsx') ||
        name.endsWith('.xls') ||
        name.endsWith('.csv') ||
        mime === 'application/vnd.google-apps.spreadsheet' ||
        mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mime === 'application/vnd.ms-excel'
      );
    });

    if (files.length === 0) {
      throw new Error(
        `No spreadsheets, Excel files, or CSVs found inside folder "${folderMeta.name}". (Found ${rawFiles.length} other files).`
      );
    }

    const sheetsScans: DriveSheetScan[] = [];
    const allValidQuestions: Omit<Question, 'id'>[] = [];
    let totalTabsScanned = 0;
    let totalRowsScanned = 0;
    let totalErrors = 0;
    let failedFilesCount = 0;

    // Process files in small batches of 3 to avoid rate limits
    const BATCH_SIZE = 3;
    let completedCount = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);

      onProgress?.({
        message: `Scanning files ${completedCount + 1}–${Math.min(
          completedCount + batch.length,
          files.length
        )} of ${files.length}...`,
        currentFile: batch[0].name,
        completedFiles: completedCount,
        totalFiles: files.length,
      });

      const batchPromises = batch.map(async (file, bIdx) => {
        const fileNum = i + bIdx + 1;
        const res = await this.processDriveFile(file, token, (msg) => {
          onProgress?.({
            message: `Scanning ${fileNum} of ${files.length}: ${msg}`,
            currentFile: file.name,
            completedFiles: completedCount,
            totalFiles: files.length,
          });
        });

        completedCount++;
        onProgress?.({
          message: `Scanning ${completedCount} of ${files.length}: "${file.name}"...`,
          currentFile: file.name,
          completedFiles: completedCount,
          totalFiles: files.length,
        });

        return res;
      });

      const batchResults = await Promise.all(batchPromises);

      for (const res of batchResults) {
        sheetsScans.push(res);
        if (res.status === 'success') {
          allValidQuestions.push(...res.sheetValidQuestions);
          totalTabsScanned += res.tabs.length;
          for (const tab of res.tabs) {
            totalRowsScanned += tab.totalRows;
            totalErrors += tab.errors.length;
          }
        } else {
          failedFilesCount++;
          totalErrors++;
        }
      }

      // Small friendly pause between batches to avoid rate limits
      if (i + BATCH_SIZE < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    onProgress?.({
      message: `Completed! Scanned ${files.length} sheets and ${totalTabsScanned} tabs.`,
      completedFiles: files.length,
      totalFiles: files.length,
    });

    return {
      folderId,
      folderName: folderMeta.name,
      totalSheetsFound: files.length,
      totalTabsScanned,
      totalRowsScanned,
      validQuestionsCount: allValidQuestions.length,
      errorCount: totalErrors,
      failedFilesCount,
      sheets: sheetsScans,
      allValidQuestions,
    };
  }
}
