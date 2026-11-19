import AsyncStorage from '@react-native-async-storage/async-storage';

const GEMINI_API_KEY_STORAGE = 'bams_gemini_api_key_v1';
const GEMINI_MODEL_STORAGE = 'bams_gemini_model_v1';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const SUPPORTED_GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Fastest & Recommended)' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (High Accuracy)' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash (Balanced)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fallback)' },
];

export interface RephraseParams {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  reference?: string;
  questionType?: string;
  chapter?: string;
}

export interface RephraseResult {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export class GeminiService {
  private static cachedKey: string | null = null;
  private static cachedModel: string | null = null;

  /**
   * Retrieve the stored Gemini API key from AsyncStorage / localStorage
   */
  static async getApiKey(): Promise<string> {
    if (this.cachedKey) return this.cachedKey;
    try {
      const stored = await AsyncStorage.getItem(GEMINI_API_KEY_STORAGE);
      if (stored && stored.trim()) {
        this.cachedKey = stored.trim();
        return this.cachedKey;
      }
    } catch (e) {
      console.warn('Could not read Gemini API Key from storage:', e);
    }
    return '';
  }

  /**
   * Save the Gemini API key securely in AsyncStorage / localStorage
   */
  static async setApiKey(key: string): Promise<void> {
    const trimmed = (key || '').trim();
    this.cachedKey = trimmed;
    try {
      if (trimmed) {
        await AsyncStorage.setItem(GEMINI_API_KEY_STORAGE, trimmed);
      } else {
        await AsyncStorage.removeItem(GEMINI_API_KEY_STORAGE);
      }
    } catch (e) {
      console.warn('Could not persist Gemini API Key:', e);
    }
  }

  /**
   * Retrieve the preferred Gemini model
   */
  static async getModel(): Promise<string> {
    if (this.cachedModel) return this.cachedModel;
    try {
      const stored = await AsyncStorage.getItem(GEMINI_MODEL_STORAGE);
      if (stored && stored.trim()) {
        this.cachedModel = stored.trim();
        return this.cachedModel;
      }
    } catch (e) {
      console.warn('Could not read Gemini Model preference:', e);
    }
    return DEFAULT_GEMINI_MODEL;
  }

  /**
   * Set the preferred Gemini model
   */
  static async setModel(model: string): Promise<void> {
    this.cachedModel = model;
    try {
      await AsyncStorage.setItem(GEMINI_MODEL_STORAGE, model);
    } catch (e) {
      console.warn('Could not persist Gemini Model:', e);
    }
  }

  /**
   * Test the connection to the Gemini API with a minimal ping
   */
  static async testConnection(
    overrideKey?: string,
    overrideModel?: string
  ): Promise<{ success: boolean; message: string; modelUsed?: string }> {
    const apiKey = overrideKey?.trim() || (await this.getApiKey());
    if (!apiKey) {
      return { success: false, message: 'Please enter a Gemini API Key first.' };
    }

    const model = overrideModel || (await this.getModel());
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Respond with exactly {"status":"connected"} as valid JSON.' }],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg =
          errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        return {
          success: false,
          message: `API Error: ${errorMsg}`,
        };
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return {
          success: false,
          message: 'Received empty response from Gemini API.',
        };
      }

      return {
        success: true,
        message: `Successfully connected to Gemini API using model "${model}"!`,
        modelUsed: model,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message || 'Network error'}`,
      };
    }
  }

  /**
   * Rephrase and polish a question using Gemini API with the specialized BAMS system instructions
   */
  static async rephraseQuestion(params: RephraseParams): Promise<RephraseResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API Key is not set. Please click "AI Settings" in the header to enter your API key.'
      );
    }

    const preferredModel = await this.getModel();
    const candidateModels = [
      preferredModel,
      DEFAULT_GEMINI_MODEL,
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-1.5-flash',
    ];

    // Remove duplicates while preserving order
    const uniqueModels = Array.from(new Set(candidateModels));

    const systemInstruction = `You are an expert BAMS / AIAPGET Ayurveda exam editor. Rephrase the given MCQ into clear, grammatically correct, exam-grade English and natural Hindi. Fix spelling of Sanskrit/Ayurvedic terms (e.g., Charaka, Audbhida, Sharira) and formatting, but DO NOT change the core medical meaning, the correct answer option, or the classical Sanskrit Shloka reference. Return the result as structured JSON with keys: "questionText", "optionA", "optionB", "optionC", "optionD".`;

    const userPrompt = JSON.stringify(
      {
        questionType: params.questionType || 'Standard MCQ',
        chapter: params.chapter || '',
        referenceShloka: params.reference || '',
        questionText: params.questionText,
        optionA: params.optionA,
        optionB: params.optionB,
        optionC: params.optionC,
        optionD: params.optionD,
      },
      null,
      2
    );

    let lastError: any = null;

    for (const model of uniqueModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }],
            },
            contents: [
              {
                parts: [
                  {
                    text: `Please rephrase and polish this MCQ. Preserve both English and Hindi/Sanskrit text where applicable:\n\n${userPrompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.2,
            },
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
          // If model not found or deprecated, try next model in fallback list
          if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
            console.warn(`Model ${model} not available, falling back to next model...`);
            lastError = new Error(`Model ${model}: ${errMsg}`);
            continue;
          }
          throw new Error(`Gemini API error (${model}): ${errMsg}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          throw new Error('Gemini API returned an empty candidate.');
        }

        // Clean any markdown backticks if returned
        const cleaned = rawText
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim();

        const parsed = JSON.parse(cleaned);

        if (!parsed.questionText) {
          throw new Error('AI output missing "questionText" key.');
        }

        return {
          questionText: String(parsed.questionText).trim(),
          optionA: String(parsed.optionA ?? params.optionA).trim(),
          optionB: String(parsed.optionB ?? params.optionB).trim(),
          optionC: String(parsed.optionC ?? params.optionC).trim(),
          optionD: String(parsed.optionD ?? params.optionD).trim(),
        };
      } catch (err: any) {
        lastError = err;
        // If it was a network error or severe error, log and try next model
        console.warn(`Attempt with ${model} failed:`, err.message);
      }
    }

    throw lastError || new Error('Failed to rephrase question with Gemini API.');
  }
}
